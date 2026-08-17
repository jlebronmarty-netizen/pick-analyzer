import {
  summarizeNflBallDontLieHistoricalReadiness,
  validateNflBallDontLieHistoricalReadiness,
} from '@/services/nfl-balldontlie-historical-readiness.service'

const args = new Set(process.argv.slice(2))

if (args.has('--execute')) {
  const gates = {
    trialActive: process.env.NFL_BALLDONTLIE_TRIAL_ACTIVE === 'true',
    executionAuthorized: process.env.NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED === 'true',
    apiKeyPresent: Boolean(process.env.BALLDONTLIE_API_KEY?.trim()),
    bounded:
      [...args].some((arg) => arg.startsWith('--maxCalls=')) ||
      [...args].some((arg) => arg.startsWith('--maxRuntimeMinutes=')),
  }

  if (!Object.values(gates).every(Boolean)) {
    console.error(JSON.stringify({
      mode: 'nfl_01_balldontlie_historical_import_readiness_execute_guard',
      status: 'EXECUTION_BLOCKED_PROVIDER_HARD_GUARD',
      providerCallsMade: 0,
      databaseMutationsMade: 0,
      gates,
      required: [
        'NFL_BALLDONTLIE_TRIAL_ACTIVE=true',
        'NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED=true',
        'BALLDONTLIE_API_KEY present',
        '--maxCalls or --maxRuntimeMinutes',
      ],
    }, null, 2))
    process.exit(2)
  }

  console.error(JSON.stringify({
    mode: 'nfl_01_balldontlie_historical_import_readiness_execute_guard',
    status: 'EXECUTION_NOT_IMPLEMENTED_IN_NFL_01',
    providerCallsMade: 0,
    databaseMutationsMade: 0,
    reason: 'NFL-01 certifies readiness and manifest only. The START phase must provide explicit trial authorization before adding live download execution.',
  }, null, 2))
  process.exit(2)
}

const result = args.has('--validate')
  ? validateNflBallDontLieHistoricalReadiness()
  : summarizeNflBallDontLieHistoricalReadiness()

console.log(JSON.stringify(result, null, 2))
process.exit(result.success === false ? 1 : 0)
