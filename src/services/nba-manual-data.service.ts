import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {originalContext} from '@/lib/nba/decision-storage-original.mjs';
import {verifiedArchivedPlayerFinal,reconciledPeriods} from '@/lib/nba/decision-archived-final-core.mjs';
import {supabaseAdmin} from '@/lib/supabase-admin';
import {readNcaabManualRows,validateNcaabManualDate,ncaabManualDate} from '@/services/ncaab-manual-data.service';

type Row=Record<string,unknown>;
// Immutable, hash-verified objects only; bounded per warm server instance.
const verifiedManualArchives=new Map<string,Row>();
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
 // Reuse immutable, hash-verified archive originals for missing operational contexts.
 // This reader is independent of the prediction board's budget and does not
 // modify its cache, environment flags, or provider activity.
 const manifests=await supabaseAdmin.from('nba_goat_season_archive_v1').select('season,provider_game_id,source_captured_at,response_sha256,data_count,storage_bucket,storage_object_path,compressed_bytes,json_bytes,game_date',{count:'exact'}).eq('season',season).eq('dataset_key','player_stats').lt('game_date',date).lte('source_captured_at',readAt).order('game_date',{ascending:false}).order('provider_game_id').limit(1500).abortSignal(signal);
 if(manifests.error||!manifests.data||manifests.count!==manifests.data.length)throw Error('MANIFEST_READ_INCOMPLETE');
 const have=new Set(contexts.map(c=>Number(c.provider_game_id)));
 const missing=manifests.data.filter(m=>!have.has(Number(m.provider_game_id)));
 const storage=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.any([signal,AbortSignal.timeout(7000),...(init?.signal?[init.signal]:[])])})}});
 let archiveBytes=0,archiveVerified=0,archiveAttempted=0,archiveQueued=0,archiveCacheHits=0;
 const archiveBudget=768*1024,archiveCap=180;
 const queued=missing.filter(m=>{
 if(m.storage_bucket!=='nba-goat-2026-private'||!Number.isSafeInteger(m.provider_game_id)||!/^[a-f0-9]{64}$/.test(m.response_sha256)||m.storage_object_path!==[season,m.provider_game_id,'player_stats',m.response_sha256+'.json.gz'].join('/')||!Number.isSafeInteger(m.compressed_bytes)||m.compressed_bytes<1||m.compressed_bytes>32768)return false;
 const cached=verifiedManualArchives.get(m.storage_object_path);
 if(cached&&cached.provider_game_id===m.provider_game_id&&cached.player_stats_captured_at===m.source_captured_at){contexts.push(cached);archiveVerified++;archiveCacheHits++;return false;}
 if(archiveQueued>=archiveCap||archiveBytes+m.compressed_bytes>archiveBudget)return false;
 archiveQueued++;archiveBytes+=m.compressed_bytes;return true;
 });
 for(let i=0;i<queued.length;i+=10){
 if(signal.aborted)break;
 const batch=await Promise.all(queued.slice(i,i+10).map(async m=>{
 archiveAttempted++;
 try{const res=await storage.storage.from(m.storage_bucket).download(m.storage_object_path);if(res.error||!res.data)return null;
 const ctx=originalContext(Buffer.from(await res.data.arrayBuffer()),m);
 const g=ctx?.player_stats?.data?.[0]?.game;
 if(!ctx||!g||!verifiedArchivedPlayerFinal({context:ctx,final:g,providerGameId:m.provider_game_id,allowPartialComponents:true}))return null;
 const result={...ctx,game_id:'bdl_nba_'+m.provider_game_id};
 if(verifiedManualArchives.size>=320){const first=verifiedManualArchives.keys().next().value;if(first!==undefined)verifiedManualArchives.delete(first);}
 verifiedManualArchives.set(m.storage_object_path,result);
 return result;
 }catch{return null;}
 }));
 for(const ctx of batch){if(ctx){contexts.push(ctx);archiveVerified++;}}
 }
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
 const valid=!!reconciledPeriods(g)&&hq.every(x=>x!==null&&Number.isInteger(x)&&x>=0)&&aq.every(x=>x!==null&&Number.isInteger(x)&&x>=0)&&ho.every(x=>Number.isInteger(x)&&x>=0)&&ao.every(x=>Number.isInteger(x)&&x>=0)&&[...hq,...ho].reduce<number>((s,x)=>s+(x??0),0)===h&&[...aq,...ao].reduce<number>((s,x)=>s+(x??0),0)===a;
 const k='bdl_nba_'+id,candidate={id:k,date:new Date(dt).toISOString(),homeId:hi,awayId:ai,homeScore:h,awayScore:a,homeQuarters:valid?hq:null,awayQuarters:valid?aq:null,homeOvertime:valid?ho:null,awayOvertime:valid?ao:null};
 const old=periodCandidates.get(k);if(old&&JSON.stringify(old)!==JSON.stringify(candidate))periodConflicts.add(k);periodCandidates.set(k,candidate);
 }
 }
 // An archived final scoreboard can establish the result even when the
 // original player box fails its stricter participation checks. Never use it
 // to certify player history or retroactively mark incomplete boxes complete.
 const scoreboardDays=[...new Set(players.filter(p=>!periodCandidates.has('bdl_nba_'+String(p.provider_game_id))||periodConflicts.has('bdl_nba_'+String(p.provider_game_id))).map(p=>dateOf(p.game_datetime)).filter((d):d is string=>d!==null&&d<date))].sort().reverse().slice(0,24);
 let scoreboardRecovered=0,scoreboardChecked=0,scoreboardUnavailable=0;
 for(let offset=0;offset<scoreboardDays.length;offset+=6){
 const batch=await Promise.all(scoreboardDays.slice(offset,offset+6).map(async day=>{
 const q=await supabaseAdmin.from('nba_market_schedules_v1').select('snapshot_id,source_received_at,recorded_at,payload').eq('date_local',day).lte('source_received_at',readAt).lte('recorded_at',readAt).order('source_received_at',{ascending:false}).order('snapshot_id').limit(1).abortSignal(signal);
 if(q.error)return {day,row:null};
 return {day,row:q.data?.[0]??null};
 }));
 for(const {day,row} of batch){
 if(!row){scoreboardUnavailable++;continue;}
 scoreboardChecked++;
 for(const raw of arr(obj(obj(row.payload).data).games)){
 const g=obj(raw),id=num(g.id),dt=g.datetime,ht=obj(g.home_team),at=obj(g.visitor_team),hi=num(ht.id),ai=num(at.id);
 const h=num(g.home_team_score),a=num(g.visitor_team_score);
 if(id===null||hi===null||ai===null||hi===ai||typeof dt!=='string'||dateOf(dt)!==day||Date.parse(row.source_received_at)<=Date.parse(dt)||g.season!==season||g.status_state!=='final'||g.postponed===true||h===null||a===null||h<0||a<0||h===a||!reconciledPeriods(g))continue;
 const k='bdl_nba_'+id;
 addTeam(ht);addTeam(at);
 const candidate={id:k,date:new Date(dt).toISOString(),homeId:hi,awayId:ai,homeScore:h,awayScore:a,homeQuarters:[1,2,3,4].map(i=>num(g['home_q'+i])),awayQuarters:[1,2,3,4].map(i=>num(g['visitor_q'+i])),homeOvertime:[1,2,3].map(i=>num(g['home_ot'+i])??0),awayOvertime:[1,2,3].map(i=>num(g['visitor_ot'+i])??0)};
 const old=periodCandidates.get(k);
 if(old&&JSON.stringify(old)!==JSON.stringify(candidate)){periodConflicts.add(k);continue;}
 if(!old&&!periodConflicts.has(k)){periodCandidates.set(k,candidate);scoreboardRecovered++;}
 }
 }
 }
 for(const id of teamConflicts)teamDirectory.delete(id);
 const unique=new Map<string,Row>(),conflicts=new Set<string>();
 for(const r of finals){const id=String(r.game_id),h=num(r.home_score),a=num(r.away_score);if(!/^bdl_nba_[0-9]+$/.test(id)||h===null||a===null||h===a||h<0||a<0)continue;const old=unique.get(id);if(old&&['home_team','away_team','home_score','away_score','commence_time'].some(k=>old[k]!==r[k]))conflicts.add(id);unique.set(id,r);}
 const periods:Row[]=[];
 for(const [id,p] of periodCandidates){
 if(periodConflicts.has(id)){conflicts.add(id);continue;}
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
 const games=[...unique.values()].sort((a,b)=>Date.parse(String(b.commence_time))-Date.parse(String(a.commence_time)));
 const teamNames=new Set<string>(teamDirectory.values());for(const g of games){teamNames.add(String(g.home_team));teamNames.add(String(g.away_team));}for(const f of fixtures){if(typeof f.home.name==='string')teamNames.add(f.home.name);if(typeof f.away.name==='string')teamNames.add(f.away.name);}
 const teams=[...teamNames].sort().map(name=>{const history=games.filter(g=>g.home_team===name||g.away_team===name).map(g=>{const home=g.home_team===name;return {id:g.game_id,date:g.commence_time,opponent:home?g.away_team:g.home_team,home,pointsFor:home?g.home_score:g.away_score,pointsAgainst:home?g.away_score:g.home_score};});const recent=history.slice(0,10);return {name,observedGames:history.length,wins:history.filter(g=>Number(g.pointsFor)>Number(g.pointsAgainst)).length,losses:history.filter(g=>Number(g.pointsFor)<Number(g.pointsAgainst)).length,pointsFor:avg(history,'pointsFor'),pointsAgainst:avg(history,'pointsAgainst'),recent,sequenceVerified:false};});
 const groups=new Map<string,Row[]>();for(const r of players){const k=String(r.player_id);const rows=groups.get(k)||[];rows.push(r);groups.set(k,rows);}
 const rosterPlayerIds=new Set([
  ...lineups.flatMap(l=>arr(l.players).map(p=>String(obj(p).playerId))),
  ...injuries.map(p=>String(p.playerId)),
 ]);
 const appearance=(r:Row)=>({gameId:r.provider_game_id,date:r.game_datetime,teamId:r.team_id,opponentId:r.opponent_team_id,...Object.fromEntries(metrics.map(k=>[k,r[k]]))});
 const playerSummaries=[...groups.entries()].map(([playerId,rows])=>{
  rows.sort((a,b)=>Date.parse(String(b.game_datetime))-Date.parse(String(a.game_datetime)));
  const played=rows.filter(r=>num(r.minutes_played)!==null&&Number(r.minutes_played)>0),recent=played.slice(0,10);
  return {playerId,name:names.get(playerId)??null,observedTeamId:rows[0].team_id,observedAppearances:played.length,
   recent:recent.map(appearance),...(rosterPlayerIds.has(playerId)?{earlierAppearances:played.slice(10).map(appearance)}:{}),
   averages:Object.fromEntries(metrics.map(k=>[k,avg(recent,k)])),sequenceVerified:false};
 });
 // Read only matchups involving today's observed participants. Historical
 // game date and capture are retained; these are not projected assignments.
 const participantIds=[...new Set(lineups.flatMap(l=>arr(l.players).map(x=>num(obj(x).playerId))).filter((x):x is number=>x!==null))];
 const matchups:Row[]=[],matchupKeys=new Set<string>();let matchupExpected:number|null=null;
 if(participantIds.length){
 for(let offset=0;offset<15000;offset+=500){
 const ids=participantIds.join(',');
 const q=await supabaseAdmin.from('nba_matchup_observations_v3').select('game_id,provider_game_id,game_date,offensive_player_id,defender_player_id,offensive_player_name,defender_player_name,matchup_seconds,player_points,fgm,fga,assists,turnovers,captured_at',{count:'exact'}).gte('game_date',seasonStart.slice(0,10)).lt('game_date',date).lte('captured_at',readAt).or('offensive_player_id.in.('+ids+'),defender_player_id.in.('+ids+')').order('game_id').order('offensive_player_id').order('defender_player_id').range(offset,offset+499).abortSignal(signal);
 if(q.error||!q.data||q.count===null||q.count>15000||(matchupExpected!==null&&q.count!==matchupExpected))throw Error('MATCHUP_READ_FAILED');matchupExpected=q.count;
 for(const r of q.data){const key=r.game_id+':'+r.offensive_player_id+':'+r.defender_player_id;if(matchupKeys.has(key))throw Error('MATCHUP_DUPLICATE');matchupKeys.add(key);matchups.push(r);}
 if(matchups.length===matchupExpected)break;if(q.data.length!==500)throw Error('MATCHUP_INCOMPLETE');
 }
 if(matchups.length!==matchupExpected)throw Error('MATCHUP_INCOMPLETE');
 }
 matchups.sort((a,b)=>String(b.game_date).localeCompare(String(a.game_date)));
 // Optional archive extensions never invalidate the base V1 report.
 const archivedMarkets=(await Promise.all(fixtures.flatMap(f=>['game','props'].map(async family=>{
  const gameId=Number(f.id),cutoff=new Date(Math.min(Date.parse(readAt),Date.parse(String(f.scheduledAt))-1)).toISOString();
  let request=supabaseAdmin.from('nba_market_snapshots_v1').select('snapshot_id,internal_event_id,quote_count,source_received_at,batches:payload->meta->>batch_count').eq('provider_game_id',gameId).eq('date_local',date).eq('phase','PREGAME').lte('recorded_at',cutoff).lte('source_received_at',cutoff);
  request=family==='game'?request.is('payload->meta->>batch_count',null):request.not('payload->meta->>batch_count','is',null);
  const snapshot=await request.order('source_received_at',{ascending:false}).order('snapshot_id').limit(1).abortSignal(signal).maybeSingle();
  const snap=snapshot.data;
  if(snapshot.error||!snap||snap.quote_count>1000||(family==='props'&&Number(snap.batches)!==1))return {gameId,family,status:snapshot.error?'UNAVAILABLE':'PARTIAL',quotes:[]};
  const scheduledGame=arr(data.games).map(obj).find(g=>g.id===f.id);
  const homeCode=obj(scheduledGame?.home_team).abbreviation,awayCode=obj(scheduledGame?.visitor_team).abbreviation;
  if(typeof homeCode!=='string'||typeof awayCode!=='string'||!(/^[A-Z]{2,3}$/).test(homeCode)||!(/^[A-Z]{2,3}$/).test(awayCode))return {gameId,family,status:'UNVERIFIED_ID',quotes:[]};
  const link=await supabaseAdmin.from('nba_market_event_links_v1').select('provider_game_id').eq('provider_game_id',gameId).eq('internal_event_id',snap.internal_event_id).eq('home_team_id','nba_'+homeCode.toLowerCase()).eq('away_team_id','nba_'+awayCode.toLowerCase()).eq('start_time',String(f.scheduledAt)).lte('created_at',cutoff).abortSignal(signal).maybeSingle();
  if(link.error||!link.data)return {gameId,family,status:'UNVERIFIED_ID',quotes:[]};
  const q=await supabaseAdmin.from('nba_market_quotes_v1').select('quote_id,player_id,market,statistic,period,side,line,american_odds,contract,provider_updated_at,source_received_at,book:payload->>sportsbook,ot:payload->>overtime_rule').eq('snapshot_id',snap.snapshot_id).eq('provider_game_id',gameId).eq('internal_event_id',snap.internal_event_id).eq('phase','PREGAME').lte('recorded_at',cutoff).lte('source_received_at',cutoff).order('quote_id').limit(1000).abortSignal(signal);
  if(q.error||!q.data||q.data.length!==snap.quote_count)return {gameId,family,status:'PARTIAL',quotes:[]};
  return {gameId,family,status:'ARCHIVED',snapshotId:snap.snapshot_id,capturedAt:snap.source_received_at,quotes:q.data};
 }))));
 const meetings=verifiedPeriods.filter(p=>fixtures.some(f=>(p.homeId===f.home.id&&p.awayId===f.away.id)||(p.homeId===f.away.id&&p.awayId===f.home.id)));
 const meetingIds=new Set(meetings.map(p=>String(p.id).replace('bdl_nba_','')));
 const meetingPlayers=players.filter(r=>meetingIds.has(String(r.provider_game_id))).map(r=>({gameId:r.provider_game_id,playerId:r.player_id,name:names.get(String(r.player_id))??null,teamId:r.team_id,season,...Object.fromEntries(metrics.map(k=>[k,r[k]]))}));
 const goatGames=new Set(players.map(r=>String(r.provider_game_id)));
 return {schemaVersion:'NBA_MANUAL_DATA_V1',sport:'NBA',date,timezone:'America/Puerto_Rico',readAt,status:'PARTIAL',readOnly:true,providerCalls:0,databaseWrites:0,predictionAdjustment:false,modelPromoted:false,source:{scheduleCapturedAt:snap.source_received_at,scheduleSnapshotId:snap.snapshot_id},coverage:{fixtures:fixtures.length,observedFinals:games.length,goatGames:goatGames.size,playerRows:players.length,players:playerSummaries.length,conflicts:conflicts.size,periodGames:verifiedPeriods.length,archiveMissing:missing.length,archiveAttempted,archiveVerified,archiveCacheHits,scoreboardChecked,scoreboardUnavailable,scoreboardRecovered,namedPlayers:playerSummaries.filter(p=>p.name!==null).length,lineups:lineups.length,injuries:injuries.length,matchupRows:matchups.length,matchedFinals:games.filter(g=>goatGames.has(String(g.game_id).replace('bdl_nba_',''))).length},archivedMarkets,meetingPlayers,observedSeason:season,fixtures,teams,players:playerSummaries,finals:games.map(g=>({gameId:String(g.game_id).replace('bdl_nba_',''),scheduledAt:g.commence_time,home:g.home_team,away:g.away_team,homeScore:g.home_score,awayScore:g.away_score})),periods:verifiedPeriods,lineups,injuries,matchups,warnings:['Historial observado, no récord oficial ni últimos diez consecutivos certificados. Los archivos originales se verifican por hash y consistencia del box score; los que no pasan se excluyen del historial individual certificado. Los marcadores de carteleras finales conciliadas pueden aportar resultados independientes, sin certificar las participaciones.','Los nombres se vinculan por ID GOAT cuando existe evidencia; el último equipo observado no certifica roster actual.','Cuartos y mitades solo donde los parciales suman el marcador final; contexto prepartido observado, no confirmado. Matchups históricos de jugadores con alineación archivada para la jornada, no asignaciones proyectadas.','No se calculan recomendaciones ni probabilidades.']};
}
