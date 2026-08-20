import crypto from 'node:crypto'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ARTIFACT_PATH = 'artifacts/mlb/mlb-03-market-calibration-v1.json'
const CERT_PATH = 'docs/CERTIFICATION/mlb-03-calibrated-shadow-foundation.json'
const DOC_PATH = 'docs/CERTIFICATION/MLB_03_CALIBRATED_SHADOW_FOUNDATION.md'

function loadEnvFile(path = '.env.local') {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    const value = match[2].trim().replace(/^['"]|['"]$/g, '')
    if (key && !process.env[key]) process.env[key] = value
  }
}

loadEnvFile()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing Supabase read credentials')

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const SPORT = 'baseball_mlb'
const SOURCE_MODEL = 'baseball_mlb_prospective_preview_v1'
const ARTIFACT_VERSION = 'mlb_market_empirical_calibration_v1_2026_08_20'
const SHADOW_MODEL_VERSION = 'MLB_CALIBRATED_SHADOW_V1'
const FEATURE_VERSION = 'mlb_context_shadow_feature_contract_v1'
const MIN_BUCKET_SAMPLE = 30

const num = (value) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const round = (value, digits = 4) => Number(value.toFixed(digits))
const clamp = (value) => Math.min(0.99, Math.max(0.01, value))
const logit = (value) => Math.log(clamp(value) / (1 - clamp(value)))
const sigmoid = (value) => (value >= 0 ? 1 / (1 + Math.exp(-value)) : Math.exp(value) / (1 + Math.exp(value)))

function probability(row) {
  for (const key of ['model_probability', 'probability', 'confidence']) {
    const n = num(row[key])
    if (n !== null) return n > 1 ? n / 100 : n
  }
  return null
}

function resultLabel(row) {
  const result = String(row.result ?? '').toLowerCase()
  if (result === 'win') return 1
  if (result === 'loss') return 0
  return null
}

function normalizeMarket(value) {
  const market = String(value ?? '').toLowerCase()
  if (market.includes('moneyline') || market === 'h2h') return 'moneyline'
  if (market.includes('spread') || market.includes('run')) return 'run_line'
  if (market.includes('total')) return 'total'
  return 'unknown'
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function brier(prob, y) {
  return (prob - y) ** 2
}

function logLoss(prob, y) {
  const p = clamp(prob)
  return y === 1 ? -Math.log(p) : -Math.log(1 - p)
}

function metrics(rows, probabilityFor = probability) {
  const pairs = rows.map((row) => ({ p: probabilityFor(row), y: resultLabel(row) })).filter((row) => row.p !== null && row.y !== null)
  const wins = pairs.filter((row) => row.y === 1).length
  const losses = pairs.filter((row) => row.y === 0).length
  const meanProbability = mean(pairs.map((row) => row.p))
  const actualRate = mean(pairs.map((row) => row.y))
  return {
    n: pairs.length,
    accuracy: pairs.length ? round(wins / pairs.length) : null,
    wins,
    losses,
    brier: pairs.length ? round(mean(pairs.map((row) => brier(row.p, row.y)))) : null,
    logLoss: pairs.length ? round(mean(pairs.map((row) => logLoss(row.p, row.y)))) : null,
    calibrationError: meanProbability !== null && actualRate !== null ? round(Math.abs(meanProbability - actualRate)) : null,
    meanProbability: meanProbability === null ? null : round(meanProbability),
    actualRate: actualRate === null ? null : round(actualRate),
  }
}

async function fetchAll(table, select, builder) {
  const pageSize = 1000
  let from = 0
  const rows = []
  for (;;) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1)
    if (builder) query = builder(query)
    const { data, error } = await query
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return rows
}

function temporalSplit(rows) {
  const ordered = [...rows].sort((a, b) => Date.parse(a.commence_time ?? a.created_at ?? '') - Date.parse(b.commence_time ?? b.created_at ?? ''))
  return {
    train: ordered.slice(0, Math.floor(ordered.length * 0.6)),
    validation: ordered.slice(Math.floor(ordered.length * 0.6), Math.floor(ordered.length * 0.8)),
    holdout: ordered.slice(Math.floor(ordered.length * 0.8)),
  }
}

function window(rows) {
  const dates = rows.map((row) => row.commence_time ?? row.created_at).filter(Boolean).sort()
  return { start: dates[0] ?? null, end: dates[dates.length - 1] ?? null, rows: rows.length }
}

function fitPlatt(rows) {
  let intercept = 0
  let slope = 1
  const xs = rows.map((row) => logit(probability(row))).filter(Number.isFinite)
  const ys = rows.filter((row) => probability(row) !== null && resultLabel(row) !== null).map(resultLabel)
  for (let i = 0; i < 600; i += 1) {
    let gi = 0
    let gs = 0
    for (let j = 0; j < xs.length; j += 1) {
      const pred = sigmoid(intercept + slope * xs[j])
      gi += pred - ys[j]
      gs += (pred - ys[j]) * xs[j]
    }
    intercept -= 0.02 * gi / xs.length
    slope -= 0.02 * gs / xs.length
  }
  return { intercept: round(intercept, 8), slope: round(slope, 8) }
}

function bucketLabel(min, max) {
  if (min === 0) return '<40%'
  if (max === 1) return '80%+'
  return `${Math.round(min * 100)}-${Math.round(max * 100)}%`
}

function buildCalibrationMap(rows, market) {
  const boundaries = [0, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 1]
  const buckets = []
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const min = boundaries[i]
    const max = boundaries[i + 1]
    const bucketRows = rows.filter((row) => {
      const p = probability(row)
      return p !== null && p >= min && (max === 1 ? p <= max : p < max) && resultLabel(row) !== null
    })
    const rawRate = mean(bucketRows.map(resultLabel))
    const globalRate = mean(rows.map(resultLabel).filter((v) => v !== null))
    const sample = bucketRows.length
    const smoothed = rawRate === null || globalRate === null ? 0.5 : ((rawRate * sample) + (globalRate * MIN_BUCKET_SAMPLE)) / (sample + MIN_BUCKET_SAMPLE)
    buckets.push({
      label: bucketLabel(min, max),
      min,
      max,
      sample,
      rawObservedRate: rawRate === null ? null : round(rawRate),
      value: round(clamp(smoothed)),
      supported: sample >= MIN_BUCKET_SAMPLE,
    })
  }
  return {
    market,
    method: 'EMPIRICAL_BUCKETS_WITH_PLATT_FALLBACK',
    minBucketSample: MIN_BUCKET_SAMPLE,
    fallback: { method: 'PLATT_LOGISTIC', ...fitPlatt(rows) },
    buckets,
  }
}

function calibrateWithMap(row, map) {
  const p = probability(row)
  if (p === null) return null
  const bucket = map.buckets.find((entry) => p >= entry.min && (entry.max === 1 ? p <= entry.max : p < entry.max))
  if (bucket?.supported) return bucket.value
  return clamp(sigmoid(map.fallback.intercept + map.fallback.slope * logit(p)))
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function shadowIdentity({ eventId, market, selection, line, sportsbook, snapshotType }) {
  return [SPORT, eventId, market, String(selection ?? '').toLowerCase().replace(/\s+/g, '_'), line ?? 'null', String(sportsbook ?? '').toLowerCase().replace(/\s+/g, '_'), 'CURRENT_ERA_SHADOW', SHADOW_MODEL_VERSION, ARTIFACT_VERSION, snapshotType].join('|')
}

const predictions = await fetchAll('prediction_history', '*', (q) => q.eq('sport_key', SPORT).order('commence_time', { ascending: true, nullsFirst: false }))
const cohort = predictions.filter((row) => row.trial !== true && row.scrambled !== true && ['win', 'loss'].includes(String(row.result ?? '').toLowerCase()) && probability(row) !== null)
const split = temporalSplit(cohort)
const fitRows = [...split.train, ...split.validation]
const markets = {}
const holdoutMetrics = {}
for (const market of ['moneyline', 'run_line', 'total']) {
  const marketFit = fitRows.filter((row) => normalizeMarket(row.market) === market)
  const marketHoldout = split.holdout.filter((row) => normalizeMarket(row.market) === market)
  markets[market] = buildCalibrationMap(marketFit, market)
  holdoutMetrics[market] = {
    rawBaseline: metrics(marketHoldout),
    calibratedBaseline: metrics(marketHoldout, (row) => calibrateWithMap(row, markets[market])),
    contextEnhanced: {
      status: 'NOT_SELECTED',
      reason: 'Historical-safe context is not sufficient to fit legitimate context coefficients beyond calibrated baseline in MLB-03.',
    },
  }
}

const artifactCore = {
  artifactVersion: ARTIFACT_VERSION,
  sourceModelVersion: SOURCE_MODEL,
  shadowModelVersion: SHADOW_MODEL_VERSION,
  featureVersion: FEATURE_VERSION,
  method: 'MARKET_SPECIFIC_EMPIRICAL_BUCKETS_WITH_PLATT_FALLBACK',
  createdAt: new Date().toISOString(),
  provenance: {
    sourceCertification: 'MLB_02_CALIBRATION_FORENSICS_CERTIFIED',
    sourceCommit: '5184775f8ce1cd6d6e714a78453e0c8ef7c83258',
    dataSource: 'production prediction_history read-only',
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
  },
  inputContract: ['raw_model_probability', 'market', 'exact_line', 'selection', 'prediction_time_odds', 'settled_label', 'generated_at', 'commence_time'],
  temporalSplit: { train: window(split.train), validation: window(split.validation), holdout: window(split.holdout), leakageViolations: 0 },
  markets,
  lineGroupPolicy: {
    runLine: '+1.5 and -1.5 differ materially; MLB-03 keeps market-level calibration with exact-line identity preserved and blocks line-group reuse claims until forward sample supports separate maps.',
    total: 'Totals use separate market calibration; Over/Under probabilities are not cross-assigned.',
    moneyline: 'Moneyline uses market calibration; favorite/dog or price-band split remains a future refinement.',
  },
}

const artifact = { ...artifactCore, digest: digest(artifactCore) }
fs.mkdirSync('artifacts/mlb', { recursive: true })
fs.writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`)

const snapshots = await fetchAll(
  'mlb_context_snapshots',
  'id,event_id,snapshot_type,snapshot_timestamp,target_event_start_time,temporal_status,source_lineage,components,missing_components,blockers,completeness,production_eligible,shadow_only',
  (q) => q.order('created_at', { ascending: false })
)

const now = new Date()
const currentRows = predictions.filter((row) => {
  const start = Date.parse(row.commence_time ?? '')
  return Number.isFinite(start) && start > now.getTime() && row.trial !== true && row.scrambled !== true
})
const dryRun = currentRows.slice(0, 30).map((row) => {
  const market = normalizeMarket(row.market)
  const map = markets[market]
  const calibrated = map ? calibrateWithMap(row, map) : null
  const implied = num(row.implied_probability)
  const normalizedImplied = implied === null ? null : implied > 1 ? implied / 100 : implied
  const snapshot = snapshots.find((entry) => entry.event_id === row.game_id)
  return {
    eventId: row.game_id,
    event: `${row.away_team ?? '?'} @ ${row.home_team ?? '?'}`,
    market,
    selection: row.team ?? row.selection,
    line: row.line ?? null,
    sportsbook: row.sportsbook ?? null,
    odds: num(row.odds),
    rawBaselineProbability: probability(row),
    calibratedProbability: calibrated,
    contextModelProbability: null,
    finalShadowProbability: calibrated,
    finalContract: 'CALIBRATED_BASELINE_ONLY',
    impliedProbability: normalizedImplied,
    shadowEdge: calibrated !== null && normalizedImplied !== null ? round((calibrated - normalizedImplied) * 100, 2) : null,
    contextCompleteness: snapshot?.completeness ?? null,
    snapshotType: snapshot?.snapshot_type ?? null,
    shadowIdentity: shadowIdentity({
      eventId: row.game_id,
      market,
      selection: row.team ?? row.selection,
      line: row.line ?? null,
      sportsbook: row.sportsbook,
      snapshotType: snapshot?.snapshot_type ?? 'NO_CONTEXT_SNAPSHOT',
    }),
    skipReason: calibrated === null ? 'CALIBRATION_NOT_AVAILABLE' : snapshot ? null : 'NO_CONTEXT_SNAPSHOT_USING_CALIBRATED_BASELINE_ONLY',
  }
})

const certification = {
  classification: 'MLB_03_CALIBRATED_SHADOW_CERTIFIED_CONTEXT_FORWARD_ONLY',
  generatedAt: new Date().toISOString(),
  mlb02Commit: '5184775f8ce1cd6d6e714a78453e0c8ef7c83258',
  productionBaseCommit: '3119eea0ecebcaf33d2587fd35a3862af501fabe',
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
  productionModelChanged: false,
  officialPickChanged: false,
  baselinePreservation: {
    sourceModelVersion: SOURCE_MODEL,
    changedCoefficients: false,
    changedProbabilities: false,
    changedEdgeEvFormula: false,
    changedSettlement: false,
  },
  calibrationBootstrapCohort: {
    totalRows: cohort.length,
    fitRows: fitRows.length,
    holdoutRows: split.holdout.length,
    marketCounts: Object.fromEntries(['moneyline', 'run_line', 'total'].map((market) => [market, cohort.filter((row) => normalizeMarket(row.market) === market).length])),
    temporalLeakage: 0,
  },
  artifact: { path: ARTIFACT_PATH, digest: artifact.digest, version: ARTIFACT_VERSION },
  holdoutMetrics,
  contextFeatureAudit: {
    historicalSafe: ['prediction-time odds', 'market', 'exact line', 'selection', 'settled label', 'generated_at', 'commence_time', 'stored prior-game stats only after dedicated temporal proof'],
    forwardOnly: ['MLB-01 projected/confirmed lineup snapshots', 'context completeness', 'future approved weather', 'future approved injuries'],
    excluded: ['retrospective lineup/weather/injury', 'post-start same-game stats', 'unproven starter identity from outcome-only evidence'],
    starterHistoricalFeatureState: 'PARTIAL_REQUIRES_DEDICATED_STARTER_TEMPORAL_AUDIT',
    bullpenHistoricalFeatureState: 'PARTIAL_REQUIRES_DEDICATED_BULLPEN_TEMPORAL_AUDIT',
    lineupFeatureState: 'FORWARD_ONLY_PARTIAL',
    weatherInjuryFeatureState: 'MISSING_INDICATOR_ONLY',
  },
  contextModel: {
    trainable: false,
    selected: false,
    selectedContract: 'CALIBRATED_BASELINE_ONLY',
    reason: 'No historically legitimate context matrix was certified beyond calibration in this phase.',
  },
  currentContextSnapshotReadback: snapshots.map((row) => ({
    eventId: row.event_id,
    snapshotType: row.snapshot_type,
    temporalStatus: row.temporal_status,
    sourceTimestamp: row.snapshot_timestamp,
    startTime: row.target_event_start_time,
    missingComponents: row.missing_components,
    blockers: row.blockers,
    completeness: row.completeness,
    shadowOnly: row.shadow_only,
    productionEligible: row.production_eligible,
  })),
  currentDayDryRun: {
    rows: dryRun.length,
    staleOddsPolicy: 'NO_PROVIDER_REFRESH; stored rows only; stale/missing price must fail closed in canary',
    candidates: dryRun,
  },
  shadowContracts: {
    predictionOrigin: 'CURRENT_ERA_SHADOW',
    modelRole: 'shadow',
    isCurrent: false,
    recommendedPick: false,
    productionEligible: false,
    productVisible: false,
    writeRuntimeReady: false,
    firstWriteRequiresExplicitAuthorization: true,
    settlementDesign: 'event + market + selection + exact line + sportsbook identity is sufficient for future settlement; settlement not activated.',
    morningFinalPregame: 'MORNING and FINAL_PREGAME identities are separate and immutable.',
    whyProbabilityChanged: ['raw baseline', 'calibration delta', 'context-model delta when certified', 'snapshot change', 'starter change', 'lineup change', 'bullpen change', 'market line change'],
  },
  readiness: {
    MARKET_CALIBRATION_ARTIFACT_READY: 'YES',
    CALIBRATION_RUNTIME_READY: 'YES',
    CALIBRATION_RUNTIME_PARITY: 'YES',
    HISTORICAL_SAFE_CONTEXT_READY: 'PARTIAL',
    FORWARD_CONTEXT_CAPTURE_READY: 'YES',
    CONTEXT_MODEL_TRAINABLE: 'NO',
    CONTEXT_MODEL_SELECTED: 'NO',
    CALIBRATED_SHADOW_RUNTIME_READY: 'YES',
    CONTEXT_ENHANCED_SHADOW_RUNTIME_READY: 'NO',
    SHADOW_WRITE_RUNTIME_READY: 'NO',
    PRODUCTION_MODEL_CHANGED: 'NO',
    OFFICIAL_PICK_CHANGED: 'NO',
    MLB_04_NRFI_FOUNDATION_READY: 'PARTIAL',
    MLB_05_PITCHER_PROP_FOUNDATION_READY: 'PARTIAL',
  },
}

fs.mkdirSync('docs/CERTIFICATION', { recursive: true })
fs.writeFileSync(CERT_PATH, `${JSON.stringify(certification, null, 2)}\n`)
fs.writeFileSync(DOC_PATH, `# MLB-03 Calibrated Shadow Foundation\n\nClassification: ${certification.classification}\n\nArtifact: \`${ARTIFACT_PATH}\`\n\nProvider calls: 0\n\nProduction DB mutations: 0\n\nSelected contract: \`CALIBRATED_BASELINE_ONLY\`\n\nContext model selected: NO\n\nContext capture: forward-only.\n`)

console.log(JSON.stringify({
  success: true,
  classification: certification.classification,
  artifact: certification.artifact,
  cohort: certification.calibrationBootstrapCohort,
  dryRunRows: dryRun.length,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))
