import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02m-r2-fresh-market-sample-acquisition.json'
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const normalizedRows = artifact.normalizedSample?.rows ?? []
const identities = new Set(normalizedRows.map((row) => row.observation_identity))
const sourcePayloadDigests = new Set(normalizedRows.map((row) => row.source_payload_digest).filter(Boolean))

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02M_R2_FRESH_MARKET_SAMPLE_ACQUISITION_CERTIFIED')
check('publication alignment', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === '13ae2002fd7c84b94ff0c531380082d503e1057f')
check('schema baseline', artifact.marketSchemaBaseline?.MLB_02M_R2_MARKET_SCHEMA_BASELINE === 'PASS')
check('market data baseline', artifact.marketDataBaseline?.marketPriceObservations === 0)
check('one call cap ready', artifact.providerCallBudget?.THE_ODDS_API_CALL_CAP === 1 && artifact.providerCallBudget?.callsBeforeAcquisition === 0)
check('provider call pass', artifact.providerAcquisition?.MLB_02M_R2_FRESH_PROVIDER_ACQUISITION === 'PASS' && artifact.providerAcquisition?.calls === 1)
check('raw response frozen', artifact.rawProviderResponseFreeze?.MLB_02M_R2_RAW_PROVIDER_RESPONSE_FROZEN === 'YES' && Boolean(artifact.rawProviderResponseFreeze?.source_response_sha256))
check('event inventory', artifact.providerEventInventory?.MLB_02M_R2_PROVIDER_EVENT_INVENTORY === 'COMPLETE')
check('team normalization', ['PASS', 'PARTIAL'].includes(artifact.teamNormalization?.MLB_02M_R2_TEAM_NORMALIZATION))
check('game pk crosswalk safe', ['PASS', 'PARTIAL'].includes(artifact.gamePkCrosswalk?.MLB_02M_R2_GAMEPK_CROSSWALK) && artifact.gamePkCrosswalk?.ambiguousEventCount === 0 && artifact.gamePkCrosswalk?.duplicateProviderEventCount === 0)
check('doubleheader guard', artifact.doubleheaderGuard?.MLB_02M_R2_DOUBLEHEADER_GUARD === 'PASS')
check('moneyline only', artifact.bookMarketNormalization?.MLB_02M_R2_MONEYLINE_ONLY === 'PASS')
check('book inventory', artifact.bookMarketNormalization?.MLB_02M_R2_BOOKMAKER_INVENTORY === 'COMPLETE')
check('side normalization', artifact.bookMarketNormalization?.MLB_02M_R2_SIDE_NORMALIZATION === 'PASS')
check('american odds', artifact.bookMarketNormalization?.MLB_02M_R2_AMERICAN_ODDS_VALIDATION === 'PASS')
check('sample build', artifact.normalizedSample?.MLB_02M_R2_NORMALIZED_SAMPLE_BUILD === 'PASS')
check('row validation', artifact.normalizedSample?.MLB_02M_R2_NORMALIZED_ROW_VALIDATION === 'PASS' && artifact.normalizedSample?.invalidRows === 0)
check('full rows committed', normalizedRows.length === artifact.normalizedSample?.normalizedRowCount && normalizedRows.length > 0)
check('payload digests', artifact.observationIdentity?.MLB_02M_R2_SOURCE_PAYLOAD_DIGESTS === 'PASS' && sourcePayloadDigests.size === normalizedRows.length)
check('observation identities unique', artifact.observationIdentity?.MLB_02M_R2_OBSERVATION_IDENTITY_BUILD === 'PASS' && identities.size === normalizedRows.length)
check('timestamp collision', artifact.observationIdentity?.MLB_02M_R2_TIMESTAMP_COLLISION_AUDIT === 'PASS')
check('two sided pairing', artifact.twoSidedMarketState?.MLB_02M_R2_TWO_SIDED_PAIRING === 'PASS')
check('sample policy', artifact.twoSidedMarketState?.MLB_02M_R2_PERSISTENCE_SAMPLE_POLICY === 'READY')
check('canonical order', artifact.sampleFreeze?.MLB_02M_R2_SAMPLE_CANONICAL_ORDER === 'PASS')
check('sample sha', Boolean(artifact.sampleFreeze?.MLB_02M_R2_NORMALIZED_SAMPLE_SHA256))
check('sample id', Boolean(artifact.sampleFreeze?.MLB_02M_R2_FROZEN_SAMPLE_ID))
check('row artifact committed', artifact.sampleFreeze?.MLB_02M_R2_FULL_ROW_LEVEL_SAMPLE_COMMITTED === 'YES')
check('aggregate audit', artifact.aggregateAudit?.MLB_02M_R2_SAMPLE_AGGREGATE_AUDIT === 'PASS')
check('price sanity', artifact.priceSanity?.MLB_02M_R2_PRICE_SANITY === 'PASS')
check('prediction baseline', artifact.predictionBaseline?.MLB_02M_R2_PREDICTION_BASELINE === 'PASS')
check('intersection', ['PASS', 'PARTIAL'].includes(artifact.predictionMarketIntersection?.MLB_02M_R2_PREDICTION_MARKET_INTERSECTION))
check('started guard', artifact.temporalValidity?.MLB_02M_R2_STARTED_GAME_GUARD === 'PASS')
check('mapping classification', artifact.prewriteClassification?.MLB_02M_R2_MAPPING_PREWRITE_CLASSIFICATION === 'PASS' && artifact.prewriteClassification?.mapping?.blockConflict === 0)
check('observation classification', artifact.prewriteClassification?.MLB_02M_R2_OBSERVATION_PREWRITE_CLASSIFICATION === 'PASS' && artifact.prewriteClassification?.observations?.blockConflict === 0)
check('caps ready', artifact.prewriteClassification?.MLB_02M_R2_FRESH_DML_CAPS_READY === 'YES')
check('idempotency', artifact.prewriteClassification?.MLB_02M_R2_IDEMPOTENCY_PROJECTED === 'PASS')
check('zero market dml', artifact.boundaries?.MLB_02M_R2_MARKET_DML === 0 && artifact.boundaries?.mappingWrites === 0 && artifact.boundaries?.observationWrites === 0)
check('zero value work', artifact.boundaries?.marketValueWrites === 0 && artifact.boundaries?.MLB_02M_R2_EDGE_WORK === 'NO' && artifact.boundaries?.MLB_02M_R2_EV_WORK === 'NO')
check('no official or value board', artifact.boundaries?.officialPicks === 0 && artifact.boundaries?.valueBoard === 'NO')
check('prediction mutations zero', artifact.boundaries?.MLB_02M_R2_PREDICTION_MUTATIONS === 0)
check('foundation preserved', artifact.boundaries?.MLB_02M_R2_FOUNDATION_PRESERVED === 'PASS')
check('provider accounting', artifact.providerAccounting?.MLB_02M_R2_PROVIDER_CALL_ACCOUNTING === 'PASS' && artifact.providerAccounting?.theOddsApiCalls === 1 && artifact.providerAccounting?.sportsDataIoCalls === 0 && artifact.providerAccounting?.mlbOfficialCalls === 0)
check('r3 ready', artifact.readiness?.MLB_DATA_02M_R3_FRESH_MARKET_SAMPLE_PERSISTENCE_READY === 'YES')
check('02n blocked', artifact.readiness?.MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_READY === 'NO')

if (errors.length) {
  console.error(JSON.stringify({
    validator: 'mlb-data-02m-r2-fresh-market-sample-acquisition-validate',
    status: 'FAIL',
    errors,
  }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02m-r2-fresh-market-sample-acquisition-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    sampleId: artifact.sampleFreeze.MLB_02M_R2_FROZEN_SAMPLE_ID,
    normalizedRows: artifact.normalizedSample.normalizedRowCount,
    completeTwoSidedMarkets: artifact.twoSidedMarketState.completeTwoSidedMarkets,
    mappingInsertCap: artifact.prewriteClassification.futureDmlCaps.mappingInsertCap,
    observationInsertCap: artifact.prewriteClassification.futureDmlCaps.observationInsertCap,
  }, null, 2))
}
