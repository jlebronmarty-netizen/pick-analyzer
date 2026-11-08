export const NBA_GOAT_PROVIDER='balldontlie';
export const NBA_GOAT_POLICY='NBA_GOAT_ARCHIVE_SHADOW_V1';
export const NBA_GOAT_STATS_VERSION='NBA_GOAT_TEAM_STATS_V1';
export const FANDUEL_NBA_FULL_GAME_RULE={
 id:'FANDUEL_NBA_FULL_GAME_OT_2026_10',
 source:'FanDuel official Sportsbook Terms and Conditions · Basketball',
 url:'https://policies.fanduel.com/SB/NJ/2026-10-15T12-42-58.html',
 observedAt:'2026-11-08',
 scope:'FULL_GAME_INCLUDING_OT',
 statisticalScopeVerified:true,
 sportsbookSettlementClaimed:false,
};
const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const marketContract={moneyline:new Set(['WINNER']),spread:new Set(['SIGNED_HANDICAP']),total:new Set(['STRICT_GREATER_THAN','STRICT_LESS_THAN'])};
function providerId(event){const m=/^bdl_nba_(\d+)$/.exec(String(event?.id??''));return m?Number(m[1]):null;}
export function nbaGoatDerivedContext(event,quote,scheduleGame,scheduleReceivedAt,now=new Date().toISOString()){
 const at=time(now),received=time(scheduleReceivedAt),gid=providerId(event),scheduled=String(scheduleGame?.status_state??'').toLowerCase()==='scheduled';
 const identity=gid!==null&&scheduleGame?.id===gid&&scheduleGame?.home_team?.full_name===event?.home_team&&scheduleGame?.visitor_team?.full_name===event?.away_team;
 const scheduleFresh=at!==null&&received!==null&&received<=at&&at-received<=3600000;
 const phaseVerified=Boolean(identity&&scheduleFresh&&scheduled&&scheduleGame?.postponed===false&&scheduleGame?.postseason===false&&scheduleGame?.ist_stage==null&&Number(scheduleGame?.season)===Number(String(event?.season??'').slice(0,4)));
 const contract=quote?.metadata?.contract,period=quote?.metadata?.period;
 const contractVerified=String(quote?.sportsbook??'').toLowerCase()==='fanduel'&&period==='FULL_GAME_LABEL_OT_UNVERIFIED'&&marketContract[quote?.market]?.has(contract)===true;
 return {
  seasonPhaseVerified:phaseVerified,
  seasonPhaseEvidence:phaseVerified?{provider:'balldontlie',providerGameId:gid,season:Number(scheduleGame.season),postseason:false,istStage:null,statusState:'scheduled',scheduleReceivedAt}:null,
  contractScopeVerified:contractVerified,
  contractEvidence:contractVerified?{...FANDUEL_NBA_FULL_GAME_RULE,market:quote.market,contract,period,statisticalOnly:true,userJurisdictionSettlementNotCertified:true}:null,
 };
}
export function nbaGoatQuoteChecks(event,quote,now=new Date().toISOString(),context={}){
 const issues=[],writeIssues=[],at=time(now),start=time(event?.start_time),updated=time(quote?.provider_timestamp),received=time(quote?.metadata?.source_received_at);
 if(quote?.provider!==NBA_GOAT_PROVIDER)issues.push('NBA_PROVIDER_MUST_BE_BALLDONTLIE');
 if(event?.sport_key!=='basketball_nba'||event?.league_key!=='nba'||quote?.event_id!==event?.id)issues.push('EVENT_IDENTITY_MISMATCH');
 if(at===null||start===null||updated===null||received===null)issues.push('UNVERIFIABLE_TIMESTAMPS');
 else{if(start<=at+600000)issues.push('PREGAME_CUTOFF_FAILED');if(updated>received||received>at)issues.push('FUTURE_QUOTE_EVIDENCE');if(at-updated>1800000)issues.push('STALE_GOAT_QUOTE');}
 if(!['scheduled','created','pre_game','pregame','not_started'].includes(String(event?.status??'').toLowerCase())||quote?.metadata?.phase!=='PREGAME')issues.push('NOT_PREGAME');
 if(!['moneyline','spread','total'].includes(quote?.market))issues.push('UNSUPPORTED_SHADOW_MARKET');
 if(String(quote?.sportsbook??'').toLowerCase()!=='fanduel')issues.push('UNSUPPORTED_BOOK');
 if(typeof quote?.price!=='number'||!Number.isFinite(quote.price)||Math.abs(quote.price)<100)issues.push('INVALID_PRICE');
 if(quote?.market!=='moneyline'&&(typeof quote?.line!=='number'||!Number.isFinite(quote.line)))issues.push('MISSING_EXACT_LINE');
 if(quote?.market==='moneyline'&&quote.line!==null)issues.push('UNEXPECTED_LINE');
 if(['moneyline','spread'].includes(quote?.market)&&![event?.home_team,event?.away_team].includes(quote?.outcome))issues.push('INVALID_SELECTION');
 if(quote?.market==='total'&&!['Over','Under'].includes(quote?.outcome))issues.push('INVALID_SELECTION');
 if(quote?.metadata?.module!=='NBA_MARKET_DATA_V1'||!quote?.metadata?.quote_id||!quote?.metadata?.snapshot_id)issues.push('MISSING_ARCHIVE_PROVENANCE');
 if(event?.metadata?.trial===true||event?.metadata?.scrambled===true||quote?.metadata?.trial===true||quote?.metadata?.scrambled===true)issues.push('TRIAL_OR_SCRAMBLED');
 const phaseVerified=context.seasonPhaseVerified??event?.metadata?.season_phase_verified===true;
 const contractVerified=context.contractScopeVerified??(quote?.metadata?.settlement_eligible===true&&quote?.metadata?.overtime_rule&&quote?.metadata?.overtime_rule!=='NOT_VERIFIED');
 if(phaseVerified!==true)writeIssues.push('SEASON_PHASE_UNVERIFIED');
 if(contractVerified!==true)writeIssues.push('MARKET_SCOPE_UNVERIFIED');
 return {providerAccepted:quote?.provider===NBA_GOAT_PROVIDER,priceEligible:issues.length===0,writeEligible:issues.length===0&&writeIssues.length===0,issues:[...new Set(issues)],writeIssues:[...new Set(writeIssues)]};
}
export function nbaGoatGate({enabled,continuousEnabled,pending,rowsToday,statsCurrent,priceCount,contractCount,completedRuns,repairedRuns,canaryRows,repairEnabled}){
 const blockers=[];
 if([pending,rowsToday,priceCount,contractCount,completedRuns,repairedRuns,canaryRows].some(n=>!Number.isSafeInteger(n)||n<0))return {allowed:false,blockers:['INVALID_GATE_COUNTERS'],continuous:false,repair:false,perRunWriteCap:0,directProviderCalls:0};
 if(!enabled)blockers.push('SCHEDULER_DISABLED');
 const continuous=continuousEnabled&&completedRuns>=2&&repairedRuns>=1,repair=repairEnabled&&completedRuns>=2&&repairedRuns<1;
 if(pending>=75||(continuous&&pending>=60))blockers.push('PENDING_SHADOW_REVIEW_REQUIRED');
 if(!continuous&&!repair&&completedRuns>=2)blockers.push('CANARY_REVIEW_REQUIRED');
 if(!continuous&&(completedRuns>=4||canaryRows>=12))blockers.push('CANARY_HARD_LIMIT');
 if(continuous&&rowsToday>=3)blockers.push('DAILY_SHADOW_ROW_CAP');
 if(!statsCurrent)blockers.push('CURRENT_SEASON_STATS_MISSING_OR_STALE');
 if(!priceCount)blockers.push('NO_FRESH_PREGAME_GOAT_QUOTES');
 if(!contractCount)blockers.push('CONTRACT_SCOPE_REQUIRES_VERIFICATION');
 return {allowed:blockers.length===0,blockers,continuous,repair,perRunWriteCap:Math.max(0,Math.min(3,continuous?3-rowsToday:12-canaryRows)),directProviderCalls:0};
}
export function isExactGoatModelMatch(p,event,q){
 return Boolean(p&&p.gameId===event.id&&p.market===q.market&&p.team===q.outcome&&(p.line??null)===(q.line??null)&&String(p.sportsbook).toLowerCase()===String(q.sportsbook).toLowerCase()&&p.odds===q.price&&time(p.oddsTimestamp)!==null&&time(p.oddsTimestamp)===time(q.provider_timestamp)&&Number.isFinite(p.modelProbability)&&p.modelProbability>0&&p.modelProbability<100&&p.dataSufficiencyScore>=35&&p.featureQualityScore>0&&!p.explanation?.warnings?.some(w=>/Missing team_stats|trial|scrambled|fallback/i.test(w)));
}
