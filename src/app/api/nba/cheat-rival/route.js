import {nbaManualAccess} from '@/lib/nba/manual-access.mjs';
import {rivalAnalysis} from '@/lib/nba/cheat-rival.mjs';
import {getNbaManualData} from '@/services/nba-manual-data.service';
import {supabaseAdmin} from '@/lib/supabase-admin';
export const dynamic='force-dynamic';
export const maxDuration=60;
let cached;
async function snapshot(day,at){
  if(cached?.at===at)return cached.report;
  const report=getNbaManualData(day,at);
  cached={at,report};
  try{return await report;}catch(e){if(cached?.at===at)cached=null;throw e;}
}
async function lastRole(playerId,teamId,day,at){
  const result=await supabaseAdmin.from('nba_pregame_context_v1').select('captured_at,projected_lineups')
    .contains('projected_lineups',{data:[{team_id:teamId,lineup:[{player:{id:playerId}}]}]})
    .lt('captured_at',day+'T00:00:00-04:00').gte('captured_at',new Date(Date.parse(at)-45*86400000).toISOString())
    .order('captured_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(4000)).maybeSingle();
  const snap=result.data;
  const roles=new Set((snap?.projected_lineups?.data??[]).filter(l=>l.team_id===teamId)
    .flatMap(l=>(l.lineup??[]).filter(p=>p.player?.id===playerId).map(p=>p.position)).filter(Boolean));
  return roles.size===1?{teamId,position:[...roles][0],capturedAt:snap.captured_at}:null;
}
export async function GET(req){
  const respond=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  const denied=nbaManualAccess(req);
  if(denied)return respond({status:denied.code},denied.status);
  const params=new URL(req.url).searchParams,at=params.get('at'),game=Number(params.get('game')),player=Number(params.get('player'));
  const ms=Date.parse(at);
  if(!Number.isSafeInteger(game)||game<1||!Number.isSafeInteger(player)||player<1||!Number.isFinite(ms)||
    new Date(ms).toISOString()!==at||ms>Date.now()||Date.now()-ms>86400000)return respond({status:'INVALID_REQUEST'},400);
  const day=new Date(ms-4*3600000).toISOString().slice(0,10);
  try{
    const report=await snapshot(day,at);
    let data=rivalAnalysis(report,game,player,null);
    if(!data)return respond({status:'UNAVAILABLE'},404);
    if(!data.pos){
      const role=await lastRole(player,data.team.id,day,at).catch(()=>null);
      if(role)data=rivalAnalysis(report,game,player,role);
    }
    if(data.other){
      const query=await supabaseAdmin.from('nba_matchup_observations_v3')
        .select('game_id,game_date,matchup_seconds,player_points,fgm,fga,assists,turnovers')
        .eq('offensive_player_id',player).eq('defender_player_id',data.other.playerId)
        .gte('game_date',report.observedSeason+'-10-01').lt('game_date',day).lte('captured_at',at)
        .order('game_date',{ascending:false}).abortSignal(AbortSignal.timeout(4000));
      const rows=query.data??[];
      if(!query.error&&new Set(rows.map(r=>r.game_id)).size===rows.length)data.direct=rows;
    }
    return respond(data);
  }catch{return respond({status:'ARCHIVE_UNAVAILABLE'},503);}
}
