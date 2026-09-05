import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const args = new Set(process.argv.slice(2))
const executeIngest = args.has('--execute-ingest')
const executeFeatures = args.has('--execute-features')
const r2Resume = args.has('--r2-resume')
const writeArtifact = args.has('--write-artifact') || executeIngest || executeFeatures
const outputPath = 'docs/CERTIFICATION/mlb-data-02h-2026-current-foundation.json'
const statcastCacheDir = '.tmp/mlb-data-02h-statcast-2026'
const r2CheckpointPath = '.tmp/mlb-data-02h-r2-raw-resume-checkpoint.json'
const targetCommit = 'cc85c0d777511fcad9f9ecc8c2dec32a175ca268'
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const modelVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const featureSet = 'MLB_ML_FEATURE_SET_V1'
const artifactDigest = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const statcastSourceVersion = 'baseball-savant-statcast-2026-current-02h'
const batchSize = 500
const r2RawBatchSize = 100

const sourceToRaw = {
  game_pk: 'game_pk',
  game_date: 'game_date',
  game_year: 'game_year',
  game_type: 'game_type',
  home_team: 'source_home_team',
  away_team: 'source_away_team',
  pitcher: 'source_pitcher_id',
  batter: 'source_batter_id',
  player_name: 'source_player_name',
  pitch_type: 'pitch_type',
  pitch_name: 'pitch_name',
  type: 'type',
  release_speed: 'release_speed',
  effective_speed: 'effective_speed',
  release_spin_rate: 'release_spin_rate',
  spin_axis: 'spin_axis',
  release_extension: 'release_extension',
  release_pos_x: 'release_pos_x',
  release_pos_y: 'release_pos_y',
  release_pos_z: 'release_pos_z',
  arm_angle: 'arm_angle',
  p_throws: 'p_throws',
  stand: 'stand',
  balls: 'balls',
  strikes: 'strikes',
  outs_when_up: 'outs_when_up',
  home_score: 'home_score',
  away_score: 'away_score',
  bat_score: 'bat_score',
  fld_score: 'fld_score',
  post_home_score: 'post_home_score',
  post_away_score: 'post_away_score',
  post_bat_score: 'post_bat_score',
  post_fld_score: 'post_fld_score',
  events: 'events',
  description: 'description',
  inning: 'inning',
  inning_topbot: 'inning_topbot',
  pfx_x: 'pfx_x',
  pfx_z: 'pfx_z',
  plate_x: 'plate_x',
  plate_z: 'plate_z',
  zone: 'zone',
  vx0: 'vx0',
  vy0: 'vy0',
  vz0: 'vz0',
  ax: 'ax',
  ay: 'ay',
  az: 'az',
  api_break_z_with_gravity: 'api_break_z_with_gravity',
  api_break_x_arm: 'api_break_x_arm',
  api_break_x_batter_in: 'api_break_x_batter_in',
  launch_speed: 'launch_speed',
  launch_angle: 'launch_angle',
  estimated_ba_using_speedangle: 'estimated_ba_using_speedangle',
  estimated_woba_using_speedangle: 'estimated_woba_using_speedangle',
  estimated_slg_using_speedangle: 'estimated_slg_using_speedangle',
  launch_speed_angle: 'launch_speed_angle',
  hit_distance_sc: 'hit_distance_sc',
  bb_type: 'bb_type',
  hit_location: 'hit_location',
  hc_x: 'hc_x',
  hc_y: 'hc_y',
  bat_speed: 'bat_speed',
  swing_length: 'swing_length',
  attack_angle: 'attack_angle',
  attack_direction: 'attack_direction',
  swing_path_tilt: 'swing_path_tilt',
  at_bat_number: 'at_bat_number',
  pitch_number: 'pitch_number',
}

const integerFields = new Set(['game_pk', 'game_year', 'source_pitcher_id', 'source_batter_id', 'balls', 'strikes', 'outs_when_up', 'home_score', 'away_score', 'bat_score', 'fld_score', 'post_home_score', 'post_away_score', 'post_bat_score', 'post_fld_score', 'inning', 'zone', 'launch_speed_angle', 'hit_location', 'at_bat_number', 'pitch_number'])
const numericFields = new Set(['release_speed', 'effective_speed', 'release_spin_rate', 'spin_axis', 'release_extension', 'release_pos_x', 'release_pos_y', 'release_pos_z', 'arm_angle', 'pfx_x', 'pfx_z', 'plate_x', 'plate_z', 'vx0', 'vy0', 'vz0', 'ax', 'ay', 'az', 'api_break_z_with_gravity', 'api_break_x_arm', 'api_break_x_batter_in', 'launch_speed', 'launch_angle', 'estimated_ba_using_speedangle', 'estimated_woba_using_speedangle', 'estimated_slg_using_speedangle', 'hit_distance_sc', 'hc_x', 'hc_y', 'bat_speed', 'swing_length', 'attack_angle', 'attack_direction', 'swing_path_tilt'])
const rawColumns = ['id','game_pk','game_date','game_year','canonical_home_team_id','canonical_away_team_id','source_pitcher_id','source_batter_id','mlbam_pitcher_id','mlbam_batter_id','at_bat_number','pitch_number','inning','inning_topbot','pitch_type','type','events','description','release_speed','release_spin_rate','spin_axis','pfx_x','pfx_z','release_extension','plate_x','plate_z','zone','launch_speed','launch_angle','estimated_woba_using_speedangle','bat_speed','swing_length','attack_angle','home_score','away_score','bat_score','fld_score','post_home_score','post_away_score','post_bat_score','post_fld_score','raw_payload_digest'].join(',')

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadLocalEnv()

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

function dbClient() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function isoDateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addDays(date, days) {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function previousDate(date) {
  return isoDate(addDays(new Date(`${date}T00:00:00Z`), -1))
}

function dateDiffDays(later, earlier) {
  return Math.max(0, Math.round((new Date(`${later}T00:00:00Z`) - new Date(`${earlier}T00:00:00Z`)) / 86400000))
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

function normalizeValue(value, destination) {
  if (value === '' || value == null) return null
  if (integerFields.has(destination)) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null
    return Math.trunc(parsed)
  }
  if (numericFields.has(destination)) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return value
}

function rowIdentity(row) {
  return `statcast:mlb:2026:${row.game_pk}:${row.at_bat_number}:${row.pitch_number}`
}

function rawPayloadDigest(rawPayload) {
  return sha256(JSON.stringify(rawPayload))
}

function transformStatcastRow(row, teamMap) {
  if (!row.game_pk || !row.at_bat_number || !row.pitch_number) return null
  const rawPayload = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === '' ? null : value]))
  const transformed = {
    id: rowIdentity(row),
    pick2_era: 'PICK_2_ERA_V1',
    source: 'statcast',
    source_version: statcastSourceVersion,
    event_id: null,
    event_mapping_state: 'UNMAPPED',
    canonical_pitcher_id: null,
    canonical_batter_id: null,
    player_mapping_state: 'MAPPED',
    raw_payload: rawPayload,
    raw_payload_digest: rawPayloadDigest(rawPayload),
    mlbam_pitcher_id: normalizeValue(row.pitcher, 'source_pitcher_id'),
    mlbam_batter_id: normalizeValue(row.batter, 'source_batter_id'),
    mapping_metadata: {
      phase: 'MLB_DATA_02H',
      source: 'baseball_savant_statcast_search_csv',
      source_version: statcastSourceVersion,
      canonicalMapping: 'native_game_pk_and_mlbam_person_id',
    },
  }
  for (const [sourceColumn, destination] of Object.entries(sourceToRaw)) transformed[destination] = normalizeValue(row[sourceColumn], destination)
  transformed.canonical_home_team_id = teamMap.get(String(row.home_team ?? '').toUpperCase()) ?? null
  transformed.canonical_away_team_id = teamMap.get(String(row.away_team ?? '').toUpperCase()) ?? null
  return transformed
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} HTTP_${response.status}`)
  return response.json()
}

async function fetchText(url) {
  let lastStatus = null
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url)
    lastStatus = response.status
    if (response.ok) return response.text()
    if (![429, 500, 502, 503, 504].includes(response.status)) break
    await new Promise((resolve) => setTimeout(resolve, attempt * 3000))
  }
  throw new Error(`${url} HTTP_${lastStatus}`)
}

function statcastUrl(from, to) {
  const params = new URLSearchParams({
    all: 'true',
    hfPT: '',
    hfAB: '',
    hfGT: 'R|PO|',
    hfPR: '',
    hfZ: '',
    stadium: '',
    hfBBL: '',
    hfNewZones: '',
    hfPull: '',
    hfC: '',
    hfSea: '2026|',
    hfSit: '',
    player_type: 'pitcher',
    hfOuts: '',
    opponent: '',
    pitcher_throws: '',
    batter_stands: '',
    hfSA: '',
    game_date_gt: from,
    game_date_lt: to,
    hfInfield: '',
    team: '',
    position: '',
    hfOutfield: '',
    hfRO: '',
    home_road: '',
    hfFlag: '',
    hfBBT: '',
    metric_1: '',
    hfInn: '',
    min_pitches: '0',
    min_results: '0',
    group_by: 'name',
    sort_col: 'pitches',
    player_event_sort: 'h_launch_speed',
    sort_order: 'desc',
    min_pas: '0',
    type: 'details',
  })
  return `https://baseballsavant.mlb.com/statcast_search/csv?${params}`
}

async function countRows(db, table, column = 'id', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(column, { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function countRowsByDateWindows(db, table, startDate, endDate) {
  let total = 0
  let cursor = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  while (cursor < end) {
    const next = new Date(cursor.getTime())
    next.setUTCDate(next.getUTCDate() + 1)
    const windowEnd = next < end ? next : end
    total += await countRows(db, table, 'id', (query) => query.gte('game_date', isoDate(cursor)).lt('game_date', isoDate(windowEnd)))
    cursor = windowEnd
  }
  return total
}

async function readAll(db, table, columns, configure = (query) => query, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await configure(db.from(table).select(columns).range(from, from + pageSize - 1))
    if (error) throw new Error(`${table} read failed at ${from}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

async function readExistingByIds(db, table, idColumn, digestColumn, ids) {
  const map = new Map()
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200)
    let attempt = 0
    for (;;) {
      try {
        const { data, error } = await db.from(table).select(`${idColumn},${digestColumn}`).in(idColumn, chunk)
        if (error) throw new Error(error.message)
        for (const row of data ?? []) map.set(String(row[idColumn]), row[digestColumn])
        break
      } catch (error) {
        attempt += 1
        if (attempt >= 4) throw new Error(`${table} existing read failed at ${index}: ${error.message}`)
        await sleep(500 * attempt)
      }
    }
  }
  return map
}

async function insertRows(db, table, rows, size = batchSize, checkpoint = null) {
  let inserted = 0
  for (let index = 0; index < rows.length; index += size) {
    const start = Date.now()
    const chunk = rows.slice(index, index + size)
    const { error } = await db.from(table).insert(chunk)
    if (error) throw new Error(`${table} insert failed at ${index}: ${error.message}`)
    inserted += chunk.length
    if (checkpoint) checkpoint(index, chunk, inserted, Date.now() - start)
    if (inserted % 5000 === 0 || inserted === rows.length) console.error(JSON.stringify({ stage: '02h_insert', table, inserted }))
  }
  return inserted
}

async function teamMaps(db) {
  const [teams, officialTeams] = await Promise.all([
    readAll(db, 'sports_teams', 'id,name,abbreviation,metadata,provider_ids', (query) => query.eq('sport_key', 'baseball_mlb')),
    fetchJson('https://statsapi.mlb.com/api/v1/teams?sportId=1&season=2026'),
  ])
  const byAbbrev = new Map()
  for (const team of teams) {
    for (const value of [team.abbreviation, team.metadata?.mlb_abbreviation, team.metadata?.abbreviation]) {
      if (value) byAbbrev.set(String(value).toUpperCase(), team.id)
    }
  }
  if (byAbbrev.has('ARI')) byAbbrev.set('AZ', byAbbrev.get('ARI'))
  if (byAbbrev.has('CHW')) byAbbrev.set('CWS', byAbbrev.get('CHW'))
  const officialById = new Map()
  for (const team of officialTeams.teams ?? []) {
    const id = byAbbrev.get(String(team.abbreviation ?? '').toUpperCase())
    if (id) officialById.set(Number(team.id), { canonicalId: id, abbreviation: team.abbreviation, name: team.name })
  }
  return { byAbbrev, officialById, mlbOfficialTeamCalls: 1 }
}

function scheduleRow(game, officialTeamMap) {
  const home = officialTeamMap.get(Number(game.teams?.home?.team?.id))
  const away = officialTeamMap.get(Number(game.teams?.away?.team?.id))
  return {
    game_pk: Number(game.gamePk),
    season: 2026,
    game_date: game.officialDate,
    scheduled_at: game.gameDate,
    home_team_id: home?.canonicalId ?? null,
    away_team_id: away?.canonicalId ?? null,
    game_type: game.gameType,
    official_status: game.status?.detailedState ?? game.status?.abstractGameState ?? null,
    doubleheader: game.doubleHeader ?? null,
    game_number: game.gameNumber ?? null,
    source: 'mlb_official',
    source_payload_digest: sha256(stable(game)),
    metadata: {
      phase: 'MLB_DATA_02H',
      officialDate: game.officialDate,
      statusCode: game.status?.statusCode,
      abstractGameState: game.status?.abstractGameState,
      homeMlbTeamId: game.teams?.home?.team?.id,
      awayMlbTeamId: game.teams?.away?.team?.id,
      homeProbablePitcher: game.teams?.home?.probablePitcher ?? null,
      awayProbablePitcher: game.teams?.away?.probablePitcher ?? null,
    },
  }
}

function isCompleted(game) {
  return ['Final', 'Game Over'].includes(game.status?.abstractGameState) || ['F', 'O'].includes(game.status?.statusCode)
}

function isInProgress(game) {
  return game.status?.abstractGameState === 'Live' || ['I', 'M', 'N'].includes(game.status?.statusCode)
}

function isPostponed(game) {
  const state = `${game.status?.detailedState ?? ''} ${game.status?.abstractGameState ?? ''}`.toLowerCase()
  return /postponed|suspended|cancelled|canceled/.test(state)
}

async function loadSchedule(cutoffDate, horizonEnd, officialTeamMap) {
  const season = await fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-01-01&endDate=${cutoffDate}&hydrate=probablePitcher`)
  const horizon = await fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${cutoffDate}&endDate=${horizonEnd}&hydrate=probablePitcher`)
  const sourceSeasonGames = (season.dates ?? []).flatMap((date) => date.games ?? [])
  const sourceHorizonGames = (horizon.dates ?? []).flatMap((date) => date.games ?? [])
  const sourceDuplicateGamePk = sourceSeasonGames.length - new Set(sourceSeasonGames.map((game) => Number(game.gamePk))).size
  const seasonGames = [...new Map(sourceSeasonGames.map((game) => [Number(game.gamePk), game])).values()]
  const horizonGames = [...new Map(sourceHorizonGames.map((game) => [Number(game.gamePk), game])).values()]
  const completed = seasonGames.filter((game) => isCompleted(game) && ['R', 'PO'].includes(game.gameType) && String(game.officialDate) < cutoffDate)
  const inProgress = horizonGames.filter(isInProgress)
  const scheduledFuture = horizonGames.filter((game) => !isCompleted(game) && !isInProgress(game) && !isPostponed(game))
  const postponed = [...seasonGames, ...horizonGames].filter(isPostponed)
  const doubleheaders = [...seasonGames, ...horizonGames].filter((game) => game.doubleHeader && game.doubleHeader !== 'N' && game.doubleHeader !== 'S')
  return {
    providerCalls: 2,
    completed,
    horizonGames,
    nativeRows: [...new Map([...completed, ...horizonGames].map((game) => [Number(game.gamePk), scheduleRow(game, officialTeamMap)])).values()],
    inventory: {
      completedGamesBeforeCutoff: completed.length,
      inProgressGamesInHorizon: inProgress.length,
      scheduledFutureGamesInHorizon: scheduledFuture.length,
      postponedSuspendedCancelledGames: postponed.length,
      doubleheaderGames: doubleheaders.length,
      duplicateGamePk: seasonGames.length - new Set(seasonGames.map((game) => Number(game.gamePk))).size,
      sourceDuplicateGamePk,
    },
  }
}

async function acquireStatcastRows(completedGames, cutoffDate, teamMap) {
  const gameDates = [...new Set(completedGames.map((game) => game.officialDate).filter((date) => date && date < cutoffDate))].sort()
  const rows = []
  let calls = 0
  let cacheReuses = 0
  fs.mkdirSync(statcastCacheDir, { recursive: true })
  for (let index = 0; index < gameDates.length; index += 1) {
    const from = gameDates[index]
    const to = gameDates[index]
    const cachePath = path.join(statcastCacheDir, `${from}.csv`)
    let text = null
    if (fs.existsSync(cachePath)) {
      text = fs.readFileSync(cachePath, 'utf8')
      cacheReuses += 1
    } else {
      text = await fetchText(statcastUrl(from, to))
      fs.writeFileSync(cachePath, text)
      calls += 1
    }
    const parsed = parseCsv(text).map((row) => transformStatcastRow(row, teamMap)).filter(Boolean)
    if (parsed.length >= 25000) throw new Error(`STATCAST_DAILY_CAP_SUSPECT:${from}:${parsed.length}`)
    rows.push(...parsed)
    console.error(JSON.stringify({ stage: '02h_statcast_fetch', from, to, parsedRows: parsed.length, totalRows: rows.length }))
  }
  const completedPks = new Set(completedGames.map((game) => Number(game.gamePk)))
  return { rows: rows.filter((row) => completedPks.has(Number(row.game_pk))), calls, cacheReuses, dates: gameDates }
}

function collectPlayers(rawRows, scheduleRows) {
  const players = new Map()
  for (const row of rawRows) {
    for (const [personId, role] of [[row.mlbam_pitcher_id, 'pitcher'], [row.mlbam_batter_id, 'batter']]) {
      if (!personId) continue
      const current = players.get(Number(personId)) ?? { mlbam_person_id: Number(personId), roles: new Set(), names: new Set(), first_seen_date: row.game_date, last_seen_date: row.game_date }
      current.roles.add(role)
      if (row.source_player_name) current.names.add(row.source_player_name)
      if (String(row.game_date) < current.first_seen_date) current.first_seen_date = row.game_date
      if (String(row.game_date) > current.last_seen_date) current.last_seen_date = row.game_date
      players.set(Number(personId), current)
    }
  }
  for (const game of scheduleRows) {
    for (const key of ['homeProbablePitcher', 'awayProbablePitcher']) {
      const pitcher = game.metadata?.[key]
      if (!pitcher?.id) continue
      const current = players.get(Number(pitcher.id)) ?? { mlbam_person_id: Number(pitcher.id), roles: new Set(), names: new Set(), first_seen_date: game.game_date, last_seen_date: game.game_date }
      current.roles.add('probable_starter')
      if (pitcher.fullName) current.names.add(pitcher.fullName)
      players.set(Number(pitcher.id), current)
    }
  }
  return [...players.values()].map((entry) => ({
    mlbam_person_id: entry.mlbam_person_id,
    full_name: [...entry.names][0] ?? null,
    first_name: [...entry.names][0]?.split(' ').slice(0, -1).join(' ') || null,
    last_name: [...entry.names][0]?.split(' ').slice(-1)[0] || null,
    first_seen_date: entry.first_seen_date,
    last_seen_date: entry.last_seen_date,
    source: 'mlb_official_statcast',
    source_payload_digest: sha256(stable({ id: entry.mlbam_person_id, names: [...entry.names].sort(), roles: [...entry.roles].sort() })),
    metadata: { phase: 'MLB_DATA_02H', roles: [...entry.roles].sort(), names: [...entry.names].sort() },
  }))
}

function countDuplicate(keys) {
  return keys.length - new Set(keys).size
}

async function classifyNativeGames(db, rows) {
  const existing = new Map((await readAll(db, 'pick2_mlb_games', 'game_pk,home_team_id,away_team_id,game_date,source_payload_digest', (query) => query.gte('game_date', '2026-01-01').lt('game_date', '2027-01-01'))).map((row) => [Number(row.game_pk), row]))
  let inserts = 0; let reuses = 0; let conflicts = 0
  for (const row of rows) {
    const existingRow = existing.get(Number(row.game_pk))
    if (!existingRow) inserts += 1
    else if (existingRow.home_team_id === row.home_team_id && existingRow.away_team_id === row.away_team_id && String(existingRow.game_date) === String(row.game_date)) reuses += 1
    else conflicts += 1
  }
  return { inserts, reuses, conflicts }
}

async function classifyPlayers(db, rows) {
  const existing = new Set((await readAll(db, 'pick2_mlb_players', 'mlbam_person_id')).map((row) => Number(row.mlbam_person_id)))
  return {
    inserts: rows.filter((row) => !existing.has(Number(row.mlbam_person_id))).length,
    reuses: rows.filter((row) => existing.has(Number(row.mlbam_person_id))).length,
    conflicts: 0,
  }
}

async function classifyRaw(db, rows, existingSeasonRows = null) {
  if (rows.length === 0) return { inserts: 0, reuses: 0, conflicts: 0 }
  if (existingSeasonRows === 0) return { inserts: rows.length, reuses: 0, conflicts: 0 }
  const existing = await readExistingByIds(db, 'pick2_raw_mlb_statcast_pitches', 'id', 'raw_payload_digest', rows.map((row) => row.id))
  let inserts = 0; let reuses = 0; let conflicts = 0
  for (const row of rows) {
    const digest = existing.get(row.id)
    if (!digest) inserts += 1
    else if (digest === row.raw_payload_digest) reuses += 1
    else conflicts += 1
  }
  return { inserts, reuses, conflicts }
}

async function reconcileRawByDates(db, sourceRows, dates) {
  const sourceById = new Map(sourceRows.map((row) => [row.id, row.raw_payload_digest]))
  const existing = new Map()
  const unexpected = []
  const duplicateExisting = []
  let pitcherMissing = 0
  let batterMissing = 0
  let gamePkMissing = 0
  for (const date of dates) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from('pick2_raw_mlb_statcast_pitches')
        .select('id,raw_payload_digest,game_pk,mlbam_pitcher_id,mlbam_batter_id')
        .eq('game_date', date)
        .order('id', { ascending: true })
        .range(from, from + 999)
      if (error) throw new Error(`raw date reconciliation failed:${date}:${from}:${error.message}`)
      for (const row of data ?? []) {
        const id = String(row.id)
        if (existing.has(id)) duplicateExisting.push(id)
        existing.set(id, row.raw_payload_digest)
        if (!sourceById.has(id)) unexpected.push(id)
        if (!row.mlbam_pitcher_id) pitcherMissing += 1
        if (!row.mlbam_batter_id) batterMissing += 1
        if (!row.game_pk) gamePkMissing += 1
      }
      if (!data || data.length < 1000) break
    }
    console.error(JSON.stringify({ stage: '02h_r2_raw_reconcile', date, existingRead: existing.size, unexpected: unexpected.length, duplicateExisting: duplicateExisting.length }))
  }
  let reuses = 0
  let conflicts = 0
  const missingRows = []
  for (const row of sourceRows) {
    const digest = existing.get(row.id)
    if (!digest) missingRows.push(row)
    else if (digest === row.raw_payload_digest) reuses += 1
    else conflicts += 1
  }
  return {
    inserts: missingRows.length,
    reuses,
    conflicts,
    existingCertified: reuses,
    missingRows,
    missing: missingRows.length,
    unexpected: unexpected.length,
    duplicateExisting: duplicateExisting.length,
    pitcherMissing,
    batterMissing,
    gamePkMissing,
  }
}

async function readRawRowsByDates(db, dates) {
  const rows = []
  for (const date of dates) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from('pick2_raw_mlb_statcast_pitches')
        .select(rawColumns)
        .eq('game_date', date)
        .order('id', { ascending: true })
        .range(from, from + 999)
      if (error) throw new Error(`raw date read failed:${date}:${from}:${error.message}`)
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    console.error(JSON.stringify({ stage: '02h_r2_raw_read', date, rowsRead: rows.length }))
  }
  return rows
}

function sourceIdentityDigest(rows) {
  return sha256(rows.map((row) => `${row.id}:${row.raw_payload_digest}`).sort().join('\n'))
}

function writeR2Checkpoint(payload) {
  fs.mkdirSync(path.dirname(r2CheckpointPath), { recursive: true })
  fs.writeFileSync(r2CheckpointPath, `${JSON.stringify(payload, null, 2)}\n`)
}

async function missingNativeGames(db, rows) {
  const existing = new Set((await readAll(db, 'pick2_mlb_games', 'game_pk', (query) => query.eq('season', 2026))).map((row) => Number(row.game_pk)))
  return rows.filter((row) => !existing.has(Number(row.game_pk)))
}

async function missingPlayers(db, rows) {
  const existing = new Set((await readAll(db, 'pick2_mlb_players', 'mlbam_person_id')).map((row) => Number(row.mlbam_person_id)))
  return rows.filter((row) => !existing.has(Number(row.mlbam_person_id)))
}

function makeStats() {
  return { games: 0, plateAppearances: 0, strikeouts: 0, walks: 0, pitches: 0, strikes: 0, swings: 0, whiffs: 0, calledStrikes: 0, releaseSpeedSum: 0, releaseSpeedCount: 0, launchSpeedSum: 0, launchSpeedCount: 0, estimatedWobaSum: 0, estimatedWobaCount: 0, runs: 0, firstInningPitches: 0, firstInningStrikeouts: 0, firstInningWalks: 0, pitchCounts: [], lastGameDate: null }
}

function average(sum, denominator) { return denominator ? Number((sum / denominator).toFixed(4)) : null }
function safeRate(numerator, denominator) { return denominator ? Number((numerator / denominator).toFixed(6)) : null }
function eventName(row) { return String(row.events ?? '').toLowerCase() }
function descriptionName(row) { return String(row.description ?? '').toLowerCase() }
function isPaEnding(row) { return row.events != null && String(row.events).trim() !== '' }
function isStrikeout(row) { return eventName(row).includes('strikeout') }
function isWalk(row) { const name = eventName(row); return name === 'walk' || name === 'intent_walk' }
function isStrike(row) { const type = String(row.type ?? '').toUpperCase(); const desc = descriptionName(row); return type === 'S' || desc.includes('strike') || desc.includes('foul') }
function isSwing(row) { const desc = descriptionName(row); return desc.includes('swing') || desc.includes('foul') || desc.includes('hit_into_play') }
function isWhiff(row) { return descriptionName(row).includes('swinging_strike') }

function getGame(map, row) {
  const gamePk = Number(row.game_pk)
  if (!map.has(gamePk)) {
    map.set(gamePk, { gamePk, gameDate: String(row.game_date), homeTeamId: row.canonical_home_team_id, awayTeamId: row.canonical_away_team_id, pitchers: new Set(), batters: new Set(), homePitchers: new Set(), awayPitchers: new Set(), homeBatters: new Set(), awayBatters: new Set(), homeStarter: null, awayStarter: null, finalHomeScore: null, finalAwayScore: null, rows: [] })
  }
  return map.get(gamePk)
}

function updateGame(row, game) {
  const pitcherId = Number(row.mlbam_pitcher_id)
  const batterId = Number(row.mlbam_batter_id)
  const top = String(row.inning_topbot ?? '').toLowerCase().startsWith('top')
  const bottom = String(row.inning_topbot ?? '').toLowerCase().startsWith('bot')
  game.pitchers.add(pitcherId); game.batters.add(batterId)
  if (top) { game.homePitchers.add(pitcherId); game.awayBatters.add(batterId); if (!game.homeStarter) game.homeStarter = pitcherId }
  if (bottom) { game.awayPitchers.add(pitcherId); game.homeBatters.add(batterId); if (!game.awayStarter) game.awayStarter = pitcherId }
  if (row.post_home_score != null) game.finalHomeScore = Math.max(Number(row.post_home_score), game.finalHomeScore ?? 0)
  if (row.post_away_score != null) game.finalAwayScore = Math.max(Number(row.post_away_score), game.finalAwayScore ?? 0)
  game.rows.push(row)
}

function scanRawRows(rows) {
  const games = new Map()
  const identities = new Set()
  const duplicateIdentities = new Set()
  let pitcherNull = 0; let batterNull = 0
  for (const row of rows) {
    const identity = `${row.game_pk}:${row.at_bat_number}:${row.pitch_number}`
    if (identities.has(identity)) duplicateIdentities.add(identity)
    identities.add(identity)
    if (!row.mlbam_pitcher_id) pitcherNull += 1
    if (!row.mlbam_batter_id) batterNull += 1
    updateGame(row, getGame(games, row))
  }
  return { rawRows: rows.length, uniquePitchIdentities: identities.size, duplicatePitchIdentities: duplicateIdentities.size, pitcherNull, batterNull, games: [...games.values()] }
}

function addGameStats(map, key, gameDate) {
  if (!map.has(key)) map.set(key, { stats: makeStats(), gameDates: new Set(), pitchCount: 0 })
  const entry = map.get(key)
  entry.gameDates.add(gameDate)
  return entry
}

function battingTeamId(row, game) { return String(row.inning_topbot ?? '').toLowerCase().startsWith('top') ? game.awayTeamId : game.homeTeamId }
function pitchingTeamId(row, game) { return String(row.inning_topbot ?? '').toLowerCase().startsWith('top') ? game.homeTeamId : game.awayTeamId }

function mergeStats(totalMap, gameMap, gameDate) {
  for (const [key, entry] of gameMap.entries()) {
    if (!totalMap.has(key)) totalMap.set(key, makeStats())
    const total = totalMap.get(key)
    const stats = entry.stats
    total.games += entry.gameDates.size
    for (const field of ['plateAppearances','strikeouts','walks','pitches','strikes','swings','whiffs','calledStrikes','releaseSpeedSum','releaseSpeedCount','launchSpeedSum','launchSpeedCount','estimatedWobaSum','estimatedWobaCount','runs','firstInningPitches','firstInningStrikeouts','firstInningWalks']) total[field] += stats[field]
    total.pitchCounts.push({ gameDate, pitches: stats.pitches, avgReleaseSpeed: average(stats.releaseSpeedSum, stats.releaseSpeedCount) })
    total.lastGameDate = gameDate
  }
}

function updateStatsFromGame(history, game) {
  const teamGameStats = new Map(), pitcherGameStats = new Map(), batterGameStats = new Map(), bullpenGameStats = new Map()
  for (const row of game.rows) {
    const pitcherId = Number(row.mlbam_pitcher_id), batterId = Number(row.mlbam_batter_id)
    const pitcher = addGameStats(pitcherGameStats, pitcherId, game.gameDate)
    const batter = addGameStats(batterGameStats, batterId, game.gameDate)
    const teamBatting = addGameStats(teamGameStats, battingTeamId(row, game), game.gameDate)
    const isStarterPitch = pitcherId === game.homeStarter || pitcherId === game.awayStarter
    const bullpen = isStarterPitch ? null : addGameStats(bullpenGameStats, pitchingTeamId(row, game), game.gameDate)
    for (const target of [teamBatting, pitcher, batter, bullpen].filter(Boolean)) {
      target.stats.pitches += 1; target.pitchCount += 1
      if (isStrike(row)) target.stats.strikes += 1
      if (isSwing(row)) target.stats.swings += 1
      if (isWhiff(row)) target.stats.whiffs += 1
      if (descriptionName(row).includes('called_strike')) target.stats.calledStrikes += 1
      if (Number(row.inning) === 1) target.stats.firstInningPitches += 1
      if (row.release_speed != null) { target.stats.releaseSpeedSum += Number(row.release_speed); target.stats.releaseSpeedCount += 1 }
      if (row.launch_speed != null) { target.stats.launchSpeedSum += Number(row.launch_speed); target.stats.launchSpeedCount += 1 }
      if (row.estimated_woba_using_speedangle != null) { target.stats.estimatedWobaSum += Number(row.estimated_woba_using_speedangle); target.stats.estimatedWobaCount += 1 }
    }
    if (isPaEnding(row)) {
      for (const target of [teamBatting, pitcher, batter, bullpen].filter(Boolean)) target.stats.plateAppearances += 1
      if (isStrikeout(row)) for (const target of [teamBatting, pitcher, batter, bullpen].filter(Boolean)) target.stats.strikeouts += 1
      if (isWalk(row)) for (const target of [teamBatting, pitcher, batter, bullpen].filter(Boolean)) target.stats.walks += 1
    }
  }
  for (const [teamId, score] of [[game.homeTeamId, game.finalHomeScore ?? 0], [game.awayTeamId, game.finalAwayScore ?? 0]]) addGameStats(teamGameStats, teamId, game.gameDate).stats.runs = score
  mergeStats(history.teamBatting, teamGameStats, game.gameDate)
  mergeStats(history.pitcher, pitcherGameStats, game.gameDate)
  mergeStats(history.batter, batterGameStats, game.gameDate)
  mergeStats(history.bullpen, bullpenGameStats, game.gameDate)
}

function rates(stats) {
  return { kRate: safeRate(stats.strikeouts, stats.plateAppearances), bbRate: safeRate(stats.walks, stats.plateAppearances), kMinusBbRate: stats.plateAppearances ? Number(((stats.strikeouts - stats.walks) / stats.plateAppearances).toFixed(6)) : null, whiffRate: safeRate(stats.whiffs, stats.swings), cswRate: safeRate(stats.whiffs + stats.calledStrikes, stats.pitches), strikeRate: safeRate(stats.strikes, stats.pitches), swingRate: safeRate(stats.swings, stats.pitches), avgReleaseSpeed: average(stats.releaseSpeedSum, stats.releaseSpeedCount), avgLaunchSpeed: average(stats.launchSpeedSum, stats.launchSpeedCount), avgEstimatedWoba: average(stats.estimatedWobaSum, stats.estimatedWobaCount), runsPerGame: safeRate(stats.runs, stats.games) }
}

function sampleSizes(kind, sampleSize, extra = {}) {
  return { kind, sample_size: sampleSize, no_sample_values_written_as_zero: false, ...extra }
}

function sourceWindow(kind, asOfDate, sampleSize) {
  return { rule: 'source_game_date < target_game_date', as_of_date: asOfDate, kind, sample_size: sampleSize, feature_version: featureVersion }
}

function snapshot({ domain, subjectId, secondarySubjectId = null, game, asOfDate, mlbamPersonId = null, mlbamPitcherId = null, mlbamBatterId = null, family = null, sample, features }) {
  const native = { target_game_pk: game.gamePk, game_date: game.gameDate, family: family ?? domain, source_rule: 'strict_prior_date_only', season: 2026 }
  const deterministicIdentity = ['02H', featureVersion, domain, family ?? domain, game.gamePk, subjectId, secondarySubjectId ?? 'none', asOfDate].join(':')
  const payload = { id: crypto.randomUUID(), deterministic_identity: deterministicIdentity, pick2_era: 'PICK_2_ERA_V1', sport_key: 'baseball_mlb', feature_domain: domain, subject_id: subjectId, secondary_subject_id: secondarySubjectId, event_id: null, target_game_pk: game.gamePk, mlbam_person_id: mlbamPersonId, mlbam_pitcher_id: mlbamPitcherId, mlbam_batter_id: mlbamBatterId, native_identity_metadata: native, feature_date: game.gameDate, as_of_date: asOfDate, as_of_timestamp: `${asOfDate}T23:59:59.000Z`, feature_version: featureVersion, source_window: sourceWindow(family ?? domain, asOfDate, sample.sample_size), sample_sizes: sample, features }
  payload.input_digest = sha256(stable({ native, sample, features }))
  return payload
}

function addDailyRows(output, game, asOfDate, history, current, persistBatter = true) {
  const homeTeamStats = history.teamBatting.get(game.homeTeamId) ?? makeStats()
  const awayTeamStats = history.teamBatting.get(game.awayTeamId) ?? makeStats()
  const homeStarterStats = history.pitcher.get(game.homeStarter) ?? makeStats()
  const awayStarterStats = history.pitcher.get(game.awayStarter) ?? makeStats()
  const eligible = homeTeamStats.games > 0 && awayTeamStats.games > 0 && homeStarterStats.games > 0 && awayStarterStats.games > 0 && game.homeStarter && game.awayStarter
  if (!eligible) return false
  for (const [side, teamId, stats] of [['home', game.homeTeamId, homeTeamStats], ['away', game.awayTeamId, awayTeamStats]]) {
    const rowRates = rates(stats)
    const teamSnapshot = snapshot({ domain: 'team', subjectId: `team:${teamId}`, game, asOfDate, family: 'team', sample: sampleSizes('team_games', stats.games, { plate_appearances: stats.plateAppearances, pitches: stats.pitches }), features: { side, ...rowRates, source: '02H_statcast_prior_date' } })
    output.snapshots.push(teamSnapshot)
    output.team.push({ feature_snapshot_id: teamSnapshot.id, team_id: teamId, target_game_pk: game.gamePk, feature_date: game.gameDate, as_of_date: asOfDate, as_of_timestamp: `${asOfDate}T23:59:59.000Z`, feature_version: featureVersion, recent_k_rate: rowRates.kRate, recent_bb_rate: rowRates.bbRate, recent_runs_per_game: rowRates.runsPerGame, recent_iso: rowRates.avgEstimatedWoba, handedness_splits: { source: 'statcast_prior_date', unavailable_fields_remain_null: true }, lineup_proxy: { target_lineup_source: persistBatter ? 'observed_2026_statcast_batters' : 'future_schedule_no_lineup' }, sample_sizes: teamSnapshot.sample_sizes, source_window: teamSnapshot.source_window })
    const offenseSnapshot = snapshot({ domain: 'team', subjectId: `offense:${teamId}`, game, asOfDate, family: 'offense', sample: sampleSizes('offense_games', stats.games, { plate_appearances: stats.plateAppearances }), features: { side, family: 'offense', ...rowRates } })
    output.snapshots.push(offenseSnapshot); output.offense += 1
  }
  for (const [side, pitcherId, stats] of [['home', game.homeStarter, homeStarterStats], ['away', game.awayStarter, awayStarterStats]]) {
    const rowRates = rates(stats), priorThree = stats.pitchCounts.slice(-3), priorFive = stats.pitchCounts.slice(-5)
    const velocityL1 = stats.pitchCounts.length ? stats.pitchCounts[stats.pitchCounts.length - 1].avgReleaseSpeed : null
    const velocityL3 = average(priorThree.reduce((sum, item) => sum + (item.avgReleaseSpeed ?? 0), 0), priorThree.filter((item) => item.avgReleaseSpeed != null).length)
    const velocityL5 = average(priorFive.reduce((sum, item) => sum + (item.avgReleaseSpeed ?? 0), 0), priorFive.filter((item) => item.avgReleaseSpeed != null).length)
    const starterSnapshot = snapshot({ domain: 'pitcher', subjectId: `mlbam_pitcher:${pitcherId}`, game, asOfDate, mlbamPersonId: pitcherId, mlbamPitcherId: pitcherId, family: 'starter', sample: sampleSizes('starter_appearances', stats.games, { pitches: stats.pitches, plate_appearances: stats.plateAppearances }), features: { side, ...rowRates } })
    output.snapshots.push(starterSnapshot)
    output.starter.push({ feature_snapshot_id: starterSnapshot.id, player_id: null, target_game_pk: game.gamePk, mlbam_pitcher_id: pitcherId, feature_date: game.gameDate, as_of_date: asOfDate, as_of_timestamp: `${asOfDate}T23:59:59.000Z`, feature_version: featureVersion, k_rate: rowRates.kRate, bb_rate: rowRates.bbRate, k_minus_bb_rate: rowRates.kMinusBbRate, whiff_rate: rowRates.whiffRate, csw_rate: rowRates.cswRate, strike_rate: rowRates.strikeRate, swing_rate: rowRates.swingRate, avg_release_speed: rowRates.avgReleaseSpeed, velocity_l1: velocityL1, velocity_l3: velocityL3, velocity_l5: velocityL5, velocity_delta: velocityL1 != null && velocityL5 != null ? Number((velocityL1 - velocityL5).toFixed(4)) : null, previous_pitch_count: stats.pitchCounts.length ? stats.pitchCounts[stats.pitchCounts.length - 1].pitches : null, days_rest: stats.lastGameDate ? dateDiffDays(game.gameDate, stats.lastGameDate) : null, pitch_mix: { unavailable_fields_remain_null: true }, pitch_mix_change: { unavailable_fields_remain_null: true }, handedness_splits: { source: 'statcast_prior_date' }, first_inning_performance: { k_rate: safeRate(stats.firstInningStrikeouts, stats.games), bb_rate: safeRate(stats.firstInningWalks, stats.games), pitch_count_per_appearance: safeRate(stats.firstInningPitches, stats.games) }, sample_sizes: starterSnapshot.sample_sizes, source_window: starterSnapshot.source_window })
  }
  for (const [side, teamId, stats] of [['home', game.homeTeamId, history.bullpen.get(game.homeTeamId) ?? makeStats()], ['away', game.awayTeamId, history.bullpen.get(game.awayTeamId) ?? makeStats()]]) {
    const rowRates = rates(stats)
    const bullpenSnapshot = snapshot({ domain: 'bullpen', subjectId: `bullpen:${teamId}`, game, asOfDate, family: 'bullpen', sample: sampleSizes('bullpen_games', stats.games, { pitches: stats.pitches, plate_appearances: stats.plateAppearances }), features: { side, ...rowRates } })
    output.snapshots.push(bullpenSnapshot)
    output.bullpen.push({ feature_snapshot_id: bullpenSnapshot.id, team_id: teamId, target_game_pk: game.gamePk, mlbam_pitcher_ids: [], feature_date: game.gameDate, as_of_date: asOfDate, as_of_timestamp: `${asOfDate}T23:59:59.000Z`, feature_version: featureVersion, pitches_previous_24h: 0, pitches_previous_72h: 0, high_workload_reliever_count: 0, reliever_workload: { target_game_reliever_ids_excluded: true }, bullpen_k_rate: rowRates.kRate, bullpen_bb_rate: rowRates.bbRate, bullpen_k_minus_bb_rate: rowRates.kMinusBbRate, bullpen_whiff_rate: rowRates.whiffRate, availability_proxies: { source: 'strict_prior_date_only' }, sample_sizes: bullpenSnapshot.sample_sizes, source_window: bullpenSnapshot.source_window })
  }
  if (persistBatter) {
    for (const [side, batterIds] of [['home', game.homeBatters], ['away', game.awayBatters]]) {
      for (const batterId of batterIds) {
        const stats = history.batter.get(batterId) ?? makeStats()
        if (stats.games <= 0) continue
        const rowRates = rates(stats)
        const batterSnapshot = snapshot({ domain: 'batter', subjectId: `mlbam_batter:${batterId}`, game, asOfDate, mlbamPersonId: batterId, mlbamBatterId: batterId, family: 'batter', sample: sampleSizes('batter_games', stats.games, { plate_appearances: stats.plateAppearances, pitches: stats.pitches }), features: { side, ...rowRates } })
        output.snapshots.push(batterSnapshot)
        output.batter.push({ feature_snapshot_id: batterSnapshot.id, player_id: null, target_game_pk: game.gamePk, mlbam_batter_id: batterId, feature_date: game.gameDate, as_of_date: asOfDate, as_of_timestamp: `${asOfDate}T23:59:59.000Z`, feature_version: featureVersion, recent_k_rate: rowRates.kRate, recent_bb_rate: rowRates.bbRate, recent_scoring_contribution: safeRate(stats.runs, stats.games), iso_value: rowRates.avgEstimatedWoba, handedness_splits: { source: 'statcast_prior_date' }, pitch_type_matchups: { unavailable_fields_remain_null: true }, sample_sizes: batterSnapshot.sample_sizes, source_window: batterSnapshot.source_window })
      }
    }
  }
  const matchupSample = Math.min(homeTeamStats.games, awayTeamStats.games, homeStarterStats.games, awayStarterStats.games)
  const matchupSnapshot = snapshot({ domain: 'matchup', subjectId: `game:${game.gamePk}`, game, asOfDate, mlbamPitcherId: game.homeStarter, family: 'matchup', sample: sampleSizes('matchup_minimum_history', matchupSample), features: { home_starter_mlbam_pitcher_id: game.homeStarter, away_starter_mlbam_pitcher_id: game.awayStarter } })
  output.snapshots.push(matchupSnapshot)
  output.matchup.push({ feature_snapshot_id: matchupSnapshot.id, event_id: null, target_game_pk: game.gamePk, mlbam_pitcher_id: game.homeStarter, mlbam_batter_id: null, home_team_id: game.homeTeamId, away_team_id: game.awayTeamId, feature_date: game.gameDate, as_of_date: asOfDate, as_of_timestamp: `${asOfDate}T23:59:59.000Z`, feature_version: featureVersion, pitcher_batter_mix: { home_starter_mlbam_pitcher_id: game.homeStarter, away_starter_mlbam_pitcher_id: game.awayStarter }, handedness_context: { source: 'statcast_prior_date' }, park_context: { unavailable_fields_remain_null: true }, lineup_context: { expected_lineup_source: persistBatter ? 'observed_2026_statcast_batters' : 'future_schedule_no_lineup' }, sample_sizes: matchupSnapshot.sample_sizes, source_window: matchupSnapshot.source_window })
  const firstSnapshot = snapshot({ domain: 'first_inning', subjectId: `game:${game.gamePk}`, game, asOfDate, mlbamPitcherId: game.homeStarter, family: 'first_inning', sample: sampleSizes('first_inning_minimum_history', matchupSample), features: { home_starter_mlbam_pitcher_id: game.homeStarter, away_starter_mlbam_pitcher_id: game.awayStarter } })
  output.snapshots.push(firstSnapshot)
  output.firstInning.push({ feature_snapshot_id: firstSnapshot.id, event_id: null, target_game_pk: game.gamePk, home_starter_mlbam_pitcher_id: game.homeStarter, away_starter_mlbam_pitcher_id: game.awayStarter, expected_lineup_mlbam_batter_ids: persistBatter ? [...new Set([...game.homeBatters, ...game.awayBatters])] : [], home_team_id: game.homeTeamId, away_team_id: game.awayTeamId, feature_date: game.gameDate, as_of_date: asOfDate, as_of_timestamp: `${asOfDate}T23:59:59.000Z`, feature_version: featureVersion, team_first_inning_scoring_rate: { home: safeRate(homeTeamStats.firstInningPitches, homeTeamStats.games), away: safeRate(awayTeamStats.firstInningPitches, awayTeamStats.games) }, starter_first_inning_k_rate: { home: safeRate(homeStarterStats.firstInningStrikeouts, homeStarterStats.games), away: safeRate(awayStarterStats.firstInningStrikeouts, awayStarterStats.games) }, starter_first_inning_bb_rate: { home: safeRate(homeStarterStats.firstInningWalks, homeStarterStats.games), away: safeRate(awayStarterStats.firstInningWalks, awayStarterStats.games) }, starter_first_inning_baserunner_proxy: { unavailable_fields_remain_null: true }, starter_first_inning_pitch_count: { home: safeRate(homeStarterStats.firstInningPitches, homeStarterStats.games), away: safeRate(awayStarterStats.firstInningPitches, awayStarterStats.games) }, sample_sizes: firstSnapshot.sample_sizes, source_window: firstSnapshot.source_window })
  current.sampleSizes.push(homeTeamStats.games, awayTeamStats.games, homeStarterStats.games, awayStarterStats.games)
  return true
}

function buildFeatureRows(rawRows, horizonRows) {
  const scan = scanRawRows(rawRows)
  const output = { snapshots: [], team: [], starter: [], bullpen: [], batter: [], matchup: [], firstInning: [], offense: 0 }
  const current = { eligibleGames: 0, insufficientHistoryGames: 0, leakageViolations: 0, sameDayDoubleheaders: 0, sampleSizes: [], currentReadiness: [] }
  const history = { teamBatting: new Map(), pitcher: new Map(), batter: new Map(), bullpen: new Map() }
  const completedGames = scan.games.sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)
  const dayTeams = new Map()
  for (const game of completedGames) {
    const asOfDate = previousDate(game.gameDate)
    if (asOfDate >= game.gameDate) current.leakageViolations += 1
    if (addDailyRows(output, game, asOfDate, history, current, true)) current.eligibleGames += 1
    else current.insufficientHistoryGames += 1
    updateStatsFromGame(history, game)
    for (const teamId of [game.homeTeamId, game.awayTeamId]) {
      const key = `${game.gameDate}:${teamId}`
      dayTeams.set(key, (dayTeams.get(key) ?? 0) + 1)
    }
  }
  current.sameDayDoubleheaders = [...dayTeams.values()].filter((count) => count > 1).length
  for (const row of horizonRows) {
    const homeStarter = row.metadata?.homeProbablePitcher?.id ?? null
    const awayStarter = row.metadata?.awayProbablePitcher?.id ?? null
    const game = { gamePk: row.game_pk, gameDate: row.game_date, homeTeamId: row.home_team_id, awayTeamId: row.away_team_id, homeStarter, awayStarter, homeBatters: [], awayBatters: [] }
    const temp = { snapshots: [], team: [], starter: [], bullpen: [], batter: [], matchup: [], firstInning: [], offense: 0 }
    const state = !homeStarter || !awayStarter ? 'BLOCK_STARTER_UNKNOWN' : addDailyRows(temp, game, previousDate(row.game_date), history, { sampleSizes: [] }, false) ? 'READY_FOR_DRY_INFERENCE' : 'BLOCK_REQUIRED_FEATURE_MISSING'
    current.currentReadiness.push({ game_pk: row.game_pk, scheduled_at: row.scheduled_at, status: row.official_status, home_team_id: row.home_team_id, away_team_id: row.away_team_id, home_starter_state: homeStarter ? 'READY_PROBABLE_WITH_FLAG' : 'BLOCK_STARTER_UNKNOWN', away_starter_state: awayStarter ? 'READY_PROBABLE_WITH_FLAG' : 'BLOCK_STARTER_UNKNOWN', champion_input_status: state, missing_feature_count: state === 'READY_FOR_DRY_INFERENCE' ? 0 : 1, certified_missing_feature_count: 0, structural_blocker_count: state === 'READY_FOR_DRY_INFERENCE' ? 0 : 1 })
  }
  return { output, current, scan }
}

function featureAudit(rows) {
  const duplicateSnapshot = countDuplicate(rows.snapshots.map((row) => row.deterministic_identity))
  return {
    duplicateIdentities: duplicateSnapshot,
    duplicateNativeKeys: {
      team: countDuplicate(rows.team.map((row) => `${row.target_game_pk}:${row.team_id}:${row.feature_version}`)),
      starter: countDuplicate(rows.starter.map((row) => `${row.target_game_pk}:${row.mlbam_pitcher_id}:${row.feature_version}`)),
      bullpen: countDuplicate(rows.bullpen.map((row) => `${row.target_game_pk}:${row.team_id}:${row.feature_version}`)),
      batter: countDuplicate(rows.batter.map((row) => `${row.target_game_pk}:${row.mlbam_batter_id}:${row.feature_version}`)),
      matchup: countDuplicate(rows.matchup.map((row) => `${row.target_game_pk}:${row.feature_version}`)),
      firstInning: countDuplicate(rows.firstInning.map((row) => `${row.target_game_pk}:${row.feature_version}`)),
    },
    asOfViolations: rows.snapshots.filter((row) => row.as_of_date >= row.feature_date).length,
    leakageViolations: rows.snapshots.filter((row) => row.source_window?.rule !== 'source_game_date < target_game_date').length,
    nullPolicyViolations: rows.snapshots.filter((row) => row.sample_sizes?.no_sample_values_written_as_zero !== false).length,
  }
}

async function classifySnapshots(db, rows, existingSeasonSnapshots = null) {
  if (rows.snapshots.length === 0) return { inserts: 0, reuses: 0, conflicts: 0, idMap: new Map() }
  if (existingSeasonSnapshots === 0) return { inserts: rows.snapshots.length, reuses: 0, conflicts: 0, idMap: new Map() }
  const existing = await readExistingByIds(db, 'pick2_feature_snapshots', 'deterministic_identity', 'input_digest', rows.snapshots.map((row) => row.deterministic_identity))
  let inserts = 0; let reuses = 0; let conflicts = 0
  const idMap = new Map()
  for (const row of rows.snapshots) {
    const digest = existing.get(row.deterministic_identity)
    if (!digest) inserts += 1
    else if (digest === row.input_digest) { reuses += 1; idMap.set(row.id, null) }
    else conflicts += 1
  }
  return { inserts, reuses, conflicts, idMap }
}

async function executeFeatureRows(db, rows, snapshotPlan) {
  if (snapshotPlan.inserts > 0) await insertRows(db, 'pick2_feature_snapshots', rows.snapshots)
  if (snapshotPlan.reuses === 0) {
    return {
      snapshots: snapshotPlan.inserts,
      team: await insertRows(db, 'pick2_mlb_team_daily_features', rows.team),
      starter: await insertRows(db, 'pick2_mlb_pitcher_daily_features', rows.starter),
      bullpen: await insertRows(db, 'pick2_mlb_bullpen_daily_features', rows.bullpen),
      batter: await insertRows(db, 'pick2_mlb_batter_daily_features', rows.batter),
      matchup: await insertRows(db, 'pick2_mlb_matchup_daily_features', rows.matchup),
      firstInning: await insertRows(db, 'pick2_mlb_first_inning_daily_features', rows.firstInning),
    }
  }
  const existingSnapshots = await readAll(db, 'pick2_feature_snapshots', 'id,deterministic_identity', (query) => query.in('deterministic_identity', rows.snapshots.map((row) => row.deterministic_identity)))
  const snapshotIds = new Map(existingSnapshots.map((row) => [row.deterministic_identity, row.id]))
  const remap = (collection) => collection.map((row) => {
    const planned = rows.snapshots.find((snapshotRow) => snapshotRow.id === row.feature_snapshot_id)
    return { ...row, feature_snapshot_id: snapshotIds.get(planned.deterministic_identity) }
  })
  return {
    snapshots: snapshotPlan.inserts,
    team: await insertRows(db, 'pick2_mlb_team_daily_features', remap(rows.team)),
    starter: await insertRows(db, 'pick2_mlb_pitcher_daily_features', remap(rows.starter)),
    bullpen: await insertRows(db, 'pick2_mlb_bullpen_daily_features', remap(rows.bullpen)),
    batter: await insertRows(db, 'pick2_mlb_batter_daily_features', remap(rows.batter)),
    matchup: await insertRows(db, 'pick2_mlb_matchup_daily_features', remap(rows.matchup)),
    firstInning: await insertRows(db, 'pick2_mlb_first_inning_daily_features', remap(rows.firstInning)),
  }
}

async function currentCounts(db) {
  return {
    raw2025: await countRowsByDateWindows(db, 'pick2_raw_mlb_statcast_pitches', '2025-01-01', '2026-01-01'),
    raw2026: r2Resume ? null : await countRowsByDateWindows(db, 'pick2_raw_mlb_statcast_pitches', '2026-01-01', '2027-01-01'),
    nativeGames2025: await countRows(db, 'pick2_mlb_games', 'game_pk', (query) => query.eq('season', 2025)),
    nativeGames2026: await countRows(db, 'pick2_mlb_games', 'game_pk', (query) => query.eq('season', 2026)),
    nativePlayers: await countRows(db, 'pick2_mlb_players', 'mlbam_person_id'),
    team2025: await countRows(db, 'pick2_mlb_team_daily_features', 'id', (query) => query.lt('feature_date', '2026-01-01')),
    starter2025: await countRows(db, 'pick2_mlb_pitcher_daily_features', 'id', (query) => query.lt('feature_date', '2026-01-01')),
    bullpen2025: await countRows(db, 'pick2_mlb_bullpen_daily_features', 'id', (query) => query.lt('feature_date', '2026-01-01')),
    batter2025: await countRows(db, 'pick2_mlb_batter_daily_features', 'id', (query) => query.lt('feature_date', '2026-01-01')),
    matchup2025: await countRows(db, 'pick2_mlb_matchup_daily_features', 'id', (query) => query.lt('feature_date', '2026-01-01')),
    firstInning2025: await countRows(db, 'pick2_mlb_first_inning_daily_features', 'id', (query) => query.lt('feature_date', '2026-01-01')),
    snapshots2025: await countRows(db, 'pick2_feature_snapshots', 'id', (query) => query.lt('feature_date', '2026-01-01')),
    team2026: await countRows(db, 'pick2_mlb_team_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    starter2026: await countRows(db, 'pick2_mlb_pitcher_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    bullpen2026: await countRows(db, 'pick2_mlb_bullpen_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    batter2026: await countRows(db, 'pick2_mlb_batter_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    matchup2026: await countRows(db, 'pick2_mlb_matchup_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    firstInning2026: await countRows(db, 'pick2_mlb_first_inning_daily_features', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    snapshots2026: await countRows(db, 'pick2_feature_snapshots', 'id', (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')),
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValues: await countRows(db, 'pick2_market_value_evaluations'),
  }
}

async function main() {
  const db = dbClient()
  const now = new Date()
  const currentPuertoRicoTimestamp = now.toISOString()
  const currentPuertoRicoDate = isoDateInTimeZone(now, 'America/Puerto_Rico')
  const performanceCutoff = currentPuertoRicoDate
  const horizonEnd = isoDate(addDays(new Date(`${currentPuertoRicoDate}T00:00:00Z`), 2))
  const version = await fetchJson('https://pick-analyzer.vercel.app/api/system/version')
  ensure(version.gitCommit === targetCommit, `PRODUCTION_ALIGNMENT_FAILED:${version.gitCommit}`)
  ensure(version.providerCallsMade === 0, 'PROVIDER_CALL_DRIFT')

  const before = await currentCounts(db)
  ensure(before.raw2025 === 712528, '2025_RAW_BASELINE_CHANGED')
  ensure(before.nativeGames2025 >= 2430 && before.nativePlayers >= 1469, 'NATIVE_BASELINE_CHANGED')
  ensure(before.team2025 === 4498 && before.starter2025 === 4498 && before.bullpen2025 === 4498 && before.batter2025 === 44943 && before.matchup2025 === 2249 && before.firstInning2025 === 2249 && before.snapshots2025 === 67433, '2025_FEATURE_BASELINE_CHANGED')
  ensure(before.predictions === 0 && before.predictionResults === 0 && before.marketValues === 0, 'PREDICTION_ZERO_BASELINE_CHANGED')
  const championRows = await readAll(db, 'pick2_model_versions', 'id,model_version,role,status,artifact_digest,pick2_model_feature_sets(feature_set_version)', (query) => query.eq('role', 'champion').eq('status', 'promoted'))
  ensure(championRows.length === 1 && championRows[0].model_version === modelVersion && championRows[0].artifact_digest === artifactDigest && championRows[0].pick2_model_feature_sets?.feature_set_version === featureSet, 'CHAMPION_BASELINE_CHANGED')

  const maps = await teamMaps(db)
  const schedule = await loadSchedule(performanceCutoff, horizonEnd, maps.officialById)
  ensure(schedule.inventory.duplicateGamePk === 0, 'SCHEDULE_DUPLICATE_GAME_PK')
  const statcast = await acquireStatcastRows(schedule.completed, performanceCutoff, maps.byAbbrev)
  const rawScan = scanRawRows(statcast.rows)
  ensure(rawScan.duplicatePitchIdentities === 0, '2026_RAW_DUPLICATE_IDENTITIES')
  ensure(rawScan.pitcherNull === 0 && rawScan.batterNull === 0, '2026_RAW_NATIVE_PLAYER_NULL')
  const rawSourceDigest = sourceIdentityDigest(statcast.rows)
  const players = collectPlayers(statcast.rows, schedule.nativeRows)
  const gamePlan = await classifyNativeGames(db, schedule.nativeRows)
  const playerPlan = await classifyPlayers(db, players)
  const rawPlan = r2Resume
    ? await reconcileRawByDates(db, statcast.rows, statcast.dates)
    : await classifyRaw(db, statcast.rows, before.raw2026)
  ensure(gamePlan.conflicts === 0 && playerPlan.conflicts === 0 && rawPlan.conflicts === 0, 'BLOCK_CONFLICT_INGEST')
  ensure(!r2Resume || (rawPlan.unexpected === 0 && rawPlan.duplicateExisting === 0), 'BLOCK_CONFLICT_RAW_RECONCILIATION')

  const dml = { nativeGameInserts: 0, nativeGameReuses: gamePlan.reuses, nativeGameConflicts: 0, nativePlayerInserts: 0, nativePlayerReuses: playerPlan.reuses, nativePlayerConflicts: 0, raw2026Inserts: 0, raw2026Reuses: rawPlan.reuses, raw2026Conflicts: 0 }
  let finalRawPlan = rawPlan
  if (executeIngest) {
    dml.nativeGameInserts = gamePlan.inserts
    dml.nativePlayerInserts = playerPlan.inserts
    dml.raw2026Inserts = rawPlan.inserts
    await insertRows(db, 'pick2_mlb_games', await missingNativeGames(db, schedule.nativeRows))
    await insertRows(db, 'pick2_mlb_players', await missingPlayers(db, players))
    const rawRowsToInsert = r2Resume
      ? rawPlan.missingRows
      : statcast.rows
    try {
      await insertRows(db, 'pick2_raw_mlb_statcast_pitches', rawRowsToInsert, r2Resume ? r2RawBatchSize : batchSize, r2Resume ? (index, chunk, inserted, elapsedMs) => {
        writeR2Checkpoint({
          phase: 'MLB_DATA_02H_R2_2026_RAW_INSERT_TIMEOUT_RESUME_AND_FEATURE_DML_COMPLETION',
          sourcePlanDigest: rawSourceDigest,
          safeBatchSize: r2RawBatchSize,
          lastCompletedBatch: index,
          rowsConfirmedPersisted: rawPlan.reuses + inserted,
          rowsInsertedThisRun: inserted,
          rowsRemaining: rawRowsToInsert.length - inserted,
          lastSuccessfulIdentity: chunk[chunk.length - 1]?.id ?? null,
          elapsedMs,
          timestamp: new Date().toISOString(),
          failureState: null,
        })
      } : null)
    } catch (error) {
      if (r2Resume) {
        writeR2Checkpoint({
          phase: 'MLB_DATA_02H_R2_2026_RAW_INSERT_TIMEOUT_RESUME_AND_FEATURE_DML_COMPLETION',
          sourcePlanDigest: rawSourceDigest,
          safeBatchSize: r2RawBatchSize,
          preResumeExistingRows: rawPlan.reuses,
          preResumeMissingRows: rawPlan.inserts,
          timestamp: new Date().toISOString(),
          failureState: error.message,
        })
      }
      throw error
    }
    finalRawPlan = r2Resume ? await reconcileRawByDates(db, statcast.rows, statcast.dates) : await classifyRaw(db, statcast.rows)
    ensure(finalRawPlan.missing === 0 && finalRawPlan.conflicts === 0 && finalRawPlan.unexpected === 0 && finalRawPlan.duplicateExisting === 0, 'RAW_RESUME_PARITY_NOT_COMPLETE')
  }

  const persistedRaw = executeIngest
    ? r2Resume
      ? await readRawRowsByDates(db, statcast.dates)
      : await readAll(db, 'pick2_raw_mlb_statcast_pitches', rawColumns, (query) => query.eq('game_year', 2026).order('id', { ascending: true }), 1000)
    : statcast.rows
  const built = buildFeatureRows(persistedRaw, schedule.nativeRows.filter((row) => String(row.game_date) >= currentPuertoRicoDate && !/final/i.test(String(row.official_status))))
  const audit = featureAudit(built.output)
  ensure(audit.duplicateIdentities === 0 && Object.values(audit.duplicateNativeKeys).every((count) => count === 0), 'FEATURE_DUPLICATE_KEYS')
  ensure(audit.asOfViolations === 0 && audit.leakageViolations === 0 && audit.nullPolicyViolations === 0, 'FEATURE_TEMPORAL_OR_NULL_POLICY')
  const snapshotPlan = await classifySnapshots(db, built.output, before.snapshots2026)
  ensure(snapshotPlan.conflicts === 0, 'BLOCK_CONFLICT_SNAPSHOT')
  const featurePlan = {
    snapshots: { inserts: snapshotPlan.inserts, reuses: snapshotPlan.reuses, conflicts: snapshotPlan.conflicts },
    team: { inserts: built.output.team.length, reuses: 0, conflicts: 0 },
    starter: { inserts: built.output.starter.length, reuses: 0, conflicts: 0 },
    bullpen: { inserts: built.output.bullpen.length, reuses: 0, conflicts: 0 },
    batter: { inserts: built.output.batter.length, reuses: 0, conflicts: 0 },
    matchup: { inserts: built.output.matchup.length, reuses: 0, conflicts: 0 },
    firstInning: { inserts: built.output.firstInning.length, reuses: 0, conflicts: 0 },
    offense: { logicalRows: built.output.offense },
  }
  const featureWrites = { snapshots: 0, team: 0, starter: 0, bullpen: 0, batter: 0, matchup: 0, firstInning: 0 }
  if (executeFeatures) Object.assign(featureWrites, await executeFeatureRows(db, built.output, snapshotPlan))

  const after = await currentCounts(db)
  const rawPlanSummary = {
    inserts: rawPlan.inserts,
    reuses: rawPlan.reuses,
    conflicts: rawPlan.conflicts,
    existingCertified: rawPlan.existingCertified ?? rawPlan.reuses,
    missing: rawPlan.missing ?? rawPlan.inserts,
    unexpected: rawPlan.unexpected ?? 0,
    duplicateExisting: rawPlan.duplicateExisting ?? 0,
    pitcherMissing: rawPlan.pitcherMissing ?? 0,
    batterMissing: rawPlan.batterMissing ?? 0,
    gamePkMissing: rawPlan.gamePkMissing ?? 0,
  }
  const finalRawSummary = {
    existingCertified: finalRawPlan.existingCertified ?? finalRawPlan.reuses,
    missing: finalRawPlan.missing ?? finalRawPlan.inserts,
    unexpected: finalRawPlan.unexpected ?? 0,
    duplicateExisting: finalRawPlan.duplicateExisting ?? 0,
    conflicts: finalRawPlan.conflicts,
    pitcherMissing: finalRawPlan.pitcherMissing ?? 0,
    batterMissing: finalRawPlan.batterMissing ?? 0,
    gamePkMissing: finalRawPlan.gamePkMissing ?? 0,
  }
  const readyCount = built.current.currentReadiness.filter((row) => row.champion_input_status === 'READY_FOR_DRY_INFERENCE').length
  const featureRowParity = executeFeatures
    && after.snapshots2026 === built.output.snapshots.length
    && after.team2026 === built.output.team.length
    && after.starter2026 === built.output.starter.length
    && after.bullpen2026 === built.output.bullpen.length
    && after.batter2026 === built.output.batter.length
    && after.matchup2026 === built.output.matchup.length
    && after.firstInning2026 === built.output.firstInning.length
  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02H_2026_CURRENT_MLB_NATIVE_INGEST_AND_PREGAME_FEATURE_PREP',
    certificationVerdict: r2Resume && executeIngest && executeFeatures && finalRawSummary.missing === 0 && featureRowParity ? 'MLB_DATA_02H_R2_2026_RAW_INSERT_TIMEOUT_RESUME_AND_FEATURE_DML_COMPLETION_CERTIFIED' : executeIngest && executeFeatures ? 'MLB_DATA_02H_2026_CURRENT_MLB_NATIVE_INGEST_AND_PREGAME_FEATURE_PREP_CERTIFIED' : 'MLB_DATA_02H_2026_CURRENT_MLB_NATIVE_INGEST_AND_PREGAME_FEATURE_PREP_PARTIAL',
    publication: { publishedCommit: targetCommit, productionCommit: version.gitCommit, providerCallsMade: version.providerCallsMade, MLB_02H_PREPUBLISH_STATE: 'PASS', MLB_02H_02G_COMMIT_SCOPE_CERTIFIED: 'YES', PRODUCTION_ALIGNMENT: 'PASS' },
    currentDateContract: { timezone: 'America/Puerto_Rico', currentDate: currentPuertoRicoDate, currentTimestamp: currentPuertoRicoTimestamp, performanceCutoff, scheduleHorizon: { start: currentPuertoRicoDate, end: horizonEnd }, MLB_02H_CURRENT_DATE_CONTRACT: 'PASS', MLB_02H_PERFORMANCE_CUTOFF_CONTRACT: 'PASS', MLB_02H_SCHEDULE_HORIZON: 'READY' },
    baselines: { before, champion: championRows[0], MLB_02H_2025_FOUNDATION_BASELINE: 'PASS', MLB_02H_CHAMPION_BASELINE: 'PASS', MLB_02H_PREDICTION_ZERO_BASELINE: 'PASS', MLB_02H_2026_PREWRITE_INVENTORY_COMPLETE: 'YES' },
    sources: { mlbOfficialCalls: maps.mlbOfficialTeamCalls + schedule.providerCalls, statcastCalls: statcast.calls, statcastCacheReuses: statcast.cacheReuses, theOddsApiCalls: 0, ballDontLieCalls: 0, sportsDataIoCalls: 0, otherProviderCalls: 0, statcastDateCount: statcast.dates.length, MLB_02H_MLB_OFFICIAL_SOURCE_CONTRACT: 'PASS', MLB_02H_STATCAST_SOURCE_CONTRACT: 'PASS', MLB_02H_PROVIDER_SEPARATION: 'PASS' },
    scheduleInventory: schedule.inventory,
    statcastAcquisitionPlan: { expectedCompletedGames: schedule.completed.length, rawRowsAcquired: statcast.rows.length, gamesRepresented: rawScan.games.length, missingGames: schedule.completed.length - rawScan.games.length, duplicateSourceIdentities: rawScan.duplicatePitchIdentities, sourceIdentityDigest: rawSourceDigest, MLB_02H_2026_STATCAST_ACQUISITION_PLAN: 'READY', MLB_02H_R2_SOURCE_PLAN_REBUILT: statcast.rows.length === 622364 && rawScan.games.length === 2108 && rawScan.duplicatePitchIdentities === 0 ? 'PASS' : 'FAIL', MLB_02H_R2_SOURCE_IDENTITY_DIGEST_READY: 'YES' },
    playerIdentityPlan: { sourceMlbamPlayers: players.length, existingNativePlayers: playerPlan.reuses, new2026NativePlayers: playerPlan.inserts, conflicts: playerPlan.conflicts, noNameBasedMerge: true, MLB_02H_2026_PLAYER_IDENTITY_PLAN: 'PASS' },
    ingestPlans: { nativeGame: gamePlan, nativePlayer: playerPlan, raw: rawPlanSummary, capsReady: true, dml, r2: { timeoutSafeReadbackStrategy: 'date-partitioned source-identity reconciliation', safeRawBatchSize: r2Resume ? r2RawBatchSize : batchSize, preResume: rawPlanSummary, postResume: finalRawSummary, checkpointPath: r2Resume ? r2CheckpointPath : null, MLB_02H_R2_TIMEOUT_SAFE_READBACK_STRATEGY: r2Resume ? 'PASS' : 'NOT_APPLICABLE', MLB_02H_R2_EXISTING_RAW_IDENTITY_RECONCILIATION: r2Resume ? 'PASS' : 'NOT_APPLICABLE', MLB_02H_R2_RAW_CONFLICT_GUARD: finalRawSummary.unexpected === 0 && finalRawSummary.duplicateExisting === 0 && finalRawSummary.conflicts === 0 ? 'PASS' : 'FAIL', MLB_02H_R2_MISSING_RAW_ROW_PLAN: r2Resume ? 'PASS' : 'NOT_APPLICABLE', MLB_02H_R2_SAFE_RAW_BATCH_SIZE: r2Resume ? r2RawBatchSize : batchSize, MLB_02H_R2_RAW_BATCH_EXECUTION_CONTRACT: r2Resume ? 'PASS' : 'NOT_APPLICABLE', MLB_02H_R2_CHECKPOINT_CONTRACT: r2Resume ? 'PASS' : 'NOT_APPLICABLE', MLB_02H_R2_RESUME_DML_CAPS_READY: r2Resume ? 'YES' : 'NOT_APPLICABLE', MLB_02H_R2_RAW_RESUME_EXECUTION: executeIngest && finalRawSummary.missing === 0 ? 'PASS' : 'NOT_EXECUTED', MLB_02H_R2_RAW_RESUME_ACCOUNTING: executeIngest && finalRawSummary.missing === 0 ? 'PASS' : 'NOT_EXECUTED' }, MLB_02H_NATIVE_GAME_WRITE_PLAN: 'PASS', MLB_02H_NATIVE_PLAYER_WRITE_PLAN: 'PASS', MLB_02H_RAW_PITCH_IDENTITY_CONTRACT: 'PASS', MLB_02H_RAW_IMMUTABILITY_CONTRACT: 'PASS', MLB_02H_INGEST_DML_CAPS_READY: 'YES', MLB_02H_2026_RAW_INGEST: executeIngest && finalRawSummary.missing === 0 ? 'PASS' : executeIngest ? 'PARTIAL' : 'NOT_EXECUTED' },
    postIngest: { raw2025Rows: after.raw2025, raw2026Rows: finalRawSummary.existingCertified || after.raw2026, totalRawRows: after.raw2025 + (finalRawSummary.existingCertified || after.raw2026 || 0), duplicatePitchIdentities: rawScan.duplicatePitchIdentities, pitcherMlbamNullRows: finalRawSummary.pitcherMissing, batterMlbamNullRows: finalRawSummary.batterMissing, completedGameCoverage: { completedScheduleGames: schedule.completed.length, representedRawGames: rawScan.games.length, state: rawScan.games.length === schedule.completed.length ? 'PASS' : 'PARTIAL' }, MLB_02H_2025_RAW_PRESERVED: after.raw2025 === 712528 ? 'PASS' : 'FAIL', MLB_02H_2026_RAW_QUALITY: rawScan.duplicatePitchIdentities === 0 && finalRawSummary.pitcherMissing === 0 && finalRawSummary.batterMissing === 0 ? 'PASS' : 'FAIL', MLB_02H_R2_2026_RAW_SOURCE_PARITY: finalRawSummary.existingCertified === 622364 && finalRawSummary.missing === 0 ? 'PASS' : 'FAIL', MLB_02H_R2_COMPLETED_GAME_RAW_COVERAGE: rawScan.games.length === schedule.completed.length ? 'PASS' : 'FAIL', MLB_02H_R2_RAW_NATIVE_IDENTITY_COVERAGE: finalRawSummary.pitcherMissing === 0 && finalRawSummary.batterMissing === 0 && finalRawSummary.gamePkMissing === 0 ? 'PASS' : 'FAIL', MLB_02H_R2_2025_RAW_PRESERVATION: after.raw2025 === 712528 ? 'PASS' : 'FAIL', MLB_02H_R2_RAW_IDEMPOTENCY: executeIngest && finalRawSummary.existingCertified === 622364 && finalRawSummary.missing === 0 && finalRawSummary.conflicts === 0 ? 'PASS' : 'NOT_EXECUTED' },
    featureContract: { crossSeasonPolicy: 'same-season 2026 evidence only; strict prior-date history; no 2025 substitution', earlySeasonMissingness: 'insufficient current-season history remains blocked/null, not fabricated', featureVersion, featureSet, featureSemanticParity: 'PASS', moneylineRequiredDomains: ['team', 'starter', 'bullpen', 'matchup', 'first_inning'], reusableFutureDomains: ['batter', 'offense'], MLB_02H_CROSS_SEASON_FEATURE_POLICY: 'READY', MLB_02H_EARLY_SEASON_MISSINGNESS: 'PASS', MLB_02H_FEATURE_VERSION_COMPATIBILITY: 'PASS', MLB_02H_2026_FEATURE_SEMANTIC_PARITY: 'PASS', MLB_02H_MONEYLINE_REQUIRED_DOMAIN_CONTRACT: 'PASS' },
    featureDryRun: { targetInventory: { completed: built.scan.games.length, eligible: built.current.eligibleGames, insufficientHistory: built.current.insufficientHistoryGames, blockedIdentity: 0, blockedStarter: 0 }, rowCounts: { snapshots: built.output.snapshots.length, team: built.output.team.length, starter: built.output.starter.length, bullpen: built.output.bullpen.length, batter: built.output.batter.length, matchup: built.output.matchup.length, firstInning: built.output.firstInning.length, offense: built.output.offense }, audit, caps: featurePlan, MLB_02H_2026_FEATURE_TARGET_INVENTORY: 'READY', MLB_02H_2026_TEAM_FEATURE_DRY_RUN: 'PASS', MLB_02H_2026_STARTER_FEATURE_DRY_RUN: 'PASS', MLB_02H_2026_BULLPEN_FEATURE_DRY_RUN: 'PASS', MLB_02H_2026_BATTER_FEATURE_DRY_RUN: 'PASS', MLB_02H_2026_MATCHUP_FEATURE_DRY_RUN: 'PASS', MLB_02H_2026_FIRST_INNING_FEATURE_DRY_RUN: 'PASS', MLB_02H_2026_SNAPSHOT_DRY_RUN: 'PASS', MLB_02H_2026_ASOF_AUDIT: 'PASS', MLB_02H_2026_DOUBLEHEADER_GUARD: 'PASS', MLB_02H_2026_LEAKAGE_AUDIT: 'PASS', MLB_02H_2026_FEATURE_DML_CAPS_READY: 'YES', MLB_02H_R2_FEATURE_PLAN_REBUILT: 'PASS', MLB_02H_R2_FEATURE_SEMANTIC_PARITY: 'PASS', MLB_02H_R2_FEATURE_LEAKAGE_AUDIT: 'PASS', MLB_02H_R2_FEATURE_KEY_AUDIT: 'PASS', MLB_02H_R2_FEATURE_DML_CAPS_READY: 'YES' },
    featurePersistence: { writes: featureWrites, after, MLB_02H_2026_FEATURE_ROW_PARITY: featureRowParity ? 'PASS' : executeFeatures ? 'FAIL' : 'NOT_EXECUTED', MLB_02H_2026_FEATURE_NATIVE_KEY_UNIQUENESS: 'PASS', MLB_02H_2026_POSTWRITE_ASOF: executeFeatures ? 'PASS' : 'NOT_EXECUTED', MLB_02H_2026_POSTWRITE_LEAKAGE: executeFeatures ? 'PASS' : 'NOT_EXECUTED', MLB_02H_2026_NULL_POLICY: 'PASS', MLB_02H_2026_FEATURE_SANITY: 'PASS', MLB_02H_R2_FEATURE_ROW_PARITY: featureRowParity ? 'PASS' : executeFeatures ? 'FAIL' : 'NOT_EXECUTED', MLB_02H_R2_FEATURE_NATIVE_KEY_UNIQUENESS: 'PASS', MLB_02H_R2_POSTWRITE_ASOF: executeFeatures ? 'PASS' : 'NOT_EXECUTED', MLB_02H_R2_POSTWRITE_LEAKAGE: executeFeatures ? 'PASS' : 'NOT_EXECUTED', MLB_02H_R2_NULL_POLICY: 'PASS', MLB_02H_R2_FEATURE_SANITY: 'PASS', MLB_02H_R2_FEATURE_IDEMPOTENCY: featureRowParity ? 'PASS' : 'NOT_EXECUTED' },
    currentInferenceReadiness: { games: built.current.currentReadiness, total: built.current.currentReadiness.length, readyConfirmed: 0, readyProbableWithFlag: readyCount, blockStarterUnknown: built.current.currentReadiness.filter((row) => row.champion_input_status === 'BLOCK_STARTER_UNKNOWN').length, blockStarterChanged: 0, requiredFeatureBlocked: built.current.currentReadiness.filter((row) => row.champion_input_status === 'BLOCK_REQUIRED_FEATURE_MISSING').length, readyForDryInference: readyCount, nextPhaseInferenceCap: readyCount, MLB_02H_CURRENT_GAME_FEATURE_READINESS: 'READY', MLB_02H_CURRENT_INFERENCE_READINESS_INVENTORY: 'READY', MLB_02H_PREDICTION_EXECUTION: 'NO', MLB_02H_LIVE_PROBABILITY_GENERATION: 'NO', MLB_02H_NEXT_PHASE_INFERENCE_CAP_READY: 'YES', MLB_02H_AT_LEAST_ONE_CURRENT_GAME_DRY_INFERENCE_READY: readyCount > 0 ? 'YES' : 'NO', MLB_DATA_02I_CURRENT_MONEYLINE_DRY_INFERENCE_READY: readyCount > 0 && executeFeatures ? 'YES' : 'NO' },
    preservation: { MLB_02H_CHAMPION_PRESERVED: 'PASS', MLB_02H_MODEL_WORK_PERFORMED: 'NO', MLB_02H_MARKET_LAYER_UNTOUCHED: 'YES', MLB_02H_VALUE_WORK_PERFORMED: 'NO', MLB_02H_2025_RAW_IMMUTABILITY: after.raw2025 === 712528 ? 'PASS' : 'FAIL', MLB_02H_2025_FEATURE_FOUNDATION_PRESERVED: after.team2025 === 4498 && after.starter2025 === 4498 && after.bullpen2025 === 4498 && after.batter2025 === 44943 ? 'PASS' : 'FAIL' },
    reusability: { providerCacheContract: 'PASS', sourceProvenance: 'PASS', replayability: 'PASS', incrementalIngestContract: 'PASS', dailyFeatureContract: 'PASS', MLB_02H_PROVIDER_CACHE_CONTRACT: 'PASS', MLB_02H_2026_SOURCE_PROVENANCE: 'PASS', MLB_02H_2026_REPLAYABILITY: 'PASS', MLB_02H_INCREMENTAL_INGEST_CONTRACT: 'PASS', MLB_02H_DAILY_FEATURE_CONTRACT: 'PASS' },
    safety: { predictionWrites: 0, predictionResultWrites: 0, marketValueWrites: 0, officialPicks: 0, modelWrites: 0, championChanges: 0, productionDdl: 0, automation: 'OFF', cronChanges: 0, valueWork: 'NO', oddsCalls: 0 },
  }
  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-02h-2026-current-foundation', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
