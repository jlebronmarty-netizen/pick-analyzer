import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MLB_CHAMPION, mlbOperatingDate, projectMlbOperations, type StoredRow, type MlbReadInput } from './pick2-operational-projection'
import { readObservedMlbSchedule } from './pick2-mlb-observed-evidence.service'
import { buildPick2MlbValueBoardRows, PICK2_MLB_VALUE_BOARD_POLICY_VERSION, PICK2_MLB_VALUE_BOARD_STATUSES } from './pick2-mlb-value-board.service'
import type { Pick2MlbValueBoardContract } from '@/types/pick2-value-board'

async function rows(query: PromiseLike<{ data: unknown; error: unknown }>, cap: number) {
  const { data, error } = await query
  if (error || !Array.isArray(data) || data.length > cap) throw new Error('CANONICAL_READ_UNAVAILABLE_OR_TRUNCATED')
  return data as StoredRow[]
}
export async function readMlbOperationalInputs(at = new Date().toISOString()) {
  const date = mlbOperatingDate(at), warnings: string[] = []
  const input: MlbReadInput = { at, games: [], teams: [], predictions: [], values: [], picks: [], observations: [], mappings: [], schedules: [] }
  try {
    const [games, teams, schedules] = await Promise.all([
      rows(supabaseAdmin.from('pick2_mlb_games').select('game_pk,game_date,scheduled_at,home_team_id,away_team_id,official_status,metadata').eq('game_date', date).order('scheduled_at').order('game_pk').limit(51), 50),
      rows(supabaseAdmin.from('sports_teams').select('id,name').eq('sport_key', 'baseball_mlb').limit(101), 100),
      readObservedMlbSchedule(date, at).catch(() => { input.evidenceUnavailable = true; warnings.push('Verified schedule evidence is unavailable; current actionability is blocked.'); return [] }),
    ])
    input.games = games; input.teams = teams; input.schedules = schedules
    for (let start = 0; start < games.length; start += 5) await Promise.all(games.slice(start, start + 5).map(async game => {
      try {
        const [latest, latestMarket, mappings] = await Promise.all([
          rows(supabaseAdmin.from('pick2_game_predictions').select('id,deterministic_identity,game_pk,predicted_at,created_at,home_probability,away_probability,metadata').eq('game_pk', game.game_pk).eq('metadata->>model_version', MLB_CHAMPION).lte('predicted_at', at).lte('created_at', at).order('predicted_at', { ascending: false }).order('deterministic_identity').limit(2), 2),
          rows(supabaseAdmin.from('pick2_mlb_market_price_observations').select('acquired_at').eq('game_pk', game.game_pk).lte('acquired_at', at).lte('created_at', at).order('acquired_at', { ascending: false }).order('observation_identity').limit(1), 1),
          rows(supabaseAdmin.from('pick2_mlb_market_event_mappings').select('id,game_pk,provider_event_id,market_provider,matched_at,created_at').eq('game_pk', game.game_pk).lte('matched_at', at).lte('created_at', at).order('matched_at', { ascending: false }).order('id').limit(11), 10),
        ])
        const [values, picks, observations]: [StoredRow[], StoredRow[], StoredRow[]] = await Promise.all([
          latest.length ? rows(supabaseAdmin.from('pick2_mlb_market_value_evaluations').select('*').eq('prediction_id', latest[0].id).eq('game_pk', game.game_pk).lte('evaluated_at', at).lte('created_at', at).order('evaluated_at', { ascending: false }).order('value_identity').limit(501), 500) : [],
          latest.length ? rows(supabaseAdmin.from('pick2_mlb_official_picks').select('id,game_pk,prediction_id,value_evaluation_id,official_pick_identity,policy_version,decision_status,decision_at,created_at').eq('prediction_id', latest[0].id).eq('game_pk', game.game_pk).lte('decision_at', at).lte('created_at', at).order('decision_at', { ascending: false }).order('official_pick_identity').limit(101), 100) : [],
          latestMarket.length ? rows(supabaseAdmin.from('pick2_mlb_market_price_observations').select('*').eq('game_pk', game.game_pk).eq('acquired_at', latestMarket[0].acquired_at).lte('created_at', at).order('observation_identity').limit(201), 200) : [],
        ])
        // Retain referenced historical observations for linkage validation. They
        // cannot displace the newest market acquisition in the projection.
        const missing = [...new Set(values.flatMap(v => [v.home_market_observation_id, v.away_market_observation_id]).filter(id => typeof id === 'string' && !observations.some(o => o.id === id)))]
        for (let offset = 0; offset < missing.length; offset += 100) observations.push(...await rows(supabaseAdmin.from('pick2_mlb_market_price_observations').select('*').eq('game_pk', game.game_pk).in('id', missing.slice(offset, offset + 100)).lte('created_at', at).limit(101), 100))
        input.predictions.push(...latest.slice(0, 1)); input.values.push(...values); input.picks.push(...picks); input.observations!.push(...observations); input.mappings!.push(...mappings)
      } catch { warnings.push('Game ' + game.game_pk + ': canonical evidence unavailable or exceeds the bounded read cap.') }
    }))
    if (!games.length) warnings.push('No current operating-day games are stored. A stored empty slate does not prove that MLB has no games today.')
  } catch { warnings.push('Canonical data is unavailable or exceeds the bounded read limit. No recommendation is displayed.') }
  return { input, warnings }
}
export async function getMlbOperationalView(at = new Date().toISOString()) {
  const { input, warnings } = await readMlbOperationalInputs(at)
  const projected = projectMlbOperations(input)
  const board: Pick2MlbValueBoardContract = { policy_version: PICK2_MLB_VALUE_BOARD_POLICY_VERSION, statuses: PICK2_MLB_VALUE_BOARD_STATUSES, rows: buildPick2MlbValueBoardRows(projected.sources), filters: { statuses: PICK2_MLB_VALUE_BOARD_STATUSES }, default_sort: { key: 'board_priority', direction: 'asc' }, publication_state: 'CANONICAL_READ_ONLY', feature_gate: 'ENABLED', model_limitation_note: 'Champion V1 has modest predictive discrimination. Official Picks are not guaranteed winners; zero picks is valid.', profitability_claim_state: 'NO_HISTORICAL_PROFITABILITY_CLAIM' }
  return { ...projected, sources: undefined, board, warnings, providerCalls: 0, productionDml: 0 }
}
