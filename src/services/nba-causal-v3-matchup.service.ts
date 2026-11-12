import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NBA_GOAT_POLICY} from '@/lib/nba/goat-provider-policy.mjs';

const SPORT='basketball_nba',ORIGIN='CURRENT_ERA_SHADOW',VERSION='NBA_CAUSAL_MATCHUPS_V3';
const MAX_ATTEMPTS=3,RETRY_HOURS=12,MIN_SETTLED_AGE_HOURS=3;
const providerGameId=(id:unknown)=>{const m=/^bdl_nba_(\d+)$/.exec(String(id??''));return m?Number(m[1]):null;};
const finite=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const minutes=(v:unknown)=>{const s=String(v??'').trim();if(!s)return 0;if(/^\d+:\d{1,2}$/.test(s)){const [m,sec]=s.split(':');return Number(m)+Number(sec)/60;}const n=Number(s);return Number.isFinite(n)?n:0;};
const playerName=(p:any)=>[p?.first_name,p?.last_name].filter(Boolean).join(' ').trim();

async function fetchJson(url:URL,key:string){
 const r=await fetch(url,{headers:{Authorization:key,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok||!(r.headers.get('content-type')??'').includes('application/json'))throw Error('NBA_CAUSAL_V3_PROVIDER_FAILED');
 return r.json();
}
function topPlayerIds(context:any){
 const rows=Array.isArray(context?.player_stats?.data)?context.player_stats.data:[];
 const byTeam=new Map<number,any[]>();
 for(const r of rows){
  const team=Number(r?.team?.id??r?.team_id),id=Number(r?.player?.id??r?.player_id);
  if(!Number.isSafeInteger(team)||!Number.isSafeInteger(id))continue;
  const arr=byTeam.get(team)??[];arr.push({id,min:minutes(r?.min)});byTeam.set(team,arr);
 }
 const ids:number[]=[];
 for(const arr of byTeam.values())ids.push(...arr.sort((a,b)=>b.min-a.min).slice(0,5).map(x=>x.id));
 return [...new Set(ids)];
}
function matchupStats(row:any,nameMap:Map<number,string>){
 const s=row?.stats??row;
 const offensivePlayerId=Number(row?.player_id??row?.player?.id) || null,defenderId=Number(row?.opponent_player_id??row?.opponent_player?.id) || null;
 return {
  offensivePlayerId,
  defenderId,
  offensivePlayer:playerName(row?.player) || row?.player_name || (offensivePlayerId?nameMap.get(offensivePlayerId):null) || null,
  defender:playerName(row?.opponent_player) || row?.opponent_player_name || (defenderId?nameMap.get(defenderId):null) || null,
  seconds:finite(s?.matchup_seconds),
  pts:finite(s?.matchup_player_points??s?.player_points??s?.pts),
  fgm:finite(s?.matchup_field_goals_made??s?.matchup_fgm??s?.fgm),
  fga:finite(s?.matchup_field_goals_attempted??s?.matchup_fga??s?.fga),
  fgPct:finite(s?.matchup_field_goals_percentage??s?.matchup_field_goal_percentage??s?.matchup_fg_pct??s?.fg_pct),
  turnovers:finite(s?.matchup_turnovers??s?.turnovers),
  shootingFouls:finite(s?.shooting_fouls),
 };
}
function advancedStats(row:any){
 const s=row?.stats??row;
 return {
  playerId:Number(row?.player?.id??row?.player_id)||null,
  player:playerName(row?.player)||row?.player_name||null,
  team:String(row?.team?.full_name??row?.team_name??''),
  offensiveRating:finite(s?.offensive_rating),
  defensiveRating:finite(s?.defensive_rating),
  netRating:finite(s?.net_rating),
  pace:finite(s?.pace),
  matchupMinutes:s?.matchup_minutes??null,
  matchupFgPct:finite(s?.matchup_fg_pct),
  matchupFga:finite(s?.matchup_fga),
  matchupPlayerPoints:finite(s?.matchup_player_points),
  switchesOn:finite(s?.switches_on),
  contestedFga:finite(s?.contested_fga),
  speed:finite(s?.speed),
  distance:finite(s?.distance),
  touches:finite(s?.touches),
 };
}
export async function syncNbaCausalV3Matchups({cap=1}:{cap?:number}={}){
 const key=process.env.BALLDONTLIE_API_KEY?.trim();if(!key)return {status:'KEY_UNAVAILABLE',provider_calls:0,written:0};
 const now=Date.now(),minSettled=new Date(now-MIN_SETTLED_AGE_HOURS*3600000).toISOString();
 const [pR,c2R,c3R]=await Promise.all([
  db.from('prediction_history').select('game_id,settled_at,feature_snapshot').eq('sport_key',SPORT).eq('prediction_origin',ORIGIN).eq('feature_snapshot->>goatProviderPolicy',NBA_GOAT_POLICY).not('settled_at','is',null).lte('settled_at',minSettled).order('settled_at',{ascending:true}).limit(500),
  db.from('nba_game_context_v2').select('game_id,player_stats').not('player_stats','is',null).limit(1000),
  db.from('nba_matchup_context_v3').select('game_id,coverage_status,attempt_count,next_retry_at').limit(1000),
 ]);
 if(pR.error||c2R.error||c3R.error)throw Error('NBA_CAUSAL_V3_PLAN_READ_FAILED');
 const c2=new Map((c2R.data??[]).map(x=>[x.game_id,x])),c3=new Map((c3R.data??[]).map(x=>[x.game_id,x]));
 const eligible=[...new Set((pR.data??[]).map(x=>x.game_id))].filter(id=>{
  if(providerGameId(id)===null||!c2.get(id)?.player_stats)return false;
  const old=c3.get(id);if(!old)return true;
  if(old.coverage_status==='COMPLETE'||old.coverage_status==='EXHAUSTED'||Number(old.attempt_count)>=MAX_ATTEMPTS)return false;
  return !old.next_retry_at||Date.parse(old.next_retry_at)<=now;
 }).slice(0,Math.max(0,Math.min(cap,1)));
 if(!eligible.length)return {status:'NO_OP',planned:0,provider_calls:0,written:0};
 let calls=0,written=0;const failures:string[]=[];
 for(const gameId of eligible){
  const gid=providerGameId(gameId);if(gid===null)continue;
  const ids=topPlayerIds(c2.get(gameId));if(!ids.length)continue;
  let matchups:any={data:[],meta:{}},advanced:any={data:[],meta:{}};
  try{
   const u=new URL('https://api.balldontlie.io/nba/v1/matchups');u.searchParams.append('game_ids[]',String(gid));for(const id of ids)u.searchParams.append('player_ids[]',String(id));u.searchParams.set('per_page','100');
   calls++;matchups=await fetchJson(u,key);
  }catch{failures.push(gameId+':MATCHUPS_FAILED');}
  try{
   const u=new URL('https://api.balldontlie.io/nba/v2/stats/advanced');u.searchParams.append('game_ids[]',String(gid));u.searchParams.set('period','0');u.searchParams.set('per_page','100');
   calls++;advanced=await fetchJson(u,key);
  }catch{failures.push(gameId+':ADVANCED_FAILED');}
  const old=c3.get(gameId),attempt=Number(old?.attempt_count??0)+1;
  const matchupRows=Array.isArray(matchups?.data)?matchups.data:[],advancedRows=Array.isArray(advanced?.data)?advanced.data:[];
  const matchupComplete=matchupRows.length>0&&!matchups?.meta?.next_cursor;
  const advancedComplete=advancedRows.length>0&&!advanced?.meta?.next_cursor;
  const complete=matchupComplete&&advancedComplete;
  const exhausted=!complete&&attempt>=MAX_ATTEMPTS;
  const capturedAt=new Date().toISOString();
  const row={
   game_id:gameId,provider_game_id:gid,
   matchups:matchupRows.length?{data:matchupRows,meta:matchups?.meta??{}}:null,
   advanced_stats:advancedRows.length?{data:advancedRows,meta:advanced?.meta??{}}:null,
   matchups_captured_at:matchupRows.length?capturedAt:null,
   advanced_captured_at:advancedRows.length?capturedAt:null,
   last_attempt_at:capturedAt,
   next_retry_at:complete||exhausted?null:new Date(Date.now()+RETRY_HOURS*3600000).toISOString(),
   attempt_count:attempt,
   coverage_status:complete?'COMPLETE':exhausted?'EXHAUSTED':'PARTIAL',
   provider:'balldontlie',source_version:VERSION,updated_at:capturedAt,
  };
  const w=await db.from('nba_matchup_context_v3').upsert(row,{onConflict:'game_id'}).select('game_id');if(w.error)throw Error('NBA_CAUSAL_V3_WRITE_FAILED');written+=w.data?.length??0;
 }
 return {status:failures.length?'PARTIAL':'COMPLETED',planned:eligible.length,provider_calls:calls,written,failures};
}

export function getNbaCausalV3Evidence(context:any,selection:string,playerGame:any,v2Context:any){
 const nameMap=new Map<number,string>();
 for(const r of Array.isArray(v2Context?.player_stats?.data)?v2Context.player_stats.data:[]){const id=Number(r?.player?.id??r?.player_id);if(Number.isSafeInteger(id))nameMap.set(id,playerName(r?.player)||String(r?.player_name??id));}
 const mRows=(Array.isArray(context?.matchups?.data)?context.matchups.data:[]).map((r:any)=>matchupStats(r,nameMap)).filter((x:any)=>x.offensivePlayerId&&x.defenderId);
 const aRows=(Array.isArray(context?.advanced_stats?.data)?context.advanced_stats.data:[]).map(advancedStats);
 const top=playerGame?.topScorers?.[0]??null,topId=Number(top?.id);
 const topMatchups=Number.isSafeInteger(topId)?mRows.filter((x:any)=>x.offensivePlayerId===topId).sort((a:any,b:any)=>(b.seconds??0)-(a.seconds??0)):[];
 const primary=topMatchups[0]??null;
 const selectedAdvanced=aRows.filter((x:any)=>x.team===selection);
 const labels:string[]=[];
 if(primary&&(primary.seconds??0)>=120)labels.push('CONFIRMED_PRIMARY_DEFENDER');
 if(primary&&(primary.seconds??0)>=120&&(primary.fga??0)>=5&&primary.fgPct!==null&&primary.fgPct<=0.35)labels.push('PRIMARY_DEFENDER_SUPPRESSION');
 if(primary&&(primary.seconds??0)>=120&&(primary.fga??0)>=5&&primary.fgPct!==null&&primary.fgPct>=0.60)labels.push('PRIMARY_DEFENDER_EXPLOITED');
 const switches=selectedAdvanced.reduce((s:number,x:any)=>s+(x.switchesOn??0),0);
 const contested=selectedAdvanced.reduce((s:number,x:any)=>s+(x.contestedFga??0),0);
 if(switches>=25)labels.push('HIGH_SWITCH_DEFENSE');
 if(contested>=35)labels.push('HIGH_CONTEST_VOLUME');
 const quality=context?.coverage_status==='COMPLETE'&&primary?'HIGH':mRows.length||aRows.length?'MEDIUM':'LOW';
 return {
  coverageStatus:context?.coverage_status??'MISSING',
  matchupRows:mRows.length,advancedRows:aRows.length,
  topScorer:top?{id:top.id??null,name:top.name??null,pts:top.pts??null}:null,
  primaryDefender:primary,
  topScorerMatchups:topMatchups.slice(0,5),
  selectedTeamAdvanced:{players:selectedAdvanced.length,switches,contestedFga:contested},
  labels:[...new Set(labels)],quality,
  confirmed:quality==='HIGH',
 };
}
