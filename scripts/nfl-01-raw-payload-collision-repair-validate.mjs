import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const certification = JSON.parse(readFileSync('docs/CERTIFICATION/nfl-01-raw-payload-collision-repair.json', 'utf8'))

function run(args) {
  return spawnSync(process.execPath, ['--loader', './scripts/local-ts-loader.mjs', 'scripts/nfl-01-balldontlie-historical-import-readiness.mjs', ...args], {
    encoding: 'utf8',
  })
}

function parse(stdout) {
  try {
    return JSON.parse(stdout)
  } catch {
    return null
  }
}

const collisionFixture = run(['--collision-fixture-test'])
const localPreflight = run(['--local-storage-preflight'])
const readiness = run(['--validate'])

const collisionResult = parse(collisionFixture.stdout)
const preflightResult = parse(localPreflight.stdout)
const readinessResult = parse(readiness.stdout)

const checks = {
  statusReady: certification.status === 'NFL_01_BALLDONTLIE_RAW_PAYLOAD_COLLISION_REPAIR_CERTIFIED_READY_FOR_PROBE',
  rootCauseRecorded: certification.collision.classification === 'CHECKPOINT_CURSOR_SEMANTICS_AND_VOLATILE_ENVELOPE_HASH_DEFECT',
  existingDataPreserved: certification.existingData.deleted === false && certification.existingData.records === 32,
  nullCursorTerminal: certification.repair.nullCursorTerminal === true,
  rawReuseSupported: certification.repair.validExistingRawPayloadReuse === true,
  differentContentStillBlocks: certification.repair.differentContentStillBlocks === true,
  cursorPathsDistinct: certification.repair.cursorSpecificRawPaths === true,
  collisionFixturePasses: collisionFixture.status === 0 && collisionResult?.success === true,
  localPreflightPasses: localPreflight.status === 0 && preflightResult?.success === true,
  localPreflightNextWorkSafe:
    preflightResult?.nextWork?.requestId === 'bdl_nfl_probe_games_2025' &&
    preflightResult?.nextWork?.rawPath === 'data/imports/balldontlie/nfl/probe/02_games.json' &&
    preflightResult?.nextWork?.rawPathExists === false,
  readinessStillPasses: readiness.status === 0 && readinessResult?.success === true,
  repairProviderCallsZero: certification.providerCallsDuringRepair === 0 && collisionResult?.providerCallsMade === 0 && preflightResult?.providerCallsMade === 0,
  repairMutationsZero:
    certification.productionDatabaseMutationsDuringRepair === 0 &&
    collisionResult?.productionDatabaseMutationsMade === 0 &&
    preflightResult?.productionDatabaseMutationsMade === 0,
  p0NotStarted: certification.safety.p0Started === false,
  mlbNbaUnchanged: certification.safety.mlbChanged === false && certification.safety.nbaChanged === false,
  probeRetryReady: certification.probeRetryReady === true,
}

const result = {
  success: Object.values(checks).every(Boolean),
  mode: 'nfl_01_raw_payload_collision_repair_validation_v1',
  status: Object.values(checks).every(Boolean)
    ? 'NFL_01_BALLDONTLIE_RAW_PAYLOAD_COLLISION_REPAIR_CERTIFIED_READY_FOR_PROBE'
    : 'NFL_01_BALLDONTLIE_RAW_PAYLOAD_COLLISION_REPAIR_BLOCKED',
  providerCallsMade: 0,
  productionDatabaseMutationsMade: 0,
  checks,
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
