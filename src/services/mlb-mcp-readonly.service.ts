import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

function integer(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function findMlbPlayers(input: { query: string; limit?: number }) {
  const query = input.query.trim()
  const limit = Math.max(1, Math.min(20, input.limit ?? 10))
  if (!query) return []

  const escaped = query.replaceAll('%', '\\%').replaceAll('_', '\\_')
  const { data, error } = await supabaseAdmin
    .from('pick2_mlb_players')
    .select('mlbam_person_id,full_name,first_name,last_name,primary_position,bat_side,throw_side,active,first_seen_date,last_seen_date')
    .ilike('full_name', `%${escaped}%`)
    .order('active', { ascending: false })
    .order('last_seen_date', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`MLB player search failed: ${error.message}`)

  return (data ?? []).map((row) => ({
    mlbamPersonId: integer(row.mlbam_person_id),
    fullName: text(row.full_name),
    firstName: text(row.first_name),
    lastName: text(row.last_name),
    primaryPosition: text(row.primary_position),
    batSide: text(row.bat_side),
    throwSide: text(row.throw_side),
    active: row.active === true,
    firstSeenDate: text(row.first_seen_date),
    lastSeenDate: text(row.last_seen_date),
  }))
}

export async function getMlbGamesForDate(input: { date: string }) {
  const { data: games, error } = await supabaseAdmin
    .from('pick2_mlb_games')
    .select('game_pk,season,game_date,scheduled_at,home_team_id,away_team_id,game_type,official_status,doubleheader,game_number')
    .eq('game_date', input.date)
    .order('scheduled_at', { ascending: true })

  if (error) throw new Error(`MLB games read failed: ${error.message}`)
  const rows = games ?? []
  if (!rows.length) return []

  const teamIds = [...new Set(rows.flatMap((row) => [String(row.home_team_id ?? ''), String(row.away_team_id ?? '')]).filter(Boolean))]
  const gamePks = rows.map((row) => Number(row.game_pk)).filter((value) => Number.isInteger(value) && value > 0)

  const [teamResult, pitcherResult] = await Promise.all([
    supabaseAdmin.from('sports_teams').select('id,name,abbreviation').in('id', teamIds),
    supabaseAdmin.from('pick2_mlb_pitcher_daily_features').select('target_game_pk,mlbam_pitcher_id,feature_date,as_of_date').in('target_game_pk', gamePks),
  ])
  if (teamResult.error) throw new Error(`MLB team identity read failed: ${teamResult.error.message}`)
  if (pitcherResult.error) throw new Error(`MLB pregame pitcher candidate read failed: ${pitcherResult.error.message}`)

  const pitcherIds = [...new Set((pitcherResult.data ?? []).map((row) => Number(row.mlbam_pitcher_id)).filter((value) => Number.isInteger(value) && value > 0))]
  const playerResult = pitcherIds.length
    ? await supabaseAdmin.from('pick2_mlb_players').select('mlbam_person_id,full_name,throw_side').in('mlbam_person_id', pitcherIds)
    : { data: [], error: null }
  if (playerResult.error) throw new Error(`MLB pitcher identity read failed: ${playerResult.error.message}`)

  const teamById = new Map((teamResult.data ?? []).map((row) => [String(row.id), { name: text(row.name), abbreviation: text(row.abbreviation) }]))
  const playerById = new Map((playerResult.data ?? []).map((row) => [Number(row.mlbam_person_id), { fullName: text(row.full_name), throwSide: text(row.throw_side) }]))
  const pitcherByGame = new Map<number, Array<Record<string, unknown>>>()
  for (const row of pitcherResult.data ?? []) {
    const gamePk = Number(row.target_game_pk)
    const pitcherId = Number(row.mlbam_pitcher_id)
    if (!Number.isInteger(gamePk) || !Number.isInteger(pitcherId)) continue
    const values = pitcherByGame.get(gamePk) ?? []
    const identity = playerById.get(pitcherId)
    values.push({
      pitcherId,
      fullName: identity?.fullName ?? null,
      throwSide: identity?.throwSide ?? null,
      featureDate: text(row.feature_date),
      asOfDate: text(row.as_of_date),
      note: 'Pregame pitcher feature exists for this game. Team assignment is intentionally not inferred here.',
    })
    pitcherByGame.set(gamePk, values)
  }

  return rows.map((row) => {
    const homeTeam = teamById.get(String(row.home_team_id)) ?? { name: null, abbreviation: null }
    const awayTeam = teamById.get(String(row.away_team_id)) ?? { name: null, abbreviation: null }
    return {
      gamePk: integer(row.game_pk),
      season: integer(row.season),
      gameDate: text(row.game_date),
      scheduledAt: text(row.scheduled_at),
      status: text(row.official_status),
      gameType: text(row.game_type),
      doubleheader: text(row.doubleheader),
      gameNumber: integer(row.game_number),
      homeTeam: { id: text(row.home_team_id), ...homeTeam },
      awayTeam: { id: text(row.away_team_id), ...awayTeam },
      pregamePitcherCandidates: pitcherByGame.get(Number(row.game_pk)) ?? [],
    }
  })
}
