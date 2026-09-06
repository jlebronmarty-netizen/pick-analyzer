import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02o-r3-native-value-persistence.json', 'utf8'))
const audit = fs.readFileSync('docs/CERTIFICATION/mlb-data-02o-r3-current-moneyline-native-value-persistence-audit.md', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02O_R3_NATIVE_VALUE_PERSISTENCE_CERTIFIED')
check('publication alignment', artifact.repository.localHead === 'd3cafbdf353a6198b2b09354f7330d9affc717cd' && artifact.repository.originMain === artifact.repository.localHead && artifact.production.PRODUCTION_ALIGNMENT === 'PASS')
check('baselines', artifact.baselines.preCounts.nativeValue === 0 && artifact.baselines.preCounts.legacyValue === 0 && artifact.baselines.preCounts.predictions === 24 && artifact.baselines.preCounts.marketObservations === 492 && artifact.baselines.preCounts.marketMappings === 29)
check('plan', artifact.plan.rows === 386 && artifact.plan.eligibleGames === 21 && artifact.plan.bookLevelPairs === 193 && artifact.plan.valueIdentityCount === 386 && artifact.plan.duplicateValueIdentities === 0)
check('source math identity', artifact.plan.MLB_02O_R3_SOURCE_LINKAGE === 'PASS' && artifact.plan.MLB_02O_R3_VALUE_MATH_PARITY === 'PASS' && artifact.plan.MLB_02O_R3_VALUE_IDENTITY_REBUILD === 'PASS' && artifact.plan.MLB_02O_R3_VALUE_DIGEST_PARITY === 'PASS')
check('prewrite', artifact.prewriteClassification.INSERT_ELIGIBLE === 386 && artifact.prewriteClassification.REUSE_NO_OP === 0 && artifact.prewriteClassification.BLOCK_CONFLICT === 0 && artifact.prewriteClassification.VALUE_INSERT_CAP === 386)
check('execution', artifact.execution.attempted === 386 && artifact.execution.inserted === 386 && artifact.execution.reused === 0 && artifact.execution.conflicts === 0 && artifact.execution.failures === 0 && artifact.execution.updates === 0 && artifact.execution.deletes === 0)
check('readback', artifact.readback.finalNativeValueRowCount === 386 && artifact.readback.MLB_02O_R3_VALUE_ROW_PARITY === 'PASS' && artifact.readback.MLB_02O_R3_VALUE_PAYLOAD_READBACK === 'PASS' && artifact.readback.MLB_02O_R3_NUMERIC_PARITY === 'PASS')
check('distribution', artifact.distribution.positiveEdgeCount === 193 && artifact.distribution.positiveEvCount === 137 && artifact.distribution.MLB_02O_R3_TOP_ANALYTICAL_CANDIDATE === 'PASS')
check('immutability', artifact.immutability.MLB_02O_R3_VALUE_NO_OVERWRITE === 'PASS' && artifact.immutability.MLB_02O_R3_VALUE_IMMUTABILITY === 'PASS_USER_SQL_EVIDENCE_R2A')
check('idempotency', artifact.idempotency.INSERT_ELIGIBLE === 0 && artifact.idempotency.REUSE_NO_OP === 386 && artifact.idempotency.BLOCK_CONFLICT === 0 && artifact.idempotency.MLB_02O_R3_VALUE_IDEMPOTENCY === 'PASS')
check('limitations', artifact.limitations.MLB_02O_R3_MODEL_LIMITATION === 'PASS' && artifact.limitations.MLB_02O_R3_HISTORICAL_LIMITATION === 'PASS' && artifact.limitations.profitabilityCertified === false)
check('boundaries', artifact.boundaries.officialPicks === 0 && artifact.boundaries.valueBoardPublication === 'NO' && artifact.boundaries.providerCalls === 0 && artifact.boundaries.marketSourceWrites === 0 && artifact.boundaries.predictionWrites === 0 && artifact.boundaries.productionDdl === 0 && artifact.boundaries.automation === 'OFF')
check('readiness', artifact.readiness.MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_READY === 'YES' && artifact.readiness.MLB_DATA_02Q_VALUE_BOARD_PREP_READY === 'YES')
check('audit', audit.includes('ANALYTICAL ONLY') && audit.includes('not Official Picks') && audit.includes('not historically profitability-certified'))
check('no secret values', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test([JSON.stringify(artifact), audit].join('\n')))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02o-r3-native-value-persistence-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02o-r3-native-value-persistence-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    inserted: artifact.execution.inserted,
    finalNativeValueRowCount: artifact.readback.finalNativeValueRowCount,
    idempotency: artifact.idempotency.MLB_02O_R3_VALUE_IDEMPOTENCY,
  }, null, 2))
}
