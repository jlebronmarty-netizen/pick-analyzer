import 'server-only';
import {supabaseAdmin} from '@/lib/supabase-admin';
import {readNcaabManualRows,validateNcaabManualDate,ncaabManualDate} from '@/services/ncaab-manual-data.service';

type Row=Record<string,unknown>;
const obj=(x:unknown):Row=>x&&typeof x==='object'&&!Array.isArray(x)?x as Row:{};
const arr=(x:unknown):unknown[]=>Array.isArray(x)?x:[];
const num=(x:unknown):number|null=>typeof x==='number'&&Number.isFinite(x)?x:null;
const dateOf=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x))?ncaabManualDate(x):null;
const metrics=['pts','reb','ast','fg3m','stl','blk','turnover','minutes_played'] as const;
const avg=(rows:Row[],key:string)=>{const v=rows.map(r=>num(r[key])).filter((x):x is number=>x!==null);return {value:v.length?v.reduce((a,b)=>a+b,0)/v.length:null,n:v.length};};
export async function getNbaManualData(date:string){
 validateNcaabManualDate(date);
 const readAt=new Date().toISOString(),year=Number(date.slice(0,4)),season=Number(date.slice(5,7))>=7?year:year-1;
 const start=date+'T00:00:00-04:00', seasonStart=season+'-10-01T00:00:00-04:00';
 const signal=AbortSignal.timeout(45000);
 const schedule=await supabaseAdmin.from('nba_market_schedules_v1').select('snapshot_id,source_received_at,payload').eq('date_local',date).lte('source_received_at',readAt).order('source_received_at',{ascending:false}).order('snapshot_id').limit(1).abortSignal(signal);
 if(schedule.error)throw Error('SCHEDULE_READ_FAILED');
 const snap=schedule.data?.[0],payload=obj(snap?.payload),data=obj(payload.data);
 if(!snap||!Array.isArray(data.games))throw Error('SCHEDULE_UNAVAILABLE');
 const fixtures=arr(data.games).map(obj).filter(g=>dateOf(g.datetime)===date).map(g=>({id:g.id,scheduledAt:g.datetime,home:{id:obj(g.home_team).id,name:obj(g.home_team).full_name},away:{id:obj(g.visitor_team).id,name:obj(g.visitor_team).full_name},state:g.status_state}));
 const finals=await readNcaabManualRows((after,limit)=>{
 let q=supabaseAdmin.from('game_results').select('id,game_id,home_team,away_team,home_score,away_score,commence_time,created_at',{count:'exact'}).eq('sport_key','basketball_nba').gte('commence_time',seasonStart).lt('commence_time',start).lte('created_at',readAt).order('id').limit(limit).abortSignal(signal);if(after)q=q.gt('id',after);return q;
 },{cap:3000});
 // Compact GOAT rows have a composite identity. Offset pagination is bounded,
 // with exact counts and duplicate checks; never label the result complete participation.
 const players:Row[]=[],seen=new Set<string>();let expected:number|null=null;
 for(let offset=0;offset<30000;offset+=500){
 const q=await supabaseAdmin.from('nba_goat_player_game_research_v1').select('provider_game_id,player_id,team_id,opponent_team_id,game_datetime,source_captured_at,materialized_at,minutes_played,pts,reb,ast,fg3m,stl,blk,turnover,projection_eligible',{count:'exact'}).eq('season',season).lt('game_datetime',start).lte('source_captured_at',readAt).lte('materialized_at',readAt).order('provider_game_id').order('player_id').range(offset,offset+499).abortSignal(signal);
 if(q.error||!q.data||q.count===null||q.count>30000||(expected!==null&&q.count!==expected))throw Error('PLAYER_READ_FAILED');expected=q.count;
 for(const row of q.data){const k=row.provider_game_id+':'+row.player_id;if(seen.has(k))throw Error('PLAYER_DUPLICATE');seen.add(k);players.push(row);}
 if(players.length===expected)break;if(q.data.length!==500)throw Error('PLAYER_INCOMPLETE');
 }
 if(players.length!==expected)throw Error('PLAYER_INCOMPLETE');
 // Existing context snapshots supply identities and final period scores.
 const contexts=await readNcaabManualRows((after,limit)=>{
 let q=supabaseAdmin.from('nba_game_context_v2').select('game_id,provider_game_id,player_stats,player_stats_captured_at',{count:'exact'}).lte('player_stats_captured_at',readAt).order('game_id').limit(limit).abortSignal(signal);if(after)q=q.gt('game_id',after);return q;
 },{key:'game_id',cap:2000,pageSize:25});
 const names=new Map<string,string>(),nameConflicts=new Set<string>(),teamDirectory=new Map<number,string>(),teamConflicts=new Set<number>();
 const addName=(p:Row)=>{const id=num(p.id),name=[p.first_name,p.last_name].filter(x=>typeof x==='string'&&x.trim()).join(' ').trim();if(id===null||!name)return;const k=String(id);if(names.has(k)&&names.get(k)!==name)nameConflicts.add(k);names.set(k,name);};
 const addTeam=(t:Row)=>{const id=num(t.id),name=t.full_name;if(id===null||typeof name!=='string'||!name)return;if(teamDirectory.has(id)&&teamDirectory.get(id)!==name)teamConflicts.add(id);teamDirectory.set(id,name);};
 for(const f of fixtures){addTeam({id:f.home.id,full_name:f.home.name});addTeam({id:f.away.id,full_name:f.away.name});}
 const periodCandidates=new Map<string,Row>(),periodConflicts=new Set<string>();
 for(const c of contexts){
 const rows=arr(obj(c.player_stats).data).map(obj);
 for(const row of rows){
 const g=obj(row.game),id=num(g.id),dt=g.datetime;
 if(id===null||id!==num(c.provider_game_id)||typeof dt!=='string'||!Number.isFinite(Date.parse(dt))||Date.parse(dt)>=Date.parse(start)||Date.parse(dt)<Date.parse(seasonStart)||g.season!==season||g.status_state!=='final')continue;
 addName(obj(row.player));addTeam(obj(row.team));
 const h=num(g.home_team_score),a=num(g.visitor_team_score),hi=num(g.home_team_id),ai=num(g.visitor_team_id);
 if(h===null||a===null||h===a||hi===null||ai===null||hi===ai||h<0||a<0)continue;
 const hq=[1,2,3,4].map(i=>num(g['home_q'+i])),aq=[1,2,3,4].map(i=>num(g['visitor_q'+i]));
 const ho=[1,2,3].map(i=>num(g['home_ot'+i])??0),ao=[1,2,3].map(i=>num(g['visitor_ot'+i])??0);
 const valid=hq.every(x=>x!==null&&Number.isInteger(x)&&x>=0)&&aq.every(x=>x!==null&&Number.isInteger(x)&&x>=0)&&ho.every(x=>Number.isInteger(x)&&x>=0)&&ao.every(x=>Number.isInteger(x)&&x>=0)&&[...hq,...ho].reduce<number>((s,x)=>s+(x??0),0)===h&&[...aq,...ao].reduce<number>((s,x)=>s+(x??0),0)===a;
 const k='bdl_nba_'+id,candidate={id:k,date:dt,homeId:hi,awayId:ai,homeScore:h,awayScore:a,homeQuarters:valid?hq:null,awayQuarters:valid?aq:null,homeOvertime:valid?ho:null,awayOvertime:valid?ao:null};
 const old=periodCandidates.get(k);if(old&&JSON.stringify(old)!==JSON.stringify(candidate))periodConflicts.add(k);periodCandidates.set(k,candidate);
 }
 }
 for(const id of teamConflicts)teamDirectory.delete(id);
 const unique=new Map<string,Row>(),conflicts=new Set<string>();
 for(const r of finals){const id=String(r.game_id),h=num(r.home_score),a=num(r.away_score);if(!/^bdl_nba_[0-9]+$/.test(id)||h===null||a===null||h===a||h<0||a<0)continue;const old=unique.get(id);if(old&&['home_team','away_team','home_score','away_score','commence_time'].some(k=>old[k]!==r[k]))conflicts.add(id);unique.set(id,r);}
 const periods:Row[]=[];
 for(const [id,p] of periodCandidates){
 if(periodConflicts.has(id))continue;
 const home=teamDirectory.get(Number(p.homeId)),away=teamDirectory.get(Number(p.awayId));
 if(!home||!away)continue;
 const old=unique.get(id);
 if(old&&(old.home_score!==p.homeScore||old.away_score!==p.awayScore||old.home_team!==home||old.away_team!==away||Date.parse(String(old.commence_time))!==Date.parse(String(p.date)))){conflicts.add(id);continue;}
 if(!old)unique.set(id,{game_id:id,home_team:home,away_team:away,home_score:p.homeScore,away_score:p.awayScore,commence_time:p.date});
 if(p.homeQuarters!==null&&p.awayQuarters!==null)periods.push({...p,home,away});
 }
 for(const id of conflicts)unique.delete(id);
 const verifiedPeriods=periods.filter(p=>!conflicts.has(String(p.id))).sort((a,b)=>Date.parse(String(b.date))-Date.parse(String(a.date)));
 const pre=await supabaseAdmin.from('nba_pregame_context_v1').select('captured_at,projected_lineups,injuries').gte('captured_at',start).lt('captured_at',new Date(Date.parse(start)+86400000).toISOString()).lte('captured_at',readAt).order('captured_at',{ascending:false}).order('snapshot_id').limit(1).abortSignal(signal);
 if(pre.error)throw Error('PREGAME_READ_FAILED');
 const pc=pre.data?.[0],lineups:Row[]=[],injuries:Row[]=[];
 for(const raw of arr(obj(pc?.projected_lineups).data)){
 const l=obj(raw),fixture=fixtures.find(f=>f.id===l.game_id&&(f.home.id===l.team_id||f.away.id===l.team_id));
 if(!fixture||!pc||Date.parse(pc.captured_at)>=Date.parse(String(fixture.scheduledAt)))continue;
 const people=arr(l.lineup).map(obj).map(x=>{const p=obj(x.player);addName(p);return {playerId:p.id,name:[p.first_name,p.last_name].filter(v=>typeof v==='string').join(' '),position:x.position};});
 lineups.push({gameId:l.game_id,teamId:l.team_id,status:l.status,players:people,capturedAt:pc.captured_at});
 }
 for(const raw of arr(obj(pc?.injuries).data)){
 const i=obj(raw),p=obj(i.player),fixture=fixtures.find(f=>f.home.id===p.team_id||f.away.id===p.team_id);
 if(!fixture||!pc||Date.parse(pc.captured_at)>=Date.parse(String(fixture.scheduledAt)))continue;
 addName(p);injuries.push({gameId:fixture.id,teamId:p.team_id,playerId:p.id,name:[p.first_name,p.last_name].filter(v=>typeof v==='string').join(' '),status:i.status,capturedAt:pc.captured_at});
 }
 for(const id of nameConflicts)names.delete(id);
 const games=[...unique.values()].sort((a,b)=>String(b.commence_time).localeCompare(String(a.commence_time)));
 const teamNames=new Set<string>(teamDirectory.values());for(const g of games){teamNames.add(String(g.home_team));teamNames.add(String(g.away_team));}for(const f of fixtures){if(typeof f.home.name==='string')teamNames.add(f.home.name);if(typeof f.away.name==='string')teamNames.add(f.away.name);}
 const teams=[...teamNames].sort().map(name=>{const history=games.filter(g=>g.home_team===name||g.away_team===name).map(g=>{const home=g.home_team===name;return {id:g.game_id,date:g.commence_time,opponent:home?g.away_team:g.home_team,home,pointsFor:home?g.home_score:g.away_score,pointsAgainst:home?g.away_score:g.home_score};});const recent=history.slice(0,10);return {name,observedGames:history.length,wins:history.filter(g=>Number(g.pointsFor)>Number(g.pointsAgainst)).length,losses:history.filter(g=>Number(g.pointsFor)<Number(g.pointsAgainst)).length,pointsFor:avg(history,'pointsFor'),pointsAgainst:avg(history,'pointsAgainst'),recent,sequenceVerified:false};});
 const groups=new Map<string,Row[]>();for(const r of players){const k=String(r.player_id);const rows=groups.get(k)||[];rows.push(r);groups.set(k,rows);}
 const playerSummaries=[...groups.entries()].map(([playerId,rows])=>{rows.sort((a,b)=>String(b.game_datetime).localeCompare(String(a.game_datetime)));const played=rows.filter(r=>num(r.minutes_played)!==null&&Number(r.minutes_played)>0),recent=played.slice(0,10);return {playerId,name:names.get(playerId)??null,observedTeamId:rows[0].team_id,observedAppearances:played.length,recent:recent.map(r=>({gameId:r.provider_game_id,date:r.game_datetime,teamId:r.team_id,opponentId:r.opponent_team_id,...Object.fromEntries(metrics.map(k=>[k,r[k]]))})),averages:Object.fromEntries(metrics.map(k=>[k,avg(recent,k)])),sequenceVerified:false};});
 const goatGames=new Set(players.map(r=>String(r.provider_game_id)));
 return {schemaVersion:'NBA_MANUAL_DATA_V1',sport:'NBA',date,timezone:'America/Puerto_Rico',readAt,status:'PARTIAL',readOnly:true,providerCalls:0,databaseWrites:0,predictionAdjustment:false,modelPromoted:false,source:{scheduleCapturedAt:snap.source_received_at,scheduleSnapshotId:snap.snapshot_id},coverage:{fixtures:fixtures.length,observedFinals:games.length,goatGames:goatGames.size,playerRows:players.length,players:playerSummaries.length,conflicts:conflicts.size,periodGames:verifiedPeriods.length,namedPlayers:playerSummaries.filter(p=>p.name!==null).length,lineups:lineups.length,injuries:injuries.length,matchedFinals:games.filter(g=>goatGames.has(String(g.game_id).replace('bdl_nba_',''))).length},fixtures,teams,players:playerSummaries,periods:verifiedPeriods,lineups,injuries,warnings:['Historial observado, no récord oficial ni últimos diez consecutivos certificados.','Los nombres se vinculan por ID GOAT cuando existe evidencia; el último equipo observado no certifica roster actual.','Cuartos y mitades solo donde los parciales suman el marcador final; contexto prepartido observado, no confirmado. Matchups aún pendientes.','No se calculan recomendaciones ni probabilidades.']};
}
