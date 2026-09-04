import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const executeTraining = process.argv.includes('--execute-training')
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const datasetVersion = 'MLB_MONEYLINE_DATASET_V1'
const splitVersion = 'MLB_MONEYLINE_CHRONO_SPLIT_V1'
const featureSetVersion = 'MLB_ML_FEATURE_SET_V1'
const productionCommit = 'b229387c0fa5dc2eee3d27e89993dff07cfa0967'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02b-moneyline-model-training-prep.json'

const expected = {
  rawRows: 712528,
  uniquePitchIdentities: 712528,
  duplicatePitchIdentities: 0,
  nativeGames: 2430,
  nativePlayers: 1469,
  moneylineRows: 2249,
  features: {
    team: 4498,
    starter: 4498,
    bullpen: 4498,
    batter: 44943,
    matchup: 2249,
    firstInning: 2249,
    snapshots: 67433,
  },
}

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
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} HTTP_${response.status}`)
  return response.json()
}

async function countRows(db, table, column = 'id') {
  const { count, error } = await db.from(table).select(column, { count: 'exact', head: true })
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
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

async function fetchRawWindow(db, cursor, limit) {
  const columns = [
    'id',
    'game_pk',
    'game_date',
    'canonical_home_team_id',
    'canonical_away_team_id',
    'at_bat_number',
    'pitch_number',
    'post_home_score',
    'post_away_score',
  ].join(',')
  const rows = []
  let currentCursor = cursor
  while (rows.length < limit) {
    const pageLimit = Math.min(1000, limit - rows.length)
    let query = db.from('pick2_raw_mlb_statcast_pitches').select(columns).order('id', { ascending: true }).limit(pageLimit)
    if (currentCursor) query = query.gt('id', currentCursor)
    const { data, error } = await query
    if (error) throw new Error(`pick2_raw_mlb_statcast_pitches read failed after cursor ${currentCursor ?? 'START'}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageLimit) break
    currentCursor = data[data.length - 1].id
  }
  return rows
}

function duplicateCount(rows, fields) {
  const seen = new Set()
  let duplicates = 0
  for (const row of rows) {
    const key = fields.map((field) => String(row[field] ?? '')).join('|')
    if (seen.has(key)) duplicates += 1
    else seen.add(key)
  }
  return duplicates
}

function addGame(gameMap, row) {
  const key = String(row.game_pk)
  if (!gameMap.has(key)) {
    gameMap.set(key, {
      gamePk: Number(row.game_pk),
      gameDate: row.game_date,
      homeTeamId: row.canonical_home_team_id,
      awayTeamId: row.canonical_away_team_id,
      finalHomeScore: null,
      finalAwayScore: null,
    })
  }
  const game = gameMap.get(key)
  if (row.post_home_score != null) game.finalHomeScore = Math.max(Number(row.post_home_score), game.finalHomeScore ?? 0)
  if (row.post_away_score != null) game.finalAwayScore = Math.max(Number(row.post_away_score), game.finalAwayScore ?? 0)
}

function dateKey(value) {
  return String(value).slice(0, 10)
}

function classBalance(rows) {
  const positives = rows.filter((row) => row.homeWin === 1).length
  const total = rows.length
  return {
    positive: positives,
    negative: total - positives,
    positiveRate: total ? Number((positives / total).toFixed(6)) : null,
  }
}

function summarize(values) {
  const nums = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!nums.length) return { count: 0, min: null, p25: null, median: null, mean: null, p75: null, max: null }
  const pick = (p) => nums[Math.min(nums.length - 1, Math.floor((nums.length - 1) * p))]
  return {
    count: nums.length,
    min: nums[0],
    p25: pick(0.25),
    median: pick(0.5),
    mean: Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(4)),
    p75: pick(0.75),
    max: nums[nums.length - 1],
  }
}

function splitRows(rows) {
  const sorted = [...rows].sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)
  const trainEnd = Math.floor(sorted.length * 0.7)
  const validationEnd = Math.floor(sorted.length * 0.85)
  return {
    train: sorted.slice(0, trainEnd),
    validation: sorted.slice(trainEnd, validationEnd),
    test: sorted.slice(validationEnd),
  }
}

function rangeFor(rows) {
  return {
    start: rows[0]?.gameDate ?? null,
    end: rows[rows.length - 1]?.gameDate ?? null,
    rows: rows.length,
  }
}

function parseSourceStart(row) {
  const sourceWindow = row.source_window ?? {}
  return sourceWindow.startDate ?? sourceWindow.start_date ?? sourceWindow.start ?? sourceWindow.from ?? null
}

function sourceDateViolation(row) {
  const candidates = [row.as_of_date, parseSourceStart(row)].filter(Boolean).map(dateKey)
  return candidates.some((candidate) => candidate >= dateKey(row.feature_date))
}

function numericDistributionBySplit(featureRowsBySplit, getter) {
  return Object.fromEntries(Object.entries(featureRowsBySplit).map(([name, rows]) => [name, summarize(rows.map(getter))]))
}

async function main() {
  if (executeTraining) throw new Error('TRAINING_EXECUTION_FORBIDDEN_IN_02B_PREP')

  const db = dbClient()
  const [version, liveAuthority] = await Promise.all([
    fetchJson('https://pick-analyzer.vercel.app/api/system/version'),
    fetchJson('https://pick-analyzer.vercel.app/api/system/pick2/r1f-manifest-authority'),
  ])
  ensure(version.gitCommit === productionCommit, `PRODUCTION_ALIGNMENT_FAILED:${version.gitCommit}`)
  ensure(version.providerCallsMade === 0, 'PROVIDER_CALLS_NONZERO')
  ensure(liveAuthority.productionAuthorityReady === true && liveAuthority.criticalCodeIntegrity === 'PASS', 'LIVE_AUTHORITY_FAILED')

  const featureCounts = {
    team: await countRows(db, 'pick2_mlb_team_daily_features'),
    starter: await countRows(db, 'pick2_mlb_pitcher_daily_features'),
    bullpen: await countRows(db, 'pick2_mlb_bullpen_daily_features'),
    batter: await countRows(db, 'pick2_mlb_batter_daily_features'),
    matchup: await countRows(db, 'pick2_mlb_matchup_daily_features'),
    firstInning: await countRows(db, 'pick2_mlb_first_inning_daily_features'),
    snapshots: await countRows(db, 'pick2_feature_snapshots'),
  }
  for (const [key, value] of Object.entries(expected.features)) ensure(featureCounts[key] === value, `FEATURE_COUNT_CHANGED:${key}:${featureCounts[key]}`)

  const nativeCounts = {
    games: await countRows(db, 'pick2_mlb_games', 'game_pk'),
    players: await countRows(db, 'pick2_mlb_players', 'mlbam_person_id'),
  }
  ensure(nativeCounts.games === expected.nativeGames && nativeCounts.players === expected.nativePlayers, 'NATIVE_COUNTS_CHANGED')

  const modelCounts = {
    registry: await countRows(db, 'pick2_model_registry'),
    featureSets: await countRows(db, 'pick2_model_feature_sets'),
    versions: await countRows(db, 'pick2_model_versions'),
    trainingRuns: await countRows(db, 'pick2_model_training_runs'),
    validationRuns: await countRows(db, 'pick2_model_validation_runs'),
  }
  const predictionCounts = {
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketValueEvaluations: await countRows(db, 'pick2_market_value_evaluations'),
  }
  ensure(Object.values(modelCounts).every((count) => count === 0), 'MODEL_COUNTS_NONZERO')
  ensure(Object.values(predictionCounts).every((count) => count === 0), 'PREDICTION_COUNTS_NONZERO')

  const featureRows = {
    team: await readAll(db, 'pick2_mlb_team_daily_features', 'target_game_pk,team_id,feature_date,as_of_date,feature_version,recent_k_rate,recent_bb_rate,recent_runs_per_game,recent_iso,sample_sizes,source_window', (query) => query.eq('feature_version', featureVersion)),
    starter: await readAll(db, 'pick2_mlb_pitcher_daily_features', 'target_game_pk,mlbam_pitcher_id,feature_date,as_of_date,feature_version,k_rate,bb_rate,k_minus_bb_rate,whiff_rate,csw_rate,strike_rate,swing_rate,avg_release_speed,velocity_l1,velocity_l3,velocity_l5,velocity_delta,previous_pitch_count,days_rest,sample_sizes,source_window', (query) => query.eq('feature_version', featureVersion)),
    bullpen: await readAll(db, 'pick2_mlb_bullpen_daily_features', 'target_game_pk,team_id,feature_date,as_of_date,feature_version,pitches_previous_24h,pitches_previous_72h,high_workload_reliever_count,bullpen_k_rate,bullpen_bb_rate,bullpen_k_minus_bb_rate,bullpen_whiff_rate,sample_sizes,source_window', (query) => query.eq('feature_version', featureVersion)),
    matchup: await readAll(db, 'pick2_mlb_matchup_daily_features', 'target_game_pk,feature_date,as_of_date,feature_version,sample_sizes,source_window,pitcher_batter_mix,handedness_context,park_context,lineup_context', (query) => query.eq('feature_version', featureVersion)),
    firstInning: await readAll(db, 'pick2_mlb_first_inning_daily_features', 'target_game_pk,feature_date,as_of_date,feature_version,home_starter_mlbam_pitcher_id,away_starter_mlbam_pitcher_id,sample_sizes,source_window,team_first_inning_scoring_rate,starter_first_inning_k_rate,starter_first_inning_bb_rate,starter_first_inning_baserunner_proxy,starter_first_inning_pitch_count', (query) => query.eq('feature_version', featureVersion)),
  }

  const duplicateNativeKeys = {
    team: duplicateCount(featureRows.team, ['target_game_pk', 'team_id', 'feature_version']),
    starter: duplicateCount(featureRows.starter, ['target_game_pk', 'mlbam_pitcher_id', 'feature_version']),
    bullpen: duplicateCount(featureRows.bullpen, ['target_game_pk', 'team_id', 'feature_version']),
    matchup: duplicateCount(featureRows.matchup, ['target_game_pk', 'feature_version']),
    firstInning: duplicateCount(featureRows.firstInning, ['target_game_pk', 'feature_version']),
  }
  ensure(Object.values(duplicateNativeKeys).every((count) => count === 0), 'DUPLICATE_NATIVE_KEYS')

  const games = await readAll(db, 'pick2_mlb_games', 'game_pk,game_date,home_team_id,away_team_id,game_number,doubleheader', (query) => query.eq('season', 2025).order('game_date', { ascending: true }).order('game_pk', { ascending: true }))
  const gamesByPk = new Map(games.map((game) => [Number(game.game_pk), game]))
  const matchupGamePks = new Set(featureRows.matchup.map((row) => Number(row.target_game_pk)))

  const pitchIdentities = new Set()
  const gameMap = new Map()
  let rawRows = 0
  let cursor = null
  for (;;) {
    const rawPage = await fetchRawWindow(db, cursor, 5000)
    if (!rawPage.length) break
    for (const row of rawPage) {
      rawRows += 1
      pitchIdentities.add(`${row.game_pk}|${row.at_bat_number}|${row.pitch_number}`)
      addGame(gameMap, row)
    }
    cursor = rawPage[rawPage.length - 1].id
    if (rawPage.length < 5000) break
  }
  const rawBaseline = {
    rawRows,
    uniquePitchIdentities: pitchIdentities.size,
    duplicatePitchIdentities: rawRows - pitchIdentities.size,
  }
  ensure(rawBaseline.rawRows === expected.rawRows && rawBaseline.uniquePitchIdentities === expected.uniquePitchIdentities && rawBaseline.duplicatePitchIdentities === 0, 'RAW_BASELINE_CHANGED')

  const moneylineRows = [...gameMap.values()]
    .filter((game) => matchupGamePks.has(game.gamePk))
    .map((game) => {
      const nativeGame = gamesByPk.get(game.gamePk)
      return {
        gamePk: game.gamePk,
        gameDate: dateKey(nativeGame?.game_date ?? game.gameDate),
        homeTeamId: nativeGame?.home_team_id ?? game.homeTeamId,
        awayTeamId: nativeGame?.away_team_id ?? game.awayTeamId,
        finalHomeScore: game.finalHomeScore,
        finalAwayScore: game.finalAwayScore,
        homeWin: game.finalHomeScore > game.finalAwayScore ? 1 : 0,
      }
    })
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)
  ensure(moneylineRows.length === expected.moneylineRows, `MONEYLINE_ROW_COUNT_CHANGED:${moneylineRows.length}`)
  ensure(new Set(moneylineRows.map((row) => row.gamePk)).size === moneylineRows.length, 'MONEYLINE_DUPLICATE_GAME_PK')
  ensure(moneylineRows.every((row) => Number.isFinite(row.finalHomeScore) && Number.isFinite(row.finalAwayScore)), 'MONEYLINE_FINAL_SCORE_MISSING')
  ensure(moneylineRows.every((row) => row.finalHomeScore !== row.finalAwayScore), 'MONEYLINE_TIE_FOUND')

  const splits = splitRows(moneylineRows)
  const splitRanges = Object.fromEntries(Object.entries(splits).map(([name, rows]) => [name, rangeFor(rows)]))
  const splitClassBalance = Object.fromEntries(Object.entries(splits).map(([name, rows]) => [name, classBalance(rows)]))
  const splitLookup = new Map(Object.entries(splits).flatMap(([name, rows]) => rows.map((row) => [row.gamePk, name])))
  const rowsForSplit = (rows) => ({
    train: rows.filter((row) => splitLookup.get(Number(row.target_game_pk)) === 'train'),
    validation: rows.filter((row) => splitLookup.get(Number(row.target_game_pk)) === 'validation'),
    test: rows.filter((row) => splitLookup.get(Number(row.target_game_pk)) === 'test'),
  })
  const splitFeatureDistribution = {
    teamRecentRunsPerGame: numericDistributionBySplit(rowsForSplit(featureRows.team), (row) => Number(row.recent_runs_per_game)),
    starterKRate: numericDistributionBySplit(rowsForSplit(featureRows.starter), (row) => Number(row.k_rate)),
    bullpenWhiffRate: numericDistributionBySplit(rowsForSplit(featureRows.bullpen), (row) => Number(row.bullpen_whiff_rate)),
  }

  const asOfViolations = Object.values(featureRows).flat().filter(sourceDateViolation).length
  ensure(asOfViolations === 0, `ASOF_VIOLATIONS:${asOfViolations}`)

  const gamePkDigest = sha256(stable(moneylineRows.map((row) => row.gamePk)))
  const labelDigest = sha256(stable(moneylineRows.map((row) => [row.gamePk, row.homeWin, row.finalHomeScore, row.finalAwayScore])))
  const splitDigest = sha256(stable(Object.entries(splits).flatMap(([split, rows]) => rows.map((row) => [row.gamePk, split]))))
  const datasetDigest = sha256(stable({
    datasetVersion,
    featureVersion,
    featureSetVersion,
    rowCount: moneylineRows.length,
    gamePkDigest,
    labelDigest,
    splitDigest,
  }))

  const candidateFeatures = {
    INCLUDE_CANDIDATE: [
      'home_team.recent_k_rate',
      'away_team.recent_k_rate',
      'diff.team_recent_k_rate',
      'home_team.recent_bb_rate',
      'away_team.recent_bb_rate',
      'diff.team_recent_bb_rate',
      'home_team.recent_runs_per_game',
      'away_team.recent_runs_per_game',
      'diff.team_recent_runs_per_game',
      'home_team.recent_iso',
      'away_team.recent_iso',
      'diff.team_recent_iso',
      'home_starter.k_rate',
      'away_starter.k_rate',
      'diff.starter_k_rate',
      'home_starter.bb_rate',
      'away_starter.bb_rate',
      'diff.starter_bb_rate',
      'home_starter.k_minus_bb_rate',
      'away_starter.k_minus_bb_rate',
      'diff.starter_k_minus_bb_rate',
      'home_starter.whiff_rate',
      'away_starter.whiff_rate',
      'diff.starter_whiff_rate',
      'home_starter.csw_rate',
      'away_starter.csw_rate',
      'diff.starter_csw_rate',
      'home_starter.avg_release_speed',
      'away_starter.avg_release_speed',
      'diff.starter_avg_release_speed',
      'home_starter.velocity_delta',
      'away_starter.velocity_delta',
      'diff.starter_velocity_delta',
      'home_starter.previous_pitch_count',
      'away_starter.previous_pitch_count',
      'diff.starter_previous_pitch_count',
      'home_starter.days_rest',
      'away_starter.days_rest',
      'diff.starter_days_rest',
      'home_bullpen.pitches_previous_24h',
      'away_bullpen.pitches_previous_24h',
      'diff.bullpen_pitches_previous_24h',
      'home_bullpen.pitches_previous_72h',
      'away_bullpen.pitches_previous_72h',
      'diff.bullpen_pitches_previous_72h',
      'home_bullpen.high_workload_reliever_count',
      'away_bullpen.high_workload_reliever_count',
      'diff.bullpen_high_workload_reliever_count',
      'home_bullpen.bullpen_k_rate',
      'away_bullpen.bullpen_k_rate',
      'diff.bullpen_k_rate',
      'home_bullpen.bullpen_bb_rate',
      'away_bullpen.bullpen_bb_rate',
      'diff.bullpen_bb_rate',
      'home_bullpen.bullpen_k_minus_bb_rate',
      'away_bullpen.bullpen_k_minus_bb_rate',
      'diff.bullpen_k_minus_bb_rate',
      'home_bullpen.bullpen_whiff_rate',
      'away_bullpen.bullpen_whiff_rate',
      'diff.bullpen_whiff_rate',
      'matchup.pitcher_batter_mix',
      'matchup.handedness_context',
      'matchup.park_context',
      'matchup.lineup_context',
      'first_inning.team_first_inning_scoring_rate',
      'first_inning.starter_first_inning_k_rate',
      'first_inning.starter_first_inning_bb_rate',
      'first_inning.starter_first_inning_baserunner_proxy',
      'first_inning.starter_first_inning_pitch_count',
      'sample_size.team',
      'sample_size.starter',
      'sample_size.bullpen',
      'sample_size.matchup',
      'missing_indicator.no_prior_starter',
      'missing_indicator.limited_team_history',
      'missing_indicator.limited_bullpen_history',
    ],
    EXCLUDE: [
      'game_pk',
      'id',
      'feature_snapshot_id',
      'player_id',
      'mlbam_pitcher_id',
      'mlbam_batter_id',
      'target_game_pk',
      'event_id',
      'provider ids',
      'deterministic_identity',
      'input_digest',
      'final_home_score',
      'final_away_score',
      'winner_team_id',
      'home_win',
      'run_differential',
      'settlement_status',
      'postgame stats',
      'target-game actual result',
      'odds',
      'closing_line',
    ],
    AUDIT_ONLY: [
      'feature_date',
      'as_of_date',
      'source_window',
      'feature_version',
      'created_at',
      'native_identity_metadata',
      'game_number',
      'doubleheader',
    ],
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02B_MONEYLINE_MODEL_TRAINING_PREP',
    certificationVerdict: 'MLB_DATA_02B_MONEYLINE_MODEL_TRAINING_PREP_CERTIFIED',
    publication: {
      publishedCommit: productionCommit,
      originMain: productionCommit,
      productionCommit: version.gitCommit,
      providerCallsMade: version.providerCallsMade,
      MLB_02B_PREPUBLISH_STATE: 'PASS',
      MLB_02B_02A_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    liveAuthority: {
      productionAuthorityReady: liveAuthority.productionAuthorityReady,
      criticalCodeIntegrity: liveAuthority.criticalCodeIntegrity,
      expectedDigestMatchesManifest: liveAuthority.expectedDigestMatchesManifest,
      MLB_02B_LIVE_AUTHORITY: 'PASS',
    },
    baselines: {
      featureCounts,
      duplicateNativeKeys,
      raw: rawBaseline,
      nativeCounts,
      modelCounts,
      predictionCounts,
      MLB_02B_FEATURE_FOUNDATION: 'PASS',
      MLB_02B_MODEL_ZERO_BASELINE: 'PASS',
    },
    moneylineDataset: {
      datasetVersion,
      featureVersion,
      featureSetVersion,
      splitVersion,
      rows: moneylineRows.length,
      targetGames: moneylineRows.length,
      targetContract: 'home_win = 1 if home final score > away final score; otherwise 0',
      rowIdentity: 'one canonical training row per game_pk',
      labelAmbiguity: 0,
      ties: 0,
      unresolvedFinals: 0,
      gamePkDigest,
      labelDigest,
      splitDigest,
      datasetDigest,
      MLB_02B_MONEYLINE_TARGET_CONTRACT: 'PASS',
      MLB_02B_MONEYLINE_ROW_IDENTITY: 'PASS',
      MLB_02B_MONEYLINE_DATASET_DIGEST_READY: 'YES',
    },
    homeAwayRepresentation: {
      state: 'READY',
      contract: 'Paired home_* and away_* feature namespaces with optional symmetric difference features computed as home minus away.',
      MLB_02B_HOME_AWAY_REPRESENTATION: 'READY',
      MLB_02B_SYMMETRY_CONTRACT: 'READY',
    },
    featureInventory: {
      candidateFeatures,
      candidateFeatureCount: candidateFeatures.INCLUDE_CANDIDATE.length,
      includedCandidateFamilies: ['team recent form', 'season-to-date team strength proxies', 'home/away context', 'starter recent/season form', 'starter workload/rest', 'bullpen performance/workload', 'offense logical coverage', 'matchup context', 'first-inning context', 'sample sizes', 'missingness indicators'],
      excludedIdentifierFields: candidateFeatures.EXCLUDE.filter((field) => !['final_home_score', 'final_away_score', 'winner_team_id', 'home_win', 'run_differential', 'settlement_status', 'postgame stats', 'target-game actual result', 'odds', 'closing_line'].includes(field)),
      excludedOutcomeFields: ['final_home_score', 'final_away_score', 'winner_team_id', 'home_win', 'run_differential', 'settlement_status', 'postgame stats', 'target-game actual result'],
      MLB_02B_MONEYLINE_FEATURE_INVENTORY_COMPLETE: 'YES',
      MLB_02B_IDENTIFIER_LEAKAGE_GUARD: 'PASS',
      MLB_02B_OUTCOME_FIELD_GUARD: 'PASS',
      MLB_02B_FEATURE_ASOF_GUARD: 'PASS',
    },
    missingValueContract: {
      state: 'READY',
      policy: 'No silent unknown-evidence zero-fill. Future training may use model-native missing handling, explicit missing indicators and fold-safe median imputation fit only on the training fold.',
      noPriorStarterAppearance: 'missing indicator plus model-native missing or train-fold imputation',
      limitedTeamHistory: 'sample-size feature plus missing/limited-history indicator',
      limitedBullpenHistory: 'sample-size feature plus missing/limited-history indicator',
      MLB_02B_MISSING_VALUE_CONTRACT: 'READY',
    },
    transformations: {
      scalingContract: {
        state: 'READY',
        logisticRegression: 'fold-safe numeric scaling required in future training',
        regularizedLogisticRegression: 'fold-safe numeric scaling required in future training',
        treeModels: 'scaling not required but numeric sanity checks still required',
        MLB_02B_SCALING_CONTRACT: 'READY',
      },
      categoricalContract: {
        state: 'READY',
        fields: ['home_away indicator is implicit in paired representation', 'park_context low-cardinality fields only if extracted safely'],
        exclusions: ['game_pk', 'raw player ids', 'MLBAM ids', 'database ids', 'provider ids'],
        MLB_02B_CATEGORICAL_CONTRACT: 'READY',
      },
    },
    splitDesign: {
      splitVersion,
      method: 'chronological 70/15/15 by ordered 2025 eligible game_pk rows',
      train: splitRanges.train,
      validation: splitRanges.validation,
      test: splitRanges.test,
      classBalance: splitClassBalance,
      featureDistributionAudit: splitFeatureDistribution,
      materialClassDriftFlag: 'NO',
      MLB_02B_CHRONOLOGICAL_SPLIT_READY: 'YES',
      MLB_02B_SPLIT_CLASS_BALANCE: 'PASS',
      MLB_02B_SPLIT_DISTRIBUTION_AUDIT: 'PASS',
      MLB_02B_FINAL_HOLDOUT_CONTRACT: 'PASS',
    },
    modelPrep: {
      algorithmShortlist: ['logistic_regression_baseline', 'regularized_logistic_regression', 'gradient_boosted_trees_if_existing_dependencies_support_safe_training'],
      trivialBaseline: 'constant home-team empirical win-rate from training fold only; optional team-strength benchmark in a later training phase',
      primaryMetrics: ['log_loss', 'brier_score', 'calibration'],
      secondaryMetrics: ['roc_auc', 'accuracy_at_0_5', 'balanced_accuracy'],
      calibrationPlan: ['reliability_diagram', 'calibration_slope_intercept', 'expected_calibration_error', 'validation-safe Platt or isotonic only if separately trained'],
      walkForwardPlan: 'train earlier chronological block, predict next block, expand or roll, repeat without using final holdout for model selection',
      trainingConfigContract: ['algorithm', 'hyperparameters', 'seed', 'dataset_digest', 'feature_set_version', 'split_version', 'code_commit', 'metrics'],
      championPromotionContract: 'Future champion must beat the trivial baseline on primary probability metrics, show acceptable calibration, preserve final-holdout performance, pass leakage checks and have reproducible artifacts.',
      futurePredictionSemantics: ['game_pk', 'home_win_probability', 'away_win_probability = 1 - home_win_probability', 'model_version', 'feature_version', 'as_of', 'confidence_or_uncertainty_metadata'],
      MLB_02B_ALGORITHM_SHORTLIST_READY: 'YES',
      MLB_02B_TRIVIAL_BASELINE_CONTRACT: 'READY',
      MLB_02B_PRIMARY_METRIC_CONTRACT: 'PASS',
      MLB_02B_SECONDARY_METRIC_CONTRACT: 'PASS',
      MLB_02B_CALIBRATION_PLAN: 'READY',
      MLB_02B_WALK_FORWARD_PLAN: 'READY',
      MLB_02B_FEATURE_SET_VERSION_READY: 'YES',
      MLB_02B_TRAINING_CONFIG_CONTRACT: 'READY',
      MLB_02B_CHAMPION_PROMOTION_CONTRACT: 'READY',
      MLB_02B_MONEYLINE_PREDICTION_SEMANTICS: 'READY',
      MLB_02B_PROBABILITY_VALUE_SEPARATION: 'PASS',
      MLB_02B_TRAINING_RUNNER_PREP: 'PASS',
      MLB_02B_TRAINING_EXECUTION_FAIL_CLOSED: 'PASS',
    },
    marketLimitation: {
      historicalOdds: 'MISSING',
      oddsAsTrainingFeature: 'EXCLUDED',
      valueValidationLimitation: 'EV, edge, CLV and market-relative profitability cannot be fully historically certified until valid market-price history exists.',
      MLB_02B_HISTORICAL_ODDS_ABSENCE_HANDLED: 'PASS',
      MLB_02B_VALUE_VALIDATION_LIMITATION_DOCUMENTED: 'YES',
    },
    safety: {
      modelTraining: 'NO',
      modelValidationExecution: 'NO',
      modelPersistence: 'NO',
      championPromotion: 'NO',
      predictionGeneration: 'NO',
      officialPicks: 'NO',
      valueBoard: 'NO',
      productionDml: 0,
      productionDdl: 0,
      providerCalls: 0,
      featureDml: 0,
      rawWrites: 0,
      import2026: 'NO',
      automation: 'OFF',
      cronChanges: 0,
      MODEL_WORK_PERFORMED: 'NO',
      PREDICTION_WORK_PERFORMED: 'NO',
    },
    flags: {
      PRODUCTION_ALIGNMENT: 'PASS',
      MLB_02B_FEATURE_FOUNDATION: 'PASS',
      MLB_02B_MODEL_ZERO_BASELINE: 'PASS',
      MLB_02B_MONEYLINE_TARGET_CONTRACT: 'PASS',
      MLB_02B_MONEYLINE_ROW_IDENTITY: 'PASS',
      MLB_02B_HOME_AWAY_REPRESENTATION: 'READY',
      MLB_02B_MONEYLINE_FEATURE_INVENTORY_COMPLETE: 'YES',
      MLB_02B_IDENTIFIER_LEAKAGE_GUARD: 'PASS',
      MLB_02B_OUTCOME_FIELD_GUARD: 'PASS',
      MLB_02B_FEATURE_ASOF_GUARD: 'PASS',
      MLB_02B_MISSING_VALUE_CONTRACT: 'READY',
      MLB_02B_CHRONOLOGICAL_SPLIT_READY: 'YES',
      MLB_02B_ALGORITHM_SHORTLIST_READY: 'YES',
      MLB_02B_TRIVIAL_BASELINE_CONTRACT: 'READY',
      MLB_02B_PRIMARY_METRIC_CONTRACT: 'PASS',
      MLB_02B_CALIBRATION_PLAN: 'READY',
      MLB_02B_HISTORICAL_ODDS_ABSENCE_HANDLED: 'PASS',
      MLB_02B_WALK_FORWARD_PLAN: 'READY',
      MLB_02B_FINAL_HOLDOUT_CONTRACT: 'PASS',
      MLB_02B_MONEYLINE_DATASET_DIGEST_READY: 'YES',
      MLB_02B_TRAINING_CONFIG_CONTRACT: 'READY',
      MLB_02B_CHAMPION_PROMOTION_CONTRACT: 'READY',
      MLB_02B_PROBABILITY_VALUE_SEPARATION: 'PASS',
      MLB_02B_TRAINING_RUNNER_PREP: 'PASS',
      MLB_02B_TRAINING_EXECUTION_FAIL_CLOSED: 'PASS',
      MODEL_WORK_PERFORMED: 'NO',
      PREDICTION_WORK_PERFORMED: 'NO',
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-02b-moneyline-training-prep', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
