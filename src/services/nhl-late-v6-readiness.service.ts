import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NHL_LATE_V6} from '@/lib/nhl-late-v6-core.mjs';

const validNumber=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<1;
const brier=(p:number,y:number)=>(p-y)**2;
const safeAvg=(n:number,sum:number)=>n?Number((sum/n).toFixed(5)):null;
const stamp=(x:unknown)=>Date.parse(String(x??''));
export async function getNhlLateV6Readiness(){
 const [frozen,outcomes]=await Promise.all([
  db.from('nhl_late_shadow_v6').select('*').order('frozen_at',{ascending:false}).limit(250),
  db.from('nhl_free_outcomes_v1').select('event_id,body,observed_at').limit(250)
 ]);
 if(frozen.error?.code==='42P01'||frozen.error?.code==='PGRST205')
  return {status:'SCHEMA_PENDING',version:NHL_LATE_V6,readOnly:true,providerCalls:0,databaseWrites:0};
 if(frozen.error||outcomes.error)throw Error('NHL_LATE_V6_READ_NOT_VERIFIED');
 const rows=frozen.data??[],truth=new Map((outcomes.data??[]).map(x=>[x.event_id,x]));
 let scored=0,unscored=0,invalid=0,nP=0,nC=0,nD=0,nM=0;
 let sumP=0,sumC=0,sumD=0,sumM=0,candidateHits=0,marketHits=0;
 let withGoalies=0,withPP=0,eligible=0;
 for(const row of rows){
  const scheduled=stamp(row.scheduled_at),freeze=stamp(row.frozen_at);
  const g=row.goalie_evidence;
  if(row.model_version!==NHL_LATE_V6||row.official_pick!==false||
   row.production_eligible!==false||!Number.isFinite(scheduled)||!Number.isFinite(freeze)||
   freeze>scheduled-60*60000||g?.status!=='PREGAME_PROBABLE_SOURCE_ONLY'||
   g?.isConfirmedStarter!==false||g?.goalieAdjustmentApplied!==false){invalid++;continue;}
  if(g?.home&&g?.away)withGoalies++;
  if(row.special_teams_evidence?.status==='ASOF_SPECIAL_TEAMS_EVIDENCE')withPP++;
  if(row.calibration?.status==='PROSPECTIVE_TEST_ONLY')eligible++;
  const o=truth.get(row.event_id) as any;
  if(!o){unscored++;continue;}
  const b=o.body??{},h=b.homeScore,a=b.awayScore;
  if(stamp(b.scheduledAt)!==scheduled||Number(b.homeId)!==Number(row.home_team_id)||
   Number(b.awayId)!==Number(row.away_team_id)||!Number.isSafeInteger(h)||!Number.isSafeInteger(a)||
   h===a||stamp(o.observed_at)<=scheduled){invalid++;continue;}
  scored++;const y=h>a?1:0,cal=row.calibration,market=cal?.circaPrice;
  if(validNumber(row.market_proxies?.homeMoneylineProxy)){nP++;sumP+=brier(row.market_proxies.homeMoneylineProxy,y);}
  if(validNumber(cal?.originalDratingsHome)){nD++;sumD+=brier(cal.originalDratingsHome,y);}
  if(validNumber(market?.homeNoVig)){nM++;sumM+=brier(market.homeNoVig,y);marketHits+=Number((market.homeNoVig>=.5)===Boolean(y));}
  if(validNumber(cal?.candidateHome)){nC++;sumC+=brier(cal.candidateHome,y);candidateHits+=Number((cal.candidateHome>=.5)===Boolean(y));}
 }
 return {status:invalid?'REVIEW_INVALID_FROZEN_RECORDS':scored<30?
  'PROSPECTIVE_SAMPLE_PENDING':'RESEARCH_HOLDOUT_EVALUATION_REQUIRED',
  version:NHL_LATE_V6,readOnly:true,providerCalls:0,databaseWrites:0,
  ledger:{frozen:rows.length,pending:unscored,settled:scored,invalid,
   pairedProbableGoalies:withGoalies,confirmedGoalies:0,
   withAsOfSpecialTeams:withPP,calibrationCandidateEligible:eligible,
   earliestFrozenAt:rows.at(-1)?.frozen_at??null,latestFrozenAt:rows[0]?.frozen_at??null},
  statisticalOnly:{poissonProxyBrier:safeAvg(nP,sumP),poissonGames:nP,
   dratingsBrier:safeAvg(nD,sumD),dratingsGames:nD,
   circaNoVigBrier:safeAvg(nM,sumM),circaGames:nM,
   candidateBrier:safeAvg(nC,sumC),candidateGames:nC,
   circaDirectionalHits:marketHits,candidateDirectionalHits:candidateHits,
   minimumInitialHoldout:30,prospectiveHoldoutPassed:false,
   independentEvaluationRequired:true,calibratedModelPromoted:false,
   bookmakerSettlementCertified:false},
  policy:{confirmedStartingGoalieEvidence:false,goalieProbableIsNotConfirmed:true,
   modelGoalieAdjustmentApplied:false,officialPickChanges:0,paidCalls:0},
  warning:'Separate late pregame shadow. ESPN probable is unconfirmed; rolling Circa bias was selected in earlier exploratory data, not an approved betting model.'};
}
