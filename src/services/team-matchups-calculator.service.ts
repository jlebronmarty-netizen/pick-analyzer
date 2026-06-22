import { supabaseAdmin } from '@/lib/supabase-admin'

function normalizePair(teamA: string, teamB: string) {
  return [teamA, teamB].sort()
}

export async function recalculateHeadToHead(sportKey: string) {
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('*')
    .eq('sport_key', sportKey)
    .not('winner', 'is', null)

  if (error) throw new Error(error.message)

  const map = new Map<string, any>()

  for (const game of data ?? []) {
    const [teamA, teamB] = normalizePair(game.home_team, game.away_team)
    const key = `${sportKey}:${teamA}:${teamB}`

    if (!map.has(key)) {
      map.set(key, {
        sport_key: sportKey,
        team_a: teamA,
        team_b: teamB,
        team_a_wins: 0,
        team_b_wins: 0,
        games_played: 0,
        last_game_at: game.commence_time,
        updated_at: new Date().toISOString(),
      })
    }

    const row = map.get(key)

    row.games_played++

    if (game.winner === teamA) row.team_a_wins++
    if (game.winner === teamB) row.team_b_wins++

    if (new Date(game.commence_time) > new Date(row.last_game_at)) {
      row.last_game_at = game.commence_time
    }
  }

  const rows = [...map.values()]

  if (!rows.length) {
    return {
      success: true,
      updated: 0,
    }
  }

  const { error: upsertError } = await supabaseAdmin
    .from('team_matchups')
    .upsert(rows, {
      onConflict: 'sport_key,team_a,team_b',
    })

  if (upsertError) throw new Error(upsertError.message)

  return {
    success: true,
    updated: rows.length,
  }
}