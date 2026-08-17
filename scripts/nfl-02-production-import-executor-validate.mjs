import { spawnSync } from 'node:child_process'

function run(args, expectStatus = 0) {
  const result = spawnSync('node', ['scripts/nfl-02-canonical-historical-import.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NFL_02_CANONICAL_PRODUCTION_IMPORT_AUTHORIZED: '',
    },
  })
  if (result.status !== expectStatus) {
    throw new Error(`${args.join(' ')} exited ${result.status}: ${result.stderr || result.stdout}`)
  }
  return JSON.parse(result.stdout)
}

const dryRun = run([])
const validate = run(['--validate'])
const selfTest = run(['--executor-self-test'])
const guarded = run(['--execute'], 1)

const checks = {
  dryRunDefault: dryRun.dryRun === true && dryRun.importExecution === 'DRY_RUN_ONLY',
  canonicalValidationPass: validate.success === true && validate.status === 'NFL_02_CANONICAL_HISTORICAL_IMPORT_READY',
  executorSelfTestPass: selfTest.success === true && selfTest.status === 'NFL_02_PRODUCTION_IMPORT_EXECUTOR_SELF_TEST_PASS',
  executeRequiresEnv: guarded.status === 'NFL_02_PRODUCTION_IMPORT_EXECUTOR_EXECUTION_AUTHORIZATION_MISSING',
  executeGuardNoProviderCalls: guarded.providerCallsMade === 0,
  executeGuardNoDbMutations: guarded.productionDatabaseMutationsMade === 0,
  dryRunExecuteIdentityParity: selfTest.checks.dryRunExecuteIdentityParity === true,
  boundedBatching: selfTest.checks.boundedBatchSizes === true,
  progressResumeScoped: selfTest.checks.progressDurablePathScoped === true && selfTest.checks.rerunUsesDbIdentityNotProgressAsTruth === true,
  partialFailureStops: selfTest.checks.partialFailureStopsClass === true,
  resultPayloadOmitsUuidId: selfTest.checks.resultPayloadOmitsId === true,
  resultIdentityGameId: selfTest.checks.resultIdentityGameId === true,
  providerErrorEvidenceExcluded: selfTest.checks.errorEvidenceExcluded === true,
  cancelledGameNoResult: selfTest.checks.cancelledGameNoResult === true,
  rosterForwardOnly: selfTest.checks.rosterForwardOnly === true,
  teams32: dryRun.canonicalCounts.teams === 32,
  players13559: dryRun.canonicalCounts.players === 13559,
  events1360: dryRun.canonicalCounts.games === 1360,
  results1359: dryRun.canonicalCounts.gameResults === 1359,
  teamStats2718: dryRun.canonicalCounts.teamGameStats === 2718,
  playerStats85749: dryRun.canonicalCounts.playerGameStats === 85749,
  seasonStats9072: dryRun.canonicalCounts.seasonStats === 9072,
  standings160: dryRun.canonicalCounts.standings === 160,
  roster3408: dryRun.canonicalCounts.rosterSupplement === 3408,
  mappings14951: dryRun.canonicalCounts.mappings === 14951,
}

const failures = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key)

if (failures.length) {
  console.error(JSON.stringify({
    status: 'NFL_02_PRODUCTION_IMPORT_EXECUTOR_VALIDATION_BLOCKED',
    failures,
    providerCallsMade: 0,
    productionDatabaseMutationsMade: 0,
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'NFL_02_PRODUCTION_IMPORT_EXECUTOR_CERTIFIED_READY_FOR_PUBLICATION',
  providerCallsMade: 0,
  productionDatabaseMutationsMade: 0,
  batchSizes: selfTest.batchSizes,
  importOrder: selfTest.importOrder,
  candidateRows: dryRun.candidateRows,
  identityManifest: selfTest.identityManifest,
  checks,
}, null, 2))
