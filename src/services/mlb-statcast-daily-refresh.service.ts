import 'server-only'

import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

const TIME_ZONE = 'America/Puerto_Rico'
const SEASON = 2026
const STATCAST_SOURCE_VERSION = 'baseball-savant-statcast-2026-current-02h'
const RAW_TABLE = 'pick2_raw_mlb_statcast_pitches'
const INSERT_BATCH_SIZE = 100
const MAX_SCAN_DAYS = 14

const sourceToRaw: Record<string, string> = {
  game_pk: 'game_pk', game_date: 'game_date', game_year: 'game_year', game_type: 'game_type',
  home_team: 'source_home_team', away_team: 'source_away_team', pitcher: 'source_pitcher_id', batter: 'source_batter_id', player_name: 'source_player_name',
  pitch_type: 'pitch_type', pitch_name: 'pitch_name', type: 'type', release_speed: 'release_speed', effective_speed: 'effective_speed',
  release_spin_rate: 'release_spin_rate', spin_axis: 'spin_axis', release_extension: 'release_extension', release_pos_x: 'release_pos_x',
  release_pos_y: 'release_pos_y', release_pos_z: 'release_pos_z', arm_angle: 'arm_angle', p_throws: 'p_throws', stand: 'stand',
  balls: 'balls', strikes: 'strikes', outs_when_up: 'outs_when_up', home_score: 'home_score', away_score: 'away_score', bat_score: 'bat_score',
  fld_score: 'fld_score', post_home_score: 'post_home_score', post_away_score: 'post_away_score', post_bat_score: 'post_bat_score', post_fld_score: 'post_fld_score',
  events: 'events', description: 'description', inning: 'inning', inning_topbot: 'inning_topbot', pfx_x: 'pfx_x', pfx_z: 'pfx_z',
  plate_x: 'plate_x', plate_z: 'plate_z', zone: 'zone', vx0: 'vx0', vy0: 'vy0', vz0: 'vz0', ax: 'ax', ay: 'ay', az: 'az',
  api_break_z_with_gravity: 'api_break_z_with_gravity', api_break_x_arm: 'api_break_x_arm', api_break_x_batter_in: 'api_break_x_batter_in',
  launch_speed: 'launch_speed', launch_angle: 'launch_angle', estimated_ba_using_speedangle: 'estimated_ba_using_speedangle',
  estimated_woba_using_speedangle: 'estimated_woba_using_speedangle', estimated_slg_using_speedangle: 'estimated_slg_using_speedangle',
  launch_speed_angle: 'launch_speed_angle', hit_distance_sc: 'hit_distance_sc', bb_type: 'bb_type', hit_location: 'hit_location', hc_x: 'hc_x', hc_y: 'hc_y',
  bat_speed: 'bat_speed', swing_length: 'swing_length', attack_angle: 'attack_angle', attack_direction: 'attack_direction', swing_path_tilt: 'swing_path_tilt',
  at_bat_number: 'at_bat_number', pitch_number: 'pitch_number',
}

const integerFields = new Set([
  'game_pk','game_year','source_pitcher_id','source_batter_id','balls','strikes','outs_when_up','home_score','away_score','bat_score','fld_score',
  'post_home_score','post_away_score','post_bat_score','post_fld_score','inning','zone','launch_speed_angle','hit_location','at_bat_number','pitch_number',
])
const numericFields = new Set([
  'release_speed','effective_speed','release_spin_rate','spin_axis','release_extension','release_pos_x','release_pos_y','release_pos_z','arm_angle','pfx_x','pfx_z',
  'plate_x','plate_z','vx0','vy0','vz0','ax','ay','az','api_break_z_with_gravity','api_break_x_arm','api_break_x_batter_in','launch_speed','launch_angle',
  'estimated_ba_using_speedangle','estimated_woba_using_speedangle','estimated_slg_using_speedangle','hit_distance_sc','hc_x','hc_y','bat_speed','swing_length',
  'attack_angle','attack_direction','swing_path_tilt',
])

type CsvRow = Record<string, string>
type RawRow = Record<string, unknown> & { id: string; game_pk: number; game_date: string; raw_payload_digest: string }
type ScheduleGame = { gamePk?: number; status?: { abstractGameState?: string; detailedState?: string; codedGameState?: string } }

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function dateInTimeZone(date: Date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function validDate(value: string) {
  return /^2026-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
}

function yesterdayPuertoRico() {
  return addDays(dateInTimeZone(new Date()), -1)
}

function parseCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') { current += '"'; index += 1 } else inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) { values.push(current); current = '' } else current += char
  }
  values.push(current)
  return values
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

function normalizeValue(value: unknown, destination: string) {
  if (value === '' || value == null) return null
  if (integerFields.has(destination)) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null
  }
  if (numericFields.has(destination)) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return value
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function rowIdentity(row: CsvRow) {
  return `statcast:mlb:${SEASON}:${row.game_pk}:${row.at_bat_number}:${row.pitch_number}`
}

function transformRow(row: CsvRow, teamMap: Map<string, string>): RawRow | null {
  if (!row.game_pk || !row.at_bat_number || !row.pitch_number) return null
  const rawPayload = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === '' ? null : value]))
  const transformed: Record<string, unknown> = {
    id: rowIdentity(row), pick2_era: 'PICK_2_ERA_V1', source: 'statcast', source_version: STATCAST_SOURCE_VERSION,
    event_id: null, event_mapping_state: 'UNMAPPED', canonical_pitcher_id: null, canonical_batter_id: null, player_mapping_state: 'MAPPED',
    raw_payload: rawPayload, raw_payload_digest: sha256(JSON.stringify(rawPayload)),
    mlbam_pitcher_id: normalizeValue(row.pitcher, 'source_pitcher_id'), mlbam_batter_id: normalizeValue(row.batter, 'source_batter_id'),
    mapping_metadata: { phase: 'MLB_DATA_02H_DAILY_V1', source: 'baseball_savant_statcast_search_csv', source_version: STATCAST_SOURCE_VERSION, canonicalMapping: 'native_game_pk_and_mlbam_person_id' },
  }
  for (const [sourceColumn, destination] of Object.entries(sourceToRaw)) transformed[destination] = normalizeValue(row[sourceColumn], destination)
  transformed.canonical_home_team_id = teamMap.get(String(row.home_team ?? '').toUpperCase()) ?? null
  transformed.canonical_away_team_id = teamMap.get(String(row.away_team ?? '').toUpperCase()) ?? null
  return transformed as RawRow
}

async function fetchText(url: string) {
  let lastStatus = 0
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, { cache: 'no-store' })
    lastStatus = response.status
    if (response.ok) return response.text()
    if (![429, 500, 502, 503, 504].includes(response.status)) break
    await new Promise((resolve) => setTimeout(resolve, attempt * 2500))
  }
  throw new Error(`STATCAST_FETCH_HTTP_${lastStatus}`)
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`MLB_SCHEDULE_HTTP_${response.status}`)
  return response.json() as Promise<Record<string, unknown>>
}

function statcastUrl(date: string) {
  const params = new URLSearchParams({
    all: 'true', hfPT: '', hfAB: '', hfGT: 'R|PO|', hfPR: '', hfZ: '', stadium: '', hfBBL: '', hfNewZones: '', hfPull: '', hfC: '', hfSea: `${SEASON}|`, hfSit: '',
    player_type: 'pitcher', hfOuts: '', opponent: '', pitcher_throws: '', batter_stands: '', hfSA: '', game_date_gt: date, game_date_lt: date, hfInfield: '', team: '', position: '',
    hfOutfield: '', hfRO: '', home_road: '', hfFlag: '', hfBBT: '', metric_1: '', hfInn: '', min_pitches: '0', min_results: '0', group_by: 'name', sort_col: 'pitches',
    player_event_sort: 'h_launch_speed', sort_order: 'desc', min_pas: '0', type: 'details',
  })
  return `https://baseballsavant.mlb.com/statcast_search/csv?${params}`
}

async function teamMap() {
  const { data, error } = await supabaseAdmin.from('sports_teams').select('id,abbreviation,metadata').eq('sport_key', 'baseball_mlb')
  if (error) throw new Error(`TEAM_MAP_READ_FAILED:${error.message}`)
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {}
    for (const value of [row.abbreviation, metadata.mlb_abbreviation, metadata.abbreviation]) if (value) map.set(String(value).toUpperCase(), String(row.id))
  }
  if (map.has('ARI')) map.set('AZ', map.get('ARI')!)
  if (map.has('CHW')) map.set('CWS', map.get('CHW')!)
  ensure(map.size >= 30, 'TEAM_MAP_INCOMPLETE')
  return map
}

async function scheduleForDate(date: string) {
  const json = await fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`)
  const dates = Array.isArray(json.dates) ? json.dates as Array<Record<string, unknown>> : []
  const games = (dates.flatMap((entry) => Array.isArray(entry.games) ? entry.games : []) as ScheduleGame[])
  const finalGames: number[] = []
  const blocking: Array<{ gamePk: number | null; state: string }> = []
  let terminalNoPlay = 0
  for (const game of games) {
    const state = String(game.status?.detailedState ?? game.status?.abstractGameState ?? '')
    const normalized = state.toLowerCase()
    const gamePk = Number(game.gamePk)
    if (game.status?.abstractGameState === 'Final' || game.status?.codedGameState === 'F' || normalized.includes('final')) {
      if (Number.isFinite(gamePk)) finalGames.push(gamePk)
    } else if (normalized.includes('postpon') || normalized.includes('cancel')) terminalNoPlay += 1
    else blocking.push({ gamePk: Number.isFinite(gamePk) ? gamePk : null, state })
  }
  return { games: games.length, finalGames: [...new Set(finalGames)].sort((a,b) => a-b), terminalNoPlay, blocking }
}

async function latestRawDate() {
  const { data, error } = await supabaseAdmin.from(RAW_TABLE).select('game_date').eq('game_year', SEASON).order('game_date', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(`LATEST_RAW_DATE_READ_FAILED:${error.message}`)
  return data?.game_date ? String(data.game_date) : null
}

async function resolveAutomaticDate() {
  const yesterday = yesterdayPuertoRico()
  const latest = await latestRawDate()
  let candidate = latest ? addDays(latest, 1) : `${SEASON}-03-01`
  for (let scanned = 0; scanned < MAX_SCAN_DAYS && candidate <= yesterday; scanned += 1) {
    const schedule = await scheduleForDate(candidate)
    if (schedule.blocking.length) return { date: candidate, schedule, reason: 'OLDEST_UNRESOLVED_DATE' as const }
    if (schedule.finalGames.length) return { date: candidate, schedule, reason: 'OLDEST_MISSING_GAME_DATE' as const }
    candidate = addDays(candidate, 1)
  }
  return { date: null, schedule: null, reason: latest && latest >= yesterday ? 'ALREADY_CURRENT' as const : 'NO_GAME_DATE_IN_SCAN_WINDOW' as const }
}

async function existingRowsForDate(date: string) {
  const rows: Array<{ id: string; game_pk: number; raw_payload_digest: string }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from(RAW_TABLE).select('id,game_pk,raw_payload_digest').eq('game_date', date).range(from, from + 999)
    if (error) throw new Error(`EXISTING_RAW_READ_FAILED:${error.message}`)
    rows.push(...((data ?? []) as Array<{ id: string; game_pk: number; raw_payload_digest: string }>))
    if (!data || data.length < 1000) break
  }
  return rows
}

async function insertRows(rows: RawRow[]) {
  let inserted = 0
  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    const chunk = rows.slice(index, index + INSERT_BATCH_SIZE)
    const { error } = await supabaseAdmin.from(RAW_TABLE).insert(chunk)
    if (error) throw new Error(`RAW_INSERT_FAILED_AT_${index}:${error.message}`)
    inserted += chunk.length
  }
  return inserted
}

async function refreshAnalytics() {
  const global = await supabaseAdmin.rpc('refresh_mlb_statcast_all_analytics')
  if (global.error) throw new Error(`STATCAST_ANALYTICS_REFRESH_FAILED:${global.error.message}`)
  const props = await supabaseAdmin.rpc('refresh_mlb_pitcher_prop_research_rollups')
  if (props.error) throw new Error(`PITCHER_PROP_RESEARCH_REFRESH_FAILED:${props.error.message}`)
}

async function coverage() {
  const { data, error } = await supabaseAdmin.from('mlb_statcast_coverage_v').select('season,first_game_date,last_game_date,pitches,games,batting_teams').eq('season', SEASON).maybeSingle()
  if (error) throw new Error(`COVERAGE_READ_FAILED:${error.message}`)
  return data
}

export async function refreshMlbStatcastDaily(input: { date?: string | null } = {}) {
  const startedAt = new Date().toISOString()
  let targetDate: string | null = null
  let schedule: Awaited<ReturnType<typeof scheduleForDate>> | null = null
  let resolutionReason = 'EXPLICIT_DATE'

  if (input.date) {
    ensure(validDate(input.date), 'INVALID_TARGET_DATE')
    targetDate = input.date
    schedule = await scheduleForDate(targetDate)
  } else {
    const resolved = await resolveAutomaticDate()
    targetDate = resolved.date
    schedule = resolved.schedule
    resolutionReason = resolved.reason
  }

  if (!targetDate || !schedule) {
    return { success: true, status: 'NO_OP', reason: resolutionReason, targetDate: null, startedAt, completedAt: new Date().toISOString(), providerCalls: 0, officialPickWrites: 0, coverage: await coverage() }
  }
  if (schedule.blocking.length) {
    return { success: false, status: 'BLOCKED_SCHEDULE_NOT_FINAL', targetDate, resolutionReason, schedule, startedAt, completedAt: new Date().toISOString(), providerCalls: 0, officialPickWrites: 0 }
  }
  if (!schedule.finalGames.length) {
    return { success: true, status: 'NO_OP_NO_COMPLETED_GAMES', targetDate, resolutionReason, schedule, startedAt, completedAt: new Date().toISOString(), providerCalls: 0, officialPickWrites: 0 }
  }

  const teams = await teamMap()
  const csvText = await fetchText(statcastUrl(targetDate))
  const parsed = parseCsv(csvText)
  ensure(parsed.length < 25000, `STATCAST_DAILY_CAP_SUSPECT:${targetDate}:${parsed.length}`)
  const sourceRows = parsed.map((row) => transformRow(row, teams)).filter((row): row is RawRow => Boolean(row))
  ensure(sourceRows.length > 0, `STATCAST_EMPTY_FOR_FINAL_SCHEDULE:${targetDate}`)
  const sourceIds = sourceRows.map((row) => row.id)
  ensure(new Set(sourceIds).size === sourceIds.length, `STATCAST_SOURCE_DUPLICATE_IDENTITIES:${targetDate}`)
  ensure(sourceRows.every((row) => row.game_date === targetDate), `STATCAST_SOURCE_WRONG_DATE:${targetDate}`)
  ensure(sourceRows.every((row) => row.canonical_home_team_id && row.canonical_away_team_id), `STATCAST_TEAM_MAPPING_MISSING:${targetDate}`)
  ensure(sourceRows.every((row) => row.mlbam_pitcher_id && row.mlbam_batter_id), `STATCAST_PLAYER_ID_MISSING:${targetDate}`)

  const sourceGames = [...new Set(sourceRows.map((row) => Number(row.game_pk)))].sort((a,b) => a-b)
  ensure(JSON.stringify(sourceGames) === JSON.stringify(schedule.finalGames), `STATCAST_GAME_COVERAGE_MISMATCH:${targetDate}`)

  const existingRows = await existingRowsForDate(targetDate)
  const existing = new Map(existingRows.map((row) => [String(row.id), String(row.raw_payload_digest)]))
  const source = new Map(sourceRows.map((row) => [row.id, row.raw_payload_digest]))
  const unexpected = existingRows.filter((row) => !source.has(String(row.id)))
  let reuses = 0
  let conflicts = 0
  const missing: RawRow[] = []
  for (const row of sourceRows) {
    const digest = existing.get(row.id)
    if (!digest) missing.push(row)
    else if (digest === row.raw_payload_digest) reuses += 1
    else conflicts += 1
  }

  if (conflicts || unexpected.length) {
    return {
      success: false, status: 'BLOCK_CONFLICT', targetDate, resolutionReason, sourceRows: sourceRows.length, sourceGames: sourceGames.length,
      inserts: missing.length, reuses, conflicts, unexpectedExisting: unexpected.length, startedAt, completedAt: new Date().toISOString(),
      providerCalls: 1, officialPickWrites: 0,
    }
  }

  const inserted = await insertRows(missing)
  const readback = await existingRowsForDate(targetDate)
  const readbackMap = new Map(readback.map((row) => [String(row.id), String(row.raw_payload_digest)]))
  const readbackConflicts = sourceRows.filter((row) => readbackMap.get(row.id) !== row.raw_payload_digest).length
  ensure(readback.length === sourceRows.length, `STATCAST_READBACK_COUNT_MISMATCH:${targetDate}:${readback.length}:${sourceRows.length}`)
  ensure(readbackConflicts === 0, `STATCAST_READBACK_DIGEST_MISMATCH:${targetDate}:${readbackConflicts}`)
  ensure(new Set(readback.map((row) => `${row.game_pk}:${row.id}`)).size === readback.length, `STATCAST_READBACK_DUPLICATE:${targetDate}`)

  await refreshAnalytics()
  const finalCoverage = await coverage()
  return {
    success: true,
    status: inserted > 0 ? 'SUCCESS_INSERTED' : 'SUCCESS_REUSE_NO_OP',
    targetDate,
    resolutionReason,
    schedule: { games: schedule.games, finalGames: schedule.finalGames.length, terminalNoPlay: schedule.terminalNoPlay },
    sourceRows: sourceRows.length,
    sourceGames: sourceGames.length,
    inserted,
    reuses,
    conflicts: 0,
    unexpectedExisting: 0,
    analyticsRefreshed: true,
    coverage: finalCoverage,
    startedAt,
    completedAt: new Date().toISOString(),
    providerCalls: 1,
    sportsbookProviderCalls: 0,
    officialPickWrites: 0,
    identityContract: 'game_pk + at_bat_number + pitch_number',
    sourceVersion: STATCAST_SOURCE_VERSION,
  }
}
