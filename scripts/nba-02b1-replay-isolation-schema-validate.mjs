import fs from 'node:fs'

const migrationPath = 'supabase/migrations/202608140001_nba_replay_isolation_prediction_origin_v1.sql'
const certPath = 'docs/CERTIFICATION/nba-02b1-replay-isolation-schema.json'
const canaryCertPath = 'docs/CERTIFICATION/nba-02b1-replay-canary.json'
const servicePath = 'src/services/nba-replay-canary.service.ts'
const runnerPath = 'scripts/nba-02b1-replay-canary.mjs'
const docPath = 'docs/PRODUCTION_PILOT/NBA_02B1_R_REPLAY_ISOLATION_SCHEMA.md'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const migration = read(migrationPath)
const cert = JSON.parse(read(certPath))
const canary = JSON.parse(read(canaryCertPath))
const service = read(servicePath)
const runner = read(runnerPath)
const doc = read(docPath)

const checks = []

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('replay origin migration file exists', migration.includes('HISTORICAL_REPLAY_SHADOW'))
check('migration is additive', /add column if not exists prediction_origin text/i.test(migration) && /add column if not exists certification_status text/i.test(migration))
check('migration does not update existing rows', !/\bupdate\s+public\.prediction_history\b/i.test(migration) && !/\bdelete\s+from\s+public\.prediction_history\b/i.test(migration))
check('migration validates existing origins before constraint replacement', migration.includes('invalid_origin_count') && migration.includes('migration blocked before constraint replacement'))
check('migration preserves legacy origin values', ['LIVE_PREGAME', 'HISTORICAL_WALK_FORWARD_REPLAY', 'LEGACY_PRE_CERTIFICATION'].every((value) => migration.includes(value)))
check('replay origin explicit only', !/default\s+'HISTORICAL_REPLAY_SHADOW'/i.test(migration))
check('RLS unchanged', !/enable row level security|create policy|drop policy|alter policy/i.test(migration))
check('bounded replay index exists', migration.includes('prediction_history_replay_origin_lookup_idx') && migration.includes("where prediction_origin = 'HISTORICAL_REPLAY_SHADOW'"))
check('cert records migration blocked', cert.status === 'NBA_02B1_REPLAY_ISOLATION_MIGRATION_BLOCKED' && cert.migration.applied === false)
check('cert records no existing row mutation', cert.migration.existingRowsMutatedBySql === 0)
check('cert records no RLS change', cert.migration.rlsChanged === false)
check('selected origin is generic replay shadow', cert.schemaAudit.selectedReplayOrigin === 'HISTORICAL_REPLAY_SHADOW')
check('canary remains bounded', canary.canary.games === 24 && canary.predictions.planned === 96)
check('canary persistence blocked by schema', canary.schemaIsolation.selectable === false && canary.predictions.persisted === 0)
check('canary readback not fabricated', canary.persistenceDecision.readbackCount === 0 && canary.persistenceDecision.wrongOriginCount === 0)
check('writer supports explicit persist mode', runner.includes('--persist') && runner.includes('persistReplayRows'))
check('writer sets replay origin', runner.includes("prediction_origin: REPLAY_ORIGIN") && runner.includes("const REPLAY_ORIGIN = 'HISTORICAL_REPLAY_SHADOW'"))
check('writer separates product flags', runner.includes('production_eligible: false') && runner.includes('recommended_pick: false') && runner.includes('is_current: false'))
check('writer uses shadow model role', runner.includes("model_role: 'shadow'"))
check('idempotency includes origin', service.includes('NBA_02B1_REPLAY_ORIGIN') && service.includes('NBA_02B1_REPLAY_ORIGIN,'))
check('Current Era delta zero', cert.contamination.nbaCurrentEraPredictionDelta === 0)
check('Official Pick delta zero', cert.contamination.nbaOfficialPickDelta === 0)
check('production learning delta zero', cert.contamination.productionLearningDelta === 0)
check('production calibration delta zero', cert.contamination.productionCalibrationDelta === 0)
check('Current Era Performance delta zero', cert.contamination.currentEraPerformanceDelta === 0)
check('settlement debt delta zero', cert.contamination.settlementDebtDelta === 0)
check('product surface visibility zero', cert.contamination.productSurfaceReplayVisibilityCount === 0)
check('settlement preview unchanged', cert.settlementPreview.wins === 52 && cert.settlementPreview.losses === 44 && cert.settlementPreview.pushes === 0 && cert.settlementPreview.blocked === 0)
check('replay settlement writes zero', cert.settlementPreview.replaySettlementWrites === 0)
check('provider calls zero', cert.providers.ballDontLieCalls === 0 && cert.providers.theOddsApiHistoricalCalls === 0 && cert.providers.sportsDataIoCalls === 0)
check('NBA current era inactive', cert.operations.nbaCurrentEraStatus === 'INACTIVE' && cert.operations.nbaSchedulerStatus === 'INACTIVE')
check('doc records blocker', doc.includes('prediction_history.prediction_origin') && doc.includes('Apply the additive migration'))
check('no provider URLs in runner', !runner.includes('api.the-odds-api.com') && !runner.includes('api.balldontlie.io') && !runner.includes('sportsdata.io'))

const failed = checks.filter((item) => !item.passed)
console.log(`\nnba_02b1_replay_isolation_schema_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
