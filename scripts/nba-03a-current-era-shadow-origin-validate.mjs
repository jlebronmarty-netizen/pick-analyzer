import fs from 'node:fs'

const migrationPath = 'supabase/migrations/202608150001_current_era_shadow_origin_v1.sql'
const certPath = 'docs/CERTIFICATION/nba-03a-current-era-shadow-origin.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_03A_R1_CURRENT_ERA_SHADOW_ORIGIN.md'
const predictionHistoryPath = 'src/services/prediction-history.service.ts'
const epochReadinessPath = 'src/services/prediction-epoch-shadow-readiness.service.ts'
const oddsNullabilityPath = 'supabase/migrations/202608140002_nba_replay_model_only_odds_nullability_v1.sql'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const migration = read(migrationPath)
const cert = JSON.parse(read(certPath))
const doc = read(docPath)
const predictionHistory = read(predictionHistoryPath)
const epochReadiness = read(epochReadinessPath)
const oddsNullability = read(oddsNullabilityPath)

const checks = []

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

const originValues = [
  'LIVE_PREGAME',
  'HISTORICAL_WALK_FORWARD_REPLAY',
  'HISTORICAL_REPLAY_SHADOW',
  'LEGACY_PRE_CERTIFICATION',
  'CURRENT_ERA_SHADOW',
]

check('existing origin semantics audited', Object.keys(cert.originSemantics).length === 5 && originValues.every((value) => cert.originSemantics[value]))
check('generic vs NBA-specific decision documented', cert.chosenOrigin === 'CURRENT_ERA_SHADOW' && cert.genericOrNbaSpecific === 'GENERIC' && cert.reason.includes('sport_key'))
check('new origin explicit in migration', migration.includes("'CURRENT_ERA_SHADOW'") && !/default\s+'CURRENT_ERA_SHADOW'/i.test(migration))
check('migration additive only', !/\bupdate\s+public\.prediction_history\b/i.test(migration) && !/\bdelete\s+from\s+public\.prediction_history\b/i.test(migration) && !/\btruncate\b/i.test(migration) && !/\bdrop\s+table\b/i.test(migration))
check('existing rows unchanged by design', cert.migration.existingRowsModified === 0 && cert.existingOriginDistribution.CURRENT_ERA_SHADOW === 0)
check('RLS unchanged', cert.migration.rlsChanged === false && !/enable row level security|create policy|drop policy|alter policy/i.test(migration))
check('origin constraint preserves existing values', originValues.every((value) => migration.includes(`'${value}'`)))
check('current era shadow is not production', cert.currentEraShadowContract.production_eligible === false && cert.currentEraShadowContract.recommended_pick === false && cert.currentEraShadowContract.model_role === 'shadow')
check('current era shadow requires cutoff safety', cert.currentEraShadowContract.cutoffSafetyRequired === true && doc.includes('cutoff/start identity'))
check('required price evidence preserved', cert.currentEraShadowContract.oddsRequired === true && cert.oddsContract.currentEraShadowOddsRequired === true)
check('historical replay null-odds exception not leaked', oddsNullability.includes("coalesce(prediction_origin, '') = 'HISTORICAL_REPLAY_SHADOW'") && !oddsNullability.includes('CURRENT_ERA_SHADOW'))
check('product visibility false', cert.currentEraShadowContract.productVisible === false && cert.currentEraShadowContract.certification_metadata.productSurfaceVisible === false)
check('Official Pick false', cert.currentEraShadowContract.officialPickEligible === false && cert.currentEraShadowContract.certification_metadata.officialPickEligible === false)
check('production calibration false', cert.currentEraShadowContract.productionCalibrationEligible === false && cert.currentEraShadowContract.certification_metadata.productionCalibrationEligible === false)
check('production learning false', cert.currentEraShadowContract.productionLearningEligible === false && cert.currentEraShadowContract.certification_metadata.productionLearningEligible === false)
check('settlement future compatibility', cert.currentEraShadowContract.naturalSettlementCompatible === true && cert.futureCompatibility.settlement.includes('settle'))
check('performance cohort separation', cert.cohorts.historicalReplay === 'NBA_HISTORICAL_REPLAY' && cert.cohorts.currentEraShadow === 'NBA_CURRENT_ERA_SHADOW' && cert.cohorts.currentEraProduction === 'NBA_CURRENT_ERA_PRODUCTION')
check('stake-engine future compatibility', cert.futureCompatibility.stakeEngine.includes('Probability') && cert.futureCompatibility.stakeEngine.includes('EV'))
check('continuous learning future compatibility', cert.futureCompatibility.continuousLearning.includes('no automatic retraining'))
check('writer input contract can carry origin', predictionHistory.includes('CURRENT_ERA_SHADOW') && predictionHistory.includes('certification_metadata?: Record<string, unknown> | null'))
check('epoch readiness recognizes current era shadow', epochReadiness.includes("if (origin === 'CURRENT_ERA_SHADOW') return 'CURRENT_ERA_SHADOW'"))
check('index justified and bounded', migration.includes('prediction_history_current_era_shadow_lookup_idx') && migration.includes("where prediction_origin = 'CURRENT_ERA_SHADOW'"))
check('manual SQL provided', cert.manualSql.preMigration.includes('prediction_history_prediction_origin_check') && cert.manualSql.postMigration.includes('current_era_shadow_existing_rows'))
check('provider calls 0', cert.accounting.providerCalls === 0)
check('DB mutations 0', cert.accounting.dbMutations === 0)
check('NBA production remains inactive', cert.accounting.nbaCurrentEraWrites === 0 && cert.accounting.nbaOfficialPicks === 0)
check('MLB regression PASS', cert.accounting.mlbMutations === 0)

const failed = checks.filter((item) => !item.passed)
console.log(`\nnba_03a_current_era_shadow_origin_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
