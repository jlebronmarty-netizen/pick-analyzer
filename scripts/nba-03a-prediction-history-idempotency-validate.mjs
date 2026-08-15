import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function json(path) {
  return JSON.parse(read(path))
}

const predictionHistory = read('src/services/prediction-history.service.ts')
const canary = read('src/services/nba-current-era-shadow-canary.service.ts')
const test = read('scripts/nba-03a-single-candidate-writer-test.mjs')
const versioningMigration = read('supabase/migrations/202607170002_prediction_versioning_engine_v1.sql')
const originMigration = read('supabase/migrations/202608150001_current_era_shadow_origin_v1.sql')
const oddsNullabilityMigration = read('supabase/migrations/202608140002_nba_replay_model_only_odds_nullability_v1.sql')
const cert = json('docs/CERTIFICATION/nba-03a-prediction-history-idempotency.json')

const checks = []

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('certification status recorded', cert.status === 'NBA_03A_FIRST_SHADOW_PERSISTENCE_REPAIR_CERTIFIED_CODE_ONLY')
check('root cause records invalid broad conflict target', cert.rootCause.currentConflictTarget === 'sport_key,game_id,team,market,sportsbook')
check('bad target duplicate audit blocks broad unique key', cert.duplicateAudit.badConflictTarget.duplicateGroups === 114)
check('proposed canonical key has zero duplicates', cert.duplicateAudit.proposedCanonicalKey.duplicateGroups === 0)
check('production catalog unavailable is disclosed', cert.productionCatalog.catalogViewsExposed === false)
check('existing primary key is the DB concurrency boundary', cert.canonicalIdentity.dbUniquenessIdentity === 'prediction_history.id')
check('no migration required', cert.migration.required === false)
check('deterministic uuid helper exists', predictionHistory.includes('stablePredictionHistoryUuid') && predictionHistory.includes("['prediction_history', buildPredictionHistoryLogicalIdentity(row)]"))
check('logical identity includes line', predictionHistory.includes("row.line ?? 'no_line'"))
check('logical identity includes sportsbook', predictionHistory.includes("row.sportsbook ?? 'unknown_sportsbook'"))
check('logical identity includes origin', predictionHistory.includes("row.prediction_origin ?? 'legacy_unspecified_origin'"))
check('logical identity includes model version', predictionHistory.includes("row.model_version ?? 'unknown_model_version'"))
check('current era rows use id conflict', predictionHistory.includes("row.prediction_origin === 'CURRENT_ERA_SHADOW' && Boolean(row.id)") && predictionHistory.includes("onConflict: 'id'"))
check('legacy writer path left unchanged', predictionHistory.includes("onConflict: 'sport_key,game_id,team,market,sportsbook'"))
check('canary imports deterministic identity helpers', canary.includes('buildPredictionHistoryDeterministicId') && canary.includes('buildPredictionHistoryLogicalIdentity'))
check('canary sets deterministic id', canary.includes('id: predictionId'))
check('canary sets idempotency key', canary.includes('idempotency_key: logicalIdentity'))
check('canary sets prediction group key', canary.includes('prediction_group_key: logicalIdentity'))
check('canary remains shadow non-current', canary.includes("model_role: 'shadow'") && canary.includes('is_current: false'))
check('Official Picks remain disabled', canary.includes('recommended_pick: false') && canary.includes('officialPickEligible: false'))
check('production visibility remains disabled', canary.includes('production_eligible: false') && canary.includes('productSurfaceVisible: false'))
check('historical replay remains isolated', originMigration.includes('CURRENT_ERA_SHADOW') && oddsNullabilityMigration.includes("HISTORICAL_REPLAY_SHADOW"))
check('historical versioning migration remains additive', versioningMigration.includes('prediction_history_version_lineage_unique'))
check('test covers different line collision', test.includes('different line must produce a distinct persisted identity'))
check('test covers different selection collision', test.includes('different selection must produce a distinct persisted identity'))
check('test covers different sportsbook collision', test.includes('different sportsbook must produce a distinct persisted identity'))
check('test covers different origin collision', test.includes('different prediction origin must produce a distinct persisted identity'))
check('test covers different model version collision', test.includes('different model version must produce a distinct persisted identity'))
check('no provider calls in repair validator', !/fetch\s*\(/.test(predictionHistory + canary))
check('no first shadow retry in repair validator', !predictionHistory.includes('NBA_CURRENT_ERA_SHADOW_WRITE_AUTHORIZED=true') && !canary.includes('NBA_CURRENT_ERA_SHADOW_WRITE_AUTHORIZED=true'))

const failed = checks.filter((item) => !item.passed)
console.log(`\nnba_03a_prediction_history_idempotency_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
