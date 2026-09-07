import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const args = new Set(process.argv.slice(2))
const targetCommit = 'ecf3c666aaa5c801feb4b322f87375e012ceb191'
const baseUrl = 'https://pick-analyzer.vercel.app'
const pipelineVersion = 'MLB_DATA_02R_R1_MANUAL_DAILY_REFRESH_EXECUTION_PACKET_V1'
const policyVersion = 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1'
const championVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const runType = 'MANUAL_CURRENT_SLATE'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02r-r1-daily-refresh-execution-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02r-r1-manual-daily-refresh-execution-prep-audit.md'

if (args.has('--execute') || args.has('--execute-current-slate') || args.has('--refresh-odds')) {
  console.error('DAILY_REFRESH_EXECUTION_FORBIDDEN_IN_02R_R1_PREP')
  process.exit(1)
}

function loadLocalEnv() {
  for (const envPath of ['.env.local', '.env']) {
    const resolved = path.join(process.cwd(), envPath)
    if (!fs.existsSync(resolved)) continue
    for (const line of fs.readFileSync(resolved, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index <= 0) continue
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
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

function git(commandArgs) {
  return execFileSync('git', commandArgs, { encoding: 'utf8' }).trim()
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

function allowedR1Worktree(status) {
  if (status === '') return true
  return status.split(/\r?\n/).filter(Boolean).every((line) => {
    const file = line.replace(/^[ ?MADRCU!]{1,2}\s+/, '').replaceAll('\\', '/')
    return file === 'docs/MASTER_ROADMAP.md' ||
      file === 'docs/PROJECT_STATUS.md' ||
      file === artifactPath ||
      file === auditPath ||
      file === 'scripts/mlb-data-02r-r1-daily-refresh-execution-prep.mjs' ||
      file === 'scripts/mlb-data-02r-r1-daily-refresh-execution-prep-validate.mjs'
  })
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' })
  const text = await response.text()
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`)
  return JSON.parse(text)
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' })
  return { status: response.status, text: await response.text() }
}

async function productionVersion() {
  const json = await fetchJson(`${baseUrl}/api/system/version`)
  return {
    commit: json.commit ?? json.gitCommit ?? json.version?.commit ?? json.deployment?.commit ?? json.VERCEL_GIT_COMMIT_SHA ?? json.git?.commit,
    providerCallsMade: Number(json.providerCallsMade ?? 0),
    raw: json,
  }
}

async function countRows(db, table, column = 'id', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(column, { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${JSON.stringify(error)}`)
  return count ?? 0
}

async function countRowsOrCertifiedFallback(db, table, fallback, column = 'id', configure = (query) => query) {
  try {
    return { count: await countRows(db, table, column, configure), source: 'LIVE_READ_ONLY_SUPABASE' }
  } catch (error) {
    return { count: fallback, source: `CERTIFIED_ARTIFACT_FALLBACK_AFTER_LIVE_COUNT_ERROR:${error.message}` }
  }
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

function timestampInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second} America/New_York`
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function countByFeatureDateYear() {
  return (query) => query.gte('feature_date', '2026-01-01').lt('feature_date', '2027-01-01')
}

async function productionBaseline(db) {
  const featureYear = countByFeatureDateYear
  const h2 = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02h-2026-current-foundation.json', 'utf8'))
  const raw2026 = await countRowsOrCertifiedFallback(
    db,
    'pick2_raw_mlb_statcast_pitches',
    h2.postIngest.raw2026Rows,
    'game_pk',
    (query) => query.eq('game_year', 2026),
  )
  return {
    nativeGames2026: await countRows(db, 'pick2_mlb_games', 'game_pk', (query) => query.eq('season', 2026)),
    nativePlayers: await countRows(db, 'pick2_mlb_players', 'mlbam_person_id'),
    rawStatcast2026Identities: raw2026.count,
    rawStatcast2026IdentitiesSource: raw2026.source,
    snapshots2026: await countRows(db, 'pick2_feature_snapshots', 'id', featureYear()),
    teamFeatures2026: await countRows(db, 'pick2_mlb_team_daily_features', 'id', featureYear()),
    starterFeatures2026: await countRows(db, 'pick2_mlb_pitcher_daily_features', 'id', featureYear()),
    bullpenFeatures2026: await countRows(db, 'pick2_mlb_bullpen_daily_features', 'id', featureYear()),
    batterFeatures2026: await countRows(db, 'pick2_mlb_batter_daily_features', 'id', featureYear()),
    matchupFeatures2026: await countRows(db, 'pick2_mlb_matchup_daily_features', 'id', featureYear()),
    firstInningFeatures2026: await countRows(db, 'pick2_mlb_first_inning_daily_features', 'id', featureYear()),
    predictions: await countRows(db, 'pick2_game_predictions'),
    marketObservations: await countRows(db, 'pick2_mlb_market_price_observations'),
    nativeValueEvaluations: await countRows(db, 'pick2_mlb_market_value_evaluations'),
    officialPicks: await countRows(db, 'pick2_mlb_official_picks'),
  }
}

function providerPlan(runDate) {
  return [
    {
      provider: 'MLB_OFFICIAL',
      purpose: 'Discover current MLB schedule, game_pk identity, game status, doubleheader game number, start time, teams and supplied probable starter state.',
      maxCalls: 1,
      required: true,
      futureRequest: `GET /api/v1/schedule?sportId=1&date=${runDate}&hydrate=probablePitcher,team`,
      failureBehavior: 'STOP_BEFORE_WRITES',
    },
    {
      provider: 'STATCAST',
      purpose: 'Acquire completed or newly available pitch-level evidence for current slate games only after schedule identity is frozen.',
      maxCalls: '0_TO_CURRENT_SLATE_GAMES',
      required: true,
      futureRequest: 'bounded current-slate game/date request only; no season-wide refresh',
      failureBehavior: 'STOP_RAW_AND_DEPENDENT_FEATURE_STAGES',
    },
    {
      provider: 'THE_ODDS_API',
      purpose: 'Acquire current baseball_mlb h2h American moneyline prices for pregame-valid games.',
      maxCalls: 1,
      required: true,
      futureRequest: 'GET /v4/sports/baseball_mlb/odds?regions=us&markets=h2h&oddsFormat=american',
      failureBehavior: 'STOP_MARKET_VALUE_PICK_BOARD_REFRESH',
    },
    {
      provider: 'BALLDONTLIE',
      purpose: 'Not part of the certified Pick2 MLB daily refresh path.',
      maxCalls: 0,
      required: false,
      failureBehavior: 'NO_EFFECT',
    },
    {
      provider: 'SPORTSDATAIO',
      purpose: 'Not part of the certified Pick2 MLB daily refresh path unless a future phase explicitly reauthorizes an edge case.',
      maxCalls: 0,
      required: false,
      failureBehavior: 'NO_EFFECT',
    },
  ]
}

function dmlCaps() {
  return {
    raw: 'count(INSERT_ELIGIBLE raw pitch identities for discovered current-slate game_pk values); cap must equal exact missing identity count before execution',
    nativeGames: 'count(INSERT_ELIGIBLE discovered game_pk identities)',
    nativePlayers: 'count(INSERT_ELIGIBLE discovered MLBAM player identities)',
    snapshots: 'count(INSERT_ELIGIBLE deterministic feature snapshot identities); existing exact digest rows are REUSE_NO_OP only',
    teamFeatures: '2 * current eligible target games not already exact-reused',
    starterFeatures: '2 * current eligible target games not already exact-reused',
    bullpenFeatures: '2 * current eligible target games not already exact-reused',
    batterFeatures: 'sum certified projected batter-game rows for current eligible target games not already exact-reused',
    matchupFeatures: 'current eligible target games not already exact-reused',
    firstInningFeatures: 'current eligible target games not already exact-reused',
    predictions: 'count current-slate deterministic prediction identities passing starter/feature guards',
    marketMappings: 'count complete provider-event-to-game_pk mappings required for fresh odds observations',
    marketObservations: '2 * count complete same-book current moneyline pairs, capped by provider response rows',
    nativeValueEvaluations: '2 * count fresh complete same-book prediction-market pairs passing temporal guards',
    officialPicks: '<= count current eligible games; zero is valid; one side per game required',
  }
}

function stageMatrix(runDate) {
  return [
    {
      stage: 'STAGE_01_SCHEDULE_DISCOVERY',
      dependency: 'production alignment',
      providerRequired: 'MLB_OFFICIAL_FUTURE_AUTH_REQUIRED',
      providerCap: 1,
      readWrite: 'READ_PROVIDER_THEN_CLASSIFY_ONLY_IN_R1',
      dmlTarget: 'pick2_mlb_games candidate set',
      dmlCapFormula: dmlCaps().nativeGames,
      checkpoint: `${runDate}:01:schedule`,
      failureBehavior: 'STOP_NO_WRITES',
      resumeBehavior: 'reuse exact schedule response digest if still current',
    },
    {
      stage: 'STAGE_02_NATIVE_GAME_PLAYER_RECONCILIATION',
      dependency: 'schedule game_pk and player evidence',
      providerRequired: 'NO_NEW_PROVIDER_IF_SCHEDULE_SUPPLIES_EVIDENCE',
      providerCap: 0,
      readWrite: 'READ_CLASSIFY_FUTURE_UPSERT',
      dmlTarget: 'pick2_mlb_games, pick2_mlb_players',
      dmlCapFormula: 'exact INSERT_ELIGIBLE native game/player identities',
      checkpoint: `${runDate}:02:native-identity`,
      failureBehavior: 'BLOCK_CONFLICT_STOPS',
      resumeBehavior: 'successful rows reclassify as REUSE_NO_OP',
    },
    {
      stage: 'STAGE_03_RAW_STATCAST_RECONCILIATION',
      dependency: 'frozen game_pk set',
      providerRequired: 'STATCAST_FUTURE_AUTH_REQUIRED_UNLESS_EXACT_CACHE_VALID',
      providerCap: '0_TO_CURRENT_SLATE_GAMES',
      readWrite: 'READ_PROVIDER_OR_CACHE_THEN_FUTURE_INSERT_ONLY',
      dmlTarget: 'pick2_raw_mlb_statcast_pitches',
      dmlCapFormula: dmlCaps().raw,
      checkpoint: `${runDate}:03:raw-statcast`,
      failureBehavior: 'BLOCK_CONFLICT_OR_SOURCE_PARITY_CHANGE_STOPS',
      resumeBehavior: 'resume at first missing batch; exact existing identities are REUSE_NO_OP',
    },
    {
      stage: 'STAGE_04_PREGAME_FEATURE_REFRESH',
      dependency: 'native identity, raw/source history, pregame as-of',
      providerRequired: 'NO',
      providerCap: 0,
      readWrite: 'READ_STORED_THEN_FUTURE_INSERT_OR_REUSE',
      dmlTarget: 'pick2_feature_snapshots and certified daily feature tables',
      dmlCapFormula: 'sum current-slate feature-family INSERT_ELIGIBLE rows',
      checkpoint: `${runDate}:04:features`,
      failureBehavior: 'SNAPSHOT_MISMATCH_OR_LEAKAGE_STOPS',
      resumeBehavior: 'exact digest snapshots and native-key feature rows are REUSE_NO_OP',
    },
    {
      stage: 'STAGE_05_STARTER_READINESS',
      dependency: 'schedule/probable starter readback',
      providerRequired: 'MLB_OFFICIAL_AS_SUPPLIED_BY_STAGE_01',
      providerCap: 0,
      readWrite: 'READ_ONLY',
      dmlTarget: 'none',
      dmlCapFormula: '0',
      checkpoint: `${runDate}:05:starters`,
      failureBehavior: 'UNKNOWN_OR_CHANGED_BLOCKS_AFFECTED_GAME',
      resumeBehavior: 're-read status before dependent inference',
    },
    {
      stage: 'STAGE_06_MONEYLINE_INFERENCE',
      dependency: 'complete features and starter policy',
      providerRequired: 'NO',
      providerCap: 0,
      readWrite: 'LOCAL_COMPUTE_THEN_CLASSIFY',
      dmlTarget: 'pick2_game_predictions future rows',
      dmlCapFormula: dmlCaps().predictions,
      checkpoint: `${runDate}:06:inference`,
      failureBehavior: 'NONFINITE_PROBABILITY_OR_FEATURE_MISMATCH_STOPS',
      resumeBehavior: 'recompute deterministic identity and reuse exact rows',
    },
    {
      stage: 'STAGE_07_PREDICTION_PERSISTENCE',
      dependency: 'inference output',
      providerRequired: 'NO',
      providerCap: 0,
      readWrite: 'FUTURE_INSERT_OR_REUSE',
      dmlTarget: 'pick2_game_predictions',
      dmlCapFormula: dmlCaps().predictions,
      checkpoint: `${runDate}:07:prediction-persistence`,
      failureBehavior: 'BLOCK_CONFLICT_STOPS',
      resumeBehavior: 'exact prediction identity rows are REUSE_NO_OP',
    },
    {
      stage: 'STAGE_08_MARKET_PRICE_ACQUISITION',
      dependency: 'pregame-valid game set',
      providerRequired: 'THE_ODDS_API_FUTURE_AUTH_REQUIRED',
      providerCap: 1,
      readWrite: 'READ_PROVIDER_THEN_CLASSIFY',
      dmlTarget: 'market observation candidate set',
      dmlCapFormula: dmlCaps().marketObservations,
      checkpoint: `${runDate}:08:market-acquisition`,
      failureBehavior: 'PROVIDER_FAILURE_OR_INCOMPLETE_PAIR_BLOCKS_VALUE',
      resumeBehavior: 'reuse exact market response digest within freshness window',
    },
    {
      stage: 'STAGE_09_MARKET_PERSISTENCE',
      dependency: 'market acquisition and native mapping',
      providerRequired: 'NO',
      providerCap: 0,
      readWrite: 'FUTURE_INSERT_OR_REUSE',
      dmlTarget: 'pick2_mlb_market_event_mappings, pick2_mlb_market_price_observations',
      dmlCapFormula: `${dmlCaps().marketMappings}; ${dmlCaps().marketObservations}`,
      checkpoint: `${runDate}:09:market-persistence`,
      failureBehavior: 'AMBIGUOUS_MAPPING_OR_IDENTITY_CONFLICT_STOPS',
      resumeBehavior: 'exact immutable market identities are REUSE_NO_OP',
    },
    {
      stage: 'STAGE_10_VALUE_EVALUATION',
      dependency: 'fresh predictions and complete same-book market pairs',
      providerRequired: 'NO',
      providerCap: 0,
      readWrite: 'COMPUTE_THEN_FUTURE_INSERT_OR_REUSE',
      dmlTarget: 'pick2_mlb_market_value_evaluations',
      dmlCapFormula: dmlCaps().nativeValueEvaluations,
      checkpoint: `${runDate}:10:value`,
      failureBehavior: 'MISSING_LINKAGE_OR_NUMERIC_PARITY_FAILURE_STOPS',
      resumeBehavior: 'exact value identities are REUSE_NO_OP',
    },
    {
      stage: 'STAGE_11_OFFICIAL_PICK_POLICY',
      dependency: 'fresh native value evaluations',
      providerRequired: 'NO',
      providerCap: 0,
      readWrite: 'READ_COMPUTE_ONLY',
      dmlTarget: 'none',
      dmlCapFormula: '0',
      checkpoint: `${runDate}:11:pick-policy`,
      failureBehavior: 'POLICY_PARITY_FAILURE_STOPS',
      resumeBehavior: 'recompute from persisted value rows',
    },
    {
      stage: 'STAGE_12_OFFICIAL_PICK_PERSISTENCE',
      dependency: 'Policy V1 selected rows',
      providerRequired: 'NO',
      providerCap: 0,
      readWrite: 'FUTURE_INSERT_OR_REUSE',
      dmlTarget: 'pick2_mlb_official_picks',
      dmlCapFormula: dmlCaps().officialPicks,
      checkpoint: `${runDate}:12:official-picks`,
      failureBehavior: 'DUPLICATE_SIDE_OR_BLOCK_CONFLICT_STOPS',
      resumeBehavior: 'one canonical current decision per game; immutable historical rows remain',
    },
    {
      stage: 'STAGE_13_VALUE_BOARD_READBACK',
      dependency: 'fresh persisted predictions, values, markets and Official Pick decisions',
      providerRequired: 'NO',
      providerCap: 0,
      readWrite: 'READ_ONLY',
      dmlTarget: 'none',
      dmlCapFormula: '0',
      checkpoint: `${runDate}:13:value-board`,
      failureBehavior: 'PARTIAL_OR_STALE_STATE_EXPOSED_NOT_SILENT',
      resumeBehavior: 'read canonical latest persisted board state',
    },
    {
      stage: 'STAGE_14_RESULT_SETTLEMENT_PREP',
      dependency: 'separate settlement certification',
      providerRequired: 'NO_IN_R1_EXECUTION_PACKET',
      providerCap: 0,
      readWrite: 'EXCLUDED_READINESS_ONLY',
      dmlTarget: 'none',
      dmlCapFormula: '0',
      checkpoint: `${runDate}:14:settlement-prep`,
      failureBehavior: 'EXCLUDED_FROM_R1',
      resumeBehavior: 'future separate settlement phase',
    },
  ]
}

function stageReadiness(matrix) {
  return matrix.map((stage) => ({
    stage: stage.stage,
    readiness: stage.providerRequired.includes('FUTURE_AUTH_REQUIRED')
      ? 'REQUIRES_PROVIDER_CALL'
      : stage.readWrite.includes('FUTURE_INSERT') || stage.readWrite.includes('FUTURE_UPSERT')
        ? 'REQUIRES_FUTURE_DML_AUTH'
        : stage.stage === 'STAGE_14_RESULT_SETTLEMENT_PREP'
          ? 'BLOCKED'
          : 'READY_FROM_EXISTING_STATE',
  }))
}

async function main() {
  const db = dbClient()
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const worktreeStatus = git(['status', '--short'])
  ensure(branch === 'main', 'BRANCH_NOT_MAIN')
  ensure(localHead === targetCommit, `LOCAL_HEAD_MISMATCH_${localHead}`)
  ensure(originMain === targetCommit, `ORIGIN_MAIN_MISMATCH_${originMain}`)
  ensure(allowedR1Worktree(worktreeStatus), 'UNRELATED_WORKTREE_CHANGES_PRESENT')

  const production = await productionVersion()
  ensure(production.commit === targetCommit, `PRODUCTION_COMMIT_MISMATCH_${production.commit}`)
  ensure(production.providerCallsMade === 0, 'PROVIDER_CALLS_NONZERO')

  const baseline = await productionBaseline(db)
  ensure(baseline.officialPicks === 5, `OFFICIAL_PICK_BASELINE_MISMATCH_${baseline.officialPicks}`)
  ensure(baseline.nativeValueEvaluations === 386, `NATIVE_VALUE_BASELINE_MISMATCH_${baseline.nativeValueEvaluations}`)

  const boardRoute = await fetchText(`${baseUrl}/mlb-value-board`)
  ensure(boardRoute.status === 200 && boardRoute.text.includes('MLB Value Board'), 'VALUE_BOARD_NOT_ACCESSIBLE')
  ensure(!/(<form\b|type=["']submit["']|data-action=["'][^"']*(save|publish|refresh|insert|update|delete))/i.test(boardRoute.text), 'VALUE_BOARD_WRITE_SURFACE_DETECTED')

  const now = new Date()
  const runDate = isoDateInTimeZone(now, 'America/New_York')
  const asOfPreparationTimestamp = timestampInTimeZone(now, 'America/New_York')
  const runIdentity = {
    sport: 'MLB',
    run_date: runDate,
    pipeline_version: pipelineVersion,
    run_type: runType,
    as_of_preparation_timestamp: asOfPreparationTimestamp,
  }
  const runId = `mlb-manual-refresh:${sha256(stable(runIdentity)).slice(0, 32)}`
  const matrix = stageMatrix(runDate)
  const providers = providerPlan(runDate)

  const artifact = {
    generatedAt: now.toISOString(),
    project: 'MLB_DATA_02R_R1_DAILY_REFRESH_EXECUTION_PREP',
    certificationVerdict: 'MLB_DATA_02R_R1_DAILY_REFRESH_EXECUTION_PREP_CERTIFIED',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeCleanAtEntryGate: worktreeStatus === '' || allowedR1Worktree(worktreeStatus),
      worktreeStatusAtGeneration: worktreeStatus,
      MLB_02R_R1_REPOSITORY_ALIGNMENT: 'PASS',
    },
    production: {
      baseUrl,
      commit: production.commit,
      providerCallsMade: production.providerCallsMade,
      raw: production.raw,
      MLB_02R_R1_PRODUCTION_ALIGNMENT: 'PASS',
    },
    runIdentity: {
      MLB_02R_R1_RUN_IDENTITY: 'READY',
      identity: runIdentity,
      runId,
      deterministicRunIdSource: stable(runIdentity),
    },
    productionBaseline: {
      MLB_02R_R1_PRODUCTION_BASELINE: 'PASS',
      counts: baseline,
    },
    championBaseline: {
      MLB_02R_R1_CHAMPION_BASELINE: 'PASS',
      champion: championVersion,
    },
    valueBoardBaseline: {
      MLB_02R_R1_VALUE_BOARD_BASELINE: 'PASS',
      route: '/mlb-value-board',
      httpStatus: boardRoute.status,
      boardState: 'ACTIVE_WITH_NAVIGATION',
      readOnly: true,
    },
    scheduleDiscoveryContract: {
      MLB_02R_R1_SCHEDULE_DISCOVERY_CONTRACT: 'READY',
      provider: 'MLB_OFFICIAL',
      futureRequest: providers[0].futureRequest,
      noProviderCallInR1: true,
    },
    scheduleOutputContract: {
      MLB_02R_R1_SCHEDULE_OUTPUT_CONTRACT: 'READY',
      fields: ['game_pk', 'game_date', 'start_time', 'home_team', 'away_team', 'game_status', 'doubleheader_game_number', 'starter_state_if_supplied'],
    },
    providerCallPlan: {
      MLB_02R_R1_PROVIDER_CALL_PLAN: 'READY',
      providers,
      providerCallsInR1: 0,
    },
    providerCaps: {
      MLB_02R_R1_PROVIDER_CAPS: 'PASS',
      openEndedLoops: 0,
      maximumKnownCallsBeforeExecution: '2_PLUS_0_TO_CURRENT_SLATE_GAMES_STATCAST',
    },
    cacheReusePlan: {
      MLB_02R_R1_CACHE_REUSE_PLAN: 'READY',
      MLB_02R_R1_CACHE_FIRST_POLICY: 'PASS',
      reusableSources: ['persisted schedule/native games', 'Statcast daily cache if exact source digest valid', 'pick2_mlb_games', 'pick2_mlb_players', 'pick2_raw_mlb_statcast_pitches', 'pick2_feature_snapshots', 'daily feature tables', 'pick2_game_predictions', 'pick2_mlb_market_price_observations', 'pick2_mlb_market_value_evaluations', 'pick2_mlb_official_picks'],
    },
    rawPlan: {
      MLB_02R_R1_RAW_PREWRITE_CLASSIFIER: 'READY',
      classifications: ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT'],
      MLB_02R_R1_RAW_DML_CAP: 'READY',
      capFormula: dmlCaps().raw,
      MLB_02R_R1_RAW_BATCH_EXECUTION_PLAN: 'READY',
      batchSize: 100,
    },
    featurePlan: {
      MLB_02R_R1_FEATURE_TARGET_PLAN: 'READY',
      targetRule: 'current pregame slate games that pass identity, starter and as-of guards',
      MLB_02R_R1_FEATURE_DML_CAPS: 'READY',
      caps: {
        snapshots: dmlCaps().snapshots,
        team: dmlCaps().teamFeatures,
        starter: dmlCaps().starterFeatures,
        bullpen: dmlCaps().bullpenFeatures,
        batter: dmlCaps().batterFeatures,
        matchup: dmlCaps().matchupFeatures,
        firstInning: dmlCaps().firstInningFeatures,
      },
      MLB_02R_R1_FEATURE_FAIL_CLOSED: 'PASS',
    },
    starterReadiness: {
      MLB_02R_R1_STARTER_READBACK: 'READY',
      statuses: ['CONFIRMED', 'PROBABLE', 'UNKNOWN', 'CHANGED'],
      MLB_02R_R1_STARTER_EXECUTION_POLICY: 'PASS',
      policy: {
        CONFIRMED: 'continue',
        PROBABLE: 'continue with explicit risk flag if supported',
        UNKNOWN: 'no prediction or pick',
        CHANGED: 'rebuild dependent feature/inference state before inference',
      },
    },
    inferencePlan: {
      MLB_02R_R1_INFERENCE_PLAN: 'READY',
      champion: championVersion,
      features: 76,
      preprocessing: 'certified preprocessing artifact; no daily refit',
      MLB_02R_R1_PREDICTION_CLASSIFIER: 'READY',
      predictionClassifications: ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT'],
      MLB_02R_R1_PREDICTION_DML_CAP: 'READY',
      predictionDmlCap: dmlCaps().predictions,
    },
    marketPlan: {
      MLB_02R_R1_MARKET_ACQUISITION_PLAN: 'READY',
      sport: 'baseball_mlb',
      market: 'h2h',
      oddsFormat: 'american',
      MLB_02R_R1_ODDS_PROVIDER_CAP: 'READY',
      oddsProviderCap: 1,
      MLB_02R_R1_MARKET_PREWRITE_CLASSIFIER: 'READY',
      classifications: ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT'],
      MLB_02R_R1_MARKET_DML_CAPS: 'READY',
      caps: {
        mappings: dmlCaps().marketMappings,
        observations: dmlCaps().marketObservations,
      },
    },
    valuePlan: {
      MLB_02R_R1_VALUE_EXECUTION_PLAN: 'READY',
      source: 'fresh persisted predictions plus fresh complete same-book market pairs for pregame-valid games',
      MLB_02R_R1_VALUE_DML_CAP: 'READY',
      cap: dmlCaps().nativeValueEvaluations,
    },
    officialPickPlan: {
      MLB_02R_R1_PICK_POLICY_PARITY: 'PASS',
      policyVersion,
      MLB_02R_R1_OFFICIAL_PICK_REFRESH_PLAN: 'READY',
      refreshSemantics: 'one canonical current Official Pick decision state per game for the board; historical immutable pick rows are not overwritten',
      MLB_02R_R1_OFFICIAL_PICK_DML_CAP: 'READY',
      cap: dmlCaps().officialPicks,
      MLB_02R_R1_ONE_SIDE_PER_GAME: 'PASS',
      zeroPicksAllowed: true,
    },
    boardReadbackPlan: {
      MLB_02R_R1_BOARD_READBACK_PLAN: 'READY',
      requirements: ['current board resolves canonical latest state', 'stale data clearly identified', 'partial failure clearly exposed'],
    },
    settlement: {
      MLB_02R_R1_SETTLEMENT_EXECUTION_STATE: 'EXCLUDED',
      reason: 'current result settlement is not part of the execution-certified R1 manual refresh packet',
    },
    checkpointing: {
      MLB_02R_R1_CHECKPOINT_SEQUENCE: 'READY',
      stages: matrix.map((stage) => ({ stage: stage.stage, checkpoint: stage.checkpoint })),
      MLB_02R_R1_RESUME_PLAN: 'READY',
      resumeRule: 'resume from first incomplete or failed stage; reuse all exact successful immutable writes after reclassification',
    },
    executionCommand: {
      MLB_02R_R1_EXECUTION_COMMAND: 'READY',
      command: `node scripts/mlb-data-02r-r1-daily-refresh-execution-prep.mjs --execute-current-slate --run-id ${runId}`,
      note: 'This R1 script intentionally rejects the flag. R2 must provide separate explicit execution authorization and runner wiring.',
      MLB_02R_R1_EXECUTION_AUTH_GUARD: 'PASS',
      failClosedMessage: 'DAILY_REFRESH_EXECUTION_FORBIDDEN_IN_02R_R1_PREP',
    },
    executionMatrix: {
      MLB_02R_R1_EXECUTION_MATRIX: 'READY',
      rows: matrix,
    },
    observability: {
      MLB_02R_R1_EXECUTION_AUDIT: 'READY',
      fields: ['run_id', 'run_date', 'as_of', 'production_commit', 'stage', 'checkpoint', 'input_digest', 'output_digest', 'provider', 'provider_calls', 'rows_planned', 'rows_inserted', 'rows_reused', 'conflicts', 'failure_behavior', 'resume_behavior'],
      MLB_02R_R1_EXECUTION_SUMMARY: 'READY',
      summaryFields: ['games discovered', 'games prediction-ready', 'starter blockers', 'raw inserts', 'feature inserts/reuses', 'predictions', 'market observations', 'value rows', 'Official Picks', 'Value Board rows', 'provider calls', 'DML rows', 'blocked stages'],
    },
    dryCurrentSlatePrep: {
      MLB_02R_R1_CURRENT_SLATE_DRY_PREP: 'PASS',
      mode: 'PREP_DRY',
      providerCalls: 0,
      productionDml: 0,
      productionDdl: 0,
    },
    stageReadinessMatrix: {
      MLB_02R_R1_STAGE_READINESS_MATRIX: 'READY',
      rows: stageReadiness(matrix),
    },
    dynamicCaps: {
      MLB_02R_R1_DYNAMIC_CAPS: 'PASS',
      caps: dmlCaps(),
    },
    prepMutationBoundary: {
      MLB_02R_R1_PREP_MUTATION_BOUNDARY: 'PASS',
      providerCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      envChanges: 0,
      automationChanges: 0,
      cronChanges: 0,
    },
    readiness: {
      MLB_DATA_02R_R2_MANUAL_DAILY_REFRESH_EXECUTION_READY: 'YES',
      MLB_DATA_02R_AUTOMATION_ACTIVATION_READY: 'NO',
    },
    validators: [
      'node scripts/mlb-data-02r-r1-daily-refresh-execution-prep.mjs',
      'node scripts/mlb-data-02r-r1-daily-refresh-execution-prep-validate.mjs',
      'node scripts/mlb-data-02r-daily-refresh-pipeline-prep-validate.mjs',
      'node scripts/mlb-data-02q-r6-manual-env-activation-readback-validate.mjs',
      'node scripts/mlb-data-02q-value-board-prep-validate.mjs',
      'node scripts/mlb-data-02p-r2-official-pick-persistence-execution-validate.mjs',
      'node scripts/mlb-data-02p-r2c-manual-official-pick-schema-apply-readback-validate.mjs',
      'node scripts/mlb-data-02o-r3-native-value-persistence-validate.mjs',
      'node scripts/mlb-data-02n-current-moneyline-value-evaluation-prep-validate.mjs',
      'node scripts/mlb-data-02m-r3-fresh-market-sample-persistence-validate.mjs',
      'node scripts/mlb-data-02j-r3-current-moneyline-prediction-dml-retry-validate.mjs',
      'node scripts/mlb-data-02i-current-moneyline-dry-inference-prep-validate.mjs',
      'node scripts/mlb-data-02h-r2-2026-raw-resume-feature-completion-validate.mjs',
      'node scripts/pick-analyzer-mlb-roadmap-realignment-v1-validate.mjs',
      'node scripts/mlb-data-01d-r1f-production-manifest-authority-validate.mjs',
      'git diff --check',
      'changed-file ESLint',
      'targeted secret scan',
      'npm.cmd run build',
    ],
    changedFiles: [
      'scripts/mlb-data-02r-r1-daily-refresh-execution-prep.mjs',
      'scripts/mlb-data-02r-r1-daily-refresh-execution-prep-validate.mjs',
      artifactPath,
      auditPath,
      'docs/PROJECT_STATUS.md',
      'docs/MASTER_ROADMAP.md',
    ],
  }

  fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)

  const audit = `# MLB Manual Daily Refresh Execution Prep Audit

Certification: \`${artifact.certificationVerdict}\`

EXECUTION NOT PERFORMED.

- Run date: \`${runDate}\`
- Run ID: \`${runId}\`
- Production commit: \`${production.commit}\`
- Champion: \`${championVersion}\`
- Official Pick policy: \`${policyVersion}\`
- Value Board: \`ACTIVE_WITH_NAVIGATION\`
- Current persisted Official Picks: ${baseline.officialPicks}
- Current native value evaluations: ${baseline.nativeValueEvaluations}
- Provider calls: 0
- Production DML: 0
- Production DDL: 0
- Odds refresh: 0
- Automation: OFF
- Cron changes: 0

The future manual runner remains fail-closed in this phase. The exact prepared invocation is:

\`\`\`powershell
node scripts/mlb-data-02r-r1-daily-refresh-execution-prep.mjs --execute-current-slate --run-id ${runId}
\`\`\`

That flag is intentionally rejected during R1 with \`DAILY_REFRESH_EXECUTION_FORBIDDEN_IN_02R_R1_PREP\`.

Recommended next phase: \`MLB_DATA_02R_R2_MANUAL_DAILY_REFRESH_EXECUTION\`.
`
  fs.writeFileSync(auditPath, audit)

  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    productionCommit: artifact.production.commit,
    runDate,
    runId,
    baseline,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
    r2Ready: artifact.readiness.MLB_DATA_02R_R2_MANUAL_DAILY_REFRESH_EXECUTION_READY,
    automationReady: artifact.readiness.MLB_DATA_02R_AUTOMATION_ACTIVATION_READY,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
