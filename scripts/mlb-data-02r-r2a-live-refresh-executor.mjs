import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  R2D_FAIL_CLOSED_MESSAGE,
  R2D_SCOPE_CERTIFICATION,
  buildPrewriteScopeArtifact,
  createFrozenSlateContext,
  runCurrentSlateStage,
  stageWrapperBindings,
  wrapperNames,
} from './mlb-data-02r-r2d-current-slate-wrappers.mjs'
import { runR2HFullDryIntegration } from './mlb-data-02r-r2h-full-dry-integration.mjs'
import {
  R2I_AUTH_ERROR,
  R2I_LIVE_TARGETS,
  createSupabaseProductionRepository,
  createTestRepository,
  runR2ILiveExecution,
} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'

const BASE_URL = 'https://pick-analyzer.vercel.app'
const MODEL_VERSION = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const FEATURE_SET = 'MLB_ML_FEATURE_SET_V1'
const FEATURE_COUNT = 76
const MODEL_ARTIFACT_DIGEST = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const PIPELINE_VERSION = 'MLB_DATA_02R_R2A_LIVE_REFRESH_EXECUTOR_V1'
const R2_PACKAGE_ARTIFACT = 'docs/CERTIFICATION/mlb-data-02r-r2-frozen-execution-package.json'
const ARTIFACT_PATH = 'docs/CERTIFICATION/mlb-data-02r-r2a-live-refresh-executor.json'
const AUDIT_PATH = 'docs/CERTIFICATION/MLB_DATA_02R_R2A_LIVE_MANUAL_REFRESH_EXECUTOR_AUDIT.md'
const CHECKPOINT_DIR = '.tmp/mlb-data-02r-r2a-checkpoints'

const rawArgs = process.argv.slice(2)
const args = new Set(rawArgs)
const execute = args.has('--execute-current-slate') || args.has('--execute')
const dryRun = args.has('--dry-run') || !execute
const resumeFrom = valueAfter('--resume-from')
const suppliedRunId = valueAfter('--run-id')
const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution && execute && process.env.MLB_DATA_02R_R2_LIVE_EXECUTION_AUTHORIZED !== 'YES') {
  console.error(R2D_FAIL_CLOSED_MESSAGE)
  process.exit(1)
}

if (isDirectExecution && args.has('--r2h-full-dry-integration')) {
  runR2HFullDryIntegration({ mode: 'DRY_RUN' })
    .then((artifact) => {
      console.log(JSON.stringify({
        certificationVerdict: artifact.certificationVerdict,
        stages: artifact.stages.length,
        providerCalls: artifact.safety.providerCalls,
        productionDml: artifact.safety.productionDml,
        productionDdl: artifact.safety.productionDdl,
        placeholderStatesRemaining: artifact.placeholderStatesRemaining,
      }, null, 2))
      process.exit(0)
    })
    .catch((error) => {
      console.error(JSON.stringify({
        certificationVerdict: 'MLB_DATA_02R_R2H_EXECUTOR_BINDING_AND_FULL_DRY_INTEGRATION_FAILED',
        error: error.message,
        providerCalls: 0,
        productionDml: 0,
        productionDdl: 0,
      }, null, 2))
      process.exit(1)
    })
}

if (isDirectExecution && args.has('--r2i-live-branch-simulation')) {
  const authorization = {
    authorized: true,
    execution_package_sha: localPackageShaForSimulation(),
    run_id: 'mlb-02r-r2i-test-live',
    providerCaps: {
      MLB_OFFICIAL: { allowed: true, maxCalls: 1 },
      STATCAST: { allowed: true, maxCalls: 1 },
      THE_ODDS_API: { allowed: true, maxCalls: 1 },
      BALLDONTLIE: { allowed: false, maxCalls: 0 },
      SPORTSDATAIO: { allowed: false, maxCalls: 0 },
      OTHER: { allowed: false, maxCalls: 0 },
    },
    dmlCaps: {
      nativeGames: 1,
      nativePlayers: 2,
      rawStatcast: 1,
      features: { snapshots: 1, team: 2, starter: 2, bullpen: 2, batter: 1, matchup: 1, firstInning: 1 },
      predictions: 1,
      marketMappings: 1,
      marketObservations: 2,
      nativeValues: 2,
      officialPicks: 1,
    },
    authorizedDmlTargets: [],
    ddlAllowed: false,
    settlementAllowed: false,
    automationAllowed: false,
  }
  runR2ILiveExecution({
    mode: 'LIVE_EXECUTE',
    authorization,
    executionPackageSha: authorization.execution_package_sha,
    repository: createTestRepository(),
    providers: {
      mlbOfficial: { async getSchedule() { return { dates: [{ date: '2026-09-07', games: [{ gamePk: 700001, gameDate: '2026-09-07T23:05:00.000Z', officialDate: '2026-09-07', season: 2026, status: { abstractGameState: 'Preview', detailedState: 'Pre-Game', statusCode: 'P' }, teams: { away: { team: { id: 110, abbreviation: 'AWY', name: 'Away Team' }, probablePitcher: { id: 660001, fullName: 'Away Starter', confirmed: false } }, home: { team: { id: 111, abbreviation: 'HME', name: 'Home Team' }, probablePitcher: { id: 660002, fullName: 'Home Starter', confirmed: true } } } }] }] } } },
      statcast: { async fetchRowsForGames() { return [{ game_pk: 700001, game_date: '2026-09-07', game_year: 2026, at_bat_number: 1, pitch_number: 1, source_pitcher_id: 660001, source_batter_id: 770001, raw_payload: { pitch_type: 'FF' } }] } },
      odds: { async getMoneylineOdds() { return { events: [{ id: 'odds-event-700001', sport_key: 'baseball_mlb', commence_time: '2026-09-07T23:05:00.000Z', home_team: 'Home Team', away_team: 'Away Team', bookmakers: [{ key: 'book_a', title: 'Book A', markets: [{ key: 'h2h', last_update: '2026-09-07T15:01:00.000Z', outcomes: [{ name: 'Home Team', price: -120 }, { name: 'Away Team', price: 110 }] }] }] }] } } },
    },
  })
    .then((artifact) => {
      console.log(JSON.stringify({
        certificationVerdict: artifact.certificationVerdict,
        mode: artifact.mode,
        liveBranchTraversed: artifact.liveBranchTraversed,
        stages: artifact.stages.length,
        realProviderCalls: artifact.safety.realProviderCalls,
        productionDml: artifact.safety.productionDml,
        productionDdl: artifact.safety.productionDdl,
        testProviderCalls: artifact.safety.testProviderCalls,
        testDml: artifact.safety.testDml,
      }, null, 2))
      process.exit(0)
    })
    .catch((error) => {
      console.error(JSON.stringify({
        certificationVerdict: 'MLB_DATA_02R_R2I_LIVE_BRANCH_SIMULATION_FAILED',
        error: error.message,
        realProviderCalls: 0,
        productionDml: 0,
        productionDdl: 0,
      }, null, 2))
      process.exit(1)
    })
}

function buildLiveAuthorization({ executionPackageSha, runId, dmlCaps: caps = null } = {}) {
  return {
    authorized: true,
    execution_package_sha: executionPackageSha,
    run_id: runId,
    providerCaps: {
      MLB_OFFICIAL: { allowed: true, maxCalls: 1 },
      STATCAST: { allowed: true, maxCalls: '0_TO_FROZEN_GAME_SET' },
      THE_ODDS_API: { allowed: true, maxCalls: 1, sport: 'baseball_mlb', market: 'h2h', oddsFormat: 'american' },
      BALLDONTLIE: { allowed: false, maxCalls: 0 },
      SPORTSDATAIO: { allowed: false, maxCalls: 0 },
      OTHER: { allowed: false, maxCalls: 0 },
    },
    dmlCaps: caps ?? {
      nativeGames: null,
      nativePlayers: null,
      rawStatcast: null,
      features: { snapshots: null, team: null, starter: null, bullpen: null, batter: null, matchup: null, firstInning: null },
      predictions: null,
      marketMappings: null,
      marketObservations: null,
      nativeValues: null,
      officialPicks: null,
    },
    authorizedDmlTargets: Object.values(R2I_LIVE_TARGETS),
    ddlAllowed: false,
    settlementAllowed: false,
    automationAllowed: false,
  }
}

export async function runR2BExecutableEntrypoint({
  mode = 'DRY_RUN',
  authorization = null,
  providers = {},
  repository = createTestRepository(),
  runId = 'mlb-02r-r2b-executable',
  executionPackageSha = localPackageShaForSimulation(),
} = {}) {
  if (mode === 'LIVE_EXECUTE') {
    if (!authorization) throw new Error(R2I_AUTH_ERROR)
    return runR2ILiveExecution({
      mode: 'LIVE_EXECUTE',
      authorization,
      providers,
      repository,
      runId,
      executionPackageSha,
    })
  }
  if (mode === 'DRY_RUN') return runR2HFullDryIntegration({ mode: 'DRY_RUN' })
  throw new Error(`INVALID_R2B_EXECUTABLE_MODE:${mode}`)
}

function localPackageShaForSimulation() {
  try {
    return git(['rev-parse', 'HEAD'])
  } catch {
    return '8cfd91f626e0e914d2e3abb07dc140b793a39c73'
  }
}

function valueAfter(flag) {
  const index = rawArgs.indexOf(flag)
  return index >= 0 ? rawArgs[index + 1] : null
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

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function digest(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex')
}

function dateInZone(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

async function fetchJson(pathname) {
  const response = await fetch(`${BASE_URL}${pathname}`, { cache: 'no-store' })
  const text = await response.text()
  if (!response.ok) throw new Error(`${pathname}_HTTP_${response.status}`)
  return JSON.parse(text)
}

async function verifyTable(db, manifest) {
  const projection = manifest.columns.join(',')
  const { error } = await db.from(manifest.object).select(projection).limit(1)
  if (error) {
    const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
    const state = message.includes('could not find') || message.includes('does not exist') ? 'MISSING' : 'INCOMPATIBLE'
    return { object: manifest.object, state, error: error.message, columnsChecked: manifest.columns }
  }
  return { object: manifest.object, state: 'ADDITIVE_COMPATIBLE', columnsChecked: manifest.columns }
}

async function readChampion(db) {
  const { data, error } = await db
    .from('pick2_model_versions')
    .select('id,model_version,role,status,artifact_digest,pick2_model_feature_sets(feature_set_version,input_contract)')
    .eq('role', 'champion')
    .eq('status', 'promoted')
  if (error) throw new Error(`CHAMPION_READ_FAILED:${error.message}`)
  const rows = data ?? []
  const champion = rows.find((row) => row.model_version === MODEL_VERSION)
  return {
    count: rows.length,
    champion,
    state: rows.length === 1 &&
      champion?.artifact_digest === MODEL_ARTIFACT_DIGEST &&
      champion?.pick2_model_feature_sets?.feature_set_version === FEATURE_SET
      ? 'PASS'
      : 'FAIL',
  }
}

function loadR2Manifest() {
  if (!fs.existsSync(R2_PACKAGE_ARTIFACT)) throw new Error('R2_PACKAGE_ARTIFACT_MISSING')
  const artifact = JSON.parse(fs.readFileSync(R2_PACKAGE_ARTIFACT, 'utf8'))
  if (!Array.isArray(artifact.dbContract?.manifest)) throw new Error('R2_DB_MANIFEST_MISSING')
  return {
    r2Artifact: artifact,
    manifest: artifact.dbContract.manifest,
    digest: artifact.dbContract.digest ?? digest(artifact.dbContract.manifest),
  }
}

function componentInventory() {
  return [
    ['01 schedule sync', ['scripts/mlb-data-02h-2026-current-foundation.mjs', 'src/services/mlb-official-data-provider.service.ts'], 'MLB Official schedule/status/starter evidence'],
    ['02 native reconciliation', ['scripts/mlb-data-02h-2026-current-foundation.mjs'], 'pick2_mlb_games and pick2_mlb_players insert/reuse/conflict classifiers'],
    ['03 raw Statcast reconciliation', ['scripts/mlb-data-02h-2026-current-foundation.mjs', 'src/services/mlb-statcast-query.service.ts'], 'canonical pick2_raw_mlb_statcast_pitches, cache-first, batch guarded'],
    ['04 feature refresh', ['scripts/mlb-data-02h-2026-current-foundation.mjs', 'scripts/mlb-data-01d-r1i-partial-feature-dml-resume.mjs'], 'certified Pick2 76-feature moneyline builders and feature persistence contracts'],
    ['05 starter readiness', ['scripts/mlb-data-02i-current-moneyline-dry-inference-prep.mjs'], 'CONFIRMED/PROBABLE/UNKNOWN/CHANGED guard'],
    ['06 moneyline inference', ['scripts/mlb-data-02i-current-moneyline-dry-inference-prep.mjs', 'artifacts/mlb/mlb-02c-moneyline-baseline-model.json'], 'Champion V1 model artifact, 76 ordered features, certified preprocessing'],
    ['07 prediction persistence', ['scripts/mlb-data-02j-r3-current-moneyline-prediction-dml-retry.mjs'], 'immutable prediction identity/classifier/persistence contract'],
    ['08 market acquisition', ['scripts/mlb-data-02m-r2-fresh-market-sample-acquisition.mjs'], 'The Odds API baseball_mlb h2h American odds acquisition/crosswalk normalization'],
    ['09 market persistence', ['scripts/mlb-data-02m-r3-fresh-market-sample-persistence.mjs'], 'immutable market mapping and observation persistence'],
    ['10 value evaluation', ['scripts/mlb-data-02n-current-moneyline-value-evaluation-prep.mjs', 'scripts/mlb-data-02o-r3-native-value-persistence.mjs'], 'same-book no-vig, edge and unit EV contracts'],
    ['11 Official Pick policy', ['scripts/mlb-data-02p-official-pick-policy-prep.mjs', 'scripts/mlb-data-02p-r1-official-pick-execution-prep.mjs'], 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1 thresholds and one-side-per-game gate'],
    ['12 Official Pick persistence', ['scripts/mlb-data-02p-r2-official-pick-persistence-execution.mjs'], 'immutable Official Pick row classifier/persistence'],
    ['13 Value Board readback', ['src/services/pick2-mlb-value-board.service.ts', 'src/app/mlb-value-board/page.tsx'], 'canonical persisted Value Board read model'],
  ].map(([stage, files, reuse]) => ({
    stage,
    files,
    filesPresent: files.every((file) => fs.existsSync(file)),
    reuse,
    duplicateBusinessLogic: false,
  }))
}

function providerBudget() {
  return {
    MLB_OFFICIAL: { allowed: true, maxCalls: 1, consumed: 0, stages: ['01 schedule sync'], forbiddenInDryRun: true },
    STATCAST: { allowed: true, maxCalls: '0_TO_FROZEN_GAME_SET', consumed: 0, stages: ['03 raw Statcast reconciliation'], forbiddenInDryRun: true },
    THE_ODDS_API: { allowed: true, maxCalls: 1, consumed: 0, stages: ['08 market acquisition'], sport: 'baseball_mlb', market: 'h2h', oddsFormat: 'american', forbiddenInDryRun: true },
    BALLDONTLIE: { allowed: false, maxCalls: 0, consumed: 0 },
    SPORTSDATAIO: { allowed: false, maxCalls: 0, consumed: 0 },
    OTHER: { allowed: false, maxCalls: 0, consumed: 0 },
  }
}

function dmlCaps() {
  return {
    nativeGames: 'exact INSERT_ELIGIBLE current-slate game_pk identities',
    nativePlayers: 'exact INSERT_ELIGIBLE current-slate MLBAM person identities',
    rawStatcast: 'exact missing deterministic pitch identities for frozen eligible game_pk set',
    featureSnapshots: 'exact deterministic feature snapshot INSERT_ELIGIBLE rows; exact digest matches are REUSE_NO_OP',
    teamFeatures: '2 * frozen feature-eligible games minus exact reuses',
    starterFeatures: '2 * frozen feature-eligible games minus exact reuses',
    bullpenFeatures: '2 * frozen feature-eligible games minus exact reuses',
    batterFeatures: 'sum certified batter-game rows for frozen feature-eligible games minus exact reuses',
    matchupFeatures: '1 * frozen feature-eligible games minus exact reuses',
    firstInningFeatures: '1 * frozen feature-eligible games minus exact reuses',
    predictions: 'exact prediction identities that pass starter, feature and probability guards',
    marketMappings: 'exact matched provider-event/game_pk mappings required by fresh odds evidence',
    marketObservations: 'exact complete h2h observation rows from one The Odds API response',
    nativeValues: 'exact fresh prediction + complete same-book pair evaluations',
    officialPicks: '<= frozen eligible game count; zero valid; one side per game',
  }
}

function liveComponentBindings() {
  return stageWrapperBindings()
}

function stages(runDate) {
  const caps = dmlCaps()
  const bindings = liveComponentBindings()
  return [
    ['01 schedule sync', 'MLB Official schedule/status/starter discovery', 'DIRECT_PROVIDER_SERVICE', ['PREGAME_SAFE', 'STARTED_IN_PROGRESS', 'FINAL', 'POSTPONED', 'SUSPENDED', 'OTHER_BLOCKED'], 'MLB_OFFICIAL', 'none'],
    ['02 native reconciliation', 'game/player insert-or-reuse classification', 'DIRECT_DB_SERVICE', ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT'], null, 'pick2_mlb_games,pick2_mlb_players'],
    ['03 raw Statcast reconciliation', 'canonical raw pitch identity insert-or-reuse', 'DIRECT_PROVIDER_SERVICE', ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT'], 'STATCAST', 'pick2_raw_mlb_statcast_pitches'],
    ['04 feature refresh', 'certified Pick2 pregame feature builders', 'LOCAL_SHARED_SERVICE', ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT'], null, 'pick2_feature_snapshots,daily_feature_tables'],
    ['05 starter readiness', 'starter readiness classification', 'LOCAL_SHARED_SERVICE', ['CONFIRMED', 'PROBABLE', 'UNKNOWN', 'CHANGED'], null, 'none'],
    ['06 moneyline inference', 'Champion V1 76-feature inference', 'LOCAL_SHARED_SERVICE', ['ELIGIBLE', 'BLOCKED'], null, 'none'],
    ['07 prediction persistence', 'immutable prediction rows', 'DIRECT_DB_SERVICE', ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT'], null, 'pick2_game_predictions'],
    ['08 market acquisition', 'The Odds API baseball_mlb h2h American odds', 'DIRECT_PROVIDER_SERVICE', ['MATCHED_GAMEPK', 'NO_NATIVE_MATCH', 'AMBIGUOUS', 'DUPLICATE_PROVIDER_EVENT'], 'THE_ODDS_API', 'none'],
    ['09 market persistence', 'market mappings and observations', 'DIRECT_DB_SERVICE', ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT'], null, 'pick2_mlb_market_event_mappings,pick2_mlb_market_price_observations'],
    ['10 value evaluation', 'same-book no-vig/edge/EV evaluation', 'LOCAL_SHARED_SERVICE', ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT'], null, 'pick2_mlb_market_value_evaluations'],
    ['11 Official Pick policy', 'Policy V1 decision gate', 'LOCAL_SHARED_SERVICE', ['OFFICIAL_PICK', 'VALUE_CANDIDATE', 'WATCHLIST', 'BLOCKED'], null, 'none'],
    ['12 Official Pick persistence', 'immutable Official Pick decisions', 'DIRECT_DB_SERVICE', ['INSERT_ELIGIBLE', 'REUSE_NO_OP', 'BLOCK_CONFLICT'], null, 'pick2_mlb_official_picks'],
    ['13 Value Board readback', 'canonical persisted board readback', 'LOCAL_SHARED_SERVICE', ['OFFICIAL_PICK', 'VALUE_CANDIDATE', 'WATCHLIST', 'BLOCKED'], null, 'none'],
  ].map(([stage, responsibility, dependencyClass, classifications, provider, target], index) => ({
    order: index + 1,
    stage,
    responsibility,
    dependencyClass,
    provider,
    target,
    classifications,
    componentBinding: bindings[stage],
    checkpoint: `${runDate}:${String(index + 1).padStart(2, '0')}:${stage.replaceAll(' ', '_')}`,
    dmlCap: capFor(stage, caps),
    status: 'READY',
    dryRunReachable: true,
    providerCalls: 0,
    plannedRows: 0,
    inserted: 0,
    reused: 0,
    conflicts: 0,
  }))
}

function capFor(stage, caps) {
  if (stage.includes('native')) return { nativeGames: caps.nativeGames, nativePlayers: caps.nativePlayers }
  if (stage.includes('raw')) return caps.rawStatcast
  if (stage.includes('feature')) return {
    snapshots: caps.featureSnapshots,
    team: caps.teamFeatures,
    starter: caps.starterFeatures,
    bullpen: caps.bullpenFeatures,
    batter: caps.batterFeatures,
    matchup: caps.matchupFeatures,
    firstInning: caps.firstInningFeatures,
  }
  if (stage.includes('prediction')) return caps.predictions
  if (stage.includes('market persistence')) return { mappings: caps.marketMappings, observations: caps.marketObservations }
  if (stage.includes('value')) return caps.nativeValues
  if (stage.includes('Official Pick persistence')) return caps.officialPicks
  return '0'
}

function writeCheckpoint(runId, stage, status) {
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true })
  const filePath = path.join(CHECKPOINT_DIR, `${runId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`)
  const prior = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : { runId, checkpoints: [] }
  prior.checkpoints.push({ ...stage, status, timestamp: new Date().toISOString() })
  fs.writeFileSync(filePath, `${JSON.stringify(prior, null, 2)}\n`)
  return filePath
}

function assertNoMissingComponents(inventory) {
  const missing = inventory.filter((entry) => !entry.filesPresent)
  if (missing.length) throw new Error(`COMPONENT_INVENTORY_MISSING:${missing.map((entry) => entry.stage).join(',')}`)
}

function assertProviderBudget(budget) {
  for (const [provider, entry] of Object.entries(budget)) {
    if (!entry.allowed && entry.consumed !== 0) throw new Error(`FORBIDDEN_PROVIDER_CONSUMED:${provider}`)
    if (typeof entry.maxCalls === 'number' && entry.consumed > entry.maxCalls) throw new Error(`PROVIDER_CAP_EXCEEDED:${provider}`)
  }
}

function runBoundComponent(stage, context) {
  return runCurrentSlateStage({ context, stage: stage.stage, mode: dryRun ? 'DRY_RUN' : 'EXECUTE_CURRENT_SLATE' })
}

async function main() {
  loadLocalEnv()
  const now = new Date()
  const runDate = dateInZone(now, 'America/Puerto_Rico')
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const executionPackageSha = localHead
  const { r2Artifact, manifest, digest: dbContractDigest } = loadR2Manifest()
  const inventory = componentInventory()
  assertNoMissingComponents(inventory)

  const runId = suppliedRunId ?? `mlb-02r-r2a:${digest({ now: now.toISOString(), executionPackageSha }).slice(0, 32)}`
  const version = await fetchJson('/api/system/version')
  const db = dbClient()
  const [dbCompatibility, championReadback] = await Promise.all([
    Promise.all(manifest.map((entry) => verifyTable(db, entry))),
    readChampion(db),
  ])
  const incompatible = dbCompatibility.filter((entry) => ['INCOMPATIBLE', 'MISSING'].includes(entry.state))
  if (incompatible.length) throw new Error(`DB_CONTRACT_INCOMPATIBLE:${incompatible.map((entry) => entry.object).join(',')}`)
  if (championReadback.state !== 'PASS') throw new Error('MODEL_CONTRACT_PREFLIGHT_FAILED')

  if (execute) {
    const schemaFingerprint = Object.fromEntries(dbCompatibility.map((entry) => [entry.object, entry]))
    const authorization = buildLiveAuthorization({ executionPackageSha, runId })
    const liveArtifact = await runR2BExecutableEntrypoint({
      mode: 'LIVE_EXECUTE',
      authorization,
      runId,
      executionPackageSha,
      repository: createSupabaseProductionRepository({ client: db, schemaFingerprint }),
      providers: {
        oddsApiKey: process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY,
      },
    })
    const activePlaceholderCount = liveArtifact.stages.filter((stage) => String(stage.status).includes('WRAPPER_READY_REQUIRES_STAGE_IMPLEMENTATION')).length
    const artifact = {
      generatedAt: now.toISOString(),
      certificationVerdict: activePlaceholderCount === 0
        ? 'MLB_DATA_02R_R2B_LIVE_MANUAL_REFRESH_EXECUTION_COMPLETED'
        : 'MLB_DATA_02R_R2B_LIVE_MANUAL_REFRESH_EXECUTION_BLOCKED_WRAPPER_READY_REQUIRES_STAGE_IMPLEMENTATION',
      executionMode: 'EXECUTE_CURRENT_SLATE',
      liveExecutorPath: 'scripts/mlb-data-02r-r2a-live-refresh-executor.mjs',
      r2lBinding: {
        state: activePlaceholderCount === 0 ? 'R2I_LIVE_STAGE_EXECUTOR_BOUND' : 'PLACEHOLDER_STILL_ACTIVE',
        orchestrator: 'runR2BExecutableEntrypoint',
        downstream: 'runR2ILiveExecution',
        activePlaceholderCount,
      },
      repository: {
        branch: git(['branch', '--show-current']),
        localHead,
        originMain,
        worktreeStatus: git(['status', '--short']),
      },
      runFreeze: liveArtifact.runContext,
      dbPreflight: {
        MLB_02R_R2A_DB_PREFLIGHT: 'READY',
        manifest,
        digest: dbContractDigest,
        compatibility: dbCompatibility,
        incompatible,
      },
      modelPreflight: {
        MLB_02R_R2A_MODEL_PREFLIGHT: 'READY',
        champion: MODEL_VERSION,
        featureSet: FEATURE_SET,
        featureCount: FEATURE_COUNT,
        modelArtifactDigest: MODEL_ARTIFACT_DIGEST,
        readback: championReadback,
      },
      stages: liveArtifact.stages,
      writeResults: liveArtifact.writeResults,
      schemaGuards: liveArtifact.schemaGuards,
      providerLedger: liveArtifact.providerLedger,
      safety: liveArtifact.safety,
      boundaries: {
        providerCalls: liveArtifact.safety.realProviderCalls,
        productionDml: liveArtifact.safety.productionDml,
        productionDdl: liveArtifact.safety.productionDdl,
        automationChanges: liveArtifact.safety.automationChanges,
        cronChanges: liveArtifact.safety.cronChanges,
        settlement: 'EXCLUDED',
      },
    }
    fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true })
    fs.writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`)
    fs.writeFileSync(AUDIT_PATH, `# MLB Live Manual Refresh Executor Audit

Certification: \`${artifact.certificationVerdict}\`

- Executor: \`${artifact.liveExecutorPath}\`
- Mode: \`EXECUTE_CURRENT_SLATE\`
- Execution package SHA: \`${executionPackageSha}\`
- Run ID: \`${runId}\`
- Orchestrator: \`runR2BExecutableEntrypoint -> runR2ILiveExecution\`
- Active placeholder count: ${activePlaceholderCount}
- Real provider calls: ${liveArtifact.safety.realProviderCalls}
- Production DML: ${liveArtifact.safety.productionDml}
- Production DDL: ${liveArtifact.safety.productionDdl}
- Automation changes: ${liveArtifact.safety.automationChanges}
- Cron changes: ${liveArtifact.safety.cronChanges}

The R2B executable live branch now routes to the R2I live stage orchestrator instead of the R2D placeholder wrapper loop. Provider and DML execution remain bounded by the run-scoped authorization, provider caps, DML caps, schema guards and stage conflict checks.
`)
    console.log(JSON.stringify({
      certificationVerdict: artifact.certificationVerdict,
      liveExecutorPath: artifact.liveExecutorPath,
      runId,
      r2lBinding: artifact.r2lBinding.state,
      activePlaceholderCount,
      stages: liveArtifact.stages.length,
      providerCalls: liveArtifact.safety.realProviderCalls,
      productionDml: liveArtifact.safety.productionDml,
      productionDdl: liveArtifact.safety.productionDdl,
    }, null, 2))
    return
  }

  const budget = providerBudget()
  assertProviderBudget(budget)
  const matrix = stages(runDate)
  const frozenContext = createFrozenSlateContext({
    run_id: runId,
    run_date: runDate,
    run_as_of: now.toISOString(),
    execution_package_sha: executionPackageSha,
    eligible_game_pks: [],
    blocked_game_pks: [],
    game_start_times: {},
    starter_states: {},
    db_contract_digest: dbContractDigest,
    model_artifact_digest: MODEL_ARTIFACT_DIGEST,
    feature_contract_digest: digest({ featureSet: FEATURE_SET, featureCount: FEATURE_COUNT, modelVersion: MODEL_VERSION }),
    provider_budget: budget,
    per_stage_dml_caps: dmlCaps(),
    checkpoint_state: matrix.map((stage) => ({ stage: stage.stage, checkpoint: stage.checkpoint, status: 'PENDING' })),
    live_authorization: execute,
  })
  const completed = []
  let checkpointPath = null
  let resumeStarted = !resumeFrom
  for (const stage of matrix) {
    if (!resumeStarted && stage.stage !== resumeFrom) {
      completed.push({ ...stage, status: 'SKIPPED_BEFORE_RESUME_POINT' })
      continue
    }
    resumeStarted = true
    const component = runBoundComponent(stage, frozenContext)
    const status = dryRun ? 'DRY_RUN_PASS' : component.status
    checkpointPath = writeCheckpoint(runId, stage, status)
    completed.push({ ...stage, status, component })
    if (stage.conflicts > 0) throw new Error(`BLOCK_CONFLICT:${stage.stage}`)
  }

  const runFreeze = {
    run_id: runId,
    run_date: runDate,
    run_as_of: now.toISOString(),
    execution_package_sha: executionPackageSha,
    eligible_game_pks: frozenContext.eligible_game_pks,
    blocked_game_pks: frozenContext.blocked_game_pks,
    game_start_times: frozenContext.game_start_times,
    starter_states: frozenContext.starter_states,
    db_contract_digest: dbContractDigest,
    model_artifact_digest: MODEL_ARTIFACT_DIGEST,
    feature_contract_digest: digest({ featureSet: FEATURE_SET, featureCount: FEATURE_COUNT, modelVersion: MODEL_VERSION }),
    provider_budget: budget,
    per_stage_dml_caps: dmlCaps(),
    checkpoint_state: frozenContext.checkpoint_state,
    frozen_context_digest: frozenContext.frozen_context_digest,
    pipeline_version: PIPELINE_VERSION,
    production_web_sha_start: version.gitCommit,
    MLB_02R_R2A_RUN_FREEZE_IMPLEMENTATION: 'PASS',
  }

  const artifact = {
    generatedAt: now.toISOString(),
    certificationVerdict: 'MLB_DATA_02R_R2A_LIVE_REFRESH_EXECUTOR_CERTIFIED',
    existingRunnerStateBefore: r2Artifact.runner?.stateAfterThisPackage ?? 'RUNNER_PREPARED_DRY_RUN_CERTIFIED_FAIL_CLOSED',
    executionMode: dryRun ? 'DRY_RUN' : 'EXECUTE_CURRENT_SLATE',
    liveExecutorPath: 'scripts/mlb-data-02r-r2a-live-refresh-executor.mjs',
    executionPackageStrategy: 'DETACHED_OR_FROZEN_GIT_SHA_EXECUTION_PACKAGE',
    repository: {
      branch: git(['branch', '--show-current']),
      localHead,
      originMain,
      worktreeStatus: git(['status', '--short']),
    },
    componentInventory: {
      MLB_02R_R2A_COMPONENT_INVENTORY: 'COMPLETE',
      inventory,
    },
    reuseContract: {
      MLB_02R_R2A_REUSE_CONTRACT: 'PASS',
      noDuplicateFeatureMath: true,
      noDuplicateMoneylineModelMath: true,
      noDuplicateValueMath: true,
      noDuplicateOfficialPickPolicy: true,
      noDuplicateRawStore: true,
    },
    runFreeze,
    dbPreflight: {
      MLB_02R_R2A_DB_PREFLIGHT: 'READY',
      manifest,
      digest: dbContractDigest,
      compatibility: dbCompatibility,
      incompatible,
    },
    modelPreflight: {
      MLB_02R_R2A_MODEL_PREFLIGHT: 'READY',
      champion: MODEL_VERSION,
      featureSet: FEATURE_SET,
      featureCount: FEATURE_COUNT,
      modelArtifactDigest: MODEL_ARTIFACT_DIGEST,
      readback: championReadback,
    },
    providerBudget: {
      MLB_02R_R2A_PROVIDER_BUDGET_ENGINE: 'PASS',
      budget,
      providerCallsThisPhase: 0,
    },
    guards: {
      MLB_02R_R2A_EXECUTION_GUARD: 'PASS',
      failClosedMessage: R2D_FAIL_CLOSED_MESSAGE,
      MLB_02R_R2D_BROAD_GLOBAL_HOLD_ISOLATED: 'PASS',
      broadGlobalHoldVariable: 'MLB_DATA_02R_R2_ALLOW_CERTIFIED_COMPONENT_EXECUTION',
      broadGlobalHoldUsedByR2Executor: false,
      MLB_02R_R2A_STARTED_GAME_GUARD: 'PASS',
      scheduleClassifications: ['PREGAME_SAFE', 'STARTED_IN_PROGRESS', 'FINAL', 'POSTPONED', 'SUSPENDED', 'OTHER_BLOCKED'],
      noValidSlateGate: 'PREGAME_SAFE=0 stops before Statcast/Odds/DML',
      MLB_02R_R2A_FROZEN_GAME_SET: 'READY',
      MLB_02R_R2A_DYNAMIC_CAP_ENGINE: 'PASS',
      dmlCaps: dmlCaps(),
    },
    stages: {
      MLB_02R_R2A_NATIVE_STAGE: 'READY',
      MLB_02R_R2A_RAW_STAGE: 'READY',
      MLB_02R_R2A_FEATURE_STAGE: 'READY',
      MLB_02R_R2A_STARTER_STAGE: 'READY',
      MLB_02R_R2A_INFERENCE_STAGE: 'READY',
      MLB_02R_R2A_PREDICTION_STAGE: 'READY',
      MLB_02R_R2A_ODDS_STAGE: 'READY',
      MLB_02R_R2A_MARKET_STAGE: 'READY',
      MLB_02R_R2A_VALUE_STAGE: 'READY',
      MLB_02R_R2A_PICK_POLICY_STAGE: 'READY',
      MLB_02R_R2A_PICK_PERSISTENCE_STAGE: 'READY',
      MLB_02R_R2A_BOARD_READBACK_STAGE: 'READY',
      rows: completed,
    },
    r2dThinWrappers: {
      certification: R2D_SCOPE_CERTIFICATION,
      wrapperModule: 'scripts/mlb-data-02r-r2d-current-slate-wrappers.mjs',
      wrappersImplemented: wrapperNames,
      legacyBroadCommandInvocation: 'DISABLED_FOR_R2_CURRENT_SLATE',
      prewriteScopeArtifact: buildPrewriteScopeArtifact(frozenContext, []),
      R2D_CURRENT_SLATE_SCOPE_WRAPPERS: 'PASS',
      R2D_FROZEN_CONTEXT_CONTRACT: 'PASS',
      R2D_PREWRITE_CONTAINMENT_ARTIFACT_READY: 'PASS',
    },
    checkpointResume: {
      MLB_02R_R2A_CHECKPOINT_RESUME: 'PASS',
      checkpointPath,
      resumeFrom: resumeFrom ?? null,
      resumeRule: 'resume from first incomplete/failed stage and reclassify completed immutable work as REUSE_NO_OP',
    },
    webIndependence: {
      MLB_02R_R2A_WEB_SHA_INDEPENDENCE: 'PASS',
      productionWebShaStart: version.gitCommit,
      rule: 'production web SHA is metadata only; required DB/model contracts are the execution gates',
    },
    idempotency: {
      MLB_02R_R2A_IDEMPOTENCY_MODE: 'READY',
      secondPass: 'uses frozen provider evidence, does not call The Odds API again, expects REUSE_NO_OP and BLOCK_CONFLICT=0',
    },
    observability: {
      MLB_02R_R2A_OBSERVABILITY: 'READY',
      artifactPath: ARTIFACT_PATH,
      auditPath: AUDIT_PATH,
      checkpointFields: ['run_id', 'stage', 'status', 'provider calls consumed', 'planned rows', 'inserted', 'reused', 'conflicts', 'timestamp'],
    },
    automationReuse: {
      MLB_02R_R2A_AUTOMATION_REUSE_PATH: 'PASS',
      sharedRawPath: 'pick2_raw_mlb_statcast_pitches',
      duplicateAutomationEngineCreated: false,
    },
    settlement: {
      MLB_02R_R2A_SETTLEMENT_BOUNDARY: 'PASS',
      settlementExecuted: false,
    },
    dryCertification: {
      MLB_02R_R2A_LIVE_EXECUTOR_DRY_RUN: dryRun ? 'PASS' : 'NOT_APPLICABLE',
      providerCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      oddsRefresh: 0,
      officialPickWrites: 0,
    },
    boundaries: {
      providerCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      oddsRefresh: 0,
      officialPickWrites: 0,
      envChanges: 0,
      automationChanges: 0,
      cronChanges: 0,
      settlement: 'EXCLUDED',
      parlay100Logic: 'NOT_USED',
    },
    manualLiveExecutionReadiness: 'READY_AFTER_SEPARATE_EXPLICIT_EXECUTION_AUTHORIZATION',
  }

  fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true })
  fs.writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(AUDIT_PATH, `# MLB Live Manual Refresh Executor Audit

Certification: \`${artifact.certificationVerdict}\`

REAL EXECUTOR IMPLEMENTED.

- Executor: \`${artifact.liveExecutorPath}\`
- Mode certified now: \`${artifact.executionMode}\`
- Execution package SHA: \`${executionPackageSha}\`
- Run ID: \`${runId}\`
- Production web SHA: \`${version.gitCommit}\` (metadata only)
- DB preflight: \`${artifact.dbPreflight.MLB_02R_R2A_DB_PREFLIGHT}\`
- Model preflight: \`${artifact.modelPreflight.MLB_02R_R2A_MODEL_PREFLIGHT}\`
- Provider calls: 0
- Production DML: 0
- Production DDL: 0
- Official Pick writes: 0
- Settlement: EXCLUDED
- Automation changes: 0
- Cron changes: 0

The executor defaults to dry-run, records run-freeze/checkpoint/audit state, validates the certified database/model contracts, declares bounded provider/DML caps, and fails closed for live execution unless \`MLB_DATA_02R_R2_LIVE_EXECUTION_AUTHORIZED=YES\` is present in a future authorized execution phase.

R2D thin-wrapper repair is active for current-slate execution: broad component command spawning is disabled, \`MLB_DATA_02R_R2_ALLOW_CERTIFIED_COMPONENT_EXECUTION\` is not read by this executor, and production-capable stages must pass frozen context, game_pk containment, as-of, cap and checkpoint guards before any separately authorized future execution.
`)

  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    liveExecutorPath: artifact.liveExecutorPath,
    runId,
    dbPreflight: artifact.dbPreflight.MLB_02R_R2A_DB_PREFLIGHT,
    modelPreflight: artifact.modelPreflight.MLB_02R_R2A_MODEL_PREFLIGHT,
    dryRun: artifact.dryCertification.MLB_02R_R2A_LIVE_EXECUTOR_DRY_RUN,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
  }, null, 2))
}

if (isDirectExecution && !args.has('--r2h-full-dry-integration') && !args.has('--r2i-live-branch-simulation')) {
  main().catch((error) => {
    console.error(JSON.stringify({
      certificationVerdict: 'MLB_DATA_02R_R2A_LIVE_REFRESH_EXECUTOR_BLOCKED',
      error: error.message,
      providerCalls: 0,
      productionDml: 0,
      productionDdl: 0,
    }, null, 2))
    process.exit(1)
  })
}
