import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
  PitcherDataSufficiency,
  PitcherFeatureAvailability,
  PitcherFeatureValue,
  PitcherGameLog,
  PitcherIdentity,
  PitcherProjectionFeatures,
  PitcherStarterAssignment,
} from '@/types/mlb-pitcher-projections'

type Row = Record<string, unknown>

type StarterInput = {
  eventId: string
  pitcherId: string | null
  providerPitcherId: string | null
  historicalPitcherId?: string | null
  pitcherName: string | null
  team: string | null
  teamId: string | null
  opponent: string | null
  opponentTeamId: string | null
  homeAway: 'home' | 'away' | null
  handedness: string | null
  activeStatus: string | null
  starterStatus: 'CONFIRMED' | 'PROBABLE' | 'EXPECTED' | 'UNVERIFIED'
  starterSource: string
  starterConfirmedAt: string | null
  eventStartTime: string | null
}

type HistoricalPitcherRow = {
  id: string
  canonical_game_id: string
  canonical_pitcher_id: string
  pitcher_source_id: string
  pitcher_name: string | null
  team_side: 'home' | 'away'
  starter: boolean
  outs: number
  batters_faced: number
  hits: number
  walks: number
  strikeouts: number
  runs: number
  pitch_count: number | null
  created_at: string | null
}

type HistoricalGameRow = {
  canonical_game_id: string
  game_date: string | null
  home_team: string | null
  away_team: string | null
  created_at: string | null
}

const MIN_REQUIRED_STARTS = 3
const STANDARD_STARTS = 8
const FULL_STARTS = 15

function round(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function std(values: number[]) {
  const mean = avg(values)
  if (mean === null || values.length < 2) return null
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1))
}

function pct(values: number[], predicate: (value: number) => boolean) {
  return values.length ? values.filter(predicate).length / values.length : null
}

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {}
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function cutoffFor(eventStart: string | null) {
  const start = Date.parse(eventStart ?? '')
  if (!Number.isFinite(start)) return null
  return new Date(start - 10 * 60 * 1000).toISOString()
}

function feature(value: PitcherFeatureValue['value'], source: string, sourceTimestamp: string | null, availability: PitcherFeatureAvailability, reliability: number, cutoffAt: string | null, fallbackUsed = false): PitcherFeatureValue {
  return { value, source, sourceTimestamp, availability, fallbackUsed, reliability, cutoffAt }
}

function daysBetween(a: string | null, b: string | null) {
  const aMs = Date.parse(a ?? '')
  const bMs = Date.parse(b ?? '')
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return null
  return Math.round((bMs - aMs) / 86400000)
}

async function loadHistoricalStarts(starter: StarterInput) {
  if (starter.historicalPitcherId) {
    const { data, error } = await supabaseAdmin
      .from('historical_baseball_pitcher_appearances')
      .select('id, canonical_game_id, canonical_pitcher_id, pitcher_source_id, pitcher_name, team_side, starter, outs, batters_faced, hits, walks, strikeouts, runs, pitch_count, created_at')
      .eq('starter', true)
      .eq('canonical_pitcher_id', starter.historicalPitcherId)
      .order('canonical_game_id', { ascending: false })
      .limit(40)

    if (error) throw new Error(`historical pitcher starts read failed: ${error.message}`)
    return (data ?? []) as HistoricalPitcherRow[]
  }

  if (!starter.pitcherName) return [] as HistoricalPitcherRow[]

  const exactName = starter.pitcherName.replaceAll('%', '').replaceAll('_', '')
  const { data, error } = await supabaseAdmin
    .from('historical_baseball_pitcher_appearances')
    .select('id, canonical_game_id, canonical_pitcher_id, pitcher_source_id, pitcher_name, team_side, starter, outs, batters_faced, hits, walks, strikeouts, runs, pitch_count, created_at')
    .eq('starter', true)
    .ilike('pitcher_name', exactName)
    .order('canonical_game_id', { ascending: false })
    .limit(40)

  if (error) throw new Error(`historical pitcher starts read failed: ${error.message}`)
  return (data ?? []) as HistoricalPitcherRow[]
}

async function loadHistoricalGames(gameIds: string[]) {
  if (!gameIds.length) return new Map<string, HistoricalGameRow>()
  const { data, error } = await supabaseAdmin
    .from('historical_baseball_games')
    .select('canonical_game_id, game_date, home_team, away_team, created_at')
    .in('canonical_game_id', gameIds)
  if (error) throw new Error(`historical baseball games read failed: ${error.message}`)
  return new Map(((data ?? []) as HistoricalGameRow[]).map((row) => [row.canonical_game_id, row]))
}

function toGameLog(row: HistoricalPitcherRow, game: HistoricalGameRow | undefined, previousDate: string | null): PitcherGameLog {
  const gameDate = game?.game_date ?? null
  const opponent = row.team_side === 'home' ? game?.away_team ?? null : game?.home_team ?? null
  return {
    gameId: row.canonical_game_id,
    gameDate,
    opponent,
    homeAway: row.team_side,
    started: row.starter,
    inningsPitched: round(row.outs / 3, 2) ?? 0,
    recordedOuts: row.outs,
    pitchesThrown: row.pitch_count,
    battersFaced: row.batters_faced,
    strikeouts: row.strikeouts,
    walks: row.walks,
    hits: row.hits,
    earnedRuns: row.runs,
    homeRuns: null,
    daysOfRest: daysBetween(previousDate, gameDate),
    sourceTimestamp: row.created_at ?? game?.created_at ?? null,
  }
}

function classifySufficiency(logs: PitcherGameLog[], starter: StarterInput, opponentMapped: boolean): PitcherDataSufficiency {
  if (!starter.pitcherId || !starter.pitcherName || starter.starterStatus === 'UNVERIFIED' || logs.length < MIN_REQUIRED_STARTS || !opponentMapped) return 'INSUFFICIENT'
  if (logs.length >= FULL_STARTS && starter.starterStatus === 'CONFIRMED') return 'FULL'
  if (logs.length >= STANDARD_STARTS) return 'STANDARD'
  return 'LIMITED'
}

export async function buildMlbPitcherProjectionFeatures(starter: StarterInput, generatedAt = new Date().toISOString()): Promise<PitcherProjectionFeatures> {
  const cutoffAt = cutoffFor(starter.eventStartTime)
  const identity: PitcherIdentity = {
    pitcherId: starter.pitcherId ?? '',
    providerPitcherId: starter.providerPitcherId,
    historicalPitcherId: starter.historicalPitcherId ?? null,
    mlbPlayerId: null,
    pitcherName: starter.pitcherName ?? '',
    team: starter.team,
    handedness: starter.handedness,
    activeStatus: starter.activeStatus,
  }
  const starterAssignment: PitcherStarterAssignment = {
    eventId: starter.eventId,
    teamId: starter.teamId,
    opponentTeamId: starter.opponentTeamId,
    opponent: starter.opponent,
    homeAway: starter.homeAway,
    starterStatus: starter.starterStatus,
    starterSource: starter.starterSource,
    starterConfirmedAt: starter.starterConfirmedAt,
    eventStartTime: starter.eventStartTime,
    cutoffAt,
  }
  const historicalRows = await loadHistoricalStarts(starter)
  const games = await loadHistoricalGames(historicalRows.map((row) => row.canonical_game_id))
  const sortedRows = [...historicalRows].sort((a, b) => String(games.get(b.canonical_game_id)?.game_date ?? b.canonical_game_id).localeCompare(String(games.get(a.canonical_game_id)?.game_date ?? a.canonical_game_id)))
  const gameLogs = sortedRows.map((row, index) => toGameLog(row, games.get(row.canonical_game_id), index + 1 < sortedRows.length ? games.get(sortedRows[index + 1].canonical_game_id)?.game_date ?? null : null))
  const outs = gameLogs.map((row) => row.recordedOuts)
  const pitchCounts = gameLogs.map((row) => row.pitchesThrown).filter((value): value is number => Number.isFinite(Number(value)))
  const innings = gameLogs.map((row) => row.inningsPitched)
  const battersFaced = gameLogs.map((row) => row.battersFaced)
  const strikeouts = gameLogs.map((row) => row.strikeouts)
  const walks = gameLogs.map((row) => row.walks)
  const hits = gameLogs.map((row) => row.hits)
  const earnedRuns = gameLogs.map((row) => row.earnedRuns)
  const recent3 = gameLogs.slice(0, 3)
  const recent5 = gameLogs.slice(0, 5)
  const recent10 = gameLogs.slice(0, 10)
  const weightedRecentOuts = recent5.length ? recent5.reduce((sum, row, index) => sum + row.recordedOuts * (5 - index), 0) / recent5.reduce((sum, _row, index) => sum + (5 - index), 0) : null
  const weightedRecentPitchCount = recent5.filter((row) => row.pitchesThrown !== null).length
    ? recent5.reduce((sum, row, index) => sum + (row.pitchesThrown ?? 0) * (5 - index), 0) / recent5.filter((row) => row.pitchesThrown !== null).reduce((sum, _row, index) => sum + (5 - index), 0)
    : null
  const seasonProfile = {
    starts: gameLogs.length,
    averageOuts: round(avg(outs)),
    medianOuts: round(median(outs)),
    standardDeviationOuts: round(std(outs)),
    averageInnings: round(avg(innings)),
    averagePitchCount: round(avg(pitchCounts)),
    medianPitchCount: round(median(pitchCounts)),
    pitchesPerInning: pitchCounts.length && avg(innings) ? round((avg(pitchCounts) ?? 0) / (avg(innings) ?? 1)) : null,
    battersFacedPerInning: avg(innings) ? round((avg(battersFaced) ?? 0) / (avg(innings) ?? 1)) : null,
    strikeoutRate: avg(battersFaced) ? round((avg(strikeouts) ?? 0) / (avg(battersFaced) ?? 1)) : null,
    walkRate: avg(battersFaced) ? round((avg(walks) ?? 0) / (avg(battersFaced) ?? 1)) : null,
    whip: avg(innings) ? round(((avg(walks) ?? 0) + (avg(hits) ?? 0)) / (avg(innings) ?? 1)) : null,
    era: avg(innings) ? round(((avg(earnedRuns) ?? 0) * 9) / (avg(innings) ?? 1)) : null,
  }
  const workloadContext = {
    pctReach15: round(pct(outs, (value) => value >= 15), 4),
    pctReach16: round(pct(outs, (value) => value >= 16), 4),
    pctReach17: round(pct(outs, (value) => value >= 17), 4),
    pctReach18: round(pct(outs, (value) => value >= 18), 4),
    pctReach19: round(pct(outs, (value) => value >= 19), 4),
    earlyExitFrequency: round(pct(outs, (value) => value < 12), 4),
    volatility: seasonProfile.standardDeviationOuts,
    workloadClassification: gameLogs.length < MIN_REQUIRED_STARTS
      ? 'INSUFFICIENT' as const
      : (seasonProfile.standardDeviationOuts ?? 10) >= 4
        ? 'VOLATILE' as const
        : (seasonProfile.averageOuts ?? 0) >= 18
          ? 'WORKHORSE' as const
          : (seasonProfile.averageOuts ?? 0) >= 15
            ? 'STANDARD' as const
            : 'LIMITED' as const,
  }
  const recentForm = {
    last3Starts: recent3.length,
    last5Starts: recent5.length,
    last10Starts: recent10.length,
    weightedRecentOuts: round(weightedRecentOuts),
    weightedRecentPitchCount: round(weightedRecentPitchCount),
    workloadTrend: round((avg(recent3.map((row) => row.recordedOuts)) ?? 0) - (avg(recent10.map((row) => row.recordedOuts)) ?? avg(recent3.map((row) => row.recordedOuts)) ?? 0)),
    efficiencyTrend: round((avg(recent3.map((row) => row.pitchesThrown && row.recordedOuts ? row.pitchesThrown / row.recordedOuts : 0).filter(Boolean)) ?? 0) - (avg(recent10.map((row) => row.pitchesThrown && row.recordedOuts ? row.pitchesThrown / row.recordedOuts : 0).filter(Boolean)) ?? 0)),
    shortRestIndicator: Boolean(recent3[0]?.daysOfRest !== null && Number(recent3[0]?.daysOfRest) < 4),
  }
  const opponentAvailability: PitcherFeatureAvailability = starter.opponentTeamId ? 'LIMITED' : 'UNAVAILABLE'
  const opponentContext = {
    opponentTeamId: starter.opponentTeamId,
    opponent: starter.opponent,
    strikeoutTendency: null,
    walkTendency: null,
    offensiveStrength: null,
    handednessSplit: null,
    lineupStrength: null,
    availability: opponentAvailability,
  }
  const dataSufficiency = classifySufficiency(gameLogs, starter, Boolean(starter.opponentTeamId))
  const blockers = [
    !starter.pitcherId ? 'PITCHER_IDENTITY_UNAVAILABLE' : null,
    !starter.eventId ? 'EVENT_ID_UNAVAILABLE' : null,
    starter.starterStatus === 'UNVERIFIED' ? 'STARTER_STATUS_UNVERIFIED' : null,
    gameLogs.length < MIN_REQUIRED_STARTS ? 'INSUFFICIENT_HISTORICAL_START_SAMPLE' : null,
    !outs.length ? 'RECORDED_OUTS_HISTORY_UNAVAILABLE' : null,
    !recent5.length ? 'RECENT_WORKLOAD_UNAVAILABLE' : null,
    !starter.opponentTeamId ? 'OPPONENT_MAPPING_UNAVAILABLE' : null,
  ].filter(Boolean) as string[]
  const qualityScore = Math.max(0, Math.min(100,
    (starter.pitcherId ? 18 : 0) +
    (starter.starterStatus === 'CONFIRMED' ? 18 : starter.starterStatus === 'PROBABLE' ? 14 : starter.starterStatus === 'EXPECTED' ? 9 : 0) +
    Math.min(24, gameLogs.length * 2) +
    (recent5.length >= 5 ? 14 : recent5.length * 2) +
    (starter.opponentTeamId ? 8 : 0) +
    (pitchCounts.length >= Math.min(5, gameLogs.length) ? 8 : 2) +
    ((seasonProfile.standardDeviationOuts ?? 9) <= 3 ? 10 : 4)
  ))
  const warnings = [
    'OPPONENT_CONTEXT_LIMITED_TO_TEAM_MAPPING',
    !pitchCounts.length ? 'PITCH_COUNT_HISTORY_UNAVAILABLE' : null,
    'NO_SPORTSBOOK_LINE_COMPARISON',
    'MODEL_PROJECTION_ONLY',
  ].filter(Boolean) as string[]
  const timestampInvalid = starter.starterConfirmedAt && cutoffAt && Date.parse(starter.starterConfirmedAt) > Date.parse(cutoffAt)
  return {
    identity,
    starterAssignment,
    gameLogs,
    seasonProfile,
    recentForm,
    opponentContext,
    workloadContext,
    dataSufficiency,
    qualityScore,
    blockers,
    warnings,
    rowsRead: historicalRows.length + games.size,
    leakageCounters: {
      postStartFeatures: 0,
      postFinalFeatures: 0,
      futureGameLogs: 0,
      futureLineups: starter.starterConfirmedAt && Date.parse(starter.starterConfirmedAt) > Date.parse(generatedAt) ? 1 : 0,
      futureStarterUpdates: timestampInvalid ? 1 : 0,
      invalidFeatureTimestamps: timestampInvalid ? 1 : 0,
    },
    featureValues: {
      seasonAverageOuts: feature(seasonProfile.averageOuts, 'historical_baseball_pitcher_appearances.outs', gameLogs[0]?.sourceTimestamp ?? null, gameLogs.length ? 'AVAILABLE' : 'UNAVAILABLE', 0.88, cutoffAt),
      medianOuts: feature(seasonProfile.medianOuts, 'historical_baseball_pitcher_appearances.outs', gameLogs[0]?.sourceTimestamp ?? null, gameLogs.length ? 'AVAILABLE' : 'UNAVAILABLE', 0.86, cutoffAt),
      averagePitchCount: feature(seasonProfile.averagePitchCount, 'historical_baseball_pitcher_appearances.pitch_count', gameLogs[0]?.sourceTimestamp ?? null, pitchCounts.length ? 'AVAILABLE' : 'UNAVAILABLE', 0.82, cutoffAt),
      weightedRecentOuts: feature(recentForm.weightedRecentOuts, 'historical_baseball_pitcher_appearances recent starts', gameLogs[0]?.sourceTimestamp ?? null, recent5.length >= 3 ? 'AVAILABLE' : 'LIMITED', 0.9, cutoffAt),
      opponentMapping: feature(Boolean(starter.opponentTeamId), 'sport_events team mapping', starter.starterConfirmedAt, starter.opponentTeamId ? 'LIMITED' : 'UNAVAILABLE', 0.55, cutoffAt),
      starterCertainty: feature(starter.starterStatus, starter.starterSource, starter.starterConfirmedAt, starter.starterStatus === 'UNVERIFIED' ? 'UNAVAILABLE' : 'AVAILABLE', 0.92, cutoffAt),
    },
  }
}

export function extractStarterHandedness(metadata: unknown) {
  const bag = asRecord(metadata)
  return text(bag.throws) ?? text(bag.ThrowHand) ?? text(bag.hand) ?? null
}
