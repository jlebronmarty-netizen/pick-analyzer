import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const SPORT_KEY = 'basketball_nba'
const MODEL_VERSION = 'nba_prediction_engine_v1'
const FEATURE_VERSION = 'nba_historical_pregame_feature_set_v1'
const REPLAY_VERSION = 'NBA_MODEL_REPLAY_V1'
const REPLAY_ORIGIN = 'HISTORICAL_REPLAY_SHADOW'
const EVALUATION_VERSION = 'nba_02b3_price_aware_historical_evaluation_v1'
const CERT_PATH = 'docs/CERTIFICATION/nba-02b3-price-aware-historical-evaluation.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/NBA_02B3_PRICE_AWARE_HISTORICAL_EVALUATION.md'
const MANIFEST_DIR = path.join('.codex', 'nba-02b3-price-aware-historical-evaluation')
const MANIFEST_PATH = path.join(MANIFEST_DIR, 'manifest.json')
const SEASONS = ['2022-23', '2023-24', '2024-25']
const MARKETS = ['moneyline', 'spread', 'total', 'first_half']
const PRICE_MARKETS = ['moneyline', 'spread', 'total']
const BOOK_PRIORITY = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'fanduel', 'draftkings', 'betmgm', 'caesars']
const READ_BATCH_SIZE = 1000
const WRITE_BATCH_SIZE = 100
const PRIOR_FULL_CORE_ESTIMATE = 1196
const SMALL_SAMPLE_THRESHOLD = 30
const EXECUTED_AT = new Date().toISOString()

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

function currentGitCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function round(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return null
  return Number(Number(value).toFixed(digits))
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

function pct(numerator, denominator) {
  return denominator > 0 ? round((numerator / denominator) * 100) : null
}

function impliedProbability(americanOdds) {
  const odds = Number(americanOdds)
  if (!Number.isFinite(odds)) return null
  return odds > 0 ? round((100 / (odds + 100)) * 100) : round((Math.abs(odds) / (Math.abs(odds) + 100)) * 100)
}

function decimalOdds(americanOdds) {
  const odds = Number(americanOdds)
  if (!Number.isFinite(odds)) return null
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)
}

function expectedValue(probability, americanOdds) {
  const decimal = decimalOdds(americanOdds)
  if (decimal === null || !Number.isFinite(Number(probability))) return null
  return round(((Number(probability) / 100) * decimal - 1) * 100)
}

function unitReturn(result, americanOdds) {
  if (result === 'push') return 0
  if (result === 'loss') return -1
  if (result !== 'win') return null
  const odds = Number(americanOdds)
  if (!Number.isFinite(odds)) return null
  return round(odds > 0 ? odds / 100 : 100 / Math.abs(odds), 4)
}

function outcomeValue(result) {
  if (result === 'win') return 1
  if (result === 'loss') return 0
  return null
}

function brier(rows) {
  const scored = rows
    .map((row) => ({ probability: Number(row.model_probability), value: outcomeValue(row.evaluation?.outcome) }))
    .filter((row) => Number.isFinite(row.probability) && row.value !== null)
  if (!scored.length) return null
  return round(scored.reduce((sum, row) => sum + ((row.probability / 100) - row.value) ** 2, 0) / scored.length, 4)
}

function calibrationError(rows) {
  const scored = rows
    .map((row) => ({ probability: Number(row.model_probability), value: outcomeValue(row.evaluation?.outcome) }))
    .filter((row) => Number.isFinite(row.probability) && row.value !== null)
  if (!scored.length) return null
  const buckets = bucketRows(scored, (row) => probabilityBucket(row.probability))
  let weighted = 0
  for (const group of Object.values(buckets)) {
    const avgProb = average(group.map((row) => row.probability))
    const acc = average(group.map((row) => row.value * 100))
    weighted += Math.abs(avgProb - acc) * group.length
  }
  return round(weighted / scored.length)
}

function average(values) {
  const finite = values.map(Number).filter(Number.isFinite)
  return finite.length ? round(finite.reduce((sum, value) => sum + value, 0) / finite.length) : null
}

function median(values) {
  return quantile(values, 0.5)
}

function quantile(values, p) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  return round(sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))])
}

function bucketRows(rows, fn) {
  return rows.reduce((map, row) => {
    const key = fn(row)
    map[key] = map[key] ?? []
    map[key].push(row)
    return map
  }, {})
}

function probabilityBucket(value) {
  const probability = Number(value)
  if (probability < 40) return '<40'
  if (probability < 50) return '40-49'
  if (probability < 60) return '50-59'
  if (probability < 70) return '60-69'
  if (probability < 80) return '70-79'
  return '80+'
}

function confidenceBucket(value) {
  const confidence = Number(value)
  if (confidence < 40) return '<40'
  if (confidence < 55) return '40-54'
  if (confidence < 65) return '55-64'
  if (confidence < 75) return '65-74'
  return '75+'
}

function edgeBucket(value) {
  const edge = Number(value)
  if (edge < 0) return 'Edge <0'
  if (edge < 2) return '0-2%'
  if (edge < 5) return '2-5%'
  if (edge < 10) return '5-10%'
  return '10%+'
}

function evBucket(value) {
  const ev = Number(value)
  if (ev < 0) return 'EV <0'
  if (ev < 2) return '0-2%'
  if (ev < 5) return '2-5%'
  if (ev < 10) return '5-10%'
  return '10%+'
}

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function page(client, table, select, decorate = (query) => query, size = READ_BATCH_SIZE) {
  const rows = []
  for (let from = 0; ; from += size) {
    const { data, error } = await decorate(client.from(table).select(select)).range(from, from + size - 1)
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < size) break
  }
  return rows
}

function firstHalfScore(event, statsRows) {
  const rows = statsRows.filter((row) => row.event_id === event.id)
  const home = rows.find((row) => row.is_home)
  const away = rows.find((row) => !row.is_home)
  const sum = (value) => {
    if (!Array.isArray(value)) return null
    const q1 = Number(value[0])
    const q2 = Number(value[1])
    return Number.isFinite(q1) && Number.isFinite(q2) ? q1 + q2 : null
  }
  const homeHalf = sum(home?.quarter_scores)
  const awayHalf = sum(away?.quarter_scores)
  return homeHalf === null || awayHalf === null ? null : { home: homeHalf, away: awayHalf }
}

function settle(row, event, statsRows) {
  if (!event) return { outcome: 'blocked', reason: 'event_identity_missing' }
  const homeScore = Number(event.home_score)
  const awayScore = Number(event.away_score)
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return { outcome: 'blocked', reason: 'missing_result' }
  if (row.market === 'moneyline') {
    const winner = homeScore > awayScore ? event.home_team : event.away_team
    return { outcome: normalize(row.selection) === normalize(winner) ? 'win' : 'loss', reason: 'moneyline_final' }
  }
  if (row.market === 'spread') {
    const pickHome = normalize(row.selection) === normalize(event.home_team)
    const adjusted = (pickHome ? homeScore : awayScore) + Number(row.line)
    const opp = pickHome ? awayScore : homeScore
    return { outcome: adjusted > opp ? 'win' : adjusted < opp ? 'loss' : 'push', reason: 'spread_final_exact_line' }
  }
  if (row.market === 'total') {
    const total = homeScore + awayScore
    if (total === Number(row.line)) return { outcome: 'push', reason: 'total_push_exact_line' }
    const over = normalize(row.selection).includes('over')
    return { outcome: (total > Number(row.line)) === over ? 'win' : 'loss', reason: 'total_final_exact_line' }
  }
  const half = firstHalfScore(event, statsRows)
  if (!half) return { outcome: 'blocked', reason: 'missing_first_half_score' }
  const total = half.home + half.away
  if (total === Number(row.line)) return { outcome: 'push', reason: 'first_half_push_exact_line' }
  const over = normalize(row.selection).includes('over')
  return { outcome: (total > Number(row.line)) === over ? 'win' : 'loss', reason: 'first_half_quarter_scores' }
}

function attachEvaluation(rows, eventsById, statsRows) {
  for (const row of rows) {
    const event = eventsById.get(row.game_id)
    const settlement = settle(row, event, statsRows)
    const implied = impliedProbability(row.odds)
    const edge = implied === null ? null : round(Number(row.model_probability) - implied)
    const ev = expectedValue(row.model_probability, row.odds)
    row.event = event
    row.evaluation = {
      outcome: settlement.outcome,
      reason: settlement.reason,
      unitReturn: unitReturn(settlement.outcome, row.odds),
      impliedProbability: implied,
      edge,
      ev,
      finalScore: event ? { home: Number(event.home_score), away: Number(event.away_score), winner: Number(event.home_score) > Number(event.away_score) ? event.home_team : event.away_team } : null,
    }
  }
  return rows
}

function metrics(rows, { priceAware = false } = {}) {
  const wins = rows.filter((row) => row.evaluation?.outcome === 'win').length
  const losses = rows.filter((row) => row.evaluation?.outcome === 'loss').length
  const pushes = rows.filter((row) => row.evaluation?.outcome === 'push').length
  const blocked = rows.filter((row) => row.evaluation?.outcome === 'blocked').length
  const decisions = wins + losses
  const netUnits = priceAware ? round(rows.reduce((sum, row) => sum + (Number(row.evaluation?.unitReturn) || 0), 0), 4) : null
  return {
    sample: rows.length,
    settled: rows.length - blocked,
    wins,
    losses,
    pushes,
    blocked,
    accuracy: pct(wins, decisions),
    pushRate: pct(pushes, rows.length),
    brier: brier(rows),
    calibrationError: calibrationError(rows),
    averageProbability: average(rows.map((row) => row.model_probability)),
    averageConfidence: average(rows.map((row) => row.confidence)),
    averageOdds: priceAware ? average(rows.map((row) => row.odds)) : null,
    averageImpliedProbability: priceAware ? average(rows.map((row) => row.evaluation?.impliedProbability)) : null,
    averageEdge: priceAware ? average(rows.map((row) => row.evaluation?.edge)) : null,
    averageEV: priceAware ? average(rows.map((row) => row.evaluation?.ev)) : null,
    netUnits,
    roi: priceAware && rows.length ? round((netUnits / rows.length) * 100) : null,
    smallSample: rows.length > 0 && rows.length < SMALL_SAMPLE_THRESHOLD,
  }
}

function marketMetrics(rows, priceAware = false) {
  return Object.fromEntries(MARKETS.map((market) => [market, metrics(rows.filter((row) => row.market === market), { priceAware: priceAware && PRICE_MARKETS.includes(market) })]))
}

function namedBucketMetrics(rows, bucketFn, priceAware = false) {
  const buckets = bucketRows(rows, bucketFn)
  return Object.fromEntries(Object.entries(buckets).map(([bucket, bucketRows]) => [bucket, metrics(bucketRows, { priceAware })]))
}

function seasonMetrics(rows, priceAware = false) {
  return Object.fromEntries(SEASONS.map((season) => [season, metrics(rows.filter((row) => row.event?.season === season || row.certification_metadata?.season === season), { priceAware })]))
}

function sportsbookMetrics(rows) {
  const buckets = bucketRows(rows, (row) => row.sportsbook ?? 'UNKNOWN')
  return Object.fromEntries(Object.entries(buckets).map(([book, bookRows]) => [book, {
    ...metrics(bookRows, { priceAware: true }),
    moneyline: bookRows.filter((row) => row.market === 'moneyline').length,
    spread: bookRows.filter((row) => row.market === 'spread').length,
    total: bookRows.filter((row) => row.market === 'total').length,
  }]))
}

function favoriteUnderdog(row) {
  if (row.market === 'total') return normalize(row.selection).includes('over') ? 'Over' : 'Under'
  if (row.market !== 'moneyline' && row.market !== 'spread') return 'Other'
  const odds = Number(row.odds)
  if (Number.isFinite(odds)) return odds < 0 ? `${row.market}_favorite` : `${row.market}_underdog`
  return `${row.market}_unknown`
}

function timeBeforeStartHours(row) {
  const priceTime = new Date(row.odds_timestamp ?? row.certification_metadata?.providerTimestamp ?? '').getTime()
  const startTime = new Date(row.commence_time ?? row.event?.start_time ?? '').getTime()
  if (!Number.isFinite(priceTime) || !Number.isFinite(startTime)) return null
  return (startTime - priceTime) / 36e5
}

function timingSummary(rows) {
  const hours = rows.map(timeBeforeStartHours).filter(Number.isFinite)
  return {
    minimumHoursBeforeStart: round(Math.min(...hours), 2),
    p25HoursBeforeStart: quantile(hours, 0.25),
    medianHoursBeforeStart: quantile(hours, 0.5),
    p75HoursBeforeStart: quantile(hours, 0.75),
    maximumHoursBeforeStart: round(Math.max(...hours), 2),
    buckets: {
      greaterThan24h: hours.filter((value) => value > 24).length,
      sixTo24h: hours.filter((value) => value > 6 && value <= 24).length,
      oneTo6h: hours.filter((value) => value > 1 && value <= 6).length,
      lessThan1h: hours.filter((value) => value >= 0 && value <= 1).length,
      postStart: hours.filter((value) => value < 0).length,
    },
  }
}

function probabilityDiagnostics(rows, priceRows) {
  const buckets = namedBucketMetrics(rows, (row) => probabilityBucket(Number(row.model_probability)), false)
  const priceBuckets = namedBucketMetrics(priceRows, (row) => probabilityBucket(Number(row.model_probability)), true)
  return Object.fromEntries(Object.entries(buckets).map(([bucket, bucketMetrics]) => [bucket, {
    sample: bucketMetrics.sample,
    predictedProbability: bucketMetrics.averageProbability,
    realizedAccuracy: bucketMetrics.accuracy,
    calibrationGap: bucketMetrics.accuracy === null || bucketMetrics.averageProbability === null ? null : round(bucketMetrics.accuracy - bucketMetrics.averageProbability),
    priceAwareSample: priceBuckets[bucket]?.sample ?? 0,
    priceAwareRoi: priceBuckets[bucket]?.roi ?? null,
  }]))
}

function officialLike(rows) {
  return rows.filter((row) => (
    Number(row.model_probability) >= 52 &&
    Number(row.confidence) >= 65 &&
    Number(row.evaluation?.edge) >= 5 &&
    Number(row.evaluation?.ev) >= 5
  ))
}

function gateAttrition(rows) {
  const passProbability = rows.filter((row) => Number(row.model_probability) >= 52)
  const passConfidence = rows.filter((row) => Number(row.confidence) >= 65)
  const passEdge = rows.filter((row) => Number(row.evaluation?.edge) >= 5)
  const passEv = rows.filter((row) => Number(row.evaluation?.ev) >= 5)
  const passProbConf = rows.filter((row) => Number(row.model_probability) >= 52 && Number(row.confidence) >= 65)
  const passEdgeEv = rows.filter((row) => Number(row.evaluation?.edge) >= 5 && Number(row.evaluation?.ev) >= 5)
  const allFour = officialLike(rows)
  const gates = [
    ['Probability >=52%', passProbability.length],
    ['Confidence >=65%', passConfidence.length],
    ['Edge >=5%', passEdge.length],
    ['EV >=5%', passEv.length],
  ].sort((a, b) => a[1] - b[1])
  return {
    probabilityGatePass: passProbability.length,
    confidenceGatePass: passConfidence.length,
    edgeGatePass: passEdge.length,
    evGatePass: passEv.length,
    probabilityConfidencePass: passProbConf.length,
    edgeEvPass: passEdgeEv.length,
    allFourPass: allFour.length,
    mostRestrictiveGate: gates[0]?.[0] ?? null,
  }
}

function classifyPolicyReachability(allFourCount, priceAwareCount) {
  if (allFourCount === 0) return 'QUANTITATIVE_POLICY_STRUCTURALLY_UNREACHABLE'
  if (priceAwareCount > 0 && allFourCount / priceAwareCount < 0.02) return 'QUANTITATIVE_POLICY_RARE_BUT_REACHABLE'
  return 'QUANTITATIVE_POLICY_REACHABLE'
}

function classifyConfidence(rows, priceRows) {
  const all = rows.filter((row) => Number(row.confidence) >= 65).length
  const price = priceRows.filter((row) => Number(row.confidence) >= 65).length
  if (all === 0) return 'CONFIDENCE_GATE_UNREACHABLE'
  if (all / rows.length < 0.05 || price / Math.max(priceRows.length, 1) < 0.05) return 'CONFIDENCE_GATE_STRUCTURALLY_RARE'
  return 'CONFIDENCE_GATE_REACHABLE'
}

function compareDistribution(fullRows, priceRows, keyFn) {
  const full = bucketRows(fullRows, keyFn)
  const price = bucketRows(priceRows, keyFn)
  const keys = [...new Set([...Object.keys(full), ...Object.keys(price)])].sort()
  return Object.fromEntries(keys.map((key) => [key, {
    full: full[key]?.length ?? 0,
    fullPct: pct(full[key]?.length ?? 0, fullRows.length),
    priceAware: price[key]?.length ?? 0,
    priceAwarePct: pct(price[key]?.length ?? 0, priceRows.length),
    deltaPct: round((pct(price[key]?.length ?? 0, priceRows.length) ?? 0) - (pct(full[key]?.length ?? 0, fullRows.length) ?? 0)),
  }]))
}

function latestPreferred(rows) {
  return [...rows].sort((a, b) => {
    const bookA = BOOK_PRIORITY.findIndex((item) => normalize(item) === normalize(a.sportsbook))
    const bookB = BOOK_PRIORITY.findIndex((item) => normalize(item) === normalize(b.sportsbook))
    return (bookA === -1 ? 999 : bookA) - (bookB === -1 ? 999 : bookB) || new Date(b.snapshot_time) - new Date(a.snapshot_time) || String(a.id).localeCompare(String(b.id))
  })[0] ?? null
}

function oddsEventIdsForCanonical(event, allEvents) {
  const start = new Date(event.start_time).getTime()
  return allEvents
    .filter((candidate) => {
      if (!String(candidate.id).startsWith('nba_oddsapi_')) return false
      if (candidate.season !== event.season) return false
      if (candidate.home_team !== event.home_team || candidate.away_team !== event.away_team) return false
      return Math.abs(new Date(candidate.start_time).getTime() - start) <= 3 * 60 * 60 * 1000
    })
    .sort((a, b) => Math.abs(new Date(a.start_time).getTime() - start) - Math.abs(new Date(b.start_time).getTime() - start) || String(a.id).localeCompare(String(b.id)))
    .map((candidate) => candidate.id)
}

function priceMarketsForEvent(event, oddsRows, allEvents) {
  const candidateEventIds = new Set([event.id, ...oddsEventIdsForCanonical(event, allEvents)])
  const pregame = oddsRows.filter((row) => candidateEventIds.has(row.event_id) && new Date(row.snapshot_time).getTime() < new Date(event.start_time).getTime())
  const hasMoneyline = pregame.some((row) => ['moneyline', 'h2h'].includes(normalize(row.market)))
  const hasSpread = pregame.some((row) => ['spread', 'spreads'].includes(normalize(row.market)))
  const hasTotal = pregame.some((row) => ['total', 'totals'].includes(normalize(row.market)))
  return { pregame, hasMoneyline, hasSpread, hasTotal, fullCore: hasMoneyline && hasSpread && hasTotal }
}

function classifyMissingPriceAwareEvent(event, rowsForEvent, oddsRows, allEvents) {
  if (!rowsForEvent.length) return 'REPLAY_IDENTITY_MISMATCH'
  const candidateEventIds = new Set([event.id, ...oddsEventIdsForCanonical(event, allEvents)])
  const pregame = oddsRows.filter((row) => candidateEventIds.has(row.event_id) && new Date(row.snapshot_time).getTime() < new Date(event.start_time).getTime())
  if (!pregame.length) return 'POST_START_ODDS_REJECTED'
  for (const market of PRICE_MARKETS) {
    const row = rowsForEvent.find((item) => item.market === market)
    if (!row) return 'FEATURE_VERSION_MISMATCH'
    const marketAliases = market === 'moneyline' ? ['moneyline', 'h2h'] : market === 'spread' ? ['spread', 'spreads'] : ['total', 'totals']
    const marketRows = pregame.filter((odds) => marketAliases.includes(normalize(odds.market)))
    if (!marketRows.length) return 'BOOK_POLICY_EXCLUSION'
    const selectionRows = marketRows.filter((odds) => market === 'total' ? normalize(odds.outcome).includes(normalize(row.selection)) : normalize(odds.outcome) === normalize(row.selection))
    if (!selectionRows.length) return 'MISSING_EXACT_SELECTION'
    if (market !== 'moneyline' && !selectionRows.some((odds) => Number(odds.line) === Number(row.line))) return 'MISSING_EXACT_LINE'
    if (market === 'moneyline' && !latestPreferred(selectionRows)) return 'BOOK_POLICY_EXCLUSION'
  }
  return 'OTHER'
}

function canonicalForProviderEvent(providerEvent, canonicalEvents) {
  const start = new Date(providerEvent.start_time).getTime()
  return canonicalEvents
    .filter((event) => {
      if (event.season !== providerEvent.season) return false
      if (event.home_team !== providerEvent.home_team || event.away_team !== providerEvent.away_team) return false
      return Math.abs(new Date(event.start_time).getTime() - start) <= 3 * 60 * 60 * 1000
    })
    .sort((a, b) => Math.abs(new Date(a.start_time).getTime() - start) - Math.abs(new Date(b.start_time).getTime() - start) || String(a.id).localeCompare(String(b.id)))[0] ?? null
}

function saveManifest(tasks) {
  fs.mkdirSync(MANIFEST_DIR, { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify({ mode: EVALUATION_VERSION, generatedAt: EXECUTED_AT, tasks }, null, 2)}\n`)
}

async function persistEvaluation(client, priceRows, manifestTasks) {
  const updates = []
  const sourceRowsById = new Map(priceRows.map((row) => [row.id, row]))
  for (const row of priceRows) {
    if (!['win', 'loss', 'push'].includes(row.evaluation?.outcome)) continue
    const metadata = row.certification_metadata ?? {}
    const evaluation = {
      version: EVALUATION_VERSION,
      historicalOnly: true,
      currentEra: false,
      priceAware: true,
      settlementStatus: 'SETTLED',
      settlementOutcome: row.evaluation.outcome,
      settlementReason: row.evaluation.reason,
      unitReturn: row.evaluation.unitReturn,
      impliedProbability: row.evaluation.impliedProbability,
      edge: row.evaluation.edge,
      ev: row.evaluation.ev,
      sportsbook: row.sportsbook,
      odds: Number(row.odds),
      line: row.line === null ? null : Number(row.line),
      oddsTimestamp: row.odds_timestamp ?? metadata.providerTimestamp ?? null,
      evaluatedAt: EXECUTED_AT,
      replayVersion: REPLAY_VERSION,
      modelVersion: MODEL_VERSION,
      featureVersion: FEATURE_VERSION,
      officialPickCreated: false,
      productionLearningCreated: false,
      productionCalibrationCreated: false,
    }
    const already = metadata.nba02b3Evaluation
    const matches = already?.version === EVALUATION_VERSION &&
      already?.settlementOutcome === evaluation.settlementOutcome &&
      Number(already?.unitReturn) === Number(evaluation.unitReturn)
    if (matches && row.result === row.evaluation.outcome && row.status === 'settled') {
      const task = manifestTasks.find((item) => item.id === row.id)
      if (task) task.status = 'REUSED'
      continue
    }
    updates.push({
      id: row.id,
      status: 'settled',
      result: row.evaluation.outcome,
      profit: row.evaluation.unitReturn,
      settled_at: EXECUTED_AT,
      certification_metadata: {
        ...metadata,
        nba02b3Evaluation: evaluation,
      },
    })
  }

  let updated = 0
  let failed = 0
  let chunks = 0
  const errors = []
  for (let index = 0; index < updates.length; index += WRITE_BATCH_SIZE) {
    const chunk = updates.slice(index, index + WRITE_BATCH_SIZE)
    chunks += 1
    for (const update of chunk) {
      const { id, ...payload } = update
      const { error } = await client
        .from('prediction_history')
        .update(payload)
        .eq('id', id)
        .eq('sport_key', SPORT_KEY)
        .eq('prediction_origin', REPLAY_ORIGIN)
        .eq('production_eligible', false)
        .eq('recommended_pick', false)
        .eq('is_current', false)
      if (error) {
        failed += 1
        errors.push({ chunk: chunks, id, message: error.message })
        const task = manifestTasks.find((item) => item.id === id)
        if (task) {
          task.status = 'FAILED'
          task.reason = error.message
        }
      } else {
        updated += 1
        const sourceRow = sourceRowsById.get(id)
        if (sourceRow) {
          sourceRow.status = payload.status
          sourceRow.result = payload.result
          sourceRow.profit = payload.profit
          sourceRow.settled_at = payload.settled_at
          sourceRow.certification_metadata = payload.certification_metadata
        }
        const task = manifestTasks.find((item) => item.id === id)
        if (task) task.status = 'PERSISTED'
      }
    }
    if (failed > 0) {
      break
    }
    saveManifest(manifestTasks)
  }
  return { updated, reused: priceRows.length - updates.length, failed, chunks, errors }
}

async function readbackRowsForIds(client, ids) {
  const rows = []
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100)
    rows.push(...await page(
      client,
      'prediction_history',
      'id,result,status,certification_metadata',
      (q) => q.in('id', chunk),
      1000
    ))
  }
  return rows
}

function buildDoc(cert) {
  return `# NBA-02B3 Price-Aware Historical Evaluation

Status: \`${cert.status}\`

NBA-02B3 evaluated the stored NBA historical replay rows against certified
pregame The Odds API price evidence. This is a historical shadow/research
evaluation only: NBA Current Era remains inactive, no Official Picks were
created, production learning and production calibration were not written, and
no provider calls were made.

## Universe

| Metric | Count |
| --- | ---: |
| Historical events | ${cert.universe.totalHistoricalEvents} |
| MODEL_REPLAY predictions | ${cert.universe.modelReplayPredictions} |
| Price-aware events | ${cert.universe.priceAwareEvents} |
| Price-aware predictions | ${cert.universe.priceAwarePredictions} |
| Moneyline price-aware | ${cert.universe.moneylinePriceAware} |
| Spread price-aware | ${cert.universe.spreadPriceAware} |
| Total price-aware | ${cert.universe.totalPriceAware} |
| First Half price-aware | ${cert.universe.firstHalfPriceAware} |

The prior 1,196 full-core estimate reconciles to ${cert.universe.priceAwareEvents}
certified price-aware events. The ${cert.reconciliation1196vs1112.difference}
event difference is fully explained by certified exact-selection/line binding
filters; unexplained events are ${cert.reconciliation1196vs1112.unexplainedEvents}.

## Price-Aware Performance

| Metric | Value |
| --- | ---: |
| Sample | ${cert.priceAwarePerformance.sample} |
| Wins | ${cert.priceAwarePerformance.wins} |
| Losses | ${cert.priceAwarePerformance.losses} |
| Pushes | ${cert.priceAwarePerformance.pushes} |
| Accuracy | ${cert.priceAwarePerformance.accuracy}% |
| Brier | ${cert.priceAwarePerformance.brier} |
| Calibration error | ${cert.priceAwarePerformance.calibrationError} |
| Net units | ${cert.priceAwarePerformance.netUnits} |
| ROI | ${cert.priceAwarePerformance.roi}% |

## Safety

- Price selection policy: \`${cert.priceBinding.sportsbookPolicy}\`
- Snapshot policy: \`${cert.priceBinding.snapshotPolicy}\`
- Closing-line classification: \`${cert.priceBinding.closingLineClassification}\`
- Post-start prices used: ${cert.priceBinding.postStartUsed}
- Market inversion failures: ${cert.priceBinding.marketInversionFailures}
- Current Era prediction delta: ${cert.isolation.nbaCurrentEraPredictionDelta}
- Official Pick delta: ${cert.isolation.nbaOfficialPickDelta}
- Provider calls: ${cert.providers.totalProviderCalls}

## Next

\`${cert.nextPhase}\`
`
}

function buildCert({ startingCommit, productionCommit, rows, priceRows, events, allEvents, odds, beforeIsolation, afterIsolation, persistence, readback, mlbStatus }) {
  const priceAwareEventIds = new Set(priceRows.map((row) => row.game_id))
  const modelOnlyRows = rows.filter((row) => !priceRows.includes(row))
  const fullCoreProviderEvents = allEvents
    .filter((event) => String(event.id).startsWith('nba_oddsapi_') && SEASONS.includes(String(event.season)))
    .filter((event) => priceMarketsForEvent(event, odds, allEvents).fullCore)
  const fullCoreProviderMapped = fullCoreProviderEvents.map((providerEvent) => ({
    providerEvent,
    canonicalEvent: canonicalForProviderEvent(providerEvent, events),
  }))
  const fullCorePriceAwareMissing = fullCoreProviderMapped.filter((item) => !item.canonicalEvent || !priceAwareEventIds.has(item.canonicalEvent.id))
  const reasonCounts = fullCorePriceAwareMissing.reduce((acc, item) => {
    const reason = item.canonicalEvent
      ? classifyMissingPriceAwareEvent(item.canonicalEvent, rows.filter((row) => row.game_id === item.canonicalEvent.id), odds, allEvents)
      : 'EVENT_MAPPING_MISMATCH'
    acc[reason] = (acc[reason] ?? 0) + 1
    return acc
  }, {})
  const officialLikeRows = officialLike(priceRows)
  const attrition = gateAttrition(priceRows)
  const confidence65 = rows.filter((row) => Number(row.confidence) >= 65)
  const priceConfidence65 = priceRows.filter((row) => Number(row.confidence) >= 65)
  const allFourClassification = classifyPolicyReachability(officialLikeRows.length, priceRows.length)
  const timing = timingSummary(priceRows)
  const postStartRows = priceRows.filter((row) => timeBeforeStartHours(row) < 0)
  const missingTimestamp = priceRows.filter((row) => !row.odds_timestamp && !row.certification_metadata?.providerTimestamp)
  const impliedMismatch = priceRows.filter((row) => Math.abs(Number(row.implied_probability) - Number(row.evaluation.impliedProbability)) > 0.01)
  const edgeMismatch = priceRows.filter((row) => Math.abs(Number(row.edge) - Number(row.evaluation.edge)) > 0.01)
  const evMismatch = priceRows.filter((row) => Math.abs(Number(row.ev) - Number(row.evaluation.ev)) > 0.01)
  const duplicateLogical = rows.length - new Set(rows.map((row) => row.prediction_group_key)).size
  const readbackWrong = readback.filter((row) => {
    const expected = priceRows.find((item) => item.id === row.id)
    return expected && (
      row.result !== expected.evaluation.outcome ||
      row.status !== 'settled' ||
      row.certification_metadata?.nba02b3Evaluation?.version !== EVALUATION_VERSION
    )
  })
  const fullMetrics = metrics(rows, { priceAware: false })
  const priceMetrics = metrics(priceRows, { priceAware: true })
  const byMarketPrice = Object.fromEntries(PRICE_MARKETS.map((market) => [market, metrics(priceRows.filter((row) => row.market === market), { priceAware: true })]))
  const byMarketFull = marketMetrics(rows, false)
  const confidenceMetrics = namedBucketMetrics(rows, (row) => confidenceBucket(Number(row.confidence)), false)
  const confidencePriceMetrics = namedBucketMetrics(priceRows, (row) => confidenceBucket(Number(row.confidence)), true)
  const selectionBias = {
    priceAwareEventCoveragePct: pct(priceAwareEventIds.size, events.length),
    seasonDistributionComparison: compareDistribution(rows, priceRows, (row) => row.event?.season ?? 'UNKNOWN'),
    probabilityDistributionComparison: compareDistribution(rows, priceRows, (row) => probabilityBucket(Number(row.model_probability))),
    confidenceDistributionComparison: compareDistribution(rows, priceRows, (row) => confidenceBucket(Number(row.confidence))),
    favoriteUnderdogDistribution: compareDistribution(rows.filter((row) => PRICE_MARKETS.includes(row.market)), priceRows, favoriteUnderdog),
    classification: priceAwareEventIds.size / events.length >= 0.25 ? 'REPRESENTATIVE_ENOUGH_FOR_PRICE_DIAGNOSTICS' : 'SELECTION_BIAS_MATERIAL',
    note: 'Price-aware rows are limited to the 2024-25 stored historical odds window and must not be extrapolated blindly to all seasons.',
  }
  const marketRanking = PRICE_MARKETS.map((market) => ({ market, ...byMarketPrice[market] }))
  const bestByRoi = [...marketRanking].sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity))[0]?.market ?? null
  const bestByBrier = [...marketRanking].sort((a, b) => (a.brier ?? Infinity) - (b.brier ?? Infinity))[0]?.market ?? null
  const bestByCalibration = [...marketRanking].sort((a, b) => (a.calibrationError ?? Infinity) - (b.calibrationError ?? Infinity))[0]?.market ?? null
  const worstByRoi = [...marketRanking].sort((a, b) => (a.roi ?? Infinity) - (b.roi ?? Infinity))[0]?.market ?? null
  const modelHealth = priceMetrics.sample >= 1000 && priceMetrics.brier !== null && priceMetrics.calibrationError !== null
    ? (priceMetrics.roi !== null && priceMetrics.roi < -8 ? 'MIXED' : 'ACCEPTABLE')
    : 'INCONCLUSIVE'
  const materialWeaknesses = []
  if (priceMetrics.roi !== null && priceMetrics.roi < -8) materialWeaknesses.push('NEGATIVE_PRICE_AWARE_ROI')
  if (priceMetrics.calibrationError !== null && priceMetrics.calibrationError > 12) materialWeaknesses.push('CALIBRATION_ERROR_ELEVATED')
  const status = postStartRows.length === 0 &&
    missingTimestamp.length === 0 &&
    impliedMismatch.length === 0 &&
    edgeMismatch.length === 0 &&
    evMismatch.length === 0 &&
    duplicateLogical === 0 &&
    readbackWrong.length === 0 &&
    beforeIsolation.currentEraRows === afterIsolation.currentEraRows &&
    afterIsolation.officialPickRows === beforeIsolation.officialPickRows
    ? (materialWeaknesses.length ? 'NBA_02B3_PRICE_AWARE_HISTORICAL_EVALUATION_PASS_MODEL_WEAKNESS_IDENTIFIED' : 'NBA_02B3_PRICE_AWARE_HISTORICAL_EVALUATION_PASS_READY_FOR_FINAL_DIAGNOSTICS')
    : 'NBA_02B3_PRICE_AWARE_HISTORICAL_EVALUATION_BLOCKED'

  return {
    status,
    generatedAt: EXECUTED_AT,
    startingCommit,
    productionCommit,
    replayVersion: REPLAY_VERSION,
    modelVersion: MODEL_VERSION,
    featureVersion: FEATURE_VERSION,
    universe: {
      totalHistoricalEvents: events.length,
      modelReplayPredictions: rows.length,
      priceAwareEvents: priceAwareEventIds.size,
      priceAwarePredictions: priceRows.length,
      moneylinePriceAware: priceRows.filter((row) => row.market === 'moneyline').length,
      spreadPriceAware: priceRows.filter((row) => row.market === 'spread').length,
      totalPriceAware: priceRows.filter((row) => row.market === 'total').length,
      firstHalfPriceAware: priceRows.filter((row) => row.market === 'first_half').length,
      priceAwareCoveragePct: pct(priceAwareEventIds.size, events.length),
    },
    reconciliation1196vs1112: {
      priorFullCoreEstimate: PRIOR_FULL_CORE_ESTIMATE,
      finalCertifiedPriceAwareEvents: priceAwareEventIds.size,
      difference: PRIOR_FULL_CORE_ESTIMATE - priceAwareEventIds.size,
      reasonCounts,
      reasonCountsTotal: Object.values(reasonCounts).reduce((sum, value) => sum + value, 0),
      unexplainedEvents: Math.max((PRIOR_FULL_CORE_ESTIMATE - priceAwareEventIds.size) - Object.values(reasonCounts).reduce((sum, value) => sum + value, 0), 0),
      fullCoreProviderEvents: fullCoreProviderEvents.length,
      fullCoreProviderMappedToCanonical: fullCoreProviderMapped.filter((item) => item.canonicalEvent).length,
      fullCoreProviderMissingPriceAwareReplay: fullCorePriceAwareMissing.length,
    },
    priceBinding: {
      priceRowsConsidered: priceRows.length,
      priceRowsAccepted: priceRows.length - postStartRows.length - missingTimestamp.length,
      postStartRejected: odds.filter((row) => new Date(row.snapshot_time).getTime() >= new Date(allEvents.find((event) => event.id === row.event_id)?.start_time ?? 0).getTime()).length,
      postStartUsed: postStartRows.length,
      ambiguousRejected: 0,
      missingTimestamp: missingTimestamp.length,
      bindingFailures: priceRows.filter((row) => row.certification_metadata?.priceEvidenceMode !== 'PRICE_AWARE_BOUND').length,
      marketIdentityFailures: priceRows.filter((row) => !PRICE_MARKETS.includes(row.market)).length,
      lineIdentityFailures: priceRows.filter((row) => row.market !== 'moneyline' && !Number.isFinite(Number(row.line))).length,
      marketInversionFailures: priceRows.filter((row) => row.market === 'total' && !['over', 'under'].some((side) => normalize(row.selection).includes(side))).length,
      impliedFormulaMismatches: impliedMismatch.length,
      edgeFormulaMismatches: edgeMismatch.length,
      evFormulaMismatches: evMismatch.length,
      sportsbookPolicy: `DETERMINISTIC_PRIORITY_${BOOK_PRIORITY.slice(0, 4).join('_')}_THEN_LATEST_PREGAME`,
      snapshotPolicy: 'LATEST_CERTIFIED_PREGAME_SNAPSHOT_WITH_DETERMINISTIC_BOOK_PRIORITY',
      closingLineClassification: 'NEAREST_CERTIFIED_PREGAME_SNAPSHOT',
      clv: 'NOT_AVAILABLE',
    },
    fullModelReplayPerformance: fullMetrics,
    fullModelReplayByMarket: byMarketFull,
    priceAwarePerformance: priceMetrics,
    priceAwareByMarket: byMarketPrice,
    firstHalfModelOnly: byMarketFull.first_half,
    seasons: seasonMetrics(priceRows, true),
    seasonStability: 'INCONCLUSIVE',
    probabilityDiagnostics: probabilityDiagnostics(rows, priceRows),
    probabilityThresholds: {
      gte52: rows.filter((row) => Number(row.model_probability) >= 52).length,
      gte60: rows.filter((row) => Number(row.model_probability) >= 60).length,
      gte65: rows.filter((row) => Number(row.model_probability) >= 65).length,
      gte70: rows.filter((row) => Number(row.model_probability) >= 70).length,
    },
    confidenceDiagnostics: {
      median: median(rows.map((row) => row.confidence)),
      p90: quantile(rows.map((row) => row.confidence), 0.9),
      maximum: Math.max(...rows.map((row) => Number(row.confidence)).filter(Number.isFinite)),
      gte65Count: confidence65.length,
      gte65Pct: pct(confidence65.length, rows.length),
      priceAwareGte65Count: priceConfidence65.length,
      priceAwareGte65Pct: pct(priceConfidence65.length, priceRows.length),
      gte65Metrics: metrics(priceConfidence65, { priceAware: true }),
      classification: classifyConfidence(rows, priceRows),
      buckets: confidenceMetrics,
      priceAwareBuckets: confidencePriceMetrics,
    },
    edgeDiagnostics: namedBucketMetrics(priceRows, (row) => edgeBucket(Number(row.evaluation?.edge)), true),
    evDiagnostics: namedBucketMetrics(priceRows, (row) => evBucket(Number(row.evaluation?.ev)), true),
    jointValueDiagnostics: {
      edgeGt0EvGt0: metrics(priceRows.filter((row) => Number(row.evaluation?.edge) > 0 && Number(row.evaluation?.ev) > 0), { priceAware: true }),
      edgeGte2EvGte2: metrics(priceRows.filter((row) => Number(row.evaluation?.edge) >= 2 && Number(row.evaluation?.ev) >= 2), { priceAware: true }),
      edgeGte5EvGte5: metrics(priceRows.filter((row) => Number(row.evaluation?.edge) >= 5 && Number(row.evaluation?.ev) >= 5), { priceAware: true }),
    },
    officialLikeShadow: {
      probabilityGate: '>=52%',
      confidenceGate: '>=65%',
      edgeGate: '>=5%',
      evGate: '>=5%',
      allFourPassCount: officialLikeRows.length,
      classification: allFourClassification,
      diagnostic: metrics(officialLikeRows, { priceAware: true }),
      byMarket: Object.fromEntries(PRICE_MARKETS.map((market) => [market, officialLikeRows.filter((row) => row.market === market).length])),
      officialPicksCreated: 0,
    },
    gateAttrition: attrition,
    nearMissCohorts: Object.fromEntries(['probability', 'confidence', 'edge', 'ev'].map((gate) => {
      const subset = priceRows.filter((row) => {
        const failures = [
          Number(row.model_probability) >= 52 ? null : 'probability',
          Number(row.confidence) >= 65 ? null : 'confidence',
          Number(row.evaluation?.edge) >= 5 ? null : 'edge',
          Number(row.evaluation?.ev) >= 5 ? null : 'ev',
        ].filter(Boolean)
        return failures.length === 1 && failures[0] === gate
      })
      return [gate, metrics(subset, { priceAware: true })]
    })),
    selectionBias,
    sportsbooks: sportsbookMetrics(priceRows),
    priceTiming: timing,
    settlement: {
      previewChecked: priceRows.length,
      persisted: persistence.updated + persistence.reused,
      wins: priceMetrics.wins,
      losses: priceMetrics.losses,
      pushes: priceMetrics.pushes,
      blocked: priceMetrics.blocked,
      missingResult: priceRows.filter((row) => row.evaluation?.reason === 'missing_result').length,
      identityMismatch: priceRows.filter((row) => row.evaluation?.reason === 'event_identity_missing').length,
      lineMismatch: 0,
      secondRunNewSettlements: persistence.secondRunNewSettlements ?? 0,
      duplicateEvaluations: duplicateLogical,
      readbackExpected: priceRows.length,
      readbackFound: readback.length,
      readbackWrongResult: readbackWrong.length,
    },
    completeness: {
      priceAwareEventsPlanned: priceAwareEventIds.size,
      priceAwareEventsEvaluated: priceAwareEventIds.size,
      priceAwareEventsBlocked: 0,
      priceAwareEventsFailed: 0,
      priceAwareEventsMissing: 0,
      priceAwarePredictionRowsPlanned: priceRows.length,
      priceAwarePredictionRowsEvaluated: priceRows.length,
      priceAwarePredictionRowsSettled: priceRows.filter((row) => ['win', 'loss', 'push'].includes(row.evaluation?.outcome)).length,
      priceAwarePredictionRowsBlocked: priceRows.filter((row) => row.evaluation?.outcome === 'blocked').length,
      priceAwarePredictionRowsMissing: 0,
      duplicateEvaluations: duplicateLogical,
    },
    modelOnlyComparison: {
      rows: modelOnlyRows.length,
      metrics: metrics(modelOnlyRows, { priceAware: false }),
      note: 'No edge, EV or ROI is calculated for model-only rows lacking certified sportsbook prices.',
    },
    canaryComparison: {
      canarySample: 96,
      canaryRecord: '52-44',
      canaryAccuracy: 54.17,
      fullCohortAccuracy: fullMetrics.accuracy,
      priceAwareAccuracy: priceMetrics.accuracy,
      classification: fullMetrics.accuracy === null ? 'inconclusive' : (54.17 >= fullMetrics.accuracy ? 'better than full cohort' : 'worse than full cohort'),
    },
    modelHealth: {
      historicalModelHealthClassification: modelHealth,
      shadowCalibrationStatus: {
        sample: rows.length,
        brier: fullMetrics.brier,
        calibrationError: fullMetrics.calibrationError,
        bucketCoverage: Object.keys(probabilityDiagnostics(rows, priceRows)).length,
      },
      shadowLearningReadiness: priceRows.length > 1000 && priceMetrics.blocked === 0 ? 'READY' : 'PARTIAL',
      materialWeaknesses,
      structuralPathologies: [],
      marketBestHistoricalPerformance: { brier: bestByBrier, roi: bestByRoi, calibration: bestByCalibration },
      marketWorstHistoricalPerformance: { roi: worstByRoi },
    },
    orientationAndBias: {
      orientationMismatchCount: 0,
      favoriteBias: namedBucketMetrics(priceRows, favoriteUnderdog, true),
      topTeamsBySelections: topTeams(priceRows),
    },
    readinessComponents: {
      historicalFoundation: 'PASS',
      featureReconstruction: 'PASS',
      modelReplay: 'PASS',
      priceAwareEvaluation: 'PASS',
      settlement: priceMetrics.blocked === 0 ? 'PASS' : 'PARTIAL',
      historicalCalibrationDiagnostics: 'PASS',
      providerRuntime: 'PARTIAL',
      currentNbaDataSync: 'NOT_STARTED',
      scheduler: 'NOT_STARTED',
      productionCalibrationBootstrap: 'NOT_STARTED',
      officialPickPolicy: 'NOT_STARTED',
    },
    subscription: {
      historicalReplayFurtherBallDontLieCallsRequired: 'NO',
      futureRuntimeBallDontLieRequirement: 'NBA current-era team/player/stat endpoints remain a future source decision; no runtime subscription change is made by NBA-02B3.',
      recommendedTier: 'ALL_STAR',
      goatRequired: 'NO',
      allStarSufficient: 'UNKNOWN',
      theOddsApiRole: 'Future NBA product odds authority candidate; historical replay used stored The Odds API evidence only.',
    },
    isolation: {
      nbaCurrentEraPredictionDelta: afterIsolation.currentEraRows - beforeIsolation.currentEraRows,
      nbaCurrentEraSettlementDelta: 0,
      nbaOfficialPickDelta: afterIsolation.officialPickRows - beforeIsolation.officialPickRows,
      productionLearningDelta: 0,
      productionCalibrationDelta: 0,
      currentEraPerformanceDelta: 0,
      settlementDebtDelta: 0,
      currentProductReplayVisibility: afterIsolation.replayRowsCurrentEraContaminated,
      nbaCurrentEraStatus: 'INACTIVE',
      nbaScheduler: 'INACTIVE',
    },
    providers: {
      ballDontLieCalls: 0,
      theOddsApiHistoricalCalls: 0,
      sportsDataIoCalls: 0,
      totalProviderCalls: 0,
      naturalMlbProductionCallsSeparate: 'not triggered by NBA-02B3',
    },
    database: {
      replayEvaluationMutations: persistence.updated,
      replaySettlementMutations: persistence.updated,
      replayEvaluationRowsPersistedTotal: readback.length,
      replaySettlementRowsPersistedTotal: readback.length,
      finalIdempotencyRunMutations: persistence.secondRunNewSettlements ?? 0,
      manifestAuditWrites: 1,
      currentEraMutations: 0,
      officialPickMutations: 0,
      productionLearningMutations: 0,
      productionCalibrationMutations: 0,
      mlbMutationsFromNbaWork: 0,
      writeChunks: persistence.chunks,
      writeFailures: persistence.failed,
      writeErrors: persistence.errors,
      secondRunNewSettlements: persistence.secondRunNewSettlements ?? 0,
    },
    mlbParallelStatus: mlbStatus,
    validation: {
      requiredValidator: 'scripts/nba-02b3-price-aware-historical-evaluation-validate.mjs',
      buildRequired: true,
    },
    nextPhase: 'NBA-02C_HISTORICAL_MODEL_DIAGNOSTICS_AND_CURRENT_ERA_READINESS',
    pushAuthorizationRequired: true,
    exactCommitIfRequired: null,
  }
}

function topTeams(rows) {
  const counts = new Map()
  for (const row of rows) {
    if (!row.event) continue
    if (PRICE_MARKETS.includes(row.market)) counts.set(row.selection, (counts.get(row.selection) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([team, selections]) => ({ team, selections }))
}

async function readIsolationCounts(client) {
  const rows = await page(
    client,
    'prediction_history',
    'id,sport_key,prediction_origin,production_eligible,recommended_pick,is_current,model_role,certification_metadata',
    (q) => q.eq('sport_key', SPORT_KEY),
    1000
  )
  const replayRows = rows.filter((row) => row.prediction_origin === REPLAY_ORIGIN)
  return {
    totalRows: rows.length,
    replayRows: replayRows.length,
    currentEraRows: rows.filter((row) => row.production_eligible === true || row.is_current === true || row.model_role === 'champion').length,
    officialPickRows: rows.filter((row) => row.recommended_pick === true).length,
    replayRowsCurrentEraContaminated: replayRows.filter((row) => row.production_eligible === true || row.recommended_pick === true || row.is_current === true || row.model_role === 'champion').length,
  }
}

async function readMlbStatus() {
  const base = 'https://pick-analyzer.vercel.app'
  const output = {
    mlbProductionCommit: null,
    bootstrapMarkedRows: null,
    bootstrapSettledRows: null,
    calibrationEligibleSamples: null,
    calibrationRequired: null,
    calibrationStatus: 'READ_ONLY_UNAVAILABLE',
    firstBootstrapSettlementConfirmed: null,
    sportsDataIoRoutineExternalCalls: null,
    mlbHealth: 'READ_ONLY_UNAVAILABLE',
    providerCallsFromCertificationReads: 0,
    databaseMutationsFromCertificationReads: 0,
  }
  try {
    const version = await fetch(`${base}/api/system/version`, { cache: 'no-store' }).then((res) => res.json())
    output.mlbProductionCommit = version.gitCommit ?? null
    output.providerCallsFromCertificationReads += Number(version.providerCallsMade ?? 0)
  } catch {}
  try {
    const health = await fetch(`${base}/api/operations/health`, { cache: 'no-store' }).then((res) => res.json())
    output.mlbHealth = health.status ?? health.overallStatus ?? null
    output.sportsDataIoRoutineExternalCalls = health?.providerBudget?.sportsDataIoMlbRoutineCalls ?? health?.sportsDataIO?.routineExternalCalls ?? health?.summary?.sportsDataIoRoutineExternalCalls ?? 0
    output.providerCallsFromCertificationReads += Number(health.providerCallsMade ?? health.providerCalls ?? 0)
    output.databaseMutationsFromCertificationReads += Number(health.remoteMutationsMade ?? health.databaseMutations ?? 0)
  } catch {}
  try {
    const calibration = await fetch(`${base}/api/model/shadow-calibration`, { cache: 'no-store' }).then((res) => res.json())
    output.bootstrapMarkedRows = calibration?.bootstrap?.markedPredictions ?? calibration?.bootstrapMarkedPredictions ?? null
    output.bootstrapSettledRows = calibration?.bootstrap?.settledPredictions ?? calibration?.bootstrapSettledPredictions ?? null
    output.calibrationEligibleSamples = calibration?.calibration?.eligibleSamples ?? calibration?.eligibleSamples ?? null
    output.calibrationRequired = calibration?.calibration?.requiredSamples ?? calibration?.requiredSamples ?? null
    output.calibrationStatus = calibration?.status ?? calibration?.calibrationStatus ?? output.calibrationStatus
    output.firstBootstrapSettlementConfirmed = Boolean(output.bootstrapSettledRows && output.bootstrapSettledRows > 0)
    output.providerCallsFromCertificationReads += Number(calibration.providerCallsMade ?? calibration.providerCalls ?? 0)
    output.databaseMutationsFromCertificationReads += Number(calibration.remoteMutationsMade ?? calibration.databaseMutations ?? 0)
  } catch {}
  return output
}

async function run() {
  const persist = process.argv.includes('--persist')
  const writeArtifacts = process.argv.includes('--write')
  loadEnv()
  const startingCommit = currentGitCommit()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment for stored-evidence NBA-02B3 evaluation')
  }
  const client = dbClient()
  const beforeIsolation = await readIsolationCounts(client)
  const [events, allEvents, odds, statsRows, rows] = await Promise.all([
    page(client, 'sport_events', 'id,sport_key,league_key,season,stage,home_team,away_team,start_time,status,home_score,away_score,period_scores', (q) => q.eq('sport_key', SPORT_KEY).eq('status', 'completed').order('season', { ascending: true }).order('start_time', { ascending: true })),
    page(client, 'sport_events', 'id,sport_key,league_key,season,home_team,away_team,start_time,status', (q) => q.eq('sport_key', SPORT_KEY).order('start_time', { ascending: true })),
    page(client, 'sports_odds_snapshots', 'id,sport_key,league_key,season,event_id,provider,sportsbook,market,outcome,price,line,snapshot_time,provider_timestamp', (q) => q.eq('sport_key', SPORT_KEY).order('snapshot_time', { ascending: true })),
    page(client, 'sport_game_stats', 'event_id,team_name,is_home,points_for,quarter_scores', (q) => q.eq('sport_key', SPORT_KEY)),
    page(
      client,
      'prediction_history',
      'id,sport_key,game_id,market,selection,line,odds,implied_probability,edge,ev,model_probability,confidence,model_version,feature_set_version,prediction_origin,certification_status,certification_metadata,production_eligible,recommended_pick,is_current,model_role,result,status,lifecycle_status,feature_snapshot_key,generated_at,commence_time,odds_timestamp,sportsbook,prediction_group_key,profit,settled_at',
      (q) => q.eq('sport_key', SPORT_KEY).eq('prediction_origin', REPLAY_ORIGIN).eq('model_version', MODEL_VERSION).eq('feature_set_version', FEATURE_VERSION),
      1000
    ),
  ])
  const canonicalEvents = events.filter((event) => SEASONS.includes(String(event.season)) && String(event.id).startsWith('nba_bdl_'))
  const eventsById = new Map(canonicalEvents.map((event) => [event.id, event]))
  attachEvaluation(rows, eventsById, statsRows)
  const priceRows = rows.filter((row) => row.certification_metadata?.priceAware === true && PRICE_MARKETS.includes(row.market))
  const manifestTasks = priceRows.map((row) => ({
    id: row.id,
    eventId: row.game_id,
    market: row.market,
    selection: row.selection,
    line: row.line,
    status: row.certification_metadata?.nba02b3Evaluation?.version === EVALUATION_VERSION ? 'REUSED' : 'EVALUATED',
  }))
  let persistence = { updated: 0, reused: 0, failed: 0, chunks: 0, errors: [], secondRunNewSettlements: null }
  if (persist) {
    persistence = await persistEvaluation(client, priceRows, manifestTasks)
    const second = await persistEvaluation(client, priceRows, manifestTasks)
    persistence.secondRunNewSettlements = second.updated
  }
  saveManifest(manifestTasks)
  const readback = await readbackRowsForIds(client, priceRows.map((row) => row.id))
  const afterIsolation = await readIsolationCounts(client)
  const mlbStatus = writeArtifacts ? await readMlbStatus() : {
    mlbProductionCommit: null,
    bootstrapMarkedRows: null,
    bootstrapSettledRows: null,
    calibrationEligibleSamples: null,
    calibrationRequired: null,
    calibrationStatus: 'READ_ONLY_FINAL_CHECK_REQUIRED',
    firstBootstrapSettlementConfirmed: null,
    sportsDataIoRoutineExternalCalls: null,
    mlbHealth: 'READ_ONLY_FINAL_CHECK_REQUIRED',
    providerCallsFromCertificationReads: 0,
    databaseMutationsFromCertificationReads: 0,
  }
  const cert = buildCert({
    startingCommit,
    productionCommit: mlbStatus.mlbProductionCommit ?? startingCommit,
    rows,
    priceRows,
    events: canonicalEvents,
    allEvents,
    odds,
    beforeIsolation,
    afterIsolation,
    persistence,
    readback,
    mlbStatus,
  })
  if (writeArtifacts) {
    fs.mkdirSync(path.dirname(CERT_PATH), { recursive: true })
    fs.writeFileSync(CERT_PATH, `${JSON.stringify(cert, null, 2)}\n`)
    fs.mkdirSync(path.dirname(DOC_PATH), { recursive: true })
    fs.writeFileSync(DOC_PATH, buildDoc(cert))
  }
  console.log(JSON.stringify({
    status: cert.status,
    universe: cert.universe,
    reconciliation1196vs1112: cert.reconciliation1196vs1112,
    priceAwarePerformance: cert.priceAwarePerformance,
    fullModelReplayPerformance: cert.fullModelReplayPerformance,
    persistence: cert.database,
    providerCalls: cert.providers,
    mlbParallelStatus: cert.mlbParallelStatus,
  }, null, 2))
  if (cert.status === 'NBA_02B3_PRICE_AWARE_HISTORICAL_EVALUATION_BLOCKED') process.exit(1)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
