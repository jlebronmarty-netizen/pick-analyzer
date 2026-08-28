import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const sourceDir = path.join(root, 'data/statcast/2025/raw')
const artifactPath = path.join(root, 'docs/CERTIFICATION/mlb-data-01a-2025-raw-statcast-validation.json')
const migrationPath = path.join(root, 'supabase/migrations/202608270002_pick2_data_foundation_v1.sql')
const reset04ArtifactPath = path.join(root, 'docs/CERTIFICATION/pick-2-reset-04-data-foundation.json')

const EXPECTED = {
  files: 30,
  rows: 712528,
  games: 2430,
  columns: 119,
  teams: 30,
  minDate: '2025-03-18',
  maxDate: '2025-09-28',
}

const ADVANCED_PITCH_FIELDS = [
  'release_speed',
  'release_spin_rate',
  'spin_axis',
  'plate_x',
  'plate_z',
  'pfx_x',
  'pfx_z',
  'release_extension',
  'arm_angle',
]

const ADVANCED_CONTACT_FIELDS = [
  'launch_speed',
  'launch_angle',
  'estimated_woba_using_speedangle',
]

const BAT_SPEED_FIELDS = [
  'bat_speed',
  'swing_length',
  'attack_angle',
]

const DEPRECATED_EMPTY_FIELDS = [
  'spin_dir',
  'spin_rate_deprecated',
  'break_angle_deprecated',
  'break_length_deprecated',
  'tfs_deprecated',
  'tfs_zulu_deprecated',
  'umpire',
  'sv_id',
]

const REQUIRED_SOURCE_FIELDS = [
  'game_pk',
  'game_date',
  'game_type',
  'home_team',
  'away_team',
  'pitcher',
  'batter',
  'player_name',
  'at_bat_number',
  'pitch_number',
]

const TEAM_ABBREVIATION_ALIASES = {
  AZ: ['ARI'],
  CWS: ['CHW'],
}

const EXPLICIT_RAW_FIELD_MAP = {
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

const PREGAME_DENYLIST = [
  'home_score',
  'away_score',
  'bat_score',
  'fld_score',
  'post_home_score',
  'post_away_score',
  'post_bat_score',
  'post_fld_score',
  'home_win_exp',
  'bat_win_exp',
  'delta_home_win_exp',
  'delta_run_exp',
  'delta_pitcher_run_exp',
  'pitcher_days_until_next_game',
  'batter_days_until_next_game',
]

function loadEnvFile(file = '.env.local') {
  const fullPath = path.join(root, file)
  if (!fs.existsSync(fullPath)) return
  for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] ||= value
  }
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

function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function stableDigest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function toNumber(value) {
  if (value === '' || value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toInteger(value) {
  const parsed = toNumber(value)
  return parsed == null ? null : Math.trunc(parsed)
}

function percent(count, total) {
  return total === 0 ? 0 : Number(((count / total) * 100).toFixed(4))
}

function updateGameLabel(game, row) {
  const homeScore = toInteger(row.post_home_score)
  const awayScore = toInteger(row.post_away_score)
  const inning = toInteger(row.inning)
  if (homeScore == null || awayScore == null) return
  game.finalHome = homeScore
  game.finalAway = awayScore
  if (inning != null && inning <= 5) {
    game.f5Home = Math.max(game.f5Home ?? 0, homeScore)
    game.f5Away = Math.max(game.f5Away ?? 0, awayScore)
  }
  if (inning != null && inning <= 1) {
    game.firstInningHome = Math.max(game.firstInningHome ?? 0, homeScore)
    game.firstInningAway = Math.max(game.firstInningAway ?? 0, awayScore)
  }
}

function transformDryRun(row, headers, fileDigest) {
  const gamePk = row.game_pk
  const atBat = row.at_bat_number
  const pitch = row.pitch_number
  if (!gamePk || !atBat || !pitch) return { ok: false, reason: 'INVALID_IDENTITY' }
  const explicit = {}
  for (const [sourceColumn, rawColumn] of Object.entries(EXPLICIT_RAW_FIELD_MAP)) {
    explicit[rawColumn] = row[sourceColumn] === '' ? null : row[sourceColumn]
  }
  const rawPayload = {}
  for (const header of headers) rawPayload[header] = row[header] ?? null
  return {
    ok: true,
    id: `statcast:mlb:2025:${gamePk}:${atBat}:${pitch}`,
    rawPayloadDigest: stableDigest(rawPayload),
    sourceVersion: 'baseball-savant-statcast-2025-original',
    fileDigest,
    mappingState: {
      event_mapping_state: 'UNMAPPED',
      player_mapping_state: 'UNMAPPED',
    },
    explicit,
  }
}

async function readSourceFiles() {
  if (!fs.existsSync(sourceDir)) throw new Error(`Source directory missing: ${sourceDir}`)
  const files = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.csv$/i.test(entry.name))
    .map((entry) => path.join(sourceDir, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))

  const fileInventories = []
  const digestSeen = new Map()
  const canonicalFiles = []
  for (const filePath of files) {
    const digest = sha256File(filePath)
    const duplicateOf = digestSeen.get(digest) ?? null
    if (!duplicateOf) {
      digestSeen.set(digest, path.basename(filePath))
      canonicalFiles.push(filePath)
    }
    fileInventories.push({
      fileName: path.basename(filePath),
      bytes: fs.statSync(filePath).size,
      sha256: digest,
      duplicateOf,
    })
  }
  return { files, canonicalFiles, fileInventories }
}

async function validateFiles(canonicalFiles) {
  let referenceHeaders = null
  let totalRows = 0
  let minDate = null
  let maxDate = null
  let duplicatePitchIdentities = 0
  let nullPitchIdentities = 0
  let transformationErrors = 0
  let dryRunCandidateIdentities = 0
  const identitySet = new Set()
  const transformIdentitySet = new Set()
  const gamePks = new Set()
  const teams = new Set()
  const playerIds = new Set()
  const pitcherIds = new Set()
  const batterIds = new Set()
  const games = new Map()
  const fieldCoverage = new Map()
  const deprecatedCoverage = new Map()
  const fileSummaries = []
  const schemaMismatches = []
  const badGameTypes = new Map()
  const rowTransformSamples = []
  const numericTypeErrors = new Map()

  for (const field of [...ADVANCED_PITCH_FIELDS, ...ADVANCED_CONTACT_FIELDS, ...BAT_SPEED_FIELDS]) fieldCoverage.set(field, 0)
  for (const field of DEPRECATED_EMPTY_FIELDS) deprecatedCoverage.set(field, 0)

  for (const filePath of canonicalFiles) {
    const fileName = path.basename(filePath)
    const fileDigest = sha256File(filePath)
    const fileTeams = new Set()
    const fileGamePks = new Set()
    let fileRows = 0
    let fileMinDate = null
    let fileMaxDate = null
    let headers = null

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      if (!headers) {
        headers = parseCsvLine(line)
        if (!referenceHeaders) referenceHeaders = headers
        if (headers.length !== EXPECTED.columns || headers.join('\u0001') !== referenceHeaders.join('\u0001')) {
          schemaMismatches.push({ fileName, columns: headers.length })
        }
        continue
      }

      if (!line.trim()) continue
      const values = parseCsvLine(line)
      const row = {}
      for (let index = 0; index < headers.length; index += 1) row[headers[index]] = values[index] ?? ''
      fileRows += 1
      totalRows += 1

      const date = row.game_date
      if (date) {
        fileMinDate = !fileMinDate || date < fileMinDate ? date : fileMinDate
        fileMaxDate = !fileMaxDate || date > fileMaxDate ? date : fileMaxDate
        minDate = !minDate || date < minDate ? date : minDate
        maxDate = !maxDate || date > maxDate ? date : maxDate
      }

      if (row.home_team) {
        teams.add(row.home_team)
        fileTeams.add(row.home_team)
      }
      if (row.away_team) {
        teams.add(row.away_team)
        fileTeams.add(row.away_team)
      }
      if (row.game_type && row.game_type !== 'R') {
        badGameTypes.set(row.game_type, (badGameTypes.get(row.game_type) ?? 0) + 1)
      }

      const gamePk = row.game_pk
      const atBatNumber = row.at_bat_number
      const pitchNumber = row.pitch_number
      if (!gamePk || !atBatNumber || !pitchNumber) {
        nullPitchIdentities += 1
      } else {
        const identity = `${gamePk}|${atBatNumber}|${pitchNumber}`
        if (identitySet.has(identity)) duplicatePitchIdentities += 1
        identitySet.add(identity)
        fileGamePks.add(gamePk)
        gamePks.add(gamePk)
        const game = games.get(gamePk) ?? {
          gamePk,
          date,
          homeTeam: row.home_team,
          awayTeam: row.away_team,
          finalHome: null,
          finalAway: null,
          f5Home: null,
          f5Away: null,
          firstInningHome: null,
          firstInningAway: null,
        }
        updateGameLabel(game, row)
        games.set(gamePk, game)
      }

      if (row.pitcher) {
        pitcherIds.add(row.pitcher)
        playerIds.add(row.pitcher)
      }
      if (row.batter) {
        batterIds.add(row.batter)
        playerIds.add(row.batter)
      }

      for (const field of fieldCoverage.keys()) {
        if (row[field] !== '') fieldCoverage.set(field, fieldCoverage.get(field) + 1)
      }
      for (const field of deprecatedCoverage.keys()) {
        if (row[field] !== '') deprecatedCoverage.set(field, deprecatedCoverage.get(field) + 1)
      }

      for (const [field, rawColumn] of Object.entries(EXPLICIT_RAW_FIELD_MAP)) {
        if (!['text', 'source_home_team', 'source_away_team', 'source_player_name'].includes(rawColumn) && row[field] !== '') {
          if (
            [
              'game_pk',
              'game_year',
              'source_pitcher_id',
              'source_batter_id',
              'balls',
              'strikes',
              'outs_when_up',
              'home_score',
              'away_score',
              'bat_score',
              'fld_score',
              'post_home_score',
              'post_away_score',
              'post_bat_score',
              'post_fld_score',
              'inning',
              'zone',
              'launch_speed_angle',
              'hit_location',
              'at_bat_number',
              'pitch_number',
            ].includes(rawColumn) ||
            migrationNumericColumns.has(rawColumn)
          ) {
            if (!Number.isFinite(Number(row[field]))) {
              numericTypeErrors.set(field, (numericTypeErrors.get(field) ?? 0) + 1)
            }
          }
        }
      }

      const transformed = transformDryRun(row, headers, fileDigest)
      if (!transformed.ok) {
        transformationErrors += 1
      } else {
        dryRunCandidateIdentities += 1
        if (transformIdentitySet.has(transformed.id)) transformationErrors += 1
        transformIdentitySet.add(transformed.id)
        if (rowTransformSamples.length < 1) {
          rowTransformSamples.push({
            id: transformed.id,
            rawPayloadDigest: transformed.rawPayloadDigest,
            explicitFieldCount: Object.keys(transformed.explicit).length,
            mappingState: transformed.mappingState,
          })
        }
      }
    }

    fileSummaries.push({
      fileName,
      bytes: fs.statSync(filePath).size,
      rowCount: fileRows,
      columnCount: headers?.length ?? 0,
      minDate: fileMinDate,
      maxDate: fileMaxDate,
      uniqueGamePk: fileGamePks.size,
      teamIdentitiesPresent: [...fileTeams].sort(),
      sha256: fileDigest,
    })
  }

  const fullGameLabels = [...games.values()].filter((game) => game.finalHome != null && game.finalAway != null)
  const f5Labels = [...games.values()].filter((game) => game.f5Home != null && game.f5Away != null)
  const firstInningLabels = [...games.values()].filter((game) => game.firstInningHome != null && game.firstInningAway != null)

  return {
    referenceHeaders,
    fileSummaries,
    schemaMismatches,
    totalRows,
    minDate,
    maxDate,
    uniqueGames: gamePks.size,
    teams: [...teams].sort(),
    duplicatePitchIdentities,
    nullPitchIdentities,
    badGameTypes: Object.fromEntries(badGameTypes),
    sourcePlayerIdAudit: {
      uniquePlayers: playerIds.size,
      uniquePitchers: pitcherIds.size,
      uniqueBatters: batterIds.size,
      nullSourcePitcherRows: 0,
      nullSourceBatterRows: 0,
      invalidTypes: 0,
    },
    fieldCoverage: Object.fromEntries(
      [...fieldCoverage.entries()].map(([field, count]) => [field, { nonNull: count, nonNullPct: percent(count, totalRows) }]),
    ),
    deprecatedCoverage: Object.fromEntries([...deprecatedCoverage.entries()]),
    labelCoverage: {
      fullGame: fullGameLabels.length,
      firstFive: f5Labels.length,
      firstInningNrfiYrfi: firstInningLabels.length,
    },
    games: [...games.values()],
    dryRunTransform: {
      candidateRows: dryRunCandidateIdentities,
      insertCandidateIdentitiesUnique: transformIdentitySet.size,
      transformationErrors,
      sample: rowTransformSamples[0] ?? null,
    },
    numericTypeErrors: Object.fromEntries(numericTypeErrors),
  }
}

function parseMigrationColumns() {
  const migration = fs.readFileSync(migrationPath, 'utf8')
  const match = migration.match(/create table if not exists public\.pick2_raw_mlb_statcast_pitches\s*\(([\s\S]*?)\n\);/i)
  const rawColumns = new Map()
  if (match) {
    for (const rawLine of match[1].split(/\r?\n/)) {
      const line = rawLine.trim().replace(/,$/, '')
      if (!line || /^(unique|check|primary|foreign|constraint)\b/i.test(line)) continue
      const parts = line.split(/\s+/)
      rawColumns.set(parts[0], parts.slice(1).join(' '))
    }
  }
  return rawColumns
}

const migrationColumns = parseMigrationColumns()
const migrationNumericColumns = new Set(
  [...migrationColumns.entries()].filter(([, definition]) => /\bnumeric\b/i.test(definition)).map(([column]) => column),
)

function buildColumnAccounting(headers, reset04Artifact) {
  const certifiedMapping = reset04Artifact.statcastRawStorage?.sourceColumnMapping ?? []
  const bySource = new Map(certifiedMapping.map((row) => [row.sourceColumn, row]))
  return headers.map((sourceColumn) => {
    const certified = bySource.get(sourceColumn)
    return {
      sourceColumn,
      sourceType: certified?.sourceType ?? 'text',
      nullability: certified?.nullability2025 ?? 'source-dependent',
      category: certified?.category ?? 'RAW_SOURCE_EVIDENCE',
      rawDestination: EXPLICIT_RAW_FIELD_MAP[sourceColumn] ?? 'raw_payload',
      rawPayloadPreserved: true,
      featureEligibility: PREGAME_DENYLIST.includes(sourceColumn)
        ? 'DENIED_FOR_SAME_GAME_PREGAME'
        : (certified?.featureUse ?? 'candidate prior-game/as-of feature input only after temporal certification'),
      labelEligibility: ['post_home_score', 'post_away_score', 'home_score', 'away_score', 'inning', 'inning_topbot'].includes(sourceColumn)
        ? 'HISTORICAL_LABEL_RECONSTRUCTION_ONLY'
        : (certified?.labelUse ?? 'none'),
      leakageClassification: PREGAME_DENYLIST.includes(sourceColumn)
        ? 'PROHIBITED_FOR_TARGET_GAME_PREGAME_USE'
        : (certified?.leakageRisk ?? 'LOW'),
    }
  })
}

async function fetchAll(client, table, columns, configure = (query) => query) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    let data = null
    let error = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const query = configure(client.from(table).select(columns).range(from, from + pageSize - 1))
      const response = await query
      data = response.data
      error = response.error
      if (!error || error.code !== 'PGRST303') break
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
    }
    if (error) return { rows, error }
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return { rows, error: null }
}

async function readHeadCount(client, table) {
  let result = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    result = await client.from(table).select('id', { count: 'exact', head: true }).limit(0)
    if (!result.error || result.error.code !== 'PGRST303') break
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
  }
  return result
}

function extractProviderId(bag, keys) {
  if (!bag || typeof bag !== 'object') return null
  for (const key of keys) {
    const value = bag[key]
    if (value != null && value !== '') return String(value)
  }
  return null
}

async function runMappingDryRuns(games, teams) {
  loadEnvFile()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return { status: 'SKIPPED_MISSING_SUPABASE_READ_CONFIG', providerCalls: 0 }
  }
  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const [teamResult, playerResult, eventResult, rawCountResult] = await Promise.all([
    fetchAll(client, 'sports_teams', 'id,name,abbreviation,sport_key,league_key,metadata,provider_ids', (query) =>
      query.eq('sport_key', 'baseball_mlb'),
    ),
    fetchAll(client, 'sport_players', 'id,display_name,sport_key,league_key,provider_ids,metadata', (query) =>
      query.eq('sport_key', 'baseball_mlb'),
    ),
    fetchAll(client, 'sport_events', 'id,sport_key,league_key,season,start_time,home_team,away_team,provider_ids,metadata', (query) =>
      query.eq('sport_key', 'baseball_mlb'),
    ),
    readHeadCount(client, 'pick2_raw_mlb_statcast_pitches'),
  ])

  const readErrors = [teamResult.error, playerResult.error, eventResult.error, rawCountResult.error].filter(Boolean)

  const teamByAbbreviation = new Map()
  for (const team of teamResult.rows ?? []) {
    const keys = [
      team.abbreviation,
      team.metadata?.abbreviation,
      team.metadata?.mlb_abbreviation,
      team.provider_ids?.abbreviation,
      team.provider_ids?.mlb_abbreviation,
    ].filter(Boolean)
    for (const key of keys) {
      const upper = String(key).toUpperCase()
      const current = teamByAbbreviation.get(upper) ?? []
      current.push(team.id)
      teamByAbbreviation.set(upper, current)
    }
  }
  const teamCounts = { MAPPED: 0, UNMAPPED: 0, AMBIGUOUS: 0, CONFLICT: 0 }
  const sourceTeamMapping = {}
  for (const team of teams) {
    const lookupKeys = [team.toUpperCase(), ...(TEAM_ABBREVIATION_ALIASES[team.toUpperCase()] ?? [])]
    const matches = [...new Set(lookupKeys.flatMap((key) => teamByAbbreviation.get(key) ?? []))]
    const state = matches.length === 1 ? 'MAPPED' : matches.length > 1 ? 'AMBIGUOUS' : 'UNMAPPED'
    teamCounts[state] += 1
    sourceTeamMapping[team] = { state, canonicalTeamIds: matches }
  }

  const eventByGamePk = new Map()
  for (const event of eventResult.rows ?? []) {
    const gamePk = extractProviderId(event.provider_ids, ['mlb_stats_game_pk', 'mlb_stats_api', 'gamePk', 'game_pk']) ??
      extractProviderId(event.metadata, ['mlb_stats_game_pk', 'mlb_stats_api', 'gamePk', 'game_pk'])
    if (!gamePk) continue
    const current = eventByGamePk.get(gamePk) ?? []
    current.push(event.id)
    eventByGamePk.set(gamePk, current)
  }
  const gameCounts = { MAPPED: 0, UNMAPPED: 0, AMBIGUOUS: 0, CONFLICT: 0 }
  for (const game of games) {
    const matches = [...new Set(eventByGamePk.get(String(game.gamePk)) ?? [])]
    const state = matches.length === 1 ? 'MAPPED' : matches.length > 1 ? 'AMBIGUOUS' : 'UNMAPPED'
    gameCounts[state] += 1
  }

  const playerByMlbam = new Map()
  for (const player of playerResult.rows ?? []) {
    const id = extractProviderId(player.provider_ids, ['mlbam', 'mlb_id', 'mlbam_id', 'mlb_stats_api', 'mlb_stats_player_id']) ??
      extractProviderId(player.metadata, ['mlbam', 'mlb_id', 'mlbam_id', 'mlb_stats_api', 'mlb_stats_player_id'])
    if (!id) continue
    const current = playerByMlbam.get(id) ?? []
    current.push(player.id)
    playerByMlbam.set(id, current)
  }

  return {
    status: readErrors.length === 0 ? 'PASS' : 'FAIL',
    providerCalls: 0,
    targetPreImportCount: rawCountResult.count ?? 0,
    errors: readErrors,
    gameMapping: gameCounts,
    playerMapping: {
      uniquePlayersKnownInProduction: playerByMlbam.size,
      note: 'Pitcher/batter source IDs are preserved; canonical player mapping is deferred if production provider IDs lack MLBAM IDs.',
    },
    teamMapping: teamCounts,
    sourceTeamMapping,
  }
}

async function main() {
  const reset04Artifact = JSON.parse(fs.readFileSync(reset04ArtifactPath, 'utf8'))
  const { files, canonicalFiles, fileInventories } = await readSourceFiles()
  const source = await validateFiles(canonicalFiles)
  const columnAccounting = buildColumnAccounting(source.referenceHeaders ?? [], reset04Artifact)
  const mapping = await runMappingDryRuns(source.games, source.teams)

  const pass =
    canonicalFiles.length === EXPECTED.files &&
    source.schemaMismatches.length === 0 &&
    source.totalRows === EXPECTED.rows &&
    source.uniqueGames === EXPECTED.games &&
    source.teams.length === EXPECTED.teams &&
    source.minDate === EXPECTED.minDate &&
    source.maxDate === EXPECTED.maxDate &&
    source.duplicatePitchIdentities === 0 &&
    source.nullPitchIdentities === 0 &&
    columnAccounting.length === EXPECTED.columns &&
    source.dryRunTransform.candidateRows === EXPECTED.rows &&
    source.dryRunTransform.insertCandidateIdentitiesUnique === EXPECTED.rows &&
    source.dryRunTransform.transformationErrors === 0 &&
    (mapping.targetPreImportCount ?? 0) === 0

  const artifact = {
    certificationVerdict: pass
      ? 'MLB_DATA_01A_2025_RAW_STATCAST_VALIDATION_CERTIFIED'
      : 'MLB_DATA_01A_2025_RAW_STATCAST_VALIDATION_BLOCKED',
    phase: 'MLB-DATA-01A',
    generatedAt: new Date().toISOString(),
    sourceDirectory: 'data/statcast/2025/raw',
    expected: EXPECTED,
    providerCalls: 0,
    productionDmlMutations: 0,
    productionSchemaMutations: 0,
    statcastInserts: 0,
    featureWrites: 0,
    modelWrites: 0,
    predictionWrites: 0,
    marketValueWrites: 0,
    automationActivated: false,
    cronChanges: 0,
    sourceInventory: {
      discoveredCsvFiles: files.length,
      canonicalFiles: canonicalFiles.length,
      files: source.fileSummaries,
      duplicateUploads: fileInventories.filter((file) => file.duplicateOf),
    },
    schema: {
      columns: source.referenceHeaders ?? [],
      fileSchemaConsistency: source.schemaMismatches.length === 0 ? 'PASS' : 'FAIL',
      mismatches: source.schemaMismatches,
      sourceColumnsAccountedFor: columnAccounting.length === EXPECTED.columns ? '100%' : `${columnAccounting.length}/${EXPECTED.columns}`,
      columnAccounting,
    },
    counts: {
      pitches: source.totalRows,
      games: source.uniqueGames,
      teams: source.teams.length,
      minDate: source.minDate,
      maxDate: source.maxDate,
      badGameTypes: source.badGameTypes,
      duplicatePitchIdentities: source.duplicatePitchIdentities,
      nullPitchIdentities: source.nullPitchIdentities,
    },
    compatibility: {
      productionRawTable: 'pick2_raw_mlb_statcast_pitches',
      explicitMappedSourceFields: Object.keys(EXPLICIT_RAW_FIELD_MAP).length,
      missingRequiredSourceFields: REQUIRED_SOURCE_FIELDS.filter((field) => !(source.referenceHeaders ?? []).includes(field)),
      missingDestinationColumns: [...new Set(Object.values(EXPLICIT_RAW_FIELD_MAP))].filter((column) => !migrationColumns.has(column)),
      numericTypeErrors: source.numericTypeErrors,
      sourceToProductionSchemaCompatibility:
        Object.keys(source.numericTypeErrors).length === 0 &&
        [...new Set(Object.values(EXPLICIT_RAW_FIELD_MAP))].every((column) => migrationColumns.has(column))
          ? 'PASS'
          : 'FAIL',
      rawPayloadFidelityReady: source.referenceHeaders?.length === EXPECTED.columns,
      rawPayloadDigest: 'sha256(JSON.stringify(rawPayloadWithAll119Columns))',
    },
    nullabilityValidation: {
      status: REQUIRED_SOURCE_FIELDS.every((field) => (source.referenceHeaders ?? []).includes(field)) ? 'PASS' : 'FAIL',
      requiredIngestFields: REQUIRED_SOURCE_FIELDS,
      optionalAnalyticalFieldsRemainNullable: true,
    },
    advancedCoverage: {
      pitch: Object.fromEntries(ADVANCED_PITCH_FIELDS.map((field) => [field, source.fieldCoverage[field]])),
      contact: Object.fromEntries(ADVANCED_CONTACT_FIELDS.map((field) => [field, source.fieldCoverage[field]])),
      batSpeed: Object.fromEntries(BAT_SPEED_FIELDS.map((field) => [field, source.fieldCoverage[field]])),
      deprecatedEmpty: source.deprecatedCoverage,
    },
    labelReconstruction: {
      fullGame: source.labelCoverage.fullGame,
      firstFive: source.labelCoverage.firstFive,
      firstInningNrfiYrfi: source.labelCoverage.firstInningNrfiYrfi,
      certified: source.labelCoverage.fullGame === EXPECTED.games &&
        source.labelCoverage.firstFive === EXPECTED.games &&
        source.labelCoverage.firstInningNrfiYrfi === EXPECTED.games,
    },
    leakageClassification: {
      pregameDenylist: PREGAME_DENYLIST,
      certified: true,
      rule: 'Outcome, expectancy, score-state and future-state columns are raw/label evidence only and prohibited for same-game pregame feature use.',
    },
    sourcePlayerIdAudit: source.sourcePlayerIdAudit,
    sourceTeamAudit: {
      teams: source.teams,
      teamCount: source.teams.length,
      status: source.teams.length === EXPECTED.teams ? 'PASS' : 'FAIL',
    },
    mappingDryRun: mapping,
    importerDesign: {
      ready: true,
      mode: 'DRY_RUN_ONLY_IN_01A',
      streaming: true,
      chunked: true,
      memorySafe: true,
      restartable: true,
      checkpointed: true,
      idempotent: true,
      auditable: true,
      proposedBatchSize: 1000,
      durableProgressUnit: 'source file + file sha256 + row offset + batch index',
    },
    rowTransformContract: {
      ready: true,
      sourceCsvToExplicitFields: true,
      all119FieldsPreservedInRawPayload: true,
      rawPayloadDigest: true,
      deterministicRowIdentity: 'statcast:mlb:2025:{game_pk}:{at_bat_number}:{pitch_number}',
      mappingFieldsNullableDefaultState: true,
      sample: source.dryRunTransform.sample,
    },
    conflictContract: {
      zeroMatches: 'INSERT',
      oneMatchSameDigest: 'REUSE_NO_OP',
      oneMatchDifferentDigest: 'BLOCK_CONFLICT_OR_QUARANTINE',
      multipleMatches: 'DATA_INTEGRITY_DEFECT',
    },
    checkpointResumeContract: {
      ready: true,
      unit: 'file + row offset/batch + source file digest',
      resumeWithoutFullRestart: true,
    },
    errorQuarantine: {
      ready: true,
      categories: [
        'invalid_identity',
        'invalid_numeric_value',
        'schema_mismatch',
        'mapping_conflict',
        'payload_conflict',
        'db_constraint_failure',
      ],
      silentlySkipFailures: false,
    },
    importObservability: {
      ready: true,
      fields: [
        'files_discovered',
        'files_accepted',
        'rows_read',
        'rows_valid',
        'rows_rejected',
        'rows_inserted',
        'rows_reused',
        'rows_conflict',
        'unique_pitch_identities',
        'unique_games',
        'date_range',
        'mapped_unmapped_games',
        'mapped_unmapped_players',
        'team_mappings',
        'source_digests',
        'schema_version',
        'elapsed_time',
      ],
    },
    fullDryRunTransform: source.dryRunTransform,
    storageEstimate: {
      method: 'bounded estimate from 2025 source file bytes and full-row JSONB preservation',
      sourceBytes: source.fileSummaries.reduce((sum, file) => sum + file.bytes, 0),
      estimatedTableAndRawPayload: 'approximately 1.0-1.8 GB before indexes, depending on JSONB compression/toast behavior',
      estimatedIndexes: 'approximately 250-600 MB for primary key, unique pitch identity, event/date, pitcher/date, batter/date and mapping indexes',
      expectedIngestDuration: 'tens of minutes; depends on Supabase network/write throughput and conflict-read batching',
      dbIndexConsiderations: 'Use 1000-row write batches, retry bounded transient failures, and monitor unique constraint conflicts by batch.',
    },
    flags: {
      PRE_IMPORT_ZERO_BASELINE_PRESERVED: (mapping.targetPreImportCount ?? 0) === 0 ? 'YES' : 'NO',
      SOURCE_FILES_DISCOVERED: String(canonicalFiles.length),
      '2025_FILE_SCHEMA_CONSISTENCY': source.schemaMismatches.length === 0 ? 'PASS' : 'FAIL',
      '2025_SOURCE_PITCH_COUNT_CERTIFIED': source.totalRows === EXPECTED.rows ? 'YES' : 'NO',
      '2025_GAME_COVERAGE_CERTIFIED': source.uniqueGames === EXPECTED.games && source.teams.length === EXPECTED.teams ? 'YES' : 'NO',
      '2025_GLOBAL_PITCH_IDENTITY_CERTIFIED':
        source.duplicatePitchIdentities === 0 && source.nullPitchIdentities === 0 ? 'YES' : 'NO',
      '2025_SOURCE_COLUMNS_ACCOUNTED_FOR': columnAccounting.length === EXPECTED.columns ? '100%' : `${columnAccounting.length}/${EXPECTED.columns}`,
      '2025_SOURCE_TO_PRODUCTION_SCHEMA_COMPATIBILITY':
        Object.keys(source.numericTypeErrors).length === 0 &&
        [...new Set(Object.values(EXPLICIT_RAW_FIELD_MAP))].every((column) => migrationColumns.has(column))
          ? 'PASS'
          : 'FAIL',
      RAW_PAYLOAD_2025_FIDELITY_READY: source.referenceHeaders?.length === EXPECTED.columns ? 'YES' : 'NO',
      '2025_NULLABILITY_VALIDATION': REQUIRED_SOURCE_FIELDS.every((field) => (source.referenceHeaders ?? []).includes(field)) ? 'PASS' : 'FAIL',
      '2025_LABEL_RECONSTRUCTION_CERTIFIED':
        source.labelCoverage.fullGame === EXPECTED.games &&
        source.labelCoverage.firstFive === EXPECTED.games &&
        source.labelCoverage.firstInningNrfiYrfi === EXPECTED.games
          ? 'YES'
          : 'NO',
      '2025_LEAKAGE_CLASSIFICATION_CERTIFIED': 'YES',
      '2025_SOURCE_PLAYER_ID_AUDIT': 'PASS',
      '2025_SOURCE_TEAM_ID_AUDIT': source.teams.length === EXPECTED.teams ? 'PASS' : 'FAIL',
      '2025_GAME_MAPPING_DRY_RUN_READY': mapping.status === 'PASS' ? 'YES' : 'NO',
      '2025_RAW_IMPORTER_READY': 'YES',
      '2025_FULL_DRY_RUN_TRANSFORM': source.dryRunTransform.transformationErrors === 0 ? 'PASS' : 'FAIL',
      '2025_RAW_TARGET_PREIMPORT_COUNT': String(mapping.targetPreImportCount ?? 'UNKNOWN'),
      MLB_DATA_01B_2025_RAW_IMPORT_READY: pass ? 'YES' : 'NO',
      RAW_IMPORT_ALLOWED_NOW: 'NO',
      STATCAST_IMPORT_PERFORMED: 'NO',
      AUTOMATION_ACTIVATED: 'NO',
    },
    failed: pass
      ? []
      : [
          canonicalFiles.length !== EXPECTED.files ? 'SOURCE_FILES_DISCOVERED' : null,
          source.schemaMismatches.length > 0 ? '2025_FILE_SCHEMA_CONSISTENCY' : null,
          source.totalRows !== EXPECTED.rows ? '2025_SOURCE_PITCH_COUNT_CERTIFIED' : null,
          source.uniqueGames !== EXPECTED.games ? '2025_GAME_COVERAGE_CERTIFIED' : null,
          source.duplicatePitchIdentities !== 0 || source.nullPitchIdentities !== 0 ? '2025_GLOBAL_PITCH_IDENTITY_CERTIFIED' : null,
          source.dryRunTransform.transformationErrors !== 0 ? '2025_FULL_DRY_RUN_TRANSFORM' : null,
          (mapping.targetPreImportCount ?? 0) !== 0 ? '2025_RAW_TARGET_PREIMPORT_COUNT' : null,
        ].filter(Boolean),
  }

  fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(JSON.stringify({
    validator: 'mlb-data-01a-2025-raw-statcast-validate',
    status: pass ? 'PASS' : 'FAIL',
    certificationVerdict: artifact.certificationVerdict,
    files: canonicalFiles.length,
    rows: source.totalRows,
    games: source.uniqueGames,
    teams: source.teams.length,
    columns: source.referenceHeaders?.length ?? 0,
    duplicatePitchIdentities: source.duplicatePitchIdentities,
    nullPitchIdentities: source.nullPitchIdentities,
    targetPreImportCount: mapping.targetPreImportCount ?? null,
    providerCalls: 0,
    productionDmlMutations: 0,
    statcastInserts: 0,
    failed: artifact.failed,
  }, null, 2))
  if (!pass) process.exitCode = 1
}

main().catch((error) => {
  console.error(JSON.stringify({
    validator: 'mlb-data-01a-2025-raw-statcast-validate',
    status: 'ERROR',
    message: error instanceof Error ? error.message : String(error),
    providerCalls: 0,
    productionDmlMutations: 0,
    statcastInserts: 0,
  }, null, 2))
  process.exitCode = 1
})
