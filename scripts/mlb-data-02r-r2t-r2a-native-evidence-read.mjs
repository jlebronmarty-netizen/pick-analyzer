// Bounded READ ONLY source search. Run with the existing certification preload.
import './mlb-data-02h-2026-current-foundation.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

if (!process.env.R2S_VALIDATION_DIR) throw new Error('READ_ONLY_PRELOAD_REQUIRED')
const prior = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_DATA_02R_R2T_R2_STORED_OUTPUT_PARITY_AND_REAL_PERSISTENCE_INTEGRATION.json', 'utf8'))
const gamePks = prior.nativeFieldGapInventory.currentRows.map((row) => row.game_pk).sort((a, b) => a - b)
if (gamePks.length !== 15 || new Set(gamePks).size !== 15) throw new Error('FIXED_PRIOR_GAME_SCOPE_REQUIRED')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const report = { readStartedAt: new Date().toISOString(), gamePks, sources: {}, providerCalls: 0, productionDml: 0, productionDdl: 0 }

async function read(name, query, cap) {
  const { data, error, count } = await query.limit(cap)
  if (error) return { status: 'READ_ERROR', code: error.code ?? 'NETWORK', count: null, rows: [] }
  if (!Number.isInteger(count) || count > data.length || data.length >= cap) return { status: 'TRUNCATED', count, rows: data, cap }
  return { name, status: data.length ? 'FOUND' : 'EMPTY', count, rows: data, digest: sha256(data), cap }
}
const scoped = (table, key, fields = '*') => db.from(table).select(fields, { count: 'exact' }).in(key, gamePks)
const queries = [
  ['native', scoped('pick2_mlb_games', 'game_pk'), 101],
  ['raw', scoped('pick2_raw_mlb_statcast_pitches', 'game_pk', 'id,game_pk,game_date,game_type,canonical_home_team_id,canonical_away_team_id,mlbam_pitcher_id,mlbam_batter_id,raw_payload_digest,ingested_at,created_at'), 1001],
  ['snapshots', scoped('pick2_feature_snapshots', 'target_game_pk'), 1001],
  ...Object.entries({ team: 'team', starter: 'pitcher', bullpen: 'bullpen', batter: 'batter', matchup: 'matchup', firstInning: 'first_inning' })
    .map(([key, domain]) => [key, scoped(`pick2_mlb_${domain}_daily_features`, 'target_game_pk'), 1001]),
  ['marketMappings', scoped('pick2_mlb_market_event_mappings', 'game_pk'), 1001],
  ['predictions', scoped('pick2_game_predictions', 'game_pk'), 1001],
  ['results', scoped('pick2_mlb_game_results', 'game_pk'), 101],
  ['pitcherRollups', scoped('mlb_statcast_pitcher_game_logs', 'game_pk'), 1001],
  ['batterRollups', scoped('mlb_statcast_batter_game_logs', 'game_pk'), 1001],
  ['teamCrosswalks', db.from('provider_entity_mappings').select('*', { count: 'exact' }).eq('sport_key', 'baseball_mlb').eq('entity_type', 'team'), 1001],
  ['canonicalTeams', db.from('sports_teams').select('id,name,abbreviation,provider_ids,metadata,created_at,updated_at', { count: 'exact' }).eq('sport_key', 'baseball_mlb'), 1001],
  ['eventCrosswalks', db.from('provider_entity_mappings').select('*', { count: 'exact' }).eq('sport_key', 'baseball_mlb').in('entity_type', ['event', 'game']).in('provider_id', gamePks.map(String)), 1001],
  ['exactEvents', db.from('sport_events').select('*', { count: 'exact' }).eq('sport_key', 'baseball_mlb').or([
    `provider_ids->>mlb_stats_api.in.(${gamePks.join(',')})`,
    `provider_ids->>mlb_stats_game_pk.in.(${gamePks.join(',')})`,
    `metadata->>game_pk.in.(${gamePks.join(',')})`,
    `id.in.(${gamePks.map((pk) => `baseball_mlb:mlb:mlb_stats_api:game:${pk}`).join(',')})`,
  ].join(',')), 1001],
  // Search the stored slate window for additional provider-id bag shapes. A
  // date/team match is a search candidate, never an authoritative game edge.
  ['eventWindow', db.from('sport_events').select('*', { count: 'exact' }).eq('sport_key', 'baseball_mlb')
    .gte('start_time', '2026-09-08T00:00:00Z').lt('start_time', '2026-09-10T00:00:00Z'), 1001],
  ['contextWindow', db.from('mlb_context_snapshots').select('*', { count: 'exact' }).eq('sport_key', 'baseball_mlb')
    .gte('target_event_start_time', '2026-09-08T00:00:00Z').lt('target_event_start_time', '2026-09-10T00:00:00Z'), 1001],
]

for (let i = 0; i < queries.length; i += 4) {
  const batch = queries.slice(i, i + 4)
  const results = await Promise.allSettled(batch.map(([name, query, cap]) => read(name, query, cap)))
  for (const [index, result] of results.entries()) {
    const name = batch[index][0]
    report.sources[name] = result.status === 'fulfilled' ? result.value : { status: 'READ_ERROR', code: 'EXCEPTION', rows: [] }
    console.log(JSON.stringify({ source: name, status: report.sources[name].status, count: report.sources[name].count, code: report.sources[name].code }))
  }
}
function exactGameIds(bag) {
  if (!bag || typeof bag !== 'object') return []
  return Object.entries(bag).flatMap(([key, value]) => {
    if (value && typeof value === 'object') return exactGameIds(value)
    return ['mlb_stats_api', 'mlb_stats_game_pk', 'gamePk', 'game_pk', 'mlb_game_pk', 'officialGamePk'].includes(key) && gamePks.includes(Number(value)) ? [Number(value)] : []
  })
}
const exactWindowRows = report.sources.eventWindow.rows.filter((row) => [...exactGameIds(row.provider_ids), ...exactGameIds(row.metadata)].length > 0)
report.exactWindowMatches = exactWindowRows.map((row) => ({ id: row.id, gamePks: [...exactGameIds(row.provider_ids), ...exactGameIds(row.metadata)] }))
const exactContexts = report.sources.contextWindow.rows.filter((row) => exactGameIds(row.components).length > 0)
report.exactContextMatches = exactContexts.map((row) => ({ id: row.id, eventId: row.event_id, gamePks: exactGameIds(row.components) }))
const eventIds = [...new Set([...(report.sources.exactEvents.rows ?? []).map((r) => r.id), ...exactWindowRows.map((row) => row.id), ...exactContexts.map((row) => row.event_id), ...(report.sources.eventCrosswalks.rows ?? []).filter((r) => ['mlb_stats_api', 'mlb_official'].includes(r.provider)).map((r) => r.internal_id)])]
if (eventIds.length) {
  for (const table of ['mlb_context_snapshots', 'mlb_starter_assignments', 'sport_lineups']) {
    report.sources[table] = await read(table, db.from(table).select('*', { count: 'exact' }).in('event_id', eventIds), 1001)
  }
} else report.eventDependentSearch = 'NO_EXACT_GAME_PK_EVENT_EDGE: context/starter/lineup rows cannot establish same-game linkage; no fuzzy team/date match used'
report.readCompletedAt = new Date().toISOString()
fs.writeFileSync(path.join(process.env.R2S_VALIDATION_DIR, 'native-source-search.json'), JSON.stringify(report, null, 2) + '\n')
if (Object.values(report.sources).some((s) => ['READ_ERROR', 'TRUNCATED'].includes(s.status))) process.exitCode = 1
