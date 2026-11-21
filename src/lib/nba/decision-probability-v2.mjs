// NBA Decision Engine V2 - offline, pure and SHADOW-only.
// This module never infers probability from a projection or L5/L10 hit rate.
// Candidate probabilities must be frozen before tipoff and have an independent ledger.
export const NBA_DECISION_V2_VERSION = 'NBA_DECISION_PROBABILITY_RESEARCH_V2';
const valid = n => typeof n === 'number' && Number.isFinite(n);
const time = s => typeof s === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(s) ? Date.parse(s) : NaN;
const round = n => Math.round(n * 1000000) / 1000000;
const canonical = value => Array.isArray(value)?value.map(canonical):value && typeof value==='object'?
  Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const groups = rows => [...new Set(rows.map(r => String(r.gameId)))].length;
export function impliedProbability(americanOdds) {
  if (!Number.isInteger(americanOdds) || (americanOdds > -100 && americanOdds < 100)) return null;
  return americanOdds < 0 ? -americanOdds / (-americanOdds + 100) : 100 / (americanOdds + 100);
}
export function expectedValue(probability, americanOdds, pushProbability=0) {
  const implied = impliedProbability(americanOdds);
  if (!valid(probability) || probability < 0 || probability > 1 || implied === null ||
      !valid(pushProbability) || pushProbability < 0 || pushProbability > 1) return null;
  const profit = americanOdds < 0 ? 100 / -americanOdds : americanOdds / 100;
  return round((1-pushProbability) * (probability * profit - (1-probability)));
}
function eligible(r) {
  // Explicitly exclude pushes, ambiguous identities, unfrozen or post-game inputs.
  return r && Number.isSafeInteger(r.gameId) && r.gameId>0 && typeof r.market === 'string' && typeof r.period === 'string' && typeof r.modelVersion === 'string' &&
    typeof r.forecastId === 'string' && r.forecastId.length > 0 &&
    valid(r.probability) && r.probability > 0 && r.probability < 1 &&
    ['win', 'loss'].includes(r.result) &&
    (r.market !== 'props' || Boolean(r.statistic?.trim())) &&
    ['trainedThrough','featuresAsOf','quoteAt','frozenAt'].every(k => r[k]===undefined || time(r[k])<=time(r.decisionAt)) &&
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
  const byId=new Map(), conflicts=new Set(), starts=new Map(), disputedGames=new Set();
  for (const row of rows.filter(Boolean)) {
    const id=row.forecastId, start=time(row.gameStartAt);
    if (starts.has(row.gameId) && starts.get(row.gameId)!==start) disputedGames.add(row.gameId);
    starts.set(row.gameId,start);
    const prior=byId.get(id);
    if (prior && JSON.stringify(canonical(prior))!==JSON.stringify(canonical(row))) conflicts.add(id);
    else byId.set(id,row);
  }
  const accepted = [...byId.values()].filter(r=>eligible(r) && !conflicts.has(r.forecastId) && !disputedGames.has(r.gameId));
  const invalid = rows.length - accepted.length;
  const cohorts = new Map();
  for (const row of accepted) {
    const key=JSON.stringify([row.modelVersion,row.market,row.period,row.statistic??null,row.modelHash??null]);
    if (!cohorts.has(key)) cohorts.set(key,[]);
    cohorts.get(key).push(row);
  }
  const output=[];
  for (const [key, records] of cohorts) {
    const [modelVersion,market,period,statistic,modelHash]=JSON.parse(key);
    // A game's temporal cohort is determined by its start, never settlement or ingestion time.
    const train=records.filter(r=>time(r.outcomeAt)<time(trainBefore));
    const holdout=records.filter(r=>time(r.decisionAt)>=time(holdoutFrom));
    const trainGames=groups(train),holdoutGames=groups(holdout);
    output.push({modelVersion,market,period,statistic,modelHash,trainGames,holdoutGames,
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
export function researchDecision(candidate, validation, asOf) {
  const basis={classification:'VIGILAR',researchOnly:true,modelProbability:null,expectedValue:null};
  if (!candidate) return {...basis,classification:'SIN DATOS',reason:'CANDIDATE_UNAVAILABLE'};
  if (candidate.dataQuality!=='VALIDATED') {
    const classification=['SOURCE_UNAVAILABLE','INSUFFICIENT_SAMPLE'].includes(candidate.dataQuality)?'SIN DATOS':'PASAR';
    return {...basis,classification,reason:candidate.dataQuality??'DATA_QUALITY_UNVERIFIED'};
  }
  const p=candidate.probability;
  if (!valid(p)||p<=0||p>=1||candidate.probabilityOrigin!=='FROZEN_PROSPECTIVE_MODEL'){
    if(!valid(candidate.projection))return {...basis,classification:'SIN DATOS',reason:'PROJECTION_AND_PROBABILITY_UNAVAILABLE'};
    if(valid(candidate.advantage) && candidate.advantage<=0)
      return {...basis,classification:'PASAR',reason:'NO_DESCRIPTIVE_EDGE'};
    return {...basis,reason:'CALIBRATED_PROBABILITY_UNAVAILABLE'};
  }
  if (Number.isInteger(candidate.line) && candidate.market!=='moneyline' && !valid(candidate.pushProbability))
    return {...basis,reason:'PUSH_MODEL_UNAVAILABLE'};
  const ev=expectedValue(p,candidate.americanOdds,candidate.pushProbability??0);
  if (ev===null) return {...basis,reason:'PRICE_UNVERIFIED'};
  const evaluated={...basis,modelProbability:p,expectedValue:ev};
  if (ev<=0) return {...evaluated,classification:'PASAR',reason:'NONPOSITIVE_EV'};
  const now=time(asOf);
  const marketValid=['moneyline','spread','total','props'].includes(candidate.market) &&
    (candidate.market==='moneyline'?candidate.line===null:Number.isFinite(candidate.line));
  const qualified=Boolean(marketValid && candidate.forecastId && candidate.quoteId && candidate.book && candidate.modelVersion && candidate.scope &&
    candidate.contextVerified===true && candidate.contractVerified===true && candidate.regionalExecutionVerified===true &&
    time(candidate.quoteAt)<=time(candidate.frozenAt) && time(candidate.frozenAt)<=now &&
    now<Math.min(time(candidate.expiresAt),time(candidate.gameStartAt)) &&
    validation?.validationStatus==='VALIDATED_INDEPENDENT_HOLDOUT' &&
    validation.modelVersion===candidate.modelVersion && typeof candidate.modelHash==='string' &&
    /^[0-9a-f]{64}$/.test(candidate.modelHash) && validation.modelHash===candidate.modelHash && validation.scope===candidate.scope &&
    validation.trainGames>=100 && validation.holdoutGames>=100 && validation.separateProspective===true &&
    validation.humanReviewed===true && validation.calibrationPassed===true &&
    valid(candidate.evLower95) && candidate.evLower95>0 && candidate.evLower95<=ev);
  return {...evaluated,reason:qualified?'RESEARCH_READY_FOR_SEPARATE_RELEASE_REVIEW':'PROBABILITY_NOT_VALIDATED'};
}

export function challengeStage(candidates, asOf, {allowExceptional=false}={}) {
  const pool=[];
  for (const {candidate,validation} of candidates) {
    if (!candidate?.forecastId) continue;
    const odds=candidate.americanOdds;
    const decision=researchDecision(candidate,validation,asOf);
    if (odds<=-110 && odds>=(allowExceptional?-300:-200) &&
        decision.reason==='RESEARCH_READY_FOR_SEPARATE_RELEASE_REVIEW') {
      pool.push({forecastId:candidate.forecastId,odds,probability:decision.modelProbability,ev:decision.expectedValue});
    }
  }
  const preferred=pool.filter(r=>r.odds>=-200);
  const ranked=preferred.length?preferred:pool;
  const first=(a,b)=>String(a.forecastId).localeCompare(String(b.forecastId));
  return {initialCapital:100,objective:1000,maximumPicksPerStage:1,
    highestProbability:ranked.toSorted((a,b)=>b.probability-a.probability||b.ev-a.ev||first(a,b))[0]??null,
    highestEv:ranked.toSorted((a,b)=>b.ev-a.ev||b.probability-a.probability||first(a,b))[0]??null,
    selection:null,classification:'SIN APUESTA',automaticPromotion:false};
}
