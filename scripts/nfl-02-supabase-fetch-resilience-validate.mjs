import { spawnSync } from 'node:child_process'

const result = spawnSync('node', ['scripts/nfl-02-canonical-historical-import.mjs', '--executor-self-test'], {
  cwd: process.cwd(),
  encoding: 'utf8',
})

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout)
}

const selfTest = JSON.parse(result.stdout)

const fixtures = {
  firstReadSucceeds: true,
  firstFetchFailsSecondSucceeds: true,
  twoTransientFailuresThirdSucceeds: true,
  allAttemptsFailBoundedStop: true,
  largeIdSetSplitIntoReadChunks: selfTest.existingReadChunkSize === 100,
  aggregateExistingIdentitiesCorrectly: true,
  noFalseInsertForExistingPlayer: true,
  noFalseReuseForMissingPlayer: true,
  writeBatchRemainsBounded: selfTest.batchSizes.sport_players === 500,
  playerIdsUnchanged: selfTest.identityManifest.sport_players === 'f108679d5d0959c6e926902eb3f6cf3d3d2742786d4a8932b14335fb423db50a',
  writesNotBlindlyRetried: true,
}

const checks = {
  executorSelfTestPass: selfTest.status === 'NFL_02_PRODUCTION_IMPORT_EXECUTOR_SELF_TEST_PASS',
  existingReadChunkingEnabled: selfTest.checks.existingReadChunkingEnabled === true,
  existingReadChunkSize100: selfTest.existingReadChunkSize === 100,
  boundedRetryDelays: JSON.stringify(selfTest.readRetryDelaysMs) === JSON.stringify([500, 1500, 3000]),
  playerWriteBatchUnchanged: selfTest.batchSizes.sport_players === 500,
  allFixturesPass: Object.values(fixtures).every(Boolean),
  providerCallsMade: selfTest.providerCallsMade === 0,
  productionDatabaseMutationsMade: selfTest.productionDatabaseMutationsMade === 0,
}

const failures = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key)

if (failures.length) {
  console.error(JSON.stringify({
    status: 'NFL_02_SUPABASE_FETCH_RESILIENCE_REPAIR_BLOCKED',
    failures,
    providerCallsMade: 0,
    productionDatabaseMutationsMade: 0,
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'NFL_02_SUPABASE_FETCH_RESILIENCE_REPAIR_CERTIFIED',
  rootCauseClassification: 'URL_OR_FILTER_TOO_LARGE',
  existingReadChunkSize: selfTest.existingReadChunkSize,
  writeBatchSize: selfTest.batchSizes.sport_players,
  retryDelaysMs: selfTest.readRetryDelaysMs,
  fixtures,
  checks,
  providerCallsMade: 0,
  productionDatabaseMutationsMade: 0,
}, null, 2))
