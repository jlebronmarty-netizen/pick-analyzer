// NHL V6 paired, strictly prospective evaluation on frozen as-of decisions.
// A lower Brier or log-loss is not proof of bookmaker edge or promotion.
export const NHL_V6_PROSPECTIVE_MIN_GAMES=30;
const t=v=>{const n=Date.parse(String(v??''));return Number.isFinite(n)?n:null;};
const prob=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<1;
const r=(x,d=5)=>Number(x.toFixed(d));
const logLoss=(p,y)=>-(y*Math.log(p)+(1-y)*Math.log(1-p));
const brier=(p,y)=>(p-y)**2;
const marketNames=['dratings','circaNoVig','poisson','calibrated'];
const empty=()=>({n:0,hits:0,brierSum:0,logLossSum:0,probSum:0,winSum:0});
const metrics=(s)=>({
 games:s.n,
 accuracy:s.n?r(s.hits/s.n):null,
 hits:s.hits,
 brier:s.n?r(s.brierSum/s.n):null,
 logLoss:s.n?r(s.logLossSum/s.n):null,
 meanProbability:s.n?r(s.probSum/s.n):null,
 observedHomeWinRate:s.n?r(s.winSum/s.n):null
});
const validFrozen=(row)=>{
 const frozen=t(row?.frozen_at),scheduled=t(row?.scheduled_at),source=t(row?.source_completed_at);
 const goalie=row?.goalie_evidence,cal=row?.calibration,market=cal?.circaPrice;
 if(!/^nhl:202602\d{4}$/.test(String(row?.event_id??''))||
   row?.model_version!=='NHL_LATE_PROBABLE_CALIBRATION_SHADOW_V6'||
   row?.official_pick!==false||row?.production_eligible!==false||
   !Number.isSafeInteger(Number(row.home_team_id))||
   !Number.isSafeInteger(Number(row.away_team_id))||
   Number(row.home_team_id)===Number(row.away_team_id)||
   frozen===null||scheduled===null||source===null||
   frozen>scheduled-3600000||source>frozen||frozen-source>45*60000||
   goalie?.status!=='PREGAME_PROBABLE_SOURCE_ONLY'||
   !goalie?.home||!goalie?.away||goalie?.isConfirmedStarter!==false||
   goalie?.goalieAdjustmentApplied!==false||
   goalie?.sourceSnapshotId!==row.goalie_snapshot_id||
   t(goalie?.observedAt)===null||
   t(goalie.observedAt)>frozen||frozen-t(goalie.observedAt)>45*60000)
  return {ok:false,why:'INVALID_FROZEN_ASOF_CONTRACT'};
 if(!cal||cal.holdoutPassed!==false||cal.officialPromotion!==false||
   cal.expectedValue!==null)return {ok:false,why:'INVALID_CALIBRATION_STATUS'};
 if(market){
  const quoteAt=t(market.capturedAt);
  if(market.eventId!==row.event_id||market.status!=='CIRCA_PREGAME_RESEARCH_ONLY'||
   quoteAt===null||quoteAt>frozen||quoteAt>scheduled-3600000||
   frozen-quoteAt>40*60000||market.marketRuleVerified!==false||
   !prob(market.homeNoVig))
   return {ok:false,why:'INVALID_CIRCA_ASOF_SOURCE'};
 }
 if(cal.status==='PROSPECTIVE_TEST_ONLY'){
  const b=cal.rolling;
  if(!market||!b||b.status!=='FROZEN_CANDIDATE_ELIGIBLE'||
   b.priorGames<20||!prob(cal.candidateHome)||!prob(cal.candidateAway)||
   Math.abs(cal.candidateHome+cal.candidateAway-1)>0.00002)
   return {ok:false,why:'CANDIDATE_WITHOUT_VALID_ASOF_PRIOR'};
 }else if(cal.status!=='NOT_YET_ELIGIBLE'||
   cal.candidateHome!==null||cal.candidateAway!==null)
   return {ok:false,why:'INVALID_CANDIDATE_GATE'};
 return {ok:true};
};
export function evaluateNhlV6Paired({frozenRows,finalRows}){
 if(!Array.isArray(frozenRows)||!Array.isArray(finalRows))
  return {status:'UNAVAILABLE',reason:'MISSING_ARCHIVES'};
 const outcomes=new Map(),conflicted=new Set();
 for(const item of finalRows){
  if(!item?.event_id||conflicted.has(item.event_id))continue;
  const prev=outcomes.get(item.event_id);
  if(prev){outcomes.delete(item.event_id);conflicted.add(item.event_id);}
  else outcomes.set(item.event_id,item);
 }
 const all=Object.fromEntries(marketNames.map(name=>[name,empty()]));
 const paired=Object.fromEntries(marketNames.map(name=>[name,empty()]));
 let invalid=0,pending=0,settled=0,pairedGames=0,asOfGoalieCoverage=0,
  candidatesFrozen=0,uncalibrated=0;
 const errors={},byDate=new Map();
 for(const row of frozenRows){
  const check=validFrozen(row);
  if(!check.ok){invalid++;errors[check.why]=(errors[check.why]??0)+1;continue;}
  if(row.goalie_evidence?.home&&row.goalie_evidence?.away)asOfGoalieCoverage++;
  if(row.calibration.status==='PROSPECTIVE_TEST_ONLY')candidatesFrozen++;
  else uncalibrated++;
  if(conflicted.has(row.event_id)){invalid++;errors.OUTCOME_DUPLICATE_CONFLICT=(errors.OUTCOME_DUPLICATE_CONFLICT??0)+1;continue;}
  const outcome=outcomes.get(row.event_id);
  if(!outcome){pending++;continue;}
  const b=outcome.body??{},start=t(row.scheduled_at),outcomeAt=t(outcome.observed_at);
  if(t(b.scheduledAt)!==start||Number(b.homeId)!==Number(row.home_team_id)||
   Number(b.awayId)!==Number(row.away_team_id)||
   !Number.isSafeInteger(b.homeScore)||!Number.isSafeInteger(b.awayScore)||
   b.homeScore===b.awayScore||outcomeAt===null||outcomeAt<=start){
   invalid++;errors.FINAL_IDENTITY_OR_TIME=(errors.FINAL_IDENTITY_OR_TIME??0)+1;continue;
  }
  settled++;const y=b.homeScore>b.awayScore?1:0;
  const v={dratings:row.calibration.originalDratingsHome,
   circaNoVig:row.calibration.circaPrice?.homeNoVig,
   poisson:row.market_proxies?.homeMoneylineProxy,
   calibrated:row.calibration.candidateHome};
  for(const name of marketNames){
   const p=v[name];if(!prob(p))continue;
   const s=all[name];s.n++;s.hits+=Number((p>=.5)===Boolean(y));
   s.brierSum+=brier(p,y);s.logLossSum+=logLoss(p,y);
   s.probSum+=p;s.winSum+=y;
  }
  if(!marketNames.every(k=>prob(v[k])))continue;
  pairedGames++;const date=new Date(start).toISOString().slice(0,10);
  const bucket=byDate.get(date)??{date,games:0,candidateBrierSum:0,circaBrierSum:0};
  bucket.games++;bucket.candidateBrierSum+=brier(v.calibrated,y);
  bucket.circaBrierSum+=brier(v.circaNoVig,y);
  byDate.set(date,bucket);
  for(const name of marketNames){
   const p=v[name],s=paired[name];s.n++;s.hits+=Number((p>=.5)===Boolean(y));
   s.brierSum+=brier(p,y);s.logLossSum+=logLoss(p,y);
   s.probSum+=p;s.winSum+=y;
  }
 }
 const overall=Object.fromEntries(marketNames.map(k=>[k,metrics(all[k])]));
 const sameGame=Object.fromEntries(marketNames.map(k=>[k,metrics(paired[k])]));
 const deltas=pairedGames?Object.fromEntries(
  ['circaNoVig','dratings','poisson'].map(name=>[name,
   {candidateMinusBaselineBrier:r(sameGame.calibrated.brier-sameGame[name].brier),
    candidateMinusBaselineLogLoss:r(sameGame.calibrated.logLoss-sameGame[name].logLoss)}])
 ):null;
 return {
  status:invalid?'REVIEW_INVALID_EVIDENCE':pairedGames<NHL_V6_PROSPECTIVE_MIN_GAMES?
   'PROSPECTIVE_SAMPLE_PENDING':'RESEARCH_REVIEW_REQUIRED',
  rows:frozenRows.length,settled,pending,invalid,asOfGoalieCoverage,
  candidatesFrozen,uncalibrated,uniquePairedGames:pairedGames,
  minimumInitialHoldout:NHL_V6_PROSPECTIVE_MIN_GAMES,
  morePairedGamesNeeded:Math.max(0,NHL_V6_PROSPECTIVE_MIN_GAMES-pairedGames),
  independentHoldoutPassed:false,modelPromotionAllowed:false,
  allAvailableMetrics:overall,
  exactSameGamePairedMetrics:sameGame,
  pairedCandidateMinusBaseline:deltas,
  weeklyDayCoverage:byDate.size,
  perDayDescriptive:[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date))
   .map(x=>({date:x.date,games:x.games,
    candidateBrier:r(x.candidateBrierSum/x.games),
    circaBrier:r(x.circaBrierSum/x.games)})),
  invalidReasons:errors,
  warning:'V6 strictly prospective. Only same-event 4-way pairs support model comparisons. Minimum 30 is an initial screen, not statistical proof, confirmed goalies, real-book ROI, or model promotion.'
 };
}
