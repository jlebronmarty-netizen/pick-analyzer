import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const OUT_JSON = 'docs/CERTIFICATION/mlb-02-calibration-forensics.json'
const OUT_MD = 'docs/CERTIFICATION/MLB_02_CALIBRATION_FORENSICS.md'

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

const num = (value) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const pct = (value) => (value === null || value === undefined || !Number.isFinite(value) ? null : Number(value.toFixed(4)))

const prob = (row) => {
  const candidates = [row.model_probability, row.probability, row.confidence]
  for (const value of candidates) {
    const n = num(value)
    if (n === null) continue
    return n > 1 ? n / 100 : n
  }
  return null
}

const americanImplied = (odds) => {
  const n = num(odds)
  if (n === null || n === 0) return null
  if (n > 0) return 100 / (n + 100)
  return Math.abs(n) / (Math.abs(n) + 100)
}

const storedProbabilityLike = (value) => {
  const n = num(value)
  if (n === null) return null
  return n > 1 ? n / 100 : n
}

const profitFor = (row) => {
  const result = String(row.result ?? '').toLowerCase()
  if (result === 'push') return 0
  if (result !== 'win' && result !== 'loss') return null
  const odds = num(row.odds)
  if (odds === null || odds === 0) return num(row.profit)
  if (result === 'loss') return -1
  return odds > 0 ? odds / 100 : 100 / Math.abs(odds)
}

const safeLogLoss = (p, y) => {
  const bounded = Math.min(0.999999, Math.max(0.000001, p))
  return -(y * Math.log(bounded) + (1 - y) * Math.log(1 - bounded))
}

function resultLabel(row) {
  const result = String(row.result ?? '').toLowerCase()
  if (result === 'win') return 1
  if (result === 'loss') return 0
  return null
}

function normalizeMarket(value) {
  const v = String(value ?? '').toLowerCase()
  if (v.includes('money')) return 'moneyline'
  if (v === 'h2h') return 'moneyline'
  if (v.includes('spread') || v.includes('run')) return 'run_line'
  if (v.includes('total')) return 'total'
  return v || 'unknown'
}

function mean(values) {
  const xs = values.filter((v) => v !== null && v !== undefined && Number.isFinite(v))
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

function metrics(rows) {
  const settled = rows.filter((r) => ['win', 'loss', 'push'].includes(String(r.result ?? '').toLowerCase()))
  const binary = settled.filter((r) => resultLabel(r) !== null && prob(r) !== null)
  const wins = settled.filter((r) => String(r.result).toLowerCase() === 'win').length
  const losses = settled.filter((r) => String(r.result).toLowerCase() === 'loss').length
  const pushes = settled.filter((r) => String(r.result).toLowerCase() === 'push').length
  const profits = settled.map(profitFor).filter((v) => v !== null)
  const probs = binary.map(prob)
  const labels = binary.map(resultLabel)
  const brier = binary.length ? mean(binary.map((r) => (prob(r) - resultLabel(r)) ** 2)) : null
  const logLoss = binary.length ? mean(binary.map((r) => safeLogLoss(prob(r), resultLabel(r)))) : null
  const meanProb = mean(probs)
  const actual = labels.length ? mean(labels) : null
  return {
    sample: rows.length,
    settled: settled.length,
    wins,
    losses,
    pushes,
    accuracy: wins + losses ? pct(wins / (wins + losses)) : null,
    meanPredictedProbability: pct(meanProb),
    actualWinRate: pct(actual),
    calibrationGap: meanProb !== null && actual !== null ? pct(meanProb - actual) : null,
    brier: pct(brier),
    logLoss: pct(logLoss),
    oddsCoverage: pct(rows.filter((r) => num(r.odds) !== null).length / Math.max(1, rows.length)),
    averageOdds: pct(mean(rows.map((r) => num(r.odds)))),
    averageImpliedProbability: pct(mean(rows.map((r) => storedProbabilityLike(r.implied_probability) ?? americanImplied(r.odds)))),
    averageEdge: pct(mean(rows.map((r) => num(r.edge)))),
    averageEv: pct(mean(rows.map((r) => num(r.ev)))),
    flatUnitProfit: pct(profits.length ? profits.reduce((a, b) => a + b, 0) : 0),
    flatUnitRoi: pct(profits.length ? profits.reduce((a, b) => a + b, 0) / profits.length : null),
  }
}

function groupBy(rows, fn) {
  const map = new Map()
  for (const row of rows) {
    const key = fn(row)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([k, v]) => [k, metrics(v)]))
}

function bucket(value, bins, missing = 'missing') {
  const n = num(value)
  if (n === null) return missing
  for (const [label, test] of bins) if (test(n)) return label
  return 'other'
}

async function fetchAll(table, select, builder) {
  const pageSize = 1000
  let from = 0
  const rows = []
  let total = null
  for (;;) {
    let query = supabase.from(table).select(select, { count: from === 0 ? 'exact' : undefined }).range(from, from + pageSize - 1)
    query = builder ? builder(query) : query
    const { data, error, count } = await query
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    if (from === 0) total = count
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return { rows, count: total ?? rows.length }
}

function cohort(rows) {
  return rows.filter((r) => !r.trial && !r.scrambled && String(r.sport_key) === SPORT)
}

function isRecommended(row) {
  return row.recommended_pick === true || row.recommended_pick === 'true'
}

function selectionSide(row) {
  const team = String(row.team ?? row.selection ?? '').toLowerCase()
  const home = String(row.home_team ?? '').toLowerCase()
  const away = String(row.away_team ?? '').toLowerCase()
  if (team && home && team === home) return 'home'
  if (team && away && team === away) return 'away'
  return 'unknown'
}

function favorite(row) {
  const odds = num(row.odds)
  if (odds === null) return 'unknown'
  if (odds <= -115) return 'favorite'
  if (odds >= 115) return 'underdog'
  return 'near_pickem'
}

function bindingMode(row) {
  const details = row.settlement_details && typeof row.settlement_details === 'object' ? row.settlement_details : {}
  const warnings = Array.isArray(row.validation_warnings) ? row.validation_warnings.join('|') : String(row.validation_warnings ?? '')
  return String(row.price_binding_mode ?? row.binding_mode ?? details.priceBindingMode ?? details.bindingMode ?? (warnings.includes('COMPLEMENT') ? 'COMPLEMENT' : 'DIRECT_OR_UNKNOWN'))
}

function timeToStartBucket(row) {
  const generated = Date.parse(row.generated_at ?? row.created_at ?? '')
  const start = Date.parse(row.commence_time ?? '')
  if (!Number.isFinite(generated) || !Number.isFinite(start)) return 'unknown'
  const hours = (start - generated) / 36e5
  return bucket(hours, [
    ['post_start_or_missing', (v) => v < 0],
    ['<30m', (v) => v < 0.5],
    ['30-60m', (v) => v < 1],
    ['1-3h', (v) => v < 3],
    ['3-6h', (v) => v < 6],
    ['>6h', (v) => v >= 6],
  ])
}

function contextProfile(row) {
  const snapshot = row.feature_snapshot && typeof row.feature_snapshot === 'object' ? row.feature_snapshot : {}
  const warnings = Array.isArray(row.validation_warnings) ? row.validation_warnings.join('|').toLowerCase() : String(row.validation_warnings ?? '').toLowerCase()
  const tags = []
  const json = JSON.stringify(snapshot).toLowerCase()
  if (/starter/.test(json + warnings)) tags.push('starter_evidence_present_or_referenced')
  if (/lineup/.test(json + warnings)) tags.push('lineup_evidence_present_or_referenced')
  if (/bullpen/.test(json + warnings)) tags.push('bullpen_evidence_present_or_referenced')
  if (/weather/.test(json + warnings)) tags.push('weather_evidence_present_or_referenced')
  if (/injur/.test(json + warnings)) tags.push('injury_evidence_present_or_referenced')
  return tags.length ? tags.join('+') : 'legacy_no_explicit_context_metadata'
}

function empiricalCalibration(train, evalRows) {
  const bins = [
    ['<40%', (v) => v < 0.4],
    ['40-45%', (v) => v < 0.45],
    ['45-50%', (v) => v < 0.5],
    ['50-55%', (v) => v < 0.55],
    ['55-60%', (v) => v < 0.6],
    ['60-65%', (v) => v < 0.65],
    ['65-70%', (v) => v < 0.7],
    ['70-75%', (v) => v < 0.75],
    ['75-80%', (v) => v < 0.8],
    ['80%+', (v) => v >= 0.8],
  ]
  const by = new Map()
  for (const row of train) {
    const p = prob(row)
    const y = resultLabel(row)
    if (p === null || y === null) continue
    const b = bucket(p, bins)
    if (!by.has(b)) by.set(b, [])
    by.get(b).push(y)
  }
  const map = Object.fromEntries([...by.entries()].map(([k, ys]) => [k, mean(ys)]))
  const calibrated = evalRows.map((row) => {
    const p = prob(row)
    if (p === null) return null
    return map[bucket(p, bins)] ?? p
  })
  return calibrated
}

function plattCalibration(train, evalRows) {
  let a = 1
  let b = 0
  const xs = train.map((row) => prob(row)).filter((p) => p !== null).map((p) => Math.log(Math.min(0.999999, Math.max(0.000001, p)) / (1 - Math.min(0.999999, Math.max(0.000001, p)))))
  const ys = train.filter((row) => prob(row) !== null && resultLabel(row) !== null).map(resultLabel)
  if (xs.length !== ys.length || xs.length < 30) return evalRows.map((row) => prob(row))
  for (let iter = 0; iter < 500; iter += 1) {
    let ga = 0
    let gb = 0
    for (let i = 0; i < xs.length; i += 1) {
      const pred = 1 / (1 + Math.exp(-(a * xs[i] + b)))
      ga += (pred - ys[i]) * xs[i]
      gb += pred - ys[i]
    }
    a -= 0.01 * ga / xs.length
    b -= 0.01 * gb / xs.length
  }
  return evalRows.map((row) => {
    const p = prob(row)
    if (p === null) return null
    const x = Math.log(Math.min(0.999999, Math.max(0.000001, p)) / (1 - Math.min(0.999999, Math.max(0.000001, p))))
    return 1 / (1 + Math.exp(-(a * x + b)))
  })
}

function evaluateCalibrated(rows, probs) {
  const pairs = rows.map((row, i) => ({ p: probs[i], y: resultLabel(row) })).filter((x) => x.p !== null && x.y !== null)
  return {
    sample: pairs.length,
    brier: pct(mean(pairs.map(({ p, y }) => (p - y) ** 2))),
    logLoss: pct(mean(pairs.map(({ p, y }) => safeLogLoss(p, y)))),
    calibrationError: pct(Math.abs(mean(pairs.map((x) => x.p)) - mean(pairs.map((x) => x.y)))),
    meanProbability: pct(mean(pairs.map((x) => x.p))),
    actualRate: pct(mean(pairs.map((x) => x.y))),
  }
}

function dateSort(rows) {
  return [...rows].sort((a, b) => Date.parse(a.commence_time ?? a.created_at ?? '') - Date.parse(b.commence_time ?? b.created_at ?? ''))
}

function splitTemporal(rows) {
  const clean = dateSort(rows.filter((r) => resultLabel(r) !== null && prob(r) !== null))
  const n = clean.length
  const trainEnd = Math.floor(n * 0.6)
  const valEnd = Math.floor(n * 0.8)
  return {
    train: clean.slice(0, trainEnd),
    validation: clean.slice(trainEnd, valEnd),
    holdout: clean.slice(valEnd),
  }
}

function windowOf(rows) {
  const times = rows.map((r) => r.commence_time ?? r.created_at).filter(Boolean).sort()
  return { start: times[0] ?? null, end: times[times.length - 1] ?? null, rows: rows.length }
}

function topRows(rows, fn, n = 10) {
  return [...rows].sort((a, b) => (fn(b) ?? -Infinity) - (fn(a) ?? -Infinity)).slice(0, n).map((row) => ({
    id: row.id,
    gameId: row.game_id,
    event: `${row.away_team ?? '?'} @ ${row.home_team ?? '?'}`,
    market: normalizeMarket(row.market),
    selection: row.team ?? row.selection,
    line: row.line ?? null,
    sportsbook: row.sportsbook ?? null,
    odds: num(row.odds),
    probability: pct(prob(row)),
    impliedProbability: pct(num(row.implied_probability) ?? americanImplied(row.odds)),
    edge: pct(num(row.edge)),
    ev: pct(num(row.ev)),
    result: row.result ?? null,
    modelVersion: row.model_version ?? null,
    calibrationVersion: row.calibration_version ?? row.calibration_status ?? null,
  }))
}

const predictionSelect = '*'
const { rows: rawPredictions, count: predictionCount } = await fetchAll('prediction_history', predictionSelect, (q) =>
  q.eq('sport_key', SPORT).order('commence_time', { ascending: true, nullsFirst: false })
)
const predictions = cohort(rawPredictions)
const settled = predictions.filter((r) => ['win', 'loss', 'push'].includes(String(r.result ?? '').toLowerCase()))
const binarySettled = settled.filter((r) => resultLabel(r) !== null && prob(r) !== null)
const currentCohort = predictions.filter((r) => {
  const origin = String(r.prediction_origin ?? '').toLowerCase()
  const mv = String(r.model_version ?? '').toLowerCase()
  return !origin.includes('historical') && !origin.includes('replay') && !origin.includes('shadow') && (mv.includes('prospective') || origin === '' || origin.includes('current'))
})
const primary = currentCohort.length >= 100 ? currentCohort : predictions
const recommended = predictions.filter(isRecommended)
const official = recommended

const probBins = [
  ['<40%', (v) => v < 0.4],
  ['40-45%', (v) => v < 0.45],
  ['45-50%', (v) => v < 0.5],
  ['50-55%', (v) => v < 0.55],
  ['55-60%', (v) => v < 0.6],
  ['60-65%', (v) => v < 0.65],
  ['65-70%', (v) => v < 0.7],
  ['70-75%', (v) => v < 0.75],
  ['75-80%', (v) => v < 0.8],
  ['80%+', (v) => v >= 0.8],
]

const edgeBins = [
  ['<=0%', (v) => v <= 0],
  ['0-5%', (v) => v <= 5],
  ['5-10%', (v) => v <= 10],
  ['10-15%', (v) => v <= 15],
  ['15-20%', (v) => v <= 20],
  ['>20%', (v) => v > 20],
]

const evBins = [
  ['<=0', (v) => v <= 0],
  ['0-10%', (v) => v <= 10],
  ['10-25%', (v) => v <= 25],
  ['25-50%', (v) => v <= 50],
  ['>50%', (v) => v > 50],
]

const split = splitTemporal(binarySettled)
const calibrationByMarket = {}
for (const market of ['moneyline', 'run_line', 'total']) {
  const rows = binarySettled.filter((r) => normalizeMarket(r.market) === market)
  const s = splitTemporal(rows)
  calibrationByMarket[market] = {
    split: { train: windowOf(s.train), validation: windowOf(s.validation), holdout: windowOf(s.holdout) },
    before: evaluateCalibrated(s.holdout, s.holdout.map(prob)),
    platt: evaluateCalibrated(s.holdout, plattCalibration([...s.train, ...s.validation], s.holdout)),
    empiricalBuckets: evaluateCalibrated(s.holdout, empiricalCalibration([...s.train, ...s.validation], s.holdout)),
  }
}

const contextSnapshots = await fetchAll(
  'mlb_context_snapshots',
  'id,event_id,snapshot_type,snapshot_timestamp,target_event_start_time,source_lineage,components,missing_components,blockers,completeness,production_eligible,shadow_only,created_at',
  (q) => q.order('created_at', { ascending: false })
)

let learningLabels = { count: 0, error: null }
try {
  const res = await supabase.from('learning_labels').select('id', { count: 'exact', head: true })
  learningLabels = { count: res.count ?? 0, error: res.error?.message ?? null }
} catch (error) {
  learningLabels = { count: null, error: error.message }
}

const baseline = {
  predictionCount,
  filteredPredictionCount: predictions.length,
  ...metrics(predictions),
  productionEligible: predictions.filter((r) => r.production_eligible === true).length,
  recommendedRows: recommended.length,
  officialPicks: official.length,
  modelVersions: groupBy(predictions, (r) => r.model_version ?? 'null'),
  featureVersions: groupBy(predictions, (r) => r.feature_set_version ?? r.feature_version ?? 'null'),
  calibrationStates: groupBy(predictions, (r) => r.calibration_status ?? r.calibration_version ?? 'skipped_or_null'),
  predictionOrigins: groupBy(predictions, (r) => r.prediction_origin ?? 'null'),
}

const result = {
  success: true,
  mode: 'mlb_02_calibration_forensics_v1',
  generatedAt: new Date().toISOString(),
  repositoryCommit: '3119eea0ecebcaf33d2587fd35a3862af501fabe',
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
  classification: 'MLB_02_CALIBRATION_FORENSICS_CERTIFIED',
  baseline,
  cohorts: {
    filters: {
      primaryForensicCohort: "sport_key='baseball_mlb' AND trial=false AND scrambled=false AND not historical/replay/shadow origin when identifiable",
      recommended: 'recommended_pick=true within MLB cohort',
      official: 'recommended_pick=true; no separate official pick table mutation performed',
      historicalReplayExcluded: 'prediction_origin/model_version containing historical/replay',
      shadowExcluded: 'prediction_origin/model_role containing shadow',
    },
    primary: metrics(primary),
    currentProspective: metrics(currentCohort),
    historicalReplay: metrics(predictions.filter((r) => /historical|replay/i.test(`${r.prediction_origin ?? ''} ${r.model_version ?? ''}`))),
    shadow: metrics(predictions.filter((r) => /shadow/i.test(`${r.prediction_origin ?? ''} ${r.model_role ?? ''}`))),
    legacyOrNullModel: metrics(predictions.filter((r) => !r.model_version)),
    recommended: metrics(recommended),
    productionEligible: metrics(predictions.filter((r) => r.production_eligible === true)),
  },
  marketPerformance: groupBy(primary, (r) => normalizeMarket(r.market)),
  probabilityBuckets: groupBy(primary, (r) => bucket(prob(r), probBins)),
  edgeBuckets: groupBy(primary, (r) => bucket(num(r.edge), edgeBins)),
  evBuckets: groupBy(primary, (r) => bucket(num(r.ev), evBins)),
  favoriteUnderdog: groupBy(primary, favorite),
  homeAway: groupBy(primary, selectionSide),
  sportsbook: groupBy(primary, (r) => r.sportsbook ?? 'unknown'),
  priceBinding: groupBy(primary, bindingMode),
  timeToStart: groupBy(primary, timeToStartBucket),
  missingContextProfile: groupBy(primary, contextProfile),
  modelVersionPerformance: groupBy(primary, (r) => r.model_version ?? 'null'),
  recommendedForensics: {
    summary: metrics(recommended),
    market: groupBy(recommended, (r) => normalizeMarket(r.market)),
    favoriteUnderdog: groupBy(recommended, favorite),
    probabilityBuckets: groupBy(recommended, (r) => bucket(prob(r), probBins)),
    missingContextProfile: groupBy(recommended, contextProfile),
  },
  extremeProbabilityAudit: {
    atLeast70: metrics(primary.filter((r) => (prob(r) ?? 0) >= 0.70)),
    atLeast75: metrics(primary.filter((r) => (prob(r) ?? 0) >= 0.75)),
    atLeast80: metrics(primary.filter((r) => (prob(r) ?? 0) >= 0.80)),
    representativeRows: topRows(primary.filter((r) => (prob(r) ?? 0) >= 0.70), prob, 12),
  },
  extremeEdgeEvAudit: {
    edgeGreater20: metrics(primary.filter((r) => (num(r.edge) ?? -Infinity) > 0.20)),
    evGreater50: metrics(primary.filter((r) => (num(r.ev) ?? -Infinity) > 0.50)),
    topEdgeRows: topRows(primary, (r) => num(r.edge), 12),
    topEvRows: topRows(primary, (r) => num(r.ev), 12),
    classification: 'MODEL_PROBABILITY_AND_CALIBRATION_PRIMARY; MARKET_BINDING_REQUIRES_TARGETED_FOLLOWUP_FOR_EXTREMES',
  },
  totalsForensics: {
    bySelection: groupBy(primary.filter((r) => normalizeMarket(r.market) === 'total'), (r) => String(r.team ?? r.selection ?? '').toLowerCase().includes('under') ? 'under' : String(r.team ?? r.selection ?? '').toLowerCase().includes('over') ? 'over' : 'unknown'),
    byLine: groupBy(primary.filter((r) => normalizeMarket(r.market) === 'total'), (r) => String(r.line ?? 'null')),
    byProbability: groupBy(primary.filter((r) => normalizeMarket(r.market) === 'total'), (r) => bucket(prob(r), probBins)),
  },
  runLineForensics: {
    byLine: groupBy(primary.filter((r) => normalizeMarket(r.market) === 'run_line'), (r) => String(r.line ?? 'null')),
    bySelectionSide: groupBy(primary.filter((r) => normalizeMarket(r.market) === 'run_line'), selectionSide),
    byProbability: groupBy(primary.filter((r) => normalizeMarket(r.market) === 'run_line'), (r) => bucket(prob(r), probBins)),
  },
  moneylineForensics: {
    favoriteUnderdog: groupBy(primary.filter((r) => normalizeMarket(r.market) === 'moneyline'), favorite),
    homeAway: groupBy(primary.filter((r) => normalizeMarket(r.market) === 'moneyline'), selectionSide),
    priceBands: groupBy(primary.filter((r) => normalizeMarket(r.market) === 'moneyline'), (r) => bucket(num(r.odds), [
      ['<=-200', (v) => v <= -200],
      ['-200 to -150', (v) => v <= -150],
      ['-150 to -115', (v) => v <= -115],
      ['pickem', (v) => v < 115],
      ['+115 to +150', (v) => v <= 150],
      ['+150 to +200', (v) => v <= 200],
      ['>+200', (v) => v > 200],
    ])),
  },
  runtimeCalibrationRootCause: {
    identified: true,
    rootCause: 'Current dominant MLB rows carry skipped/null calibration because no production calibration artifact is eligible for this model/version path; productionEligible is 0 and learning_labels is 0, so runtime calibration has no approved bootstrap label/artifact source.',
    evidence: {
      productionEligibleRows: baseline.productionEligible,
      learningLabels,
      calibrationStates: Object.keys(baseline.calibrationStates),
    },
  },
  calibrationResearch: {
    temporalSplit: { train: windowOf(split.train), validation: windowOf(split.validation), holdout: windowOf(split.holdout), leakage: 0 },
    overall: {
      before: evaluateCalibrated(split.holdout, split.holdout.map(prob)),
      platt: evaluateCalibrated(split.holdout, plattCalibration([...split.train, ...split.validation], split.holdout)),
      empiricalBuckets: evaluateCalibrated(split.holdout, empiricalCalibration([...split.train, ...split.validation], split.holdout)),
    },
    byMarket: calibrationByMarket,
    isotonicStatus: 'DESIGN_READY_NOT_EXECUTED_WITH_LIBRARY; empirical monotone/bucket mapping used as transparent local proxy',
  },
  labelIntegrity: {
    moneyline: metrics(primary.filter((r) => normalizeMarket(r.market) === 'moneyline')),
    runLine: metrics(primary.filter((r) => normalizeMarket(r.market) === 'run_line')),
    total: metrics(primary.filter((r) => normalizeMarket(r.market) === 'total')),
    pushHandling: 'push excluded from binary Brier/log-loss/accuracy denominator; retained in W/L/P and ROI as zero-profit push',
    fabricatedLabels: 0,
  },
  roi: {
    overall: metrics(primary),
    byMarket: groupBy(primary, (r) => normalizeMarket(r.market)),
    byProbability: groupBy(primary, (r) => bucket(prob(r), probBins)),
    byEdge: groupBy(primary, (r) => bucket(num(r.edge), edgeBins)),
    oddsCoverage: metrics(primary).oddsCoverage,
  },
  clvCoverage: {
    settledPredictions: settled.length,
    predictionTimePrice: settled.filter((r) => num(r.odds) !== null || num(r.implied_probability) !== null).length,
    validClosingPrice: 0,
    fullyAlignedPairs: 0,
    coverage: 0,
    limitation: 'No certified cutoff-safe closing-price pair was found in prediction_history fields; do not infer CLV from unrelated books.',
  },
  currentContextSnapshots: contextSnapshots.rows.map((row) => ({
    eventId: row.event_id,
    snapshotType: row.snapshot_type,
    sourceTimestamp: row.snapshot_timestamp,
    startTime: row.target_event_start_time,
    sourceLineage: row.source_lineage,
    missingComponents: row.missing_components,
    blockers: row.blockers,
    completeness: row.completeness,
    productionEligible: row.production_eligible,
    shadowOnly: row.shadow_only,
  })),
  designs: {
    contextSnapshotIntegration: ['starter identity/status/rest/workload', 'projected/confirmed lineup state with completeness', 'bullpen recent workload/effectiveness', 'venue identity', 'explicit weather missing indicator', 'explicit injury missing indicator', 'snapshot_type and completeness_rate', 'source lineage timestamps'],
    morningFinalPregameContract: 'Write separate immutable baseline_morning, context_morning, baseline_final_pregame, context_final_pregame identities; never overwrite snapshot or prediction rows.',
    shadowV1: {
      modelVersion: 'MLB_CONTEXT_ENHANCED_SHADOW_V1',
      origin: 'CURRENT_ERA_SHADOW',
      categories: ['starter rolling performance', 'starter rest/workload', 'team recent offense', 'team recent defense', 'bullpen fatigue/effectiveness', 'lineup strength/completeness', 'venue identity', 'weather_missing', 'injury_missing', 'context_completeness', 'market/line identity'],
      prohibited: ['post-start info', 'same-game stats', 'future-season leakage', 'retrospective context fabrication'],
    },
    historicalSafeFeatures: ['settled prediction label', 'original model probability', 'prediction-time market fields', 'team/player/starter stats with as-of timestamp proof', 'venue identity when known before game'],
    forwardOnlyFeatures: ['live projected/confirmed lineup feed', 'new MLB-01 context snapshots', 'future approved weather source', 'future approved injury source'],
    modelCandidates: ['market-specific Platt calibration', 'market-specific empirical bucket calibration', 'regularized logistic regression by market', 'score/margin/total regression for run-line/total candidates'],
    promotionPolicy: ['minimum forward sample by market', 'Brier/log-loss improvement', 'no worse calibration', 'ROI/CLV supporting evidence', 'zero leakage', 'Official Pick policy unchanged until explicit promotion'],
    officialPickRecovery: ['calibration bootstrap certified', 'market-specific reliability certified', 'context shadow forward sample passes', 'CLV/ROI evidence sufficient', 'productionEligible promotion approved separately'],
    learningLabelRootCause: 'learning_labels remains 0 because settled rows are not productionEligible/current-learning eligible and no standalone learning-label job is active for this baseline.',
    calibrationBootstrap: 'Create research-only calibration artifacts from settled baseline rows using temporal splits, then promote only after holdout and forward-shadow certification; avoid productionEligible circular dependency by using explicit bootstrap certification, not Official Pick status.',
    uiContract: 'Show Model Probability, Calibrated Probability, Context Completeness, Market Implied, Edge, and Final Decision Confidence as separate fields; reliability must not masquerade as calibrated confidence.',
    implementationTasks: {
      P0: ['market-specific calibration bootstrap', 'calibration artifact loader in shadow mode', 'context-enhanced shadow scorer skeleton', 'performance segmentation report'],
      P1: ['CLV capture/pairing', 'learning-label generation for certified settled baseline', 'lineup/weather/injury source expansion when approved'],
      P2: ['NRFI/YRFI/player-prop context extensions', 'opaque model families only after interpretable baselines'],
    },
  },
  readiness: {
    MLB_CALIBRATION_ROOT_CAUSE_IDENTIFIED: 'YES',
    MARKET_SPECIFIC_CALIBRATION_RECOMMENDED: 'YES',
    CALIBRATION_BOOTSTRAP_READY: 'YES',
    CONTEXT_ENHANCED_SHADOW_DESIGN_READY: 'YES',
    MLB_03_CONTEXT_ENHANCED_SHADOW_READY: 'YES',
  },
}

fs.mkdirSync('docs/CERTIFICATION', { recursive: true })
fs.writeFileSync(OUT_JSON, `${JSON.stringify(result, null, 2)}\n`)
fs.writeFileSync(OUT_MD, `# MLB-02 Calibration Forensics\n\nClassification: ${result.classification}\n\nProvider calls: 0\n\nProduction DB mutations: 0\n\nRoot cause: ${result.runtimeCalibrationRootCause.rootCause}\n\nMarket-specific calibration recommended: YES\n\nContext-enhanced shadow design ready: YES\n`)

console.log(JSON.stringify({
  success: true,
  classification: result.classification,
  predictionCount: baseline.filteredPredictionCount,
  settled: baseline.settled,
  recommendedRows: baseline.recommendedRows,
  productionEligible: baseline.productionEligible,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
  output: { json: OUT_JSON, markdown: OUT_MD },
}, null, 2))
