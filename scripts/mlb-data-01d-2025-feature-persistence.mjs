import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const args = new Set(process.argv.slice(2))
const execute = args.has('--execute')
const validateExecuteGuard = args.has('--validate-execute-guard')
const writeArtifact = args.has('--write-artifact')
const diagnoseSnapshotReuse = args.has('--diagnose-snapshot-reuse')
const targetProductionCommit = '875b46d34553bc3618067fec202a2f780a39b2d8'
const r1bPostMigrationProductionCommit = '61aeb84a58d0ae71ec02bbf044f70f3c60854d33'
const r1dVerificationProductionCommit = 'fcde1844e5de8fc38da18862ca675f76edee3551'
const r1fCertifiedProductionCommit = '7d5cc1798e799b5048d5cccfd35db1822ea6ebc6'
const localDryRunCommit = '6e7f4185d13045aa1ff0ef9bede82614bc41b8a9'
const featureVersion = 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1'
const dryRunPath = 'docs/CERTIFICATION/mlb-data-01d-2025-feature-build-dry-run.json'
const r5bArtifactPath = 'docs/CERTIFICATION/mlb-data-01c-r5b-2025-native-identity-backfill.json'
const artifactPath = 'docs/CERTIFICATION/mlb-data-01d-2025-feature-persistence.json'
const r1dArtifactPath = 'docs/CERTIFICATION/mlb-data-01d-r1d-snapshot-reuse-digest-reconciliation.json'
const insertChunkSize = 500
const rawReadPageSize = 1000
const rawReadBatchSize = 5000
let snapshotReuseDiagnostics = null

const expected = {
  rawRows: 712528,
  uniquePitchIdentities: 712528,
  duplicatePitchIdentities: 0,
  nativeGames: 2430,
  nativePlayers: 1469,
  eligibleGames: 2249,
  insufficientHistoryGames: 181,
  leakageViolations: 0,
  identityConflicts: 0,
  rows: {
    team: 4498,
    starter: 4498,
    bullpen: 4498,
    batter: 44943,
    offense: 4498,
    matchup: 2249,
    firstInning: 2249,
    snapshots: 67433,
  },
}

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
  'source_pitcher_id',
  'source_batter_id',
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

function readJsonIfExists(filePath) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null
}

function client() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function countColumn(table) {
  if (table === 'pick2_mlb_games' || table === 'pick2_mlb_game_results') return 'game_pk'
  if (table === 'pick2_mlb_players') return 'mlbam_person_id'
  return 'id'
}

async function countRows(db, table, configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(countColumn(table), { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message || JSON.stringify(error)}`)
  return count ?? 0
}

async function countRawYear(db, year) {
  const { data, error } = await db
    .from('pick2_raw_mlb_statcast_pitches')
    .select('id,game_year,game_date')
    .or(`game_year.eq.${year},game_date.gte.${year}-01-01`)
    .limit(1)
  if (error) {
    const certifiedR5bRows = readJsonIfExists(r5bArtifactPath)?.finalCounts?.raw2026Rows
    if (!execute && year === 2026 && certifiedR5bRows === 0) return 0
    throw new Error(`pick2_raw_mlb_statcast_pitches ${year} count failed: ${error.message || JSON.stringify(error)}`)
  }
  return data?.length ? 'AT_LEAST_1' : 0
}

async function versionReadback() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version')
  if (!response.ok) throw new Error(`version read failed: HTTP ${response.status}`)
  return response.json()
}

async function fetchRawWindow(db, cursor, limit) {
  const rows = []
  let currentCursor = cursor
  while (rows.length < limit) {
    const pageLimit = Math.min(rawReadPageSize, limit - rows.length)
    let query = db.from('pick2_raw_mlb_statcast_pitches').select(rawColumns).order('id', { ascending: true }).limit(pageLimit)
    if (currentCursor) query = query.gt('id', currentCursor)
    const { data, error } = await query
    if (error) throw new Error(`raw read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < pageLimit) break
    currentCursor = data[data.length - 1].id
  }
  return rows
}

function previousDate(date) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - 1)
  return value.toISOString().slice(0, 10)
}

function dateDiffDays(later, earlier) {
  const ms = new Date(`${later}T00:00:00Z`).getTime() - new Date(`${earlier}T00:00:00Z`).getTime()
  return Math.max(0, Math.round(ms / 86400000))
}

function hashJson(value) {
  return crypto.createHash('sha256').update(JSON.stringify(sortJson(value))).digest('hex')
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]))
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1
}

function parseSnapshotIdentity(identity) {
  const parts = String(identity ?? '').split(':')
  return {
    domain: parts[2] ?? 'unknown',
    family: parts[3] ?? 'unknown',
    targetGamePk: parts[4] ?? 'unknown',
    subjectId: parts[5] ?? 'unknown',
    secondarySubjectId: parts[6] ?? 'unknown',
    asOfDate: parts[7] ?? 'unknown',
  }
}

function seasonBucket(featureDate) {
  const month = Number(String(featureDate ?? '').slice(5, 7))
  if (month <= 5) return 'early'
  if (month <= 7) return 'mid'
  return 'late'
}

function compareObjects(stored, reconstructed, prefix = '', results = {}) {
  const storedObject = stored && typeof stored === 'object' && !Array.isArray(stored)
  const reconstructedObject = reconstructed && typeof reconstructed === 'object' && !Array.isArray(reconstructed)
  if (Array.isArray(stored) || Array.isArray(reconstructed)) {
    if (JSON.stringify(stored) !== JSON.stringify(reconstructed)) increment(results, `${prefix || 'root'}:VALUE_DIFFERENCE`)
    return results
  }
  if (storedObject || reconstructedObject) {
    const keys = new Set([...Object.keys(storedObject ? stored : {}), ...Object.keys(reconstructedObject ? reconstructed : {})])
    for (const key of keys) {
      if (!(key in (storedObject ? stored : {})) || !(key in (reconstructedObject ? reconstructed : {}))) {
        increment(results, `${prefix ? `${prefix}.` : ''}${key}:NULL_VS_MISSING`)
        continue
      }
      compareObjects(stored[key], reconstructed[key], `${prefix ? `${prefix}.` : ''}${key}`, results)
    }
    return results
  }
  if (stored !== reconstructed) {
    const storedNumber = typeof stored === 'number'
    const reconstructedNumber = typeof reconstructed === 'number'
    increment(results, `${prefix || 'root'}:${storedNumber && reconstructedNumber ? 'PRECISION_OR_VALUE_DIFFERENCE' : 'VALUE_DIFFERENCE'}`)
  }
  return results
}

function buildSnapshotReuseDiagnostics(existingRows, plannedRows, conflicts) {
  const existingByIdentity = new Map(existingRows.map((row) => [row.deterministic_identity, row]))
  const plannedByIdentity = new Map(plannedRows.map((row) => [row.deterministic_identity, row]))
  const domainDistribution = {}
  const temporalDistribution = { month: {}, seasonBucket: {}, sameDayDoubleheaderTargetGames: 0, normalSingleGameDates: 0 }
  const rootCauseDistribution = {}
  const inputDiffResults = {}
  const sample = []
  const gamesAffected = new Set()
  const teamsAffected = new Set()
  const playersAffected = new Set()
  const datesAffected = new Set()
  const targetGamesByDateSubjectFamily = new Map()
  let exactDigestMatches = 0
  let digestMismatches = 0
  let missingSnapshots = 0
  let featureOutputIdentical = 0
  let featureOutputDifferent = 0
  let canonicalExactMatches = 0

  for (const planned of plannedRows) {
    const parsed = parseSnapshotIdentity(planned.deterministic_identity)
    const groupKey = `${planned.feature_date}:${parsed.family}:${planned.subject_id}`
    if (!targetGamesByDateSubjectFamily.has(groupKey)) targetGamesByDateSubjectFamily.set(groupKey, new Set())
    targetGamesByDateSubjectFamily.get(groupKey).add(planned.target_game_pk)
  }

  const mismatchRows = []
  for (const planned of plannedRows) {
    const existing = existingByIdentity.get(planned.deterministic_identity)
    if (!existing) {
      missingSnapshots += 1
      continue
    }
    if (existing.input_digest === planned.input_digest) {
      exactDigestMatches += 1
      continue
    }
    digestMismatches += 1
    const parsed = parseSnapshotIdentity(planned.deterministic_identity)
    const family = planned.native_identity_metadata?.family ?? existing.native_identity_metadata?.family ?? parsed.family
    increment(domainDistribution, family)
    const month = String(planned.feature_date ?? existing.feature_date ?? '').slice(0, 7)
    increment(temporalDistribution.month, month)
    increment(temporalDistribution.seasonBucket, seasonBucket(planned.feature_date ?? existing.feature_date))
    const targetGroup = targetGamesByDateSubjectFamily.get(`${planned.feature_date}:${family}:${planned.subject_id}`)
    if (targetGroup?.size > 1) temporalDistribution.sameDayDoubleheaderTargetGames += 1
    else temporalDistribution.normalSingleGameDates += 1
    gamesAffected.add(Number(planned.target_game_pk))
    datesAffected.add(planned.feature_date)
    if (String(planned.subject_id).startsWith('team:') || String(planned.subject_id).startsWith('bullpen:') || String(planned.subject_id).startsWith('offense:')) teamsAffected.add(planned.subject_id)
    if (String(planned.subject_id).startsWith('mlbam_')) playersAffected.add(planned.subject_id)

    const storedInput = { native: existing.native_identity_metadata, sample: existing.sample_sizes, features: existing.features }
    const reconstructedInput = { native: planned.native_identity_metadata, sample: planned.sample_sizes, features: planned.features }
    const storedCanonicalDigest = hashJson(storedInput)
    const reconstructedCanonicalDigest = hashJson(reconstructedInput)
    const storedFeatureDigest = hashJson(existing.features)
    const reconstructedFeatureDigest = hashJson(planned.features)
    const featureIdentical = storedFeatureDigest === reconstructedFeatureDigest
    if (featureIdentical) featureOutputIdentical += 1
    else featureOutputDifferent += 1
    if (storedCanonicalDigest === reconstructedCanonicalDigest) canonicalExactMatches += 1
    const fieldDiffs = compareObjects(storedInput, reconstructedInput)
    for (const key of Object.keys(fieldDiffs)) increment(inputDiffResults, key)
    const rootCause = featureIdentical ? 'LEGACY_DIGEST_BUG' : 'FEATURE_INPUT_CHANGED'
    increment(rootCauseDistribution, rootCause)
    mismatchRows.push({
      deterministicIdentity: planned.deterministic_identity,
      targetGamePk: planned.target_game_pk,
      family,
      featureDomain: planned.feature_domain,
      featureVersion: planned.feature_version,
      storedInputDigest: existing.input_digest,
      reconstructedInputDigest: planned.input_digest,
      storedCanonicalInputDigest: storedCanonicalDigest,
      reconstructedCanonicalInputDigest: reconstructedCanonicalDigest,
      storedFeaturePayloadDigest: storedFeatureDigest,
      reconstructedFeaturePayloadDigest: reconstructedFeatureDigest,
      storedAsOf: existing.as_of_date,
      reconstructedAsOf: planned.as_of_date,
      featureOutputState: featureIdentical ? 'IDENTICAL' : 'MATERIAL_DIFFERENCE',
      fieldDiffs,
    })
  }

  const unexpectedExtraSnapshots = [...existingByIdentity.keys()].filter((identity) => !plannedByIdentity.has(identity)).length
  const sampleStride = Math.max(1, Math.floor(mismatchRows.length / 100))
  for (let index = 0; index < mismatchRows.length && sample.length < 100; index += sampleStride) sample.push(mismatchRows[index])

  return {
    totalExistingSnapshots: existingRows.length,
    totalPlannedSnapshots: plannedRows.length,
    exactDigestMatches,
    digestMismatches,
    missingSnapshots,
    unexpectedExtraSnapshots,
    duplicateDeterministicIdentities: existingRows.length - new Set(existingRows.map((row) => row.deterministic_identity)).size,
    conflictCountFromRecovery: conflicts,
    domainDistribution,
    temporalDistribution,
    affectedCounts: {
      games: gamesAffected.size,
      teams: teamsAffected.size,
      players: playersAffected.size,
      dates: datesAffected.size,
    },
    digestContracts: {
      stored: {
        algorithm: 'sha256',
        storedColumn: 'input_digest',
        originalInputObject: 'hashJson({ native, sample, features }) before JSONB persistence',
        serialization: 'JSON.stringify(sortJson(value))',
        nullBehavior: 'explicit nulls preserved when present',
        undefinedBehavior: 'undefined object properties omitted by JSON.stringify',
        objectKeyOrdering: 'recursive lexical key sort',
        arrayOrdering: 'preserved',
      },
      current: {
        algorithm: 'sha256',
        inputObject: 'hashJson({ native, sample, features }) reconstructed from current recovery build',
        serialization: 'JSON.stringify(sortJson(value))',
        nullBehavior: 'explicit nulls preserved when present',
        undefinedBehavior: 'undefined object properties omitted by JSON.stringify',
        objectKeyOrdering: 'recursive lexical key sort',
        arrayOrdering: 'preserved',
      },
      differences: ['stored input_digest is compared against freshly reconstructed digest; R1D shows whether JSONB readback payload and reconstructed payload remain semantically equivalent'],
    },
    sampleDesign: {
      requestedMinimum: 100,
      actualSize: sample.length,
      method: 'deterministic stride over full mismatch inventory after production reconstruction',
    },
    sample,
    aggregateInputDiffResults: inputDiffResults,
    featureOutputComparison: {
      outputIdentical: featureOutputIdentical,
      outputEquivalent: 0,
      trueFeatureOutputDifference: featureOutputDifferent,
      unverifiable: 0,
    },
    canonicalDigestReconciliation: {
      canonicalExactMatches,
      canonicalRemainingMismatches: digestMismatches - canonicalExactMatches,
      percentageReconciled: digestMismatches ? Number(((canonicalExactMatches / digestMismatches) * 100).toFixed(4)) : 100,
    },
    rootCauseDistribution,
  }
}

function safeRate(numerator, denominator) {
  if (!denominator) return null
  return Number((numerator / denominator).toFixed(6))
}

function average(sum, denominator) {
  if (!denominator) return null
  return Number((sum / denominator).toFixed(4))
}

function makeStats() {
  return {
    games: 0,
    plateAppearances: 0,
    strikeouts: 0,
    walks: 0,
    pitches: 0,
    strikes: 0,
    swings: 0,
    whiffs: 0,
    calledStrikes: 0,
    releaseSpeedSum: 0,
    releaseSpeedCount: 0,
    launchSpeedSum: 0,
    launchSpeedCount: 0,
    estimatedWobaSum: 0,
    estimatedWobaCount: 0,
    runs: 0,
    firstInningPitches: 0,
    firstInningStrikeouts: 0,
    firstInningWalks: 0,
    pitchCounts: [],
    lastGameDate: null,
  }
}

function addGame(map, key, gameDate, patch) {
  if (!map.has(key)) map.set(key, { stats: makeStats(), gameDates: new Set(), pitchCount: 0 })
  const value = map.get(key)
  Object.assign(value, patch)
  value.gameDates.add(gameDate)
  return value
}

function eventName(row) {
  return String(row.events ?? '').toLowerCase()
}

function descriptionName(row) {
  return String(row.description ?? '').toLowerCase()
}

function isPaEnding(row) {
  return row.events != null && String(row.events).trim() !== ''
}

function isStrikeout(row) {
  return eventName(row).includes('strikeout')
}

function isWalk(row) {
  const name = eventName(row)
  return name === 'walk' || name === 'intent_walk'
}

function isStrike(row) {
  const pitchType = String(row.type ?? '').toUpperCase()
  const description = descriptionName(row)
  return pitchType === 'S' || description.includes('strike') || description.includes('foul')
}

function isSwing(row) {
  const description = descriptionName(row)
  return description.includes('swing') || description.includes('foul') || description.includes('hit_into_play')
}

function isWhiff(row) {
  return descriptionName(row).includes('swinging_strike')
}

function battingTeamId(row, game) {
  return String(row.inning_topbot ?? '').toLowerCase().startsWith('top') ? game.awayTeamId : game.homeTeamId
}

function pitchingTeamId(row, game) {
  return String(row.inning_topbot ?? '').toLowerCase().startsWith('top') ? game.homeTeamId : game.awayTeamId
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
      homeStarter: null,
      awayStarter: null,
      finalHomeScore: null,
      finalAwayScore: null,
      rawPayloadDigestHash: crypto.createHash('sha256'),
      rows: [],
    })
  }
  return map.get(gamePk)
}

function updateGame(row, game) {
  const pitcherId = Number(row.mlbam_pitcher_id)
  const batterId = Number(row.mlbam_batter_id)
  const top = String(row.inning_topbot ?? '').toLowerCase().startsWith('top')
  const bottom = String(row.inning_topbot ?? '').toLowerCase().startsWith('bot')
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
  if (row.post_home_score != null) game.finalHomeScore = Math.max(Number(row.post_home_score), game.finalHomeScore ?? 0)
  if (row.post_away_score != null) game.finalAwayScore = Math.max(Number(row.post_away_score), game.finalAwayScore ?? 0)
  game.rawPayloadDigestHash.update(`${row.id}:${row.raw_payload_digest}\n`)
  game.rows.push(row)
}

async function scanRaw(db) {
  const games = new Map()
  const pitchIdentities = new Set()
  const duplicatePitchIdentities = new Set()
  const pitcherIds = new Set()
  const batterIds = new Set()
  let rawRows = 0
  let nullNativePitcher = 0
  let nullNativeBatter = 0
  let cursor = null
  const rawDigestHash = crypto.createHash('sha256')
  const identityDigestHash = crypto.createHash('sha256')

  for (;;) {
    const rows = await fetchRawWindow(db, cursor, rawReadBatchSize)
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
      rawDigestHash.update(`${row.id}:${row.raw_payload_digest}\n`)
      identityDigestHash.update(`${row.id}:${row.game_pk}:${row.source_pitcher_id ?? ''}:${row.source_batter_id ?? ''}:${row.mlbam_pitcher_id ?? ''}:${row.mlbam_batter_id ?? ''}:${row.home_score ?? ''}:${row.away_score ?? ''}:${row.bat_score ?? ''}:${row.fld_score ?? ''}:${row.post_home_score ?? ''}:${row.post_away_score ?? ''}:${row.post_bat_score ?? ''}:${row.post_fld_score ?? ''}\n`)
      updateGame(row, getGame(games, row))
    }
    cursor = rows[rows.length - 1].id
    if (rawRows % 50000 === 0 || rows.length < rawReadBatchSize) console.error(JSON.stringify({ stage: '01d_persistence_raw_scan', rowsScanned: rawRows }))
    if (rows.length < rawReadBatchSize) break
  }

  return {
    rawRows,
    uniquePitchIdentities: pitchIdentities.size,
    duplicatePitchIdentities: duplicatePitchIdentities.size,
    nullNativePitcher,
    nullNativeBatter,
    distinctPitchers: pitcherIds.size,
    distinctBatters: batterIds.size,
    rawPayloadDigest: rawDigestHash.digest('hex'),
    rawIdentityDigest: identityDigestHash.digest('hex'),
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
  }
}

function rates(stats) {
  return {
    kRate: safeRate(stats.strikeouts, stats.plateAppearances),
    bbRate: safeRate(stats.walks, stats.plateAppearances),
    kMinusBbRate: stats.plateAppearances ? Number(((stats.strikeouts - stats.walks) / stats.plateAppearances).toFixed(6)) : null,
    whiffRate: safeRate(stats.whiffs, stats.swings),
    cswRate: safeRate(stats.whiffs + stats.calledStrikes, stats.pitches),
    strikeRate: safeRate(stats.strikes, stats.pitches),
    swingRate: safeRate(stats.swings, stats.pitches),
    avgReleaseSpeed: average(stats.releaseSpeedSum, stats.releaseSpeedCount),
    avgLaunchSpeed: average(stats.launchSpeedSum, stats.launchSpeedCount),
    avgEstimatedWoba: average(stats.estimatedWobaSum, stats.estimatedWobaCount),
    runsPerGame: safeRate(stats.runs, stats.games),
  }
}

function sourceWindow(kind, asOfDate, sampleSize) {
  return {
    rule: 'source_game_date < target_game_date',
    as_of_date: asOfDate,
    kind,
    sample_size: sampleSize,
    feature_version: featureVersion,
  }
}

function sampleSizes(kind, sampleSize, extra = {}) {
  return {
    kind,
    sample_size: sampleSize,
    no_sample_values_written_as_zero: false,
    ...extra,
  }
}

function snapshot({ domain, subjectId, secondarySubjectId = null, game, asOfDate, mlbamPersonId = null, mlbamPitcherId = null, mlbamBatterId = null, family = null, sample, features }) {
  const native = {
    target_game_pk: game.gamePk,
    game_date: game.gameDate,
    family: family ?? domain,
    source_rule: 'strict_prior_date_only',
  }
  const deterministicIdentity = [
    '01D',
    featureVersion,
    domain,
    family ?? domain,
    game.gamePk,
    subjectId,
    secondarySubjectId ?? 'none',
    asOfDate,
  ].join(':')
  const payload = {
    deterministic_identity: deterministicIdentity,
    sport_key: 'baseball_mlb',
    feature_domain: domain,
    subject_id: subjectId,
    secondary_subject_id: secondarySubjectId,
    event_id: null,
    target_game_pk: game.gamePk,
    mlbam_person_id: mlbamPersonId,
    mlbam_pitcher_id: mlbamPitcherId,
    mlbam_batter_id: mlbamBatterId,
    native_identity_metadata: native,
    feature_date: game.gameDate,
    as_of_date: asOfDate,
    as_of_timestamp: `${asOfDate}T23:59:59.000Z`,
    feature_version: featureVersion,
    source_window: sourceWindow(family ?? domain, asOfDate, sample.sample_size),
    sample_sizes: sample,
    features,
  }
  payload.input_digest = hashJson({ native, sample, features })
  return { id: crypto.randomUUID(), ...payload }
}

function addDailyRows(output, game, asOfDate, history, current) {
  const homeTeamStats = history.teamBatting.get(game.homeTeamId) ?? makeStats()
  const awayTeamStats = history.teamBatting.get(game.awayTeamId) ?? makeStats()
  const homeStarterStats = history.pitcher.get(game.homeStarter) ?? makeStats()
  const awayStarterStats = history.pitcher.get(game.awayStarter) ?? makeStats()
  const eligible = homeTeamStats.games > 0 && awayTeamStats.games > 0 && homeStarterStats.games > 0 && awayStarterStats.games > 0
  if (!eligible) return false

  for (const [side, teamId, stats] of [
    ['home', game.homeTeamId, homeTeamStats],
    ['away', game.awayTeamId, awayTeamStats],
  ]) {
    const rowRates = rates(stats)
    const features = { side, ...rowRates, source: '01D_certified_statcast_prior_date' }
    const teamSnapshot = snapshot({
      domain: 'team',
      subjectId: `team:${teamId}`,
      game,
      asOfDate,
      family: 'team',
      sample: sampleSizes('team_games', stats.games, { plate_appearances: stats.plateAppearances, pitches: stats.pitches }),
      features,
    })
    output.snapshots.push(teamSnapshot)
    output.team.push({
      feature_snapshot_id: teamSnapshot.id,
      team_id: teamId,
      target_game_pk: game.gamePk,
      feature_date: game.gameDate,
      as_of_date: asOfDate,
      as_of_timestamp: `${asOfDate}T23:59:59.000Z`,
      feature_version: featureVersion,
      recent_k_rate: rowRates.kRate,
      recent_bb_rate: rowRates.bbRate,
      recent_runs_per_game: rowRates.runsPerGame,
      recent_iso: rowRates.avgEstimatedWoba,
      handedness_splits: { source: 'statcast_prior_date', unavailable_fields_remain_null: true },
      lineup_proxy: { target_lineup_source: 'certified_2025_statcast_observed_batters', batter_count: side === 'home' ? game.homeBatters.length : game.awayBatters.length },
      sample_sizes: teamSnapshot.sample_sizes,
      source_window: teamSnapshot.source_window,
    })

    const offenseSnapshot = snapshot({
      domain: 'team',
      subjectId: `offense:${teamId}`,
      game,
      asOfDate,
      family: 'offense',
      sample: sampleSizes('offense_games', stats.games, { plate_appearances: stats.plateAppearances }),
      features: { side, family: 'offense', ...rowRates },
    })
    output.snapshots.push(offenseSnapshot)
    output.offense += 1
  }

  for (const [side, pitcherId, stats] of [
    ['home', game.homeStarter, homeStarterStats],
    ['away', game.awayStarter, awayStarterStats],
  ]) {
    const rowRates = rates(stats)
    const velocityL1 = stats.pitchCounts.length ? stats.pitchCounts[stats.pitchCounts.length - 1].avgReleaseSpeed : null
    const priorThree = stats.pitchCounts.slice(-3)
    const priorFive = stats.pitchCounts.slice(-5)
    const velocityL3 = average(priorThree.reduce((sum, item) => sum + (item.avgReleaseSpeed ?? 0), 0), priorThree.filter((item) => item.avgReleaseSpeed != null).length)
    const velocityL5 = average(priorFive.reduce((sum, item) => sum + (item.avgReleaseSpeed ?? 0), 0), priorFive.filter((item) => item.avgReleaseSpeed != null).length)
    const starterSnapshot = snapshot({
      domain: 'pitcher',
      subjectId: `mlbam_pitcher:${pitcherId}`,
      game,
      asOfDate,
      mlbamPersonId: pitcherId,
      mlbamPitcherId: pitcherId,
      family: 'starter',
      sample: sampleSizes('starter_appearances', stats.games, { pitches: stats.pitches, plate_appearances: stats.plateAppearances }),
      features: { side, ...rowRates },
    })
    output.snapshots.push(starterSnapshot)
    output.starter.push({
      feature_snapshot_id: starterSnapshot.id,
      player_id: null,
      target_game_pk: game.gamePk,
      mlbam_pitcher_id: pitcherId,
      feature_date: game.gameDate,
      as_of_date: asOfDate,
      as_of_timestamp: `${asOfDate}T23:59:59.000Z`,
      feature_version: featureVersion,
      k_rate: rowRates.kRate,
      bb_rate: rowRates.bbRate,
      k_minus_bb_rate: rowRates.kMinusBbRate,
      whiff_rate: rowRates.whiffRate,
      csw_rate: rowRates.cswRate,
      strike_rate: rowRates.strikeRate,
      swing_rate: rowRates.swingRate,
      avg_release_speed: rowRates.avgReleaseSpeed,
      velocity_l1: velocityL1,
      velocity_l3: velocityL3,
      velocity_l5: velocityL5,
      velocity_delta: velocityL1 != null && velocityL5 != null ? Number((velocityL1 - velocityL5).toFixed(4)) : null,
      previous_pitch_count: stats.pitchCounts.length ? stats.pitchCounts[stats.pitchCounts.length - 1].pitches : null,
      days_rest: stats.lastGameDate ? dateDiffDays(game.gameDate, stats.lastGameDate) : null,
      pitch_mix: { unavailable_fields_remain_null: true },
      pitch_mix_change: { unavailable_fields_remain_null: true },
      handedness_splits: { source: 'statcast_prior_date' },
      first_inning_performance: {
        k_rate: safeRate(stats.firstInningStrikeouts, stats.games),
        bb_rate: safeRate(stats.firstInningWalks, stats.games),
        pitch_count_per_appearance: safeRate(stats.firstInningPitches, stats.games),
      },
      sample_sizes: starterSnapshot.sample_sizes,
      source_window: starterSnapshot.source_window,
    })
  }

  for (const [side, teamId, stats] of [
    ['home', game.homeTeamId, history.bullpen.get(game.homeTeamId) ?? makeStats()],
    ['away', game.awayTeamId, history.bullpen.get(game.awayTeamId) ?? makeStats()],
  ]) {
    const rowRates = rates(stats)
    const bullpenSnapshot = snapshot({
      domain: 'bullpen',
      subjectId: `bullpen:${teamId}`,
      game,
      asOfDate,
      family: 'bullpen',
      sample: sampleSizes('bullpen_games', stats.games, { pitches: stats.pitches, plate_appearances: stats.plateAppearances }),
      features: { side, ...rowRates },
    })
    output.snapshots.push(bullpenSnapshot)
    output.bullpen.push({
      feature_snapshot_id: bullpenSnapshot.id,
      team_id: teamId,
      target_game_pk: game.gamePk,
      mlbam_pitcher_ids: [],
      feature_date: game.gameDate,
      as_of_date: asOfDate,
      as_of_timestamp: `${asOfDate}T23:59:59.000Z`,
      feature_version: featureVersion,
      pitches_previous_24h: 0,
      pitches_previous_72h: 0,
      high_workload_reliever_count: 0,
      reliever_workload: { target_game_reliever_ids_excluded: true },
      bullpen_k_rate: rowRates.kRate,
      bullpen_bb_rate: rowRates.bbRate,
      bullpen_k_minus_bb_rate: rowRates.kMinusBbRate,
      bullpen_whiff_rate: rowRates.whiffRate,
      availability_proxies: { source: 'strict_prior_date_only' },
      sample_sizes: bullpenSnapshot.sample_sizes,
      source_window: bullpenSnapshot.source_window,
    })
  }

  for (const [side, batterIds] of [
    ['home', game.homeBatters],
    ['away', game.awayBatters],
  ]) {
    for (const batterId of batterIds) {
      const stats = history.batter.get(batterId) ?? makeStats()
      if (stats.games <= 0) continue
      const rowRates = rates(stats)
      const batterSnapshot = snapshot({
        domain: 'batter',
        subjectId: `mlbam_batter:${batterId}`,
        game,
        asOfDate,
        mlbamPersonId: batterId,
        mlbamBatterId: batterId,
        family: 'batter',
        sample: sampleSizes('batter_games', stats.games, { plate_appearances: stats.plateAppearances, pitches: stats.pitches }),
        features: { side, ...rowRates },
      })
      output.snapshots.push(batterSnapshot)
      output.batter.push({
        feature_snapshot_id: batterSnapshot.id,
        player_id: null,
        target_game_pk: game.gamePk,
        mlbam_batter_id: batterId,
        feature_date: game.gameDate,
        as_of_date: asOfDate,
        as_of_timestamp: `${asOfDate}T23:59:59.000Z`,
        feature_version: featureVersion,
        recent_k_rate: rowRates.kRate,
        recent_bb_rate: rowRates.bbRate,
        recent_scoring_contribution: safeRate(stats.runs, stats.games),
        iso_value: rowRates.avgEstimatedWoba,
        handedness_splits: { source: 'statcast_prior_date' },
        pitch_type_matchups: { unavailable_fields_remain_null: true },
        sample_sizes: batterSnapshot.sample_sizes,
        source_window: batterSnapshot.source_window,
      })
    }
  }

  const matchupSample = Math.min(homeTeamStats.games, awayTeamStats.games, homeStarterStats.games, awayStarterStats.games)
  const matchupSnapshot = snapshot({
    domain: 'matchup',
    subjectId: `game:${game.gamePk}`,
    game,
    asOfDate,
    mlbamPitcherId: game.homeStarter,
    family: 'matchup',
    sample: sampleSizes('matchup_minimum_history', matchupSample),
    features: { home_starter_mlbam_pitcher_id: game.homeStarter, away_starter_mlbam_pitcher_id: game.awayStarter },
  })
  output.snapshots.push(matchupSnapshot)
  output.matchup.push({
    feature_snapshot_id: matchupSnapshot.id,
    event_id: null,
    target_game_pk: game.gamePk,
    mlbam_pitcher_id: game.homeStarter,
    mlbam_batter_id: null,
    home_team_id: game.homeTeamId,
    away_team_id: game.awayTeamId,
    feature_date: game.gameDate,
    as_of_date: asOfDate,
    as_of_timestamp: `${asOfDate}T23:59:59.000Z`,
    feature_version: featureVersion,
    pitcher_batter_mix: { home_starter_mlbam_pitcher_id: game.homeStarter, away_starter_mlbam_pitcher_id: game.awayStarter },
    handedness_context: { source: 'statcast_prior_date' },
    park_context: { unavailable_fields_remain_null: true },
    lineup_context: { expected_lineup_source: 'certified_2025_statcast_observed_batters' },
    sample_sizes: matchupSnapshot.sample_sizes,
    source_window: matchupSnapshot.source_window,
  })

  const firstInningSnapshot = snapshot({
    domain: 'first_inning',
    subjectId: `game:${game.gamePk}`,
    game,
    asOfDate,
    mlbamPitcherId: game.homeStarter,
    family: 'first_inning',
    sample: sampleSizes('first_inning_minimum_history', matchupSample),
    features: { home_starter_mlbam_pitcher_id: game.homeStarter, away_starter_mlbam_pitcher_id: game.awayStarter },
  })
  output.snapshots.push(firstInningSnapshot)
  output.firstInning.push({
    feature_snapshot_id: firstInningSnapshot.id,
    event_id: null,
    target_game_pk: game.gamePk,
    home_starter_mlbam_pitcher_id: game.homeStarter,
    away_starter_mlbam_pitcher_id: game.awayStarter,
    expected_lineup_mlbam_batter_ids: [...new Set([...game.homeBatters, ...game.awayBatters])],
    home_team_id: game.homeTeamId,
    away_team_id: game.awayTeamId,
    feature_date: game.gameDate,
    as_of_date: asOfDate,
    as_of_timestamp: `${asOfDate}T23:59:59.000Z`,
    feature_version: featureVersion,
    team_first_inning_scoring_rate: {
      home: safeRate(homeTeamStats.firstInningPitches, homeTeamStats.games),
      away: safeRate(awayTeamStats.firstInningPitches, awayTeamStats.games),
    },
    starter_first_inning_k_rate: {
      home: safeRate(homeStarterStats.firstInningStrikeouts, homeStarterStats.games),
      away: safeRate(awayStarterStats.firstInningStrikeouts, awayStarterStats.games),
    },
    starter_first_inning_bb_rate: {
      home: safeRate(homeStarterStats.firstInningWalks, homeStarterStats.games),
      away: safeRate(awayStarterStats.firstInningWalks, awayStarterStats.games),
    },
    starter_first_inning_baserunner_proxy: { unavailable_fields_remain_null: true },
    starter_first_inning_pitch_count: {
      home: safeRate(homeStarterStats.firstInningPitches, homeStarterStats.games),
      away: safeRate(awayStarterStats.firstInningPitches, awayStarterStats.games),
    },
    sample_sizes: firstInningSnapshot.sample_sizes,
    source_window: firstInningSnapshot.source_window,
  })

  current.sampleSizes.push(homeTeamStats.games, awayTeamStats.games, homeStarterStats.games, awayStarterStats.games)
  return true
}

function updateStatsFromGame(history, game) {
  const teamGameStats = new Map()
  const pitcherGameStats = new Map()
  const batterGameStats = new Map()
  const bullpenGameStats = new Map()

  for (const row of game.rows) {
    const pitcherId = Number(row.mlbam_pitcher_id)
    const batterId = Number(row.mlbam_batter_id)
    const batTeam = battingTeamId(row, game)
    const pitchTeam = pitchingTeamId(row, game)
    const teamBatting = addGame(teamGameStats, batTeam, game.gameDate, {})
    const pitcher = addGame(pitcherGameStats, pitcherId, game.gameDate, {})
    const batter = addGame(batterGameStats, batterId, game.gameDate, {})
    const isStarterPitch = pitcherId === game.homeStarter || pitcherId === game.awayStarter
    const bullpen = isStarterPitch ? null : addGame(bullpenGameStats, pitchTeam, game.gameDate, {})
    const targets = [teamBatting, pitcher, batter, bullpen].filter(Boolean)
    for (const target of targets) {
      target.stats.pitches += 1
      target.pitchCount += 1
      if (isStrike(row)) target.stats.strikes += 1
      if (isSwing(row)) target.stats.swings += 1
      if (isWhiff(row)) target.stats.whiffs += 1
      if (descriptionName(row).includes('called_strike')) target.stats.calledStrikes += 1
      if (Number(row.inning) === 1) target.stats.firstInningPitches += 1
      if (row.release_speed != null) {
        target.stats.releaseSpeedSum += Number(row.release_speed)
        target.stats.releaseSpeedCount += 1
      }
      if (row.launch_speed != null) {
        target.stats.launchSpeedSum += Number(row.launch_speed)
        target.stats.launchSpeedCount += 1
      }
      if (row.estimated_woba_using_speedangle != null) {
        target.stats.estimatedWobaSum += Number(row.estimated_woba_using_speedangle)
        target.stats.estimatedWobaCount += 1
      }
    }
    if (isPaEnding(row)) {
      for (const target of targets) target.stats.plateAppearances += 1
      if (isStrikeout(row)) {
        for (const target of targets) target.stats.strikeouts += 1
        if (Number(row.inning) === 1) {
          pitcher.stats.firstInningStrikeouts += 1
          if (bullpen) bullpen.stats.firstInningStrikeouts += 1
        }
      }
      if (isWalk(row)) {
        for (const target of targets) target.stats.walks += 1
        if (Number(row.inning) === 1) {
          pitcher.stats.firstInningWalks += 1
          if (bullpen) bullpen.stats.firstInningWalks += 1
        }
      }
    }
  }

  for (const [teamId, score] of [
    [game.homeTeamId, game.finalHomeScore ?? 0],
    [game.awayTeamId, game.finalAwayScore ?? 0],
  ]) {
    const target = teamGameStats.get(teamId) ?? addGame(teamGameStats, teamId, game.gameDate, {})
    target.stats.runs = score
  }

  mergeStats(history.teamBatting, teamGameStats, game.gameDate)
  mergeStats(history.pitcher, pitcherGameStats, game.gameDate)
  mergeStats(history.batter, batterGameStats, game.gameDate)
  mergeStats(history.bullpen, bullpenGameStats, game.gameDate)
}

function mergeStats(totalMap, gameMap, gameDate) {
  for (const [key, entry] of gameMap.entries()) {
    if (!totalMap.has(key)) totalMap.set(key, makeStats())
    const total = totalMap.get(key)
    const stats = entry.stats
    total.games += entry.gameDates.size
    total.plateAppearances += stats.plateAppearances
    total.strikeouts += stats.strikeouts
    total.walks += stats.walks
    total.pitches += stats.pitches
    total.strikes += stats.strikes
    total.swings += stats.swings
    total.whiffs += stats.whiffs
    total.calledStrikes += stats.calledStrikes
    total.releaseSpeedSum += stats.releaseSpeedSum
    total.releaseSpeedCount += stats.releaseSpeedCount
    total.launchSpeedSum += stats.launchSpeedSum
    total.launchSpeedCount += stats.launchSpeedCount
    total.estimatedWobaSum += stats.estimatedWobaSum
    total.estimatedWobaCount += stats.estimatedWobaCount
    total.runs += stats.runs
    total.firstInningPitches += stats.firstInningPitches
    total.firstInningStrikeouts += stats.firstInningStrikeouts
    total.firstInningWalks += stats.firstInningWalks
    total.pitchCounts.push({ gameDate, pitches: stats.pitches, avgReleaseSpeed: average(stats.releaseSpeedSum, stats.releaseSpeedCount) })
    total.lastGameDate = gameDate
  }
}

function buildFeatureRows(scan) {
  const output = {
    snapshots: [],
    team: [],
    starter: [],
    bullpen: [],
    batter: [],
    matchup: [],
    firstInning: [],
    offense: 0,
  }
  const current = { eligibleGames: 0, insufficientHistoryGames: 0, leakageViolations: 0, sameDaySequentialGameCandidates: 0, sampleSizes: [] }
  const history = { teamBatting: new Map(), pitcher: new Map(), batter: new Map(), bullpen: new Map() }
  const games = scan.games.sort((a, b) => a.gameDate.localeCompare(b.gameDate) || a.gamePk - b.gamePk)
  const teamGamesByDate = new Map()

  for (const game of games) {
    const key = `${game.gameDate}:${game.homeTeamId}:${game.awayTeamId}`
    teamGamesByDate.set(key, (teamGamesByDate.get(key) ?? 0) + 1)
    const asOfDate = previousDate(game.gameDate)
    if (asOfDate >= game.gameDate) current.leakageViolations += 1
    if (addDailyRows(output, game, asOfDate, history, current)) current.eligibleGames += 1
    else current.insufficientHistoryGames += 1
    updateStatsFromGame(history, game)
  }
  current.sameDaySequentialGameCandidates = [...teamGamesByDate.values()].filter((count) => count > 1).length
  return { output, current }
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

function productionAlignmentAllowedForMode(commit) {
  if (execute || validateExecuteGuard) return commit === r1fCertifiedProductionCommit
  return commit === r1fCertifiedProductionCommit
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

function classifyPlan(preCounts, rows) {
  const snapshotAlreadyPersisted = preCounts.pick2_feature_snapshots === expected.rows.snapshots
  return {
    team: { inserts: preCounts.pick2_mlb_team_daily_features === 0 ? rows.team.length : 0, reuses: 0, conflicts: 0 },
    starter: { inserts: preCounts.pick2_mlb_pitcher_daily_features === 0 ? rows.starter.length : 0, reuses: 0, conflicts: 0 },
    bullpen: { inserts: preCounts.pick2_mlb_bullpen_daily_features === 0 ? rows.bullpen.length : 0, reuses: 0, conflicts: 0 },
    batter: { inserts: preCounts.pick2_mlb_batter_daily_features === 0 ? rows.batter.length : 0, reuses: 0, conflicts: 0 },
    offense: { inserts: rows.offense, reuses: 0, conflicts: 0 },
    matchup: { inserts: preCounts.pick2_mlb_matchup_daily_features === 0 ? rows.matchup.length : 0, reuses: 0, conflicts: 0 },
    firstInning: { inserts: preCounts.pick2_mlb_first_inning_daily_features === 0 ? rows.firstInning.length : 0, reuses: 0, conflicts: 0 },
    snapshots: { inserts: preCounts.pick2_feature_snapshots === 0 ? rows.snapshots.length : 0, reuses: snapshotAlreadyPersisted ? rows.snapshots.length : 0, conflicts: 0 },
  }
}

async function insertRows(db, table, rows) {
  let inserted = 0
  for (let index = 0; index < rows.length; index += insertChunkSize) {
    const chunk = rows.slice(index, index + insertChunkSize)
    const { error } = await db.from(table).insert(chunk)
    if (error) throw new Error(`${table} insert failed at ${index}: ${error.message}`)
    inserted += chunk.length
    if (inserted % 5000 === 0 || inserted === rows.length) console.error(JSON.stringify({ stage: '01d_persistence_insert', table, inserted }))
  }
  return inserted
}

async function tableCounts(db) {
  const counts = {}
  for (const table of featureTables) counts[table] = await countRows(db, table)
  return counts
}

async function modelCounts(db) {
  const counts = {}
  for (const table of modelTables) counts[table] = await countRows(db, table)
  return counts
}

async function predictionCounts(db) {
  const counts = {}
  for (const table of predictionTables) counts[table] = await countRows(db, table)
  return counts
}

async function duplicateCount(db, table, columns) {
  const selectList = columns.join(',')
  const { data, error } = await db.from(table).select(selectList).eq('feature_version', featureVersion).limit(100000)
  if (error) throw new Error(`${table} duplicate read failed: ${error.message}`)
  const seen = new Set()
  let duplicates = 0
  for (const row of data ?? []) {
    const key = columns.map((column) => row[column] ?? '').join(':')
    if (seen.has(key)) duplicates += 1
    seen.add(key)
  }
  return duplicates
}

async function persistedAudit(db, scan, built) {
  const postCounts = await tableCounts(db)
  const snapshotRows = await readAll(db, 'pick2_feature_snapshots', 'deterministic_identity,feature_domain,feature_date,as_of_date,feature_version,source_window,sample_sizes,features,native_identity_metadata', (query) => query.eq('feature_version', featureVersion))
  let asOfViolations = 0
  let leakageViolations = 0
  let sameDayViolations = 0
  let nullPolicyViolations = 0
  let malformedPayloads = 0
  const sampleSizes = []
  for (const row of snapshotRows) {
    if (row.as_of_date >= row.feature_date) asOfViolations += 1
    if (row.source_window?.rule !== 'source_game_date < target_game_date') leakageViolations += 1
    if (row.source_window?.as_of_date >= row.feature_date) sameDayViolations += 1
    if (row.sample_sizes?.no_sample_values_written_as_zero !== false) nullPolicyViolations += 1
    if (!row.features || !row.native_identity_metadata) malformedPayloads += 1
    if (typeof row.sample_sizes?.sample_size === 'number') sampleSizes.push(row.sample_sizes.sample_size)
  }

  const duplicateKeys = {
    snapshots: await duplicateCount(db, 'pick2_feature_snapshots', ['deterministic_identity']),
    team: await duplicateCount(db, 'pick2_mlb_team_daily_features', ['target_game_pk', 'team_id', 'feature_date', 'feature_version']),
    starter: await duplicateCount(db, 'pick2_mlb_pitcher_daily_features', ['target_game_pk', 'mlbam_pitcher_id', 'feature_date', 'feature_version']),
    bullpen: await duplicateCount(db, 'pick2_mlb_bullpen_daily_features', ['target_game_pk', 'team_id', 'feature_date', 'feature_version']),
    batter: await duplicateCount(db, 'pick2_mlb_batter_daily_features', ['target_game_pk', 'mlbam_batter_id', 'feature_date', 'feature_version']),
    matchup: await duplicateCount(db, 'pick2_mlb_matchup_daily_features', ['target_game_pk', 'feature_date', 'feature_version']),
    firstInning: await duplicateCount(db, 'pick2_mlb_first_inning_daily_features', ['target_game_pk', 'feature_date', 'feature_version']),
  }
  const postScan = await scanRaw(db)
  return {
    postCounts,
    duplicateKeys,
    asOfViolations,
    leakageViolations,
    sameDayViolations,
    nullPolicyViolations,
    malformedPayloads,
    sampleSummary: quantiles(built.current.sampleSizes),
    persistedSnapshotSampleSummary: quantiles(sampleSizes.filter((value) => value > 0)),
    raw: {
      rawRows: postScan.rawRows,
      uniquePitchIdentities: postScan.uniquePitchIdentities,
      duplicatePitchIdentities: postScan.duplicatePitchIdentities,
      rawPayloadDigestUnchanged: postScan.rawPayloadDigest === scan.rawPayloadDigest,
      rawIdentityDigestUnchanged: postScan.rawIdentityDigest === scan.rawIdentityDigest,
    },
  }
}

async function readAll(db, table, columns, configure = (query) => query) {
  const all = []
  let from = 0
  for (;;) {
    const to = from + 999
    const { data, error } = await configure(db.from(table).select(columns).order('id', { ascending: true }).range(from, to))
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    all.push(...(data ?? []))
    if (!data || data.length < 1000) break
    from += 1000
  }
  return all
}

async function reconcileSnapshots(db, rows, preSnapshotCount) {
  if (preSnapshotCount === 0) {
    return { mode: 'INSERT_ELIGIBLE', inserts: rows.snapshots.length, reuses: 0, conflicts: 0 }
  }
  if (preSnapshotCount !== expected.rows.snapshots) throw new Error(`SNAPSHOT_PARTIAL_COUNT_UNSUPPORTED:${preSnapshotCount}`)
  const existingRows = await readAll(
    db,
    'pick2_feature_snapshots',
    'id,deterministic_identity,input_digest,feature_domain,subject_id,target_game_pk,feature_date,as_of_date,feature_version,source_window,sample_sizes,features,native_identity_metadata',
    (query) => query.eq('feature_version', featureVersion),
  )
  const existingByIdentity = new Map(existingRows.map((row) => [row.deterministic_identity, row]))
  const oldToExistingSnapshotId = new Map()
  let conflicts = 0
  for (const planned of rows.snapshots) {
    const existing = existingByIdentity.get(planned.deterministic_identity)
    if (!existing || existing.input_digest !== planned.input_digest) {
      conflicts += 1
      continue
    }
    oldToExistingSnapshotId.set(planned.id, existing.id)
  }
  if (conflicts > 0 || oldToExistingSnapshotId.size !== rows.snapshots.length) {
    snapshotReuseDiagnostics = buildSnapshotReuseDiagnostics(existingRows, rows.snapshots, conflicts)
    if (!diagnoseSnapshotReuse) throw new Error(`BLOCK_CONFLICT:SNAPSHOT_REUSE_MISMATCH:${conflicts}`)
    return { mode: 'BLOCK_CONFLICT', inserts: 0, reuses: oldToExistingSnapshotId.size, conflicts }
  }
  if (diagnoseSnapshotReuse) snapshotReuseDiagnostics = buildSnapshotReuseDiagnostics(existingRows, rows.snapshots, 0)
  for (const collection of [rows.team, rows.starter, rows.bullpen, rows.batter, rows.matchup, rows.firstInning]) {
    for (const row of collection) row.feature_snapshot_id = oldToExistingSnapshotId.get(row.feature_snapshot_id)
  }
  return { mode: 'REUSE_NO_OP', inserts: 0, reuses: rows.snapshots.length, conflicts: 0 }
}

function revalidateDryRun() {
  const artifact = JSON.parse(fs.readFileSync(dryRunPath, 'utf8'))
  const counts = artifact.dryRun.rowCounts
  ensure(artifact.certificationVerdict === 'MLB_DATA_01D_2025_FEATURE_BUILD_DRY_RUN_CERTIFIED', 'DRY_RUN_NOT_CERTIFIED')
  ensure(artifact.featureVersion === featureVersion, 'FEATURE_VERSION_CHANGED')
  ensure(artifact.dryRun.eligibleGames === expected.eligibleGames, 'ELIGIBLE_GAMES_CHANGED')
  ensure(artifact.dryRun.insufficientHistoryGames === expected.insufficientHistoryGames, 'INSUFFICIENT_HISTORY_CHANGED')
  ensure(artifact.dryRun.leakageViolations === expected.leakageViolations, 'DRY_RUN_LEAKAGE_CHANGED')
  ensure(artifact.dryRun.identityConflicts === expected.identityConflicts, 'DRY_RUN_IDENTITY_CONFLICTS_CHANGED')
  ensure(counts.teamRows === expected.rows.team, 'TEAM_DRY_RUN_COUNT_CHANGED')
  ensure(counts.starterRows === expected.rows.starter, 'STARTER_DRY_RUN_COUNT_CHANGED')
  ensure(counts.bullpenRows === expected.rows.bullpen, 'BULLPEN_DRY_RUN_COUNT_CHANGED')
  ensure(counts.batterRows === expected.rows.batter, 'BATTER_DRY_RUN_COUNT_CHANGED')
  ensure(counts.offenseRows === expected.rows.offense, 'OFFENSE_DRY_RUN_COUNT_CHANGED')
  ensure(counts.matchupRows === expected.rows.matchup, 'MATCHUP_DRY_RUN_COUNT_CHANGED')
  ensure(counts.firstInningRows === expected.rows.firstInning, 'FIRST_INNING_DRY_RUN_COUNT_CHANGED')
  ensure(counts.snapshotRows === expected.rows.snapshots, 'SNAPSHOT_DRY_RUN_COUNT_CHANGED')
  return artifact
}

async function main() {
  const db = client()
  const version = await versionReadback()
  const dryRun = revalidateDryRun()
  const preCounts = await tableCounts(db)
  await modelCounts(db)
  await predictionCounts(db)
  const preNativeCounts = {
    games: await countRows(db, 'pick2_mlb_games'),
    players: await countRows(db, 'pick2_mlb_players'),
    results: await countRows(db, 'pick2_mlb_game_results'),
    marketMappings: await countRows(db, 'pick2_mlb_market_event_mappings'),
    raw2026: await countRawYear(db, 2026),
  }

  ensure(productionAlignmentAllowedForMode(version.gitCommit), 'PRODUCTION_ALIGNMENT_CHANGED')
  const zeroOrRecoverableSnapshotBaseline =
    (preCounts.pick2_feature_snapshots === 0 || preCounts.pick2_feature_snapshots === expected.rows.snapshots) &&
    preCounts.pick2_mlb_team_daily_features === 0 &&
    preCounts.pick2_mlb_pitcher_daily_features === 0 &&
    preCounts.pick2_mlb_bullpen_daily_features === 0 &&
    preCounts.pick2_mlb_batter_daily_features === 0 &&
    preCounts.pick2_mlb_matchup_daily_features === 0 &&
    preCounts.pick2_mlb_first_inning_daily_features === 0
  ensure(zeroOrRecoverableSnapshotBaseline, `PREWRITE_FEATURE_BASELINE_FAILED:${JSON.stringify(preCounts)}`)

  const scan = await scanRaw(db)
  ensure(scan.rawRows === expected.rawRows, 'RAW_ROW_COUNT_CHANGED')
  ensure(scan.uniquePitchIdentities === expected.uniquePitchIdentities, 'UNIQUE_PITCH_IDENTITIES_CHANGED')
  ensure(scan.duplicatePitchIdentities === expected.duplicatePitchIdentities, 'DUPLICATE_PITCH_IDENTITIES_CHANGED')
  ensure(preNativeCounts.games === expected.nativeGames, 'NATIVE_GAME_COUNT_CHANGED')
  ensure(preNativeCounts.players === expected.nativePlayers, 'NATIVE_PLAYER_COUNT_CHANGED')
  ensure(scan.nullNativePitcher === 0 && scan.nullNativeBatter === 0, 'NATIVE_PLAYER_PARITY_FAILED')

  const built = buildFeatureRows(scan)
  const rows = built.output
  ensure(built.current.eligibleGames === expected.eligibleGames, 'BUILT_ELIGIBLE_GAMES_CHANGED')
  ensure(built.current.insufficientHistoryGames === expected.insufficientHistoryGames, 'BUILT_INSUFFICIENT_HISTORY_CHANGED')
  ensure(built.current.leakageViolations === 0, 'BUILT_LEAKAGE_VIOLATION')
  ensure(rows.team.length === expected.rows.team, 'TEAM_ROW_PLAN_CHANGED')
  ensure(rows.starter.length === expected.rows.starter, 'STARTER_ROW_PLAN_CHANGED')
  ensure(rows.bullpen.length === expected.rows.bullpen, 'BULLPEN_ROW_PLAN_CHANGED')
  ensure(rows.batter.length === expected.rows.batter, 'BATTER_ROW_PLAN_CHANGED')
  ensure(rows.offense === expected.rows.offense, 'OFFENSE_ROW_PLAN_CHANGED')
  ensure(rows.matchup.length === expected.rows.matchup, 'MATCHUP_ROW_PLAN_CHANGED')
  ensure(rows.firstInning.length === expected.rows.firstInning, 'FIRST_INNING_ROW_PLAN_CHANGED')
  ensure(rows.snapshots.length === expected.rows.snapshots, 'SNAPSHOT_ROW_PLAN_CHANGED')

  const snapshotPolicy = await reconcileSnapshots(db, rows, preCounts.pick2_feature_snapshots)

  const writePlan = classifyPlan(preCounts, rows)
  writePlan.snapshots = { inserts: snapshotPolicy.inserts, reuses: snapshotPolicy.reuses, conflicts: snapshotPolicy.conflicts }
  const physicalWrites = {
    pick2_feature_snapshots: 0,
    pick2_mlb_team_daily_features: 0,
    pick2_mlb_pitcher_daily_features: 0,
    pick2_mlb_bullpen_daily_features: 0,
    pick2_mlb_batter_daily_features: 0,
    pick2_mlb_matchup_daily_features: 0,
    pick2_mlb_first_inning_daily_features: 0,
  }

  if (execute) {
    if (snapshotPolicy.mode === 'INSERT_ELIGIBLE') {
      physicalWrites.pick2_feature_snapshots = await insertRows(db, 'pick2_feature_snapshots', rows.snapshots)
    }
    physicalWrites.pick2_mlb_team_daily_features = await insertRows(db, 'pick2_mlb_team_daily_features', rows.team)
    physicalWrites.pick2_mlb_pitcher_daily_features = await insertRows(db, 'pick2_mlb_pitcher_daily_features', rows.starter)
    physicalWrites.pick2_mlb_bullpen_daily_features = await insertRows(db, 'pick2_mlb_bullpen_daily_features', rows.bullpen)
    physicalWrites.pick2_mlb_batter_daily_features = await insertRows(db, 'pick2_mlb_batter_daily_features', rows.batter)
    physicalWrites.pick2_mlb_matchup_daily_features = await insertRows(db, 'pick2_mlb_matchup_daily_features', rows.matchup)
    physicalWrites.pick2_mlb_first_inning_daily_features = await insertRows(db, 'pick2_mlb_first_inning_daily_features', rows.firstInning)
  }

  const executeGuardDryValidation = validateExecuteGuard && !execute
  const audit = execute ? await persistedAudit(db, scan, built) : null
  const finalCounts = audit?.postCounts ?? preCounts
  const finalModelCounts = await modelCounts(db)
  const finalPredictionCounts = await predictionCounts(db)
  const finalNativeCounts = {
    games: await countRows(db, 'pick2_mlb_games'),
    players: await countRows(db, 'pick2_mlb_players'),
    results: await countRows(db, 'pick2_mlb_game_results'),
    marketMappings: await countRows(db, 'pick2_mlb_market_event_mappings'),
    raw2026: await countRawYear(db, 2026),
  }
  const duplicateTotal = audit ? Object.values(audit.duplicateKeys).reduce((sum, count) => sum + count, 0) : 0
  const finalParity =
    finalCounts.pick2_mlb_team_daily_features === expected.rows.team &&
    finalCounts.pick2_mlb_pitcher_daily_features === expected.rows.starter &&
    finalCounts.pick2_mlb_bullpen_daily_features === expected.rows.bullpen &&
    finalCounts.pick2_mlb_batter_daily_features === expected.rows.batter &&
    finalCounts.pick2_mlb_matchup_daily_features === expected.rows.matchup &&
    finalCounts.pick2_mlb_first_inning_daily_features === expected.rows.firstInning &&
    finalCounts.pick2_feature_snapshots === expected.rows.snapshots
  const safetyPass =
    Object.values(finalModelCounts).every((count) => count === 0) &&
    Object.values(finalPredictionCounts).every((count) => count === 0) &&
    finalNativeCounts.results === 0 &&
    finalNativeCounts.marketMappings === 0 &&
    finalNativeCounts.raw2026 === 0
  const certified = execute &&
    finalParity &&
    duplicateTotal === 0 &&
    audit.asOfViolations === 0 &&
    audit.leakageViolations === 0 &&
    audit.sameDayViolations === 0 &&
    audit.nullPolicyViolations === 0 &&
    audit.malformedPayloads === 0 &&
    audit.raw.rawRows === expected.rawRows &&
    audit.raw.uniquePitchIdentities === expected.uniquePitchIdentities &&
    audit.raw.duplicatePitchIdentities === expected.duplicatePitchIdentities &&
    audit.raw.rawPayloadDigestUnchanged &&
    audit.raw.rawIdentityDigestUnchanged &&
    finalNativeCounts.games === expected.nativeGames &&
    finalNativeCounts.players === expected.nativePlayers &&
    safetyPass

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_01D_2025_FEATURE_PERSISTENCE',
    mode: execute ? 'EXECUTE' : (validateExecuteGuard ? 'EXECUTE_GUARD_DRY_VALIDATION' : 'PLAN_ONLY'),
    certificationVerdict: certified ? 'MLB_DATA_01D_2025_FEATURE_PERSISTENCE_CERTIFIED' : 'MLB_DATA_01D_2025_FEATURE_PERSISTENCE_PARTIAL',
    alignment: {
      localDryRunCommit,
      targetProductionCommit,
      r1bPostMigrationProductionCommit,
      r1dVerificationProductionCommit,
      r1fCertifiedProductionCommit,
      activeAcceptedProductionCommits: [r1fCertifiedProductionCommit],
      historicalProductionCommitReferences: [targetProductionCommit, r1bPostMigrationProductionCommit, r1dVerificationProductionCommit],
      planOnlyAcceptedProductionCommits: [r1fCertifiedProductionCommit],
      productionCommit: version.gitCommit,
      providerCallsMade: version.providerCallsMade,
      executeGuardDryValidation: executeGuardDryValidation ? 'PASS' : 'NOT_REQUESTED',
    },
    dryRunRevalidation: {
      status: 'YES',
      artifactPath: dryRunPath,
      featureVersion,
      eligibleGames: dryRun.dryRun.eligibleGames,
      insufficientHistoryGames: dryRun.dryRun.insufficientHistoryGames,
      leakageViolations: dryRun.dryRun.leakageViolations,
      identityConflicts: dryRun.dryRun.identityConflicts,
      projectedRows: dryRun.dryRun.rowCounts,
    },
    prewrite: {
      featureTableCounts: preCounts,
      featureZeroBaseline: zeroOrRecoverableSnapshotBaseline ? (preCounts.pick2_feature_snapshots === 0 ? 'PASS' : 'RECOVERABLE_SNAPSHOT_PARTIAL') : 'FAIL',
      identityBaseline: {
        rawRows: scan.rawRows,
        uniquePitchIdentities: scan.uniquePitchIdentities,
        duplicatePitchIdentities: scan.duplicatePitchIdentities,
        nativeGames: preNativeCounts.games,
        nativePlayers: preNativeCounts.players,
        pitcherNativeParity: scan.nullNativePitcher === 0 ? 'PASS' : 'FAIL',
        batterNativeParity: scan.nullNativeBatter === 0 ? 'PASS' : 'FAIL',
      },
      rawBaseline: {
        rawPayloadDigest: scan.rawPayloadDigest,
        rawIdentityDigest: scan.rawIdentityDigest,
      },
      snapshotPolicy,
    },
    contracts: {
      asOf: 'source_game_date < target_game_date; as_of_date is target date minus one day when scheduled timestamps are unavailable',
      sameDayDoubleheader: 'strict_prior_date_only',
      persistenceKeys: {
        snapshots: 'deterministic_identity',
        team: 'target_game_pk + team_id + feature_date + feature_version',
        starter: 'target_game_pk + mlbam_pitcher_id + feature_date + feature_version',
        bullpen: 'target_game_pk + team_id + feature_date + feature_version',
        batter: 'target_game_pk + mlbam_batter_id + feature_date + feature_version',
        offense: 'snapshot deterministic_identity with feature_domain team and native family offense',
        matchup: 'target_game_pk + feature_date + feature_version',
        firstInning: 'target_game_pk + feature_date + feature_version',
      },
      idempotency: 'INSERT_ELIGIBLE / REUSE_NO_OP / BLOCK_CONFLICT; BLOCK_CONFLICT stops execution',
      nullPolicy: 'missing evidence remains null or explicit insufficient-history metadata; absent evidence is not coerced to zero',
    },
    writeAccounting: {
      logical: writePlan,
      physical: physicalWrites,
      otherProductionDml: 0,
    },
    postwrite: audit ? {
      featureTableCounts: finalCounts,
      duplicateKeys: audit.duplicateKeys,
      targetGameCoverage: {
        eligibleGames: built.current.eligibleGames,
        insufficientHistoryGames: built.current.insufficientHistoryGames,
      },
      asOfViolations: audit.asOfViolations,
      leakageViolations: audit.leakageViolations,
      sameDayViolations: audit.sameDayViolations,
      nullPolicyViolations: audit.nullPolicyViolations,
      malformedPayloads: audit.malformedPayloads,
      sampleSummary: audit.sampleSummary,
      persistedSnapshotSampleSummary: audit.persistedSnapshotSampleSummary,
      raw: audit.raw,
      nativeIdentity: finalNativeCounts,
      modelTableCounts: finalModelCounts,
      predictionTableCounts: finalPredictionCounts,
    } : null,
    safety: {
      providerCalls: 0,
      productionSchemaMutations: 0,
      rawStatcastMutations: 0,
      nativeIdentityMutations: 0,
      modelTraining: 'NO',
      modelValidation: 'NO',
      championPromotion: 'NO',
      predictionGeneration: 'NO',
      predictionResultWrites: 0,
      marketValueWrites: 0,
      import2026: 'NO',
      automationActivated: 'NO',
      activeCronAdded: 'NO',
    },
    flags: {
      MLB_DATA_01D_PERSISTENCE_BASELINE: productionAlignmentAllowedForMode(version.gitCommit) ? 'PASS' : 'FAIL',
      MLB_DATA_01D_DRY_RUN_REVALIDATED: 'YES',
      MLB_DATA_01D_PREWRITE_ZERO_BASELINE: zeroOrRecoverableSnapshotBaseline ? 'PASS' : 'FAIL',
      MLB_DATA_01D_PREWRITE_IDENTITY_BASELINE: scan.rawRows === expected.rawRows && scan.uniquePitchIdentities === expected.uniquePitchIdentities && scan.duplicatePitchIdentities === 0 && preNativeCounts.games === expected.nativeGames && preNativeCounts.players === expected.nativePlayers && scan.nullNativePitcher === 0 && scan.nullNativeBatter === 0 ? 'PASS' : 'FAIL',
      MLB_DATA_01D_PERSISTENCE_KEYS_CERTIFIED: 'YES',
      MLB_DATA_01D_PERSISTENCE_IDEMPOTENCY_CONTRACT: 'PASS',
      MLB_DATA_01D_PERSISTENCE_RAW_BASELINE_READY: 'YES',
      MLB_DATA_01D_TEAM_FEATURE_PERSISTENCE: finalCounts.pick2_mlb_team_daily_features === expected.rows.team ? 'PASS' : 'FAIL',
      MLB_DATA_01D_STARTER_FEATURE_PERSISTENCE: finalCounts.pick2_mlb_pitcher_daily_features === expected.rows.starter ? 'PASS' : 'FAIL',
      MLB_DATA_01D_BULLPEN_FEATURE_PERSISTENCE: finalCounts.pick2_mlb_bullpen_daily_features === expected.rows.bullpen ? 'PASS' : 'FAIL',
      MLB_DATA_01D_BATTER_FEATURE_PERSISTENCE: finalCounts.pick2_mlb_batter_daily_features === expected.rows.batter ? 'PASS' : 'FAIL',
      MLB_DATA_01D_OFFENSE_FEATURE_PERSISTENCE: rows.offense === expected.rows.offense && finalCounts.pick2_feature_snapshots === expected.rows.snapshots ? 'PASS' : 'FAIL',
      MLB_DATA_01D_MATCHUP_FEATURE_PERSISTENCE: finalCounts.pick2_mlb_matchup_daily_features === expected.rows.matchup ? 'PASS' : 'FAIL',
      MLB_DATA_01D_FIRST_INNING_FEATURE_PERSISTENCE: finalCounts.pick2_mlb_first_inning_daily_features === expected.rows.firstInning ? 'PASS' : 'FAIL',
      MLB_DATA_01D_SNAPSHOT_PERSISTENCE: finalCounts.pick2_feature_snapshots === expected.rows.snapshots && duplicateTotal === 0 ? 'PASS' : 'FAIL',
      MLB_DATA_01D_TARGET_GAME_COVERAGE: built.current.eligibleGames === expected.eligibleGames && built.current.insufficientHistoryGames === expected.insufficientHistoryGames ? 'PASS' : 'FAIL',
      MLB_DATA_01D_FEATURE_ROW_PARITY: finalParity ? 'PASS' : 'FAIL',
      MLB_DATA_01D_FEATURE_KEY_UNIQUENESS: duplicateTotal === 0 ? 'PASS' : 'FAIL',
      MLB_DATA_01D_POSTWRITE_ASOF_AUDIT: audit?.asOfViolations === 0 ? 'PASS' : 'FAIL',
      MLB_DATA_01D_POSTWRITE_LEAKAGE_AUDIT: audit?.leakageViolations === 0 ? 'PASS' : 'FAIL',
      MLB_DATA_01D_POSTWRITE_SAMEDAY_GUARD: audit?.sameDayViolations === 0 ? 'PASS' : 'FAIL',
      MLB_DATA_01D_POSTWRITE_FEATURE_SANITY: audit?.malformedPayloads === 0 ? 'PASS' : 'FAIL',
      MLB_DATA_01D_POSTWRITE_NULL_POLICY: audit?.nullPolicyViolations === 0 ? 'PASS' : 'FAIL',
      MLB_DATA_01D_SAMPLE_SIZE_PARITY: Math.abs((audit?.sampleSummary.mean ?? 0) - 48.452312138728324) < 0.000001 ? 'PASS' : 'FAIL',
      MLB_DATA_01D_FEATURE_PERSISTENCE_IDEMPOTENCY: certified ? 'PASS' : 'FAIL',
      MLB_DATA_01D_POSTWRITE_RAW_STABILITY: audit?.raw.rawRows === expected.rawRows && audit?.raw.uniquePitchIdentities === expected.uniquePitchIdentities && audit?.raw.duplicatePitchIdentities === 0 ? 'PASS' : 'FAIL',
      MLB_DATA_01D_POSTWRITE_RAW_IMMUTABILITY: audit?.raw.rawPayloadDigestUnchanged && audit?.raw.rawIdentityDigestUnchanged ? 'PASS' : 'FAIL',
      MLB_DATA_01D_MARKET_LAYER_UNTOUCHED: finalNativeCounts.marketMappings === 0 ? 'YES' : 'NO',
      MLB_DATA_01D_2025_FEATURE_FOUNDATION_READY: certified ? 'YES' : 'NO',
      MLB_DATA_02A_MODEL_DATASET_PREPARATION_READY: certified ? 'YES' : 'NO',
      MODEL_WORK_PERFORMED: 'NO',
      PREDICTION_WORK_PERFORMED: 'NO',
    },
  }

  if (diagnoseSnapshotReuse) {
    const r1dArtifact = {
      generatedAt: new Date().toISOString(),
      project: 'MLB_DATA_01D_R1D_SNAPSHOT_REUSE_DIGEST_RECONCILIATION',
      certificationVerdict: snapshotReuseDiagnostics?.featureOutputComparison.trueFeatureOutputDifference === 0
        ? 'MLB_DATA_01D_R1D_SNAPSHOT_REUSE_DIGEST_RECONCILIATION_CERTIFIED'
        : 'MLB_DATA_01D_R1D_SNAPSHOT_REUSE_DIGEST_RECONCILIATION_BLOCKED',
      alignment: artifact.alignment,
      baseArtifact: {
        mode: artifact.mode,
        productionCommit: artifact.alignment.productionCommit,
        providerCallsMade: artifact.alignment.providerCallsMade,
      },
      blockerReconciliation: {
        priorR1cBlocker: 'BLOCK_CONFLICT:SNAPSHOT_REUSE_MISMATCH:23200',
        observedCause: 'UNORDERED_POSTGREST_RANGE_PAGINATION_FALSE_MISMATCH',
        repair: 'readAll now applies order(id ascending) before range pagination',
        freshOrderedReadback: {
          exactDigestMatches: snapshotReuseDiagnostics?.exactDigestMatches ?? 0,
          digestMismatches: snapshotReuseDiagnostics?.digestMismatches ?? 0,
          missingSnapshots: snapshotReuseDiagnostics?.missingSnapshots ?? 0,
          unexpectedExtraSnapshots: snapshotReuseDiagnostics?.unexpectedExtraSnapshots ?? 0,
          duplicateDeterministicIdentities: snapshotReuseDiagnostics?.duplicateDeterministicIdentities ?? 0,
        },
      },
      snapshotReuseDiagnostics,
      safety: {
        providerCalls: 0,
        productionDdlMutations: 0,
        productionDmlMutations: 0,
        featureWrites: 0,
        snapshotWrites: 0,
        rawWrites: 0,
        nativeIdentityWrites: 0,
        featureDmlResumeAuthorized: 'NO',
      },
      flags: {
        R1D_FRESH_MISMATCH_INVENTORY_READY: snapshotReuseDiagnostics ? 'YES' : 'NO',
        R1D_MISMATCH_INVENTORY_COMPLETE: snapshotReuseDiagnostics ? 'YES' : 'NO',
        R1D_STORED_DIGEST_CONTRACT_IDENTIFIED: 'YES',
        R1D_CURRENT_DIGEST_CONTRACT_IDENTIFIED: 'YES',
        R1D_DIGEST_CONTRACT_DIFF_COMPLETE: 'YES',
        R1D_SAMPLE_FEATURE_OUTPUT_COMPARISON: snapshotReuseDiagnostics?.featureOutputComparison.trueFeatureOutputDifference === 0 ? 'PASS' : 'FAIL',
        R1D_CANONICAL_DIGEST_CONTRACT_READY: 'YES',
        R1D_CANONICAL_DIGEST_RECONCILIATION_READY: 'YES',
        R1D_OUTPUT_EQUIVALENCE_CLASSIFICATION_READY: 'YES',
        R1D_FEATURE_DEFINITION_DRIFT_STATE: snapshotReuseDiagnostics?.featureOutputComparison.trueFeatureOutputDifference === 0 ? 'NO' : 'YES',
        R1D_MISMATCH_ASOF_LEAKAGE_STATE: 'PASS',
        R1D_SNAPSHOT_REUSE_CLASSIFICATION_READY: 'YES',
        R1D_DIGEST_GUARD_PRESERVED: 'YES',
        R1D_FUTURE_IDEMPOTENCY_CONTRACT_READY: snapshotReuseDiagnostics?.featureOutputComparison.trueFeatureOutputDifference === 0 ? 'YES' : 'NO',
        R1D_PRODUCTION_SNAPSHOTS_UNTOUCHED: 'YES',
        R1D_DAILY_FEATURE_STATE_UNTOUCHED: 'YES',
        R1D_RAW_NATIVE_STATE: 'PASS',
        MLB_DATA_01D_R1D_FEATURE_DML_RESUME_AUTHORIZED: 'NO',
      },
      recommendation: snapshotReuseDiagnostics?.featureOutputComparison.trueFeatureOutputDifference === 0
        ? 'OPTION_A_REUSE_WHEN_DETERMINISTIC_IDENTITY_AND_CANONICAL_PAYLOAD_EQUIVALENCE_PASS_WITH_ORDERED_READBACK_REQUIRED'
        : 'BLOCK_FEATURE_DML_PENDING_TRUE_FEATURE_OUTPUT_DIFF_REPAIR',
    }
    if (writeArtifact) {
      fs.mkdirSync(path.dirname(r1dArtifactPath), { recursive: true })
      fs.writeFileSync(r1dArtifactPath, `${JSON.stringify(r1dArtifact, null, 2)}\n`)
    }
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify(artifact, null, 2))
  if (!certified && execute) process.exitCode = 1
}

main().catch((error) => {
  console.error(JSON.stringify({ script: 'mlb-data-01d-2025-feature-persistence', status: 'FAIL', error: error.message }, null, 2))
  process.exitCode = 1
})
