// A zero-provider-call, fail-closed verifier for already archived NBA final player stats.
// Never use postgame stats as pregame features or bookmaker-settlement evidence.
const integer = x => typeof x==='number'&&Number.isSafeInteger(x)?x:
  typeof x==='string'&&/^(0|[1-9]\d*)$/.test(x)&&Number.isSafeInteger(Number(x))?Number(x):null;
const date = x => typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const minutes = x => x==='0'||x===0?0:typeof x==='string'&&/^\d{1,3}:([0-5]\d)$/.test(x)?
  Number(x.split(':')[0])*60+Number(x.split(':')[1]):null;
const FIELDS=['pts','reb','ast','fg3m'];
function teamId(game,side){
  const field=side==='home'?'home_team_id':'visitor_team_id';
  const nested=side==='home'?'home_team':'visitor_team';
  const direct=integer(game?.[field]),embedded=integer(game?.[nested]?.id);
  if(direct!==null&&embedded!==null&&direct!==embedded)return null;
  return direct??embedded;
}
const sameGame=(a,b)=>integer(a?.id)===integer(b?.id)&&
  a?.date===b?.date && a?.datetime===b?.datetime &&
  a?.status_state==='final'&&b?.status_state==='final' &&
  teamId(a,'home')!==null&&teamId(a,'home')===teamId(b,'home')&&
  teamId(a,'visitor')!==null&&teamId(a,'visitor')===teamId(b,'visitor')&&
  integer(a?.home_team_score)===integer(b?.home_team_score)&&
  integer(a?.visitor_team_score)===integer(b?.visitor_team_score);
export function verifiedArchivedPlayerFinal({context,final,providerGameId}={}){
  const rows=context?.player_stats?.data,sourceCaptured=date(context?.player_stats_captured_at);
  const game=final?.game??final,tip=date(game?.datetime);
  const id=integer(providerGameId);
  if(!Array.isArray(rows)||rows.length<10||rows.length>100||
     id===null||id!==integer(context?.provider_game_id)||id!==integer(game?.id)||
     sourceCaptured===null||tip===null||sourceCaptured<=tip||
     !Number.isSafeInteger(integer(game?.home_team_score))||
     !Number.isSafeInteger(integer(game?.visitor_team_score))||
     integer(game.home_team_score)<0||integer(game.visitor_team_score)<0||
     game.status_state!=='final'||game.postponed===true)return null;
  const homeId=teamId(game,'home'),awayId=teamId(game,'visitor');
  if(homeId===null||awayId===null||homeId===awayId)return null;
  const seen=new Set(),count=new Map([[homeId,0],[awayId,0]]),
    sum=new Map([[homeId,0],[awayId,0]]),playerRows=new Map();
  for(const p of rows){
    if(!sameGame(p?.game,game))return null;
    const playerId=integer(p?.player?.id),teamId=integer(p?.team?.id),
      playerTeamId=integer(p?.player?.team_id),time=minutes(p?.min);
    if(playerId===null||seen.has(playerId)||!count.has(teamId)||
       playerTeamId!==teamId||time===null)return null;
    seen.add(playerId);
    count.set(teamId,count.get(teamId)+1);
    // The provider can encode DNP as null, but only for a known zero-minute row.
    const pts=integer(p.pts);
    if(pts===null&&time!==0)return null;
    sum.set(teamId,sum.get(teamId)+(pts??0));
    if(time===0)continue; // DNP/zero minutes: never grade a contract.
    const stats={};
    for(const k of FIELDS){const n=integer(p[k]);if(n===null||n<0)return null;stats[k]=n;}
    playerRows.set(playerId,{provider_game_id:id,player_id:playerId,minutes_played:time/60,...stats});
  }
  if(count.get(homeId)<5||count.get(awayId)<5||
     sum.get(homeId)!==integer(game.home_team_score)||
     sum.get(awayId)!==integer(game.visitor_team_score))return null;
  return {source:'ARCHIVED_VERIFIED_BOX_SCORE',capturedAt:context.player_stats_captured_at,
    rows:playerRows,playerCount:rows.length,gameId:id};
}
