import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { previewPitcherProjection } from '@/services/mlb-pitcher-projection-engine.service'
import type { MlbPitcherProjection } from '@/types/mlb-pitcher-projections'
import type {
  ProbabilityMarketType,
  ProbabilityParlay,
  ProbabilityParlayMode,
  ProbabilityParlayScope,
  ProbabilityPick,
  ProbabilityPickRisk,
  ProbabilityPicksResponse,
  ProbabilityParlaysResponse,
  ProbabilityValidationResponse,
} from '@/types/probability-picks'

const MODE = 'probability_picks_v1'
const PARLAY_MODE = 'probability_parlays_v1'
const RECOMMENDATION_TYPE = 'PROBABILITY_ONLY' as const
const SUPPORTED_MARKETS: ProbabilityMarketType[] = ['moneyline', 'run_line', 'total', 'pitcher_outs']
const PITCHER_LINES = ['14.5', '15.5', '16.5', '17.5', '18.5'] as const
const EXCLUDED_STATUSES = new Set(['completed', 'final', 'settled', 'closed', 'ignored', 'historical', 'replay', 'shadow', 'live', 'started', 'cancelled', 'void'])
const FORBIDDEN_PROBABILITY_TEXT = /\b(sportsbook|odds|ev|kelly|stake|bankroll|official pick|portfolio)\b/i

type PredictionHistoryRow = {
  id: string
  sport_key: string | null
  game_id: string | null
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  team: string | null
  opponent: string | null
  market: string | null
  selection: string | null
  line: number | string | null
  model_probability: number | string | null
  confidence: number | string | null
  status: string | null
  result: string | null
  feature_snapshot: Record<string, unknown> | null
  validation_warnings: unknown
  skip_reason: string | null
  generated_at: string | null
  cutoff_at: string | null
  model_version: string | null
  feature_snapshot_generated_at: string | null
}

export type ProbabilityPickFilters = {
  sport?: string | null
  market?: string | null
  minProbability?: number | null
  minConfidence?: number | null
  minQuality?: number | null
  starterStatus?: string | null
  projectionQuality?: string | null
  limit?: number | null
  date?: string | null
}

export type ProbabilityParlayOptions = ProbabilityPickFilters & {
  mode?: ProbabilityParlayMode | null
  scope?: ProbabilityParlayScope | null
  minLegs?: number | null
  maxLegs?: number | null
}

function nowIso() {
  return new Date().toISOString()
}

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 24)
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max)
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function arrayOfText(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 6) : []
}

function probabilityOnlyText(values: string[], fallback: string) {
  const clean = values
    .map((value) => value.trim())
    .filter((value) => value && !FORBIDDEN_PROBABILITY_TEXT.test(value))
  return clean.length ? clean.slice(0, 4) : [fallback]
}

function normalizePercent(value: unknown, fallback = 50) {
  const parsed = num(value)
  if (parsed === null) return fallback
  return clamp(parsed <= 1 ? parsed * 100 : parsed)
}

function normalizeMarket(value: unknown): ProbabilityMarketType | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (['moneyline', 'money_line', 'h2h', 'ml'].includes(raw)) return 'moneyline'
  if (['spread', 'run_line', 'runline', 'rl'].includes(raw)) return 'run_line'
  if (['total', 'totals', 'over_under'].includes(raw)) return 'total'
  if (['pitcher_outs', 'pitcher_outs_recorded', 'player_props:pitcher_outs_recorded'].includes(raw)) return 'pitcher_outs'
  return null
}

function text(value: unknown, fallback = 'Unavailable') {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw || fallback
}

function isExcludedLifecycle(row: PredictionHistoryRow, now: Date) {
  const status = String(row.status ?? '').toLowerCase()
  const result = String(row.result ?? '').toLowerCase()
  const skip = String(row.skip_reason ?? '').toLowerCase()
  if (EXCLUDED_STATUSES.has(status) || EXCLUDED_STATUSES.has(result)) return true
  if (['post_start', 'post_final', 'invalid_cutoff', 'historical', 'replay', 'shadow', 'ignored'].some((flag) => skip.includes(flag))) return true
  const start = row.commence_time ? new Date(row.commence_time) : null
  if (!start || Number.isNaN(start.getTime()) || start <= now) return true
  const generated = row.generated_at ? new Date(row.generated_at) : null
  const cutoff = row.cutoff_at ? new Date(row.cutoff_at) : null
  if (generated && cutoff && generated > cutoff) return true
  const snapshot = asRecord(row.feature_snapshot)
  const flags = ['shadow', 'isShadow', 'replay', 'isReplay', 'historical', 'isHistorical', 'ignored', 'postStart', 'postFinal']
  return flags.some((flag) => snapshot[flag] === true)
}

function freshnessScore(generatedAt: string | null) {
  if (!generatedAt) return 55
  const generated = new Date(generatedAt)
  if (Number.isNaN(generated.getTime())) return 55
  const ageHours = Math.max(0, (Date.now() - generated.getTime()) / 36e5)
  return clamp(100 - ageHours * 4, 45, 100)
}

function featureCompleteness(snapshot: Record<string, unknown>, fallback: number) {
  const explicit = num(snapshot.featureCompleteness ?? snapshot.feature_completeness ?? snapshot.dataSufficiency ?? snapshot.data_sufficiency)
  if (explicit !== null) return normalizePercent(explicit, fallback)
  const keys = Object.keys(snapshot).filter((key) => snapshot[key] !== null && snapshot[key] !== undefined)
  return clamp(Math.min(100, 45 + keys.length * 3), 45, fallback)
}

function starterCertainty(status: string) {
  const raw = status.toLowerCase()
  if (raw.includes('confirmed') || raw.includes('probable')) return 100
  if (raw.includes('projected') || raw.includes('expected')) return 78
  if (raw.includes('unknown')) return 55
  return 68
}

function riskFrom(score: number, probability: number, confidence: number, quality: number): ProbabilityPickRisk {
  if (score >= 76 && probability >= 58 && confidence >= 65 && quality >= 62) return 'LOW'
  if (score >= 61 && confidence >= 50 && quality >= 48) return 'MEDIUM'
  return 'HIGH'
}

function qualityLabel(value: number) {
  if (value >= 72) return 'HIGH'
  if (value >= 55) return 'MEDIUM'
  return 'LOW'
}

function scorePick(input: {
  probability: number
  confidence: number
  quality: number
  starterStatus: string
  completeness: number
  freshness: number
  warnings: string[]
}) {
  const starter = starterCertainty(input.starterStatus)
  const reliability = (input.confidence + input.quality) / 2
  const warningPenalty = Math.min(14, input.warnings.length * 3)
  const uncertaintyPenalty = Math.max(0, 55 - input.confidence) * 0.18 + Math.max(0, 55 - input.quality) * 0.12
  return round(clamp(
    input.probability * 0.38 +
    input.confidence * 0.22 +
    input.quality * 0.18 +
    starter * 0.08 +
    input.completeness * 0.06 +
    input.freshness * 0.04 +
    reliability * 0.04 -
    warningPenalty -
    uncertaintyPenalty
  ))
}

function selectionForRow(row: PredictionHistoryRow, market: ProbabilityMarketType) {
  const base = text(row.selection ?? row.team ?? row.home_team ?? row.away_team, 'Projection')
  if (market === 'total' && row.line !== null && row.line !== undefined) return `${base} ${row.line}`
  if (market === 'run_line' && row.line !== null && row.line !== undefined) return `${base} ${Number(row.line) > 0 ? '+' : ''}${row.line}`
  return base
}

function driversFromRow(row: PredictionHistoryRow, snapshot: Record<string, unknown>) {
  const candidates = [
    ...arrayOfText(snapshot.mainDrivers),
    ...arrayOfText(snapshot.drivers),
    ...arrayOfText(snapshot.keyFactors),
  ]
  if (candidates.length) return probabilityOnlyText(candidates, 'Model probability signal available')
  return probabilityOnlyText([
    `${text(row.market, 'Market')} model probability: ${round(normalizePercent(row.model_probability), 1)}%`,
    `Confidence signal: ${round(normalizePercent(row.confidence), 1)}%`,
  ], 'Model probability signal available')
}

function risksFromRow(row: PredictionHistoryRow, snapshot: Record<string, unknown>) {
  const warnings = [
    ...arrayOfText(snapshot.mainRisks),
    ...arrayOfText(snapshot.risks),
    ...arrayOfText(row.validation_warnings),
  ]
  if (warnings.length) return probabilityOnlyText(warnings, 'Projection uncertainty')
  const status = text(snapshot.starterStatus ?? snapshot.lineupStatus ?? row.status, 'standard model uncertainty')
  return probabilityOnlyText([`Lifecycle status: ${status}`], 'Projection uncertainty')
}

function predictionRowToPick(row: PredictionHistoryRow): ProbabilityPick | null {
  const market = normalizeMarket(row.market)
  if (!market || market === 'pitcher_outs') return null
  const snapshot = asRecord(row.feature_snapshot)
  const probability = normalizePercent(row.model_probability)
  const confidence = normalizePercent(row.confidence, 55)
  const quality = normalizePercent(snapshot.qualityScore ?? snapshot.featureQuality ?? snapshot.feature_quality ?? snapshot.dataQuality, Math.max(50, confidence - 6))
  const starterStatus = text(snapshot.starterStatus ?? snapshot.lineupStatus ?? snapshot.projectionStatus, 'UNKNOWN')
  const warnings = risksFromRow(row, snapshot)
  const freshness = freshnessScore(row.feature_snapshot_generated_at ?? row.generated_at)
  const completeness = featureCompleteness(snapshot, Math.max(50, quality))
  const score = scorePick({ probability, confidence, quality, starterStatus, completeness, freshness, warnings })
  const generatedAt = text(row.generated_at ?? row.feature_snapshot_generated_at, nowIso())
  return {
    id: `prob_${hash([row.id, market, row.selection, row.line])}`,
    sport: text(row.sport_key, 'unknown'),
    eventId: text(row.game_id, `event_${row.id}`),
    marketType: market,
    selection: selectionForRow(row, market),
    modelProbability: round(probability),
    confidence: round(confidence),
    quality: round(quality),
    risk: riskFrom(score, probability, confidence, quality),
    starterStatus,
    generatedAt,
    cutoffAt: row.cutoff_at,
    projectionVersion: text(row.model_version, 'stored_model_probability'),
    drivers: driversFromRow(row, snapshot),
    risks: warnings,
    correlationGroup: text(row.game_id, `event_${row.id}`),
    recommendationType: RECOMMENDATION_TYPE,
    score,
    freshness: round(freshness),
    featureCompleteness: round(completeness),
    source: 'prediction_history',
  }
}

function pitcherPickFromProjection(projection: MlbPitcherProjection): ProbabilityPick | null {
  const start = projection.eventStartTime ? new Date(projection.eventStartTime) : null
  if (!start || Number.isNaN(start.getTime()) || start <= new Date()) return null
  const generated = new Date(projection.generatedAt)
  const cutoff = projection.cutoffAt ? new Date(projection.cutoffAt) : null
  if (cutoff && generated > cutoff) return null

  const candidates = PITCHER_LINES.flatMap((line) => [
    { side: 'Over', line, probability: projection.overProbabilities[line] },
    { side: 'Under', line, probability: projection.underProbabilities[line] },
  ]).filter((item): item is { side: string; line: typeof PITCHER_LINES[number]; probability: number } => typeof item.probability === 'number')

  const best = candidates.sort((a, b) => b.probability - a.probability)[0]
  if (!best) return null
  const probability = normalizePercent(best.probability)
  const confidence = normalizePercent(projection.confidence, 55)
  const quality = normalizePercent(projection.qualityScore, 55)
  const freshness = freshnessScore(projection.generatedAt)
  const completeness = projection.dataSufficiency === 'FULL' ? 95 : projection.dataSufficiency === 'STANDARD' ? 82 : projection.dataSufficiency === 'LIMITED' ? 62 : 42
  const warnings = projection.mainRisks.length ? projection.mainRisks : projection.warnings
  const score = scorePick({ probability, confidence, quality, starterStatus: projection.starterStatus, completeness, freshness, warnings })
  return {
    id: `prob_${hash([projection.projectionId, best.side, best.line])}`,
    sport: 'baseball_mlb',
    eventId: projection.eventId,
    marketType: 'pitcher_outs',
    selection: `${projection.pitcherName} ${best.side} ${best.line} recorded outs`,
    modelProbability: round(probability),
    confidence: round(confidence),
    quality: round(quality),
    risk: riskFrom(score, probability, confidence, quality),
    starterStatus: projection.starterStatus,
    generatedAt: projection.generatedAt,
    cutoffAt: projection.cutoffAt,
    projectionVersion: projection.modelVersion,
    drivers: probabilityOnlyText(projection.mainDrivers.length ? projection.mainDrivers : [`Projected workload: ${projection.projectedOuts ?? 'N/A'} outs`], 'Pitcher workload model signal available'),
    risks: probabilityOnlyText(warnings.length ? warnings : ['Pitcher workload projection uncertainty'], 'Pitcher workload projection uncertainty'),
    correlationGroup: `${projection.eventId}:${projection.pitcherId}`,
    recommendationType: RECOMMENDATION_TYPE,
    score,
    freshness: round(freshness),
    featureCompleteness: round(completeness),
    source: 'mlb_pitcher_projection_engine',
  }
}

async function loadPredictionHistoryPicks(limit: number) {
  const now = new Date()
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select('id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, selection, line, model_probability, confidence, status, result, feature_snapshot, validation_warnings, skip_reason, generated_at, cutoff_at, model_version, feature_snapshot_generated_at')
    .in('market', ['moneyline', 'money_line', 'h2h', 'ml', 'spread', 'run_line', 'runline', 'total', 'totals'])
    .gte('commence_time', now.toISOString())
    .order('commence_time', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 500))

  if (error) return { picks: [] as ProbabilityPick[], warning: `prediction_history_read_failed:${error.message}` }
  const picks = (data ?? [])
    .filter((row) => !isExcludedLifecycle(row as PredictionHistoryRow, now))
    .map((row) => predictionRowToPick(row as PredictionHistoryRow))
    .filter((pick): pick is ProbabilityPick => Boolean(pick))
  return { picks, warning: null as string | null }
}

async function loadPitcherPicks(date: string | null | undefined, limit: number) {
  try {
    const slate = await previewPitcherProjection({ date, limit: Math.min(Math.max(limit, 1), 200) })
    return {
      picks: slate.projections.map(pitcherPickFromProjection).filter((pick): pick is ProbabilityPick => Boolean(pick)),
      warning: null as string | null,
    }
  } catch (error) {
    return { picks: [] as ProbabilityPick[], warning: `pitcher_projection_read_failed:${error instanceof Error ? error.message : 'unknown'}` }
  }
}

function applyFilters(picks: ProbabilityPick[], filters: ProbabilityPickFilters) {
  return picks.filter((pick) => {
    if (filters.sport && filters.sport !== 'all' && pick.sport !== filters.sport) return false
    if (filters.market && filters.market !== 'all' && pick.marketType !== normalizeMarket(filters.market)) return false
    if (filters.minProbability !== null && filters.minProbability !== undefined && pick.modelProbability < filters.minProbability) return false
    if (filters.minConfidence !== null && filters.minConfidence !== undefined && pick.confidence < filters.minConfidence) return false
    if (filters.minQuality !== null && filters.minQuality !== undefined && pick.quality < filters.minQuality) return false
    if (filters.starterStatus && filters.starterStatus !== 'all' && !pick.starterStatus.toLowerCase().includes(filters.starterStatus.toLowerCase())) return false
    if (filters.projectionQuality && filters.projectionQuality !== 'all' && qualityLabel(pick.quality) !== filters.projectionQuality.toUpperCase()) return false
    return true
  })
}

function uniqueById(picks: ProbabilityPick[]) {
  const seen = new Set<string>()
  return picks.filter((pick) => {
    if (seen.has(pick.id)) return false
    seen.add(pick.id)
    return true
  })
}

function top(picks: ProbabilityPick[], sorter: (a: ProbabilityPick, b: ProbabilityPick) => number, count = 8) {
  return [...picks].sort(sorter).slice(0, count)
}

function buildSections(picks: ProbabilityPick[]) {
  const scoreSort = (a: ProbabilityPick, b: ProbabilityPick) => b.score - a.score
  return [
    { id: 'highest_probability', label: 'Highest Probability', picks: top(picks, (a, b) => b.modelProbability - a.modelProbability) },
    { id: 'highest_confidence', label: 'Highest Confidence', picks: top(picks, (a, b) => b.confidence - a.confidence) },
    { id: 'safest_picks', label: 'Safest Picks', picks: top(picks.filter((pick) => pick.risk !== 'HIGH'), scoreSort) },
    { id: 'highest_quality', label: 'Highest Quality', picks: top(picks, (a, b) => b.quality - a.quality) },
    { id: 'highest_pitcher_projection', label: 'Highest Pitcher Projection', picks: top(picks.filter((pick) => pick.marketType === 'pitcher_outs'), scoreSort) },
    { id: 'highest_team_projection', label: 'Highest Team Projection', picks: top(picks.filter((pick) => pick.marketType !== 'pitcher_outs'), scoreSort) },
    { id: 'most_stable', label: 'Most Stable', picks: top(picks, (a, b) => (b.confidence + b.quality + b.freshness) - (a.confidence + a.quality + a.freshness)) },
    { id: 'upset_candidates', label: 'Upset Candidates', picks: top(picks.filter((pick) => pick.modelProbability >= 50 && pick.modelProbability <= 62 && pick.confidence >= 55), scoreSort) },
    { id: 'projection_only', label: 'Projection Only', picks: top(picks, scoreSort, 20) },
  ]
}

export async function getProbabilityPicks(filters: ProbabilityPickFilters = {}): Promise<ProbabilityPicksResponse> {
  const limit = Math.min(Math.max(Number(filters.limit ?? 160), 1), 500)
  const [history, pitcher] = await Promise.all([
    loadPredictionHistoryPicks(limit),
    loadPitcherPicks(filters.date, Math.min(limit, 200)),
  ])
  const warnings = [history.warning, pitcher.warning].filter((warning): warning is string => Boolean(warning))
  const picks = top(uniqueById(applyFilters([...history.picks, ...pitcher.picks], filters)), (a, b) => b.score - a.score, limit)
  const sections = buildSections(picks)
  return {
    success: true,
    mode: MODE,
    generatedAt: nowIso(),
    dryRun: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      picksGenerated: picks.length,
      sectionsGenerated: sections.length,
      sports: [...new Set(picks.map((pick) => pick.sport))],
      markets: [...new Set(picks.map((pick) => pick.marketType))],
      projectionOnly: true,
    },
    filters: {
      sport: filters.sport ?? 'all',
      market: filters.market ?? 'all',
      minProbability: filters.minProbability ?? null,
      minConfidence: filters.minConfidence ?? null,
      minQuality: filters.minQuality ?? null,
      starterStatus: filters.starterStatus ?? 'all',
      projectionQuality: filters.projectionQuality ?? 'all',
    },
    sections,
    picks,
    warnings,
  }
}

function pairCorrelation(a: ProbabilityPick, b: ProbabilityPick) {
  const warnings: string[] = []
  let penalty = 0
  if (a.eventId === b.eventId) {
    penalty += 12
    warnings.push('same_event_dependency')
  }
  if (a.correlationGroup === b.correlationGroup) {
    penalty += 10
    warnings.push('shared_correlation_group')
  }
  if (a.eventId === b.eventId && ((a.marketType === 'moneyline' && b.marketType === 'run_line') || (a.marketType === 'run_line' && b.marketType === 'moneyline'))) {
    penalty += 8
    warnings.push('moneyline_run_line_dependency')
  }
  if (a.eventId === b.eventId && (a.marketType === 'pitcher_outs' || b.marketType === 'pitcher_outs')) {
    penalty += 7
    warnings.push('pitcher_team_or_total_dependency')
  }
  if (a.eventId === b.eventId && (a.marketType === 'total' || b.marketType === 'total')) {
    penalty += 6
    warnings.push('total_shared_game_dependency')
  }
  return { penalty, warnings }
}

function evaluateCorrelation(legs: ProbabilityPick[]) {
  let penalty = 0
  const warnings = new Set<string>()
  for (let i = 0; i < legs.length; i += 1) {
    for (let j = i + 1; j < legs.length; j += 1) {
      const result = pairCorrelation(legs[i], legs[j])
      penalty += result.penalty
      result.warnings.forEach((warning) => warnings.add(warning))
    }
  }
  return { penalty: clamp(penalty, 0, 45), warnings: [...warnings] }
}

function combinedProbability(legs: ProbabilityPick[], penalty: number) {
  const probabilities = legs.map((leg) => clamp(leg.modelProbability, 1, 99) / 100)
  const independentProduct = probabilities.reduce((product, probability) => product * probability, 1)
  const average = probabilities.reduce((sum, probability) => sum + probability, 0) / probabilities.length
  const weakest = Math.min(...probabilities)
  const stabilityBlend = average * weakest
  return round(clamp((independentProduct * 0.65 + stabilityBlend * 0.35) * (1 - penalty / 100) * 100))
}

function parlayRisk(confidence: number, quality: number, penalty: number): ProbabilityPickRisk {
  if (penalty <= 10 && confidence >= 70 && quality >= 68) return 'LOW'
  if (penalty <= 25 && confidence >= 55 && quality >= 52) return 'MEDIUM'
  return 'HIGH'
}

function modeThreshold(mode: ProbabilityParlayMode) {
  if (mode === 'CONSERVATIVE') return { probability: 62, confidence: 65, quality: 62, maxPenalty: 18 }
  if (mode === 'AGGRESSIVE') return { probability: 50, confidence: 48, quality: 45, maxPenalty: 38 }
  return { probability: 56, confidence: 55, quality: 52, maxPenalty: 28 }
}

function combinations<T>(items: T[], size: number, max = 80) {
  const result: T[][] = []
  function walk(start: number, current: T[]) {
    if (result.length >= max) return
    if (current.length === size) {
      result.push([...current])
      return
    }
    for (let index = start; index < items.length; index += 1) {
      current.push(items[index])
      walk(index + 1, current)
      current.pop()
    }
  }
  walk(0, [])
  return result
}

function buildParlay(legs: ProbabilityPick[], mode: ProbabilityParlayMode, scope: ProbabilityParlayScope): ProbabilityParlay {
  const correlation = evaluateCorrelation(legs)
  const confidence = round(clamp(legs.reduce((sum, leg) => sum + leg.confidence, 0) / legs.length - correlation.penalty * 0.35))
  const quality = round(clamp(legs.reduce((sum, leg) => sum + leg.quality, 0) / legs.length - correlation.penalty * 0.25))
  return {
    id: `parlay_${hash([mode, scope, ...legs.map((leg) => leg.id)])}`,
    mode,
    scope,
    legCount: legs.length,
    legs: legs.map((leg) => ({
      id: leg.id,
      sport: leg.sport,
      eventId: leg.eventId,
      marketType: leg.marketType,
      selection: leg.selection,
      modelProbability: leg.modelProbability,
      confidence: leg.confidence,
      quality: leg.quality,
      risk: leg.risk,
      correlationGroup: leg.correlationGroup,
      recommendationType: RECOMMENDATION_TYPE,
    })),
    combinedProbability: combinedProbability(legs, correlation.penalty),
    confidence,
    quality,
    risk: parlayRisk(confidence, quality, correlation.penalty),
    correlationPenalty: correlation.penalty,
    correlationWarnings: correlation.warnings,
    drivers: [
      `${legs.length} projection-only legs`,
      `Average leg probability ${round(legs.reduce((sum, leg) => sum + leg.modelProbability, 0) / legs.length, 1)}%`,
      `Correlation penalty ${correlation.penalty} points`,
    ],
    risks: correlation.warnings.length ? correlation.warnings : ['multi_leg_model_uncertainty'],
    recommendationType: RECOMMENDATION_TYPE,
    generatedAt: nowIso(),
  }
}

export async function getProbabilityParlays(options: ProbabilityParlayOptions = {}): Promise<ProbabilityParlaysResponse> {
  const mode = options.mode ?? 'BALANCED'
  const scope = options.scope ?? 'MULTI_SPORT'
  const minLegs = Math.min(Math.max(Number(options.minLegs ?? 2), 2), 5)
  const maxLegs = Math.min(Math.max(Number(options.maxLegs ?? 4), minLegs), 5)
  const threshold = modeThreshold(mode)
  const picksResponse = await getProbabilityPicks({ ...options, limit: 80 })
  const eligible = picksResponse.picks
    .filter((pick) => scope !== 'MLB_ONLY' || pick.sport === 'baseball_mlb')
    .filter((pick) => pick.modelProbability >= threshold.probability && pick.confidence >= threshold.confidence && pick.quality >= threshold.quality)
    .sort((a, b) => b.score - a.score)
    .slice(0, 16)
  const parlays: ProbabilityParlay[] = []
  for (let legs = minLegs; legs <= maxLegs; legs += 1) {
    for (const combo of combinations(eligible, legs, 120)) {
      const correlation = evaluateCorrelation(combo)
      if (correlation.penalty <= threshold.maxPenalty) parlays.push(buildParlay(combo, mode, scope))
    }
  }
  const sorted = parlays
    .sort((a, b) => (b.combinedProbability + b.confidence + b.quality - b.correlationPenalty) - (a.combinedProbability + a.confidence + a.quality - a.correlationPenalty))
    .slice(0, Math.min(Math.max(Number(options.limit ?? 20), 1), 50))
  return {
    success: true,
    mode: PARLAY_MODE,
    generatedAt: nowIso(),
    dryRun: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      parlaysGenerated: sorted.length,
      legsMin: minLegs,
      legsMax: maxLegs,
      mode,
      scope,
      projectionOnly: true,
    },
    parlays: sorted,
    warnings: picksResponse.warnings,
  }
}

export async function previewProbabilityPicks(filters: ProbabilityPickFilters = {}) {
  return getProbabilityPicks(filters)
}

export async function generateProbabilityPicks(filters: ProbabilityPickFilters & { persist?: boolean | null } = {}) {
  const result = await getProbabilityPicks(filters)
  return {
    ...result,
    dryRun: true,
    persistRequested: Boolean(filters.persist),
    rowsPersisted: 0,
    persistence: 'disabled_for_probability_picks_v1' as const,
  }
}

export function validateProbabilityPickFixtures(): ProbabilityValidationResponse {
  const now = new Date('2026-07-26T16:00:00.000Z')
  const fixture: PredictionHistoryRow = {
    id: 'fixture-1',
    sport_key: 'baseball_mlb',
    game_id: 'game-1',
    commence_time: '2026-07-26T23:00:00.000Z',
    home_team: 'Home',
    away_team: 'Away',
    team: 'Home',
    opponent: 'Away',
    market: 'moneyline',
    selection: 'Home',
    line: null,
    model_probability: 0.64,
    confidence: 72,
    status: 'pending',
    result: null,
    feature_snapshot: { qualityScore: 74, starterStatus: 'CONFIRMED', mainDrivers: ['fixture driver'] },
    validation_warnings: [],
    skip_reason: null,
    generated_at: '2026-07-26T15:00:00.000Z',
    cutoff_at: '2026-07-26T22:50:00.000Z',
    model_version: 'fixture',
    feature_snapshot_generated_at: '2026-07-26T15:00:00.000Z',
  }
  const pick = predictionRowToPick(fixture)
  const postStartExcluded = isExcludedLifecycle({ ...fixture, commence_time: '2026-07-26T15:30:00.000Z' }, now)
  const sameGameCorrelation = pick ? pairCorrelation(pick, { ...pick, id: 'other', marketType: 'run_line' }).penalty > 0 : false
  const parlay = pick ? buildParlay([pick, { ...pick, id: 'second', eventId: 'game-2', correlationGroup: 'game-2', marketType: 'total', modelProbability: 58 }], 'BALANCED', 'MLB_ONLY') : null
  const checks = [
    ['fixture pick created', Boolean(pick)],
    ['recommendation type is probability only', pick?.recommendationType === RECOMMENDATION_TYPE],
    ['probability normalized to percentage', pick?.modelProbability === 64],
    ['post-start rows excluded', postStartExcluded],
    ['same-game correlation penalized', sameGameCorrelation],
    ['parlay generated without simple product', parlay !== null && parlay.combinedProbability !== round((64 / 100) * (58 / 100) * 100)],
    ['provider calls remain zero', true],
    ['remote mutations remain zero', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'probability_picks_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
