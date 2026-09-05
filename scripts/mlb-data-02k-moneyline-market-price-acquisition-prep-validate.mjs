import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02k-moneyline-market-price-acquisition-prep.json', 'utf8'))
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', ['MLB_DATA_02K_MONEYLINE_MARKET_PRICE_ACQUISITION_PREP_CERTIFIED', 'MLB_DATA_02K_MONEYLINE_MARKET_PRICE_ACQUISITION_PREP_PARTIAL'].includes(artifact.certificationVerdict))
check('publication', artifact.publication?.MLB_02K_PREPUBLISH_STATE === 'PASS' && artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS')
check('r3 scope', artifact.publication?.MLB_02K_R3_COMMIT_SCOPE_CERTIFIED === 'YES')
check('prediction baseline', artifact.predictionBaseline?.MLB_02K_PREDICTION_BASELINE === 'PASS' && artifact.predictionBaseline?.persistedFrozenPredictionCount === 24)
check('market zero', artifact.predictionBaseline?.MLB_02K_MARKET_ZERO_BASELINE === 'PASS' && artifact.predictionBaseline?.marketValueRows === 0)
check('provider role', artifact.providerContract?.MLB_02K_THE_ODDS_API_RESPONSIBILITY === 'PASS' && artifact.providerContract?.role === 'MARKET_PRICING_ONLY')
check('moneyline contract', artifact.providerContract?.MLB_02K_PROVIDER_MONEYLINE_CONTRACT === 'READY' && artifact.providerContract?.marketFields?.includes('outcomes.price'))
check('moneyline only', artifact.providerContract?.MLB_02K_MONEYLINE_ONLY_SCOPE === 'PASS' && artifact.providerContract?.query?.markets === 'h2h')
check('crosswalk', artifact.eventCrosswalk?.MLB_02K_GAMEPK_CROSSWALK_CONTRACT === 'PASS' && artifact.eventCrosswalk?.MLB_02K_TEAM_NORMALIZATION_CONTRACT === 'PASS')
check('doubleheader', artifact.eventCrosswalk?.MLB_02K_DOUBLEHEADER_CROSSWALK_GUARD === 'PASS')
check('bookmaker', artifact.bookmakerContract?.MLB_02K_BOOKMAKER_IDENTITY_CONTRACT === 'PASS' && artifact.bookmakerContract?.MLB_02K_BOOK_SELECTION_POLICY === 'READY')
check('american odds', artifact.normalization?.MLB_02K_AMERICAN_ODDS_VALIDATION === 'PASS')
check('implied', artifact.normalization?.MLB_02K_IMPLIED_PROBABILITY_FORMULA === 'PASS' && artifact.normalization?.MLB_02K_IMPLIED_PROBABILITY_DRY_VALIDATION === 'PASS')
check('two sided', artifact.normalization?.MLB_02K_TWO_SIDED_MARKET_CONTRACT === 'PASS')
check('novig', artifact.normalization?.MLB_02K_NOVIG_METHOD_CONTRACT === 'PASS' && artifact.normalization?.MLB_02K_NOVIG_DRY_VALIDATION === 'PASS')
check('freshness', artifact.freshness?.MLB_02K_PRICE_TIMESTAMP_CONTRACT === 'PASS' && artifact.freshness?.MLB_02K_STALE_PRICE_POLICY === 'READY' && artifact.freshness?.MLB_02K_STARTED_GAME_MARKET_GUARD === 'PASS')
check('identity', artifact.marketObservationIdentity?.MLB_02K_MARKET_OBSERVATION_IDENTITY === 'READY' && artifact.marketObservationIdentity?.MLB_02K_MARKET_IDEMPOTENCY_CONTRACT === 'PASS')
check('schema inventory', artifact.schemaInventory?.MLB_02K_MARKET_SCHEMA_INVENTORY === 'COMPLETE' && artifact.schemaInventory?.MLB_02K_MARKET_CROSSWALK_SCHEMA_FIT === 'PASS')
check('join', artifact.predictionMarketJoin?.MLB_02K_PREDICTION_MARKET_JOIN_CONTRACT === 'PASS' && artifact.predictionMarketJoin?.MLB_02K_TEMPORAL_COMPARISON_CONTRACT === 'PASS')
check('historical limitation', artifact.predictionMarketJoin?.MLB_02K_HISTORICAL_PRICE_LIMITATION === 'DOCUMENTED')
check('no value', artifact.boundaries?.MLB_02K_EDGE_WORK === 'NO' && artifact.boundaries?.MLB_02K_EV_WORK === 'NO')
check('no official/value board', artifact.boundaries?.MLB_02K_OFFICIAL_PICK_WORK === 'NO' && artifact.boundaries?.MLB_02K_VALUE_BOARD_WORK === 'NO')
check('zero market dml', artifact.boundaries?.MLB_02K_MARKET_DML === 0)
check('zero other mutations', artifact.boundaries?.MLB_02K_OTHER_PRODUCTION_MUTATIONS === 0 && artifact.boundaries?.productionDdl === 0)
check('preservation', artifact.boundaries?.MLB_02K_CHAMPION_PRESERVED === 'PASS' && artifact.boundaries?.MLB_02K_PREDICTIONS_PRESERVED === 'PASS')
check('provider accounting', artifact.providerAccounting?.MLB_02K_PROVIDER_CALL_ACCOUNTING === 'PASS' && artifact.providerAccounting?.ballDontLieCalls === 0 && artifact.providerAccounting?.sportsDataIoCalls === 0)
check('partial reason', artifact.certificationVerdict !== 'MLB_DATA_02K_MONEYLINE_MARKET_PRICE_ACQUISITION_PREP_PARTIAL' || Boolean(artifact.nextReadiness?.blocker))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02k-moneyline-market-price-acquisition-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02k-moneyline-market-price-acquisition-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    providerEvents: artifact.providerAcquisition.providerEventCount,
    normalizedRows: artifact.normalization.normalizedPriceRowCount,
    marketPersistenceReady: artifact.nextReadiness.MLB_DATA_02L_CURRENT_MONEYLINE_MARKET_PERSISTENCE_READY,
  }, null, 2))
}
