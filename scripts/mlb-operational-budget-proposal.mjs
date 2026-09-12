// Pure planning contract. Deliberately not imported by the production executor.
// Durable implementation, schema and activation require separate authorization.
export const proposedOddsPolicy=Object.freeze({version:'MLB_ODDS_OPERATIONAL_BUDGET_V1',activation:'PROPOSED_NOT_ACTIVE',dailyCap:48,perRunCap:1,resetTimezone:'America/Puerto_Rico',minimumIntervalMinutes:15,farIntervalMinutes:60,midIntervalMinutes:30,nearIntervalMinutes:15,farThresholdMinutes:180,nearThresholdMinutes:60,freshMinutes:10,startGuardMinutes:5})
export function proposedBudgetDay(at) {return new Intl.DateTimeFormat('en-CA',{timeZone:proposedOddsPolicy.resetTimezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at))}
export function planProposedOddsAcquisition({at,eligibleStarts,lastAcquisitionAt=null,lastReservationAt=null,dailyConsumed=0,runConsumed=0}) {
  const now=Date.parse(at),p=proposedOddsPolicy
  if(!Number.isFinite(now)||!Number.isInteger(dailyConsumed)||dailyConsumed<0||!Number.isInteger(runConsumed)||runConsumed<0||eligibleStarts.some(s=>!Number.isFinite(Date.parse(s))))throw Error('INVALID_BUDGET_INPUT')
  const upcoming=eligibleStarts.map(Date.parse).filter(t=>t>now+p.startGuardMinutes*60000)
  if(!upcoming.length)return {decision:'NO_ELIGIBLE_PREGAME_SCOPE'}
  if(runConsumed>=p.perRunCap)return {decision:'RUN_CAP'}
  if(dailyConsumed>=p.dailyCap)return {decision:'DAILY_CAP'}
  const nearest=(Math.min(...upcoming)-now)/60000,interval=nearest>p.farThresholdMinutes?p.farIntervalMinutes:nearest>p.nearThresholdMinutes?p.midIntervalMinutes:p.nearIntervalMinutes
  if(lastAcquisitionAt!==null&&!Number.isFinite(Date.parse(lastAcquisitionAt)))throw Error('INVALID_BUDGET_INPUT')
  if(lastReservationAt!==null&&!Number.isFinite(Date.parse(lastReservationAt)))throw Error('INVALID_BUDGET_INPUT')
  const age=lastAcquisitionAt===null?Infinity:(now-Date.parse(lastAcquisitionAt))/60000
  const reservationAge=lastReservationAt===null?Infinity:(now-Date.parse(lastReservationAt))/60000
  if(age<0||reservationAge<0)throw Error('FUTURE_ACQUISITION')
  // Reuse is a proposal for scheduling only, never permission to rebind a later
  // prediction to older prices or bypass provenance/Policy V1 guards.
  return {decision:age<=p.freshMinutes?'REUSE_IF_LINKAGE_VALID':reservationAge<p.minimumIntervalMinutes?'MIN_INTERVAL':Math.min(age,reservationAge)<interval?'DEFER_STALE_NOT_ACTIONABLE':'PROPOSE_ACQUIRE',intervalMinutes:interval}
}
export function projectProposedHealth({webSha,edgeVersion,currentRun,configurationEnabled,latestInvocationOk,missionConsumed,operationalBudget=null}) {
  const unresolved=currentRun?.status==='FAILED'&&currentRun?.checkpoint?.disposition?.status!=='TERMINAL_PARTIAL_PRESERVED'
  const exhausted=currentRun?.checkpoint?.result?.status==='ODDS_BUDGET_EXHAUSTED'||missionConsumed===20&&operationalBudget?.activation!=='ACTIVE'
  return {webDeploymentSha:webSha,edgeVersion,frozenRunPackageSha:currentRun?.package_sha??null,schedulerConfiguration:configurationEnabled?'ENABLED':'DISABLED',schedulerHealth:!configurationEnabled?'DISABLED':unresolved?'BLOCKED_FAILED_RUN':exhausted?'DEGRADED_ODDS_BUDGET_EXHAUSTED':latestInvocationOk===true?'OBSERVED_OK':'UNVERIFIED',historicalMissionBudget:{version:'MLB_OPERATIONAL_MISSION',consumed:missionConsumed,cap:20},operationalBudget:operationalBudget??{version:proposedOddsPolicy.version,activation:'NOT_ACTIVE'}}
}
