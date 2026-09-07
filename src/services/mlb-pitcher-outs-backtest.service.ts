import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type RawRow = Record<string, unknown>
type Fit = { intercept: number; slope: number }
type Scored = { actual: number; predicted: number }
type Metrics = {
  n: number
  mae: number | null
  rmse: number | null
  bias: number | null
  correlation: number | null
  averagePrediction: number | null
  averageActual: number | null
}

type HistoricalRow = {
  date: string
  split: 'TRAIN' | 'VALIDATION' | 'TEST'
  actual: number
  priorOutsL5: number
  priorOutsAll: number
  previousPitchCount: number
  priorPitchCountAll: number
}

type SportsDataStarter = {
  id: string
  playerId: string
  playerName: string
  date: string
  team: string
  opponent: string
  pitches: number
  outs: number
  strikeouts: number
  validationStatus: string | null
  productionEligible: boolean | null
}

type StatcastRow = {
  gamePk: number
  date: string
  pitcherId: number
  playerName: string
  pitchingTeam: string
  opponentTeam: string
  totalPitches: number
  strikeouts: number
}

type PregameFeature = {
  gamePk: number
  pitcherId: number
  featureDate: string
  asOfDate: string
  previousPitchCount: number
  sourceRule: string | null
}

type HoldoutRow = {
  date: string
  gamePk: number
  pitcherId: number
  actual: number
  priorOutsL5: number
  priorOutsAll: number
  previousPitchCount: number
  priorPitchCountAll: number
  strikeoutsReconciled: boolean
  strictPriorFeature: boolean
}

const MODEL_VERSION = 'MLB_PITCHER_OUTS_RESEARCH_V1'
const SOURCE_FEATURE_VERSION = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const SOURCE_RULE = 'source_game_date < target_game_date'
const PAGE_SIZE = 1000
const GRID = Array.from({ length: 11 }, (_, index) => index / 10)
const PROP_LINES = [14.5, 15.5, 16.5, 17.5, 18.5]

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function requiredNumber(value: unknown, label: string) {
  const valueNumber = numberOrNull(value)
  if (valueNumber === null) throw new Error(`Missing numeric field ${label}`)
  return valueNumber
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function normalizeName(name: string) {
  const trimmed = name.trim()
  const ordered = trimmed.includes(',')
    ? `${trimmed.split(',').slice(1).join(',').trim()} ${trimmed.split(',')[0].trim()}`
    : trimmed
  return ordered
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTeam(team: string) {
  const upper = team.trim().toUpperCase()
  if (upper === 'ARI') return 'AZ'
  if (upper === 'CWS') return 'CHW'
  return upper
}

async function fetchHistorical2025(): Promise<HistoricalRow[]> {
  const output: HistoricalRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('mlb_pitcher_prop_backtest_2025_v1_enriched')
      .select('game_date,fixed_split,target_outs,prior_outs_l5,prior_outs_all,previous_pitch_count,prior_pitch_count_all')
      .order('game_date', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`2025 pitcher outs research read failed: ${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]
    for (const row of page) {
      const priorOutsL5 = numberOrNull(row.prior_outs_l5)
      const priorOutsAll = numberOrNull(row.prior_outs_all)
      const previousPitchCount = numberOrNull(row.previous_pitch_count)
      const priorPitchCountAll = numberOrNull(row.prior_pitch_count_all)
      const actual = numberOrNull(row.target_outs)
      if (actual === null || priorOutsL5 === null || priorOutsAll === null || previousPitchCount === null || priorPitchCountAll === null || priorPitchCountAll <= 0) continue
      output.push({
        date: String(row.game_date),
        split: String(row.fixed_split) as HistoricalRow['split'],
        actual,
        priorOutsL5,
        priorOutsAll,
        previousPitchCount,
        priorPitchCountAll,
      })
    }
    if (page.length < PAGE_SIZE) break
  }
  return output
}

async function fetchSportsDataStarters(): Promise<SportsDataStarter[]> {
  const output: SportsDataStarter[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('sport_player_stats')
      .select('id,player_id,player_name,stats,metadata')
      .eq('sport_key', 'baseball_mlb')
      .eq('league_key', 'mlb')
      .eq('season', '2026')
      .eq('stat_type', 'game')
      .eq('provider', 'sportsdataio')
      .eq('stats->>Started', '1')
      .gt('stats->>PitchesThrown', 0)
      .order('source_timestamp', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`SportsDataIO quarantined pitcher-start read failed: ${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]
    for (const row of page) {
      const stats = (row.stats ?? {}) as RawRow
      const metadata = (row.metadata ?? {}) as RawRow
      output.push({
        id: String(row.id),
        playerId: String(row.player_id),
        playerName: String(row.player_name),
        date: String(stats.Day).slice(0, 10),
        team: String(stats.Team),
        opponent: String(stats.Opponent),
        pitches: requiredNumber(stats.PitchesThrown, 'PitchesThrown'),
        outs: requiredNumber(stats.TotalOutsPitched, 'TotalOutsPitched'),
        strikeouts: requiredNumber(stats.PitchingStrikeouts, 'PitchingStrikeouts'),
        validationStatus: text(metadata.validation_status),
        productionEligible: typeof metadata.production_eligible === 'boolean' ? metadata.production_eligible : null,
      })
    }
    if (page.length < PAGE_SIZE) break
  }
  return output
}

async function fetchStatcast2026(): Promise<StatcastRow[]> {
  const output: StatcastRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('mlb_statcast_pitcher_game_logs')
      .select('game_pk,game_date,pitcher,player_name,pitching_team,opponent_team,total_pitches,strikeouts')
      .eq('season', 2026)
      .gte('total_pitches', 20)
      .order('game_date', { ascending: true })
      .order('game_pk', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`2026 Statcast pitcher-log read failed: ${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]
    for (const row of page) {
      output.push({
        gamePk: requiredNumber(row.game_pk, 'game_pk'),
        date: String(row.game_date),
        pitcherId: requiredNumber(row.pitcher, 'pitcher'),
        playerName: String(row.player_name),
        pitchingTeam: String(row.pitching_team),
        opponentTeam: String(row.opponent_team),
        totalPitches: requiredNumber(row.total_pitches, 'total_pitches'),
        strikeouts: requiredNumber(row.strikeouts, 'strikeouts'),
      })
    }
    if (page.length < PAGE_SIZE) break
  }
  return output
}

async function fetchPregameFeatures2026(): Promise<PregameFeature[]> {
  const output: PregameFeature[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('pick2_mlb_pitcher_daily_features')
      .select('target_game_pk,mlbam_pitcher_id,feature_date,as_of_date,previous_pitch_count,source_window')
      .eq('feature_version', SOURCE_FEATURE_VERSION)
      .gte('feature_date', '2026-01-01')
      .lt('feature_date', '2027-01-01')
      .order('feature_date', { ascending: true })
      .order('target_game_pk', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`2026 pregame feature read failed: ${error.message}`)
    const page = (data ?? []) as unknown as RawRow[]
    for (const row of page) {
      const sourceWindow = (row.source_window ?? {}) as RawRow
      output.push({
        gamePk: requiredNumber(row.target_game_pk, 'target_game_pk'),
        pitcherId: requiredNumber(row.mlbam_pitcher_id, 'mlbam_pitcher_id'),
        featureDate: String(row.feature_date),
        asOfDate: String(row.as_of_date),
        previousPitchCount: requiredNumber(row.previous_pitch_count, 'previous_pitch_count'),
        sourceRule: text(sourceWindow.rule),
      })
    }
    if (page.length < PAGE_SIZE) break
  }
  return output
}

function rawScore(row: Pick<HistoricalRow, 'priorOutsL5' | 'priorOutsAll' | 'previousPitchCount' | 'priorPitchCountAll'>, alpha: number, beta: number) {
  if (row.priorPitchCountAll <= 0) return null
  const smoothedOuts = alpha * row.priorOutsL5 + (1 - alpha) * row.priorOutsAll
  const workloadOuts = row.previousPitchCount * (row.priorOutsAll / row.priorPitchCountAll)
  return beta * smoothedOuts + (1 - beta) * workloadOuts
}

function linearFit(rows: Array<{ x: number; y: number }>): Fit | null {
  if (rows.length < 2) return null
  const meanX = mean(rows.map((row) => row.x))
  const meanY = mean(rows.map((row) => row.y))
  if (meanX === null || meanY === null) return null
  let numerator = 0
  let denominator = 0
  for (const row of rows) {
    numerator += (row.x - meanX) * (row.y - meanY)
    denominator += (row.x - meanX) ** 2
  }
  if (denominator <= 0) return null
  const slope = numerator / denominator
  return { intercept: meanY - slope * meanX, slope }
}

function correlation(rows: Scored[]) {
  if (rows.length < 2) return null
  const meanX = mean(rows.map((row) => row.predicted))
  const meanY = mean(rows.map((row) => row.actual))
  if (meanX === null || meanY === null) return null
  let numerator = 0
  let x2 = 0
  let y2 = 0
  for (const row of rows) {
    const x = row.predicted - meanX
    const y = row.actual - meanY
    numerator += x * y
    x2 += x * x
    y2 += y * y
  }
  return x2 > 0 && y2 > 0 ? numerator / Math.sqrt(x2 * y2) : null
}

function metrics(rows: Scored[]): Metrics {
  if (!rows.length) return { n: 0, mae: null, rmse: null, bias: null, correlation: null, averagePrediction: null, averageActual: null }
  const errors = rows.map((row) => row.predicted - row.actual)
  return {
    n: rows.length,
    mae: mean(errors.map((error) => Math.abs(error))),
    rmse: Math.sqrt(mean(errors.map((error) => error * error)) ?? 0),
    bias: mean(errors),
    correlation: correlation(rows),
    averagePrediction: mean(rows.map((row) => row.predicted)),
    averageActual: mean(rows.map((row) => row.actual)),
  }
}

function fitRows(rows: HistoricalRow[], alpha: number, beta: number) {
  const points = rows.flatMap((row) => {
    const raw = rawScore(row, alpha, beta)
    return raw === null ? [] : [{ x: raw, y: row.actual }]
  })
  return linearFit(points)
}

function scoreRows<T extends HistoricalRow | HoldoutRow>(rows: T[], fit: Fit, alpha: number, beta: number): Scored[] {
  return rows.flatMap((row) => {
    const raw = rawScore(row, alpha, beta)
    return raw === null ? [] : [{ actual: row.actual, predicted: fit.intercept + fit.slope * raw }]
  })
}

function selectHyperparameters(train: HistoricalRow[], validation: HistoricalRow[]) {
  const candidates: Array<{ alpha: number; beta: number; fit: Fit; validation: Metrics }> = []
  for (const alpha of GRID) {
    for (const beta of GRID) {
      const fit = fitRows(train, alpha, beta)
      if (!fit) continue
      candidates.push({ alpha, beta, fit, validation: metrics(scoreRows(validation, fit, alpha, beta)) })
    }
  }
  candidates.sort((a, b) =>
    (a.validation.rmse ?? Infinity) - (b.validation.rmse ?? Infinity) ||
    (a.validation.mae ?? Infinity) - (b.validation.mae ?? Infinity) ||
    a.alpha - b.alpha || a.beta - b.beta,
  )
  const selected = candidates[0]
  if (!selected) throw new Error('No valid pitcher outs hyperparameter candidate')
  return { selected, top: candidates.slice(0, 10).map(({ alpha, beta, validation }) => ({ alpha, beta, validation })) }
}

function buildHoldout(starters: SportsDataStarter[], statcast: StatcastRow[], features: PregameFeature[]) {
  const startersSorted = [...starters].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const history = new Map<string, Array<{ date: string; outs: number; pitches: number }>>()
  const rolling = new Map<string, { priorOutsL5: number; priorOutsAll: number; priorPitchCountAll: number }>()
  let index = 0
  while (index < startersSorted.length) {
    const date = startersSorted[index].date
    let end = index
    while (end < startersSorted.length && startersSorted[end].date === date) end += 1
    const dateRows = startersSorted.slice(index, end)
    for (const row of dateRows) {
      const prior = (history.get(row.playerId) ?? []).filter((item) => item.date < date)
      const priorOutsAll = mean(prior.map((item) => item.outs))
      const priorOutsL5 = mean(prior.slice(-5).map((item) => item.outs))
      const priorPitchCountAll = mean(prior.map((item) => item.pitches))
      if (priorOutsAll !== null && priorOutsL5 !== null && priorPitchCountAll !== null && priorPitchCountAll > 0) {
        rolling.set(row.id, { priorOutsL5, priorOutsAll, priorPitchCountAll })
      }
    }
    for (const row of dateRows) {
      const prior = history.get(row.playerId) ?? []
      prior.push({ date: row.date, outs: row.outs, pitches: row.pitches })
      history.set(row.playerId, prior)
    }
    index = end
  }

  const statcastIndex = new Map<string, StatcastRow[]>()
  for (const row of statcast) {
    const key = `${row.date}|${normalizeName(row.playerName)}|${row.pitchingTeam}|${row.opponentTeam}`
    const bucket = statcastIndex.get(key) ?? []
    bucket.push(row)
    statcastIndex.set(key, bucket)
  }
  const featureIndex = new Map(features.map((row) => [`${row.gamePk}|${row.pitcherId}`, row]))

  const output: HoldoutRow[] = []
  let matchedSportsDataStatcast = 0
  let strikeoutsReconciled = 0
  let strictPriorFeatures = 0
  for (const starter of starters) {
    const prior = rolling.get(starter.id)
    if (!prior) continue
    const key = `${starter.date}|${normalizeName(starter.playerName)}|${normalizeTeam(starter.team)}|${normalizeTeam(starter.opponent)}`
    const candidates = statcastIndex.get(key) ?? []
    if (!candidates.length) continue
    const stat = [...candidates].sort((a, b) => Math.abs(starter.pitches - a.totalPitches) - Math.abs(starter.pitches - b.totalPitches) || a.gamePk - b.gamePk)[0]
    matchedSportsDataStatcast += 1
    const reconciled = starter.strikeouts === stat.strikeouts
    if (reconciled) strikeoutsReconciled += 1
    const feature = featureIndex.get(`${stat.gamePk}|${stat.pitcherId}`)
    if (!feature || feature.featureDate !== starter.date) continue
    const strictPriorFeature = feature.asOfDate < feature.featureDate && feature.sourceRule === SOURCE_RULE
    if (strictPriorFeature) strictPriorFeatures += 1
    if (!strictPriorFeature) continue
    output.push({
      date: starter.date,
      gamePk: stat.gamePk,
      pitcherId: stat.pitcherId,
      actual: starter.outs,
      ...prior,
      previousPitchCount: feature.previousPitchCount,
      strikeoutsReconciled: reconciled,
      strictPriorFeature,
    })
  }
  return { rows: output, matchedSportsDataStatcast, strikeoutsReconciled, strictPriorFeatures }
}

function baseline(rows: Array<HistoricalRow | HoldoutRow>, kind: 'prior_all' | 'l5' | 'workload') {
  return rows.map((row) => {
    const predicted = kind === 'prior_all'
      ? row.priorOutsAll
      : kind === 'l5'
        ? row.priorOutsL5
        : row.previousPitchCount * (row.priorOutsAll / row.priorPitchCountAll)
    return { actual: row.actual, predicted }
  })
}

function empiricalProbabilityMetrics(rows: Scored[], trainResiduals: number[]) {
  const sorted = [...trainResiduals].sort((a, b) => a - b)
  function probabilityResidualAbove(threshold: number) {
    let low = 0
    let high = sorted.length
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (sorted[mid] <= threshold) low = mid + 1
      else high = mid
    }
    return sorted.length ? (sorted.length - low) / sorted.length : 0
  }
  return PROP_LINES.map((line) => {
    const observations = rows.map((row) => {
      const probabilityOver = probabilityResidualAbove(line - row.predicted)
      const actualOver = row.actual > line ? 1 : 0
      return { probabilityOver, actualOver }
    })
    const actualRate = mean(observations.map((row) => row.actualOver)) ?? 0
    const brier = mean(observations.map((row) => (row.probabilityOver - row.actualOver) ** 2)) ?? 0
    const climatologyBrier = actualRate * (1 - actualRate)
    return {
      line,
      n: observations.length,
      actualOverRate: actualRate,
      meanPredictedOver: mean(observations.map((row) => row.probabilityOver)),
      brier,
      climatologyBrier,
      brierSkill: climatologyBrier > 0 ? 1 - brier / climatologyBrier : null,
    }
  })
}

function monthlyMetrics(rows: HoldoutRow[], fit: Fit, alpha: number, beta: number) {
  const buckets = new Map<string, HoldoutRow[]>()
  for (const row of rows) {
    const key = row.date.slice(0, 7)
    const bucket = buckets.get(key) ?? []
    bucket.push(row)
    buckets.set(key, bucket)
  }
  return [...buckets.entries()].map(([month, bucket]) => ({ month, ...metrics(scoreRows(bucket, fit, alpha, beta)) }))
}

export async function runMlbPitcherOutsBacktest() {
  const [historical, starters, statcast, features] = await Promise.all([
    fetchHistorical2025(),
    fetchSportsDataStarters(),
    fetchStatcast2026(),
    fetchPregameFeatures2026(),
  ])
  const train = historical.filter((row) => row.split === 'TRAIN')
  const validation = historical.filter((row) => row.split === 'VALIDATION')
  const test = historical.filter((row) => row.split === 'TEST')
  const search = selectHyperparameters(train, validation)
  const { alpha, beta, fit } = search.selected
  const trainScored = scoreRows(train, fit, alpha, beta)
  const validationScored = scoreRows(validation, fit, alpha, beta)
  const testScored = scoreRows(test, fit, alpha, beta)
  const trainResiduals = trainScored.map((row) => row.actual - row.predicted)
  const holdout = buildHoldout(starters, statcast, features)
  const holdoutScored = scoreRows(holdout.rows, fit, alpha, beta)
  const allQuarantined = starters.every((row) => row.validationStatus === 'quarantined' && row.productionEligible === false)

  return {
    modelVersion: MODEL_VERSION,
    status: 'SHADOW_CANDIDATE_ONLY',
    activation: {
      sportsbookCalls: 0,
      oddsApiCalls: 0,
      officialPickWrites: 0,
      productionBettingActivation: false,
    },
    researchBoundary: {
      sportsDataIoGameStatsUsedAsHistoricalLabelsOnly: true,
      sportsDataIoRowsRemainQuarantined: allQuarantined,
      sourceFeatureVersion: SOURCE_FEATURE_VERSION,
      strictSourceRule: SOURCE_RULE,
    },
    selectedHyperparameters: { alpha, beta, fit },
    selection: {
      train: metrics(trainScored),
      validation: metrics(validationScored),
      topValidationCandidates: search.top,
    },
    fixed2025Test: {
      metrics: metrics(testScored),
      baselines: {
        priorAll: metrics(baseline(test, 'prior_all')),
        priorL5: metrics(baseline(test, 'l5')),
        workload: metrics(baseline(test, 'workload')),
      },
      probability: empiricalProbabilityMetrics(testScored, trainResiduals),
    },
    external2026Holdout: {
      sourceDateRange: holdout.rows.length ? { from: holdout.rows[0].date, to: holdout.rows[holdout.rows.length - 1].date } : null,
      sportsDataStarterRows: starters.length,
      matchedSportsDataStatcast: holdout.matchedSportsDataStatcast,
      strikeoutsReconciled: holdout.strikeoutsReconciled,
      strictPriorFeatureRows: holdout.strictPriorFeatures,
      scoredRows: holdoutScored.length,
      metrics: metrics(holdoutScored),
      baselines: {
        priorAll: metrics(baseline(holdout.rows, 'prior_all')),
        priorL5: metrics(baseline(holdout.rows, 'l5')),
        workload: metrics(baseline(holdout.rows, 'workload')),
      },
      probability: empiricalProbabilityMetrics(holdoutScored, trainResiduals),
      monthly: monthlyMetrics(holdout.rows, fit, alpha, beta),
    },
    nextGate: 'FORWARD_SHADOW_VS_FROZEN_REAL_PROP_LINES',
    note: 'Research-only pitcher outs model. It may not create Official Picks or activate betting without a separate authorized gate.',
  }
}
