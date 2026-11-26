import {indexEvidence,marketQuality} from '../decision-integrity.mjs';
import {latestUniqueQuotes} from '../decision-board-core.mjs';
import {auditRows,enrichEvidence} from './nba-evidence.mjs';
import {appearances} from './nba-history.mjs';
import {playerValues,scoreComparison} from './nba-props.mjs';
import {rankLines} from './nba-ranking.mjs';
import {reconcilePeriods} from './periods.mjs';
const statistics=new Set(['points','rebounds','assists','threes','points_rebounds_assists','points_rebounds','points_assists','rebounds_assists']);
const fields=['pts','reb','ast','fg3m','stl','blk','turnover'];
const periods={FULL_GAME_INCLUDING_OT:'FT',FULL_GAME_LABEL_OT_UNVERIFIED:'FT',FT:'FT',ft:'FT',q1:'Q1',q2:'Q2',q3:'Q3',q4:'Q4',h1:'1H',h2:'2H',ot:'OT'};
const otRules={INCLUDES_OVERTIME:'INCLUDES_OT',EXCLUDES_OVERTIME:'EXCLUDES_OT',INCLUDES_OT:'INCLUDES_OT',EXCLUDES_OT:'EXCLUDES_OT'};
const ms=Date.parse;
function quotesFor(inputs,evidence,game){
 const teamByPlayer=new Map();
 for(const [id,rows] of evidence.compact){
  const latest=rows.filter(r=>r.season===game.season&&ms(r.game_datetime)<ms(evidence.asOf)).sort((a,b)=>ms(b.game_datetime)-ms(a.game_datetime))[0];
  if(latest)teamByPlayer.set(id,latest.team_id);
 }
 const raw=latestUniqueQuotes(inputs.goatPropQuotes.filter(q=>q.provider_game_id===game.id),q=>[q.player_id,q.statistic,q.period,q.line,q.side].join('|'));
 return raw.flatMap(q=>{
  const period=periods[q.period]??(Object.values(periods).includes(q.period)?q.period:null);
  if(!period||!statistics.has(q.statistic)||q.american_odds< -650||q.market!=='props'||!Number.isFinite(Number(q.line))||Number(q.line)<0)return [];
  const quality=marketQuality(q,game,evidence,[{status:'VALIDATED',included:[{teamId:teamByPlayer.get(q.player_id)}]}]);
  const allowed=['OVERTIME_RULE_UNVERIFIED','PLAYER_AVAILABILITY_UNCONFIRMED'];
  if(period!=='FT'&&['over','under'].includes(q.side))allowed.push('MARKET_SIDE_PERIOD_OR_PRICE_MISMATCH');
  if(quality.issues.some(i=>!allowed.includes(i.reason))||!(ms(quality.expiresAt)>ms(inputs.asOf)))return [];
  const row={...q,book:quality.book,period,ot:otRules[q.payload?.overtime_rule]??'NOT_VERIFIED',line:Number(q.line),expiresAt:quality.expiresAt,
   limitations:quality.issues.filter(i=>i.reason!=='MARKET_SIDE_PERIOD_OR_PRICE_MISMATCH').map(i=>i.reason)};
  if(!scoreComparison(row))return [];
  return [row];
 });
}
function fixture(g){return {id:g.id,scheduledAt:g.datetime,home:{id:g.home_team.id,name:g.home_team.full_name},away:{id:g.visitor_team.id,name:g.visitor_team.full_name}};}
export async function buildSheetLab(input,db){
 const evidence=indexEvidence(input),day=input.asOf.slice(0,10);
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico'}).format(new Date(input.asOf));
 const open=input.scheduleGames.filter(g=>g.status_state==='scheduled'&&!g.postponed&&ms(g.datetime)>ms(input.asOf));
 const markets=open.map(g=>({gameId:g.id,status:'ARCHIVED',quotes:quotesFor(input,evidence,g)}));
 const ids=new Set(markets.flatMap(m=>m.quotes.map(q=>q.player_id)));
 const games=open.map(fixture),lineups=[],injuries=[];
 for(const f of games){
  const p=(input.pregame??[]).find(p=>p.game_ids?.includes(f.id)&&ms(p.captured_at)<=ms(input.asOf)&&ms(p.captured_at)<ms(f.scheduledAt));
  for(const l of p?.projected_lineups?.data??[])if(l.game_id===f.id)lineups.push({gameId:f.id,teamId:l.team_id,status:l.status,capturedAt:p.captured_at,players:(l.lineup??[]).map(x=>({playerId:x.player?.id,name:input.playerNames[x.player?.id],position:x.position}))});
  for(const x of p?.injuries?.data??[])if([f.home.id,f.away.id].includes(x.player?.team_id)&&(x.game_id==null||x.game_id===f.id))injuries.push({gameId:f.id,teamId:x.player.team_id,playerId:x.player.id,status:x.status,capturedAt:p.captured_at});
 }
 const finals=evidence.games.filter(x=>x.game.status_state==='final'&&!x.game.postponed&&ms(x.capturedAt)>ms(x.game.datetime)&&x.game.season===open[0]?.season&&x.game.postseason===open[0]?.postseason);
 const byId=new Map(finals.map(x=>[x.game.id,x.game]));
 const players=[...ids].map(id=>{
  const seen=new Set(),duplicates=new Set(),recent=[];
  for(const r of evidence.compact.get(id)??[]){
   const g=byId.get(r.provider_game_id),m=evidence.manifests.get(r.provider_game_id);
   if(!g||ms(g.datetime)!==ms(r.game_datetime)||![g.home_team.id,g.visitor_team.id].includes(r.team_id)||![g.home_team.id,g.visitor_team.id].includes(r.opponent_team_id)||r.team_id===r.opponent_team_id||m?.length!==1||m[0].response_sha256!==r.source_sha256||ms(m[0].source_captured_at)!==ms(r.source_captured_at))continue;
   if(seen.has(g.id))duplicates.add(g.id);seen.add(g.id);
   recent.push({gameId:g.id,date:g.datetime,teamId:r.team_id,opponentId:r.opponent_team_id,minutes_played:r.minutes_played,pts:r.pts,reb:r.reb,ast:r.ast,fg3m:r.fg3m,stl:r.stl,blk:r.blk,turnover:r.turnover});
  }
  return {playerId:id,name:input.playerNames[id],recent:recent.filter(r=>!duplicates.has(r.gameId)),duplicates:[...duplicates]};
 });
 const eligible=finals.filter(({game:g})=>evidence.boxes.get(g.id)&&[...evidence.boxes.get(g.id).keys()].some(id=>ids.has(id)));
 const archive={games:[],schedule:[]},selected=eligible.map(x=>x.game.id);
 const pbp=new Map(),bad=new Set();
 // Only GOAT snapshots already in Pick. Each game is read once across all markets/players.
 const chunks=[];for(let i=0;i<selected.length;i+=5)chunks.push(selected.slice(i,i+5));
 for(let at=0;at<chunks.length;at+=4)await Promise.all(chunks.slice(at,at+4).map(async group=>{
  const {data,error}=await db.from('nba_pbp_snapshots_v1').select('provider_game_id,captured_at,payload').in('provider_game_id',group).lte('captured_at',input.asOf).abortSignal(AbortSignal.timeout(4000));
  if(error)return;
  for(const r of data??[]){if(pbp.has(r.provider_game_id))bad.add(r.provider_game_id);pbp.set(r.provider_game_id,r);}
 }));
 const contexts=new Map(input.contexts.map(c=>[c.provider_game_id,c]));
 for(const {game:g} of eligible){
  const c=contexts.get(g.id),rows=c.player_stats.data,p=pbp.get(g.id);
  const periods=p&&!bad.has(g.id)&&ms(p.captured_at)>ms(g.datetime)&&p.payload?.data?.every(e=>e.game_id===g.id)?reconcilePeriods(rows[0].game,rows,p.payload.data):{};
  archive.games.push({id:String(g.id),at:c.player_stats_captured_at,start:g.datetime,home:g.home_team.id,away:g.visitor_team.id,scores:[g.home_team_score,g.visitor_team_score],players:rows.map(r=>[String(r.player.id),r.team.id,String(r.min),...fields.map(k=>r[k])]),periodAt:p?.captured_at,periods});
 }
 const matchups=[];
 const attackers=[...ids];for(let i=0;i<attackers.length;i+=35){
  const {data,error}=await db.from('nba_matchup_observations_v3').select('game_id,provider_game_id,offensive_player_id,defender_player_id,matchup_seconds,game_date,captured_at').in('offensive_player_id',attackers.slice(i,i+35)).gte('game_date',(open[0]?.season??Number(day.slice(0,4)))+'-10-01').lt('game_date',date).lte('captured_at',input.asOf).order('game_date',{ascending:false}).limit(1000).abortSignal(AbortSignal.timeout(4000));
  if(!error)matchups.push(...data??[]);
 }
 const report=enrichEvidence({fixtures:games,archivedMarkets:markets,players,lineups,injuries,matchups,date,readAt:input.asOf,finals:finals.map(({game:g})=>({gameId:String(g.id),scheduledAt:g.datetime,home:g.home_team.full_name,away:g.visitor_team.full_name,homeScore:g.home_team_score,awayScore:g.visitor_team_score}))},archive);
 for(const p of report.players){
  const conflict=new Set([...p.duplicates,...p.recent.filter(g=>evidence.boxes.has(Number(g.gameId))&&!evidence.boxes.get(Number(g.gameId))).map(g=>Number(g.gameId))]);
  const proof=report.evidence[String(p.playerId)]??={};
  for(const id of conflict)proof[id]={state:'Conflicto',periods:null};
  p.recent=p.recent.filter(r=>!conflict.has(Number(r.gameId)));
 }
 const profiles={},rows=[];
 for(const group of rankLines(report))for(const r of group){
  const key=r.f.id+'|'+r.m.playerId,p=report.players.find(p=>String(p.playerId)===String(r.m.playerId));
  if(!profiles[key]){
   const history=appearances(p,report,10),proof=report.evidence[r.m.playerId]??{};
   const audit=auditRows(report,r.m,history,10).map(a=>({...a,state:a.state==='Jugó'&&history.find(h=>String(h.gameId)===a.id)?.minutes_played<10?'Minutos insuficientes (<10 para proyección)':a.state}));
   profiles[key]={audit,history:history.map(g=>({id:g.gameId,date:g.date,minutes:g.minutes_played,FT:playerValues(g),periods:proof[g.gameId]?.periods??{}}))};
  }
  const q=r.q;
  rows.push({key,id:q.quote_id,gameId:r.f.id,game:r.game,start:r.f.scheduledAt,playerId:r.m.playerId,name:r.player,market:q.statistic,metric:r.key,period:r.period,side:r.side,line:r.line,odds:r.price,principal:r.principal,expires:q.expiresAt,captured:q.source_received_at,ot:q.ot,limitations:q.limitations,n:r.n10,avg:r.avg10,gap:r.gap10,pct:r.pct10,rate:r[q.side+'10'],checks:r.checks,conditions:r.conditions});
 }
 return {rows,profiles,at:input.asOf,date,coverage:{selectedBoxes:selected.length,periodGames:archive.games.filter(g=>Object.keys(g.periods).length).length,calendarIssues:evidence.calendarIssues.length}};
}
