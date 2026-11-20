import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NHL_LATE_V6} from '@/lib/nhl-late-v6-core.mjs';
import {evaluateNhlV6Paired} from '@/lib/nhl-v6-prospective-validation.mjs';
import {readNhlV6CohortFinals} from '@/lib/nhl-v6-cohort-finals.mjs';

const validNumber=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<1;
const brier=(p:number,y:number)=>(p-y)**2;
const logloss=(p:number,y:number)=>-(y*Math.log(p)+(1-y)*Math.log(1-p));
const safeAvg=(n:number,sum:number)=>n?Number((sum/n).toFixed(5)):null;
const stamp=(x:unknown)=>Date.parse(String(x??''));
export async function getNhlLateV6Readiness(){
 const frozen=await db.from('nhl_late_shadow_v6').select('*')
  .order('frozen_at',{ascending:false}).order('event_id').limit(250);
 if(frozen.error?.code==='42P01'||frozen.error?.code==='PGRST205')
  return {status:'SCHEMA_PENDING',version:NHL_LATE_V6,readOnly:true,providerCalls:0,databaseWrites:0};
 if(frozen.error)throw Error('NHL_LATE_V6_READ_NOT_VERIFIED');
 const rows=frozen.data??[];
 const finals=await readNhlV6CohortFinals(db,rows.map(row=>row.event_id));
 const truth=new Map<string,any>();
 for(const receipt of finals){
  truth.set(receipt.event_id,truth.has(receipt.event_id)?null:receipt);
 }
 const pairedValidation=evaluateNhlV6Paired({frozenRows:rows,finalRows:finals});
 let scored=0,unscored=0,invalid=0,nP=0,nC=0,nD=0,nM=0;
 let sumP=0,sumC=0,sumD=0,sumM=0,lossP=0,lossC=0,lossD=0,lossM=0;
 let candidateHits=0,marketHits=0,poissonHits=0,dratingsHits=0,homeWins=0;
 let withGoalies=0,withPP=0,eligible=0,withPairedPriorForm=0,withPartialPriorForm=0,
  withPriorShots50Home=0,withPriorShots50Away=0;
 for(const row of rows){
  const scheduled=stamp(row.scheduled_at),freeze=stamp(row.frozen_at);
  const g=row.goalie_evidence;
  if(row.model_version!==NHL_LATE_V6||row.official_pick!==false||
   row.production_eligible!==false||!Number.isFinite(scheduled)||!Number.isFinite(freeze)||
   freeze>scheduled-60*60000||g?.status!=='PREGAME_PROBABLE_SOURCE_ONLY'||
   g?.isConfirmedStarter!==false||g?.goalieAdjustmentApplied!==false){invalid++;continue;}
  if(g?.home&&g?.away)withGoalies++;
  const history=g?.historicalFormV7;
  if(history?.status==='BOTH_PRIOR_FORMS_AVAILABLE')withPairedPriorForm++;
  else if(history?.status==='PARTIAL_PRIOR_GOALIE_FORM')withPartialPriorForm++;
  if(history?.home?.status==='PRIOR_FORM_EVIDENCE')withPriorShots50Home++;
  if(history?.away?.status==='PRIOR_FORM_EVIDENCE')withPriorShots50Away++;
  if(row.special_teams_evidence?.status==='ASOF_SPECIAL_TEAMS_EVIDENCE')withPP++;
  if(row.calibration?.status==='PROSPECTIVE_TEST_ONLY')eligible++;
  const o=truth.get(row.event_id) as any;
  if(o===null){invalid++;continue;}
  if(!o){unscored++;continue;}
  const b=o.body??{},h=b.homeScore,a=b.awayScore;
  if(stamp(b.scheduledAt)!==scheduled||Number(b.homeId)!==Number(row.home_team_id)||
   Number(b.awayId)!==Number(row.away_team_id)||!Number.isSafeInteger(h)||!Number.isSafeInteger(a)||
   h===a||stamp(o.observed_at)<=scheduled){invalid++;continue;}
  scored++;const y=h>a?1:0,cal=row.calibration,market=cal?.circaPrice;homeWins+=y;
  if(validNumber(row.market_proxies?.homeMoneylineProxy)){const p=row.market_proxies.homeMoneylineProxy;
   nP++;sumP+=brier(p,y);lossP+=logloss(p,y);poissonHits+=Number((p>=.5)===Boolean(y));}
  if(validNumber(cal?.originalDratingsHome)){const p=cal.originalDratingsHome;
   nD++;sumD+=brier(p,y);lossD+=logloss(p,y);dratingsHits+=Number((p>=.5)===Boolean(y));}
  if(validNumber(market?.homeNoVig)){const p=market.homeNoVig;
   nM++;sumM+=brier(p,y);lossM+=logloss(p,y);marketHits+=Number((p>=.5)===Boolean(y));}
  if(validNumber(cal?.candidateHome)){const p=cal.candidateHome;
   nC++;sumC+=brier(p,y);lossC+=logloss(p,y);candidateHits+=Number((p>=.5)===Boolean(y));}
 }
 return {status:invalid?'REVIEW_INVALID_FROZEN_RECORDS':scored<30?
  'PROSPECTIVE_SAMPLE_PENDING':'RESEARCH_HOLDOUT_EVALUATION_REQUIRED',
  version:NHL_LATE_V6,readOnly:true,providerCalls:0,databaseWrites:0,
  prospectiveFourWayValidation:pairedValidation,
  ledger:{frozen:rows.length,pending:unscored,settled:scored,invalid,
   pairedProbableGoalies:withGoalies,confirmedGoalies:0,
   withAsOfSpecialTeams:withPP,calibrationCandidateEligible:eligible,
   earliestFrozenAt:rows.at(-1)?.frozen_at??null,latestFrozenAt:rows[0]?.frozen_at??null},
  statisticalOnly:{poissonProxyBrier:safeAvg(nP,sumP),poissonLogLoss:safeAvg(nP,lossP),poissonGames:nP,
   dratingsBrier:safeAvg(nD,sumD),dratingsLogLoss:safeAvg(nD,lossD),dratingsGames:nD,
   circaNoVigBrier:safeAvg(nM,sumM),circaLogLoss:safeAvg(nM,lossM),circaGames:nM,
   candidateBrier:safeAvg(nC,sumC),candidateLogLoss:safeAvg(nC,lossC),candidateGames:nC,
   homeWins,poissonDirectionalHits:poissonHits,dratingsDirectionalHits:dratingsHits,
   circaDirectionalHits:marketHits,candidateDirectionalHits:candidateHits,
   minimumInitialHoldout:30,prospectiveHoldoutPassed:false,
   independentEvaluationRequired:true,calibratedModelPromoted:false,
   bookmakerSettlementCertified:false},
  goalieHistoricalFormV7:{pairedWithMinimum50PriorShots:withPairedPriorForm,
   partiallyAvailable:withPartialPriorForm,homeWith50PriorShots:withPriorShots50Home,
   awayWith50PriorShots:withPriorShots50Away,goalieModelAdjustmentApplied:false,
   independentlyCertifiedCrosswalk:false,allEvidenceObservedBeforeLateFreeze:true},
  policy:{confirmedStartingGoalieEvidence:false,goalieProbableIsNotConfirmed:true,
   modelGoalieAdjustmentApplied:false,officialPickChanges:0,paidCalls:0},
  warning:'Separate late pregame shadow. ESPN probable is unconfirmed; rolling Circa bias was selected in earlier exploratory data, not an approved betting model.'};
}
