import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NBA_GOAT_POLICY} from '@/lib/nba/goat-provider-policy.mjs';

const SPORT='basketball_nba',ORIGIN='CURRENT_ERA_SHADOW',CTX_VERSION='NBA_CAUSAL_CONTEXT_V2';
const providerGameId=(id:unknown)=>{const m=/^bdl_nba_(\d+)$/.exec(String(id??''));return m?Number(m[1]):null;};
const finite=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const minutes=(v:unknown)=>{const s=String(v??'').trim();if(!s)return null;if(/^\d+:\d{1,2}$/.test(s)){const [m,sec]=s.split(':');return Number(m)+Number(sec)/60;}const n=Number(s);return Number.isFinite(n)?n:null;};
async function fetchJson(url:URL,key:string){
 const r=await fetch(url,{headers:{Authorization:key,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json'))throw Error('NBA_CAUSAL_V2_PROVIDER_FAILED');
 return r.json();
}
function groupByGame(rows:any[]){
 const m=new Map<number,any[]>();for(const row of rows){const id=Number(row?.game_id??row?.game?.id);if(!Number.isSafeInteger(id))continue;const arr=m.get(id)??[];arr.push(row);m.set(id,arr);}return m;
}
function playerName(p:any){return [p?.first_name,p?.last_name].filter(Boolean).join(' ').trim();}
function summarizeLineups(projected:any,actual:any,selection:string){
 const pRows=Array.isArray(projected?.data)?projected.data:[];
 const aRows=Array.isArray(actual?.data)?actual.data:[];
 const projectedTeam=pRows.find((r:any)=>String(r?.team?.full_name??r?.team_name??'')===selection)||pRows.find((r:any)=>Array.isArray(r?.lineup)&&String(r?.team?.full_name??'')===selection);
 const actualStarters=aRows.filter((r:any)=>r?.starter===true&&String(r?.team?.full_name??'')===selection);
 const projectedPlayers=Array.isArray(projectedTeam?.lineup)?projectedTeam.lineup.map((x:any)=>({id:x?.player?.id??null,name:playerName(x?.player),position:x?.position??null})).filter((x:any)=>x.id||x.name):[];
 const actualPlayers=actualStarters.map((x:any)=>({id:x?.player?.id??null,name:playerName(x?.player),position:x?.position??null})).filter((x:any)=>x.id||x.name);
 const pIds=new Set(projectedPlayers.map((x:any)=>String(x.id??x.name))),aIds=new Set(actualPlayers.map((x:any)=>String(x.id??x.name)));
 const added=actualPlayers.filter((x:any)=>!pIds.has(String(x.id??x.name))),removed=projectedPlayers.filter((x:any)=>!aIds.has(String(x.id??x.name)));
 return {projectedStatus:projectedTeam?.status??null,projectedPlayers,actualStarters:actualPlayers,starterChanges:added.length+removed.length,addedStarters:added,removedStarters:removed,complete:projectedPlayers.length===5&&actualPlayers.length===5};
}
function summarizeStats(stats:any,selection:string){
 const rows=(Array.isArray(stats?.data)?stats.data:[]).filter((r:any)=>String(r?.team?.full_name??'')===selection);
 const players=rows.map((r:any)=>({id:r?.player?.id??null,name:playerName(r?.player),min:minutes(r?.min),pts:finite(r?.pts),reb:finite(r?.reb),ast:finite(r?.ast),tov:finite(r?.turnover),fg3m:finite(r?.fg3m),fg3a:finite(r?.fg3a),plusMinus:finite(r?.plus_minus)}));
 const played=players.filter((p:any)=>(p.min??0)>0);
 const topScorers=[...played].sort((a:any,b:any)=>(b.pts??0)-(a.pts??0)).slice(0,3);
 const highMinutes=played.filter((p:any)=>(p.min??0)>=35);
 const lowStarterMinutes=played.filter((p:any)=>(p.min??0)>0&&(p.min??0)<20);
 const totals=played.reduce((a:any,p:any)=>({pts:a.pts+(p.pts??0),reb:a.reb+(p.reb??0),ast:a.ast+(p.ast??0),tov:a.tov+(p.tov??0),fg3m:a.fg3m+(p.fg3m??0),fg3a:a.fg3a+(p.fg3a??0)}),{pts:0,reb:0,ast:0,tov:0,fg3m:0,fg3a:0});
 return {playerRows:rows.length,playersUsed:played.length,topScorers,highMinutes,lowStarterMinutes,totals,complete:rows.length>=8};
}
export async function syncNbaCausalV2Context({cap=3}:{cap?:number}={}){
 const key=process.env.BALLDONTLIE_API_KEY?.trim();if(!key)return {status:'KEY_UNAVAILABLE',provider_calls:0,written:0};
 const [pR,cR]=await Promise.all([
  db.from('prediction_history').select('game_id,settled_at,feature_snapshot').eq('sport_key',SPORT).eq('prediction_origin',ORIGIN).eq('feature_snapshot->>goatProviderPolicy',NBA_GOAT_POLICY).not('settled_at','is',null).order('settled_at',{ascending:true}).limit(500),
  db.from('nba_game_context_v2').select('game_id,projected_lineups,actual_lineups,player_stats').limit(1000),
 ]);
 if(pR.error||cR.error)throw Error('NBA_CAUSAL_V2_PLAN_READ_FAILED');
 const current=new Map((cR.data??[]).map(x=>[x.game_id,x]));
 const ids=[...new Set((pR.data??[]).map(x=>x.game_id).filter((x:any)=>providerGameId(x)!==null).filter((x:any)=>{const c=current.get(x);return !c?.projected_lineups||!c?.actual_lineups||!c?.player_stats;}))].slice(0,Math.max(0,Math.min(cap,3)));
 if(!ids.length)return {status:'NO_OP',planned:0,provider_calls:0,written:0};
 const gids=ids.map(x=>providerGameId(x)).filter((x):x is number=>x!==null);
 let calls=0;const failures:string[]=[];let projected:any={data:[]},actual:any={data:[]},stats:any={data:[]};
 try{const u=new URL('https://api.balldontlie.io/nba/v1/projected_lineups');for(const id of gids)u.searchParams.append('game_ids[]',String(id));u.searchParams.set('per_page','100');calls++;projected=await fetchJson(u,key);}catch(e){failures.push('PROJECTED_LINEUPS_FAILED');}
 try{const u=new URL('https://api.balldontlie.io/nba/v1/lineups');for(const id of gids)u.searchParams.append('game_ids',String(id));u.searchParams.set('per_page','100');calls++;actual=await fetchJson(u,key);}catch(e){failures.push('ACTUAL_LINEUPS_FAILED');}
 try{const u=new URL('https://api.balldontlie.io/v1/stats');for(const id of gids)u.searchParams.append('game_ids[]',String(id));u.searchParams.set('per_page','100');calls++;stats=await fetchJson(u,key);}catch(e){failures.push('PLAYER_STATS_FAILED');}
 const pg=groupByGame(projected?.data??[]),ag=groupByGame(actual?.data??[]),sg=groupByGame(stats?.data??[]);
 let written=0;const now=new Date().toISOString();
 for(const gameId of ids){
  const gid=providerGameId(gameId);if(gid===null)continue;const prev=current.get(gameId);
  const pRows=pg.get(gid)??[],aRows=ag.get(gid)??[],sRows=sg.get(gid)??[];
  const row:any={game_id:gameId,provider_game_id:gid,provider:'balldontlie',source_version:CTX_VERSION,updated_at:now};
  if(pRows.length){row.projected_lineups={data:pRows};row.projected_captured_at=now;}else if(prev?.projected_lineups)row.projected_lineups=prev.projected_lineups;
  if(aRows.length){row.actual_lineups={data:aRows};row.actual_lineups_captured_at=now;}else if(prev?.actual_lineups)row.actual_lineups=prev.actual_lineups;
  if(sRows.length){row.player_stats={data:sRows};row.player_stats_captured_at=now;}else if(prev?.player_stats)row.player_stats=prev.player_stats;
  const w=await db.from('nba_game_context_v2').upsert(row,{onConflict:'game_id'}).select('game_id');if(w.error)throw Error('NBA_CAUSAL_V2_WRITE_FAILED');written+=w.data?.length??0;
 }
 return {status:failures.length?'PARTIAL':'COMPLETED',planned:ids.length,provider_calls:calls,written,failures};
}
export function getNbaCausalV2Evidence(context:any,selection:string){
 if(!context)return {lineups:null,playerStats:null,labels:[] as string[],quality:'NONE'};
 const lineups=summarizeLineups(context.projected_lineups,context.actual_lineups,selection);
 const playerStats=summarizeStats(context.player_stats,selection);
 const labels:string[]=[];
 if(lineups.complete&&lineups.starterChanges>=2)labels.push('MULTIPLE_STARTER_CHANGES');
 else if(lineups.complete&&lineups.starterChanges===1)labels.push('STARTER_CHANGE');
 if(playerStats.complete&&playerStats.playersUsed>=11)labels.push('DEEP_ROTATION');
 if(playerStats.complete&&playerStats.topScorers[0]?.pts!==null&&Number(playerStats.topScorers[0]?.pts)>=35)labels.push('STAR_SCORING_SPIKE');
 if(playerStats.complete&&playerStats.totals.tov>=18)labels.push('HIGH_TURNOVER_GAME');
 if(playerStats.complete&&playerStats.totals.fg3a>=30&&playerStats.totals.fg3m/playerStats.totals.fg3a>=0.45)labels.push('HOT_THREE_POINT_SHOOTING');
 const quality=lineups.complete&&playerStats.complete?'HIGH':lineups.complete||playerStats.complete?'MEDIUM':'LOW';
 return {lineups,playerStats,labels:[...new Set(labels)],quality};
}
