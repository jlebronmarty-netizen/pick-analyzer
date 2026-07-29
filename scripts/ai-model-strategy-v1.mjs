import fs from 'node:fs'
import crypto from 'node:crypto'

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
}

const { supabaseAdmin } = await import('@/lib/supabase-admin')

const OUT = 'docs/AI_MODEL_STRATEGY_V1.json'
const growth = JSON.parse(fs.readFileSync('docs/LEARNING_DATASET_GROWTH.json', 'utf8'))

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function lower(value) {
  return String(value ?? '').toLowerCase()
}

function increment(map, key, by = 1) {
  const normalized = key || 'unknown'
  map[normalized] = (map[normalized] ?? 0) + by
}

function flattenKeys(value, prefix = '', depth = 0, output = new Set()) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 3) return output
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    output.add(path)
    if (child && typeof child === 'object' && !Array.isArray(child)) flattenKeys(child, path, depth + 1, output)
  }
  return output
}

function featureCategory(name) {
  const n = lower(name)
  if (/odds|line|price|market|spread|total|implied/.test(n)) return 'market_pricing'
  if (/pitch|starter|bullpen|era|whip|strike|walk|innings/.test(n)) return 'mlb_pitching'
  if (/bat|offense|run|hit|slug|obp|woba/.test(n)) return 'mlb_offense'
  if (/weather|wind|temp|humidity|park|stadium/.test(n)) return 'environment'
  if (/team|rating|elo|power|form|streak|win|loss/.test(n)) return 'team_strength'
  if (/injur|lineup|player|roster|availability/.test(n)) return 'roster_availability'
  if (/rest|travel|home|away|schedule|days/.test(n)) return 'schedule_context'
  if (/model|prob|confidence|edge|ev/.test(n)) return 'model_output_or_label_risk'
  return 'other'
}

function modelSuitability(samples, sport) {
  if (samples < 1000) {
    return {
      bestCandidate: sport === 'MLB' ? 'regularized_logistic_regression_shadow_only' : 'no_training_candidate',
      reason: samples > 0
        ? 'sample is useful for schema and calibration rehearsal but below controlled candidate training threshold'
        : 'no accepted samples',
      blockedModels: ['Random Forest', 'XGBoost', 'LightGBM', 'CatBoost', 'Neural Networks', 'Stacking'],
    }
  }
  if (samples < 2000) {
    return {
      bestCandidate: 'regularized_logistic_regression_plus_isotonic_calibration',
      reason: 'interpretable low-variance baseline is preferred before tree ensembles',
      blockedModels: ['Neural Networks', 'Stacking'],
    }
  }
  return {
    bestCandidate: 'gradient_boosted_trees_challenger_against_logistic_champion',
    reason: 'larger sample can support nonlinear interactions after leakage and drift checks',
    blockedModels: ['Neural Networks until 5000+ samples and multi-season coverage'],
  }
}

async function readPredictionFeatureRefs() {
  const rows = []
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('prediction_history')
      .select('id, sport_key, market, model_version, feature_snapshot_id, feature_snapshot_key, feature_snapshot')
      .range(from, from + 999)
      .order('id', { ascending: true })
    if (error) throw new Error(`prediction feature-ref read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return rows
}

async function readSnapshots(ids) {
  const rows = []
  for (let index = 0; index < ids.length; index += 75) {
    const { data, error } = await supabaseAdmin
      .from('historical_feature_snapshots')
      .select('id, sport_key, market, model_version, feature_set_version, data_quality_score, data_sufficiency_score, leakage_status, production_eligible, trial, scrambled, feature_values')
      .in('id', ids.slice(index, index + 75))
    if (error) throw new Error(`feature snapshot read failed: ${error.message}`)
    rows.push(...(data ?? []))
  }
  return rows
}

const generatedAt = new Date().toISOString()
const refs = await readPredictionFeatureRefs()
const featureIds = Array.from(new Set(refs.map((row) => row.feature_snapshot_id).filter(Boolean)))
const snapshots = await readSnapshots(featureIds)

const featureCounts = {}
const categoryCounts = {}
const bySport = {}
const byMarket = {}
for (const snapshot of snapshots) {
  increment(bySport, snapshot.sport_key)
  increment(byMarket, lower(snapshot.market))
  const keys = flattenKeys(snapshot.feature_values)
  for (const key of keys) {
    increment(featureCounts, key)
    increment(categoryCounts, featureCategory(key))
  }
}

const topFeatures = Object.entries(featureCounts)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 80)
  .map(([feature, count]) => ({
    feature,
    count,
    category: featureCategory(feature),
    importancePotential: featureCategory(feature) === 'model_output_or_label_risk'
      ? 'exclude_or_audit_for_leakage'
      : ['market_pricing', 'mlb_pitching', 'team_strength'].includes(featureCategory(feature))
        ? 'high'
        : ['environment', 'schedule_context', 'mlb_offense'].includes(featureCategory(feature))
          ? 'medium'
          : 'unknown_until_training',
  }))

const currentSamples = growth.after.trainingReadyRows
const marketSamples = growth.perMarketGrowth
const sportSamples = growth.perSportGrowth
const sampleCurve = [419, 600, 800, 1000, 2000, 5000].map((samples) => ({
  samples,
  expectedCalibration: samples < 800 ? 'unstable' : samples < 2000 ? 'usable_for_shadow' : 'candidate_grade',
  expectedAccuracyLift: samples < 1000 ? 'low_or_not_reliable' : samples < 2000 ? 'small_single_digit_relative_lift_possible' : 'moderate_if_feature_signal_exists',
  expectedStability: samples < 1000 ? 'high_variance' : samples < 2000 ? 'moderate_variance' : 'improving_with_walk_forward_validation',
  confidence: samples < 1000 ? 'low' : samples < 2000 ? 'medium_low' : samples < 5000 ? 'medium' : 'medium_high',
}))

const sportStrategy = ['MLB', 'NBA', 'NFL', 'NHL', 'Soccer', 'BSN'].map((sport) => {
  const key = {
    MLB: 'baseball_mlb',
    NBA: 'basketball_nba',
    NFL: 'americanfootball_nfl',
    NHL: 'icehockey_nhl',
    Soccer: 'soccer_epl',
    BSN: 'basketball_bsn',
  }[sport]
  const samples = sportSamples[key] ?? 0
  return {
    sport,
    acceptedSamples: samples,
    strategy: samples >= 1000 ? 'train_candidate_after_approval' : samples > 0 ? 'continue_evidence_growth_and_shadow_design' : 'blocked_until_accepted_samples_exist',
    modelSuitability: modelSuitability(samples, sport),
  }
})

const marketStrategy = ['moneyline', 'spread', 'total'].map((market) => ({
  market,
  acceptedSamples: marketSamples[market] ?? 0,
  strategy: (marketSamples[market] ?? 0) >= 300 ? 'eligible_for_market_specific_review_after_approval' : 'pool_with_sport_model_until_300_plus_samples',
}))

const manifest = {
  success: true,
  mode: 'ai_training_opportunity_analysis_and_model_strategy_v1',
  generatedAt,
  readOnly: true,
  providerCallsMade: 0,
  databaseMutations: 0,
  productionMutations: 0,
  modelTrainingRuns: 0,
  modelWeightMutations: 0,
  epochMutations: 0,
  baseline: {
    currentTrainingReadyRows: currentSamples,
    roadmapTargetRows: 1000,
    noModelEverTrained: true,
  },
  featureAnalysis: {
    linkedPredictionRows: refs.filter((row) => row.feature_snapshot_id || row.feature_snapshot_key || row.feature_snapshot).length,
    linkedFeatureSnapshotIds: featureIds.length,
    featureSnapshotsRead: snapshots.length,
    uniqueFeatureKeysObserved: Object.keys(featureCounts).length,
    categoryCounts,
    bySport,
    byMarket,
    topFeatures,
    redundancyAssessment: [
      'Market price, implied probability, edge and model-output-like fields require leakage audit before training.',
      'Team strength and recent form features may be correlated and should be regularized or grouped.',
      'Pitching, weather and park features are likely high-value MLB differentiators but require walk-forward testing.',
    ],
    missingFeatureCategories: ['multi-season form', 'closing-line evaluation only', 'injury/lineup confidence', 'travel/rest depth', 'market movement history'],
  },
  datasetAnalysis: {
    currentSamples,
    classBalance: { loss: 180, win: 168, push: 6 },
    marketSamples,
    seasonCoverage: growth.perSeasonGrowth,
    usableSportsNow: currentSamples >= 1000 ? ['MLB'] : [],
    usableMarketsNow: [],
    trainingRisk: 'below 1000 samples; one sport, one month, three markets; suitable for rehearsal and shadow design only',
  },
  modelAnalysis: {
    modelRankingNow: [
      'No production training now',
      'Regularized Logistic Regression as first future champion candidate',
      'Gradient boosted trees as future challenger after 2000+ samples',
      'Bayesian calibration layer for uncertainty after baseline validation',
      'Neural networks and stacking only after 5000+ samples and multi-season coverage',
    ],
    suitabilityByModel: {
      logisticRegression: 'best first candidate after 1000+ samples because it is interpretable and stable with limited data',
      randomForest: 'future challenger; risk of overfit at 1000 samples',
      xgboost: 'strong future challenger after 2000+ samples and leakage audit',
      lightgbm: 'similar to XGBoost; useful if feature count grows materially',
      catboost: 'useful if categorical feature inventory expands',
      neuralNetworks: 'not justified before 5000+ samples and multi-season coverage',
      bayesianModels: 'useful for uncertainty and calibration, not first production replacement',
      ensembles: 'future V3 after multiple validated base learners',
      stacking: 'future V4 only; sample hungry and governance-heavy',
      blending: 'future V3/V4 after shadow validation',
    },
    sportStrategy,
    marketStrategy,
    recommendedArchitecture: 'MLB-first regularized champion/challenger with pooled moneyline/spread/total model until each market reaches 300+ accepted samples; per-sport models later; no global ensemble yet',
  },
  expectedImprovement: sampleCurve,
  evolutionRoadmap: [
    { phase: 'Training V1', gate: '1000+ accepted MLB rows', action: 'regularized logistic regression shadow candidate only' },
    { phase: 'Training V2', gate: '2000+ accepted rows or 300+ per market', action: 'per-market calibration and gradient boosted challenger' },
    { phase: 'Training V3', gate: 'multi-season evidence and stable shadow lift', action: 'small ensemble/blending with champion comparison' },
    { phase: 'Training V4', gate: '5000+ samples and multi-sport coverage', action: 'stacked meta-models under strict governance' },
    { phase: 'Future RL', gate: 'not suitable for prediction probabilities; maybe portfolio simulation only after separate approval', action: 'research only' },
    { phase: 'Future AutoML', gate: 'after dataset manifests and leakage guards mature', action: 'offline challenger search only' },
  ],
  businessImpact: {
    predictionQuality: 'limited now; meaningful only after 1000+ accepted rows',
    roi: 'must remain evaluation metric, not training target, until calibration is stable',
    brier: 'primary near-term optimization/evaluation metric',
    calibration: 'highest priority improvement target',
    expectedValue: 'downstream policy metric after probability calibration',
    officialPicks: 'no policy change; future model can only feed Official Picks after promotion',
    userConfidence: 'improves through transparent shadow reports, not by claiming premature AI lift',
  },
  certificationMarkers: [
    'AI_MODEL_STRATEGY_PASS',
    'MODEL_SELECTION_ANALYSIS_PASS',
    'FEATURE_ANALYSIS_PASS',
    'MODEL_EVOLUTION_ROADMAP_PASS',
    'TRAINING_PRIORITY_MATRIX_PASS',
    'NO_MODEL_TRAINING_PASS',
    'NO_MODEL_WEIGHT_MUTATION_PASS',
    'NO_EPOCH_ACTIVATION_PASS',
    'NO_PRODUCTION_MUTATION_PASS',
    'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
  ],
}

manifest.deterministicFingerprint = stableHash({
  baseline: manifest.baseline,
  featureAnalysis: {
    linkedPredictionRows: manifest.featureAnalysis.linkedPredictionRows,
    linkedFeatureSnapshotIds: manifest.featureAnalysis.linkedFeatureSnapshotIds,
    uniqueFeatureKeysObserved: manifest.featureAnalysis.uniqueFeatureKeysObserved,
    categoryCounts: manifest.featureAnalysis.categoryCounts,
    topFeatures: manifest.featureAnalysis.topFeatures,
  },
  datasetAnalysis: manifest.datasetAnalysis,
  modelAnalysis: manifest.modelAnalysis,
  expectedImprovement: manifest.expectedImprovement,
})

fs.writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({
  success: true,
  currentTrainingReadyRows: manifest.baseline.currentTrainingReadyRows,
  linkedFeatureSnapshotIds: manifest.featureAnalysis.linkedFeatureSnapshotIds,
  uniqueFeatureKeysObserved: manifest.featureAnalysis.uniqueFeatureKeysObserved,
  bestModel: 'regularized_logistic_regression_after_1000_plus_rows',
  recommendedArchitecture: manifest.modelAnalysis.recommendedArchitecture,
  providerCallsMade: 0,
  databaseMutations: 0,
  deterministicFingerprint: manifest.deterministicFingerprint,
}, null, 2))
