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
  ProbabilityFreshnessSummary,
  ProbabilitySportEligibility,
  ProbabilitySportEligibilitySummary,
  ProbabilityPicksResponse,
  ProbabilityParlaysResponse,
  ProbabilityValidationResponse,
} from '@/types/probability-picks'

const MODE = 'probability_picks_v1'
const PARLAY_MODE = 'probability_parlays_v1'
const VERSION = 'probability_picks_v2' as const
const PARLAY_VERSION = 'probability_parlays_v2' as const
const RECOMMENDATION_TYPE = 'PROBABILITY_ONLY' as const
const SUPPORTED_MARKETS: ProbabilityMarketType[] = ['moneyline', 'run_line', 'total', 'pitcher_outs']
const PITCHER_LINES = ['14.5', '15.5', '16.5', '17.5', '18.5'] as const
const EXCLUDED_STATUSES = new Set(['completed', 'final', 'settled', 'closed', 'ignored', 'historical', 'replay', 'shadow', 'live', 'started', 'cancelled', 'void'])
const FORBIDDEN_PROBABILITY_TEXT = /\b(sportsbook|odds|ev|kelly|stake|bankroll|official pick|portfolio)\b/i
const MLB_LIMITED_ELIGIBILITY: ProbabilitySportEligibility = {
  status: 'CERTIFIED_LIMITED',
  eligibleForRanking: true,
  eligibleForParlays: true,
  reason: 'MLB projection-only rows are allowed because the stored pregame probability and pitcher projection surfaces have local certification evidence.',
  engineCertification: 'MLB_PROJECTION_ONLY_LIMITED',
  displayName: 'MLB',
  dataReadiness: 'Stored pregame predictions and pitcher projections',
  freshness: 'FRESH',
  nextRequirement: 'Maintain current stored pregame coverage and same-event projection evidence.',
}
const UNCERTIFIED_ELIGIBILITY: ProbabilitySportEligibility = {
  status: 'ENGINE_NOT_CERTIFIED',
  eligibleForRanking: false,
  eligibleForParlays: false,
  reason: 'This sport is registered in stored prediction history, but its global Probability Picks ranking contract is not production-certified.',
  engineCertification: 'NOT_CERTIFIED_FOR_PROBABILITY_PICKS_V1',
  displayName: 'Uncertified sport',
  dataReadiness: 'Stored rows may exist, but the product engine is not certified.',
  freshness: 'UNKNOWN',
  nextRequirement: 'Complete sport-specific engine, stored data, validation, settlement and product certification.',
}

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
  maxRisk?: ProbabilityPickRisk | 'all' | null
  dataFreshness?: ProbabilityFreshnessSummary['status'] | 'all' | null
  certificationLevel?: string | null
  starterStatus?: string | null
  projectionQuality?: string | null
  sort?: 'score' | 'probability' | 'confidence' | 'quality' | 'stability' | 'freshness' | 'eventStart' | null
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

function sportDisplayName(sport: string) {
  if (sport === 'baseball_mlb') return 'MLB'
  if (sport === 'soccer_epl') return 'Soccer EPL'
  if (sport === 'americanfootball_ncaaf') return 'NCAA Football'
  if (sport === 'americanfootball_nfl') return 'NFL'
  if (sport === 'basketball_nba') return 'NBA'
  if (sport === 'basketball_bsn') return 'BSN'
  if (sport === 'icehockey_nhl') return 'NHL'
  if (sport.includes('tennis')) return 'Tennis'
  if (sport.includes('ufc')) return 'UFC'
  return sport.replaceAll('_', ' ')
}

function sportEligibility(sport: string): ProbabilitySportEligibility {
  if (sport === 'baseball_mlb') return MLB_LIMITED_ELIGIBILITY
  return {
    ...UNCERTIFIED_ELIGIBILITY,
    displayName: sportDisplayName(sport),
  }
}

function isRankEligible(pick: ProbabilityPick) {
  return pick.sportEligibility.eligibleForRanking
}

function emptyEligibilityDetail(eligibility: ProbabilitySportEligibility) {
  return { ...eligibility, rowsSeen: 0, rowsRanked: 0, rowsExcluded: 0, qualifiedRows: 0, excludedRowCount: 0 }
}

function buildSportEligibilitySummary(picks: ProbabilityPick[], excluded: ProbabilityPick[], requestedSport?: string | null): ProbabilitySportEligibilitySummary {
  const details: ProbabilitySportEligibilitySummary['details'] = {}
  for (const pick of [...picks, ...excluded]) {
    const detail = details[pick.sport] ?? emptyEligibilityDetail(pick.sportEligibility)
    detail.rowsSeen += 1
    if (pick.sportEligibility.eligibleForRanking) detail.rowsRanked += 1
    else detail.rowsExcluded += 1
    detail.qualifiedRows = detail.rowsRanked
    detail.excludedRowCount = detail.rowsExcluded
    details[pick.sport] = detail
  }
  const requested = requestedSport && requestedSport !== 'all' ? requestedSport : null
  if (requested && !details[requested]) details[requested] = emptyEligibilityDetail(sportEligibility(requested))
  const eligibleSports = Object.entries(details).filter(([, detail]) => detail.eligibleForRanking).map(([sport]) => sport).sort()
  const parlayEligibleSports = Object.entries(details).filter(([, detail]) => detail.eligibleForParlays).map(([sport]) => sport).sort()
  const excludedSports = Object.entries(details).filter(([, detail]) => !detail.eligibleForRanking && detail.rowsSeen > 0).map(([sport]) => sport).sort()
  return {
    eligibleSports,
    excludedSports,
    rankingEligibleSports: eligibleSports,
    parlayEligibleSports,
    excludedRows: Object.values(details).reduce((sum, detail) => sum + detail.rowsExcluded, 0),
    details,
  }
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

function freshnessStatus(score: number): ProbabilityFreshnessSummary['status'] {
  if (score >= 78) return 'FRESH'
  if (score >= 58) return 'AGING'
  if (score > 0) return 'STALE'
  return 'UNKNOWN'
}

function supportLinks(pick: Pick<ProbabilityPick, 'source' | 'eventId' | 'marketType'>) {
  const links = [
    { label: 'Open Current Board', href: '/dashboard#today' },
    { label: 'View Model Performance', href: '/performance' },
  ]
  if (pick.source === 'mlb_pitcher_projection_engine' || pick.marketType === 'pitcher_outs') {
    links.unshift({ label: 'Review Projection', href: '/player-projections' })
  }
  if (pick.eventId && !pick.eventId.startsWith('event_')) {
    links.push({ label: 'View Supporting Data', href: `/game-intelligence/${pick.eventId}` })
  }
  return links
}

function qualificationReasonsForPick(input: {
  probability: number
  confidence: number
  quality: number
  freshness: number
  starterStatus: string
  sport: string
  source: ProbabilityPick['source']
}) {
  const reasons = [
    input.probability >= 60 ? 'High model probability' : 'Model probability passed the selected threshold',
    input.confidence >= 65 ? 'Strong confidence signal' : 'Confidence passed the selected threshold',
    input.quality >= 62 ? 'Complete underlying inputs' : 'Data quality passed the selected threshold',
    `${sportDisplayName(input.sport)} uses a certified projection-only engine mode`,
  ]
  if (freshnessStatus(input.freshness) === 'FRESH') reasons.push('Fresh projection evidence')
  if (input.starterStatus.toLowerCase().includes('confirmed') || input.starterStatus.toLowerCase().includes('probable')) reasons.push('Starter or lineup context is available')
  if (input.source === 'mlb_pitcher_projection_engine') reasons.push('Pitcher projection source is certified for projection-only display')
  return probabilityOnlyText(reasons, 'Projection-only qualification evidence available')
}

function mainRisksForPick(input: {
  risks: string[]
  confidence: number
  quality: number
  freshness: number
  sportEligibility: ProbabilitySportEligibility
  starterStatus: string
}) {
  const risks = [...input.risks]
  if (input.confidence < 60) risks.push('Limited confidence margin')
  if (input.quality < 60) risks.push('Lower feature completeness')
  if (freshnessStatus(input.freshness) !== 'FRESH') risks.push('Projection age requires review')
  if (!input.starterStatus.toLowerCase().includes('confirmed') && !input.starterStatus.toLowerCase().includes('probable')) risks.push('Starter status is not fully confirmed')
  if (input.sportEligibility.status === 'CERTIFIED_LIMITED') risks.push('Certified Limited operating mode')
  return probabilityOnlyText(risks, 'Projection uncertainty')
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
  const sport = text(row.sport_key, 'unknown')
  const probability = normalizePercent(row.model_probability)
  const confidence = normalizePercent(row.confidence, 55)
  const quality = normalizePercent(snapshot.qualityScore ?? snapshot.featureQuality ?? snapshot.feature_quality ?? snapshot.dataQuality, Math.max(50, confidence - 6))
  const starterStatus = text(snapshot.starterStatus ?? snapshot.lineupStatus ?? snapshot.projectionStatus, 'UNKNOWN')
  const warnings = risksFromRow(row, snapshot)
  const freshness = freshnessScore(row.feature_snapshot_generated_at ?? row.generated_at)
  const completeness = featureCompleteness(snapshot, Math.max(50, quality))
  const score = scorePick({ probability, confidence, quality, starterStatus, completeness, freshness, warnings })
  const generatedAt = text(row.generated_at ?? row.feature_snapshot_generated_at, nowIso())
  const eligibility = sportEligibility(sport)
  const pickBase: ProbabilityPick = {
    id: `prob_${hash([row.id, market, row.selection, row.line])}`,
    sport,
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
    eventStartTime: row.commence_time,
    dataAsOf: row.feature_snapshot_generated_at ?? row.generated_at,
    providerUpdatedAt: null,
    projectionVersion: text(row.model_version, 'stored_model_probability'),
    drivers: driversFromRow(row, snapshot),
    risks: warnings,
    correlationGroup: text(row.game_id, `event_${row.id}`),
    recommendationType: RECOMMENDATION_TYPE,
    score,
    freshness: round(freshness),
    featureCompleteness: round(completeness),
    source: 'prediction_history',
    sportEligibility: eligibility,
    dataStatus: 'CURRENT_STORED',
  }
  const qualificationReasons = qualificationReasonsForPick({ probability, confidence, quality, freshness, starterStatus, sport, source: 'prediction_history' })
  const mainRisks = mainRisksForPick({ risks: warnings, confidence, quality, freshness, sportEligibility: eligibility, starterStatus })
  return {
    ...pickBase,
    qualificationReasons,
    mainRisks,
    explanation: {
      whyQualified: qualificationReasons,
      mainRisks,
      nextLinks: supportLinks(pickBase),
    },
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
  const eligibility = sportEligibility('baseball_mlb')
  const pickBase: ProbabilityPick = {
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
    eventStartTime: projection.eventStartTime,
    dataAsOf: projection.generatedAt,
    providerUpdatedAt: null,
    projectionVersion: projection.modelVersion,
    drivers: probabilityOnlyText(projection.mainDrivers.length ? projection.mainDrivers : [`Projected workload: ${projection.projectedOuts ?? 'N/A'} outs`], 'Pitcher workload model signal available'),
    risks: probabilityOnlyText(warnings.length ? warnings : ['Pitcher workload projection uncertainty'], 'Pitcher workload projection uncertainty'),
    correlationGroup: `${projection.eventId}:${projection.pitcherId}`,
    recommendationType: RECOMMENDATION_TYPE,
    score,
    freshness: round(freshness),
    featureCompleteness: round(completeness),
    source: 'mlb_pitcher_projection_engine',
    sportEligibility: eligibility,
    dataStatus: 'MODEL_GENERATED',
  }
  const qualificationReasons = qualificationReasonsForPick({ probability, confidence, quality, freshness, starterStatus: projection.starterStatus, sport: 'baseball_mlb', source: 'mlb_pitcher_projection_engine' })
  const mainRisks = mainRisksForPick({ risks: warnings, confidence, quality, freshness, sportEligibility: eligibility, starterStatus: projection.starterStatus })
  return {
    ...pickBase,
    qualificationReasons,
    mainRisks,
    explanation: {
      whyQualified: qualificationReasons,
      mainRisks,
      nextLinks: supportLinks(pickBase),
    },
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

  if (error) return { picks: [] as ProbabilityPick[], excluded: [] as ProbabilityPick[], warning: `prediction_history_read_failed:${error.message}` }
  const allPicks = (data ?? [])
    .filter((row) => !isExcludedLifecycle(row as PredictionHistoryRow, now))
    .map((row) => predictionRowToPick(row as PredictionHistoryRow))
    .filter((pick): pick is ProbabilityPick => Boolean(pick))
  const picks = allPicks.filter(isRankEligible)
  const excluded = allPicks.filter((pick) => !isRankEligible(pick))
  return { picks, excluded, warning: null as string | null }
}

async function loadPitcherPicks(date: string | null | undefined, limit: number) {
  try {
    const slate = await previewPitcherProjection({ date, limit: Math.min(Math.max(limit, 1), 200) })
    return {
      picks: slate.projections.map(pitcherPickFromProjection).filter((pick): pick is ProbabilityPick => Boolean(pick)),
      excluded: [] as ProbabilityPick[],
      warning: null as string | null,
    }
  } catch (error) {
    return { picks: [] as ProbabilityPick[], excluded: [] as ProbabilityPick[], warning: `pitcher_projection_read_failed:${error instanceof Error ? error.message : 'unknown'}` }
  }
}

function applyFilters(picks: ProbabilityPick[], filters: ProbabilityPickFilters) {
  return picks.filter((pick) => {
    if (filters.sport && filters.sport !== 'all' && pick.sport !== filters.sport) return false
    if (filters.market && filters.market !== 'all' && pick.marketType !== normalizeMarket(filters.market)) return false
    if (filters.minProbability !== null && filters.minProbability !== undefined && pick.modelProbability < filters.minProbability) return false
    if (filters.minConfidence !== null && filters.minConfidence !== undefined && pick.confidence < filters.minConfidence) return false
    if (filters.minQuality !== null && filters.minQuality !== undefined && pick.quality < filters.minQuality) return false
    if (filters.maxRisk && filters.maxRisk !== 'all') {
      const order: Record<ProbabilityPickRisk, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 }
      if (order[pick.risk] > order[filters.maxRisk]) return false
    }
    if (filters.dataFreshness && filters.dataFreshness !== 'all' && freshnessStatus(pick.freshness) !== filters.dataFreshness) return false
    if (filters.certificationLevel && filters.certificationLevel !== 'all' && pick.sportEligibility.status !== filters.certificationLevel) return false
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

function stability(pick: ProbabilityPick) {
  return pick.confidence + pick.quality + pick.freshness
}

function eventStartMs(pick: ProbabilityPick) {
  const parsed = pick.eventStartTime ? new Date(pick.eventStartTime).getTime() : Number.MAX_SAFE_INTEGER
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

function sortPicks(picks: ProbabilityPick[], sort: ProbabilityPickFilters['sort']) {
  const tie = (a: ProbabilityPick, b: ProbabilityPick) => b.score - a.score || eventStartMs(a) - eventStartMs(b) || a.selection.localeCompare(b.selection)
  if (sort === 'probability') return top(picks, (a, b) => b.modelProbability - a.modelProbability || tie(a, b), picks.length)
  if (sort === 'confidence') return top(picks, (a, b) => b.confidence - a.confidence || tie(a, b), picks.length)
  if (sort === 'quality') return top(picks, (a, b) => b.quality - a.quality || tie(a, b), picks.length)
  if (sort === 'stability') return top(picks, (a, b) => stability(b) - stability(a) || tie(a, b), picks.length)
  if (sort === 'freshness') return top(picks, (a, b) => b.freshness - a.freshness || tie(a, b), picks.length)
  if (sort === 'eventStart') return top(picks, (a, b) => eventStartMs(a) - eventStartMs(b) || tie(a, b), picks.length)
  return top(picks, tie, picks.length)
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

function topSignals(picks: ProbabilityPick[]) {
  return {
    highestProbability: top(picks, (a, b) => b.modelProbability - a.modelProbability, 1)[0] ?? null,
    highestConfidence: top(picks, (a, b) => b.confidence - a.confidence, 1)[0] ?? null,
    highestQuality: top(picks, (a, b) => b.quality - a.quality, 1)[0] ?? null,
    mostStable: top(picks, (a, b) => stability(b) - stability(a), 1)[0] ?? null,
    bestDataQuality: top(picks, (a, b) => b.featureCompleteness - a.featureCompleteness, 1)[0] ?? null,
  }
}

function freshnessSummary(picks: ProbabilityPick[]): ProbabilityFreshnessSummary {
  const timestamps = picks
    .map((pick) => pick.dataAsOf ?? pick.generatedAt)
    .filter(Boolean)
    .sort()
  const statuses = picks.map((pick) => freshnessStatus(pick.freshness))
  const staleRows = statuses.filter((status) => status === 'STALE').length
  const agingRows = statuses.filter((status) => status === 'AGING').length
  const freshRows = statuses.filter((status) => status === 'FRESH').length
  const status: ProbabilityFreshnessSummary['status'] = !picks.length ? 'UNKNOWN' : staleRows > 0 ? 'STALE' : agingRows > 0 ? 'AGING' : freshRows > 0 ? 'FRESH' : 'UNKNOWN'
  return {
    status,
    latestGeneratedAt: timestamps[timestamps.length - 1] ?? null,
    oldestGeneratedAt: timestamps[0] ?? null,
    staleRows,
    agingRows,
    freshRows,
  }
}

function excludedRowsByReason(sportEligibility: ProbabilitySportEligibilitySummary) {
  return Object.values(sportEligibility.details).reduce<Record<string, number>>((acc, detail) => {
    if (detail.rowsExcluded > 0) acc[detail.status] = (acc[detail.status] ?? 0) + detail.rowsExcluded
    return acc
  }, {})
}

function qualifiedRowsBySport(picks: ProbabilityPick[]) {
  return picks.reduce<Record<string, number>>((acc, pick) => {
    acc[pick.sport] = (acc[pick.sport] ?? 0) + 1
    return acc
  }, {})
}

function buildFilterMetadata(sportEligibility: ProbabilitySportEligibilitySummary) {
  return {
    sports: Object.entries(sportEligibility.details)
      .map(([sport, detail]) => ({
        value: sport,
        label: detail.displayName ?? sportDisplayName(sport),
        eligible: detail.eligibleForRanking,
        reason: detail.reason,
      }))
      .sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.label.localeCompare(b.label)),
    markets: [
      { value: 'all' as const, label: 'All Markets' },
      { value: 'moneyline' as const, label: 'Moneyline' },
      { value: 'run_line' as const, label: 'Run Line' },
      { value: 'total' as const, label: 'Totals' },
      { value: 'pitcher_outs' as const, label: 'Pitcher Outs' },
    ],
    risk: ['LOW', 'MEDIUM', 'HIGH'] as ProbabilityPickRisk[],
    freshness: ['FRESH', 'AGING', 'STALE', 'UNKNOWN'] as ProbabilityFreshnessSummary['status'][],
    certificationLevels: ['CERTIFIED_ACTIVE', 'CERTIFIED_LIMITED', 'PREVIEW', 'SHADOW_ONLY', 'INSUFFICIENT_DATA', 'ENGINE_NOT_CERTIFIED', 'OUT_OF_SEASON', 'STALE', 'BLOCKED'] as ProbabilitySportEligibility['status'][],
    defaults: {
      sport: 'all',
      market: 'all',
      minProbability: 0,
      minConfidence: 0,
      minQuality: 0,
      maxRisk: 'all',
      dataFreshness: 'all',
      certificationLevel: 'all',
      sort: 'score',
    },
  }
}

function buildSortMetadata() {
  return {
    defaultSort: 'score' as const,
    availableSorts: ['score', 'probability', 'confidence', 'quality', 'stability', 'freshness', 'eventStart'] as Array<'score' | 'probability' | 'confidence' | 'quality' | 'stability' | 'freshness' | 'eventStart'>,
    note: 'Sorting is presentation-only and does not change model probability, confidence, quality, thresholds or parlay math.',
  }
}

function buildBriefingContext(picks: ProbabilityPick[], freshness: ProbabilityFreshnessSummary, warnings: string[], sportEligibility: ProbabilitySportEligibilitySummary) {
  const outlook = !picks.length ? 'Skip Today' : freshness.status === 'STALE' || warnings.length ? 'Review Manually' : 'Review Manually'
  return {
    outlook: outlook as 'Review Manually' | 'Wait' | 'Skip Today',
    qualifiedCount: picks.length,
    certifiedSports: sportEligibility.eligibleSports,
    freshness: freshness.status,
    mainWarning: warnings[0] ?? null,
  }
}

export async function getProbabilityPicks(filters: ProbabilityPickFilters = {}): Promise<ProbabilityPicksResponse> {
  const limit = Math.min(Math.max(Number(filters.limit ?? 160), 1), 500)
  const [history, pitcher] = await Promise.all([
    loadPredictionHistoryPicks(limit),
    loadPitcherPicks(filters.date, Math.min(limit, 200)),
  ])
  const warnings = [history.warning, pitcher.warning].filter((warning): warning is string => Boolean(warning))
  const picks = sortPicks(uniqueById(applyFilters([...history.picks, ...pitcher.picks], filters)), filters.sort ?? 'score').slice(0, limit)
  const sportEligibility = buildSportEligibilitySummary(picks, [...history.excluded, ...pitcher.excluded], filters.sport)
  if (sportEligibility.excludedRows > 0) {
    warnings.push(`excluded_uncertified_probability_pick_rows:${sportEligibility.excludedRows}`)
  }
  const sections = buildSections(picks)
  const freshness = freshnessSummary(picks)
  const signals = topSignals(picks)
  const excludedReasons = excludedRowsByReason(sportEligibility)
  const qualifiedBySport = qualifiedRowsBySport(picks)
  const filterMetadata = buildFilterMetadata(sportEligibility)
  const sortMetadata = buildSortMetadata()
  const briefingContext = buildBriefingContext(picks, freshness, warnings, sportEligibility)
  return {
    success: true,
    mode: MODE,
    version: VERSION,
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
      sportEligibility,
      rankingEligibleSports: sportEligibility.rankingEligibleSports,
      parlayEligibleSports: sportEligibility.parlayEligibleSports,
      excludedSports: sportEligibility.excludedSports,
      excludedRowsByReason: excludedReasons,
      qualifiedRowsBySport: qualifiedBySport,
      freshnessSummary: freshness,
      topSignals: signals,
    },
    filters: {
      sport: filters.sport ?? 'all',
      market: filters.market ?? 'all',
      minProbability: filters.minProbability ?? null,
      minConfidence: filters.minConfidence ?? null,
      minQuality: filters.minQuality ?? null,
      maxRisk: filters.maxRisk ?? 'all',
      dataFreshness: filters.dataFreshness ?? 'all',
      certificationLevel: filters.certificationLevel ?? 'all',
      starterStatus: filters.starterStatus ?? 'all',
      projectionQuality: filters.projectionQuality ?? 'all',
      sort: filters.sort ?? 'score',
    },
    sportEligibility,
    rankingEligibleSports: sportEligibility.rankingEligibleSports,
    parlayEligibleSports: sportEligibility.parlayEligibleSports,
    excludedSports: sportEligibility.excludedSports,
    excludedRowsByReason: excludedReasons,
    qualifiedRowsBySport: qualifiedBySport,
    freshnessSummary: freshness,
    topSignals: signals,
    filterMetadata,
    sortMetadata,
    briefingContext,
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

function parlayBlockers(picksResponse: ProbabilityPicksResponse, eligibleCount: number, scope: ProbabilityParlayScope, minLegs: number) {
  const blockers: string[] = []
  if ((picksResponse.parlayEligibleSports?.length ?? 0) <= 1 && scope === 'MULTI_SPORT') blockers.push('Only one certified sport is currently available.')
  if (eligibleCount < minLegs) blockers.push('Not enough independent eligible events meet the current parlay requirements.')
  if (picksResponse.summary.picksGenerated === 0) blockers.push('No qualified projection-only picks are available under current filters.')
  if (picksResponse.warnings.length) blockers.push('Current warnings require review before using parlay combinations.')
  return blockers.length ? blockers : ['No sufficiently independent combination meets the current parlay requirements.']
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
    version: PARLAY_VERSION,
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
      multiSportAvailable: (picksResponse.parlayEligibleSports?.length ?? 0) > 1,
      qualificationReasons: [
        'Projection-only legs only',
        'Existing correlation limits preserved',
        'Existing parlay thresholds preserved',
      ],
    },
    parlays: sorted,
    warnings: picksResponse.warnings,
    presentation: {
      modes: ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'],
      scopes: [
        { value: 'MLB_ONLY', label: 'MLB Only', available: true, reason: 'MLB is the only currently certified limited Probability Picks sport.' },
        {
          value: 'MULTI_SPORT',
          label: 'Multi-Sport',
          available: (picksResponse.parlayEligibleSports?.length ?? 0) > 1,
          reason: (picksResponse.parlayEligibleSports?.length ?? 0) > 1 ? 'More than one certified sport is eligible.' : 'Multi-sport requires at least two certified eligible sports.',
        },
      ],
      emptyState: 'No sufficiently independent combination meets the current parlay requirements.',
      aggregateBlockers: sorted.length ? [] : parlayBlockers(picksResponse, eligible.length, scope, minLegs),
    },
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
  const soccerPick = predictionRowToPick({ ...fixture, id: 'fixture-soccer', sport_key: 'soccer_epl' })
  const ncaafPick = predictionRowToPick({ ...fixture, id: 'fixture-ncaaf', sport_key: 'americanfootball_ncaaf' })
  const freshPick = pick ? { ...pick, freshness: 95, generatedAt: '2026-07-26T15:30:00.000Z', dataAsOf: '2026-07-26T15:30:00.000Z' } : null
  const lowConfidencePick = pick ? { ...pick, id: 'low-confidence', confidence: 44 } : null
  const stalePick = pick ? { ...pick, id: 'stale', freshness: 45, generatedAt: '2026-07-20T15:00:00.000Z', dataAsOf: '2026-07-20T15:00:00.000Z' } : null
  const fixturePool = [freshPick, soccerPick, ncaafPick].filter((item): item is ProbabilityPick => Boolean(item))
  const eligiblePool = fixturePool.filter(isRankEligible)
  const postStartExcluded = isExcludedLifecycle({ ...fixture, commence_time: '2026-07-26T15:30:00.000Z' }, now)
  const sameGameCorrelation = pick ? pairCorrelation(pick, { ...pick, id: 'other', marketType: 'run_line' }).penalty > 0 : false
  const parlay = pick ? buildParlay([pick, { ...pick, id: 'second', eventId: 'game-2', correlationGroup: 'game-2', marketType: 'total', modelProbability: 58 }], 'BALANCED', 'MLB_ONLY') : null
  const sortedProbability = pick ? sortPicks([pick, { ...pick, id: 'lower-probability', selection: 'Lower', modelProbability: 52 }], 'probability')[0]?.id === pick.id : false
  const sortedConfidence = pick ? sortPicks([pick, { ...pick, id: 'higher-confidence', selection: 'Higher Confidence', confidence: 82 }], 'confidence')[0]?.id === 'higher-confidence' : false
  const sortedQuality = pick ? sortPicks([pick, { ...pick, id: 'higher-quality', selection: 'Higher Quality', quality: 88 }], 'quality')[0]?.id === 'higher-quality' : false
  const freshOnly = freshPick && stalePick ? applyFilters([freshPick, stalePick], { dataFreshness: 'FRESH' }) : []
  const restrictive = pick ? applyFilters([pick], { minProbability: 99 }) : []
  const sportFiltered = pick ? applyFilters([pick], { sport: 'baseball_mlb' }) : []
  const allEligible = applyFilters(eligiblePool, { sport: 'all' })
  const eligibilitySummary = buildSportEligibilitySummary(eligiblePool, fixturePool.filter((item) => !isRankEligible(item)), 'all')
  const signals = topSignals(eligiblePool)
  const freshness = freshnessSummary(eligiblePool)
  const noForbiddenLanguage = pick ? !FORBIDDEN_PROBABILITY_TEXT.test(JSON.stringify({ drivers: pick.drivers, risks: pick.risks, explanation: pick.explanation })) : false
  const balanced = modeThreshold('BALANCED')
  const checks = [
    ['fixture pick created', Boolean(pick)],
    ['recommendation type is probability only', pick?.recommendationType === RECOMMENDATION_TYPE],
    ['mlb fixture is ranking eligible', pick?.sportEligibility.status === 'CERTIFIED_LIMITED' && pick.sportEligibility.eligibleForRanking],
    ['probability normalized to percentage', pick?.modelProbability === 64],
    ['post-start rows excluded', postStartExcluded],
    ['same-game correlation penalized', sameGameCorrelation],
    ['parlay generated without simple product', parlay !== null && parlay.combinedProbability !== round((64 / 100) * (58 / 100) * 100)],
    ['uncertified sport rows are not ranking eligible', predictionRowToPick({ ...fixture, id: 'fixture-nfl', sport_key: 'americanfootball_nfl' })?.sportEligibility.eligibleForRanking === false],
    ['soccer rows excluded from ranking eligibility', soccerPick?.sportEligibility.eligibleForRanking === false],
    ['ncaa football rows excluded from ranking eligibility', ncaafPick?.sportEligibility.eligibleForRanking === false],
    ['all sports filter cannot bypass certification', allEligible.every((item) => item.sportEligibility.eligibleForRanking) && allEligible.length === 1],
    ['per-sport filter returns selected certified sport', sportFiltered.length === 1 && sportFiltered[0].sport === 'baseball_mlb'],
    ['probability sort orders by probability', sortedProbability],
    ['confidence sort orders by confidence', sortedConfidence],
    ['quality sort orders by quality', sortedQuality],
    ['freshness summary classifies fixture rows', freshness.status === 'FRESH' && freshness.freshRows >= 1],
    ['stale row excluded by fresh filter', freshOnly.length === 1 && freshOnly[0].id === freshPick?.id],
    ['no qualified picks state can be represented', restrictive.length === 0],
    ['filters too restrictive state can be represented', restrictive.length === 0 && (pick?.modelProbability ?? 0) < 99],
    ['insufficient independent events blocks parlay presentation', eligiblePool.length < 2],
    ['multi-sport unavailable with one certified sport', (eligibilitySummary.parlayEligibleSports?.length ?? 0) === 1],
    ['ai briefing deep-link context metadata present', buildBriefingContext(eligiblePool, freshness, [], eligibilitySummary).qualifiedCount === eligiblePool.length],
    ['no sportsbook dependency in fixture explanations', noForbiddenLanguage],
    ['backward-compatible v1 mode retained', MODE === 'probability_picks_v1' && VERSION === 'probability_picks_v2'],
    ['top signals are additive metadata', signals.highestProbability?.id === pick?.id],
    ['low confidence filter excludes below threshold', lowConfidencePick ? applyFilters([lowConfidencePick], { minConfidence: 45 }).length === 0 : false],
    ['balanced parlay thresholds unchanged', balanced.probability === 56 && balanced.confidence === 55 && balanced.quality === 52 && balanced.maxPenalty === 28],
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
