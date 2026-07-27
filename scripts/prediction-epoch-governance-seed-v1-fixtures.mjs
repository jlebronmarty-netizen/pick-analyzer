import fs from 'node:fs'

const rootSeed = 'supabase/migrations/202607270002_prediction_epoch_governance_seed_v1.sql'
const precheck = 'supabase/migrations/checks/202607270002_prediction_epoch_governance_seed_v1_precheck.sql'
const postcheck = 'supabase/migrations/checks/202607270002_prediction_epoch_governance_seed_v1_postcheck.sql'
const rollback = 'supabase/migrations/rollback/202607270002_prediction_epoch_governance_seed_v1_rollback.sql'

const legacy = {
  epoch_key: 'LEGACY_EPOCH_V1',
  epoch_name: 'Legacy Certified Prediction Epoch V1',
  status: 'ACTIVE',
  rollback_epoch_key: null,
  activated_at: '2026-07-27T00:00:00.000Z',
  archived_at: null,
}

const v2 = {
  epoch_key: 'DATA_FOUNDATION_V2_EPOCH',
  epoch_name: 'Historical Sports Data Foundation V2 Epoch',
  status: 'SHADOW',
  rollback_epoch_key: 'LEGACY_EPOCH_V1',
  activated_at: null,
  archived_at: null,
}

function isLegacy(row) {
  return row.epoch_key === legacy.epoch_key
    && row.epoch_name === legacy.epoch_name
    && row.status === legacy.status
    && row.rollback_epoch_key === null
    && Boolean(row.activated_at)
    && row.archived_at === null
}

function isV2(row) {
  return row.epoch_key === v2.epoch_key
    && row.epoch_name === v2.epoch_name
    && row.status === v2.status
    && row.rollback_epoch_key === v2.rollback_epoch_key
    && row.activated_at === null
    && row.archived_at === null
}

function precheckPass(state) {
  const rows = state.epochs
  const activeRows = rows.filter((row) => row.status === 'ACTIVE')
  const legacyRows = rows.filter((row) => row.epoch_key === legacy.epoch_key)
  const v2Rows = rows.filter((row) => row.epoch_key === v2.epoch_key)
  const emptyOrSeeded = (rows.length === 0 && activeRows.length === 0)
    || (rows.length === 2 && activeRows.length === 1 && legacyRows.length === 1 && v2Rows.length === 1 && v2Rows.every((row) => row.status !== 'ACTIVE'))
  return state.schemaApplied
    && state.predictionHistoryRows === 1477
    && state.settledAtRows === 1396
    && state.linkedPredictionRows === 0
    && emptyOrSeeded
    && rows.filter((row) => row.status === 'ACTIVE' && row.epoch_key !== legacy.epoch_key).length === 0
    && legacyRows.every(isLegacy)
    && v2Rows.every(isV2)
}

function seedPass(state) {
  const keys = state.epochs.map((row) => row.epoch_key)
  const duplicateCanonicalKey = keys.filter((key) => key === legacy.epoch_key).length > 1
    || keys.filter((key) => key === v2.epoch_key).length > 1
  if (!precheckPass(state) || duplicateCanonicalKey) return false
  const seeded = [...state.epochs]
  if (!seeded.some((row) => row.epoch_key === legacy.epoch_key)) seeded.push(legacy)
  if (!seeded.some((row) => row.epoch_key === v2.epoch_key)) seeded.push(v2)
  return postcheckPass({ ...state, epochs: seeded })
}

function postcheckPass(state) {
  return state.predictionHistoryRows === 1477
    && state.settledAtRows === 1396
    && state.linkedPredictionRows === 0
    && state.epochs.length === 2
    && state.epochs.filter(isLegacy).length === 1
    && state.epochs.filter(isV2).length === 1
    && state.epochs.filter((row) => row.status === 'ACTIVE').length === 1
    && state.epochs.filter((row) => row.epoch_key === v2.epoch_key && row.status === 'ACTIVE').length === 0
}

function rollbackAllowed(state) {
  return state.linkedPredictionRows === 0
    && state.epochs.filter((row) => row.epoch_key === v2.epoch_key && (row.status === 'ACTIVE' || row.activated_at || row.archived_at)).length === 0
    && state.epochs.filter((row) => [legacy.epoch_key, v2.epoch_key].includes(row.epoch_key) && !(isLegacy(row) || isV2(row))).length === 0
}

const fixtures = [
  {
    name: 'empty table before seed',
    state: { schemaApplied: true, predictionHistoryRows: 1477, settledAtRows: 1396, linkedPredictionRows: 0, epochs: [] },
    expected: { precheck: true, seed: true, postcheck: false, rollback: true },
  },
  {
    name: 'exact idempotent rerun',
    state: { schemaApplied: true, predictionHistoryRows: 1477, settledAtRows: 1396, linkedPredictionRows: 0, epochs: [legacy, v2] },
    expected: { precheck: true, seed: true, postcheck: true, rollback: true },
  },
  {
    name: 'conflicting legacy row',
    state: { schemaApplied: true, predictionHistoryRows: 1477, settledAtRows: 1396, linkedPredictionRows: 0, epochs: [{ ...legacy, status: 'SHADOW', activated_at: null }] },
    expected: { precheck: false, seed: false, postcheck: false, rollback: false },
  },
  {
    name: 'conflicting v2 row',
    state: { schemaApplied: true, predictionHistoryRows: 1477, settledAtRows: 1396, linkedPredictionRows: 0, epochs: [{ ...v2, rollback_epoch_key: null }] },
    expected: { precheck: false, seed: false, postcheck: false, rollback: false },
  },
  {
    name: 'existing active noncanonical epoch',
    state: { schemaApplied: true, predictionHistoryRows: 1477, settledAtRows: 1396, linkedPredictionRows: 0, epochs: [{ ...legacy, epoch_key: 'OTHER_EPOCH' }] },
    expected: { precheck: false, seed: false, postcheck: false, rollback: true },
  },
  {
    name: 'duplicate canonical key',
    state: { schemaApplied: true, predictionHistoryRows: 1477, settledAtRows: 1396, linkedPredictionRows: 0, epochs: [legacy, { ...legacy, activated_at: '2026-07-27T00:01:00.000Z' }, v2] },
    expected: { precheck: false, seed: false, postcheck: false, rollback: true },
  },
  {
    name: 'v2 accidentally active',
    state: { schemaApplied: true, predictionHistoryRows: 1477, settledAtRows: 1396, linkedPredictionRows: 0, epochs: [legacy, { ...v2, status: 'ACTIVE', activated_at: '2026-07-27T00:00:00.000Z' }] },
    expected: { precheck: false, seed: false, postcheck: false, rollback: false },
  },
  {
    name: 'prediction rows already linked',
    state: { schemaApplied: true, predictionHistoryRows: 1477, settledAtRows: 1396, linkedPredictionRows: 1, epochs: [legacy, v2] },
    expected: { precheck: false, seed: false, postcheck: false, rollback: false },
  },
]

const files = [rootSeed, precheck, postcheck, rollback]
const contents = Object.fromEntries(files.map((file) => [file, fs.readFileSync(file, 'utf8')]))
const destructivePatterns = [
  /\bdrop\b/i,
  /\btruncate\b/i,
  /\balter\s+table\s+public\.prediction_history\b/i,
  /\bupdate\s+public\.prediction_history\b/i,
  /\bdelete\s+from\s+public\.prediction_history\b/i,
]
const destructiveSqlCount = Object.entries(contents)
  .filter(([file]) => file !== rollback)
  .flatMap(([, text]) => destructivePatterns.map((pattern) => pattern.test(text)))
  .filter(Boolean).length

const requiredStaticChecks = [
  ['root seed uses ON CONFLICT DO NOTHING', /on conflict \(epoch_key\) do nothing/i.test(contents[rootSeed])],
  ['root seed does not update prediction_history', !/\bupdate\s+public\.prediction_history\b/i.test(contents[rootSeed])],
  ['root seed does not delete rows', !/\bdelete\b/i.test(contents[rootSeed])],
  ['precheck exists and is read-only', !/\b(insert|update|delete|truncate|drop)\b/i.test(contents[precheck])],
  ['postcheck exists and is read-only', !/\b(insert|update|delete|truncate|drop)\b/i.test(contents[postcheck])],
  ['rollback has linking guard', /ROLLBACK_ALLOWED_ONLY_BEFORE_EPOCH_LINKING_OR_V2_ACTIVATION/.test(contents[rollback])],
  ['rollback deletes only prediction_epochs seed keys', /delete from public\.prediction_epochs/i.test(contents[rollback]) && !/\bdelete\s+from\s+public\.prediction_history\b/i.test(contents[rollback])],
  ['non-rollback destructive sql count zero', destructiveSqlCount === 0],
]

const fixtureResults = fixtures.map((fixture) => {
  const actual = {
    precheck: precheckPass(fixture.state),
    seed: seedPass(fixture.state),
    postcheck: postcheckPass(fixture.state),
    rollback: rollbackAllowed(fixture.state),
  }
  return {
    name: fixture.name,
    expected: fixture.expected,
    actual,
    passed: Object.entries(fixture.expected).every(([key, value]) => actual[key] === value),
  }
})

const staticResults = requiredStaticChecks.map(([name, passed]) => ({ name, passed }))
const success = fixtureResults.every((result) => result.passed) && staticResults.every((result) => result.passed)

console.log(JSON.stringify({
  success,
  mode: 'prediction_epoch_governance_seed_v1_fixture_validation',
  fixtures: fixtureResults.length,
  fixturesPassed: fixtureResults.filter((result) => result.passed).length,
  staticChecks: staticResults.length,
  staticChecksPassed: staticResults.filter((result) => result.passed).length,
  destructiveSqlCount,
  fixtureResults,
  staticResults,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
}, null, 2))

if (!success) process.exit(1)
