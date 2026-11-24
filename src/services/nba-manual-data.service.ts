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
 const unique=new Map<string,Row>(),conflicts=new Set<string>();
 for(const r of finals){const id=String(r.game_id),h=num(r.home_score),a=num(r.away_score);if(!/^bdl_nba_\\d+$/.test(id)||h===null||a===null||h===a||h<0||a<0)continue;const old=unique.get(id);if(old&&['home_team','away_team','home_score','away_score','commence_time'].some(k=>old[k]!==r[k]))conflicts.add(id);unique.set(id,r);}
 for(const id of conflicts)unique.delete(id);
 const games=[...unique.values()].sort((a,b)=>String(b.commence_time).localeCompare(String(a.commence_time)));
 const teamNames=new Set<string>();for(const g of games){teamNames.add(String(g.home_team));teamNames.add(String(g.away_team));}for(const f of fixtures){if(typeof f.home.name==='string')teamNames.add(f.home.name);if(typeof f.away.name==='string')teamNames.add(f.away.name);}
 const teams=[...teamNames].sort().map(name=>{const history=games.filter(g=>g.home_team===name||g.away_team===name).map(g=>{const home=g.home_team===name;return {id:g.game_id,date:g.commence_time,opponent:home?g.away_team:g.home_team,home,pointsFor:home?g.home_score:g.away_score,pointsAgainst:home?g.away_score:g.home_score};});const recent=history.slice(0,10);return {name,observedGames:history.length,wins:history.filter(g=>Number(g.pointsFor)>Number(g.pointsAgainst)).length,losses:history.filter(g=>Number(g.pointsFor)<Number(g.pointsAgainst)).length,pointsFor:avg(history,'pointsFor'),pointsAgainst:avg(history,'pointsAgainst'),recent,sequenceVerified:false};});
 const groups=new Map<string,Row[]>();for(const r of players){const k=String(r.player_id);const rows=groups.get(k)||[];rows.push(r);groups.set(k,rows);}
 const playerSummaries=[...groups.entries()].map(([playerId,rows])=>{rows.sort((a,b)=>String(b.game_datetime).localeCompare(String(a.game_datetime)));const played=rows.filter(r=>num(r.minutes_played)!==null&&Number(r.minutes_played)>0),recent=played.slice(0,10);return {playerId,observedTeamId:rows[0].team_id,observedAppearances:played.length,recent:recent.map(r=>({gameId:r.provider_game_id,date:r.game_datetime,teamId:r.team_id,opponentId:r.opponent_team_id,...Object.fromEntries(metrics.map(k=>[k,r[k]]))})),averages:Object.fromEntries(metrics.map(k=>[k,avg(recent,k)])),sequenceVerified:false};});
 const goatGames=new Set(players.map(r=>String(r.provider_game_id)));
 return {schemaVersion:'NBA_MANUAL_DATA_V1',sport:'NBA',date,timezone:'America/Puerto_Rico',readAt,status:'PARTIAL',readOnly:true,providerCalls:0,databaseWrites:0,predictionAdjustment:false,modelPromoted:false,source:{scheduleCapturedAt:snap.source_received_at,scheduleSnapshotId:snap.snapshot_id},coverage:{fixtures:fixtures.length,observedFinals:games.length,goatGames:goatGames.size,playerRows:players.length,players:playerSummaries.length,conflicts:conflicts.size,matchedFinals:games.filter(g=>goatGames.has(String(g.game_id).replace('bdl_nba_',''))).length},fixtures,teams,players:playerSummaries,warnings:['Historial observado, no récord oficial ni últimos diez consecutivos certificados.','Los jugadores se identifican por ID GOAT; el último equipo observado no certifica roster actual.','Cuartos, mitades, lesiones, alineaciones y matchups aún no integrados.','No se calculan recomendaciones ni probabilidades.']};
}
