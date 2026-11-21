// NCAAB immutable forward-only calibration scorer.
// All candidates must be frozen pregame; no earlier official pick is changed.
import {ncaabEvidenceTime as ms,ncaabTeamId,ncaabHash,ncaabCanonicalDigest,ncaabLegacyDigest,
 ncaabUniqueEventIndex} from './ncaab-calibration-evidence.mjs';
import {ncaabPairedUncertainty} from './ncaab-paired-uncertainty.mjs';
export const NCAAB_SHADOW_MIN_EVAL=100;
export const NCAAB_SHADOW_INITIAL_REVIEW=30;
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'});
const prob=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<1;
const num=x=>typeof x==='number'&&Number.isFinite(x);
const round=(x,n=5)=>Number(x.toFixed(n));
const empty=()=>({n:0,wins:0,brier:0,logLoss:0,mae:0,bias:0});
const metrics=(o,kind)=>({n:o.n,hits:kind==='probability'?o.wins:null,
 accuracy:o.n&&kind==='probability'?round(o.wins/o.n):null,
 brier:o.n&&kind==='probability'?round(o.brier/o.n):null,
 logLoss:o.n&&kind==='probability'?round(o.logLoss/o.n):null,
 mae:o.n&&kind==='score'?round(o.mae/o.n,3):null,bias:o.n&&kind==='score'?round(o.bias/o.n,3):null});
export function evaluateNcaabFrozenCalibration({frozenRows,finalRows,originalRows,asOf=new Date().toISOString()}){
 if(!Array.isArray(frozenRows)||!Array.isArray(finalRows))
  return {status:'UNAVAILABLE',reason:'MISSING_DATA'};
 const cutoff=ms(asOf);
 if(cutoff===null)return {status:'UNAVAILABLE',reason:'INVALID_ASOF_CUTOFF'};
 if(frozenRows.length>2000||finalRows.length>4000||(originalRows?.length??0)>4000)
  return {status:'UNAVAILABLE',reason:'EVALUATION_SCAN_CAPPED'};
 const considered=frozenRows.filter(row=>![row?.frozen_at,row?.created_at]
  .some(value=>ms(value)!==null&&ms(value)>cutoff));
 const {duplicates:duplicateShadows}=ncaabUniqueEventIndex(considered);
 const knownFinals=finalRows.filter(row=>ms(row?.observed_at)===null||ms(row.observed_at)<=cutoff);
 const {unique:finalMap,duplicates:conflicts}=ncaabUniqueEventIndex(knownFinals);
 const originals=Array.isArray(originalRows)?ncaabUniqueEventIndex(originalRows):null;
 const scores={baseline:empty(),unrestricted:empty(),sidePreserving:empty(),
  baselineMargin:empty(),correctedMargin:empty(),totalUnchanged:empty()};
 let pending=0,invalid=0,graded=0,shadows=0,missingOutcome=0,fullEvidence=0,legacyEvidence=0;
 const invalidReasons={};
 const reason=why=>{invalid++;invalidReasons[why]=(invalidReasons[why]??0)+1;};
 const byDay=new Map(),pairs=[],teams=new Set();
 for(const row of considered){
  const start=ms(row?.scheduled_at),original=ms(row?.original_created_at),
   freeze=ms(row?.frozen_at),base=row?.baseline,candidate=row?.candidate,
   evidence=row?.history_evidence,stored=ms(row?.created_at);
  if(duplicateShadows.has(row?.event_id)){reason('DUPLICATE_SHADOW_EVENT');continue;}
  if(row?.model_version!=='NCAAB_SIDE_PRESERVING_SHADOW_V1'||
   row?.official_pick!==false||row?.production_eligible!==false||
   !/^espn:\d{6,15}$/.test(String(row?.event_id??''))||
   row?.id!==row?.model_version+':'+row?.event_id||
   row?.original_prediction_id!=='NCAAB_PRESEASON_V1:'+row?.event_id||
   !ncaabTeamId(row?.home_id)||!ncaabTeamId(row?.away_id)||row.home_id===row.away_id||
   !ncaabHash(row?.source_hash)||!ncaabHash(row?.profile_sha256)||
   original===null||freeze===null||start===null||stored===null||
   original>freeze||freeze-original>10*60000||start-freeze<60*60000||
   stored<original||stored<freeze-10000||stored>freeze+5*60000||stored>=start||
   row?.status!=='FROZEN_RESEARCH'||!prob(base?.home_win_probability)||
   !prob(base?.away_win_probability)||Math.abs(base.home_win_probability+base.away_win_probability-1)>1e-5||
   base.home_win_probability===.5||base.predicted_winner!==(base.home_win_probability>.5?row.home_id:row.away_id)||
   !prob(candidate?.probability_home_unrestricted)||
   !prob(candidate?.probability_home_preserve_original_side)||
   !prob(candidate?.probability_away_preserve_original_side)||
   Math.abs(candidate.probability_home_preserve_original_side+candidate.probability_away_preserve_original_side-1)>1e-5||
   !num(base?.projected_margin)||!num(base?.projected_total)||
   base.projected_total<0||Math.sign(base.projected_margin)!==Math.sign(base.home_win_probability-.5)||
   !num(candidate?.projected_margin_adjusted)||
   candidate?.projected_total_unchanged!==base?.projected_total||
   candidate?.predicted_winner_unchanged!==base?.predicted_winner||
   candidate?.model_promotion_allowed!==false||
   candidate?.bookmaker_value_estimated!==null||
   candidate?.frozen_formula!=='ROLLING_RESIDUAL_SHRINK_100_SIDE_PRESERVING_V1'||
   !Number.isSafeInteger(evidence?.priorGames)||evidence.priorGames<100||
   evidence?.shrinkPrior!==100||!ncaabHash(evidence?.historicalSourceDigest)||
   evidence?.totalAdjustmentApplied!==false||
   Math.abs(candidate.probability_home_preserve_original_side-.5)<1e-8||
   (base.home_win_probability>=.5)!==(candidate.probability_home_preserve_original_side>=.5)){
   reason('INVALID_FROZEN_PREMATCH_CONTRACT');continue;
  }
  if(evidence.evidenceSchemaVersion!==undefined){
   if(evidence.evidenceSchemaVersion!==2||ms(evidence.trainingCutoffAt)!==original||
    ms(evidence.latestResultObservedAt)===null||ms(evidence.latestResultObservedAt)>=original||
    !ncaabHash(evidence.historicalFullInputDigest)||!ncaabHash(evidence.originalForecastDigest)||
    evidence.candidatePayloadDigest!==ncaabCanonicalDigest(candidate)||
    !ncaabHash(evidence.fullSourceHash)||evidence.evaluationType!=='PROSPECTIVE_SEQUENTIAL'||
    evidence.separateHoldoutVerified!==false||
    evidence.fullSourceHash!==ncaabCanonicalDigest([evidence.historicalFullInputDigest,
     evidence.originalForecastDigest,row.original_prediction_id,original,freeze,100,evidence.candidatePayloadDigest])){
    reason('INVALID_COMPLETE_TRAINING_EVIDENCE');continue;
   }
  }
  if(originals){
   const p=originals.unique.get(row.event_id),b=p?.body;
   if(originals.duplicates.has(row.event_id)||!p||p.id!==row.original_prediction_id||
    ms(p.created_at)!==original||ms(p.scheduled_at)!==start||
    ms(b?.created_at)!==original||ms(b?.scheduled_at)!==start||
    b?.event_id!==row.event_id||b?.model!=='NCAAB_PRESEASON_V1'||b?.state!=='FORECAST'||
    b?.home_id!==row.home_id||b?.away_id!==row.away_id||b?.profile_sha256!==row.profile_sha256||
    b?.predicted_winner!==base.predicted_winner||b?.home_win_probability!==base.home_win_probability||
    b?.away_win_probability!==base.away_win_probability||b?.projected_margin!==base.projected_margin||
    b?.projected_total!==base.projected_total||
    row.source_hash!==ncaabLegacyDigest([evidence.historicalSourceDigest,row.profile_sha256,
     p.id,p.created_at,freeze])||
    (evidence.evidenceSchemaVersion===2&&ncaabCanonicalDigest(b)!==evidence.originalForecastDigest)){
    reason('ORIGINAL_FORECAST_MISMATCH_OR_UNAVAILABLE');continue;
   }
  }
  if(evidence.evidenceSchemaVersion===2)fullEvidence++;else legacyEvidence++;
  shadows++;
  if(conflicts.has(row.event_id)){reason('CONTRADICTORY_FINALS');continue;}
  const final=finalMap.get(row.event_id);
  if(!final){missingOutcome++;pending++;continue;}
  const f=final.body??{},observed=ms(final.observed_at),tip=ms(f.scheduled_at);
  if(f.event_id!==row.event_id||f.status!=='FINAL'||tip!==start||
   observed===null||observed<=start||ms(f.captured_at)!==observed||
   f.home_id!==row.home_id||f.away_id!==row.away_id||
   !Number.isSafeInteger(f.home_score)||!Number.isSafeInteger(f.away_score)||
   Math.min(f.home_score,f.away_score)<0||
   f.home_score===f.away_score){
   reason('FINAL_IDENTITY_OR_TIME');continue;
  }
  graded++;const homeWon=f.home_score>f.away_score?1:0,
   actualMargin=f.home_score-f.away_score,actualTotal=f.home_score+f.away_score;
  for(const [name,p] of [
   ['baseline',base.home_win_probability],
   ['unrestricted',candidate.probability_home_unrestricted],
   ['sidePreserving',candidate.probability_home_preserve_original_side]
  ]){
   const s=scores[name];s.n++;s.wins+=Number((p>=.5)===Boolean(homeWon));
   s.brier+=(p-homeWon)**2;
   s.logLoss+=-(homeWon*Math.log(p)+(1-homeWon)*Math.log(1-p));
  }
  for(const [name,p,actual] of [
   ['baselineMargin',base.projected_margin,actualMargin],
   ['correctedMargin',candidate.projected_margin_adjusted,actualMargin],
   ['totalUnchanged',candidate.projected_total_unchanged,actualTotal]
  ]){
   const s=scores[name];s.n++;s.mae+=Math.abs(p-actual);s.bias+=p-actual;
  }
  const d=dayFormat.format(new Date(start));
  teams.add(row.home_id);teams.add(row.away_id);
  pairs.push({eventId:row.event_id,date:d,
   brier:(candidate.probability_home_preserve_original_side-homeWon)**2-(base.home_win_probability-homeWon)**2,
   logLoss:-(homeWon*Math.log(candidate.probability_home_preserve_original_side)+(1-homeWon)*Math.log(1-candidate.probability_home_preserve_original_side))+
    (homeWon*Math.log(base.home_win_probability)+(1-homeWon)*Math.log(1-base.home_win_probability)),
   marginMae:Math.abs(candidate.projected_margin_adjusted-actualMargin)-Math.abs(base.projected_margin-actualMargin)});
  const prior=byDay.get(d)??{date:d,games:0,baseBrier:0,preserveBrier:0};
  prior.games++;prior.baseBrier+=(base.home_win_probability-homeWon)**2;
  prior.preserveBrier+=(candidate.probability_home_preserve_original_side-homeWon)**2;
  byDay.set(d,prior);
 }
 const measurements=Object.fromEntries(Object.entries(scores).map(([k,v])=>[k,
  metrics(v,['baseline','unrestricted','sidePreserving'].includes(k)?'probability':'score')]));
 return {status:invalid?'REVIEW_INVALID_EVIDENCE':graded<NCAAB_SHADOW_MIN_EVAL?
  'PROSPECTIVE_SAMPLE_PENDING':'SEPARATE_HOLDOUT_PENDING',
  asOf:new Date(cutoff).toISOString(),timezone:'America/Puerto_Rico',
  frozen:considered.length,frozenAfterCutoffExcluded:frozenRows.length-considered.length,
  uniqueFrozenGames:new Set(considered.filter(x=>/^espn:\d{6,15}$/.test(String(x?.event_id??''))).map(x=>x.event_id)).size,
  validFrozen:shadows,settled:graded,uniquePairedGames:graded,localDays:byDay.size,uniqueTeams:teams.size,pending,invalid,
  missingOutcome,invalidReasons,
  outcomesAfterCutoffExcluded:finalRows.length-knownFinals.length,
  evaluationType:'PROSPECTIVE_SEQUENTIAL',
  initialReviewGames:NCAAB_SHADOW_INITIAL_REVIEW,
  minimumIndependentGames:NCAAB_SHADOW_MIN_EVAL,
  // Compatibility field: this threshold does not certify a separate holdout.
  minimumInitialHoldout:NCAAB_SHADOW_MIN_EVAL,
  remainingBeforeInitialReview:Math.max(0,NCAAB_SHADOW_INITIAL_REVIEW-graded),
  remainingBeforeIndependentReview:Math.max(0,NCAAB_SHADOW_MIN_EVAL-graded),
  sampleThresholdMet:graded>=NCAAB_SHADOW_MIN_EVAL,
  separateHoldoutVerified:false,
  validationBlockers:[...(graded<NCAAB_SHADOW_MIN_EVAL?['FEWER_THAN_100_UNIQUE_GAMES']:[]),
   'SEPARATE_PROSPECTIVE_HOLDOUT_NOT_VERIFIED',...(invalid?['INVALID_EVIDENCE_PRESENT']:[]),
   ...(!originals?['ORIGINAL_FORECASTS_NOT_CROSS_CHECKED']:[])],
  originalForecastsCrossChecked:Boolean(originals),
  trainingEvidence:{completeInputDigestRows:fullEvidence,legacyDigestOnlyRows:legacyEvidence,
   fullTrainingReplayPerformed:false},
  contextCoverage:{venue:'NOT_FROZEN_IN_THIS_LEDGER',homeLabelConfirmsPhysicalVenue:false,
   injuriesAndLineupsUsedByOriginalModel:false},
  metrics:measurements,
  candidateMinusOriginal:{
   brier:graded?round((scores.sidePreserving.brier-scores.baseline.brier)/graded):null,
   logLoss:graded?round((scores.sidePreserving.logLoss-scores.baseline.logLoss)/graded):null,
   marginMae:graded?round((scores.correctedMargin.mae-scores.baselineMargin.mae)/graded,3):null},
  pairedUncertainty:ncaabPairedUncertainty(pairs),
  days:[...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date))
   .map(x=>({date:x.date,games:x.games,
    modelBrier:round(x.baseBrier/x.games),sidePreservingBrier:round(x.preserveBrier/x.games)})),
  independentValidationPassed:false,modelPromotionAllowed:false,
  sportsbookOddsCertified:false,officialPicksChanged:false,
  warning:'Prospective sequential research: earlier outcomes may train later predictions, so this is not an untouched independent holdout. At least 100 unique games and a separately verified prospective holdout are required before a validation claim. The side-preserving candidate retains the original winner; calibration and bookmaker ROI remain unvalidated.'};
}
