import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const certification = JSON.parse(readFileSync('docs/CERTIFICATION/nfl-01-start-balldontlie-live-executor-readiness.json', 'utf8'))
const baseCertification = JSON.parse(readFileSync('docs/CERTIFICATION/nfl-01-balldontlie-historical-import-readiness.json', 'utf8'))

const validation = spawnSync(
  process.execPath,
  [
    '--loader',
    './scripts/local-ts-loader.mjs',
    'scripts/nfl-01-balldontlie-historical-import-readiness.mjs',
    '--validate',
  ],
  { encoding: 'utf8' }
)

let liveReadiness = null
try {
  liveReadiness = JSON.parse(validation.stdout)
} catch {
  liveReadiness = null
}

const checks = {
  statusReady: certification.status === 'NFL_01_BALLDONTLIE_TRIAL_EXECUTION_READY',
  providerCallsZero: certification.providerCallsMade === 0,
  productionMutationsZero: certification.productionDatabaseMutationsMade === 0,
  liveExecutorImplemented: certification.liveExecutor.implemented === true,
  apiKeyAloneCannotExecute: certification.liveExecutor.apiKeyAloneCanExecute === false,
  explicitTrialFlagRequired: certification.liveExecutor.executeRequires.includes('NFL_BALLDONTLIE_TRIAL_ACTIVE=true'),
  explicitHistoricalAuthorizationRequired: certification.liveExecutor.executeRequires.includes('NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED=true'),
  hardCapsRequired: certification.liveExecutor.executeRequires.includes('--maxCalls') && certification.liveExecutor.executeRequires.includes('--maxRuntimeMinutes'),
  p0QueueCertified: certification.queues.p0.entries === 21 && certification.queues.p0.estimatedRequests === 1121,
  p1QueueCertified: certification.queues.p1.entries === 26 && certification.queues.p1.estimatedRequests === 377,
  probeQueueCertified: certification.queues.probe.entries === 3,
  p2DisabledByDefault: certification.queues.p2DefaultEnabled === false,
  rateLimitSafe: certification.rateLimit.certifiedSafeRequestsPerMinute < certification.rateLimit.trialLimitRequestsPerMinute,
  baseHardGuardUpdated: baseCertification.hardGuard.executeImplemented === true,
  validationScriptPasses: validation.status === 0 && liveReadiness?.success === true,
  noProductionActivation: certification.isolation.nflProductionActivated === false && certification.isolation.nflSchedulerActivated === false,
  noProviderExpansion: certification.isolation.sportsDataIoExpanded === false && certification.isolation.theOddsApiHistoricalCallsMade === false,
  mlbNbaUnchanged: certification.isolation.mlbRuntimeChanged === false && certification.isolation.nbaRuntimeChanged === false,
}

const result = {
  success: Object.values(checks).every(Boolean),
  mode: 'nfl_01_start_balldontlie_live_executor_readiness_validation_v1',
  status: Object.values(checks).every(Boolean)
    ? 'NFL_01_BALLDONTLIE_TRIAL_EXECUTION_READY'
    : 'NFL_01_BALLDONTLIE_TRIAL_EXECUTION_BLOCKED',
  providerCallsMade: 0,
  productionDatabaseMutationsMade: 0,
  checks,
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
