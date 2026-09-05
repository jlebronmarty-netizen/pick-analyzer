import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation-prep.json', 'utf8'))
const audit = fs.readFileSync('docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation-audit.md', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict', artifact.certificationVerdict === 'MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_CERTIFIED')
check('publication', artifact.publication?.PRODUCTION_ALIGNMENT === 'PASS' && artifact.publication?.productionCommit === '55589982cd56dd767f72b967d704785a628700db')
check('r3 scope', artifact.publication?.MLB_02N_R3_COMMIT_SCOPE_CERTIFIED === 'YES')
check('champion', artifact.baselines?.champion?.MLB_02N_CHAMPION_BASELINE === 'PASS' && artifact.baselines?.champion?.modelVersion === 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1')
check('predictions', artifact.baselines?.predictions?.MLB_02N_PREDICTION_BASELINE === 'PASS' && artifact.baselines?.predictions?.count === 24 && artifact.baselines?.predictions?.duplicateDeterministicIdentities === 0)
check('market', artifact.baselines?.market?.MLB_02N_MARKET_BASELINE === 'PASS' && artifact.baselines?.market?.observations === 492 && artifact.baselines?.market?.mappings === 29 && artifact.baselines?.market?.completeTwoSidedMarketStates === 246)
check('market value zero', artifact.baselines?.marketValue?.MLB_02N_MARKET_VALUE_ZERO_BASELINE === 'PASS' && artifact.baselines?.marketValue?.rows === 0)
check('intersection', artifact.intersection?.MLB_02N_PREDICTION_MARKET_INTERSECTION === 'PASS' && artifact.intersection?.counts?.MATCHED_TWO_SIDED_MARKET === 21 && artifact.intersection?.counts?.NO_PROVIDER_EVENT === 2 && artifact.intersection?.counts?.STARTED_GAME === 1)
check('temporal freshness', artifact.intersection?.MLB_02N_STARTED_GAME_EXCLUSION === 'PASS' && artifact.intersection?.MLB_02N_TEMPORAL_VALIDITY === 'PASS' && artifact.intersection?.MLB_02N_MARKET_FRESHNESS_AUDIT === 'PASS')
check('pairing', artifact.pairing?.MLB_02N_TWO_SIDED_PAIR_REBUILD === 'PASS' && artifact.pairing?.MLB_02N_PAIR_INTEGRITY === 'PASS' && artifact.pairing?.evaluatedBookLevelPairs > 0 && artifact.pairing?.candidateRows === artifact.pairing?.evaluatedBookLevelPairs * 2)
check('implied', artifact.impliedProbability?.MLB_02N_IMPLIED_PROBABILITY_FORMULA === 'PASS' && artifact.impliedProbability?.MLB_02N_IMPLIED_PROBABILITY_CALCULATION === 'PASS')
check('overround', artifact.overround?.MLB_02N_OVERROUND_AUDIT === 'PASS' && artifact.overround?.count === artifact.pairing?.evaluatedBookLevelPairs)
check('novig', artifact.noVig?.MLB_02N_NOVIG_CALCULATION === 'PASS' && artifact.noVig?.MLB_02N_NOVIG_SANITY === 'PASS' && artifact.noVig?.toleranceFailures === 0)
check('model side', artifact.modelMarket?.MLB_02N_MODEL_PROBABILITY_READBACK === 'PASS' && artifact.modelMarket?.MLB_02N_MODEL_MARKET_SIDE_ALIGNMENT === 'PASS')
check('edge', artifact.edge?.MLB_02N_EDGE_FORMULA === 'PASS' && artifact.edge?.MLB_02N_EDGE_CALCULATION === 'PASS' && artifact.edge?.MLB_02N_EDGE_SYMMETRY === 'PASS' && artifact.edge?.candidateRows === artifact.pairing?.candidateRows)
check('ev', artifact.expectedValue?.MLB_02N_DECIMAL_ODDS_CONVERSION === 'PASS' && artifact.expectedValue?.MLB_02N_UNIT_EV_CALCULATION === 'PASS' && artifact.expectedValue?.MLB_02N_EV_SANITY === 'PASS')
check('best price', artifact.bookSelection?.MLB_02N_BEST_PRICE_IDENTIFICATION === 'PASS' && artifact.bookSelection?.MLB_02N_BEST_PRICE_NOVIG_SEPARATION === 'PASS')
check('consensus', artifact.consensus?.MLB_02N_CONSENSUS_METHOD === 'READY' && artifact.consensus?.MLB_02N_CONSENSUS_MARKET_CALCULATION === 'PASS' && artifact.consensus?.MLB_02N_CONSENSUS_EDGE_CALCULATION === 'PASS')
check('dispersion', artifact.dispersion?.MLB_02N_MARKET_DISPERSION_AUDIT === 'PASS' && artifact.dispersion?.MLB_02N_MARKET_DISAGREEMENT_POLICY === 'READY')
check('support contracts', artifact.supportAndValueContract?.MLB_02N_PROBABILITY_CONFIDENCE_SEPARATION === 'PASS' && artifact.supportAndValueContract?.MLB_02N_MODEL_SUPPORT_CONTEXT === 'READY' && artifact.supportAndValueContract?.MLB_02N_VALUE_COMPONENT_CONTRACT === 'READY')
check('ranking', artifact.supportAndValueContract?.MLB_02N_VALUE_CANDIDATE_RANKING === 'READY' && artifact.valueCandidateRanking?.compactGameSideRanking?.length === 42)
check('exclusions', artifact.exclusions?.MLB_02N_EXCLUSION_EXPLANATIONS === 'PASS' && artifact.exclusions?.rows?.length === 3)
check('limitations', artifact.limitations?.extremeOdds?.MLB_02N_EXTREME_ODDS_AUDIT === 'PASS' && artifact.limitations?.MLB_02N_HISTORICAL_VALUE_LIMITATION === 'PASS' && artifact.limitations?.MLB_02N_MODEL_LIMITATION_DOCUMENTED === 'YES')
check('future contracts', artifact.futureContracts?.MLB_02N_VALUE_IDENTITY_CONTRACT === 'READY' && artifact.futureContracts?.MLB_02N_VALUE_IMMUTABILITY_CONTRACT === 'PASS' && artifact.futureContracts?.MLB_02N_VALUE_PAYLOAD_CONTRACT === 'READY')
check('official/value boundaries', artifact.boundaries?.MLB_02N_OFFICIAL_PICK_WORK === 'NO' && artifact.boundaries?.MLB_02N_VALUE_BOARD_PUBLICATION === 'NO')
check('zero dml ddl providers', artifact.boundaries?.MLB_02N_VALUE_DML === 0 && artifact.boundaries?.MLB_02N_OTHER_PRODUCTION_DML === 0 && artifact.boundaries?.MLB_02N_PRODUCTION_DDL === 0 && artifact.boundaries?.MLB_02N_PROVIDER_CALLS === 0)
check('automation', artifact.boundaries?.MLB_02N_AUTOMATION_STATE === 'OFF' && artifact.boundaries?.cronChanges === 0)
check('readiness', artifact.readiness?.MLB_DATA_02O_CURRENT_MONEYLINE_VALUE_EVALUATION_PERSISTENCE_READY === 'YES' && artifact.readiness?.MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_READY === 'YES')
check('human audit', artifact.humanReadableAudit?.MLB_02N_HUMAN_READABLE_VALUE_AUDIT === 'READY' && audit.includes('ANALYTICAL ONLY. NOT OFFICIAL PICKS.') && audit.includes('| rank | game_pk | teams | side | model p |'))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-02n-current-moneyline-value-evaluation-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-02n-current-moneyline-value-evaluation-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    eligiblePregamePredictions: artifact.intersection.eligiblePregamePredictions,
    evaluatedBookLevelPairs: artifact.pairing.evaluatedBookLevelPairs,
    candidateRows: artifact.edge.candidateRows,
    valuePersistenceReady: artifact.readiness.MLB_DATA_02O_CURRENT_MONEYLINE_VALUE_EVALUATION_PERSISTENCE_READY,
  }, null, 2))
}
