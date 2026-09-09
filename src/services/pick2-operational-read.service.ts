import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MLB_CHAMPION, mlbOperatingDate, projectMlbOperations, type StoredRow } from './pick2-operational-projection'
import { buildPick2MlbValueBoardRows, PICK2_MLB_VALUE_BOARD_POLICY_VERSION, PICK2_MLB_VALUE_BOARD_STATUSES } from './pick2-mlb-value-board.service'
import type { Pick2MlbValueBoardContract } from '@/types/pick2-value-board'

async function rows(query: PromiseLike<{ data: unknown; error: unknown }>, cap: number) {
  const { data, error } = await query
  if (error || !Array.isArray(data) || data.length > cap) throw new Error('CANONICAL_READ_UNAVAILABLE_OR_TRUNCATED')
  return data as StoredRow[]
}
export async function getMlbOperationalView(at = new Date().toISOString()) {
  const date = mlbOperatingDate(at)
  const warnings: string[] = []
  let projected = projectMlbOperations({ games: [], predictions: [], values: [], picks: [], teams: [], at })
  try {
    const games = await rows(supabaseAdmin.from('pick2_mlb_games').select('game_pk,game_date,scheduled_at,home_team_id,away_team_id,official_status,metadata,updated_at').eq('game_date', date).order('scheduled_at').limit(51), 50)
    const teams = await rows(supabaseAdmin.from('sports_teams').select('id,name').eq('sport_key', 'baseball_mlb').limit(101), 100)
    const predictions: StoredRow[] = [], values: StoredRow[] = [], picks: StoredRow[] = [], observations: StoredRow[] = []
    // Read newest evidence per game, not a global limit that silently loses
    // games as immutable refresh revisions accumulate. Bound concurrency to 5.
    for (let start = 0; start < games.length; start += 5) await Promise.all(games.slice(start, start + 5).map(async game => {
      try {
        const [latest, latestMarket] = await Promise.all([
          rows(supabaseAdmin.from('pick2_game_predictions').select('id,game_pk,predicted_at,home_probability,away_probability,metadata').eq('game_pk', game.game_pk).eq('metadata->>model_version', MLB_CHAMPION).lte('predicted_at', at).order('predicted_at', { ascending: false }).limit(2), 2),
          rows(supabaseAdmin.from('pick2_mlb_market_price_observations').select('acquired_at').eq('game_pk', game.game_pk).lte('acquired_at', at).order('acquired_at', { ascending: false }).limit(1), 1),
        ])
        if (latest.length === 2 && latest[0].predicted_at === latest[1].predicted_at) throw new Error('AMBIGUOUS_LATEST_PREDICTION')
        const [gameValues, gamePicks, gameObservations] = await Promise.all([
          latest.length ? rows(supabaseAdmin.from('pick2_mlb_market_value_evaluations').select('*').eq('prediction_id', latest[0].id).eq('game_pk', game.game_pk).limit(501), 500) : [],
          latest.length ? rows(supabaseAdmin.from('pick2_mlb_official_picks').select('id,game_pk,prediction_id,value_evaluation_id,official_pick_identity,policy_version,decision_status,decision_at').eq('prediction_id', latest[0].id).eq('game_pk', game.game_pk).limit(101), 100) : [],
          latestMarket.length ? rows(supabaseAdmin.from('pick2_mlb_market_price_observations').select('game_pk,side,market,american_odds,bookmaker_key,acquired_at,provider_last_update').eq('game_pk', game.game_pk).eq('acquired_at', latestMarket[0].acquired_at).limit(201), 200) : [],
        ])
        predictions.push(...latest.slice(0, 1)); values.push(...gameValues); picks.push(...gamePicks); observations.push(...gameObservations)
      } catch { warnings.push(`Game ${game.game_pk}: current evidence unavailable, ambiguous or exceeds the read cap.`) }
    }))
    projected = projectMlbOperations({ games, predictions, values, picks, teams, observations, at })
    if (!games.length) warnings.push('No current operating-day games are stored. A stored empty slate does not prove that MLB has no games today.')
  } catch { warnings.push('Canonical data is unavailable or exceeds the bounded read limit. No recommendation is displayed.') }
  const board: Pick2MlbValueBoardContract = { policy_version: PICK2_MLB_VALUE_BOARD_POLICY_VERSION, statuses: PICK2_MLB_VALUE_BOARD_STATUSES, rows: buildPick2MlbValueBoardRows(projected.sources), filters: { statuses: PICK2_MLB_VALUE_BOARD_STATUSES }, default_sort: { key: 'board_priority', direction: 'asc' }, publication_state: 'CANONICAL_READ_ONLY', feature_gate: 'ENABLED', model_limitation_note: 'Champion V1 has modest predictive discrimination. Official Picks are not guaranteed winners; zero picks is valid.', profitability_claim_state: 'NO_HISTORICAL_PROFITABILITY_CLAIM' }
  return { ...projected, sources: undefined, board, warnings, providerCalls: 0, productionDml: 0 }
}
