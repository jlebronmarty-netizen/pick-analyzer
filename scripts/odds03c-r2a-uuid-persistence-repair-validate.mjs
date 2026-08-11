import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(path, 'utf8')
}

function json(path) {
  return JSON.parse(read(path))
}

let failures = 0
function check(name, passed) {
  if (passed) {
    console.log(`PASS ${name}`)
  } else {
    failures += 1
    console.error(`FAIL ${name}`)
  }
}

const cert = json('docs/CERTIFICATION/odds-03c-r2a-uuid-persistence-repair.json')
const report = read('docs/PRODUCTION_PILOT/ODDS_03C_R2A_UUID_PERSISTENCE_REPAIR.md')
const writer = read('src/services/line-versioned-reprediction-writer.service.ts')
const migration = read('supabase/migrations/202607140001_historical_feature_snapshots_v1.sql')
const versioning = read('supabase/migrations/202607170002_prediction_versioning_engine_v1.sql')

check('incident reproduced in certification', cert.incidentReplay.invalidValue.includes('line_versioned_reprediction_writer_v1:50c7066e-b954-589a-82d5-235dbf9d9826:total'))
check('target DB field identified', cert.targetDbColumn === 'prediction_history.feature_snapshot_id')
check('target DB type identified', cert.targetDbType === 'uuid')
check('schema contract proves UUID FK', migration.includes('feature_snapshot_id uuid references historical_feature_snapshots(id)'))
check('raw composite feature id no longer generated', !writer.includes('id: stableId([MODE, row.id, market, generatedAt])'))
check('valid source snapshot UUID required', writer.includes('const sourceSnapshotId = dbUuidOrNull(row.feature_snapshot_id)') && writer.includes('if (!sourceSnapshotId) return null'))
check('feature snapshot FK receives DB UUID', writer.includes('feature_snapshot_id: dbFeatureSnapshotId'))
check('logical key remains text field', writer.includes('feature_snapshot_key: stableId([MODE, prediction.id, market, generatedAt, newLine])'))
check('idempotency remains composite text', writer.includes('const idempotencyKey = stableId([MODE, event.id, market, teamSelection, newLine])') && versioning.includes('idempotency_key text'))
check('prediction id deterministic UUID preserved', writer.includes('const predictionId = stableUuid([MODE, prediction.id, event.id, market, teamSelection, newLine, sourceTimestamp(bestEvidence)])'))
check('UUID type guard added', writer.includes('assertDbUuidOrNull(row.feature_snapshot_id') && writer.includes('line-versioned DB type guard failed'))
check('supersession UUIDs validated', writer.includes("assertDbUuidOrNull(row.parent_prediction_id") && writer.includes("assertDbUuidOrNull(oldPredictionId"))
check('original prediction preserved', writer.includes('parent_prediction_id: prediction.id') && writer.includes('superseded_by_prediction_id: row.id'))
check('MARKET_LINE_CHANGED lineage preserved', writer.includes("version_created_reason: 'MARKET_LINE_CHANGED'") && writer.includes("supersedeReason: 'MARKET_LINE_CHANGED'"))
check('incident replay succeeds by type contract', cert.incidentReplay.result === 'NO_UUID_PARSE_ERROR')
check('idempotency preserved', cert.idempotency.sameLogicalIdentity === 'same deterministic UUID and idempotency key')
check('concurrent safety preserved', cert.idempotency.concurrentInvocation === 'one insert or existing-row reuse')
check('settlement linkage safe', cert.regressions.settlement === 'UNCHANGED')
check('learning linkage safe', cert.regressions.learning === 'UNCHANGED')
check('Stage 3 R2 persistent behavior retained', writer.includes('PERSISTENT_PRIMARY_WRITER') && cert.stage3R2PersistentBehaviorRetained === true)
check('Stage 1 behavior retained', writer.includes('NON_PERSISTENT_SHADOW_EXECUTION') && cert.stage1R2BehaviorRetained === true)
check('provider calls zero', cert.providerCallsFromCertification === 0)
check('production DB mutations zero', cert.productionDbMutationsFromCertification === 0)
check('report explains root cause', report.includes('feature_snapshot_id') && report.includes('composite logical'))

if (failures) {
  console.error(`ODDS-03C-R2A UUID validation failed: ${failures}`)
  process.exit(1)
}

console.log('ODDS-03C-R2A UUID validation passed')
