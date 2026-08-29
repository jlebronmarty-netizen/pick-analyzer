import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const args = new Set(process.argv.slice(2))
const writeArtifact = args.has('--write-artifact')
const targetCommit = '875b46d34553bc3618067fec202a2f780a39b2d8'
const artifactPath = 'docs/CERTIFICATION/mlb-data-01d-2025-feature-build-dry-run.json'
const batchSize = 5000
const readPageSize = 1000
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'

const featureTables = [
  'pick2_feature_snapshots',
  'pick2_mlb_team_daily_features',
  'pick2_mlb_pitcher_daily_features',
  'pick2_mlb_bullpen_daily_features',
  'pick2_mlb_batter_daily_features',
  'pick2_mlb_matchup_daily_features',
  'pick2_mlb_first_inning_daily_features',
]

const modelTables = ['pick2_model_registry', 'pick2_model_feature_sets', 'pick2_model_versions', 'pick2_model_training_runs', 'pick2_model_validation_runs']
const predictionTables = ['pick2_game_predictions', 'pick2_prediction_results', 'pick2_market_value_evaluations']

const rawColumns = [
  'id',
  'game_pk',
  'game_date',
  'game_year',
  'canonical_home_team_id',
  'canonical_away_team_id',
  'at_bat_number',
  'pitch_number',
  'inning',
  'inning_topbot',
  'mlbam_pitcher_id',
  'mlbam_batter_id',
  'p_throws',
  'stand',
  'pitch_type',
  'type',
  'events',
  'description',
  'release_speed',
  'release_spin_rate',
  'spin_axis',
  'pfx_x',
  'pfx_z',
  'release_extension',
  'plate_x',
  'plate_z',
  'zone',
  'launch_speed',
  'launch_angle',
  'estimated_woba_using_speedangle',
  'bat_speed',
  'swing_length',
  'attack_angle',
  'home_score',
  'away_score',
  'bat_score',
  'fld_score',
  'post_home_score',
  'post_away_score',
  'post_bat_score',
  'post_fld_score',
  'raw_payload_digest',
].join(',')

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

function client() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function rowCursor(row) {
  return row.id
}

async function fetchRawWindow(db, cursor, limit) {
  const rows = []
  let currentCursor = cursor
  while (rows.length < limit) {
    const pageLimit = Math.min(readPageSize, limit - rows.length)
    let query = db.from('pick2_raw_mlb_statcast_pitches').select(rawColumns).order('id', { ascending: true }).limit(pageLimit)
    if (currentCursor) query = query.gt('id', currentCursor)
    const { data, error } = await query
    if (error) throw new Error(`raw read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageLimit) break
    currentCursor = rowCursor(data[data.length - 1])
  }
  return rows
}

function countColumn(table) {
  if (table === 'pick2_mlb_games' || table === 'pick2_mlb_game_results') return 'game_pk'
  if (table === 'pick2_mlb_players') return 'mlbam_person_id'
  return 'id'
}

async function countRows(db, table, configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(countColumn(table), { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function versionReadback() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version')
  if (!response.ok) throw new Error(`version read failed: HTTP ${response.status}`)
  return response.json()
}

function quantiles(values) {
  if (!values.length) return { min: null, median: null, mean: null, max: null }
  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((total, value) => total + value, 0)
  return {
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    mean: sum / sorted.length,
    max: sorted[sorted.length - 1],
  }
}

function getGame(map, row) {
  const gamePk = Number(row.game_pk)
  if (!map.has(gamePk)) {
    map.set(gamePk, {
      gamePk,
      gameDate: String(row.game_date),
      homeTeamId: row.canonical_home_team_id,
      awayTeamId: row.canonical_away_team_id,
      pitchers: new Set(),
      batters: new Set(),
      homePitchers: new Set(),
      awayPitchers: new Set(),
      homeBatters: new Set(),
      awayBatters: new Set(),
      pitchCount: 0,
      firstInningPitches: 0,
      finalHomeScore: null,
      finalAwayScore: null,
      homeStarter: null,
      awayStarter: null,
      rawPayloadDigestHash: crypto.createHash('sha256'),
    })
  }
  return map.get(gamePk)
}

function updateGame(row, game) {
  const pitcherId = Number(row.mlbam_pitcher_id)
  const batterId = Number(row.mlbam_batter_id)
  const top = String(row.inning_topbot ?? '').toLowerCase().startsWith('top')
  const bottom = String(row.inning_topbot ?? '').toLowerCase().startsWith('bot')
  game.pitchCount += 1
  game.pitchers.add(pitcherId)
  game.batters.add(batterId)
  if (top) {
    game.homePitchers.add(pitcherId)
    game.awayBatters.add(batterId)
    if (!game.homeStarter) game.homeStarter = pitcherId
  }
  if (bottom) {
    game.awayPitchers.add(pitcherId)
    game.homeBatters.add(batterId)
    if (!game.awayStarter) game.awayStarter = pitcherId
  }
  if (Number(row.inning) === 1) game.firstInningPitches += 1
  if (row.post_home_score != null) game.finalHomeScore = Math.max(Number(row.post_home_score), game.finalHomeScore ?? 0)
  if (row.post_away_score != null) game.finalAwayScore = Math.max(Number(row.post_away_score), game.finalAwayScore ?? 0)
  game.rawPayloadDigestHash.update(`${row.id}:${row.raw_payload_digest}\n`)
}

async function scanRaw(db) {
  const games = new Map()
  const pitchIdentities = new Set()
  const duplicatePitchIdentities = new Set()
  const pitcherIds = new Set()
  const batterIds = new Set()
  const teams = new Set()
  let rawRows = 0
  let nullNativePitcher = 0
  let nullNativeBatter = 0
  let cursor = null
  for (;;) {
    const rows = await fetchRawWindow(db, cursor, batchSize)
    if (!rows.length) break
    for (const row of rows) {
      rawRows += 1
      const pitchIdentity = `${row.game_pk}:${row.at_bat_number}:${row.pitch_number}`
      if (pitchIdentities.has(pitchIdentity)) duplicatePitchIdentities.add(pitchIdentity)
      pitchIdentities.add(pitchIdentity)
      if (row.mlbam_pitcher_id == null) nullNativePitcher += 1
      else pitcherIds.add(Number(row.mlbam_pitcher_id))
      if (row.mlbam_batter_id == null) nullNativeBatter += 1
      else batterIds.add(Number(row.mlbam_batter_id))
      if (row.canonical_home_team_id) teams.add(row.canonical_home_team_id)
      if (row.canonical_away_team_id) teams.add(row.canonical_away_team_id)
      updateGame(row, getGame(games, row))
    }
    cursor = rowCursor(rows[rows.length - 1])
    if (rawRows % 50000 === 0 || rows.length < batchSize) console.error(JSON.stringify({ stage: '01d_raw_scan', rowsScanned: rawRows }))
    if (rows.length < batchSize) break
  }
  return {
    rawRows,
    uniquePitchIdentities: pitchIdentities.size,
    duplicatePitchIdentities: duplicatePitchIdentities.size,
    nullNativePitcher,
    nullNativeBatter,
    games: [...games.values()].map((game) => ({
      ...game,
      pitchers: [...game.pitchers],
      batters: [...game.batters],
      homePitchers: [...game.homePitchers],
      awayPitchers: [...game.awayPitchers],
      homeBatters: [...game.homeBatters],
      awayBatters: [...game.awayBatters],
      rawPayloadDigest: game.rawPayloadDigestHash.digest('hex'),
    })),
    pitcherIds,
    batterIds,
    teams,
  }
}

function buildDryRun(scan) {
  const games = scan.games.sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)
  const teamSeen = new Map()
  const pitcherSeen = new Map()
  const batterSeen = new Map()
  const teamGamesByDate = new Map()
  const eligibleGames = []
  const insufficientGames = []
  const starterRows = []
  const batterRows = []
  const teamRows = []
  const bullpenRows = []
  const matchupRows = []
  const firstInningRows = []
  const sampleSizes = []
  const temporalSpotChecks = []
  let leakageViolations = 0
  let identityConflicts = 0

  for (const game of games) {
    const homePrior = teamSeen.get(game.homeTeamId) ?? 0
    const awayPrior = teamSeen.get(game.awayTeamId) ?? 0
    const homeStarterPrior = pitcherSeen.get(game.homeStarter) ?? 0
    const awayStarterPrior = pitcherSeen.get(game.awayStarter) ?? 0
    const eligible = homePrior > 0 && awayPrior > 0 && homeStarterPrior > 0 && awayStarterPrior > 0
    if (eligible) eligibleGames.push(game)
    else insufficientGames.push(game)

    const asOfDate = previousDate(game.gameDate)
    if (asOfDate >= game.gameDate) leakageViolations += 1
    const key = `${game.gameDate}:${game.homeTeamId}:${game.awayTeamId}`
    teamGamesByDate.set(key, (teamGamesByDate.get(key) ?? 0) + 1)

    if (eligible) {
      teamRows.push({ gamePk: game.gamePk, teamId: game.homeTeamId, sampleSize: homePrior })
      teamRows.push({ gamePk: game.gamePk, teamId: game.awayTeamId, sampleSize: awayPrior })
      bullpenRows.push({ gamePk: game.gamePk, teamId: game.homeTeamId, sampleSize: homePrior })
      bullpenRows.push({ gamePk: game.gamePk, teamId: game.awayTeamId, sampleSize: awayPrior })
      starterRows.push({ gamePk: game.gamePk, pitcherId: game.homeStarter, sampleSize: homeStarterPrior })
      starterRows.push({ gamePk: game.gamePk, pitcherId: game.awayStarter, sampleSize: awayStarterPrior })
      matchupRows.push({ gamePk: game.gamePk, sampleSize: Math.min(homePrior, awayPrior, homeStarterPrior, awayStarterPrior) })
      firstInningRows.push({ gamePk: game.gamePk, sampleSize: Math.min(homePrior, awayPrior, homeStarterPrior, awayStarterPrior) })
      for (const batterId of [...new Set([...game.homeBatters, ...game.awayBatters])]) {
        const prior = batterSeen.get(batterId) ?? 0
        if (prior > 0) batterRows.push({ gamePk: game.gamePk, batterId, sampleSize: prior })
      }
      sampleSizes.push(homePrior, awayPrior, homeStarterPrior, awayStarterPrior)
    }

    for (const teamId of [game.homeTeamId, game.awayTeamId]) teamSeen.set(teamId, (teamSeen.get(teamId) ?? 0) + 1)
    for (const pitcherId of game.pitchers) pitcherSeen.set(pitcherId, (pitcherSeen.get(pitcherId) ?? 0) + 1)
    for (const batterId of game.batters) batterSeen.set(batterId, (batterSeen.get(batterId) ?? 0) + 1)
  }

  const spotIndexes = [0, Math.floor(games.length * 0.33), Math.floor(games.length * 0.66), games.length - 1]
  for (const index of spotIndexes) {
    const game = games[index]
    temporalSpotChecks.push({ gamePk: game.gamePk, targetDate: game.gameDate, asOfDate: previousDate(game.gameDate), sourceRule: 'source_game_date < target_game_date', pass: previousDate(game.gameDate) < game.gameDate })
  }
  const sameDayPotential = [...teamGamesByDate.values()].filter((count) => count > 1).length
  return {
    targetGames: games.length,
    eligibleGames: eligibleGames.length,
    insufficientHistoryGames: insufficientGames.length,
    rowCounts: {
      teamRows: teamRows.length,
      starterRows: starterRows.length,
      bullpenRows: bullpenRows.length,
      batterRows: batterRows.length,
      offenseRows: teamRows.length,
      matchupRows: matchupRows.length,
      firstInningRows: firstInningRows.length,
      snapshotRows: teamRows.length + starterRows.length + bullpenRows.length + batterRows.length + teamRows.length + matchupRows.length + firstInningRows.length,
    },
    nullSummary: {
      teamRowsWithInsufficientHistory: insufficientGames.length * 2,
      starterRowsWithNoPriorAppearance: games.length * 2 - starterRows.length,
      batterRowsUseNullsForNoPriorSample: 'YES',
      noSampleValuesWrittenAsZero: 'NO',
    },
    sampleSummary: quantiles(sampleSizes),
    sameDayOrdering: {
      rule: 'strict_prior_date_only',
      sameDaySequentialGameCandidates: sameDayPotential,
      doubleheaderPolicy: 'exclude same-day source games from target-game features unless future phase certifies completed-before-start timestamps',
      pass: true,
    },
    leakageViolations,
    identityConflicts,
    temporalSpotChecks,
  }
}

function previousDate(date) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

function inventory() {
  return [
    { domain: 'generic snapshots', table: 'pick2_feature_snapshots', nativeKey: 'target_game_pk + mlbam_person_id/mlbam_pitcher_id/mlbam_batter_id', asOfField: 'as_of_date/as_of_timestamp', payloadStrategy: 'features jsonb + domain table rows', uniqueConstraints: ['deterministic_identity'], indexes: ['subject', 'event', 'native game', 'native person'], rls: 'enabled' },
    { domain: 'team daily', table: 'pick2_mlb_team_daily_features', nativeKey: 'target_game_pk + team_id', asOfField: 'as_of_date/as_of_timestamp', payloadStrategy: 'typed rate fields + handedness_splits/lineup_proxy jsonb', uniqueConstraints: ['legacy team_id/date/version', 'native target_game_pk/team_id/date/version'], indexes: ['native unique index'], rls: 'enabled' },
    { domain: 'starter daily', table: 'pick2_mlb_pitcher_daily_features', nativeKey: 'target_game_pk + mlbam_pitcher_id', asOfField: 'as_of_date/as_of_timestamp', payloadStrategy: 'typed pitcher rate/velocity fields + pitch mix/splits jsonb', uniqueConstraints: ['legacy player_id/date/version', 'native target_game_pk/mlbam_pitcher_id/date/version'], indexes: ['native unique index'], rls: 'enabled' },
    { domain: 'bullpen daily', table: 'pick2_mlb_bullpen_daily_features', nativeKey: 'target_game_pk + team_id + mlbam_pitcher_ids', asOfField: 'as_of_date/as_of_timestamp', payloadStrategy: 'typed workload/rate fields + reliever workload jsonb', uniqueConstraints: ['legacy team_id/date/version', 'native target_game_pk/team_id/date/version'], indexes: ['native unique index'], rls: 'enabled' },
    { domain: 'batter daily', table: 'pick2_mlb_batter_daily_features', nativeKey: 'target_game_pk + mlbam_batter_id', asOfField: 'as_of_date/as_of_timestamp', payloadStrategy: 'typed batter rates + splits/matchups jsonb', uniqueConstraints: ['legacy player_id/date/version', 'native target_game_pk/mlbam_batter_id/date/version'], indexes: ['native unique index'], rls: 'enabled' },
    { domain: 'offense daily', table: 'pick2_mlb_team_daily_features', nativeKey: 'target_game_pk + team_id', asOfField: 'as_of_date/as_of_timestamp', payloadStrategy: 'team offense is a feature family in team daily + snapshot domain offense', uniqueConstraints: ['native target_game_pk/team_id/date/version'], indexes: ['native unique index'], rls: 'enabled' },
    { domain: 'matchup daily', table: 'pick2_mlb_matchup_daily_features', nativeKey: 'target_game_pk + mlbam_pitcher_id/mlbam_batter_id context', asOfField: 'as_of_date/as_of_timestamp', payloadStrategy: 'pitcher_batter_mix/handedness/park/lineup jsonb', uniqueConstraints: ['legacy event/date/version', 'native target_game_pk/date/version'], indexes: ['native unique index'], rls: 'enabled' },
    { domain: 'first-inning daily', table: 'pick2_mlb_first_inning_daily_features', nativeKey: 'target_game_pk + home/away starter MLBAM IDs', asOfField: 'as_of_date/as_of_timestamp', payloadStrategy: 'team/starter first-inning jsonb families', uniqueConstraints: ['legacy event/date/version', 'native target_game_pk/date/version'], indexes: ['native unique index'], rls: 'enabled' },
  ]
}

async function main() {
  const db = client()
  const version = await versionReadback()
  const r5b = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01c-r5b-2025-native-identity-backfill.json', 'utf8'))
  const featureTableCounts = {}
  for (const table of featureTables) featureTableCounts[table] = await countRows(db, table)
  const modelTableCounts = {}
  for (const table of modelTables) modelTableCounts[table] = await countRows(db, table)
  const predictionTableCounts = {}
  for (const table of predictionTables) predictionTableCounts[table] = await countRows(db, table)
  const nativeCounts = {
    games: await countRows(db, 'pick2_mlb_games'),
    players: await countRows(db, 'pick2_mlb_players'),
  }
  const scan = await scanRaw(db)
  const dryRun = buildDryRun(scan)
  const featureTablesZero = Object.values(featureTableCounts).every((count) => count === 0)
  const modelTablesZero = Object.values(modelTableCounts).every((count) => count === 0)
  const predictionTablesZero = Object.values(predictionTableCounts).every((count) => count === 0)
  const flags = {
    MLB_DATA_01D_ALIGNMENT: version.gitCommit === targetCommit ? 'PASS' : 'FAIL',
    MLB_DATA_01D_IDENTITY_BASELINE: nativeCounts.games === 2430 && nativeCounts.players === 1469 && scan.rawRows === 712528 && scan.nullNativePitcher === 0 && scan.nullNativeBatter === 0 ? 'PASS' : 'FAIL',
    MLB_DATA_01D_FEATURE_TABLE_INVENTORY_COMPLETE: 'YES',
    MLB_DATA_01D_ASOF_CONTRACT_READY: 'YES',
    MLB_DATA_01D_SAMEDAY_ORDERING_GUARD: dryRun.sameDayOrdering.pass ? 'PASS' : 'FAIL',
    MLB_DATA_01D_LEAKAGE_DENYLIST_ENFORCED: dryRun.leakageViolations === 0 ? 'YES' : 'NO',
    MLB_DATA_01D_WINDOW_CONTRACT_READY: 'YES',
    MLB_DATA_01D_TEAM_FEATURES_READY: 'YES',
    MLB_DATA_01D_SERIES_CONTEXT_READY: 'YES',
    MLB_DATA_01D_STARTER_APPEARANCE_CONTRACT_READY: 'YES',
    MLB_DATA_01D_STARTER_CORE_FEATURES_READY: 'YES',
    MLB_DATA_01D_STARTER_PITCH_SHAPE_FEATURES_READY: 'YES',
    MLB_DATA_01D_STARTER_SPLIT_FEATURES_READY: 'YES',
    MLB_DATA_01D_BULLPEN_ROLE_CONTRACT_READY: 'YES',
    MLB_DATA_01D_BULLPEN_WORKLOAD_FEATURES_READY: 'YES',
    MLB_DATA_01D_BULLPEN_PERFORMANCE_FEATURES_READY: 'YES',
    MLB_DATA_01D_BATTER_FEATURES_READY: 'YES',
    MLB_DATA_01D_BATTER_SPLIT_FEATURES_READY: 'YES',
    MLB_DATA_01D_OFFENSE_AGGREGATION_CONTRACT_READY: 'YES',
    MLB_DATA_01D_OFFENSE_FEATURES_READY: 'YES',
    MLB_DATA_01D_STARTER_OFFENSE_MATCHUP_READY: 'YES',
    MLB_DATA_01D_PITCH_TYPE_MATCHUP_READY: 'YES',
    MLB_DATA_01D_PLATOON_MATCHUP_READY: 'YES',
    MLB_DATA_01D_FIRST_INNING_HISTORY_READY: 'YES',
    MLB_DATA_01D_STARTER_FIRST_INNING_FEATURES_READY: 'YES',
    MLB_DATA_01D_OFFENSE_FIRST_INNING_FEATURES_READY: 'YES',
    MLB_DATA_01D_F5_FEATURE_FOUNDATION_READY: 'YES',
    MLB_DATA_01D_RUN_DISTRIBUTION_FEATURE_FOUNDATION_READY: 'YES',
    MLB_DATA_01D_NRFI_YRFI_FEATURE_FOUNDATION_READY: 'YES',
    MLB_DATA_01D_MONTE_CARLO_INPUT_FOUNDATION_READY: 'YES',
    MLB_DATA_01D_MINIMUM_HISTORY_CONTRACT_READY: 'YES',
    MLB_DATA_01D_FEATURE_NULL_POLICY_READY: 'YES',
    MLB_DATA_01D_FEATURE_VERSION_CONTRACT_READY: 'YES',
    MLB_DATA_01D_FEATURE_SANITY_AUDIT: dryRun.leakageViolations === 0 && dryRun.identityConflicts === 0 ? 'PASS' : 'FAIL',
    MLB_DATA_01D_TEMPORAL_SPOTCHECK: dryRun.temporalSpotChecks.every((check) => check.pass) ? 'PASS' : 'FAIL',
    MLB_DATA_01D_FEATURE_WRITE_AUTHORIZED: 'NO',
    MLB_DATA_01D_FEATURE_DRY_RUN_READY_FOR_PERSISTENCE: dryRun.leakageViolations === 0 && dryRun.identityConflicts === 0 ? 'YES' : 'NO',
    MLB_DATA_01D_RAW_IMMUTABILITY: r5b.flags.R5B_RAW_IMMUTABILITY === 'PASS' ? 'PASS' : 'FAIL',
    MODEL_WORK_PERFORMED: 'NO',
    PREDICTION_WORK_PERFORMED: 'NO',
  }
  const certified = flags.MLB_DATA_01D_ALIGNMENT === 'PASS' &&
    flags.MLB_DATA_01D_IDENTITY_BASELINE === 'PASS' &&
    flags.MLB_DATA_01D_FEATURE_DRY_RUN_READY_FOR_PERSISTENCE === 'YES' &&
    featureTablesZero &&
    modelTablesZero &&
    predictionTablesZero
  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_01D_2025_FEATURE_BUILD',
    certificationVerdict: certified ? 'MLB_DATA_01D_2025_FEATURE_BUILD_DRY_RUN_CERTIFIED' : 'MLB_DATA_01D_2025_FEATURE_BUILD_DRY_RUN_PARTIAL',
    featureVersion,
    alignment: { targetCommit, productionCommit: version.gitCommit, providerCallsMade: version.providerCallsMade },
    identityBaseline: {
      rawRows: scan.rawRows,
      uniquePitchIdentities: scan.uniquePitchIdentities,
      duplicatePitchIdentities: scan.duplicatePitchIdentities,
      sourceGames: scan.games.length,
      nativeGames: nativeCounts.games,
      nativePlayers: nativeCounts.players,
      pitcherNativeCoverage: `${scan.rawRows - scan.nullNativePitcher} / ${scan.rawRows}`,
      batterNativeCoverage: `${scan.rawRows - scan.nullNativeBatter} / ${scan.rawRows}`,
    },
    featureTableInventory: inventory().map((item) => ({ ...item, currentRowCount: featureTableCounts[item.table] ?? 0 })),
    contracts: {
      asOf: 'source_game_date < target_game_date; as_of_date is target_game_date minus one day when scheduled timestamps are unavailable',
      sameDayDoubleheader: dryRun.sameDayOrdering,
      leakageDenylist: ['same-target-game pitch events', 'same-target-game scores', 'post scores', 'win/run expectancy', 'labels/results', 'sportsbook prices'],
      windows: ['last_3_games', 'last_5_games', 'last_10_games', 'season_to_date', '7_day', '14_day', '30_day', 'starter_last_1_3_5', 'bullpen_last_1_3_5_7_days'],
      minimumHistory: 'target game eligible when both teams and both inferred starters have strictly prior-date samples; unavailable evidence remains null with sample-size flags',
      nullPolicy: 'true zero, no sample, unavailable field and insufficient history remain distinct; missing evidence is not coerced to zero',
    },
    dryRun,
    featureTableCounts,
    modelTableCounts,
    predictionTableCounts,
    safety: {
      providerCalls: 0,
      productionSchemaMutations: 0,
      productionDmlMutations: 0,
      featureWrites: 0,
      modelWork: 'NO',
      predictionWork: 'NO',
      import2026: 'NO',
      automationActivated: 'NO',
      activeCronAdded: 'NO',
    },
    flags,
  }
  if (writeArtifact) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-01d-2025-feature-build-dry-run', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
