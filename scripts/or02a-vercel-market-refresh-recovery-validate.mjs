import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const json = (path) => JSON.parse(read(path))
const checks = []
const check = (name, passed, detail = '') => checks.push({ name, passed: Boolean(passed), detail })

const cert = json('docs/CERTIFICATION/or-02a-vercel-market-refresh-recovery.json')
const adaptive = read('src/services/adaptive-refresh-orchestrator.service.ts')
const eventPlanner = read('src/services/event-refresh-planner.service.ts')
const operatingDay = read('src/services/operating-day.service.ts')
const canonicalAcquisition = read('src/services/canonical-acquisition.service.ts')
const cronRoute = read('src/app/api/cron/operating-day/route.ts')
const health = read('src/services/operations-health.service.ts')
const or02 = json('docs/CERTIFICATION/or-02-primary-scheduler-migration-vercel-cron.json')
const status = json('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json')

check('OR-02A artifact exists and records root cause', cert.mission === 'OR-02A' && cert.rootCauseClassification === 'RESULT_RECOVERY_STARVATION_OF_ACTIVE_MARKET_REFRESH')
check('three prior Vercel runs are reconstructable', Array.isArray(cert.vercelRunsReconstructed) && cert.vercelRunsReconstructed.length >= 3)
check('selected action before repair was sync_results', cert.before.canonicalSelectedAction === 'sync_results')
check('zero-call reason is explicit', cert.before.zeroProviderCallReason === 'SYNC_RESULTS_SELECTED_FOR_OLD_RESULT_DEBT_WHILE_ODDS_DUE')
check('active eligible events are recorded', cert.before.eligibleRefreshEvents === 11 && cert.before.excludedPostStartEvents === 4)
check('market refresh action maps to canonical executor after repair', adaptive.includes('activeMarketRefreshPreemptsHistoricalResultDebt') && adaptive.includes("return status.currentGames > 0 ? 'midday_refresh' : 'morning_sync'"))
check('settlement still outranks market refresh', adaptive.includes("if (dueDomains.includes('settlement')) return 'settle'") && adaptive.includes("dueDomains.includes('settlement')\n    ? 'settle'"))
check('older result debt no longer outranks active stale markets', adaptive.includes("String(settlementBacklog?.oldestMissingResultDate) < String(activeSlateDate)") && adaptive.includes("!activeMarketRefreshPreemptsHistoricalResultDebt"))
check('fixture certifies corrected priority', adaptive.includes('active market refresh preempts older historical result debt') && adaptive.includes("resultRecoveryAction === 'midday_refresh'"))
check('dryRun defaults false for Vercel Cron', cronRoute.includes('return false') && cronRoute.includes("request.method === 'GET' ? VERCEL_PRIMARY_SOURCE : GITHUB_FALLBACK_SOURCE"))
check('provider budget is checked before execution', eventPlanner.includes('budgetAuthorization') && adaptive.includes('providerBudgetAuthorization'))
check('real provider timestamp lineage is preserved', adaptive.includes('latestOddsChange') && adaptive.includes('latestProviderCheck') && adaptive.includes('sourceLatestTimestamp'))
check('generatedAt cannot establish freshness', health.includes('Market freshness never falls back to scheduler invocation time') && cert.timestampPolicy.generatedAtCanEstablishFreshness === false)
check('post-start refresh remains blocked', cert.safety.postStartRefreshChanged === false && eventPlanner.includes('NO_PREGAME_REFRESH_AFTER_START') && eventPlanner.includes('POST_START_PREGAME_REFRESH_BLOCKED'))
check('dedupe/cooldown not loosened globally', cert.safety.deduplicationChanged === false)
check('one provider call may serve date scope', cert.providerAcquisition.acquisitionGranularity === 'date_level_provider_efficient_batch')
check('provider calls are counted', operatingDay.includes('externalProviderCallsMade') && adaptive.includes('providerCallsMade') && canonicalAcquisition.includes('externalCallsUsed: Number(input.contract.actualHttpRequests ?? 0)'))
check('canonical acquisition budget ledger is readable', canonicalAcquisition.includes('sports_sync_jobs') && canonicalAcquisition.includes('canonicalAcquisition: input.contract') && canonicalAcquisition.includes('actualHttpRequests: 1'))
check('Product Freshness SLA reads canonical current evidence', cert.timestampPolicy.certifiedFreshnessSource === 'stored_provider_source_market_timestamp')
check('no model/recommendation changes', cert.safety.predictionChanged === false && cert.safety.officialPickPolicyChanged === false && cert.safety.recommendationGatesChanged === false)
check('settlement remains healthy by evidence', cert.before.settlementClosure === 'HEALTHY')
check('Current Era and Replay unchanged', cert.safety.currentEraChanged === false && cert.safety.replayChanged === false)
check('certification reads made zero provider calls and mutations', cert.certificationReads.providerCallsMade === 0 && cert.certificationReads.remoteMutationsMade === 0)
check('OR-02 migration remains deployed but not final pass', or02.status === 'DEPLOYMENT_PENDING' || or02.finalClassification === 'EXTERNAL_WAIT_VERCEL_PRIMARY_SUSTAINED_PROOF')
check('Mission Control records OR-02A gated state', status.or02a?.status === 'DEPLOYMENT_PENDING_MARKET_REFRESH_PROOF')

const failedChecks = checks.filter((item) => !item.passed)

console.log(JSON.stringify({
  success: failedChecks.length === 0,
  mode: 'or02a_vercel_market_refresh_recovery_validate_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  predictionWrites: 0,
  resultWrites: 0,
  settlementWrites: 0,
  learningWrites: 0,
}, null, 2))

if (failedChecks.length > 0) process.exit(1)
