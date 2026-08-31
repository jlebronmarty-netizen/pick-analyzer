import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-r1f-daily-feature-recovery-dml-partial.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict partial', artifact.certificationVerdict === 'MLB_DATA_01D_R1F_DAILY_FEATURE_RECOVERY_DML_PARTIAL')
check('authority passed', artifact.flags.R1F_DML_LIVE_AUTHORITY === 'PASS')
check('preflight passed', artifact.flags.R1F_DML_PREWRITE_PREFLIGHT === 'PASS')
check('snapshot guard passed', artifact.flags.R1F_DML_SNAPSHOT_GUARD === 'PASS')
check('team inserted', artifact.dmlAccounting.team.inserts === 4498 && artifact.dmlAccounting.team.finalRows === 4498 && artifact.dmlAccounting.team.duplicateKeys === 0)
check('starter inserted', artifact.dmlAccounting.starter.inserts === 4498 && artifact.dmlAccounting.starter.finalRows === 4498 && artifact.dmlAccounting.starter.duplicateKeys === 0)
check('bullpen blocked', artifact.dmlAccounting.bullpen.inserts === 0 && artifact.dmlAccounting.bullpen.conflicts === 1 && artifact.flags.R1F_BULLPEN_RECOVERY === 'FAIL')
check('later domains untouched', artifact.dmlAccounting.batter.finalRows === 0 && artifact.dmlAccounting.matchup.finalRows === 0 && artifact.dmlAccounting.firstInning.finalRows === 0)
check('snapshots preserved', artifact.dmlAccounting.snapshots.inserts === 0 && artifact.dmlAccounting.snapshots.reuses === 67433 && artifact.dmlAccounting.snapshots.updates === 0 && artifact.dmlAccounting.snapshots.deletes === 0 && artifact.dmlAccounting.snapshots.finalRows === 67433)
check('partial readback counts', artifact.partialReadback.status === 'PASS' && artifact.partialReadback.counts.pick2_feature_snapshots === 67433 && artifact.partialReadback.counts.pick2_mlb_team_daily_features === 4498 && artifact.partialReadback.counts.pick2_mlb_pitcher_daily_features === 4498 && artifact.partialReadback.counts.pick2_mlb_bullpen_daily_features === 0)
check('native preserved', artifact.partialReadback.counts.pick2_mlb_games === 2430 && artifact.partialReadback.counts.pick2_mlb_players === 1469)
check('models predictions zero', artifact.partialReadback.counts.pick2_model_registry === 0 && artifact.partialReadback.counts.pick2_model_versions === 0 && artifact.partialReadback.counts.pick2_game_predictions === 0 && artifact.partialReadback.counts.pick2_prediction_results === 0 && artifact.partialReadback.counts.pick2_market_value_evaluations === 0)
check('raw and 2026', artifact.partialReadback.counts.rawRowsFromExecutionGuardScan === 712528 && artifact.partialReadback.counts.raw2026 === 0)
check('inserted duplicate keys zero', artifact.partialReadback.duplicateKeys.team === 0 && artifact.partialReadback.duplicateKeys.starter === 0)
check('no unsafe work', artifact.safety.productionSchemaMutations === 0 && artifact.safety.migrationApply === 'NO' && artifact.safety.snapshotWrites === 0 && artifact.safety.rawStatcastWrites === 0 && artifact.safety.nativeIdentityWrites === 0 && artifact.safety.providerCalls === 0 && artifact.safety.modelTraining === 'NO' && artifact.safety.predictionGeneration === 'NO' && artifact.safety.import2026 === 'NO' && artifact.safety.automation === 'NO' && artifact.safety.cronChanges === 0)
check('foundation not ready', artifact.flags.MLB_DATA_01D_2025_FEATURE_FOUNDATION_READY === 'NO' && artifact.flags.MLB_DATA_02A_MODEL_DATASET_PREPARATION_READY === 'NO')
check('blocker named', artifact.remainingBlocker.includes('pick2_mlb_bullpen_daily_featu_team_id_feature_date_feature__key'))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1f-daily-feature-recovery-dml-partial-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01d-r1f-daily-feature-recovery-dml-partial-validate',
    status: 'PASS',
    verdict: artifact.certificationVerdict,
    teamRows: artifact.dmlAccounting.team.finalRows,
    starterRows: artifact.dmlAccounting.starter.finalRows,
    blocker: artifact.remainingBlocker,
  }, null, 2))
}
