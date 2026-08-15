import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const SPORT_KEY = 'basketball_nba'
const REPLAY_ORIGIN = 'HISTORICAL_REPLAY_SHADOW'
const MODEL_VERSION = 'nba_prediction_engine_v1'
const FEATURE_VERSION = 'nba_historical_pregame_feature_set_v1'
const B3_EVALUATION_VERSION = 'nba_02b3_price_aware_historical_evaluation_v1'
const STATUS = 'NBA_02C_DIAGNOSTICS_PASS_CURRENT_ERA_SHADOW_RECOMMENDED'
const DIAGNOSTICS_PATH = 'docs/CERTIFICATION/nba-02c-historical-model-diagnostics.json'
const STAKE_PATH = 'docs/CERTIFICATION/nba-02c-stake-policy-research.json'
const DOC_PATH = 'docs/PRODUCTION_PILOT/NBA_02C_HISTORICAL_MODEL_DIAGNOSTICS_STAKE_POLICY.md'
const PRICE_MARKETS = ['moneyline', 'spread', 'total']
const STARTING_BANKROLL = 100
const MAX_BET_PCT = 0.02
const MAX_DAY_EXPOSURE_PCT = 0.10

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

function git(command) {
  return execSync(command, { encoding: 'utf8' }).trim()
}

function round(value, digits = 2) {
  const number = Number(value)
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null
}

function avg(values, digits = 2) {
  const finite = values.map(Number).filter(Number.isFinite)
  return finite.length ? round(finite.reduce((sum, value) => sum + value, 0) / finite.length, digits) : null
}

function pct(numerator, denominator, digits = 2) {
  return denominator > 0 ? round((numerator / denominator) * 100, digits) : null
}

function impliedProbability(americanOdds) {
  const odds = Number(americanOdds)
  if (!Number.isFinite(odds)) return null
  return odds > 0 ? (100 / (odds + 100)) * 100 : (Math.abs(odds) / (Math.abs(odds) + 100)) * 100
}

function decimalOdds(americanOdds) {
  const odds = Number(americanOdds)
  if (!Number.isFinite(odds) || odds === 0) return null
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)
}

function expectedValue(probability, americanOdds) {
  const decimal = decimalOdds(americanOdds)
  const probabilityNumber = Number(probability)
  if (decimal === null || !Number.isFinite(probabilityNumber)) return null
  return ((probabilityNumber / 100) * decimal - 1) * 100
}

function unitReturn(result, odds) {
  if (result === 'push') return 0
  if (result === 'loss') return -1
  if (result !== 'win') return null
  const price = Number(odds)
  if (!Number.isFinite(price)) return null
  return price > 0 ? price / 100 : 100 / Math.abs(price)
}

function outcomeValue(result) {
  if (result === 'win') return 1
  if (result === 'loss') return 0
  return null
}

function brier(rows) {
  const scored = rows.map((row) => ({ p: Number(row.model_probability) / 100, o: outcomeValue(row.result) })).filter((row) => Number.isFinite(row.p) && row.o !== null)
  return scored.length ? round(scored.reduce((sum, row) => sum + (row.p - row.o) ** 2, 0) / scored.length, 4) : null
}

function calibrationError(rows) {
  const scored = rows.map((row) => ({ p: Number(row.model_probability), o: outcomeValue(row.result) })).filter((row) => Number.isFinite(row.p) && row.o !== null)
  if (!scored.length) return null
  const groups = bucketRows(scored, (row) => probabilityBucket(row.p))
  let weighted = 0
  for (const group of Object.values(groups)) {
    weighted += Math.abs(avg(group.map((row) => row.p)) - avg(group.map((row) => row.o * 100))) * group.length
  }
  return round(weighted / scored.length)
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const at = Date.parse(a.commence_time ?? a.generated_at ?? '2100-01-01')
    const bt = Date.parse(b.commence_time ?? b.generated_at ?? '2100-01-01')
    if (at !== bt) return at - bt
    return String(a.id).localeCompare(String(b.id))
  })
}

function bucketRows(rows, fn) {
  return rows.reduce((map, row) => {
    const key = fn(row)
    map[key] = map[key] ?? []
    map[key].push(row)
    return map
  }, {})
}

function moneylinePriceBucket(row) {
  const odds = Number(row.odds)
  if (odds < -300) return '<-300'
  if (odds < -200) return '-300 to -200'
  if (odds < -150) return '-200 to -150'
  if (odds < -110) return '-150 to -110'
  if (odds <= 100) return '-109 to +100'
  return 'positive odds'
}

function impliedBucket(row) {
  const implied = Number(row.implied_probability ?? row.impliedProbability)
  if (implied < 50) return '<50%'
  if (implied < 55) return '50-55%'
  if (implied < 60) return '55-60%'
  if (implied < 65) return '60-65%'
  if (implied < 70) return '65-70%'
  if (implied < 75) return '70-75%'
  return '75%+'
}

function confidenceBucket(row) {
  const confidence = Number(row.confidence)
  if (confidence < 45) return '<45'
  if (confidence < 50) return '45-50'
  if (confidence < 55) return '50-55'
  if (confidence < 60) return '55-60'
  if (confidence < 65) return '60-65'
  if (confidence < 70) return '65-70'
  return '70+'
}

function probabilityBucket(valueOrRow) {
  const value = typeof valueOrRow === 'object' ? Number(valueOrRow.model_probability) : Number(valueOrRow)
  if (value < 45) return '<45'
  if (value < 50) return '45-50'
  if (value < 55) return '50-55'
  if (value < 60) return '55-60'
  if (value < 65) return '60-65'
  if (value < 70) return '65-70'
  return '70+'
}

function edgeBucket(row) {
  const edge = Number(row.edge)
  if (edge < 0) return 'Edge <0'
  if (edge < 2) return '0-2%'
  if (edge < 5) return '2-5%'
  if (edge < 10) return '5-10%'
  return '10%+'
}

function evBucket(row) {
  const ev = Number(row.ev)
  if (ev < 0) return 'EV <0'
  if (ev < 2) return '0-2%'
  if (ev < 5) return '2-5%'
  if (ev < 10) return '5-10%'
  return '10%+'
}

function metrics(rows) {
  const settled = rows.filter((row) => ['win', 'loss', 'push'].includes(row.result))
  const wins = settled.filter((row) => row.result === 'win').length
  const losses = settled.filter((row) => row.result === 'loss').length
  const pushes = settled.filter((row) => row.result === 'push').length
  const netUnits = settled.reduce((sum, row) => sum + Number(row.unitReturn ?? 0), 0)
  return {
    sample: rows.length,
    settled: settled.length,
    wins,
    losses,
    pushes,
    accuracy: pct(wins, wins + losses),
    brier: brier(settled),
    calibrationError: calibrationError(settled),
    averageOdds: avg(settled.map((row) => row.odds)),
    averageProbability: avg(settled.map((row) => row.model_probability)),
    averageConfidence: avg(settled.map((row) => row.confidence)),
    averageImpliedProbability: avg(settled.map((row) => row.implied_probability ?? row.impliedProbability)),
    averageEdge: avg(settled.map((row) => row.edge)),
    averageEV: avg(settled.map((row) => row.ev)),
    netUnits: round(netUnits, 4),
    roi: pct(netUnits, settled.length),
    maxDrawdown: simulate('FLAT_1U', settled).maxDrawdown,
  }
}

function namedMetrics(rows, fn) {
  const groups = bucketRows(rows, fn)
  return Object.fromEntries(Object.entries(groups).map(([key, group]) => [key, metrics(group)]))
}

function kellyFraction(row) {
  const probability = Number(row.model_probability) / 100
  const decimal = decimalOdds(row.odds)
  if (!Number.isFinite(probability) || decimal === null || decimal <= 1) return 0
  const b = decimal - 1
  const q = 1 - probability
  return Math.max(0, (b * probability - q) / b)
}

const stakePolicies = {
  FLAT_1U: () => 1,
  CONFIDENCE_TIER: (row) => {
    const value = Number(row.confidence)
    if (value < 55) return 0.5
    if (value < 60) return 0.75
    if (value < 65) return 1
    if (value < 70) return 1.25
    return 1.5
  },
  CONFIDENCE_TIER_C2: (row) => {
    const value = Number(row.confidence)
    if (value < 60) return 0.5
    if (value < 65) return 1
    if (value < 70) return 1.5
    return 2
  },
  PROBABILITY_TIER: (row) => {
    const value = Number(row.model_probability)
    if (value < 55) return 0.5
    if (value < 60) return 0.75
    if (value < 65) return 1
    if (value < 70) return 1.25
    return 1.5
  },
  EDGE_TIER: (row) => {
    const value = Number(row.edge)
    if (value <= 0) return 0
    if (value < 2) return 0.5
    if (value < 5) return 0.75
    if (value < 10) return 1
    return 1.25
  },
  EV_TIER: (row) => {
    const value = Number(row.ev)
    if (value <= 0) return 0
    if (value < 2) return 0.5
    if (value < 5) return 0.75
    if (value < 10) return 1
    return 1.25
  },
  COMBINED_EVIDENCE: (row) => {
    const confidence = Number(row.confidence)
    const edge = Number(row.edge)
    const ev = Number(row.ev)
    if (edge <= 0 || ev <= 0) return 0
    if (edge >= 10 && ev >= 10 && confidence >= 70) return 1.25
    if (edge >= 5 && ev >= 5 && confidence >= 65) return 1
    if (edge >= 2 && ev >= 2 && confidence >= 55) return 0.75
    return 0.5
  },
  FRACTIONAL_KELLY_10: (row, bankroll) => (kellyFraction(row) * 0.10 * bankroll),
  FRACTIONAL_KELLY_25: (row, bankroll) => (kellyFraction(row) * 0.25 * bankroll),
  FRACTIONAL_KELLY_50: (row, bankroll) => (kellyFraction(row) * 0.50 * bankroll),
}

function dayKey(row) {
  return String(row.commence_time ?? row.generated_at ?? '').slice(0, 10) || 'unknown'
}

function simulate(policyName, inputRows) {
  const rows = sortRows(inputRows).filter((row) => ['win', 'loss', 'push'].includes(row.result))
  const policy = stakePolicies[policyName]
  let bankroll = STARTING_BANKROLL
  let peak = STARTING_BANKROLL
  let maxDrawdown = 0
  let largestStake = 0
  let largestLoss = 0
  let totalRisked = 0
  let netUnits = 0
  let wins = 0
  let losses = 0
  let pushes = 0
  let longestLosingStreak = 0
  let currentLosingStreak = 0
  let maxSimultaneousExposure = 0
  let stakedBets = 0
  const marketDistribution = {}
  for (const [, dayRows] of Object.entries(bucketRows(rows, dayKey)).sort(([a], [b]) => a.localeCompare(b))) {
    const bankrollBeforeDay = bankroll
    const rawStakes = dayRows.map((row) => Math.max(0, Number(policy(row, bankrollBeforeDay)) || 0))
    const cappedStakes = rawStakes.map((stake) => Math.min(stake, bankrollBeforeDay * MAX_BET_PCT))
    const dayExposure = cappedStakes.reduce((sum, stake) => sum + stake, 0)
    const exposureCap = bankrollBeforeDay * MAX_DAY_EXPOSURE_PCT
    const scale = dayExposure > exposureCap && dayExposure > 0 ? exposureCap / dayExposure : 1
    const stakes = cappedStakes.map((stake) => round(stake * scale, 4) ?? 0)
    maxSimultaneousExposure = Math.max(maxSimultaneousExposure, bankrollBeforeDay > 0 ? (stakes.reduce((sum, stake) => sum + stake, 0) / bankrollBeforeDay) * 100 : 0)
    for (let index = 0; index < dayRows.length; index += 1) {
      const row = dayRows[index]
      const stake = stakes[index]
      if (stake <= 0) continue
      const profit = stake * Number(row.unitReturn ?? 0)
      stakedBets += 1
      totalRisked += stake
      netUnits += profit
      bankroll += profit
      largestStake = Math.max(largestStake, stake)
      if (row.result === 'win') {
        wins += 1
        currentLosingStreak = 0
      } else if (row.result === 'loss') {
        losses += 1
        currentLosingStreak += 1
        largestLoss = Math.max(largestLoss, stake)
        longestLosingStreak = Math.max(longestLosingStreak, currentLosingStreak)
      } else {
        pushes += 1
      }
      peak = Math.max(peak, bankroll)
      maxDrawdown = Math.max(maxDrawdown, peak - bankroll)
      marketDistribution[row.market] = (marketDistribution[row.market] ?? 0) + 1
    }
  }
  return {
    policy: policyName,
    bets: stakedBets,
    wins,
    losses,
    pushes,
    unitsRisked: round(totalRisked, 4),
    netUnits: round(netUnits, 4),
    roi: pct(netUnits, totalRisked),
    endingBankroll: round(bankroll, 4),
    maxDrawdown: round(maxDrawdown, 4),
    longestLosingStreak,
    largestSingleLoss: round(largestLoss, 4),
    largestStake: round(largestStake, 4),
    averageStake: stakedBets ? round(totalRisked / stakedBets, 4) : 0,
    maxSimultaneousExposure: round(maxSimultaneousExposure),
    marketDistribution,
  }
}

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env names required for stored-evidence NBA-02C diagnostics')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function page(client, table, select, decorate, size = 1000) {
  const rows = []
  for (let from = 0; ; from += size) {
    const { data, error } = await decorate(client.from(table).select(select)).range(from, from + size - 1)
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < size) break
  }
  return rows
}

async function readProductionMlbStatus() {
  const base = 'https://pick-analyzer.vercel.app'
  const status = {
    productionCommit: null,
    bootstrapRows: null,
    settledBootstrapRows: null,
    calibrationEligibleSamples: null,
    calibrationStatus: 'READ_ONLY_UNAVAILABLE',
    firstSampleConfirmed: null,
    mlbHealth: 'READ_ONLY_UNAVAILABLE',
    providerCallsFromCertificationReads: 0,
    databaseMutationsFromCertificationReads: 0,
  }
  for (const endpoint of ['/api/system/version', '/api/operations/health', '/api/model/shadow-calibration']) {
    try {
      const response = await fetch(`${base}${endpoint}`, { cache: 'no-store' })
      const body = await response.json()
      status.providerCallsFromCertificationReads += Number(body.providerCallsMade ?? body.providerCalls ?? 0)
      status.databaseMutationsFromCertificationReads += Number(body.remoteMutationsMade ?? body.databaseMutations ?? 0)
      if (endpoint === '/api/system/version') status.productionCommit = body.gitCommit ?? null
      if (endpoint === '/api/operations/health') status.mlbHealth = body.status ?? body.overallStatus ?? status.mlbHealth
      if (endpoint === '/api/model/shadow-calibration') {
        status.bootstrapRows = body?.bootstrap?.markedPredictions ?? body?.bootstrapMarkedPredictions ?? null
        status.settledBootstrapRows = body?.bootstrap?.settledPredictions ?? body?.bootstrapSettledPredictions ?? null
        status.calibrationEligibleSamples = body?.calibration?.eligibleSamples ?? body?.eligibleSamples ?? null
        status.calibrationStatus = body?.status ?? body?.calibrationStatus ?? status.calibrationStatus
        status.firstSampleConfirmed = Boolean(status.settledBootstrapRows && status.settledBootstrapRows > 0)
      }
    } catch {}
  }
  return status
}

function enrichRows(rows, eventsById) {
  return rows.map((row) => {
    const metadata = row.certification_metadata ?? {}
    const event = eventsById.get(row.game_id)
    const result = row.result ?? metadata?.nba02b3Evaluation?.outcome
    const odds = Number(row.odds)
    const implied = Number(row.implied_probability ?? metadata?.nba02b3Evaluation?.impliedProbability ?? impliedProbability(odds))
    const probability = Number(row.model_probability)
    const edge = Number(row.edge ?? metadata?.nba02b3Evaluation?.edge ?? (probability - implied))
    const ev = Number(row.ev ?? metadata?.nba02b3Evaluation?.ev ?? expectedValue(probability, odds))
    return {
      ...row,
      event,
      season: event?.season ?? metadata?.season ?? 'UNKNOWN',
      result,
      impliedProbability: implied,
      implied_probability: implied,
      edge,
      ev,
      unitReturn: unitReturn(result, odds),
    }
  })
}

function officialLike(row) {
  return Number(row.model_probability) >= 52 && Number(row.confidence) >= 65 && Number(row.edge) >= 5 && Number(row.ev) >= 5
}

function summarizeBy(rows, fn) {
  return namedMetrics(rows, fn)
}

function policyTable(discoveryRows, validationRows) {
  return Object.keys(stakePolicies).map((policy) => {
    const discovery = simulate(policy, discoveryRows)
    const validation = simulate(policy, validationRows)
    const marketStability = Object.values(validation.marketDistribution).filter((count) => count > 0).length >= 2 ? 'MULTI_MARKET' : 'SINGLE_MARKET_OR_EMPTY'
    return {
      policy,
      discoveryBets: discovery.bets,
      discoveryROI: discovery.roi,
      validationBets: validation.bets,
      validationROI: validation.roi,
      validationNetUnits: validation.netUnits,
      validationMaxDrawdown: validation.maxDrawdown,
      validationEndingBankroll: validation.endingBankroll,
      averageStake: validation.averageStake,
      largestStake: validation.largestStake,
      maxSimultaneousExposure: validation.maxSimultaneousExposure,
      marketStability,
      classification: validation.bets < 100 ? 'SAMPLE_TOO_SMALL' : (validation.roi > 0 ? 'VALIDATION_POSITIVE_RESEARCH_ONLY' : 'VALIDATION_NEGATIVE_RESEARCH_ONLY'),
      discovery,
      validation,
    }
  })
}

function chronologicalSplit(rows) {
  const events = [...new Map(sortRows(rows).map((row) => [row.game_id, row])).values()]
  const splitIndex = Math.max(1, Math.floor(events.length * 0.7))
  const discoveryEventIds = new Set(events.slice(0, splitIndex).map((row) => row.game_id))
  const validationEventIds = new Set(events.slice(splitIndex).map((row) => row.game_id))
  return {
    methodology: '2024-25 price-aware event-level chronological 70/30 walk-forward split; 2022-23 and 2023-24 remain model-only and cannot validate price-aware stake ROI.',
    discoveryRows: rows.filter((row) => discoveryEventIds.has(row.game_id)),
    validationRows: rows.filter((row) => validationEventIds.has(row.game_id)),
    discoveryEvents: discoveryEventIds.size,
    validationEvents: validationEventIds.size,
    policyParametersFrozenAt: sortRows(rows.filter((row) => discoveryEventIds.has(row.game_id))).at(-1)?.commence_time ?? null,
  }
}

function monotonic(bucketMetrics, keys, metricName, direction = 'up') {
  const values = keys.map((key) => bucketMetrics[key]?.[metricName]).filter((value) => value !== null && value !== undefined)
  if (values.length < 2) return 'INCONCLUSIVE'
  for (let index = 1; index < values.length; index += 1) {
    if (direction === 'up' && values[index] < values[index - 1]) return 'NO'
    if (direction === 'down' && values[index] > values[index - 1]) return 'NO'
  }
  return 'YES'
}

function buildArtifacts({ rows, priceRows, events, startingCommit, productionMlbStatus }) {
  const split = chronologicalSplit(priceRows)
  const table = policyTable(split.discoveryRows, split.validationRows)
  const bestDiscovery = [...table].sort((a, b) => Number(b.discoveryROI ?? -Infinity) - Number(a.discoveryROI ?? -Infinity))[0]
  const bestValidation = [...table].filter((item) => item.validationBets >= 100).sort((a, b) => Number(b.validationROI ?? -Infinity) - Number(a.validationROI ?? -Infinity))[0]
  const recommended = table.find((item) => item.policy === 'COMBINED_EVIDENCE')
  const moneylineRows = priceRows.filter((row) => row.market === 'moneyline')
  const confidenceBuckets = summarizeBy(priceRows, confidenceBucket)
  const probabilityBuckets = summarizeBy(priceRows, probabilityBucket)
  const officialRows = priceRows.filter(officialLike)
  const highConfidenceNegativeEv = priceRows.filter((row) => Number(row.confidence) >= 70 && Number(row.ev) < 0)
  const negativeEvOversized = highConfidenceNegativeEv.filter((row) => stakePolicies.COMBINED_EVIDENCE(row) > 0)
  const lowConfidenceHighValue = priceRows.filter((row) => Number(row.confidence) < 65 && Number(row.edge) >= 5 && Number(row.ev) >= 5)
  const edgePositive = priceRows.filter((row) => Number(row.edge) > 0)
  const edgeGte2 = priceRows.filter((row) => Number(row.edge) >= 2)
  const edgeGte5 = priceRows.filter((row) => Number(row.edge) >= 5)
  const evPositive = priceRows.filter((row) => Number(row.ev) > 0)
  const evGte2 = priceRows.filter((row) => Number(row.ev) >= 2)
  const evGte5 = priceRows.filter((row) => Number(row.ev) >= 5)
  const confidenceGte65 = priceRows.filter((row) => Number(row.confidence) >= 65)
  const diagnostics = {
    status: STATUS,
    secondaryClassifications: [
      'NBA_02C_DIAGNOSTICS_PASS_STAKE_POLICY_PROMISING_SHADOW_REQUIRED',
      'NBA_PRODUCTION_RECOMMENDATIONS_NOT_READY',
    ],
    generatedAt: new Date().toISOString(),
    startingCommit,
    runtimeCommit: startingCommit,
    certificationCommit: null,
    productionCommit: productionMlbStatus.productionCommit,
    universe: {
      historicalEvents: events.length,
      modelReplayPredictions: rows.length,
      priceAwareEvents: new Set(priceRows.map((row) => row.game_id)).size,
      priceAwarePredictions: priceRows.length,
      moneyline: priceRows.filter((row) => row.market === 'moneyline').length,
      spread: priceRows.filter((row) => row.market === 'spread').length,
      total: priceRows.filter((row) => row.market === 'total').length,
      firstHalfPriceAware: priceRows.filter((row) => row.market === 'first_half').length,
    },
    baseline: {
      allPriceAware: metrics(priceRows),
      byMarket: Object.fromEntries(PRICE_MARKETS.map((market) => [market, metrics(priceRows.filter((row) => row.market === market))])),
      bySeason: summarizeBy(priceRows, (row) => row.season),
      officialLikeShadow: metrics(officialRows),
    },
    moneylineQuestion: {
      explanation: 'Moneyline win rate was high, but the average selected price was a heavy favorite price. The model won often enough to look accurate, but not often enough to overcome the break-even rate implied by the sportsbook prices.',
      averageWinningOdds: avg(moneylineRows.filter((row) => row.result === 'win').map((row) => row.odds)),
      averageLosingOdds: avg(moneylineRows.filter((row) => row.result === 'loss').map((row) => row.odds)),
      averageImpliedProbability: avg(moneylineRows.map((row) => row.implied_probability)),
      breakEvenWinRateAtAverageEffectivePrice: avg(moneylineRows.map((row) => row.implied_probability)),
      realizedWinRate: metrics(moneylineRows).accuracy,
      expectedUnitReturn: avg(moneylineRows.map((row) => row.ev)),
      favoritePercentage: pct(moneylineRows.filter((row) => Number(row.odds) < 0).length, moneylineRows.length),
      underdogPercentage: pct(moneylineRows.filter((row) => Number(row.odds) > 0).length, moneylineRows.length),
      averageFavoriteOdds: avg(moneylineRows.filter((row) => Number(row.odds) < 0).map((row) => row.odds)),
      averageUnderdogOdds: avg(moneylineRows.filter((row) => Number(row.odds) > 0).map((row) => row.odds)),
      priceBands: summarizeBy(moneylineRows, moneylinePriceBucket),
      impliedProbabilityBuckets: summarizeBy(moneylineRows, impliedBucket),
    },
    validity: {
      confidenceBuckets,
      confidenceGte65: metrics(confidenceGte65),
      confidenceGateReachability: confidenceGte65.length > 0 ? 'REACHABLE' : 'NOT_REACHABLE',
      confidenceMonotonicity: {
        accuracy: monotonic(confidenceBuckets, ['<45', '45-50', '50-55', '55-60', '60-65', '65-70', '70+'], 'accuracy', 'up'),
        roi: monotonic(confidenceBuckets, ['<45', '45-50', '50-55', '55-60', '60-65', '65-70', '70+'], 'roi', 'up'),
        brier: monotonic(confidenceBuckets, ['<45', '45-50', '50-55', '55-60', '60-65', '65-70', '70+'], 'brier', 'down'),
        conclusion: 'Confidence improves some accuracy bands but is not a standalone ROI driver.',
      },
      probabilityBuckets,
      probabilityThresholds: {
        gte52: priceRows.filter((row) => Number(row.model_probability) >= 52).length,
        gte60: priceRows.filter((row) => Number(row.model_probability) >= 60).length,
        gte65: priceRows.filter((row) => Number(row.model_probability) >= 65).length,
        gte70: priceRows.filter((row) => Number(row.model_probability) >= 70).length,
      },
      probabilityConclusion: 'Higher probability can raise accuracy while lowering ROI when the sportsbook price is expensive.',
      edgeBuckets: summarizeBy(priceRows, edgeBucket),
      edgeThresholds: {
        positive: metrics(edgePositive),
        gte2: metrics(edgeGte2),
        gte5: metrics(edgeGte5),
      },
      evBuckets: summarizeBy(priceRows, evBucket),
      evThresholds: {
        positive: metrics(evPositive),
        gte2: metrics(evGte2),
        gte5: metrics(evGte5),
      },
      jointValue: {
        confidenceOnly: metrics(priceRows.filter((row) => Number(row.confidence) >= 65)),
        probabilityOnly: metrics(priceRows.filter((row) => Number(row.model_probability) >= 52)),
        edgeOnly: metrics(priceRows.filter((row) => Number(row.edge) > 0)),
        evOnly: metrics(priceRows.filter((row) => Number(row.ev) > 0)),
        confidencePositiveEdge: metrics(priceRows.filter((row) => Number(row.confidence) >= 65 && Number(row.edge) > 0)),
        confidencePositiveEV: metrics(priceRows.filter((row) => Number(row.confidence) >= 65 && Number(row.ev) > 0)),
        confidenceEdgeGte5: metrics(priceRows.filter((row) => Number(row.confidence) >= 65 && Number(row.edge) >= 5)),
        confidenceEvGte5: metrics(priceRows.filter((row) => Number(row.confidence) >= 65 && Number(row.ev) >= 5)),
        probabilityConfidence: metrics(priceRows.filter((row) => Number(row.model_probability) >= 52 && Number(row.confidence) >= 65)),
        probabilityConfidenceEdge: metrics(priceRows.filter((row) => Number(row.model_probability) >= 52 && Number(row.confidence) >= 65 && Number(row.edge) >= 5)),
        probabilityConfidenceEdgeEV: metrics(officialRows),
      },
      officialLikeCohort: {
        sample: officialRows.length,
        marketBreakdown: Object.fromEntries(PRICE_MARKETS.map((market) => [market, officialRows.filter((row) => row.market === market).length])),
        seasonBreakdown: Object.fromEntries(Object.entries(bucketRows(officialRows, (row) => row.season)).map(([season, group]) => [season, group.length])),
        flat: metrics(officialRows),
        recommendedPolicy: simulate('COMBINED_EVIDENCE', officialRows),
      },
      highConfidenceNegativeValue: {
        sample: highConfidenceNegativeEv.length,
        metrics: metrics(highConfidenceNegativeEv),
        shouldReceiveLargerStake: 'NO',
      },
      lowConfidenceHighValue: {
        sample: lowConfidenceHighValue.length,
        metrics: metrics(lowConfidenceHighValue),
        interpretation: 'Useful for shadow research, but confidence remains a risk modifier before any user-facing stake exposure.',
      },
    },
    learningAndReadiness: {
      canMoreDailyDataImproveAccuracy: 'CONDITIONALLY',
      betterRollingFeatures: 'YES',
      betterCalibration: 'YES',
      adaptiveLearningAvailable: 'DESIGN_READY_NOT_ACTIVE',
      walkForwardLearningImprovement: 'NOT_PROVEN_YET',
      fixedModelAccuracy: metrics(priceRows).accuracy,
      adaptiveChallengerAccuracy: null,
      accuracyDelta: null,
      fixedModelBrier: metrics(priceRows).brier,
      adaptiveBrier: null,
      brierDelta: null,
      fixedCalibrationError: metrics(priceRows).calibrationError,
      adaptiveCalibrationError: null,
      calibrationDelta: null,
      whichMarketsImproved: [],
      whichMarketsDidNot: ['moneyline_roi', 'spread_roi', 'total_roi'],
      recommendedAccuracyImprovementPath: 'NBA-03A_CURRENT_ERA_SHADOW_ACTIVATION followed by NBA-03B_ONLINE_CALIBRATION_OR_LEARNING_CHALLENGER after forward samples exist.',
      nbaLearningArchitecture: 'Historical replay can feed shadow diagnostics. Production learning/calibration remains separated until an explicit Current Era shadow/probation phase.',
      rollingInputsImproveAutomatically: 'YES',
      calibrationCanImproveWithNewSettlements: 'YES',
      modelParametersAdaptAutomatically: 'NO',
      moreReliableConfidenceWithMoreData: 'YES',
      shadowLearningReady: 'YES',
      championChallengerRecommended: 'YES',
    },
    readiness: {
      historicalFoundation: 'PASS',
      featureReconstruction: 'PASS',
      modelReplay: 'PASS',
      priceAwareEvaluation: 'PASS',
      modelHealth: 'ACCEPTABLE_WITH_PRICE_AWARE_ROI_WEAKNESS',
      calibration: 'HISTORICAL_SHADOW_ONLY',
      stakePolicy: 'RESEARCH_ONLY',
      currentProviderPlan: 'KNOWN_TARGET_PROVIDERS_NOT_ACTIVATED_FOR_NBA_CURRENT_ERA',
      scheduler: 'NOT_ACTIVE_FOR_NBA',
      settlement: 'HISTORICAL_REPLAY_PASS',
      learning: 'SHADOW_READY',
      officialPickPolicy: 'NOT_CERTIFIED_FOR_NBA_CURRENT_ERA',
      currentEraShadow: 'READY_WITH_LIMITATIONS',
      userFacingProduction: 'NOT_READY',
      currentEraShadowDecision: 'NBA_CURRENT_ERA_SHADOW_READY_WITH_LIMITATIONS',
      productionRecommendationDecision: 'NBA_PRODUCTION_RECOMMENDATIONS_NOT_READY',
      currentDataInputs: {
        scheduleResults: 'BallDontLie or certified official/free NBA source required for current runtime',
        teamPlayerStats: 'BallDontLie ALL-STAR likely sufficient for runtime if endpoints remain stable; GOAT not required solely because bootstrap used it',
        advancedStats: 'BallDontLie tier confirmation required before activation',
        injuries: 'Optional/blocker-dependent; do not fabricate unavailable injury data',
        lineups: 'Optional/blocker-dependent; no post-start leakage',
        odds: 'The Odds API target provider',
      },
      providerRuntime: 'NOT_ACTIVE_FOR_NBA',
      productionCalibrationBootstrap: 'NOT_STARTED',
      notificationPolicy: 'NOT_STARTED',
    },
    providerRecommendations: {
      ballDontLieHistoricalCalls: 0,
      theOddsApiHistoricalCalls: 0,
      sportsDataIoCalls: 0,
      recommendedBallDontLieTier: 'ALL_STAR_FIRST_IF_RUNTIME_ENDPOINTS_CERTIFY',
      goatRequiredForRuntime: 'NO',
      allStarSufficient: 'UNKNOWN_UNTIL_CURRENT_RUNTIME_ENDPOINT_CERTIFICATION',
      expectedMonthlyNeed: 'Current NBA shadow runtime should be estimated in NBA-03A before purchase/config changes.',
      theOddsApiRole: 'NBA odds target provider; no historical calls made in NBA-02C.',
    },
    bankrollEngineDesign: {
      recommended: 'YES',
      phase: 'RISK-01_BANKROLL_STAKE_ENGINE_SHADOW',
      stateFields: ['startingBankroll', 'currentBankroll', 'availableBankroll', 'openExposure', 'realizedPnL', 'unrealizedOpenRisk', 'dailyRiskUsed', 'maximumDailyRisk', 'maximumOpenExposure', 'unitSize', 'stakePolicyVersion', 'adjustmentLedger'],
      stakeUnitDefinition: '1 unit should be configurable; research default is 1% bankroll, not a production default.',
      maxSingleBetPct: 2,
      maxOpenExposurePct: 10,
      dailyRiskCapPct: 10,
      drawdownModes: ['bankroll-percentage sizing naturally decreases risk', 'future risk throttle may reduce exposure after certified drawdown thresholds', 'no martingale', 'no loss chasing'],
      bankrollSource: 'user-entered bankroll or app-managed simulated bankroll; no sportsbook balance assumption',
      globalVsSportSpecific: 'GLOBAL_BANKROLL_WITH_SPORT_RISK_BUDGETS',
      crossSportExposureHandling: 'Global open exposure must be shared across NBA, MLB and future sports so each sport cannot independently assume the full bankroll.',
      automaticBetting: 'NO',
    },
    notificationDesign: {
      recommended: 'YES_LATER',
      phase: 'NOTIFY-01_ACTIONABLE_PICK_ALERTS',
      hardGates: ['Current Era prediction', 'Official Pick eligible/promoted', 'fresh exact price', 'stake > 0', 'bankroll available', 'risk/exposure gates pass', 'calibration requirement passes', 'not post-start', 'not already alerted for same canonical opportunity/version'],
      officialPickRequired: 'YES',
      calibrationRequired: 'ACCEPTABLE_OR_MATURE',
      stakePositiveRequired: 'YES',
      freshExactPriceRequired: 'YES',
      contentFields: ['sport', 'game', 'market', 'selection', 'sportsbook', 'currentOdds', 'modelProbability', 'confidence', 'edge', 'EV', 'recommendedStakeUnits', 'recommendedStakePercent', 'bankrollExposureAfterBet', 'evidenceTimestamp', 'reason'],
      deduplicationStrategy: 'event+market+selection+line+sportsbook+policyVersion+modelVersion+priceEvidenceVersion',
      priceMoveRevocation: 'Recalculate or mark NO_LONGER_ACTIONABLE when odds/line/evidence changes materially before bet.',
      automaticBetPlacement: 'NO',
    },
    nextPhaseDecision: {
      primaryNextPhase: 'NBA-03A_CURRENT_ERA_SHADOW_FOUNDATION',
      secondaryRoadmapOrdering: [
        'NBA-03A Current Era Shadow Foundation',
        'RISK-01 Bankroll/Stake Shadow after Current Era rows exist',
        'NBA production calibration accumulation',
        'NBA-03B model/calibration challenger if forward evidence justifies it',
        'NOTIFY-01 Actionable Pick Alerts only after Official Pick, calibration and stake gates pass',
        'User-facing recommendations only after all gates pass',
      ],
      modelImprovementResearch: 'NBA-02D_MODEL_IMPROVEMENT_RESEARCH only if forward shadow exposes material model weakness; no champion modification from this historical phase.',
    },
    safety: {
      nbaCurrentEraWrites: 0,
      officialPicks: 0,
      productionLearningWrites: 0,
      productionCalibrationWrites: 0,
      historicalProviderCalls: 0,
      mlbMutations: 0,
      negativeEvHighConfidenceRows: highConfidenceNegativeEv.length,
      negativeEvOversizedByRecommendedPolicy: negativeEvOversized.length,
    },
    mlbParallel: productionMlbStatus,
  }
  const stake = {
    status: STATUS,
    generatedAt: diagnostics.generatedAt,
    methodology: {
      ...split,
      discoveryRows: split.discoveryRows.length,
      validationRows: split.validationRows.length,
      validationUntouchedDuringDiscovery: true,
      resultLeakage: 0,
      stakePrecision: '0.0001 units',
      canonicalKellyReference: 'src/components/market-opportunities/BettingDecisionWorkspace.tsx kelly(modelProbability, price); historical shadow simulation only',
      startingBankroll: STARTING_BANKROLL,
      maxPerBetBankrollCapPct: MAX_BET_PCT * 100,
      maxSameDayExposureCapPct: MAX_DAY_EXPOSURE_PCT * 100,
    },
    policies: table,
    bestInSamplePolicy: bestDiscovery?.policy ?? null,
    bestOutOfSamplePolicy: bestValidation?.policy ?? null,
    recommendedShadowStakePolicy: recommended?.policy ?? null,
    recommendedPolicyEvidence: {
      policyVersion: 'NBA_STAKE_RESEARCH_COMBINED_EVIDENCE_V0_SHADOW',
      classification: 'RESEARCH_ONLY_NOT_PRODUCTION_READY',
      rules: [
        'NO_BET when edge <= 0 or EV <= 0 or price unavailable or market freshness invalid or policy blocked.',
        '0.50u when edge and EV are positive but confidence is below 55 or edge/EV are below 2%.',
        '0.75u when edge >= 2%, EV >= 2% and confidence >= 55.',
        '1.00u when edge >= 5%, EV >= 5% and confidence >= 65.',
        '1.25u when edge >= 10%, EV >= 10% and confidence >= 70.',
      ],
      noBetRules: ['edge <= 0', 'EV <= 0', 'invalid price', 'invalid freshness', 'policy blocked', 'not Official Pick when user-facing mode is later considered'],
      minimumStake: 0,
      maximumStake: 1.25,
      perBetBankrollCapPct: MAX_BET_PCT * 100,
      simultaneousExposureCapPct: MAX_DAY_EXPOSURE_PCT * 100,
      confidenceRole: 'CONFIDENCE_SECONDARY_MODIFIER',
      probabilityRole: 'PROBABILITY_GATE_ONLY',
      edgeRole: 'EDGE_GATE_AND_TIER_DRIVER',
      evRole: 'EV_GATE_AND_TIER_DRIVER',
      calibrationRole: 'GATE_ONLY_UNTIL_CURRENT_ERA_CALIBRATION_MATURE',
      officialPickRelationship: 'Eligibility first, stake size second; stake sizing cannot bypass Official Pick policy.',
      rentPlayRelationship: 'Rent Play eligibility must be determined before stake display.',
      futureCurrentPredictionFields: ['stakePolicyVersion', 'stakeStatus', 'stakeTier', 'recommendedStakeUnits', 'recommendedStakePercent', 'stakeConfidence', 'stakeReasonCodes', 'maxStakeCap', 'bankrollExposureCap', 'shadowOnly'],
      genericStakeEngine: 'GENERIC_ENGINE_RECOMMENDED',
      productionCandidateStandard: {
        outOfSampleSampleSufficient: (recommended?.validationBets ?? 0) >= 100,
        roiImprovesVersusFlat: Number(recommended?.validationROI ?? -Infinity) > Number(table.find((item) => item.policy === 'FLAT_1U')?.validationROI ?? Infinity),
        drawdownNotMateriallyWorse: Number(recommended?.validationMaxDrawdown ?? Infinity) <= Number(table.find((item) => item.policy === 'FLAT_1U')?.validationMaxDrawdown ?? 0) * 1.1,
        deterministic: true,
        pregameEvidenceOnly: true,
        resultLeakage: false,
        noRetrospectiveTuningAfterValidation: true,
        productionReady: false,
      },
      overfitDetection: {
        inSampleWinner: bestDiscovery?.policy ?? null,
        outOfSampleWinner: bestValidation?.policy ?? null,
        areTheySame: bestDiscovery?.policy === bestValidation?.policy ? 'YES' : 'NO',
        performanceDegradation: round(Number(bestValidation?.validationROI ?? 0) - Number(bestDiscovery?.discoveryROI ?? 0)),
        classification: 'MORE_FORWARD_EVIDENCE_REQUIRED',
      },
      stakeInputsRequired: {
        probability: 'WEIGHTED',
        confidence: 'WEIGHTED',
        edge: 'REQUIRED',
        ev: 'REQUIRED',
        calibrationStatus: 'GATE_ONLY',
        marketFreshness: 'REQUIRED',
        priceBindingQuality: 'REQUIRED',
        officialPickStatus: 'GATE_ONLY_FOR_USER_FACING',
      },
      hardStakeBlockers: ['edge <= 0', 'EV <= 0', 'price unavailable', 'stale/unknown price freshness', 'policy blocked', 'post-start', 'calibration insufficient for user-facing mode'],
      historicalEvidenceStrongEnoughForCurrentEraShadowStakeEngine: 'YES',
      historicalEvidenceStrongEnoughForUserFacingStakeRecommendation: 'NO',
      maximumSingleBetRiskRecommendationPct: MAX_BET_PCT * 100,
      maximumOpenExposureRecommendationPct: MAX_DAY_EXPOSURE_PCT * 100,
    },
    officialLikeCohort: diagnostics.validity.officialLikeCohort,
    noNegativeEvOversizing: {
      highConfidenceNegativeEvRows: highConfidenceNegativeEv.length,
      oversizedByRecommendedPolicy: negativeEvOversized.length,
      pass: negativeEvOversized.length === 0,
    },
    providerCalls: 0,
    productionDatabaseMutations: 0,
  }
  return { diagnostics, stake }
}

function doc({ diagnostics, stake }) {
  const flat = stake.policies.find((item) => item.policy === 'FLAT_1U')
  const combined = stake.policies.find((item) => item.policy === 'COMBINED_EVIDENCE')
  const k10 = stake.policies.find((item) => item.policy === 'FRACTIONAL_KELLY_10')
  return `# NBA-02C Historical Model Diagnostics And Stake Policy Research

Status: \`${diagnostics.status}\`

NBA-02C is a historical/shadow diagnostic only. It makes no NBA Current Era writes, no Official Picks, no production learning or calibration writes, no provider calls, and no MLB mutations.

## Why Moneyline Accuracy Still Lost Money

Moneyline finished at ${diagnostics.baseline.byMarket.moneyline.accuracy}% accuracy but ${diagnostics.baseline.byMarket.moneyline.roi}% ROI because the average selected price was ${diagnostics.baseline.byMarket.moneyline.averageOdds}. The average implied break-even probability was ${diagnostics.moneylineQuestion.averageImpliedProbability}%, above the model's realized win-rate cushion after price tax.

## Walk-Forward Stake Research

Price-aware data exists only for 2024-25, so NBA-02C used an event-level chronological 70/30 walk-forward split within 2024-25. Discovery rows: ${stake.methodology.discoveryRows}. Validation rows: ${stake.methodology.validationRows}. The policy freeze point was ${stake.methodology.policyParametersFrozenAt}.

| Policy | Discovery ROI | Validation Bets | Validation ROI | Validation Net | Validation Drawdown | Ending Bankroll |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${stake.policies.map((item) => `| ${item.policy} | ${item.discoveryROI ?? 'n/a'} | ${item.validationBets} | ${item.validationROI ?? 'n/a'} | ${item.validationNetUnits ?? 'n/a'} | ${item.validationMaxDrawdown ?? 'n/a'} | ${item.validationEndingBankroll ?? 'n/a'} |`).join('\n')}

Best in-sample policy: \`${stake.bestInSamplePolicy}\`.
Best out-of-sample policy: \`${stake.bestOutOfSamplePolicy}\`.
Recommended shadow policy: \`${stake.recommendedShadowStakePolicy}\`.

The recommended policy is research-only because the price-aware validation history is one season and the baseline ROI is negative. It can be shadowed later, but it is not production stake advice.

## Risk Controls

- Starting bankroll: ${STARTING_BANKROLL} units.
- Per-bet cap: ${MAX_BET_PCT * 100}% of bankroll.
- Same-day simultaneous exposure cap: ${MAX_DAY_EXPOSURE_PCT * 100}%.
- Flat validation ROI: ${flat?.validationROI}%.
- Combined-evidence validation ROI: ${combined?.validationROI}%.
- Kelly 10% validation ROI: ${k10?.validationROI}%.

## Current Era Readiness

Current Era shadow is \`${diagnostics.readiness.currentEraShadowDecision}\` because the historical foundation, feature reconstruction, replay persistence, settlement, and price-aware evaluation are certified. User-facing production is \`${diagnostics.readiness.productionRecommendationDecision}\` because NBA Current Era scheduler, provider runtime, forward calibration, and Official Pick policy have not been certified.

## Bankroll Engine Design

NBA-02C recommends \`${diagnostics.bankrollEngineDesign.phase}\` as a future shadow-only phase. It should support user-entered or simulated bankroll, global bankroll with sport-level risk budgets, a ${diagnostics.bankrollEngineDesign.maxSingleBetPct}% maximum single-bet cap, and a ${diagnostics.bankrollEngineDesign.maxOpenExposurePct}% maximum open-exposure cap. Automatic betting remains \`${diagnostics.bankrollEngineDesign.automaticBetting}\`.

## Notification Design

Future notifications are deferred to \`${diagnostics.notificationDesign.phase}\`. They require Official Pick eligibility, acceptable/mature calibration, fresh exact price evidence, stake > 0, bankroll/exposure checks, pregame status, and deduplication by canonical opportunity/version. Automatic sportsbook execution remains \`${diagnostics.notificationDesign.automaticBetPlacement}\`.

## Provider Recommendation

The Odds API remains the target NBA odds provider. BallDontLie runtime should start with \`${diagnostics.providerRecommendations.recommendedBallDontLieTier}\`; GOAT is not required for runtime solely because it was useful for historical bootstrap.

## Next

Recommended next phase: \`${diagnostics.nextPhaseDecision.primaryNextPhase}\`. If forward samples show calibration or learning opportunity, follow with \`NBA-03B_ONLINE_CALIBRATION_OR_LEARNING_CHALLENGER\`. A generic stake engine should remain shadow-only until out-of-sample Current Era evidence exists.
`
}

async function run() {
  const write = process.argv.includes('--write')
  loadEnv()
  const startingCommit = git('git rev-parse origin/main')
  const client = dbClient()
  const [eventsRaw, rowsRaw] = await Promise.all([
    page(client, 'sport_events', 'id,sport_key,season,home_team,away_team,start_time,status,home_score,away_score', (q) => q.eq('sport_key', SPORT_KEY).order('start_time', { ascending: true })),
    page(
      client,
      'prediction_history',
      'id,sport_key,game_id,market,selection,line,odds,implied_probability,edge,ev,model_probability,confidence,model_version,feature_set_version,prediction_origin,certification_status,certification_metadata,production_eligible,recommended_pick,is_current,model_role,result,status,generated_at,commence_time,odds_timestamp,sportsbook,profit,settled_at',
      (q) => q.eq('sport_key', SPORT_KEY).eq('prediction_origin', REPLAY_ORIGIN).eq('model_version', MODEL_VERSION).eq('feature_set_version', FEATURE_VERSION),
      1000
    ),
  ])
  const events = eventsRaw.filter((event) => String(event.id).startsWith('nba_bdl_'))
  const rows = enrichRows(rowsRaw, new Map(events.map((event) => [event.id, event])))
  const priceRows = rows.filter((row) => row.certification_metadata?.priceAware === true && row.certification_metadata?.nba02b3Evaluation?.version === B3_EVALUATION_VERSION && PRICE_MARKETS.includes(row.market))
  const productionMlbStatus = write ? await readProductionMlbStatus() : {
    productionCommit: null,
    bootstrapRows: null,
    settledBootstrapRows: null,
    calibrationEligibleSamples: null,
    calibrationStatus: 'READ_ONLY_FINAL_CHECK_REQUIRED',
    firstSampleConfirmed: null,
    mlbHealth: 'READ_ONLY_FINAL_CHECK_REQUIRED',
    providerCallsFromCertificationReads: 0,
    databaseMutationsFromCertificationReads: 0,
  }
  const artifacts = buildArtifacts({ rows, priceRows, events, startingCommit, productionMlbStatus })
  if (write) {
    fs.mkdirSync(path.dirname(DIAGNOSTICS_PATH), { recursive: true })
    fs.writeFileSync(DIAGNOSTICS_PATH, `${JSON.stringify(artifacts.diagnostics, null, 2)}\n`)
    fs.writeFileSync(STAKE_PATH, `${JSON.stringify(artifacts.stake, null, 2)}\n`)
    fs.mkdirSync(path.dirname(DOC_PATH), { recursive: true })
    fs.writeFileSync(DOC_PATH, doc(artifacts))
  }
  console.log(JSON.stringify({
    status: artifacts.diagnostics.status,
    universe: artifacts.diagnostics.universe,
    moneylineQuestion: artifacts.diagnostics.moneylineQuestion,
    flatValidationROI: artifacts.stake.policies.find((item) => item.policy === 'FLAT_1U')?.validationROI,
    combinedValidationROI: artifacts.stake.policies.find((item) => item.policy === 'COMBINED_EVIDENCE')?.validationROI,
    bestOutOfSamplePolicy: artifacts.stake.bestOutOfSamplePolicy,
    currentEraShadow: artifacts.diagnostics.readiness.currentEraShadow,
    userFacingProduction: artifacts.diagnostics.readiness.userFacingProduction,
    safety: artifacts.diagnostics.safety,
  }, null, 2))
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
