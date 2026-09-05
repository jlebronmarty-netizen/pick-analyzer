import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02o-current-moneyline-value-persistence.json', 'utf8'))
const audit = fs.readFileSync('docs/CERTIFICATION/mlb-data-02o-current-moneyline-value-persistence-audit.md', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('blocked verdict', artifact.certificationVerdict === 'MLB_DATA_02O_CURRENT_MONEYLINE_VALUE_EVALUATION_PERSISTENCE_BLOCKED')
check('blocker', artifact.blocker === 'MLB_DATA_02O_VALUE_SCHEMA_FIT_BLOCKED')
check('publication', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === '29508243802a2298f026ca4af1be8626e0138333')
check('02n scope', artifact.publication?.MLB_02O_02N_COMMIT_SCOPE_CERTIFIED === 'YES')
check('baselines', artifact.baselines?.champion?.MLB_02O_CHAMPION_BASELINE === 'PASS' && artifact.baselines?.predictions?.MLB_02O_PREDICTION_BASELINE === 'PASS' && artifact.baselines?.market?.MLB_02O_MARKET_BASELINE === 'PASS')
check('value zero', artifact.baselines?.valueTable?.totalRows === 0 && artifact.baselines?.valueTable?.MLB_02O_VALUE_TABLE_BASELINE === 'PASS')
check('schema inventory', artifact.schemaInventory?.MLB_02O_VALUE_SCHEMA_INVENTORY === 'COMPLETE')
check('schema blocked', artifact.schemaFit?.MLB_02O_VALUE_SCHEMA_FIT === 'BLOCKED' && artifact.schemaFit?.MLB_DATA_02O_VALUE_SCHEMA_FIT_BLOCKED === true)
check('legacy odds blocker', artifact.schemaFit?.blockers?.some((row) => row.code === 'LEGACY_ODDS_SNAPSHOT_ID_REQUIRED'))
check('native linkage blocker', artifact.schemaFit?.blockers?.some((row) => row.code === 'NATIVE_MARKET_OBSERVATION_LINKAGE_MISSING'))
check('02n loaded', artifact.certified02N?.artifactVerdict === 'MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_CERTIFIED' && artifact.certified02N?.valueRowPlanCount === 386)
check('identity uniqueness', artifact.valueIdentity?.valueIdentityCount === 386 && artifact.valueIdentity?.duplicateValueIdentities === 0 && artifact.valueIdentity?.MLB_02O_VALUE_IDENTITY_UNIQUENESS === 'PASS')
check('no prewrite', artifact.prewriteClassification?.INSERT_ELIGIBLE === 0 && artifact.prewriteClassification?.VALUE_INSERT_CAP === 0)
check('zero execution', artifact.execution?.attempted === 0 && artifact.execution?.inserted === 0 && artifact.execution?.updates === 0 && artifact.execution?.deletes === 0)
check('no overwrite', artifact.readback?.finalValueRowCount === 0 && artifact.readback?.MLB_02O_VALUE_NO_OVERWRITE === 'PASS')
check('limitations', artifact.limitations?.MLB_02O_MODEL_LIMITATION_PRESERVED === 'PASS' && artifact.limitations?.MLB_02O_HISTORICAL_LIMITATION_PRESERVED === 'PASS')
check('boundaries', artifact.boundaries?.MLB_02O_OFFICIAL_PICK_WORK === 'NO' && artifact.boundaries?.MLB_02O_AUTO_RECOMMENDATION === 'NO' && artifact.boundaries?.MLB_02O_VALUE_BOARD_PUBLICATION === 'NO')
check('zero writes', artifact.boundaries?.MLB_02O_PROVIDER_CALLS === 0 && artifact.boundaries?.MLB_02O_MARKET_SOURCE_WRITES === 0 && artifact.boundaries?.MLB_02O_PREDICTION_WRITES === 0 && artifact.boundaries?.MLB_02O_PRODUCTION_DDL === 0)
check('readiness blocked', artifact.readiness?.MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_READY === 'NO' && artifact.readiness?.MLB_DATA_02Q_VALUE_BOARD_PREP_READY === 'NO')
check('audit', artifact.humanReadableAudit?.MLB_02O_HUMAN_READABLE_VALUE_PERSISTENCE_AUDIT === 'READY' && audit.includes('NOT OFFICIAL PICKS') && audit.includes('MLB_DATA_02O_VALUE_SCHEMA_FIT_BLOCKED'))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02o-current-moneyline-value-persistence-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02o-current-moneyline-value-persistence-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    blocker: artifact.blocker,
    valueRowPlanCount: artifact.certified02N.valueRowPlanCount,
    valueInserts: artifact.execution.inserted,
  }, null, 2))
}
