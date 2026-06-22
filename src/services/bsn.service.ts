import { supabaseAdmin } from '@/lib/supabase-admin'

export type BsnGameInput = {
  commence_time: string
  home_team: string
  away_team: string
}

export type BsnResultInput = {
  game_id: string
  commence_time: string
  home_team: string
  away_team: string
  home_score: number
  away_score: number
}

function normalizeGameId(homeTeam: string, awayTeam: string, commenceTime: string) {
  const dateKey = new Date(commenceTime).toISOString().slice(0, 10)

  return `bsn_${dateKey}_${homeTeam}_${awayTeam}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export async function getBsnTeams() {
  const { data, error } = await supabaseAdmin
    .from('bsn_teams')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return {
    success: true,
    teams: data ?? [],
  }
}

export async function getBsnGames() {
  const { data, error } = await supabaseAdmin
    .from('bsn_games')
    .select('*')
    .order('commence_time', { ascending: true })

  if (error) throw new Error(error.message)

  return {
    success: true,
    games: data ?? [],
  }
}

export async function createBsnGames(games: BsnGameInput[]) {
  const rows = games.map((game) => ({
    game_id: normalizeGameId(
      game.home_team,
      game.away_team,
      game.commence_time
    ),
    sport_key: 'basketball_bsn',
    commence_time: game.commence_time,
    home_team: game.home_team,
    away_team: game.away_team,
    status: 'scheduled',
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabaseAdmin
    .from('bsn_games')
    .upsert(rows, { onConflict: 'game_id' })
    .select('*')

  if (error) throw new Error(error.message)

  return {
    success: true,
    inserted: data?.length ?? 0,
    games: data ?? [],
  }
}

export async function getBsnResults() {
  const { data, error } = await supabaseAdmin
    .from('bsn_results')
    .select('*')
    .order('commence_time', { ascending: false })

  if (error) throw new Error(error.message)

  return {
    success: true,
    results: data ?? [],
  }
}

export async function createBsnResults(results: BsnResultInput[]) {
  const rows = results.map((result) => ({
    game_id: result.game_id,
    sport_key: 'basketball_bsn',
    commence_time: result.commence_time,
    home_team: result.home_team,
    away_team: result.away_team,
    home_score: result.home_score,
    away_score: result.away_score,
    status: 'final',
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabaseAdmin
    .from('bsn_results')
    .upsert(rows, { onConflict: 'game_id' })
    .select('*')

  if (error) throw new Error(error.message)

  return {
    success: true,
    inserted: data?.length ?? 0,
    results: data ?? [],
  }
}

export async function syncBsnResultsToGameResults() {
  const { data: bsnResults, error: bsnError } = await supabaseAdmin
    .from('bsn_results')
    .select('*')

  if (bsnError) throw new Error(bsnError.message)

  const rows = (bsnResults ?? []).map((result) => ({
    game_id: result.game_id,
    sport_key: 'basketball_bsn',
    commence_time: result.commence_time,
    home_team: result.home_team,
    away_team: result.away_team,
    home_score: result.home_score,
    away_score: result.away_score,
  }))

  if (rows.length === 0) {
    return {
      success: true,
      synced: 0,
    }
  }

  const { data, error } = await supabaseAdmin
    .from('game_results')
    .upsert(rows, { onConflict: 'game_id' })
    .select('*')

  if (error) throw new Error(error.message)

  return {
    success: true,
    synced: data?.length ?? 0,
  }
}