import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type Row = Record<string, unknown>

type PitcherWindowTotals = {
  totalPitches: number
  plateAppearances: number
  strikeouts: number
  walks: number
  hits: number
  homeRuns: number
  balls: number
  strikes: number
  inPlay: number
  calledStrikes: number
  whiffs: number
  swings: number
  zonePitches: number
  outsideZonePitches: number
  chases: number
  firstPitches: number
  firstPitchStrikes: number
}

export type StatcastWindow = {
  games: number
  totalPitches: number
  plateAppearances: number
  strikeouts: number
  walks: number
  hits: number
  homeRuns: number
  ballRate: number | null
  strikeRate: number | null
  inPlayRate: number | null
  cswRate: number | null
  whiffRate: number | null
  chaseRate: number | null
  zoneRate: number | null
  contactRate: number | null
  firstPitchStrikeRate: number | null
}

export type MlbStatcastCoverageRow = {
  season: number
  firstGameDate: string | null
  lastGameDate: string | null
  pitches: number
  games: number
  pitchers: number
  batters: number
  battingTeams: number
}

const SWING_DESCRIPTIONS = new Set([
  'swinging_strike',
  'swinging_strike_blocked',
  'missed_bunt',
  'foul',
  'foul_bunt',
  'foul_tip',
  'hit_into_play',
  'hit_into_play_no_out',
  'hit_into_play_score',
])

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function integer(value: unknown): number {
  return Math.trunc(numberOrNull(value) ?? 0)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

function aggregatePitcherWindow(rows: Row[]): StatcastWindow {
  const initial: PitcherWindowTotals = {
    totalPitches: 0,
    plateAppearances: 0,
    strikeouts: 0,
    walks: 0,
    hits: 0,
    homeRuns: 0,
    balls: 0,
    strikes: 0,
    inPlay: 0,
    calledStrikes: 0,
    whiffs: 0,
    swings: 0,
    zonePitches: 0,
    outsideZonePitches: 0,
    chases: 0,
    firstPitches: 0,
    firstPitchStrikes: 0,
  }

  const totals = rows.reduce<PitcherWindowTotals>((acc, row) => {
    acc.totalPitches += integer(row.total_pitches)
    acc.plateAppearances += integer(row.plate_appearances)
    acc.strikeouts += integer(row.strikeouts)
    acc.walks += integer(row.walks) + integer(row.intentional_walks)
    acc.hits += integer(row.hits)
    acc.homeRuns += integer(row.home_runs)
    acc.balls += integer(row.balls)
    acc.strikes += integer(row.strikes)
    acc.inPlay += integer(row.in_play)
    acc.calledStrikes += integer(row.called_strikes)
    acc.whiffs += integer(row.whiffs)
    acc.swings += integer(row.swings)
    acc.zonePitches += integer(row.zone_pitches)
    acc.outsideZonePitches += integer(row.outside_zone_pitches)
    acc.chases += integer(row.chases)
    acc.firstPitches += integer(row.first_pitches)
    acc.firstPitchStrikes += integer(row.first_pitch_strikes)
    return acc
  }, initial)

  return {
    games: rows.length,
    totalPitches: totals.totalPitches,
    plateAppearances: totals.plateAppearances,
    strikeouts: totals.strikeouts,
    walks: totals.walks,
    hits: totals.hits,
    homeRuns: totals.homeRuns,
    ballRate: rate(totals.balls, totals.totalPitches),
    strikeRate: rate(totals.strikes, totals.totalPitches),
    inPlayRate: rate(totals.inPlay, totals.totalPitches),
    cswRate: rate(totals.calledStrikes + totals.whiffs, totals.totalPitches),
    whiffRate: rate(totals.whiffs, totals.swings),
    chaseRate: rate(totals.chases, totals.outsideZonePitches),
    zoneRate: rate(totals.zonePitches, totals.zonePitches + totals.outsideZonePitches),
    contactRate: totals.swings > 0 ? (totals.swings - totals.whiffs) / totals.swings : null,
    firstPitchStrikeRate: rate(totals.firstPitchStrikes, totals.firstPitches),
  }
}

function pitcherSeasonSummary(row: Row | null) {
  if (!row) return null
  return {
    season: integer(row.season),
    pitcherId: integer(row.pitcher),
    playerName: text(row.player_name),
    throws: text(row.p_throws),
    games: integer(row.games),
    totalPitches: integer(row.total_pitches),
    plateAppearances: integer(row.plate_appearances),
    strikeouts: integer(row.strikeouts),
    walks: integer(row.walks),
    intentionalWalks: integer(row.intentional_walks),
    hits: integer(row.hits),
    homeRuns: integer(row.home_runs),
    hitByPitch: integer(row.hit_by_pitch),
    balls: integer(row.balls),
    strikes: integer(row.strikes),
    inPlay: integer(row.in_play),
    calledStrikes: integer(row.called_strikes),
    whiffs: integer(row.whiffs),
    swings: integer(row.swings),
    zonePitches: integer(row.zone_pitches),
    outsideZonePitches: integer(row.outside_zone_pitches),
    chases: integer(row.chases),
    firstPitches: integer(row.first_pitches),
    firstPitchStrikes: integer(row.first_pitch_strikes),
    battedBalls: integer(row.batted_balls),
    hardHits: integer(row.hard_hits),
    barrels: integer(row.barrels),
    avgExitVelocity: numberOrNull(row.avg_exit_velocity),
    avgLaunchAngle: numberOrNull(row.avg_launch_angle),
    avgReleaseSpeed: numberOrNull(row.avg_release_speed),
    maxReleaseSpeed: numberOrNull(row.max_release_speed),
    ballRate: numberOrNull(row.ball_rate),
    strikeRate: numberOrNull(row.strike_rate),
    inPlayRate: numberOrNull(row.in_play_rate),
    cswRate: numberOrNull(row.csw_rate),
    whiffRate: numberOrNull(row.whiff_rate),
    chaseRate: numberOrNull(row.chase_rate),
    zoneRate: numberOrNull(row.zone_rate),
    contactRate: numberOrNull(row.contact_rate),
    firstPitchStrikeRate: numberOrNull(row.first_pitch_strike_rate),
    pitchesPerPa: numberOrNull(row.pitches_per_pa),
    refreshedAt: text(row.refreshed_at),
  }
}

function batterSeasonSummary(row: Row | null) {
  if (!row) return null
  return {
    season: integer(row.season),
    batterId: integer(row.batter),
    stand: text(row.stand),
    games: integer(row.games),
    pitchesSeen: integer(row.pitches_seen),
    plateAppearances: integer(row.plate_appearances),
    strikeouts: integer(row.strikeouts),
    walks: integer(row.walks),
    intentionalWalks: integer(row.intentional_walks),
    hits: integer(row.hits),
    singles: integer(row.singles),
    doubles: integer(row.doubles),
    triples: integer(row.triples),
    homeRuns: integer(row.home_runs),
    hitByPitch: integer(row.hit_by_pitch),
    balls: integer(row.balls),
    strikes: integer(row.strikes),
    inPlay: integer(row.in_play),
    whiffs: integer(row.whiffs),
    swings: integer(row.swings),
    zonePitches: integer(row.zone_pitches),
    outsideZonePitches: integer(row.outside_zone_pitches),
    chases: integer(row.chases),
    battedBalls: integer(row.batted_balls),
    hardHits: integer(row.hard_hits),
    barrels: integer(row.barrels),
    avgExitVelocity: numberOrNull(row.avg_exit_velocity),
    avgLaunchAngle: numberOrNull(row.avg_launch_angle),
    ballRate: numberOrNull(row.ball_rate),
    strikeRate: numberOrNull(row.strike_rate),
    inPlayRate: numberOrNull(row.in_play_rate),
    whiffRate: numberOrNull(row.whiff_rate),
    chaseRate: numberOrNull(row.chase_rate),
    zoneRate: numberOrNull(row.zone_rate),
    contactRate: numberOrNull(row.contact_rate),
    pitchesPerPa: numberOrNull(row.pitches_per_pa),
    refreshedAt: text(row.refreshed_at),
  }
}

export async function getMlbStatcastCoverage(season?: number) {
  let query = supabaseAdmin
    .from('mlb_statcast_coverage_v')
    .select('season, first_game_date, last_game_date, pitches, games, pitchers, batters, batting_teams')
    .order('season', { ascending: true })

  if (season) query = query.eq('season', season)

  const { data, error } = await query
  if (error) throw new Error(`MLB Statcast coverage read failed: ${error.message}`)

  return ((data ?? []) as Row[]).map((row): MlbStatcastCoverageRow => ({
    season: integer(row.season),
    firstGameDate: text(row.first_game_date),
    lastGameDate: text(row.last_game_date),
    pitches: integer(row.pitches),
    games: integer(row.games),
    pitchers: integer(row.pitchers),
    batters: integer(row.batters),
    battingTeams: integer(row.batting_teams),
  }))
}

export async function getMlbStatcastPitcherProfile(input: {
  pitcherId: number
  season: number
  recentGames?: number
}) {
  const recentGames = Math.max(3, Math.min(30, input.recentGames ?? 20))
  const [summaryResult, pitchTypesResult, gamesResult] = await Promise.all([
    supabaseAdmin.from('mlb_statcast_pitcher_season_summary').select('*').eq('season', input.season).eq('pitcher', input.pitcherId).maybeSingle(),
    supabaseAdmin.from('mlb_statcast_pitcher_pitch_type_summary').select('*').eq('season', input.season).eq('pitcher', input.pitcherId).order('total_pitches', { ascending: false }),
    supabaseAdmin.from('mlb_statcast_pitcher_game_logs').select('*').eq('season', input.season).eq('pitcher', input.pitcherId).order('game_date', { ascending: false }).limit(recentGames),
  ])

  if (summaryResult.error) throw new Error(`MLB Statcast pitcher summary read failed: ${summaryResult.error.message}`)
  if (pitchTypesResult.error) throw new Error(`MLB Statcast pitch-type read failed: ${pitchTypesResult.error.message}`)
  if (gamesResult.error) throw new Error(`MLB Statcast pitcher game-log read failed: ${gamesResult.error.message}`)

  const summary = pitcherSeasonSummary((summaryResult.data as Row | null) ?? null)
  const games = (gamesResult.data ?? []) as Row[]
  if (!summary) {
    return { status: 'NOT_FOUND' as const, pitcherId: input.pitcherId, season: input.season, summary: null, pitchTypes: [], recentGames: [], windows: {} }
  }

  const windows = Object.fromEntries(
    [3, 5, 10, 20].filter((size) => size <= recentGames).map((size) => [`last${size}`, aggregatePitcherWindow(games.slice(0, size))]),
  )

  return {
    status: 'READY' as const,
    pitcherId: input.pitcherId,
    season: input.season,
    summary,
    pitchTypes: ((pitchTypesResult.data ?? []) as Row[]).map((row) => ({
      pitchType: text(row.pitch_type), pitchName: text(row.pitch_name), totalPitches: integer(row.total_pitches), usageRate: numberOrNull(row.usage_rate),
      avgReleaseSpeed: numberOrNull(row.avg_release_speed), maxReleaseSpeed: numberOrNull(row.max_release_speed), avgSpinRate: numberOrNull(row.avg_spin_rate),
      avgExtension: numberOrNull(row.avg_extension), avgPfxX: numberOrNull(row.avg_pfx_x), avgPfxZ: numberOrNull(row.avg_pfx_z), zoneRate: numberOrNull(row.zone_rate),
      whiffRate: numberOrNull(row.whiff_rate), chaseRate: numberOrNull(row.chase_rate), inPlayRate: numberOrNull(row.in_play_rate), battedBalls: integer(row.batted_balls),
      avgExitVelocity: numberOrNull(row.avg_exit_velocity), avgLaunchAngle: numberOrNull(row.avg_launch_angle), avgXba: numberOrNull(row.avg_xba), avgXwoba: numberOrNull(row.avg_xwoba),
    })),
    recentGames: games.map((row) => ({
      gamePk: integer(row.game_pk), gameDate: text(row.game_date), pitchingTeam: text(row.pitching_team), opponentTeam: text(row.opponent_team),
      totalPitches: integer(row.total_pitches), plateAppearances: integer(row.plate_appearances), strikeouts: integer(row.strikeouts),
      walks: integer(row.walks) + integer(row.intentional_walks), hits: integer(row.hits), homeRuns: integer(row.home_runs), ballRate: numberOrNull(row.ball_rate),
      strikeRate: numberOrNull(row.strike_rate), inPlayRate: numberOrNull(row.in_play_rate), cswRate: numberOrNull(row.csw_rate), whiffRate: numberOrNull(row.whiff_rate),
      chaseRate: numberOrNull(row.chase_rate), zoneRate: numberOrNull(row.zone_rate), contactRate: numberOrNull(row.contact_rate), firstPitchStrikeRate: numberOrNull(row.first_pitch_strike_rate),
      avgReleaseSpeed: numberOrNull(row.avg_release_speed), maxReleaseSpeed: numberOrNull(row.max_release_speed),
    })),
    windows,
  }
}

export async function getMlbStatcastBatterProfile(input: { batterId: number; season: number; recentGames?: number }) {
  const recentGames = Math.max(3, Math.min(30, input.recentGames ?? 20))
  const [summaryResult, gamesResult] = await Promise.all([
    supabaseAdmin.from('mlb_statcast_batter_season_summary').select('*').eq('season', input.season).eq('batter', input.batterId).maybeSingle(),
    supabaseAdmin.from('mlb_statcast_batter_game_logs').select('*').eq('season', input.season).eq('batter', input.batterId).order('game_date', { ascending: false }).limit(recentGames),
  ])

  if (summaryResult.error) throw new Error(`MLB Statcast batter summary read failed: ${summaryResult.error.message}`)
  if (gamesResult.error) throw new Error(`MLB Statcast batter game-log read failed: ${gamesResult.error.message}`)

  const summary = batterSeasonSummary((summaryResult.data as Row | null) ?? null)
  if (!summary) return { status: 'NOT_FOUND' as const, batterId: input.batterId, season: input.season, summary: null, recentGames: [] }

  return {
    status: 'READY' as const,
    batterId: input.batterId,
    season: input.season,
    summary,
    recentGames: ((gamesResult.data ?? []) as Row[]).map((row) => ({
      gamePk: integer(row.game_pk), gameDate: text(row.game_date), battingTeam: text(row.batting_team), opponentTeam: text(row.opponent_team),
      pitchesSeen: integer(row.pitches_seen), plateAppearances: integer(row.plate_appearances), strikeouts: integer(row.strikeouts),
      walks: integer(row.walks) + integer(row.intentional_walks), hits: integer(row.hits), homeRuns: integer(row.home_runs), ballRate: numberOrNull(row.ball_rate),
      strikeRate: numberOrNull(row.strike_rate), inPlayRate: numberOrNull(row.in_play_rate), whiffRate: numberOrNull(row.whiff_rate), chaseRate: numberOrNull(row.chase_rate),
      zoneRate: numberOrNull(row.zone_rate), contactRate: numberOrNull(row.contact_rate), avgExitVelocity: numberOrNull(row.avg_exit_velocity), avgLaunchAngle: numberOrNull(row.avg_launch_angle),
    })),
  }
}

export async function getMlbStatcastTeamProfile(input: { team: string; season: number }) {
  const team = input.team.trim().toUpperCase()
  const [battingResult, pitchingResult] = await Promise.all([
    supabaseAdmin.from('mlb_statcast_team_batting_season_summary').select('*').eq('season', input.season).eq('team', team).maybeSingle(),
    supabaseAdmin.from('mlb_statcast_team_pitching_season_summary').select('*').eq('season', input.season).eq('team', team).maybeSingle(),
  ])

  if (battingResult.error) throw new Error(`MLB Statcast team batting read failed: ${battingResult.error.message}`)
  if (pitchingResult.error) throw new Error(`MLB Statcast team pitching read failed: ${pitchingResult.error.message}`)

  return {
    status: battingResult.data || pitchingResult.data ? ('READY' as const) : ('NOT_FOUND' as const),
    team,
    season: input.season,
    batting: (battingResult.data as Row | null) ?? null,
    pitching: (pitchingResult.data as Row | null) ?? null,
  }
}

export const MLB_STATCAST_METRIC_DEFINITIONS = {
  ballRate: 'Statcast pitch type B divided by total pitches.',
  strikeRate: 'Statcast pitch type S divided by total pitches.',
  inPlayRate: 'Statcast pitch type X divided by total pitches.',
  cswRate: 'Called strikes plus swinging misses divided by total pitches.',
  whiffRate: 'Swinging misses divided by swings.',
  chaseRate: 'Swings at pitches with Statcast zone outside 1-9 divided by tracked pitches outside zone 1-9.',
  zoneRate: 'Pitches in Statcast zones 1-9 divided by pitches with a tracked zone.',
  contactRate: 'Swings minus whiffs divided by swings.',
  firstPitchStrikeRate: 'Pitch-number-1 pitches with Statcast type S divided by all tracked first pitches.',
  hardHit: 'Batted ball with launch_speed >= 95 mph.',
  barrel: 'Batted ball with Statcast launch_speed_angle = 6.',
} as const

export function statcastSwingDescription(description: string) {
  return SWING_DESCRIPTIONS.has(description)
}
