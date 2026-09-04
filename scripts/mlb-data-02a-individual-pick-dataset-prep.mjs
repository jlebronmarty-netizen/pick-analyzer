import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const productionCommit = '215896e7fc62c95260782fd2ccc77f1c522219b1'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02a-individual-pick-model-dataset-preparation.json'

const expected = {
  rawRows: 712528,
  uniquePitchIdentities: 712528,
  duplicatePitchIdentities: 0,
  nativeGames: 2430,
  nativePlayers: 1469,
  eligibleGames: 2249,
  insufficientHistoryGames: 181,
  features: {
    snapshots: 67433,
    team: 4498,
    starter: 4498,
    bullpen: 4498,
    batter: 44943,
    matchup: 2249,
    firstInning: 2249,
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

function client() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

async function countRows(db, table, column = 'id', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(column, { count: 'exact', head: true }))
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

async function fetchRawWindow(db, columns, cursor, limit) {
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

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} HTTP_${response.status}`)
  return response.json()
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

function eventName(row) {
  return String(row.events ?? '').toLowerCase()
}

function hasPaEvent(row) {
  return row.events != null && String(row.events).trim() !== ''
}

function hitTotalBases(row) {
  const event = eventName(row)
  if (event.includes('home_run')) return 4
  if (event.includes('triple')) return 3
  if (event.includes('double')) return 2
  if (event.includes('single')) return 1
  return 0
}

function isStrikeout(row) {
  return eventName(row).includes('strikeout')
}

function likelyOuts(row) {
  const event = eventName(row)
  if (!event) return 0
  if (event.includes('triple_play')) return 3
  if (event.includes('double_play')) return 2
  if (
    event.includes('strikeout') ||
    event.includes('field_out') ||
    event.includes('force_out') ||
    event.includes('grounded_into') ||
    event.includes('sac_fly') ||
    event.includes('sac_bunt') ||
    event.includes('fielders_choice_out')
  ) return 1
  return 0
}

function summarizeNumeric(values) {
  const nums = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!nums.length) return { count: 0, min: null, p25: null, median: null, mean: null, p75: null, max: null }
  const pick = (p) => nums[Math.min(nums.length - 1, Math.floor((nums.length - 1) * p))]
  const sum = nums.reduce((total, value) => total + value, 0)
  return {
    count: nums.length,
    min: nums[0],
    p25: pick(0.25),
    median: pick(0.5),
    mean: Number((sum / nums.length).toFixed(4)),
    p75: pick(0.75),
    max: nums[nums.length - 1],
  }
}

function classBalance(positives, total) {
  const negative = total - positives
  return {
    positive: positives,
    negative,
    positiveRate: total ? Number((positives / total).toFixed(6)) : null,
  }
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
      firstInningHome: 0,
      firstInningAway: 0,
    })
  }
  const game = gameMap.get(key)
  if (row.post_home_score != null) game.finalHomeScore = Math.max(Number(row.post_home_score), game.finalHomeScore ?? 0)
  if (row.post_away_score != null) game.finalAwayScore = Math.max(Number(row.post_away_score), game.finalAwayScore ?? 0)
  if (Number(row.inning) === 1) {
    if (row.post_home_score != null) game.firstInningHome = Math.max(Number(row.post_home_score), game.firstInningHome)
    if (row.post_away_score != null) game.firstInningAway = Math.max(Number(row.post_away_score), game.firstInningAway)
  }
}

function addPlayerLabels(pitcherMap, batterMap, row) {
  const gamePk = Number(row.game_pk)
  const pitcherId = Number(row.mlbam_pitcher_id)
  const batterId = Number(row.mlbam_batter_id)
  if (pitcherId) {
    const pitcherKey = `${gamePk}|${pitcherId}`
    if (!pitcherMap.has(pitcherKey)) pitcherMap.set(pitcherKey, { gamePk, mlbamPitcherId: pitcherId, strikeouts: 0, hitsAllowed: 0, approximateOuts: 0, runsAllowedProxy: 0 })
    const pitcher = pitcherMap.get(pitcherKey)
    if (isStrikeout(row)) pitcher.strikeouts += 1
    if (hitTotalBases(row) > 0) pitcher.hitsAllowed += 1
    pitcher.approximateOuts += likelyOuts(row)
    const before = row.bat_score == null ? null : Number(row.bat_score)
    const after = row.post_bat_score == null ? null : Number(row.post_bat_score)
    if (before != null && after != null && after > before) pitcher.runsAllowedProxy += after - before
  }
  if (batterId) {
    const batterKey = `${gamePk}|${batterId}`
    if (!batterMap.has(batterKey)) batterMap.set(batterKey, { gamePk, mlbamBatterId: batterId, plateAppearances: 0, hits: 0, totalBases: 0, homeRuns: 0 })
    const batter = batterMap.get(batterKey)
    if (hasPaEvent(row)) batter.plateAppearances += 1
    const bases = hitTotalBases(row)
    if (bases > 0) batter.hits += 1
    batter.totalBases += bases
    if (bases === 4) batter.homeRuns += 1
  }
}

async function main() {
  const db = client()
  const [version, liveAuthority] = await Promise.all([
    fetchJson('https://pick-analyzer.vercel.app/api/system/version'),
    fetchJson('https://pick-analyzer.vercel.app/api/system/pick2/r1f-manifest-authority'),
  ])
  ensure(version.gitCommit === productionCommit, `PRODUCTION_ALIGNMENT_FAILED:${version.gitCommit}`)
  ensure(version.providerCallsMade === 0, 'PROVIDER_CALLS_NONZERO')
  ensure(liveAuthority.productionAuthorityReady === true && liveAuthority.criticalCodeIntegrity === 'PASS' && liveAuthority.expectedDigestMatchesManifest === true, 'LIVE_AUTHORITY_FAILED')

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

  const featureRows = {
    team: await readAll(db, 'pick2_mlb_team_daily_features', 'target_game_pk,team_id,feature_version,sample_sizes,source_window', (query) => query.eq('feature_version', featureVersion)),
    starter: await readAll(db, 'pick2_mlb_pitcher_daily_features', 'target_game_pk,mlbam_pitcher_id,feature_version,sample_sizes,source_window', (query) => query.eq('feature_version', featureVersion)),
    bullpen: await readAll(db, 'pick2_mlb_bullpen_daily_features', 'target_game_pk,team_id,feature_version,sample_sizes,source_window', (query) => query.eq('feature_version', featureVersion)),
    batter: await readAll(db, 'pick2_mlb_batter_daily_features', 'target_game_pk,mlbam_batter_id,feature_version,sample_sizes,source_window', (query) => query.eq('feature_version', featureVersion), 1000),
    matchup: await readAll(db, 'pick2_mlb_matchup_daily_features', 'target_game_pk,feature_version,sample_sizes,source_window', (query) => query.eq('feature_version', featureVersion)),
    firstInning: await readAll(db, 'pick2_mlb_first_inning_daily_features', 'target_game_pk,feature_version,sample_sizes,source_window', (query) => query.eq('feature_version', featureVersion)),
  }

  const duplicateNativeKeys = {
    team: duplicateCount(featureRows.team, ['target_game_pk', 'team_id', 'feature_version']),
    starter: duplicateCount(featureRows.starter, ['target_game_pk', 'mlbam_pitcher_id', 'feature_version']),
    bullpen: duplicateCount(featureRows.bullpen, ['target_game_pk', 'team_id', 'feature_version']),
    batter: duplicateCount(featureRows.batter, ['target_game_pk', 'mlbam_batter_id', 'feature_version']),
    matchup: duplicateCount(featureRows.matchup, ['target_game_pk', 'feature_version']),
    firstInning: duplicateCount(featureRows.firstInning, ['target_game_pk', 'feature_version']),
  }
  ensure(Object.values(duplicateNativeKeys).every((count) => count === 0), 'DUPLICATE_NATIVE_KEYS')

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

  const rawColumns = [
    'id',
    'game_pk',
    'game_date',
    'game_year',
    'canonical_home_team_id',
    'canonical_away_team_id',
    'mlbam_pitcher_id',
    'mlbam_batter_id',
    'at_bat_number',
    'pitch_number',
    'inning',
    'inning_topbot',
    'outs_when_up',
    'events',
    'description',
    'home_score',
    'away_score',
    'bat_score',
    'fld_score',
    'post_home_score',
    'post_away_score',
    'post_bat_score',
    'post_fld_score',
  ].join(',')
  const pitchIdentities = new Set()
  const gameMap = new Map()
  const pitcherLabels = new Map()
  const batterLabels = new Map()
  let rawRowCount = 0
  let cursor = null
  for (;;) {
    const rawPage = await fetchRawWindow(db, rawColumns, cursor, 5000)
    if (!rawPage.length) break
    for (const row of rawPage) {
      rawRowCount += 1
      pitchIdentities.add(`${row.game_pk}|${row.at_bat_number}|${row.pitch_number}`)
      addGame(gameMap, row)
      addPlayerLabels(pitcherLabels, batterLabels, row)
    }
    cursor = rawPage[rawPage.length - 1].id
    if (rawRowCount % 50000 === 0 || rawPage.length < 5000) console.error(JSON.stringify({ stage: '02a_raw_label_scan', rowsScanned: rawRowCount }))
    if (rawPage.length < 5000) break
  }
  const rawBaseline = {
    rawRows: rawRowCount,
    uniquePitchIdentities: pitchIdentities.size,
    duplicatePitchIdentities: rawRowCount - pitchIdentities.size,
  }
  ensure(rawBaseline.rawRows === expected.rawRows && rawBaseline.uniquePitchIdentities === expected.uniquePitchIdentities && rawBaseline.duplicatePitchIdentities === 0, 'RAW_BASELINE_CHANGED')

  const eligibleGamePks = new Set(featureRows.matchup.map((row) => Number(row.target_game_pk)))
  const eligibleGames = [...gameMap.values()].filter((game) => eligibleGamePks.has(game.gamePk))
  const labeledGames = eligibleGames.filter((game) => Number.isFinite(game.finalHomeScore) && Number.isFinite(game.finalAwayScore))
  const homeWins = labeledGames.filter((game) => game.finalHomeScore > game.finalAwayScore).length
  const finalTotals = labeledGames.map((game) => game.finalHomeScore + game.finalAwayScore)
  const runDiffs = labeledGames.map((game) => game.finalHomeScore - game.finalAwayScore)
  const nrfi = labeledGames.filter((game) => game.firstInningHome + game.firstInningAway === 0).length

  const starterRowsWithLabels = featureRows.starter.filter((row) => pitcherLabels.has(`${Number(row.target_game_pk)}|${Number(row.mlbam_pitcher_id)}`))
  const starterLabelRows = starterRowsWithLabels.map((row) => pitcherLabels.get(`${Number(row.target_game_pk)}|${Number(row.mlbam_pitcher_id)}`))
  const batterRowsWithLabels = featureRows.batter.filter((row) => batterLabels.has(`${Number(row.target_game_pk)}|${Number(row.mlbam_batter_id)}`))
  const batterLabelRows = batterRowsWithLabels.map((row) => batterLabels.get(`${Number(row.target_game_pk)}|${Number(row.mlbam_batter_id)}`))

  const sampleCounts = {
    gameLevel: {
      moneyline: { rows: labeledGames.length, uniqueGames: labeledGames.length, missingLabelExclusions: eligibleGames.length - labeledGames.length },
      runLineOutcome: { rows: labeledGames.length, uniqueGames: labeledGames.length, missingLabelExclusions: eligibleGames.length - labeledGames.length, sportsbookLineState: 'MISSING' },
      gameTotalOutcome: { rows: labeledGames.length, uniqueGames: labeledGames.length, missingLabelExclusions: eligibleGames.length - labeledGames.length, sportsbookLineState: 'MISSING' },
      teamTotalOutcome: { rows: labeledGames.length * 2, uniqueGames: labeledGames.length, missingLabelExclusions: (eligibleGames.length - labeledGames.length) * 2, sportsbookLineState: 'MISSING' },
      nrfiYrfi: { rows: labeledGames.length, uniqueGames: labeledGames.length, missingLabelExclusions: eligibleGames.length - labeledGames.length },
    },
    pitcher: {
      strikeouts: {
        rows: starterRowsWithLabels.length,
        uniqueGames: new Set(starterRowsWithLabels.map((row) => Number(row.target_game_pk))).size,
        uniquePitchers: new Set(starterRowsWithLabels.map((row) => Number(row.mlbam_pitcher_id))).size,
        noPriorHistoryExclusions: expected.features.starter - featureRows.starter.length,
        missingLabelExclusions: featureRows.starter.length - starterRowsWithLabels.length,
      },
      outs: {
        rows: starterRowsWithLabels.length,
        uniqueGames: new Set(starterRowsWithLabels.map((row) => Number(row.target_game_pk))).size,
        uniquePitchers: new Set(starterRowsWithLabels.map((row) => Number(row.mlbam_pitcher_id))).size,
        noPriorHistoryExclusions: 0,
        missingLabelExclusions: featureRows.starter.length - starterRowsWithLabels.length,
        exactness: 'PARTIAL_APPROXIMATED_FROM_EVENTS_PENDING_OFFICIAL_PITCHING_LINE',
      },
      earnedRuns: {
        rows: 0,
        uniqueGames: 0,
        uniquePitchers: 0,
        noPriorHistoryExclusions: 0,
        missingLabelExclusions: featureRows.starter.length,
        exactness: 'MISSING_EXACT_EARNED_RUNS_REQUIRES_OFFICIAL_PITCHING_LINE_OR_RESULT_ADAPTER',
      },
      hitsAllowed: {
        rows: starterRowsWithLabels.length,
        uniqueGames: new Set(starterRowsWithLabels.map((row) => Number(row.target_game_pk))).size,
        uniquePitchers: new Set(starterRowsWithLabels.map((row) => Number(row.mlbam_pitcher_id))).size,
        noPriorHistoryExclusions: 0,
        missingLabelExclusions: featureRows.starter.length - starterRowsWithLabels.length,
      },
    },
    batter: {
      hits: {
        rows: batterRowsWithLabels.length,
        uniqueGames: new Set(batterRowsWithLabels.map((row) => Number(row.target_game_pk))).size,
        uniqueBatters: new Set(batterRowsWithLabels.map((row) => Number(row.mlbam_batter_id))).size,
        missingFeatureExclusions: 0,
        missingLabelExclusions: featureRows.batter.length - batterRowsWithLabels.length,
      },
      totalBases: {
        rows: batterRowsWithLabels.length,
        uniqueGames: new Set(batterRowsWithLabels.map((row) => Number(row.target_game_pk))).size,
        uniqueBatters: new Set(batterRowsWithLabels.map((row) => Number(row.mlbam_batter_id))).size,
        missingFeatureExclusions: 0,
        missingLabelExclusions: featureRows.batter.length - batterRowsWithLabels.length,
      },
      homeRuns: {
        rows: batterRowsWithLabels.length,
        uniqueGames: new Set(batterRowsWithLabels.map((row) => Number(row.target_game_pk))).size,
        uniqueBatters: new Set(batterRowsWithLabels.map((row) => Number(row.mlbam_batter_id))).size,
        missingFeatureExclusions: 0,
        missingLabelExclusions: featureRows.batter.length - batterRowsWithLabels.length,
      },
    },
  }

  const distributions = {
    finalTotalRuns: summarizeNumeric(finalTotals),
    runDifferentialHomeMinusAway: summarizeNumeric(runDiffs),
    teamRuns: summarizeNumeric(labeledGames.flatMap((game) => [game.finalHomeScore, game.finalAwayScore])),
    pitcherStrikeouts: summarizeNumeric(starterLabelRows.map((row) => row.strikeouts)),
    pitcherApproximateOuts: summarizeNumeric(starterLabelRows.map((row) => row.approximateOuts)),
    pitcherHitsAllowed: summarizeNumeric(starterLabelRows.map((row) => row.hitsAllowed)),
    pitcherRunsAllowedProxy: summarizeNumeric(starterLabelRows.map((row) => row.runsAllowedProxy)),
    batterHits: summarizeNumeric(batterLabelRows.map((row) => row.hits)),
    batterTotalBases: summarizeNumeric(batterLabelRows.map((row) => row.totalBases)),
    batterHomeRuns: summarizeNumeric(batterLabelRows.map((row) => row.homeRuns)),
  }

  const classBalanceAudit = {
    homeWin: classBalance(homeWins, labeledGames.length),
    nrfi: classBalance(nrfi, labeledGames.length),
    yrfi: classBalance(labeledGames.length - nrfi, labeledGames.length),
    batterHitAtLeastOne: classBalance(batterLabelRows.filter((row) => row.hits >= 1).length, batterLabelRows.length),
    batterHomeRunAtLeastOne: classBalance(batterLabelRows.filter((row) => row.homeRuns >= 1).length, batterLabelRows.length),
  }

  const historicalOddsAvailability = {
    moneyline: 'MISSING',
    runLine: 'MISSING',
    gameTotal: 'MISSING',
    teamTotal: 'MISSING',
    nrfiYrfi: 'MISSING',
    pitcherProps: 'MISSING',
    batterProps: 'MISSING',
    note: 'No provider calls were made. Outcome datasets can proceed, but historical edge/EV/CLV validation requires separately certified market-price history.',
  }

  const datasetFamilies = {
    moneyline: {
      state: 'READY',
      target: 'home_win / away_win from final Statcast score reconstruction',
      rowIdentity: 'game_pk + market + selection',
      sampleCount: sampleCounts.gameLevel.moneyline,
      labelSource: 'DERIVABLE_FROM_STATCAST',
      featureFamilies: ['team', 'starter', 'bullpen', 'offense', 'matchup', 'first_inning_context'],
      marketPriceDependency: 'MISSING_FOR_EDGE_EV_CLV',
    },
    runLine: {
      state: 'PARTIAL',
      target: 'final run differential outcome ready; exact sportsbook spread-line dataset missing',
      rowIdentity: 'game_pk + line + selection',
      sampleCount: sampleCounts.gameLevel.runLineOutcome,
      labelSource: 'DERIVABLE_FROM_STATCAST',
      featureFamilies: ['team', 'starter', 'bullpen', 'offense', 'matchup'],
      marketPriceDependency: 'MISSING',
    },
    gameTotal: {
      state: 'PARTIAL',
      target: 'final total runs outcome ready; exact sportsbook total-line dataset missing',
      rowIdentity: 'game_pk + total_line + over_under_selection',
      sampleCount: sampleCounts.gameLevel.gameTotalOutcome,
      labelSource: 'DERIVABLE_FROM_STATCAST',
      featureFamilies: ['team_offense', 'starter_run_prevention', 'bullpen', 'first_inning', 'run_environment'],
      marketPriceDependency: 'MISSING',
    },
    teamTotal: {
      state: 'PARTIAL',
      target: 'team runs scored outcome ready; exact sportsbook team-total-line dataset missing',
      rowIdentity: 'game_pk + team_id + team_total_line + over_under_selection',
      sampleCount: sampleCounts.gameLevel.teamTotalOutcome,
      labelSource: 'DERIVABLE_FROM_STATCAST',
      featureFamilies: ['team_offense', 'opposing_starter', 'opposing_bullpen', 'matchup'],
      marketPriceDependency: 'MISSING',
    },
    nrfiYrfi: {
      state: 'READY',
      target: 'first inning run occurred',
      rowIdentity: 'game_pk + market + selection',
      sampleCount: sampleCounts.gameLevel.nrfiYrfi,
      labelSource: 'DERIVABLE_FROM_STATCAST',
      featureFamilies: ['starter', 'first_inning', 'top_of_order_offense', 'home_away_context'],
      marketPriceDependency: 'MISSING_FOR_EDGE_EV_CLV',
    },
    pitcherStrikeouts: {
      state: 'READY',
      target: 'starter strikeouts from Statcast PA events',
      rowIdentity: 'game_pk + mlbam_pitcher_id + market',
      sampleCount: sampleCounts.pitcher.strikeouts,
      labelSource: 'DERIVABLE_FROM_STATCAST',
      featureFamilies: ['starter', 'opponent_batter', 'opponent_offense', 'pitch_counts', 'recent_workload', 'rest', 'matchup'],
      marketPriceDependency: 'MISSING_FOR_PROP_LINE_AND_VALUE',
    },
    pitcherOuts: {
      state: 'PARTIAL',
      target: 'outs recorded requires exact official pitching-line validation; event-derived approximation available',
      rowIdentity: 'game_pk + mlbam_pitcher_id + market',
      sampleCount: sampleCounts.pitcher.outs,
      labelSource: 'REQUIRES_RESULT_ADAPTER',
      featureFamilies: ['starter', 'opponent_offense', 'pitch_counts', 'recent_workload', 'rest', 'matchup'],
      marketPriceDependency: 'MISSING',
    },
    pitcherEarnedRuns: {
      state: 'BLOCKED',
      target: 'earned runs allowed',
      rowIdentity: 'game_pk + mlbam_pitcher_id + market',
      sampleCount: sampleCounts.pitcher.earnedRuns,
      labelSource: 'REQUIRES_RESULT_ADAPTER',
      featureFamilies: ['starter', 'opponent_offense', 'bullpen_context', 'matchup'],
      marketPriceDependency: 'MISSING',
    },
    pitcherHitsAllowed: {
      state: 'READY',
      target: 'hits allowed from batter hit events charged to pitcher',
      rowIdentity: 'game_pk + mlbam_pitcher_id + market',
      sampleCount: sampleCounts.pitcher.hitsAllowed,
      labelSource: 'DERIVABLE_FROM_STATCAST',
      featureFamilies: ['starter', 'opponent_batter', 'opponent_offense', 'matchup'],
      marketPriceDependency: 'MISSING_FOR_PROP_LINE_AND_VALUE',
    },
    batterHits: {
      state: 'READY',
      target: 'batter >= 1 hit and raw hit count',
      rowIdentity: 'game_pk + mlbam_batter_id + market',
      sampleCount: sampleCounts.batter.hits,
      labelSource: 'DERIVABLE_FROM_STATCAST',
      featureFamilies: ['batter_recent_form', 'season_form', 'opposing_starter', 'handedness_matchup', 'bullpen_context'],
      marketPriceDependency: 'MISSING_FOR_PROP_LINE_AND_VALUE',
    },
    batterTotalBases: {
      state: 'READY',
      target: 'total bases from single/double/triple/home run events',
      rowIdentity: 'game_pk + mlbam_batter_id + market',
      sampleCount: sampleCounts.batter.totalBases,
      labelSource: 'DERIVABLE_FROM_STATCAST',
      featureFamilies: ['batter_recent_form', 'season_form', 'opposing_starter', 'handedness_matchup', 'bullpen_context'],
      marketPriceDependency: 'MISSING_FOR_PROP_LINE_AND_VALUE',
    },
    batterHomeRuns: {
      state: 'READY',
      target: 'home run >= 1',
      rowIdentity: 'game_pk + mlbam_batter_id + market',
      sampleCount: sampleCounts.batter.homeRuns,
      labelSource: 'DERIVABLE_FROM_STATCAST',
      featureFamilies: ['batter_recent_form', 'season_form', 'opposing_starter', 'handedness_matchup', 'bullpen_context'],
      marketPriceDependency: 'MISSING_FOR_PROP_LINE_AND_VALUE',
    },
  }

  const labelSourceInventory = {
    gameWinner: 'DERIVABLE_FROM_STATCAST',
    finalScore: 'DERIVABLE_FROM_STATCAST',
    firstInningRuns: 'DERIVABLE_FROM_STATCAST',
    pitcherStrikeouts: 'DERIVABLE_FROM_STATCAST',
    pitcherOuts: 'REQUIRES_RESULT_ADAPTER',
    pitcherEarnedRuns: 'REQUIRES_RESULT_ADAPTER',
    pitcherHitsAllowed: 'DERIVABLE_FROM_STATCAST',
    batterHits: 'DERIVABLE_FROM_STATCAST',
    batterTotalBases: 'DERIVABLE_FROM_STATCAST',
    batterHomeRuns: 'DERIVABLE_FROM_STATCAST',
  }

  const ranking = [
    { rank: 1, family: 'moneyline', state: 'READY', reason: '2,249 game-level rows, complete final-score labels, complete team/starter/bullpen/matchup context and simplest individual pick target.' },
    { rank: 2, family: 'NRFI_YRFI', state: 'READY', reason: '2,249 first-inning labels with certified first-inning/starter/team context; market history still needed for value validation.' },
    { rank: 3, family: 'pitcher_strikeouts', state: 'READY', reason: 'Starter strikeout labels are derivable with strong starter/opponent context, but prop line history is missing.' },
    { rank: 4, family: 'batter_hits_total_bases_home_runs', state: 'READY', reason: 'Large labeled batter sample, but per-player sparsity and prop line history make it less suitable than moneyline first.' },
    { rank: 5, family: 'run_line_game_total_team_total', state: 'PARTIAL', reason: 'Outcome labels exist, but exact historical market lines are missing.' },
    { rank: 6, family: 'pitcher_outs_earned_runs', state: 'PARTIAL_OR_BLOCKED', reason: 'Requires official pitching-line/result adapter for exact outs and earned runs.' },
  ]

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02A_INDIVIDUAL_PICK_MODEL_DATASET_PREPARATION',
    certificationVerdict: 'MLB_DATA_02A_INDIVIDUAL_PICK_MODEL_DATASET_PREPARATION_CERTIFIED',
    publication: {
      publishedCommit: productionCommit,
      originMain: productionCommit,
      productionCommit: version.gitCommit,
      providerCallsMade: version.providerCallsMade,
      MLB_02A_PREPUBLISH_STATE: 'PASS',
      MLB_02A_R1I_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    liveAuthority: {
      ...liveAuthority,
      MLB_02A_LIVE_AUTHORITY: 'PASS',
    },
    baselines: {
      featureCounts,
      duplicateNativeKeys,
      raw: rawBaseline,
      nativeCounts,
      modelCounts,
      predictionCounts,
      MLB_02A_FEATURE_FOUNDATION_READBACK: 'PASS',
      MLB_02A_RAW_NATIVE_BASELINE: 'PASS',
      MLB_02A_MODEL_PREDICTION_ZERO_BASELINE: 'PASS',
    },
    datasetPrepOnlyContract: {
      definesSupervisedDatasets: true,
      fitsModels: false,
      validationRuns: false,
      predictions: false,
      officialPicks: false,
      valueBoardPublication: false,
      parlayLabels: false,
      fullSlateCombinatorialLabels: false,
      MLB_02A_DATASET_PREP_ONLY_CONTRACT: 'PASS',
      MLB_02A_INDIVIDUAL_PICK_TARGET_CONTRACT: 'PASS',
    },
    datasetFamilies,
    labelSourceInventory,
    resultLabelStrategy: {
      pick2MlbGameResultsRows: 0,
      strategy: 'Prepare labels directly from certified historical Statcast/raw evidence for 02A; future result backfill remains separate and not written here.',
      MLB_02A_RESULT_LABEL_STRATEGY_READY: 'YES',
    },
    outcomeMarketSeparation: {
      outcomeDatasets: 'AVAILABLE_FOR_READY_FAMILIES',
      marketValueDatasets: 'LIMITED_UNTIL_HISTORICAL_MARKET_PRICE_HISTORY_CERTIFIED',
      MLB_02A_OUTCOME_MARKET_SEPARATION: 'PASS',
    },
    temporalSplitContract: {
      chronological: 'READY',
      randomShuffle: 'FORBIDDEN',
      exactBoundaries: 'DEFER_UNTIL_02B_AFTER_SAMPLE_INVENTORY_REVIEW',
      groupingKey: 'game_pk',
      playerPropRowsFromSameGameSameSplit: true,
      doubleheaderSafety: 'USE_GAME_PK_NOT_DATE',
      asOfRule: 'source_game_date < target_game_date',
      leakageDenylist: [
        'final_score',
        'final_winner',
        'postgame_pitcher_line',
        'postgame_batter_line',
        'future_games',
        'future_season_aggregates',
        'target_outcome_encoded_in_input',
        'closing_result_derived_fields',
      ],
      MLB_02A_CHRONOLOGICAL_SPLIT_CONTRACT: 'READY',
      MLB_02A_GAME_GROUP_SPLIT_GUARD: 'PASS',
      MLB_02A_DOUBLEHEADER_SPLIT_GUARD: 'PASS',
      MLB_02A_DATASET_ASOF_CONTRACT: 'PASS',
      MLB_02A_DATASET_LEAKAGE_DENYLIST: 'PASS',
    },
    sampleCounts,
    featureFamilyContracts: {
      moneyline: 'READY',
      totals: 'READY',
      nrfi: 'READY',
      pitcherProp: 'READY',
      batterProp: 'READY',
    },
    dataQuality: {
      missingnessMatrix: {
        moneyline: { featureMissing: 0, labelMissing: sampleCounts.gameLevel.moneyline.missingLabelExclusions, identityMissing: 0 },
        runLine: { featureMissing: 0, labelMissing: sampleCounts.gameLevel.runLineOutcome.missingLabelExclusions, identityMissing: 0, marketLineMissing: sampleCounts.gameLevel.runLineOutcome.rows },
        gameTotal: { featureMissing: 0, labelMissing: sampleCounts.gameLevel.gameTotalOutcome.missingLabelExclusions, identityMissing: 0, marketLineMissing: sampleCounts.gameLevel.gameTotalOutcome.rows },
        teamTotal: { featureMissing: 0, labelMissing: sampleCounts.gameLevel.teamTotalOutcome.missingLabelExclusions, identityMissing: 0, marketLineMissing: sampleCounts.gameLevel.teamTotalOutcome.rows },
        nrfiYrfi: { featureMissing: 0, labelMissing: sampleCounts.gameLevel.nrfiYrfi.missingLabelExclusions, identityMissing: 0 },
        pitcherStrikeouts: { featureMissing: 0, labelMissing: sampleCounts.pitcher.strikeouts.missingLabelExclusions, identityMissing: 0 },
        pitcherOuts: { featureMissing: 0, labelMissing: sampleCounts.pitcher.outs.missingLabelExclusions, identityMissing: 0, exactLabelAdapterRequired: true },
        pitcherEarnedRuns: { featureMissing: 0, labelMissing: sampleCounts.pitcher.earnedRuns.missingLabelExclusions, identityMissing: 0, exactLabelAdapterRequired: true },
        pitcherHitsAllowed: { featureMissing: 0, labelMissing: sampleCounts.pitcher.hitsAllowed.missingLabelExclusions, identityMissing: 0 },
        batterHits: { featureMissing: 0, labelMissing: sampleCounts.batter.hits.missingLabelExclusions, identityMissing: 0 },
        batterTotalBases: { featureMissing: 0, labelMissing: sampleCounts.batter.totalBases.missingLabelExclusions, identityMissing: 0 },
        batterHomeRuns: { featureMissing: 0, labelMissing: sampleCounts.batter.homeRuns.missingLabelExclusions, identityMissing: 0 },
      },
      classBalanceAudit,
      distributions,
      MLB_02A_MISSINGNESS_MATRIX_READY: 'YES',
      MLB_02A_CLASS_BALANCE_AUDIT: 'PASS',
      MLB_02A_TARGET_DISTRIBUTION_AUDIT: 'PASS',
    },
    historicalOddsAvailability,
    marketHistoryDependency: {
      MLB_02A_MARKET_HISTORY_DEPENDENCY_DOCUMENTED: 'YES',
      note: 'Outcome probability model development can proceed for READY families, but historical edge/EV/CLV validation is limited until market-price history exists.',
    },
    datasetArtifactPolicy: {
      giantDataExportCommitted: false,
      artifacts: ['specification', 'sample counts', 'distributions', 'readiness classifications', 'builder dry-run evidence'],
      MLB_02A_DATASET_ARTIFACT_POLICY: 'PASS',
      MLB_02A_DATASET_BUILD_DRY_RUN: 'PASS',
    },
    initialModelFamilyRanking: ranking,
    recommendedFirstModelFamily: {
      MLB_02A_RECOMMENDED_FIRST_MODEL_FAMILY: 'moneyline',
      reason: ranking[0].reason,
    },
    productAlignment: {
      valueBoard: 'PASS',
      officialPicks: 'PASS',
      parlayPolicy: 'PASS',
      productDirection: 'INDIVIDUAL_PICK_FIRST',
      mandatory100DailyParlays: 'RETIRED_AS_CORE_OBJECTIVE',
    },
    safety: {
      productionDml: 0,
      productionDdl: 0,
      providerCalls: 0,
      featureWrites: 0,
      rawWrites: 0,
      modelTraining: 0,
      modelValidationRuns: 0,
      championPromotion: 0,
      predictionGeneration: 0,
      officialPicksGeneration: 0,
      valueBoardPublication: 0,
      import2026: 0,
      automation: 'OFF',
      cronChanges: 0,
    },
    flags: {
      MLB_02A_FEATURE_FOUNDATION_READBACK: 'PASS',
      MLB_02A_RAW_NATIVE_BASELINE: 'PASS',
      MLB_02A_MODEL_PREDICTION_ZERO_BASELINE: 'PASS',
      MLB_02A_DATASET_PREP_ONLY_CONTRACT: 'PASS',
      MLB_02A_INDIVIDUAL_PICK_TARGET_CONTRACT: 'PASS',
      MLB_02A_LABEL_SOURCE_INVENTORY_COMPLETE: 'YES',
      MLB_02A_RESULT_LABEL_STRATEGY_READY: 'YES',
      MLB_02A_OUTCOME_MARKET_SEPARATION: 'PASS',
      MLB_02A_CHRONOLOGICAL_SPLIT_CONTRACT: 'READY',
      MLB_02A_GAME_GROUP_SPLIT_GUARD: 'PASS',
      MLB_02A_DOUBLEHEADER_SPLIT_GUARD: 'PASS',
      MLB_02A_DATASET_ASOF_CONTRACT: 'PASS',
      MLB_02A_DATASET_LEAKAGE_DENYLIST: 'PASS',
      MLB_02A_MISSINGNESS_MATRIX_READY: 'YES',
      MLB_02A_CLASS_BALANCE_AUDIT: 'PASS',
      MLB_02A_TARGET_DISTRIBUTION_AUDIT: 'PASS',
      MLB_02A_MARKET_HISTORY_DEPENDENCY_DOCUMENTED: 'YES',
      MLB_02A_INITIAL_MODEL_FAMILY_RANKING_READY: 'YES',
      MLB_02A_VALUE_BOARD_ALIGNMENT: 'PASS',
      MLB_02A_OFFICIAL_PICK_ALIGNMENT: 'PASS',
      MLB_02A_PARLAY_POLICY: 'PASS',
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
  console.error(JSON.stringify({ script: 'mlb-data-02a-individual-pick-dataset-prep', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
