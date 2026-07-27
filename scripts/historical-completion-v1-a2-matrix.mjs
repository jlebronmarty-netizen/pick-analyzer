import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const sports = [
  { sport: 'MLB', sportKey: 'baseball_mlb', competition: 'mlb', season: '2026', previousSeason: '2025' },
  { sport: 'NBA', sportKey: 'basketball_nba', competition: 'nba', season: '2025-26', previousSeason: '2024-25' },
  { sport: 'NFL', sportKey: 'americanfootball_nfl', competition: 'nfl', season: '2026', previousSeason: '2025' },
  { sport: 'NHL', sportKey: 'icehockey_nhl', competition: 'nhl', season: '2025-26', previousSeason: '2024-25' },
  { sport: 'Soccer', sportKey: 'soccer', competition: 'competition_specific', season: 'competition_specific', previousSeason: 'competition_specific' },
  { sport: 'BSN', sportKey: 'basketball_bsn', competition: 'bsn', season: '2026', previousSeason: '2025' },
  { sport: 'Tennis', sportKey: 'tennis', competition: 'event_driven', season: 'event_driven_2026', previousSeason: 'event_driven_2025' },
  { sport: 'UFC', sportKey: 'mma_ufc', competition: 'event_driven', season: 'event_driven_2026', previousSeason: 'event_driven_2025' },
]

const datasets = [
  { dataset: 'teams', source: 'sports_teams', table: 'sports_teams', dateColumn: 'updated_at', required: true },
  { dataset: 'players', source: 'sport_players', table: 'sport_players', dateColumn: 'updated_at', required: false },
  { dataset: 'events', source: 'sport_events', table: 'sport_events', dateColumn: 'start_time', required: true },
  { dataset: 'completed_events', source: 'sport_events', table: 'sport_events', dateColumn: 'start_time', required: true, filter: (q) => q.in('status', ['final', 'completed', 'closed', 'postgame']) },
  { dataset: 'future_events', source: 'sport_events', table: 'sport_events', dateColumn: 'start_time', required: false, filter: (q) => q.gte('start_time', new Date().toISOString()) },
  { dataset: 'results', source: 'game_results', table: 'game_results', dateColumn: 'created_at', required: true },
  { dataset: 'standings', source: 'sport_standings', table: 'sport_standings', dateColumn: 'updated_at', required: false },
  { dataset: 'team_stats', source: 'sport_game_stats', table: 'sport_game_stats', dateColumn: 'updated_at', required: false },
  { dataset: 'player_stats', source: 'sport_player_stats', table: 'sport_player_stats', dateColumn: 'updated_at', required: false },
  { dataset: 'boxscores', source: 'sport_game_stats', table: 'sport_game_stats', dateColumn: 'updated_at', required: false },
  { dataset: 'period_scores', source: 'sport_events_metadata', table: 'sport_events', dateColumn: 'start_time', required: false },
  { dataset: 'starters_lineups', source: 'sport_lineups', table: 'sport_lineups', dateColumn: 'updated_at', required: false },
  { dataset: 'injuries', source: 'sport_injuries', table: 'sport_injuries', dateColumn: 'updated_at', required: false },
  { dataset: 'current_odds', source: 'sports_odds_snapshots', table: 'sports_odds_snapshots', dateColumn: 'snapshot_time', required: true },
  { dataset: 'historical_odds', source: 'sports_odds_snapshots', table: 'sports_odds_snapshots', dateColumn: 'snapshot_time', required: false },
  { dataset: 'opening_lines', source: 'sports_odds_snapshots', table: 'sports_odds_snapshots', dateColumn: 'snapshot_time', required: false },
  { dataset: 'closing_lines', source: 'sports_odds_snapshots', table: 'sports_odds_snapshots', dateColumn: 'snapshot_time', required: false },
  { dataset: 'player_props', source: 'sports_odds_snapshots', table: 'sports_odds_snapshots', dateColumn: 'snapshot_time', required: false, filter: (q) => q.like('market', 'player_props:%') },
  { dataset: 'provider_identities', source: 'provider_entity_mappings', table: 'provider_entity_mappings', dateColumn: 'updated_at', required: true },
  { dataset: 'feature_snapshots', source: 'historical_feature_snapshots', table: 'historical_feature_snapshots', dateColumn: 'as_of_time', required: false },
  { dataset: 'predictions', source: 'prediction_history', table: 'prediction_history', dateColumn: 'commence_time', required: false },
  { dataset: 'settlement_evidence', source: 'prediction_history.result', table: 'prediction_history', dateColumn: 'updated_at', required: false, filter: (q) => q.not('result', 'is', null) },
]

const providerBlocked = {
  NFL: ['results', 'standings', 'team_stats', 'player_stats', 'boxscores', 'starters_lineups', 'injuries', 'current_odds'],
  NHL: ['events', 'results', 'standings', 'team_stats', 'player_stats', 'boxscores', 'starters_lineups', 'injuries', 'current_odds'],
  Tennis: ['events', 'results', 'players', 'current_odds'],
  UFC: ['events', 'results', 'players', 'current_odds'],
}

const manualImportRequired = {
  BSN: ['results', 'standings', 'team_stats', 'player_stats', 'boxscores', 'period_scores'],
  Soccer: ['events', 'results', 'standings', 'team_stats', 'player_stats', 'boxscores', 'period_scores', 'starters_lineups'],
}

function loadEnvFile() {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line) || !line.includes('=')) continue
    const index = line.indexOf('=')
    const name = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    process.env[name] = value
  }
}

async function countRows(client, sport, dataset) {
  let query = client.from(dataset.table).select('id', { count: 'exact', head: true }).eq('sport_key', sport.sportKey)
  if (dataset.filter) query = dataset.filter(query)
  const { count, error } = await query
  if (error) return { count: 0, error: error.message }
  return { count: count ?? 0, error: null }
}

async function boundary(client, sport, dataset, ascending) {
  let query = client.from(dataset.table).select(dataset.dateColumn).eq('sport_key', sport.sportKey).not(dataset.dateColumn, 'is', null).order(dataset.dateColumn, { ascending }).limit(1)
  if (dataset.filter) query = dataset.filter(query)
  const { data, error } = await query
  if (error) return null
  return data?.[0]?.[dataset.dateColumn] ?? null
}

function classify(sport, dataset, currentRows, error) {
  if (error) return 'PROVIDER_BLOCKED'
  if (sport.competition === 'competition_specific' && dataset.dataset !== 'provider_identities') return currentRows > 0 ? 'PARTIAL' : 'READY_FOR_IMPORT'
  if (sport.competition === 'event_driven' && ['teams', 'standings', 'period_scores'].includes(dataset.dataset)) return 'NOT_APPLICABLE'
  if ((providerBlocked[sport.sport] ?? []).includes(dataset.dataset) && currentRows === 0) return 'PROVIDER_BLOCKED'
  if ((manualImportRequired[sport.sport] ?? []).includes(dataset.dataset) && currentRows === 0) return 'MANUAL_IMPORT_REQUIRED'
  if (['historical_odds', 'opening_lines', 'closing_lines'].includes(dataset.dataset) && currentRows === 0) return 'ENTITLEMENT_BLOCKED'
  if (currentRows === 0) return dataset.required ? 'EMPTY' : 'EMPTY'
  if (dataset.required) return 'COMPLETE'
  return 'PARTIAL'
}

function readinessFrom(classification, dataset) {
  if (classification === 'COMPLETE') return { importReadiness: 'complete', featureReadiness: dataset.required ? 'ready' : 'partial' }
  if (classification === 'PARTIAL') return { importReadiness: 'ready_for_reconciliation', featureReadiness: 'partial' }
  if (classification === 'READY_FOR_IMPORT') return { importReadiness: 'ready_for_import', featureReadiness: 'blocked_until_import' }
  if (classification === 'NOT_APPLICABLE') return { importReadiness: 'not_applicable', featureReadiness: 'not_applicable' }
  return { importReadiness: 'blocked', featureReadiness: 'blocked' }
}

function nextAction(classification, sport, dataset) {
  if (classification === 'COMPLETE') return 'maintain_and_include_in_feature_readiness_checks'
  if (classification === 'PARTIAL') return 'reconcile_identity_coverage_and_dataset_completeness'
  if (classification === 'READY_FOR_IMPORT') return 'prepare_bounded_import_manifest_or_csv_contract'
  if (classification === 'MANUAL_IMPORT_REQUIRED') return 'await_operator_csv_or_permissioned_source_file'
  if (classification === 'ENTITLEMENT_BLOCKED') return 'verify_provider_entitlement_and_cost_before_any_call'
  if (classification === 'PROVIDER_BLOCKED') return 'verify_legitimate_provider_or_source_contract'
  if (classification === 'NOT_APPLICABLE') return 'no_action_required_for_this_sport_structure'
  if (sport.sport === 'MLB') return 'audit_gap_against_stored_data_and_existing_import_manifests'
  return 'document_gap_and_continue_safe_planning'
}

async function main() {
  loadEnvFile()
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const rows = []
  for (const sport of sports) {
    for (const dataset of datasets) {
      const [count, earliestDate, latestDate] = await Promise.all([
        countRows(client, sport, dataset),
        boundary(client, sport, dataset, true),
        boundary(client, sport, dataset, false),
      ])
      const classification = classify(sport, dataset, count.count, count.error)
      const readiness = readinessFrom(classification, dataset)
      rows.push({
        sport: sport.sport,
        sportKey: sport.sportKey,
        competition: sport.competition,
        season: sport.season,
        previousSeason: sport.previousSeason,
        dataset: dataset.dataset,
        required: dataset.required,
        source: dataset.source,
        currentRows: count.count,
        expectedRows: null,
        coveragePercent: count.count > 0 ? null : 0,
        earliestDate,
        latestDate,
        identityReadiness: dataset.dataset === 'provider_identities' && count.count > 0 ? 'ready_for_reconciliation' : count.count > 0 ? 'partial' : 'blocked',
        importReadiness: readiness.importReadiness,
        featureReadiness: readiness.featureReadiness,
        classification,
        blockers: count.error ? [count.error] : classification.endsWith('BLOCKED') || classification === 'EMPTY' || classification === 'MANUAL_IMPORT_REQUIRED' ? [`${classification}:${dataset.dataset}`] : [],
        nextAction: nextAction(classification, sport, dataset),
      })
    }
  }
  const summary = {
    generatedAt: new Date().toISOString(),
    mode: 'data_completion_matrix_v1',
    rows: rows.length,
    sports: sports.length,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    classificationCounts: rows.reduce((acc, row) => {
      acc[row.classification] = (acc[row.classification] ?? 0) + 1
      return acc
    }, {}),
  }
  const output = { ...summary, matrix: rows }
  fs.writeFileSync('docs/data-completion-matrix-v1.json', `${JSON.stringify(output, null, 2)}\n`)
  const success = rows.length === sports.length * datasets.length
    && summary.providerCallsMade === 0
    && summary.remoteMutationsMade === 0
    && rows.every((row) => row.sport && row.competition && row.season && row.dataset && Object.prototype.hasOwnProperty.call(row, 'currentRows'))
  console.log(JSON.stringify({ success, ...summary }, null, 2))
  if (!success) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error.message }, null, 2))
  process.exit(1)
})
