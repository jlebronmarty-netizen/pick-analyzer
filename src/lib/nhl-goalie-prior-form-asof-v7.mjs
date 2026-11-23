// NHL V7 experimental goalie identity/form evidence from official prior boxscores.
// NEVER a pregame confirmed-starter label and NEVER a production goal adjustment.
export const NHL_GOALIE_PRIOR_FORM='NHL_ASOF_PRIOR_GOALIE_FORM_RESEARCH_V7';
const at=v=>{const t=Date.parse(String(v??''));return Number.isFinite(t)?t:null};
const nameParts=x=>{
 if(typeof x!=='string'||x.length>100)return [];
 const n=x.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[łŁ]/g,'l')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 return n?n.split(' '):[];
};
export function nhlGoalieSameAbbreviatedIdentity(full,abbr){
 const a=nameParts(full),b=nameParts(abbr);
 if(a.length!==2||b.length!==2||b[0].length!==1||b[1].length<3)return false;
 return a[0][0]===b[0]&&a[1]===b[1];
}
const blocked=(reason,meta={})=>({status:'NOT_READY',reason,...meta,
 actualStartingGoalieConfirmed:false,nhlCrosswalkCertified:false,
 goalieAdjustmentApplied:false});
const toInt=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const secs=x=>{
 if(typeof x!=='string'||!/^\d{2}:\d{2}$/.test(x))return null;
 return Number(x.slice(0,2))*60+Number(x.slice(3));
};
// Minimum evidence is explicitly recorded shotsAgainst and goalsAgainst. Older
// saved rows may omit saves / saveShotsAgainst; do not fabricate those fields.
// If either redundant field IS recorded, it must agree exactly with both counts.
export function nhlGoalieShotAccounting(row){
 const shots=toInt(row?.shotsAgainst),goals=toInt(row?.goalsAgainst);
 if(shots===null||goals===null||goals>shots)return {status:'NOT_READY',reason:'INVALID_REQUIRED_SHOTS_OR_GOALS'};
 const hasSaves=Object.prototype.hasOwnProperty.call(row,'saves'),
  hasFraction=Object.prototype.hasOwnProperty.call(row,'saveShotsAgainst');
 const saves=hasSaves?toInt(row.saves):null;
 if(hasSaves&&(saves===null||saves+goals!==shots))return {status:'NOT_READY',reason:'INCONSISTENT_RECORDED_SAVES'};
 if(hasFraction){
  const m=typeof row.saveShotsAgainst==='string'?/^(\d{1,6})\/(\d{1,6})$/.exec(row.saveShotsAgainst):null;
  if(!m||Number(m[2])!==shots||Number(m[1])+goals!==shots||(hasSaves&&Number(m[1])!==saves))
   return {status:'NOT_READY',reason:'INCONSISTENT_SAVE_SHOTS_FRACTION'};
 }
 return {status:'VALID_PRIOR_SHOT_COUNTS',shots,goals,recordedSaves:saves,
  recordedSavesAvailable:hasSaves,saveShotsFractionVerified:hasFraction};
}
export function nhlGoalieAsOfSide({teamId,fullName,decisionAt,gameEventId,boxscoreRows,minShots=50}){
 const now=at(decisionAt),parts=nameParts(fullName);
 if(now===null||!Number.isSafeInteger(teamId)||teamId<1||parts.length!==2||
  typeof gameEventId!=='string'||!Array.isArray(boxscoreRows)||
  !Number.isSafeInteger(minShots)||minShots<50)
  return blocked('INVALID_SIDE_INPUT');
 const byGame=new Map(),conflicts=new Set();
 for(const r of boxscoreRows){
  const b=r?.boxscore??{},capture=at(r?.capturedAt??r?.boxscore_captured_at),
   tip=at(b.startTimeUTC),eventId=r.eventId??r.event_id;
  if(!/^nhl:202602\d{4}$/.test(String(eventId??''))||eventId===gameEventId||
   capture===null||tip===null||capture>now||capture<=tip||tip>now-60*60000||
   b.gameType!==2||!['FINAL','OFF'].includes(b.gameState))continue;
  if(conflicts.has(eventId))continue;
  if(byGame.has(eventId)){byGame.delete(eventId);conflicts.add(eventId);continue;}
  byGame.set(eventId,{b,capture,tip});
 }
 const matched=[],identityCandidates=new Set(),excludedPriorRows=[];
 for(const [eventId,{b,capture,tip}] of byGame){
  for(const side of ['home','away']){
   const sourceTeam=b?.[side+'Team'];
   if(sourceTeam?.id!==teamId)continue;
   const players=b?.playerByGameStats?.[side+'Team']?.goalies;
   if(!Array.isArray(players))continue;
   for(const p of players){
    const id=toInt(p?.playerId);
    if(id===null||p?.position!=='G'||
     !nhlGoalieSameAbbreviatedIdentity(fullName,p?.name?.default)||secs(p?.toi)===null)continue;
    identityCandidates.add(id);
    const counts=nhlGoalieShotAccounting(p);
    if(counts.status!=='VALID_PRIOR_SHOT_COUNTS'){
     excludedPriorRows.push({eventId,playerId:id,reason:counts.reason});continue;
    }
    matched.push({eventId,playerId:id,shots:counts.shots,ga:counts.goals,tip,capture,toi:secs(p.toi),
     recordedSavesAvailable:counts.recordedSavesAvailable,saveShotsFractionVerified:counts.saveShotsFractionVerified});
   }
  }
 }
 const ids=[...identityCandidates];
 if(ids.length===0)return blocked('NO_UNAMBIGUOUS_PRIOR_TEAM_GOALIE_ID');
 if(ids.length>1)return blocked('MULTIPLE_GOALIE_IDS_FOR_SAME_TEAM_NAME',{candidateIds:ids.length,excludedPriorRows});
 if(!matched.length)return blocked('NO_CONSISTENT_PRIOR_GOALIE_STATISTICS',{excludedPriorRows});
 const goalieId=ids[0],played=matched.filter(x=>x.shots>0&&x.toi>=60)
  .sort((a,b)=>b.tip-a.tip).slice(0,5);
 const shots=played.reduce((sum,x)=>sum+x.shots,0),
  goalsAgainst=played.reduce((sum,x)=>sum+x.ga,0);
 const base={status:shots>=minShots?'PRIOR_FORM_EVIDENCE':'INSUFFICIENT_PRIOR_SHOTS',
  source:'OFFICIAL_NHL_POSTGAME_BOXSCORES_PRIOR_ASOF',
  goalieNhlIdCandidate:goalieId,goalieName:fullName,teamId,
  recentGameCount:played.length,priorShots:shots,priorGoalsAgainst:goalsAgainst,
  priorSavePct:shots?Number((1-goalsAgainst/shots).toFixed(5)):null,
  firstPriorGameAt:played.at(-1)?new Date(played.at(-1).tip).toISOString():null,
  latestPriorGameAt:played[0]?new Date(played[0].tip).toISOString():null,
  latestEvidenceCapturedAt:played.length?new Date(Math.max(...played.map(x=>x.capture))).toISOString():null,
  minPriorShots:minShots,goalieIdentityQualifiedByTeam:true,
  statQuality:{excludedPriorRows,playedRowsWithRecordedSaves:played.filter(x=>x.recordedSavesAvailable).length,
   playedRowsWithVerifiedSaveFraction:played.filter(x=>x.saveShotsFractionVerified).length,
   missingRedundantFieldsNotInvented:true},
  actualStartingGoalieConfirmed:false,nhlCrosswalkCertified:false,
  goalieAdjustmentApplied:false,forecastRecommendationEligible:false,
  warning:'Prior team-qualified NHL goalie ID is a name-matched research candidate, not independently certified goalie identity or pregame confirmed starting goalie.'};
 return base;
}
export function nhlPairedGoalieAsOfEvidence({game,goalieEvidence,decisionAt,boxscoreRows,minShots=50}){
 const t=at(decisionAt),tip=at(game?.scheduledAt),observed=at(goalieEvidence?.observedAt);
 if(t===null||tip===null||observed===null||t<observed||tip-t<60*60000||
  goalieEvidence?.status!=='PREGAME_PROBABLE_SOURCE_ONLY'||
  !goalieEvidence.home?.displayName||!goalieEvidence.away?.displayName||
  goalieEvidence.confirmedHome!==false||goalieEvidence.confirmedAway!==false)
  return blocked('GOALIE_PROBABLE_ASOF_FAILED');
 const home=nhlGoalieAsOfSide({teamId:game.homeId,fullName:goalieEvidence.home.displayName,
  decisionAt,gameEventId:game.eventId,boxscoreRows,minShots});
 const away=nhlGoalieAsOfSide({teamId:game.awayId,fullName:goalieEvidence.away.displayName,
  decisionAt,gameEventId:game.eventId,boxscoreRows,minShots});
 return {status:home.status==='PRIOR_FORM_EVIDENCE'&&away.status==='PRIOR_FORM_EVIDENCE'?
  'BOTH_PRIOR_FORMS_AVAILABLE':'PARTIAL_PRIOR_GOALIE_FORM',
  version:NHL_GOALIE_PRIOR_FORM,observedAt:goalieEvidence.observedAt,decisionAt,
  home,away,confirmedStartingGoalies:0,modelGoalieAdjustmentApplied:false,
  independentlyVerifiedCrosswalk:false,officialPick:false};
}
