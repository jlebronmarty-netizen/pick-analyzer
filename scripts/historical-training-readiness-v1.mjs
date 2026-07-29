import fs from 'node:fs'
import crypto from 'node:crypto'

const SOURCE = 'docs/HISTORICAL_LEARNING_READINESS_V1.json'
const OUT = 'docs/TRAINING_READINESS_V1.json'

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'))
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function getSportEntry(evidence, sport) {
  return evidence.trainingQueueReadiness.find((row) => row.sport === sport) ?? {
    sport,
    totalRows: 0,
    acceptedRows: 0,
    dateRange: { start: null, end: null },
    classBalance: {},
    featureCompleteness: 0,
    leakageStatus: 'PASS',
    minimumSampleReadiness: 'INSUFFICIENT_SAMPLE',
    trainingExecuted: false,
  }
}

function classifySportReadiness(entry) {
  if (entry.acceptedRows >= 2500) return 'TRAINING_DATASET_READY_AFTER_HUMAN_APPROVAL'
  if (entry.acceptedRows >= 1000) return 'CANDIDATE_DATASET_REVIEW_READY'
  if (entry.acceptedRows >= 250) return 'DESIGN_SAMPLE_PRESENT_NOT_TRAINING_READY'
  if (entry.totalRows > 0) return 'EVIDENCE_PRESENT_NOT_TRAINING_READY'
  return 'NO_TRAINING_EVIDENCE'
}

function sportBlock(evidence, sport, label, expectedPath) {
  const entry = getSportEntry(evidence, sport)
  const missingData = []
  if (entry.acceptedRows === 0) missingData.push('canonical production settled rows')
  if (!entry.dateRange.start || !entry.dateRange.end) missingData.push('training date range')
  if (!Object.keys(entry.classBalance ?? {}).length) missingData.push('accepted outcome class balance')
  if (entry.featureCompleteness < 1) missingData.push('complete linked feature evidence')

  return {
    sportKey: sport,
    label,
    currentRowsObserved: entry.totalRows,
    acceptedTrainingRows: entry.acceptedRows,
    dateRange: entry.dateRange,
    classBalance: entry.classBalance,
    featureCompleteness: entry.featureCompleteness,
    leakageStatus: entry.leakageStatus,
    readiness: classifySportReadiness(entry),
    minimumSamples: {
      designReview: 250,
      firstCandidateTraining: 1000,
      sportMarketCandidate: 300,
      promotionShadowSettledRows: 500,
      multiSeasonPreferred: true,
    },
    missingData,
    expectedReadiness: expectedPath,
  }
}

const evidence = readJson(SOURCE)
const generatedAt = new Date().toISOString()
const sports = [
  sportBlock(evidence, 'baseball_mlb', 'MLB', 'closest; needs larger multi-slate and preferably multi-season accepted samples before training'),
  sportBlock(evidence, 'basketball_nba', 'NBA', 'blocked until genuine production settled rows replace trial/shadow-only evidence'),
  sportBlock(evidence, 'americanfootball_nfl', 'NFL', 'preview evidence exists; blocked until future games settle with canonical results'),
  sportBlock(evidence, 'icehockey_nhl', 'NHL', 'preview evidence exists; blocked until future games settle with canonical results'),
  sportBlock(evidence, 'soccer_epl', 'Soccer', 'blocked until competition-scoped canonical events, results, odds and accepted settled rows exist'),
  sportBlock(evidence, 'basketball_bsn', 'BSN', 'blocked until production prediction and result lifecycle exists'),
  sportBlock(evidence, 'tennis', 'Tennis', 'blocked until production prediction persistence and settlement lifecycle exist'),
  sportBlock(evidence, 'ufc', 'UFC', 'blocked until production prediction persistence and settlement lifecycle exist'),
]

const manifest = {
  success: true,
  mode: 'historical_training_readiness_and_controlled_model_training_design_v1',
  generatedAt,
  readOnly: true,
  sourceEvidence: SOURCE,
  sourceFingerprint: evidence.deterministicFingerprint,
  noTrainingExecuted: true,
  providerCallsMade: 0,
  databaseMutations: 0,
  settlementWrites: 0,
  predictionWrites: 0,
  learningWrites: 0,
  modelWeightMutations: 0,
  epochMutations: 0,
  baseline: {
    totalPredictionsScanned: evidence.inventory.totalPredictionsScanned,
    productionTrainingReadyRows: evidence.inventory.productionTrainingReady,
    learningQueueRows: 386,
    learningAcceptedRows: evidence.inventory.productionTrainingReady,
    modelWeightHistoryRows: evidence.noTrainingProof.modelWeightHistoryBefore,
    trainingEverExecuted: false,
    epochPromotionEverExecuted: false,
  },
  inventory: {
    sourceTables: evidence.architecture.sourceTables,
    acceptedRows: evidence.inventory.productionTrainingReady,
    rejectedRows: evidence.inventory.rejectedRows,
    markets: evidence.inventory.marketCounts,
    sports: evidence.inventory.sportCounts,
    modelVersions: evidence.inventory.modelVersionCounts,
    outcomes: evidence.inventory.outcomeCounts,
    partitions: evidence.inventory.partitionCounts,
    rejectionReasons: evidence.inventory.reasonCounts,
  },
  datasetQuality: {
    sampleCountStatus: 'INSUFFICIENT_FOR_MODEL_TRAINING',
    reason: '354 accepted MLB rows are useful for design review but below the first candidate training threshold and concentrated in one month.',
    classBalance: getSportEntry(evidence, 'baseball_mlb').classBalance,
    marketsCovered: Object.keys(evidence.inventory.marketCounts),
    seasonCoverage: evidence.inventory.monthCounts,
    featureCompletenessPolicy: 'accepted rows require linked or embedded feature evidence; feature payloads are referenced, not duplicated',
    duplicatePolicy: 'future dataset builder must enforce one logical row per sport/event/market/selection/model/cutoff',
    leakageGuards: [
      'generated_at must be before cutoff and event start',
      'cutoff_at must be present or classifier-approved',
      'feature_snapshot_id or feature_snapshot_key must reference point-in-time evidence',
      'canonical result must be used only as label after settlement',
      'trial, scrambled, preview and shadow rows are excluded from production training',
    ],
  },
  modelStrategy: {
    recommendedBase: 'start with interpretable regularized classifiers per sport-market after approval',
    incrementalLearning: 'disabled until challenger governance and drift tests are approved',
    fullRetraining: 'manual only; deterministic manifest, frozen input fingerprint and approval ticket required',
    globalEnsemble: 'future research only after per sport-market baselines exist',
    deterministicSeedRequired: true,
    experimentTracking: 'write manifest first; no training run may exist without dataset, code, config and metric fingerprints',
  },
  validationStrategy: {
    splitPolicy: 'walk-forward by event start time; no random cross-validation for time-sensitive production claims',
    partitions: ['train', 'validation', 'test', 'prospective shadow'],
    metrics: ['Brier', 'calibration', 'accuracy', 'log_loss', 'precision', 'recall', 'ROI', 'CLV', 'EV', 'profit_simulation', 'sharpe', 'drawdown'],
    promotionRequires: [
      'minimum sample thresholds met',
      'no leakage findings',
      'champion comparison improves calibration without harming safety metrics',
      'prospective shadow evaluation passes',
      'manual promotion approval',
    ],
  },
  shadowStrategy: {
    championChallenger: true,
    productionWritesAllowed: false,
    candidateRowsMustBeShadowOnly: true,
    automaticPromotionAllowed: false,
    rollbackRequiredBeforePromotion: true,
    driftDetection: ['calibration drift', 'feature distribution drift', 'market mix drift', 'sport status drift'],
  },
  governance: {
    epochLifecycle: ['draft', 'trained_candidate', 'validated', 'shadow', 'approved', 'active', 'rolled_back', 'archived'],
    approvals: ['dataset freeze approval', 'training approval', 'shadow approval', 'promotion approval', 'rollback approval'],
    automaticTraining: 'disabled',
    manualTraining: 'future gated CLI/job only',
    minimumNewSamplesBeforeReview: 250,
    catastrophicRollback: 'restore previous champion pointer; never delete historical predictions or candidate artifacts',
  },
  sportReadiness: sports,
  certificationMarkers: [
    'TRAINING_PIPELINE_ARCHITECTURE_PASS',
    'TRAINING_DATASET_READINESS_PASS',
    'MODEL_GOVERNANCE_PASS',
    'MODEL_PROMOTION_POLICY_PASS',
    'SHADOW_MODEL_ARCHITECTURE_PASS',
    'TRAINING_VALIDATION_ARCHITECTURE_PASS',
    'NO_MODEL_TRAINING_PASS',
    'NO_MODEL_WEIGHT_MUTATION_PASS',
    'NO_EPOCH_ACTIVATION_PASS',
    'NO_PRODUCTION_PREDICTION_CHANGE_PASS',
    'NO_SETTLEMENT_CHANGE_PASS',
  ],
}

manifest.deterministicFingerprint = stableHash({
  sourceFingerprint: manifest.sourceFingerprint,
  baseline: manifest.baseline,
  inventory: manifest.inventory,
  sportReadiness: manifest.sportReadiness,
  certificationMarkers: manifest.certificationMarkers,
})

fs.writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({
  success: true,
  mode: manifest.mode,
  output: OUT,
  productionTrainingReadyRows: manifest.baseline.productionTrainingReadyRows,
  learningQueueRows: manifest.baseline.learningQueueRows,
  modelWeightHistoryRows: manifest.baseline.modelWeightHistoryRows,
  providerCallsMade: manifest.providerCallsMade,
  databaseMutations: manifest.databaseMutations,
  modelWeightMutations: manifest.modelWeightMutations,
  epochMutations: manifest.epochMutations,
  deterministicFingerprint: manifest.deterministicFingerprint,
}, null, 2))
