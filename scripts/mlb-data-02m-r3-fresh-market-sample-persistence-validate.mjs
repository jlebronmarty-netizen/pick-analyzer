import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02m-r3-fresh-market-sample-persistence.json', 'utf8'))
const audit = fs.readFileSync('docs/CERTIFICATION/mlb-data-02m-r3-current-moneyline-market-persistence-audit.md', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02M_R3_FRESH_MARKET_SAMPLE_PERSISTENCE_CERTIFIED')
check('publication', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === '09c2605e75a3341971f80f9cf120fd400101d194')
check('schema', artifact.schema?.MLB_02M_R3_MARKET_TABLE === 'PASS' && artifact.schema?.MLB_02M_R3_MARKET_SCHEMA_CONTRACT === 'PASS')
check('sample id', artifact.frozenSample?.sampleId === 'MLB_MONEYLINE_MARKET_SAMPLE_2026-09-05_215501709Z_b88656b393ee')
check('source sha', artifact.frozenSample?.sourceResponseSha256 === '6cd70d8e720a4efb1b0eb00dcec430dd48546ce388aa251eeb15261c5a7f550a')
check('sample sha', artifact.frozenSample?.normalizedSampleSha256 === 'b88656b393eec8dc08d6a57ea37316497a8e2ca6bafde517c2e0806bc1703730')
check('sample readback', artifact.frozenSample?.MLB_02M_R3_FROZEN_SAMPLE_READBACK === 'PASS')
check('row parity', artifact.frozenSample?.MLB_02M_R3_FROZEN_ROW_PARITY === 'PASS' && artifact.frozenSample?.rowCount === 492)
check('source provenance', artifact.frozenSample?.MLB_02M_R3_SOURCE_PROVENANCE_PARITY === 'PASS')
check('pre mapping', artifact.prewriteClassification?.MLB_02M_R3_MAPPING_PREWRITE_CLASSIFICATION === 'PASS' && artifact.prewriteClassification?.mapping?.blockConflict === 0)
check('pre observations', artifact.prewriteClassification?.MLB_02M_R3_OBSERVATION_PREWRITE_CLASSIFICATION === 'PASS' && artifact.prewriteClassification?.observations?.blockConflict === 0)
check('caps', artifact.prewriteClassification?.MLB_02M_R3_DML_CAPS_READY === 'YES' && artifact.prewriteClassification?.actualMappingInsertCap <= 29 && artifact.prewriteClassification?.actualObservationInsertCap <= 492)
check('mapping persistence', artifact.execution?.MLB_02M_R3_MAPPING_PERSISTENCE === 'PASS' && artifact.execution?.mapping?.inserted <= 29 && artifact.execution?.mapping?.failures === 0)
check('observation persistence', artifact.execution?.MLB_02M_R3_OBSERVATION_PERSISTENCE === 'PASS' && artifact.execution?.observations?.inserted <= 492 && artifact.execution?.observations?.failures === 0)
check('dml accounting', artifact.execution?.MLB_02M_R3_MARKET_DML_ACCOUNTING === 'PASS')
check('observation row parity', artifact.readback?.MLB_02M_R3_OBSERVATION_ROW_PARITY === 'PASS' && artifact.readback?.finalObservationCount === 492)
check('mapping row parity', artifact.readback?.MLB_02M_R3_MAPPING_ROW_PARITY === 'PASS' && artifact.readback?.finalMappingCount === 29)
check('payload readback', artifact.readback?.MLB_02M_R3_OBSERVATION_PAYLOAD_READBACK === 'PASS' && artifact.readback?.payloadMismatches === 0)
check('coverage', artifact.readback?.MLB_02M_R3_GAMEPK_COVERAGE === 'PASS' && artifact.readback?.MLB_02M_R3_BOOK_COVERAGE === 'PASS')
check('pairs', artifact.readback?.MLB_02M_R3_TWO_SIDED_PAIR_READBACK === 'PASS' && artifact.readback?.twoSidedPairs === 246)
check('price', artifact.readback?.MLB_02M_R3_PRICE_READBACK === 'PASS')
check('identity', artifact.readback?.MLB_02M_R3_MARKET_IDENTITY_UNIQUENESS === 'PASS')
check('immutability', artifact.immutability?.MLB_02M_R3_MARKET_NO_OVERWRITE === 'PASS' && artifact.immutability?.MLB_02M_R3_MARKET_IMMUTABILITY === 'PASS')
check('idempotency', artifact.idempotency?.MLB_02M_R3_MARKET_IDEMPOTENCY === 'PASS')
check('intersection', artifact.predictionIntersection?.MLB_02M_R3_PREDICTION_MARKET_INTERSECTION === 'PASS')
check('future value cap', artifact.predictionIntersection?.MLB_02M_R3_FUTURE_VALUE_GAME_CAP_READY === 'YES')
check('temporal', artifact.predictionIntersection?.MLB_02M_R3_TEMPORAL_JOIN_READINESS === 'PASS' && artifact.predictionIntersection?.MLB_02M_R3_STARTED_GAME_GUARD === 'PASS')
check('math inputs', artifact.predictionIntersection?.MLB_02M_R3_IMPLIED_PROBABILITY_INPUT_READY === 'YES' && artifact.predictionIntersection?.MLB_02M_R3_NOVIG_INPUT_READY === 'YES')
check('prediction preservation', artifact.preservation?.MLB_02M_R3_PREDICTION_PRESERVATION === 'PASS')
check('champion', artifact.preservation?.MLB_02M_R3_CHAMPION_PRESERVED === 'PASS')
check('foundation', artifact.preservation?.MLB_02M_R3_DATA_FOUNDATION_PRESERVED === 'PASS')
check('providers zero', artifact.boundaries?.MLB_02M_R3_PROVIDER_CALLS === 0)
check('no value', artifact.boundaries?.MLB_02M_R3_EDGE_WORK === 'NO' && artifact.boundaries?.MLB_02M_R3_EV_WORK === 'NO' && artifact.boundaries?.MLB_02M_R3_MARKET_VALUE_WRITES === 0)
check('official/value board off', artifact.boundaries?.officialPicksCreated === 0 && artifact.boundaries?.MLB_02M_R3_VALUE_BOARD_WORK === 'NO')
check('dml boundary', artifact.boundaries?.MLB_02M_R3_PRODUCTION_DML_BOUNDARY === 'PASS' && artifact.boundaries?.predictionWrites === 0 && artifact.boundaries?.rawWrites === 0 && artifact.boundaries?.featureWrites === 0 && artifact.boundaries?.modelWrites === 0)
check('ddl zero', artifact.boundaries?.MLB_02M_R3_PRODUCTION_DDL === 0)
check('automation off', artifact.boundaries?.MLB_02M_R3_AUTOMATION_STATE === 'OFF')
check('02n ready', artifact.readiness?.MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_READY === 'YES')
const auditHeader = audit.split('\n').find((line) => line.startsWith('| game_pk |')) ?? ''
const auditColumns = auditHeader.split('|').map((column) => column.trim().toLowerCase()).filter(Boolean)
const forbiddenAuditColumns = ['edge', 'ev', 'official pick', 'value score']
check('human audit', artifact.humanReadableAudit?.MLB_02M_R3_HUMAN_READABLE_AUDIT === 'READY' && audit.includes('Current Moneyline Market Persistence Audit') && forbiddenAuditColumns.every((column) => !auditColumns.includes(column)))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02m-r3-fresh-market-sample-persistence-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02m-r3-fresh-market-sample-persistence-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    mappingInserted: artifact.execution.mapping.inserted,
    observationInserted: artifact.execution.observations.inserted,
    finalObservationCount: artifact.readback.finalObservationCount,
    valuePrepReady: artifact.readiness.MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_READY,
  }, null, 2))
}
