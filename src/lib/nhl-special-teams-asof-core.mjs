// NHL special-teams official season-to-date snapshot research.
// Aggregated Power Play / Penalty Kill are NOT reconstructed from penalty events.
export const NHL_SPECIAL_TEAMS_VERSION='NHL_SPECIAL_TEAMS_ASOF_V3';
const hour=3600000;
const ms=v=>{const t=Date.parse(String(v??''));return Number.isFinite(t)?t:null;};
const norm=x=>String(x??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const rejected=(reason)=>({status:'NOT_READY',reason,version:NHL_SPECIAL_TEAMS_VERSION});
const pct=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1?x:null;
const games=x=>Number.isInteger(x)&&x>0&&x<=82?x:null;
// Exact NHL current-directory team names only. No guessed abbreviation, franchise ID
// or name prefix is allowed. The official public stats may change schema at any time.
export function parseNhlOfficialSpecialTeams({payload,directory,capturedAt,seasonId=20262027}){
 const at=ms(capturedAt);
 if(at===null||!Array.isArray(payload?.data)||payload.data.length<30||payload.data.length>40)
  return rejected('UNSUPPORTED_NHL_TEAM_REPORT');
 if(!(directory instanceof Map)||directory.size<30)return rejected('TEAM_DIRECTORY_UNVERIFIED');
 const idByName=new Map();
 for(const [id,t] of directory){
  if(!Number.isSafeInteger(Number(id))||!t?.name)return rejected('DIRECTORY_IDENTITY_UNVERIFIED');
  const key=norm(t.name);
  if(!key||idByName.has(key))return rejected('DUPLICATE_OFFICIAL_TEAM_NAMES');
  idByName.set(key,Number(id));
 }
 const seen=new Set(),teams=[];
 for(const r of payload.data){
  const key=norm(r?.teamFullName??r?.franchiseName);
  const teamId=idByName.get(key);
  const gp=games(r?.gamesPlayed),pp=pct(r?.powerPlayPct),pk=pct(r?.penaltyKillPct);
  if(teamId===undefined||seen.has(teamId)||gp===null||pp===null||pk===null)
   return rejected('REPORT_IDENTITY_OR_STATS_UNVERIFIED');
  // Row must be regular-season 2026-27 when the endpoint provides season/type fields.
  if(r?.seasonId!=null&&Number(r.seasonId)!==seasonId)return rejected('SEASON_MISMATCH');
  if(r?.gameTypeId!=null&&Number(r.gameTypeId)!==2)return rejected('REGULAR_SEASON_MISMATCH');
  seen.add(teamId);
  teams.push({teamId,gamesPlayed:gp,powerPlayPct:pp,penaltyKillPct:pk,
   teamName:directory.get(teamId).name});
 }
 if(teams.length<30)return rejected('INSUFFICIENT_VERIFIED_TEAM_COVERAGE');
 teams.sort((a,b)=>a.teamId-b.teamId);
 return {status:'VALIDATED_SOURCE_SCHEMA',version:NHL_SPECIAL_TEAMS_VERSION,
  capturedAt:new Date(at).toISOString(),seasonId,teams,
  exactTeamNameCoverage:teams.length,source:'NHL_OFFICIAL_TEAM_SUMMARY',
  actualPregameStarterIncluded:false,modelApplied:false};
}
export function selectNhlSpecialTeamsAsOf({snapshots,game,asOf,maxAgeHours=36}){
 const now=ms(asOf),start=ms(game?.scheduledAt);
 if(now===null||start===null||start-now<60*60000)return rejected('NOT_PREGAME_60M');
 if(!Number.isSafeInteger(game?.homeId)||!Number.isSafeInteger(game?.awayId)||game.homeId===game.awayId)
  return rejected('EVENT_IDENTITY_UNVERIFIED');
 if(!Array.isArray(snapshots))return rejected('SNAPSHOT_SOURCE_UNAVAILABLE');
 const available=snapshots.filter(x=>{
  const capture=ms(x?.captured_at);
  return capture!==null&&capture<=now&&now-capture<=maxAgeHours*hour&&
   x?.season_id===20262027&&x?.source_version===NHL_SPECIAL_TEAMS_VERSION&&
   /^[0-9a-f]{64}$/.test(String(x.source_hash??''))&&
   Array.isArray(x.teams)&&x.teams.length>=30;
 }).sort((a,b)=>ms(b.captured_at)-ms(a.captured_at));
 for(const snap of available){
  const home=snap.teams.find(x=>x.teamId===game.homeId),away=snap.teams.find(x=>x.teamId===game.awayId);
  if(!home||!away)continue;
  if([home.powerPlayPct,home.penaltyKillPct,away.powerPlayPct,away.penaltyKillPct]
    .some(x=>pct(x)===null))continue;
  return {status:'ASOF_SPECIAL_TEAMS_EVIDENCE',version:NHL_SPECIAL_TEAMS_VERSION,
   capturedAt:snap.captured_at,snapshotId:snap.id,
   home:{teamId:home.teamId,gamesPlayed:home.gamesPlayed,
    powerPlayPct:home.powerPlayPct,penaltyKillPct:home.penaltyKillPct},
   away:{teamId:away.teamId,gamesPlayed:away.gamesPlayed,
    powerPlayPct:away.powerPlayPct,penaltyKillPct:away.penaltyKillPct},
   source:'OFFICIAL_NHL_SEASON_TO_DATE_AT_CAPTURE',confirmedStartingGoalie:false,
   modelScoringAdjusted:false,sportsbookMarketPricesAvailable:false,
   warning:'Captured aggregate evidence only. Seasonal percentages cannot be replayed into dates before capture.'};
 }
 return rejected('NO_FRESH_VERIFIED_PREGAME_PP_PK');
}
