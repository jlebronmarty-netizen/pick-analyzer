// NBA Decision Engine V2 - offline, pure and SHADOW-only.
// This module never infers probability from a projection or L5/L10 hit rate.
// Candidate probabilities must be frozen before tipoff and have an independent ledger.
export const NBA_DECISION_V2_VERSION = 'NBA_DECISION_PROBABILITY_RESEARCH_V2';
const valid = n => typeof n === 'number' && Number.isFinite(n);
const time = s => typeof s === 'string' ? Date.parse(s) : NaN;
const round = n => Math.round(n * 1000000) / 1000000;
const groups = rows => [...new Set(rows.map(r => String(r.gameId)))].length;
export function impliedProbability(americanOdds) {
  if (!Number.isInteger(americanOdds) || (americanOdds > -100 && americanOdds < 100)) return null;
  return americanOdds < 0 ? -americanOdds / (-americanOdds + 100) : 100 / (americanOdds + 100);
}
export function expectedValue(probability, americanOdds) {
  const implied = impliedProbability(americanOdds);
  if (!valid(probability) || probability < 0 || probability > 1 || implied === null) return null;
  const profit = americanOdds < 0 ? 100 / -americanOdds : americanOdds / 100;
  return round(probability * profit - (1 - probability));
}
function eligible(r) {
  // Explicitly exclude pushes, ambiguous identities, unfrozen or post-game inputs.
  return r && Number.isSafeInteger(r.gameId) && typeof r.market === 'string' &&
    typeof r.period === 'string' && typeof r.modelVersion === 'string' &&
    typeof r.forecastId === 'string' && r.forecastId.length > 0 &&
    valid(r.probability) && r.probability > 0 && r.probability < 1 &&
    ['win', 'loss'].includes(r.result) &&
    Number.isFinite(time(r.decisionAt)) && Number.isFinite(time(r.gameStartAt)) &&
    Number.isFinite(time(r.outcomeAt)) && time(r.decisionAt) < time(r.gameStartAt) &&
    time(r.outcomeAt) > time(r.gameStartAt) && r.qualityStatus === 'VALIDATED' &&
    r.probabilityOrigin === 'FROZEN_PROSPECTIVE_MODEL' && r.contractVerified === true;
}
function score(rows) {
  // Average each game's loss first. This avoids treating multiple correlated props as separate games.
  const byGame = new Map();
  for (const r of rows) {
    const id = String(r.gameId), observed = r.result === 'win' ? 1 : 0;
    const loss = (r.probability - observed) ** 2;
    if (!byGame.has(id)) byGame.set(id, []);
    byGame.get(id).push(loss);
  }
  const losses = [...byGame.values()].map(xs => xs.reduce((a,b) => a+b, 0)/xs.length);
  return losses.length ? round(losses.reduce((a,b)=>a+b,0)/losses.length) : null;
}
export function evaluateProbabilityCohort(rows, {trainBefore, holdoutFrom, minimumTrainGames=100, minimumHoldoutGames=100}={}) {
  if (!Array.isArray(rows) || !Number.isFinite(time(trainBefore)) || !Number.isFinite(time(holdoutFrom)) ||
      time(trainBefore) >= time(holdoutFrom) || !Number.isSafeInteger(minimumTrainGames) ||
      !Number.isSafeInteger(minimumHoldoutGames) || minimumTrainGames < 100 || minimumHoldoutGames < 100)
    throw new Error('INVALID_PROSPECTIVE_EVALUATION_PLAN');
  const accepted = rows.filter(eligible);
  const invalid = rows.length - accepted.length;
  const cohorts = new Map();
  for (const row of accepted) {
    const key=[row.modelVersion,row.market,row.period].join('|');
    if (!cohorts.has(key)) cohorts.set(key,[]);
    cohorts.get(key).push(row);
  }
  const output=[];
  for (const [key, records] of cohorts) {
    const [modelVersion,market,period]=key.split('|');
    // A game's temporal cohort is determined by its start, never settlement or ingestion time.
    const train=records.filter(r=>time(r.gameStartAt)<time(trainBefore));
    const holdout=records.filter(r=>time(r.gameStartAt)>=time(holdoutFrom));
    const trainGames=groups(train),holdoutGames=groups(holdout);
    output.push({modelVersion,market,period,trainGames,holdoutGames,
      trainContracts:train.length,holdoutContracts:holdout.length,
      trainBrier:score(train),holdoutBrier:score(holdout),
      excludedGapContracts:records.length-train.length-holdout.length,
      validationStatus:trainGames>=minimumTrainGames && holdoutGames>=minimumHoldoutGames ?
        'REQUIRES_CALIBRATION_AND_INDEPENDENT_REVIEW':'INSUFFICIENT_INDEPENDENT_GAMES',
      approvedForBetting:false,automaticPromotion:false});
  }
  return {version:NBA_DECISION_V2_VERSION,sourcePolicy:'FROZEN_AND_SETTLED_ONLY',
    acceptedContracts:accepted.length,rejectedContracts:invalid,models:output,
    approvedForBetting:false,officialModelWrites:0,providerCalls:0};
}
export function researchDecision(candidate, validation) {
  // This is intentionally a fail-closed gate. Validation reviews are not an automatic promotion.
  const basis={classification:'VIGILAR',researchOnly:true,modelProbability:null,expectedValue:null};
  if (!candidate || candidate.dataQuality !== 'VALIDATED') return {...basis,classification:'PASAR',reason:'DATA_QUALITY_UNVERIFIED'};
  if (!valid(candidate.probability) || candidate.probability<=0 || candidate.probability>=1 ||
      candidate.probabilityOrigin!=='FROZEN_PROSPECTIVE_MODEL')
    return {...basis,reason:'CALIBRATED_PROBABILITY_UNAVAILABLE'};
  const ev=expectedValue(candidate.probability,candidate.americanOdds);
  if(ev===null)return {...basis,reason:'PRICE_UNVERIFIED'};
  const enough=validation?.validationStatus==='VALIDATED_INDEPENDENT_HOLDOUT' &&
    validation?.humanReviewed===true && validation?.calibrationPassed===true &&
    validation?.contractVerified===true && validation?.regionalExecutionVerified===true;
  // Until explicit independent evidence and review exists, NEVER output JUGADA.
  return {...basis,reason:enough?'RESEARCH_READY_FOR_SEPARATE_RELEASE_REVIEW':'PROBABILITY_NOT_VALIDATED',
    modelProbability:candidate.probability,expectedValue:ev};
}
