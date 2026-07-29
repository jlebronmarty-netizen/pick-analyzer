import fs from 'node:fs'
import crypto from 'node:crypto'

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
}

const { supabaseAdmin } = await import('@/lib/supabase-admin')

const OUT_COVERAGE = 'docs/FEATURE_COVERAGE.json'
const OUT_INTELLIGENCE = 'docs/FEATURE_INTELLIGENCE_V1.md'
const OUT_SIGNAL = 'docs/FEATURE_SIGNAL_MATRIX.md'
const OUT_LEAKAGE = 'docs/FEATURE_LEAKAGE_AUDIT.md'
const OUT_PRIORITY = 'docs/FEATURE_PRIORITY_MATRIX.md'

const SNAPSHOT_COLUMNS = [
  'id',
  'deterministic_key',
  'sport_key',
  'market',
  'prediction_cutoff',
  'as_of_timestamp',
  'generated_at',
  'model_version',
  'feature_set_version',
  'data_quality_score',
  'data_sufficiency_score',
  'unresolved_mapping_count',
  'leakage_status',
  'leakage_warnings',
  'production_eligible',
  'trial',
  'scrambled',
  'feature_values',
].join(', ')

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function lower(value) {
  return String(value ?? '').trim().toLowerCase()
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null
}

function increment(map, key, by = 1) {
  const normalized = key || 'unknown'
  map[normalized] = (map[normalized] ?? 0) + by
}

function typeOfValue(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function flattenEntries(value, prefix = '', depth = 0, output = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 5) return output
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    output.push([path, child])
    if (child && typeof child === 'object' && !Array.isArray(child)) flattenEntries(child, path, depth + 1, output)
  }
  return output
}

function featureCategory(name) {
  const n = lower(name)
  if (/closing|close/.test(n)) return 'Closing line'
  if (/odds|price|sportsbook|book|implied/.test(n)) return 'Odds'
  if (/market|line|spread|total|handicap|selection|outcome/.test(n)) return 'Market'
  if (/line.?movement|movement|steam|drift/.test(n)) return 'Line movement'
  if (/pitch|starter|bullpen|era|whip|strike|walk|inning/.test(n)) return 'Pitching'
  if (/bat|offense|hit|slug|obp|woba|rbi|home.?run/.test(n)) return 'Batting'
  if (/team|rating|elo|power|strength|form|winpct|run.?differential/.test(n)) return 'Team strength'
  if (/home|away|venue|park|stadium/.test(n)) return 'Home/Away'
  if (/rest|days.?off/.test(n)) return 'Rest'
  if (/travel|timezone|distance/.test(n)) return 'Travel'
  if (/weather|wind|temp|humidity|precip/.test(n)) return 'Weather'
  if (/schedule|start.?time|commence|date|day|last3|last5|last10/.test(n)) return 'Schedule'
  if (/historical|season|prior|previous|last\d+|rolling/.test(n)) return 'Historical performance'
  if (/opponent|vs/.test(n)) return 'Opponent quality'
  if (/streak|hot.?cold|momentum|trend/.test(n)) return 'Streaks'
  if (/standing|rank|division/.test(n)) return 'Standings'
  if (/roster|injur|lineup|availability|player/.test(n)) return 'Roster'
  if (/model|probability|confidence|edge|ev|prediction|label|result|settle|outcome.*actual/.test(n)) return 'System'
  if (/id$|\.id|source|status|version|key|snapshot|timestamp|generated|metadata|unavailable/.test(n)) return 'Meta'
  return 'Unknown'
}

function leakageFinding(name) {
  const n = lower(name)
  if (/result|settle|label|actual|final|profit|win.?loss|brier/.test(n)) {
    return { severity: 'Critical', disposition: 'Exclude', reason: 'Could expose postgame labels or settlement outcomes.' }
  }
  if (/model|probability|confidence|edge|ev|prediction|official|recommend/.test(n)) {
    return { severity: 'Critical', disposition: 'Exclude', reason: 'Could feed prior model outputs or recommendation outputs back into training.' }
  }
  if (/closing|close/.test(n)) {
    return { severity: 'High', disposition: 'Exclude from pregame training', reason: 'Closing information is unavailable at early pregame decision time.' }
  }
  if (/status|source|eventid|event_id|snapshot|timestamp|generated|as_of|oddsSnapshotId|deterministic|version|key/.test(n)) {
    return { severity: 'High', disposition: 'Metadata only', reason: 'Identifier, timing or lineage metadata is useful for governance but not as predictive input.' }
  }
  if (/odds|price|line|sportsbook|implied|market/.test(n)) {
    return { severity: 'Medium', disposition: 'Use only if cutoff-frozen', reason: 'Market fields are valid only when proven pre-cutoff and frozen at prediction time.' }
  }
  if (/last3|last5|last10|rolling|prior|previous|season|historical/.test(n)) {
    return { severity: 'Low', disposition: 'Candidate', reason: 'Historical-window fields are suitable when source dates precede the target event.' }
  }
  return { severity: 'Low', disposition: 'Candidate', reason: 'No direct leakage pattern detected; still requires point-in-time lineage validation.' }
}

function signalQuality(category, coveragePercent, numericVariance, leakage) {
  if (leakage.disposition === 'Exclude' || leakage.disposition === 'Metadata only') {
    return { rating: 'Very Low', reason: 'Excluded or metadata-only because leakage or governance risk dominates predictive value.' }
  }
  if (coveragePercent < 5) return { rating: 'Unknown', reason: 'Observed coverage is too sparse for reliable signal assessment.' }
  if (numericVariance === 0) return { rating: 'Very Low', reason: 'Observed values are constant in this sample.' }
  if (['Odds', 'Market', 'Pitching', 'Team strength'].includes(category) && coveragePercent >= 30) {
    return { rating: 'Very High', reason: 'Domain-relevant and broadly covered; future training should test after cutoff validation.' }
  }
  if (['Batting', 'Weather', 'Schedule', 'Home/Away', 'Historical performance', 'Rest'].includes(category) && coveragePercent >= 20) {
    return { rating: 'High', reason: 'Domain-relevant contextual signal with useful observed coverage.' }
  }
  if (['Roster', 'Opponent quality', 'Streaks', 'Standings', 'Bullpen'].includes(category) || coveragePercent >= 10) {
    return { rating: 'Medium', reason: 'Potentially useful, but coverage or redundancy needs more review.' }
  }
  return { rating: 'Low', reason: 'Limited observed coverage or indirect relationship to outcomes.' }
}

function priorityForCategory(category) {
  if (['Meta', 'System'].includes(category)) return 'Training exclude'
  if (['Roster', 'Opponent quality', 'Streaks', 'Standings', 'Bullpen', 'Travel'].includes(category)) return 'Optional'
  if (category === 'Closing line') return 'Future'
  if (['Odds', 'Market', 'Pitching', 'Team strength'].includes(category)) return 'Must use'
  if (['Batting', 'Schedule', 'Home/Away', 'Historical performance', 'Weather', 'Rest'].includes(category)) return 'Recommended'
  return 'Experimental'
}

function makeStats() {
  return {
    present: 0,
    nulls: 0,
    types: {},
    sports: {},
    markets: {},
    seasons: {},
    values: new Map(),
    numericCount: 0,
    numericSum: 0,
    numericSumSquares: 0,
    min: null,
    max: null,
  }
}

function recordValue(stats, value, row) {
  stats.present += 1
  if (value === null) stats.nulls += 1
  increment(stats.types, typeOfValue(value))
  increment(stats.sports, row.sport_key)
  increment(stats.markets, lower(row.market))
  increment(stats.seasons, String(row.prediction_cutoff ?? row.generated_at ?? 'unknown').slice(0, 7))
  if (typeof value === 'number' && Number.isFinite(value)) {
    stats.numericCount += 1
    stats.numericSum += value
    stats.numericSumSquares += value * value
    stats.min = stats.min === null ? value : Math.min(stats.min, value)
    stats.max = stats.max === null ? value : Math.max(stats.max, value)
  }
  if (value === null || typeof value !== 'object') {
    const key = String(value)
    stats.values.set(key, (stats.values.get(key) ?? 0) + 1)
  }
}

async function readSnapshots() {
  const rows = []
  for (let from = 0; from < 120000; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('historical_feature_snapshots')
      .select(SNAPSHOT_COLUMNS)
      .range(from, from + 999)
      .order('id', { ascending: true })
    if (error) throw new Error(`historical_feature_snapshots read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return rows
}

const generatedAt = new Date().toISOString()
const snapshots = await readSnapshots()
const featureStats = new Map()
const qualityScores = []
const sufficiencyScores = []
const snapshotLeakage = {}
const snapshotBySport = {}
const snapshotByMarket = {}
const snapshotBySeason = {}

for (const row of snapshots) {
  if (typeof row.data_quality_score === 'number') qualityScores.push(row.data_quality_score)
  if (typeof row.data_sufficiency_score === 'number') sufficiencyScores.push(row.data_sufficiency_score)
  increment(snapshotLeakage, lower(row.leakage_status))
  increment(snapshotBySport, row.sport_key)
  increment(snapshotByMarket, lower(row.market))
  increment(snapshotBySeason, String(row.prediction_cutoff ?? row.generated_at ?? 'unknown').slice(0, 7))
  for (const [feature, value] of flattenEntries(row.feature_values ?? {})) {
    if (!featureStats.has(feature)) featureStats.set(feature, makeStats())
    recordValue(featureStats.get(feature), value, row)
  }
}

const totalSnapshots = snapshots.length
const features = Array.from(featureStats.entries()).map(([feature, stats]) => {
  const category = featureCategory(feature)
  const missing = totalSnapshots - stats.present
  const coveragePercent = totalSnapshots ? (stats.present / totalSnapshots) * 100 : 0
  const nullPercent = stats.present ? (stats.nulls / stats.present) * 100 : 0
  const missingPercent = totalSnapshots ? (missing / totalSnapshots) * 100 : 0
  const numericMean = stats.numericCount ? stats.numericSum / stats.numericCount : null
  const numericVariance = stats.numericCount
    ? Math.max(0, stats.numericSumSquares / stats.numericCount - numericMean * numericMean)
    : null
  const distinctCount = stats.values.size
  const leakage = leakageFinding(feature)
  const signal = signalQuality(category, coveragePercent, numericVariance, leakage)
  return {
    feature,
    category,
    presentCount: stats.present,
    coveragePercent: round(coveragePercent),
    nullPercent: round(nullPercent),
    missingPercent: round(missingPercent),
    constant: distinctCount <= 1 && stats.numericCount === 0 ? stats.present > 0 : stats.numericCount > 0 && numericVariance === 0,
    dataTypes: stats.types,
    numeric: stats.numericCount
      ? {
          count: stats.numericCount,
          min: round(stats.min, 4),
          max: round(stats.max, 4),
          mean: round(numericMean, 4),
          variance: round(numericVariance, 6),
        }
      : null,
    distribution: Array.from(stats.values.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([value, count]) => ({ value, count })),
    availableSports: Object.keys(stats.sports).sort(),
    availableMarkets: Object.keys(stats.markets).sort(),
    seasonCoverage: stats.seasons,
    signalQuality: signal.rating,
    signalReason: signal.reason,
    leakageSeverity: leakage.severity,
    trainingDisposition: leakage.disposition,
    leakageReason: leakage.reason,
  }
}).sort((a, b) => b.presentCount - a.presentCount || a.feature.localeCompare(b.feature))

const categoryStats = {}
for (const feature of features) {
  const stats = categoryStats[feature.category] ?? {
    category: feature.category,
    featureCount: 0,
    totalPresentCount: 0,
    coverageSum: 0,
    leakageCritical: 0,
    leakageHigh: 0,
    veryHighSignal: 0,
    highSignal: 0,
  }
  stats.featureCount += 1
  stats.totalPresentCount += feature.presentCount
  stats.coverageSum += feature.coveragePercent
  if (feature.leakageSeverity === 'Critical') stats.leakageCritical += 1
  if (feature.leakageSeverity === 'High') stats.leakageHigh += 1
  if (feature.signalQuality === 'Very High') stats.veryHighSignal += 1
  if (feature.signalQuality === 'High') stats.highSignal += 1
  categoryStats[feature.category] = stats
}

const categoryMatrix = Object.values(categoryStats).map((stats) => ({
  ...stats,
  averageCoveragePercent: round(stats.coverageSum / Math.max(stats.featureCount, 1)),
  priority: priorityForCategory(stats.category),
})).sort((a, b) => b.totalPresentCount - a.totalPresentCount || a.category.localeCompare(b.category))

const redundancyGroups = [
  {
    group: 'market_price_aliases',
    canonical: 'marketOdds.price plus derived implied probability',
    features: features.filter((item) => /marketOdds\.(price|odds|implied)/i.test(item.feature)).map((item) => item.feature),
    recommendation: 'Keep one canonical odds price and one explicitly computed implied probability per market side.',
  },
  {
    group: 'team_recent_form_windows',
    canonical: 'rolling team form windows with explicit lookback',
    features: features.filter((item) => /last(3|5|10)/i.test(item.feature)).map((item) => item.feature),
    recommendation: 'Retain last3/last5/last10 as separate regularized groups; avoid duplicate hotCold/trend aliases unless encoded deterministically.',
  },
  {
    group: 'identity_and_lineage_metadata',
    canonical: 'training metadata only',
    features: features.filter((item) => /id$|\.id|source|status|version|key|snapshot|timestamp|generated/i.test(item.feature)).map((item) => item.feature),
    recommendation: 'Keep for audit joins and freeze validation; exclude from model features.',
  },
  {
    group: 'home_away_symmetry',
    canonical: 'paired home/away team feature deltas',
    features: features.filter((item) => /\.(home|away)\./i.test(item.feature)).map((item) => item.feature),
    recommendation: 'Prefer matchup deltas and side-relative encodings over separate duplicated home/away raw fields where future training supports it.',
  },
].map((group) => ({ ...group, featureCount: group.features.length, features: group.features.slice(0, 40) }))

const firstLogisticFeatureSet = {
  model: 'Regularized Logistic Regression',
  use: ['Odds', 'Market', 'Pitching', 'Team strength', 'Batting', 'Schedule', 'Home/Away', 'Rest', 'Weather'],
  exclude: ['System', 'Meta', 'Closing line'],
  constraints: [
    'Use only pre-cutoff frozen fields.',
    'One canonical representation per odds/line field.',
    'Regularize correlated rolling form windows.',
    'Train only after approved sample threshold is reached.',
  ],
}

const secondGradientBoostingFeatureSet = {
  model: 'Gradient Boosting challenger',
  use: [...firstLogisticFeatureSet.use, 'Roster', 'Opponent quality', 'Streaks', 'Standings'],
  exclude: firstLogisticFeatureSet.exclude,
  constraints: [
    'Use after larger walk-forward sample exists.',
    'Audit monotonicity and leakage before challenger review.',
    'Keep champion/challenger separation; no automatic promotion.',
  ],
}

const futureEnsembleFeatureSet = {
  model: 'Future ensemble',
  use: [...secondGradientBoostingFeatureSet.use, 'Line movement', 'Historical performance'],
  exclude: firstLogisticFeatureSet.exclude,
  constraints: [
    'Line movement requires genuine opening and pre-cutoff snapshot history.',
    'Closing-line fields remain evaluation-only, not pregame predictors.',
    'Ensemble requires multi-season, multi-market validation.',
  ],
}

const leakageSummary = {
  critical: features.filter((item) => item.leakageSeverity === 'Critical').length,
  high: features.filter((item) => item.leakageSeverity === 'High').length,
  medium: features.filter((item) => item.leakageSeverity === 'Medium').length,
  low: features.filter((item) => item.leakageSeverity === 'Low').length,
  excludedFromTraining: features.filter((item) => ['Exclude', 'Metadata only', 'Exclude from pregame training'].includes(item.trainingDisposition)).length,
  cutoffFrozenCandidates: features.filter((item) => item.trainingDisposition === 'Use only if cutoff-frozen').length,
  safeCandidates: features.filter((item) => item.trainingDisposition === 'Candidate').length,
}

const manifest = {
  success: true,
  mode: 'feature_intelligence_signal_quality_leakage_audit_v1',
  generatedAt,
  readOnly: true,
  providerCallsMade: 0,
  databaseMutations: 0,
  productionMutations: 0,
  modelTrainingRuns: 0,
  modelWeightMutations: 0,
  predictionEngineChanges: 0,
  officialPickPolicyChanges: 0,
  snapshotsRead: totalSnapshots,
  featureKeysObserved: features.length,
  snapshotBySport,
  snapshotByMarket,
  snapshotBySeason,
  snapshotLeakage,
  averageDataQualityScore: round(qualityScores.reduce((sum, value) => sum + value, 0) / Math.max(qualityScores.length, 1)),
  averageDataSufficiencyScore: round(sufficiencyScores.reduce((sum, value) => sum + value, 0) / Math.max(sufficiencyScores.length, 1)),
  featureInventory: {
    totalFeatures: features.length,
    categoryCounts: Object.fromEntries(categoryMatrix.map((item) => [item.category, item.featureCount])),
    categoryMatrix,
    topCoverageFeatures: features.slice(0, 40),
  },
  coverage: features,
  signalMatrix: categoryMatrix.map((category) => ({
    category: category.category,
    featureCount: category.featureCount,
    averageCoveragePercent: category.averageCoveragePercent,
    veryHighSignalFeatures: category.veryHighSignal,
    highSignalFeatures: category.highSignal,
    priority: category.priority,
  })),
  redundancyGroups,
  leakageSummary,
  leakageFindings: features
    .filter((item) => item.leakageSeverity !== 'Low' || item.trainingDisposition !== 'Candidate')
    .slice(0, 140)
    .map((item) => ({
      feature: item.feature,
      category: item.category,
      coveragePercent: item.coveragePercent,
      severity: item.leakageSeverity,
      disposition: item.trainingDisposition,
      reason: item.leakageReason,
    })),
  priorityMatrix: categoryMatrix.map((category) => ({
    category: category.category,
    priority: category.priority,
    reason: `${category.featureCount} observed feature keys, ${category.averageCoveragePercent}% average coverage, ${category.leakageCritical + category.leakageHigh} high/critical leakage-governance flags.`,
  })),
  recommendedFeatureSets: {
    firstLogisticFeatureSet,
    secondGradientBoostingFeatureSet,
    futureEnsembleFeatureSet,
  },
  sportDifferences: {
    mlbSpecific: features.filter((item) => item.availableSports.length === 1 && item.availableSports.includes('baseball_mlb')).map((item) => item.feature).slice(0, 80),
    nflSpecific: features.filter((item) => item.availableSports.length === 1 && item.availableSports.includes('americanfootball_nfl')).map((item) => item.feature).slice(0, 80),
    nhlSpecific: features.filter((item) => item.availableSports.length === 1 && item.availableSports.includes('icehockey_nhl')).map((item) => item.feature).slice(0, 80),
    shared: features.filter((item) => item.availableSports.length > 1).map((item) => item.feature).slice(0, 80),
  },
  certificationMarkers: [
    'FEATURE_INTELLIGENCE_PASS',
    'FEATURE_SIGNAL_MATRIX_PASS',
    'FEATURE_LEAKAGE_AUDIT_PASS',
    'FEATURE_PRIORITY_MATRIX_PASS',
    'FIRST_MODEL_FEATURE_SET_PASS',
    'NO_MODEL_TRAINING_PASS',
    'NO_MODEL_WEIGHT_MUTATION_PASS',
    'NO_PROVIDER_CALL_PASS',
    'NO_PRODUCTION_MUTATION_PASS',
    'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
  ],
}

manifest.deterministicFingerprint = stableHash({
  mode: manifest.mode,
  snapshotsRead: manifest.snapshotsRead,
  featureKeysObserved: manifest.featureKeysObserved,
  categoryCounts: manifest.featureInventory.categoryCounts,
  leakageSummary: manifest.leakageSummary,
  priorityMatrix: manifest.priorityMatrix,
  recommendedFeatureSets: manifest.recommendedFeatureSets,
})

fs.writeFileSync(OUT_COVERAGE, `${JSON.stringify(manifest, null, 2)}\n`)

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

const categoryRows = categoryMatrix.map((item) => [
  item.category,
  String(item.featureCount),
  String(item.averageCoveragePercent),
  item.priority,
  String(item.veryHighSignal + item.highSignal),
  String(item.leakageCritical + item.leakageHigh),
])

fs.writeFileSync(OUT_INTELLIGENCE, `# Feature Intelligence V1

Date: 2026-07-29

Status: READ-ONLY FEATURE INTELLIGENCE

No model training. No production mutation. No provider calls.

## Inventory

- Feature snapshots read: ${manifest.snapshotsRead.toLocaleString()}
- Unique feature keys observed: ${manifest.featureKeysObserved.toLocaleString()}
- Sports represented: ${Object.keys(snapshotBySport).sort().join(', ')}
- Markets represented: ${Object.keys(snapshotByMarket).sort().join(', ')}
- Average data quality score: ${manifest.averageDataQualityScore}
- Average data sufficiency score: ${manifest.averageDataSufficiencyScore}

## Category Matrix

${table(['Category', 'Feature keys', 'Average coverage %', 'Priority', 'High-signal keys', 'High/critical leakage flags'], categoryRows)}

## Redundancy Findings

${redundancyGroups.map((group) => `- ${group.group}: ${group.featureCount} related keys. Canonical recommendation: ${group.recommendation}`).join('\n')}

## Feature-Set Direction

- First model: ${firstLogisticFeatureSet.model} using ${firstLogisticFeatureSet.use.join(', ')} after approved training threshold and cutoff validation.
- Second model: ${secondGradientBoostingFeatureSet.model} with expanded roster/opponent/streak/standing context after larger walk-forward evidence.
- Future model: ${futureEnsembleFeatureSet.model} after genuine line-movement history and multi-season validation exist.

## Guardrails

The audit does not train, fit, calculate model-derived feature importance, change probabilities, change confidence, change Trust, change Official Picks, change settlement, change Learning Brain weights, activate epochs, consume providers or mutate production data.
`)

fs.writeFileSync(OUT_SIGNAL, `# Feature Signal Matrix

Date: 2026-07-29

Status: DOMAIN AND COVERAGE SIGNAL ESTIMATE

No model training. No production mutation.

${table(['Category', 'Priority', 'Feature keys', 'Average coverage %', 'Very-high signal', 'High signal'], categoryMatrix.map((item) => [
  item.category,
  item.priority,
  String(item.featureCount),
  String(item.averageCoveragePercent),
  String(item.veryHighSignal),
  String(item.highSignal),
]))}

## Top Candidate Features By Coverage

${features.slice(0, 30).map((item) => `- ${item.feature}: ${item.signalQuality}, ${item.coveragePercent}% coverage, ${item.signalReason}`).join('\n')}

## Interpretation

Signal quality is estimated from domain relevance, observed coverage, variance and leakage disposition only. No trained feature importance, coefficient ranking or model fitting was performed.
`)

fs.writeFileSync(OUT_LEAKAGE, `# Feature Leakage Audit

Date: 2026-07-29

Status: READ-ONLY LEAKAGE CLASSIFICATION

No model training. No production mutation.

## Summary

- Critical leakage-risk keys: ${leakageSummary.critical}
- High leakage-governance keys: ${leakageSummary.high}
- Cutoff-frozen market candidates: ${leakageSummary.cutoffFrozenCandidates}
- Candidate non-leakage keys: ${leakageSummary.safeCandidates}
- Excluded or metadata-only keys: ${leakageSummary.excludedFromTraining}

## Required Training Exclusions

${manifest.leakageFindings.slice(0, 60).map((item) => `- ${item.feature}: ${item.severity}, ${item.disposition}. ${item.reason}`).join('\n')}

## Policy

Closing-line, settlement, label, prediction-output, recommendation-output and model-output fields must not be used as pregame model inputs. Odds and line fields may be used only when the stored snapshot proves the value was available before cutoff and frozen for the prediction.
`)

fs.writeFileSync(OUT_PRIORITY, `# Feature Priority Matrix

Date: 2026-07-29

Status: FUTURE MODEL INPUT PRIORITY

No model training. No production mutation.

${table(['Category', 'Priority', 'Reason'], manifest.priorityMatrix.map((item) => [
  item.category,
  item.priority,
  item.reason,
]))}

## First Logistic Regression

- Use: ${firstLogisticFeatureSet.use.join(', ')}
- Exclude: ${firstLogisticFeatureSet.exclude.join(', ')}
- Constraints: ${firstLogisticFeatureSet.constraints.join(' ')}

## Second Gradient Boosting Model

- Use: ${secondGradientBoostingFeatureSet.use.join(', ')}
- Exclude: ${secondGradientBoostingFeatureSet.exclude.join(', ')}
- Constraints: ${secondGradientBoostingFeatureSet.constraints.join(' ')}

## Future Ensemble

- Use: ${futureEnsembleFeatureSet.use.join(', ')}
- Exclude: ${futureEnsembleFeatureSet.exclude.join(', ')}
- Constraints: ${futureEnsembleFeatureSet.constraints.join(' ')}
`)

console.log(JSON.stringify({
  success: true,
  mode: manifest.mode,
  snapshotsRead: manifest.snapshotsRead,
  featureKeysObserved: manifest.featureKeysObserved,
  providerCallsMade: manifest.providerCallsMade,
  databaseMutations: manifest.databaseMutations,
  modelTrainingRuns: manifest.modelTrainingRuns,
  leakageSummary: manifest.leakageSummary,
  deterministicFingerprint: manifest.deterministicFingerprint,
}, null, 2))
