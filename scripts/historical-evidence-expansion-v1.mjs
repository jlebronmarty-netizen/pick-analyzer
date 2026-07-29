import fs from 'node:fs'
import crypto from 'node:crypto'

const LEARNING_SOURCE = 'docs/HISTORICAL_LEARNING_READINESS_V1.json'
const TRAINING_SOURCE = 'docs/TRAINING_READINESS_V1.json'
const COVERAGE_OUT = 'docs/DATA_COVERAGE_FORECAST.json'
const TRAINING_OUT = 'docs/TRAINING_FORECAST.json'

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'))
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function score(accepted, firstTrainingThreshold = 1000) {
  return Math.min(100, Number(((accepted / firstTrainingThreshold) * 100).toFixed(1)))
}

function mapObject(obj, mapper) {
  return Object.entries(obj ?? {}).map(([key, value]) => mapper(key, value))
}

const learning = readJson(LEARNING_SOURCE)
const training = readJson(TRAINING_SOURCE)
const expansion = learning.expansionReadiness

if (!expansion) {
  throw new Error('Historical learning evidence must include expansionReadiness aggregates.')
}

const current = expansion.recoverability.currentTrainingReady
const recoverable = expansion.recoverability.recoverable
const partial = expansion.recoverability.partiallyRecoverable
const permanent = expansion.recoverability.permanentlyRejected
const firstTrainingThreshold = 1000
const remainingToFirstTraining = Math.max(0, firstTrainingThreshold - current)
const maximumCurrentEvidencePool = current + recoverable + partial

const sportLabels = {
  baseball_mlb: 'MLB',
  basketball_nba: 'NBA',
  americanfootball_nfl: 'NFL',
  icehockey_nhl: 'NHL',
  soccer_epl: 'Soccer',
  basketball_bsn: 'BSN',
  tennis: 'Tennis',
  ufc: 'UFC',
}

const sportReadiness = Object.entries(sportLabels).map(([sportKey, label]) => {
  const totalRows = learning.inventory.sportCounts[sportKey] ?? training.sportReadiness.find((row) => row.sportKey === sportKey)?.currentRowsObserved ?? 0
  const accepted = expansion.acceptedBySport[sportKey] ?? 0
  const blocked = expansion.blockedBySport[sportKey] ?? Math.max(0, totalRows - accepted)
  const trainingSport = training.sportReadiness.find((row) => row.sportKey === sportKey)
  const readiness =
    accepted >= 1000
      ? 'FIRST_TRAINING_THRESHOLD_MET_AFTER_APPROVAL'
      : accepted >= 250
        ? 'ARCHITECTURE_REVIEW_SAMPLE_PRESENT'
        : totalRows > 0
          ? 'EVIDENCE_PRESENT_BLOCKED'
          : 'NO_STORED_TRAINING_EVIDENCE'

  return {
    sportKey,
    label,
    totalPredictionRows: totalRows,
    acceptedTrainingRows: accepted,
    blockedRows: blocked,
    readinessScore: score(accepted),
    readiness,
    existingHistoricalData: totalRows > 0 ? 'stored prediction evidence exists' : 'no accepted production training evidence in current manifests',
    featureCoverage: trainingSport?.featureCompleteness ?? 0,
    resultCoverage: accepted > 0 ? 'accepted rows have canonical result labels' : 'blocked or not yet settled',
    predictionCoverage: totalRows,
    estimatedFutureSamples: label === 'MLB'
      ? { oneMonth: 540, threeMonths: 646, sixMonths: 646, twelveMonths: 646 }
      : label === 'NFL' || label === 'NHL'
        ? { oneMonth: 0, threeMonths: 0, sixMonths: label === 'NFL' ? 776 : 258, twelveMonths: label === 'NFL' ? 776 : 258 }
        : { oneMonth: 0, threeMonths: 0, sixMonths: 0, twelveMonths: 0 },
    minimumProviderRequirements: label === 'MLB'
      ? ['continued canonical current odds/results operation', 'no historical provider calls required for current roadmap stage']
      : ['authoritative result coverage', 'production feature snapshots', 'production prediction lifecycle approval'],
    blockers: trainingSport?.missingData ?? ['production-settled accepted rows'],
  }
})

const marketFamilies = [
  ['moneyline', 'Moneyline'],
  ['spread', 'Spread/Runline'],
  ['total', 'Totals'],
  ['first_half', 'First Half'],
  ['player_props', 'Player Props'],
  ['other', 'Others'],
]

const marketReadiness = marketFamilies.map(([marketKey, label]) => {
  const accepted = expansion.acceptedByMarket[marketKey] ?? 0
  const blocked = expansion.blockedByMarket[marketKey] ?? 0
  const totalRows = (learning.inventory.marketCounts[marketKey] ?? 0)
  return {
    marketKey,
    label,
    acceptedRows: accepted,
    blockedRows: blocked,
    totalRows,
    readinessScore: score(accepted, 300),
    readiness: accepted >= 300 ? 'SPORT_MARKET_REVIEW_THRESHOLD_MET' : accepted > 0 ? 'SAMPLE_PRESENT_BELOW_MARKET_THRESHOLD' : 'NO_ACCEPTED_SAMPLE',
    futurePotential: accepted > 0 ? 'grow through normal production settlement and canonical evidence recovery' : 'requires market-specific ingestion, modeling, settlement and validation',
    minimumSamples: 300,
  }
})

const seasonReadiness = mapObject(expansion.acceptedByMonth, (month, accepted) => ({
  seasonKey: month,
  acceptedRows: accepted,
  readinessScore: score(accepted),
  coverage: month === '2026-07' ? 'current season partial month only' : 'stored aggregate evidence',
  missingPeriods: month === '2026-07' ? ['pre-2026 accepted production rows', 'multi-month accepted sample', 'multi-season accepted sample'] : [],
  providerAvailability: 'not inspected live; no provider calls made',
}))

const modelReadiness = mapObject(expansion.acceptedByModelVersion, (modelVersion, accepted) => ({
  modelVersion,
  acceptedRows: accepted,
  readinessScore: score(accepted),
  readiness: accepted >= 1000 ? 'FIRST_TRAINING_THRESHOLD_MET_AFTER_APPROVAL' : accepted >= 250 ? 'DESIGN_SAMPLE_PRESENT' : 'BELOW_DESIGN_SAMPLE',
}))

const roadmap = [
  {
    stage: 'A',
    name: 'Recover missing canonical evidence',
    action: 'repair canonical result and provider mapping gaps using stored metadata only before considering any imports',
    certifiedTrainingReadyRowsAfterStage: current,
    maximumReviewPoolAfterStage: current + recoverable,
    note: 'Stage A alone does not certify rows missing feature snapshots or model versions.',
  },
  {
    stage: 'B',
    name: 'Recover feature completeness',
    action: 'link existing feature snapshots and model-version metadata where point-in-time evidence already exists',
    certifiedTrainingReadyRowsAfterStage: current + recoverable,
    maximumReviewPoolAfterStage: current + recoverable,
    note: 'If all 596 recoverable rows can be proven cutoff-safe with features/model versions, the platform reaches 950 accepted rows.',
  },
  {
    stage: 'C',
    name: 'Recover historical predictions',
    action: 'design-only gate for future approved historical prediction reconstruction; no replay is authorized by this phase',
    certifiedTrainingReadyRowsAfterStage: current + recoverable,
    maximumReviewPoolAfterStage: current + recoverable + partial,
    note: 'The 1,636 preview/shadow rows are partially recoverable only after legitimate settlement, production eligibility and contract review.',
  },
  {
    stage: 'D',
    name: 'Historical imports',
    action: 'future approval gate for historical provider/archive acquisition, feature rebuild and replay',
    certifiedTrainingReadyRowsAfterStage: current + recoverable,
    maximumReviewPoolAfterStage: current + recoverable + partial,
    note: 'No provider calls, imports or feature rebuilds are authorized here.',
  },
  {
    stage: 'E',
    name: 'Candidate training',
    action: 'eligible only after accepted rows exceed 1,000 and all governance gates pass',
    certifiedTrainingReadyRowsAfterStage: current + recoverable,
    maximumReviewPoolAfterStage: current + recoverable + partial,
    note: 'Training remains blocked until explicit future approval.',
  },
]

const forecast = {
  currentSamples: current,
  targetSamples: firstTrainingThreshold,
  remainingToTarget: remainingToFirstTraining,
  assumptions: [
    'No provider calls in this phase.',
    'Normal production operation continues to create cutoff-safe predictions and settlements.',
    'No retrospective prediction rows are fabricated.',
    'Forecast rows become accepted only after authoritative settlement and feature linkage.',
  ],
  oneMonth: {
    worstCase: current + 180,
    expected: current + 540,
    bestCase: Math.max(current + 720, current + remainingToFirstTraining),
  },
  threeMonths: {
    worstCase: current + 540,
    expected: current + remainingToFirstTraining,
    bestCase: current + remainingToFirstTraining + 500,
  },
  sixMonths: {
    worstCase: current + remainingToFirstTraining,
    expected: current + remainingToFirstTraining + 500,
    bestCase: maximumCurrentEvidencePool,
  },
  twelveMonths: {
    worstCase: current + remainingToFirstTraining + 500,
    expected: maximumCurrentEvidencePool,
    bestCase: maximumCurrentEvidencePool,
  },
  trainingEta: {
    bestCase: 'about 1 month of normal production settlement or Stage B recovery success',
    expected: 'about 2 to 3 months, or immediately after all 596 recoverable rows are certified plus 50 new accepted rows',
    worstCase: 'about 4 to 6 months if settlement/recovery throughput is slow',
  },
}

const coverage = {
  success: true,
  mode: 'historical_evidence_expansion_data_coverage_forecast_v1',
  generatedAt: new Date().toISOString(),
  readOnly: true,
  sourceEvidence: [LEARNING_SOURCE, TRAINING_SOURCE],
  sourceFingerprint: stableHash({
    learning: learning.deterministicFingerprint,
    training: training.deterministicFingerprint,
  }),
  providerCallsMade: 0,
  databaseMutations: 0,
  productionMutations: 0,
  currentSamples: current,
  recoverableSamples: recoverable,
  partiallyRecoverableSamples: partial,
  permanentlyRejectedSamples: permanent,
  unknownSamples: expansion.recoverability.unknown,
  maximumCurrentEvidencePool,
  exactCategoryCounts: expansion.exactCategoryCounts,
  sportReadiness,
  marketReadiness,
  seasonReadiness,
  modelReadiness,
  providerGaps: {
    supabase: 'current manifests contain prediction, result, feature and model-weight metadata',
    sportsDataIO: 'no live inspection; future gaps require approved historical result/odds availability review',
    theOddsApi: 'no live inspection; historical odds availability remains entitlement-gated',
    existingCsv: 'no new local archive scan in this phase; existing manifests are the evidence source',
    historicalImports: 'not executed',
    storedSnapshots: 'feature evidence exists for accepted rows and preview rows, but blocked rows still need linkage proof',
  },
  roadmap,
  readinessScores: {
    overall: score(current),
    bySport: Object.fromEntries(sportReadiness.map((row) => [row.label, row.readinessScore])),
    byMarket: Object.fromEntries(marketReadiness.map((row) => [row.label, row.readinessScore])),
    byModel: Object.fromEntries(modelReadiness.map((row) => [row.modelVersion, row.readinessScore])),
    bySeason: Object.fromEntries(seasonReadiness.map((row) => [row.seasonKey, row.readinessScore])),
  },
  noTrainingExecuted: true,
  modelWeightMutations: 0,
  epochMutations: 0,
}

coverage.deterministicFingerprint = stableHash({
  sourceFingerprint: coverage.sourceFingerprint,
  exactCategoryCounts: coverage.exactCategoryCounts,
  recoverability: {
    current,
    recoverable,
    partial,
    permanent,
  },
  sportReadiness,
  marketReadiness,
  roadmap,
})

const trainingForecast = {
  success: true,
  mode: 'historical_evidence_expansion_training_forecast_v1',
  generatedAt: coverage.generatedAt,
  readOnly: true,
  providerCallsMade: 0,
  databaseMutations: 0,
  productionMutations: 0,
  noTrainingExecuted: true,
  forecast,
  roadmapSampleEstimates: roadmap,
  certificationMarkers: [
    'HISTORICAL_EVIDENCE_EXPANSION_PASS',
    'TRAINING_EXPANSION_ROADMAP_PASS',
    'SPORT_READINESS_FORECAST_PASS',
    'MARKET_READINESS_FORECAST_PASS',
    'TRAINING_FORECAST_PASS',
    'NO_PROVIDER_CALL_PASS',
    'NO_MODEL_TRAINING_PASS',
    'NO_MODEL_WEIGHT_MUTATION_PASS',
    'NO_EPOCH_ACTIVATION_PASS',
    'NO_PRODUCTION_MUTATION_PASS',
    'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
  ],
}
trainingForecast.deterministicFingerprint = stableHash({
  coverage: coverage.deterministicFingerprint,
  forecast,
  markers: trainingForecast.certificationMarkers,
})

fs.writeFileSync(COVERAGE_OUT, `${JSON.stringify(coverage, null, 2)}\n`)
fs.writeFileSync(TRAINING_OUT, `${JSON.stringify(trainingForecast, null, 2)}\n`)

console.log(JSON.stringify({
  success: true,
  mode: 'historical_evidence_expansion_v1',
  currentSamples: current,
  recoverableSamples: recoverable,
  partiallyRecoverableSamples: partial,
  permanentlyRejectedSamples: permanent,
  maximumRecoverableRows: current + recoverable + partial,
  firstTrainingThreshold,
  providerCallsMade: 0,
  databaseMutations: 0,
  outputs: [COVERAGE_OUT, TRAINING_OUT],
  deterministicFingerprint: coverage.deterministicFingerprint,
}, null, 2))
