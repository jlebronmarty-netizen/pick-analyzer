import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type Row = Record<string, unknown>

const CANONICAL_FROM_STATCAST: Record<string, string> = { AZ: 'ARI', CWS: 'CHW' }
const STATCAST_FROM_CANONICAL: Record<string, string> = { ARI: 'AZ', CHW: 'CWS' }

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

function delta(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a - b
}

function mean(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => value !== null)
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null
}

function canonicalTeam(team: string) {
  const upper = team.trim().toUpperCase()
  return CANONICAL_FROM_STATCAST[upper] ?? upper
}

function statcastTeam(team: string) {
  const canonical = canonicalTeam(team)
  return STATCAST_FROM_CANONICAL[canonical] ?? canonical
}

function sampleTier(pitcherPitches: number, opponentPitches: number) {
  if (pitcherPitches >= 200 && opponentPitches >= 300) return 'HIGH' as const
  if (pitcherPitches >= 75 && opponentPitches >= 100) return 'MEDIUM' as const
  return 'LOW' as const
}

function handSplit(row: Row | null) {
  if (!row) return null
  return {
    batterStand: text(row.batter_stand),
    games: integer(row.games),
    plateAppearances: integer(row.plate_appearances),
    totalPitches: integer(row.total_pitches),
    strikeouts: integer(row.strikeouts),
    walks: integer(row.walks) + integer(row.intentional_walks),
    hits: integer(row.hits),
    homeRuns: integer(row.home_runs),
    strikeoutRate: numberOrNull(row.strikeout_rate),
    walkRate: numberOrNull(row.walk_rate),
    whiffRate: numberOrNull(row.whiff_rate),
    chaseRate: numberOrNull(row.chase_rate),
    zoneRate: numberOrNull(row.zone_rate),
    contactRate: numberOrNull(row.contact_rate),
    hardHitRate: numberOrNull(row.hard_hit_rate),
    barrelRate: numberOrNull(row.barrel_rate),
    avgExitVelocity: numberOrNull(row.avg_exit_velocity),
    avgXba: numberOrNull(row.avg_xba),
    avgXwoba: numberOrNull(row.avg_xwoba),
  }
}

function pitcherVsTeam(row: Row | null) {
  if (!row) return null
  return {
    games: integer(row.games),
    firstGameDate: text(row.first_game_date),
    lastGameDate: text(row.last_game_date),
    plateAppearances: integer(row.plate_appearances),
    totalPitches: integer(row.total_pitches),
    strikeouts: integer(row.strikeouts),
    walks: integer(row.walks) + integer(row.intentional_walks),
    hits: integer(row.hits),
    homeRuns: integer(row.home_runs),
    strikeoutRate: numberOrNull(row.strikeout_rate),
    walkRate: numberOrNull(row.walk_rate),
    whiffRate: numberOrNull(row.whiff_rate),
    chaseRate: numberOrNull(row.chase_rate),
    hardHitRate: numberOrNull(row.hard_hit_rate),
    barrelRate: numberOrNull(row.barrel_rate),
    avgExitVelocity: numberOrNull(row.avg_exit_velocity),
    avgXba: numberOrNull(row.avg_xba),
    avgXwoba: numberOrNull(row.avg_xwoba),
  }
}

function h2h(row: Row | null) {
  if (!row) return null
  return {
    games: integer(row.games),
    firstGameDate: text(row.first_game_date),
    lastGameDate: text(row.last_game_date),
    plateAppearances: integer(row.plate_appearances),
    totalPitches: integer(row.total_pitches),
    strikeouts: integer(row.strikeouts),
    walks: integer(row.walks) + integer(row.intentional_walks),
    hits: integer(row.hits),
    homeRuns: integer(row.home_runs),
    strikeoutRate: numberOrNull(row.strikeout_rate),
    whiffRate: numberOrNull(row.whiff_rate),
    chaseRate: numberOrNull(row.chase_rate),
    hardHitRate: numberOrNull(row.hard_hit_rate),
    avgExitVelocity: numberOrNull(row.avg_exit_velocity),
    avgXwoba: numberOrNull(row.avg_xwoba),
  }
}

function weightedLineupPitchType(rows: Row[]) {
  const pitchesSeen = rows.reduce((sum, row) => sum + integer(row.pitches_seen), 0)
  const swings = rows.reduce((sum, row) => sum + integer(row.swings), 0)
  const whiffs = rows.reduce((sum, row) => sum + integer(row.whiffs), 0)
  const chases = rows.reduce((sum, row) => sum + integer(row.chases), 0)
  const outside = rows.reduce((sum, row) => sum + integer(row.outside_zone_pitches), 0)
  const battedBalls = rows.reduce((sum, row) => sum + integer(row.batted_balls), 0)
  const hardHits = rows.reduce((sum, row) => sum + integer(row.hard_hits), 0)
  const barrels = rows.reduce((sum, row) => sum + integer(row.barrels), 0)
  const xwobaWeight = rows.reduce((sum, row) => {
    const value = numberOrNull(row.avg_xwoba)
    return sum + (value === null ? 0 : value * integer(row.batted_balls))
  }, 0)

  return {
    battersWithData: rows.length,
    pitchesSeen,
    battedBalls,
    whiffRate: swings > 0 ? whiffs / swings : null,
    chaseRate: outside > 0 ? chases / outside : null,
    hardHitRate: battedBalls > 0 ? hardHits / battedBalls : null,
    barrelRate: battedBalls > 0 ? barrels / battedBalls : null,
    avgXwoba: battedBalls > 0 ? xwobaWeight / battedBalls : null,
  }
}

export async function getMlbStatcastMatchup(input: {
  pitcherId: number
  opponentTeam: string
  season: number
  batterIds?: number[]
}) {
  const opponentTeam = canonicalTeam(input.opponentTeam)
  const sourceOpponentTeam = statcastTeam(opponentTeam)
  const batterIds = [...new Set((input.batterIds ?? []).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 13)

  const [pitcherSummaryResult, pitchTypesResult, pitcherSplitsResult, vsTeamResult] = await Promise.all([
    supabaseAdmin.from('mlb_statcast_pitcher_season_summary').select('*').eq('season', input.season).eq('pitcher', input.pitcherId).maybeSingle(),
    supabaseAdmin.from('mlb_statcast_pitcher_pitch_type_summary').select('*').eq('season', input.season).eq('pitcher', input.pitcherId).order('total_pitches', { ascending: false }),
    supabaseAdmin.from('mlb_statcast_pitcher_hand_split_summary').select('*').eq('season', input.season).eq('pitcher', input.pitcherId),
    supabaseAdmin.from('mlb_statcast_pitcher_vs_team_summary').select('*').eq('season', input.season).eq('pitcher', input.pitcherId).eq('opponent_team', sourceOpponentTeam).maybeSingle(),
  ])

  for (const result of [pitcherSummaryResult, pitchTypesResult, pitcherSplitsResult, vsTeamResult]) {
    if (result.error) throw new Error(`MLB Statcast matchup base read failed: ${result.error.message}`)
  }

  const pitcherSummary = pitcherSummaryResult.data as Row | null
  if (!pitcherSummary) {
    return { status: 'NOT_FOUND' as const, season: input.season, pitcherId: input.pitcherId, opponentTeam }
  }

  const pitcherThrows = text(pitcherSummary.p_throws)
  if (!pitcherThrows) throw new Error('MLB Statcast matchup pitcher hand is unavailable')

  const playerQuery = batterIds.length
    ? supabaseAdmin.from('pick2_mlb_players').select('mlbam_person_id, full_name, bat_side').in('mlbam_person_id', batterIds)
    : Promise.resolve({ data: [], error: null })
  const batterHandQuery = batterIds.length
    ? supabaseAdmin.from('mlb_statcast_batter_hand_split_summary').select('*').eq('season', input.season).eq('pitcher_throws', pitcherThrows).in('batter', batterIds)
    : Promise.resolve({ data: [], error: null })
  const batterPitchQuery = batterIds.length
    ? supabaseAdmin.from('mlb_statcast_batter_pitch_type_summary').select('*').eq('season', input.season).eq('pitcher_throws', pitcherThrows).in('batter', batterIds)
    : Promise.resolve({ data: [], error: null })
  const h2hQuery = batterIds.length
    ? supabaseAdmin.from('mlb_statcast_pitcher_batter_summary').select('*').eq('season', input.season).eq('pitcher', input.pitcherId).in('batter', batterIds)
    : Promise.resolve({ data: [], error: null })

  const [teamPitchResult, leaguePitchResult, playersResult, batterHandResult, batterPitchResult, h2hResult] = await Promise.all([
    supabaseAdmin.from('mlb_statcast_team_vs_pitch_type_summary').select('*').eq('season', input.season).eq('team', sourceOpponentTeam).eq('pitcher_throws', pitcherThrows),
    supabaseAdmin.from('mlb_statcast_league_pitch_type_summary').select('*').eq('season', input.season).eq('pitcher_throws', pitcherThrows),
    playerQuery,
    batterHandQuery,
    batterPitchQuery,
    h2hQuery,
  ])

  for (const result of [teamPitchResult, leaguePitchResult, playersResult, batterHandResult, batterPitchResult, h2hResult]) {
    if (result.error) throw new Error(`MLB Statcast matchup detail read failed: ${result.error.message}`)
  }

  const pitchTypes = (pitchTypesResult.data ?? []) as Row[]
  const teamPitchRows = (teamPitchResult.data ?? []) as Row[]
  const leaguePitchRows = (leaguePitchResult.data ?? []) as Row[]
  const batterPitchRows = (batterPitchResult.data ?? []) as Row[]
  const teamByPitch = new Map(teamPitchRows.map((row) => [text(row.pitch_type), row]))
  const leagueByPitch = new Map(leaguePitchRows.map((row) => [text(row.pitch_type), row]))

  const pitchTypeEdges = pitchTypes.map((pitcherRow) => {
    const pitchType = text(pitcherRow.pitch_type)
    const opponentRow = teamByPitch.get(pitchType) ?? null
    const leagueRow = leagueByPitch.get(pitchType) ?? null
    const lineupRows = batterPitchRows.filter((row) => text(row.pitch_type) === pitchType)
    const lineup = lineupRows.length ? weightedLineupPitchType(lineupRows) : null

    const pitcherWhiff = numberOrNull(pitcherRow.whiff_rate)
    const opponentWhiff = numberOrNull(opponentRow?.whiff_rate)
    const leagueWhiff = numberOrNull(leagueRow?.whiff_rate)
    const pitcherXwoba = numberOrNull(pitcherRow.avg_xwoba)
    const opponentXwoba = numberOrNull(opponentRow?.avg_xwoba)
    const leagueXwoba = numberOrNull(leagueRow?.avg_xwoba)
    const pitcherPitches = integer(pitcherRow.total_pitches)
    const opponentPitches = integer(opponentRow?.pitches_seen)

    return {
      pitchType,
      pitchName: text(pitcherRow.pitch_name),
      usageRate: numberOrNull(pitcherRow.usage_rate),
      sampleTier: sampleTier(pitcherPitches, opponentPitches),
      samples: {
        pitcherPitches,
        opponentPitches,
        leaguePitches: integer(leagueRow?.total_pitches),
        lineupPitches: lineup?.pitchesSeen ?? 0,
        lineupBattersWithData: lineup?.battersWithData ?? 0,
      },
      whiff: {
        pitcher: pitcherWhiff,
        opponent: opponentWhiff,
        lineup: lineup?.whiffRate ?? null,
        league: leagueWhiff,
        pitcherVsLeague: delta(pitcherWhiff, leagueWhiff),
        opponentVsLeague: delta(opponentWhiff, leagueWhiff),
        descriptivePressure: mean([delta(pitcherWhiff, leagueWhiff), delta(opponentWhiff, leagueWhiff)]),
      },
      xwoba: {
        pitcherAllowed: pitcherXwoba,
        opponentProduced: opponentXwoba,
        lineupProduced: lineup?.avgXwoba ?? null,
        league: leagueXwoba,
        pitcherSuppressionVsLeague: leagueXwoba === null || pitcherXwoba === null ? null : leagueXwoba - pitcherXwoba,
        opponentSuppressionVsLeague: leagueXwoba === null || opponentXwoba === null ? null : leagueXwoba - opponentXwoba,
      },
      contact: {
        pitcherChaseRate: numberOrNull(pitcherRow.chase_rate),
        opponentChaseRate: numberOrNull(opponentRow?.chase_rate),
        lineupChaseRate: lineup?.chaseRate ?? null,
        pitcherAvgExitVelocityAllowed: numberOrNull(pitcherRow.avg_exit_velocity),
        opponentAvgExitVelocity: numberOrNull(opponentRow?.avg_exit_velocity),
        opponentHardHitRate: numberOrNull(opponentRow?.hard_hit_rate),
        lineupHardHitRate: lineup?.hardHitRate ?? null,
        opponentBarrelRate: numberOrNull(opponentRow?.barrel_rate),
        lineupBarrelRate: lineup?.barrelRate ?? null,
      },
    }
  })

  const playerById = new Map(((playersResult.data ?? []) as Row[]).map((row) => [integer(row.mlbam_person_id), row]))
  const batterHandById = new Map(((batterHandResult.data ?? []) as Row[]).map((row) => [integer(row.batter), row]))
  const h2hById = new Map(((h2hResult.data ?? []) as Row[]).map((row) => [integer(row.batter), row]))

  const lineup = batterIds.map((batterId) => {
    const player = playerById.get(batterId) ?? null
    const pitchRows = batterPitchRows.filter((row) => integer(row.batter) === batterId)
    return {
      batterId,
      fullName: text(player?.full_name),
      batSide: text(player?.bat_side),
      vsPitcherHand: handSplit(batterHandById.get(batterId) ?? null),
      headToHead: h2h(h2hById.get(batterId) ?? null),
      pitchTypes: pitchRows.map((row) => ({
        pitchType: text(row.pitch_type),
        pitchName: text(row.pitch_name),
        pitchesSeen: integer(row.pitches_seen),
        whiffRate: numberOrNull(row.whiff_rate),
        chaseRate: numberOrNull(row.chase_rate),
        hardHitRate: numberOrNull(row.hard_hit_rate),
        barrelRate: numberOrNull(row.barrel_rate),
        avgExitVelocity: numberOrNull(row.avg_exit_velocity),
        avgXba: numberOrNull(row.avg_xba),
        avgXwoba: numberOrNull(row.avg_xwoba),
      })),
    }
  })

  return {
    status: 'READY' as const,
    season: input.season,
    pitcher: {
      pitcherId: input.pitcherId,
      playerName: text(pitcherSummary.player_name),
      throws: pitcherThrows,
      games: integer(pitcherSummary.games),
      totalPitches: integer(pitcherSummary.total_pitches),
      strikeouts: integer(pitcherSummary.strikeouts),
      whiffRate: numberOrNull(pitcherSummary.whiff_rate),
      chaseRate: numberOrNull(pitcherSummary.chase_rate),
      cswRate: numberOrNull(pitcherSummary.csw_rate),
      avgReleaseSpeed: numberOrNull(pitcherSummary.avg_release_speed),
      avgXwoba: numberOrNull(pitcherSummary.avg_xwoba),
    },
    opponentTeam,
    sourceOpponentTeam,
    pitcherHandSplits: ((pitcherSplitsResult.data ?? []) as Row[]).map((row) => handSplit(row)).filter(Boolean),
    pitcherVsTeam: pitcherVsTeam((vsTeamResult.data as Row | null) ?? null),
    pitchTypeEdges,
    lineup,
    interpretation: {
      type: 'DESCRIPTIVE_NOT_CALIBRATED',
      whiffPressure: 'Positive descriptivePressure means pitcher and opponent tendencies both point toward more whiffs than the league baseline for that pitch type.',
      xwobaSuppression: 'Positive suppression values mean lower xwOBA than the league baseline. These are descriptive deltas, not betting probabilities.',
      sampleTier: 'HIGH requires at least 200 pitcher pitches and 300 opponent pitches of the type; MEDIUM requires 75 and 100; otherwise LOW.',
    },
  }
}
