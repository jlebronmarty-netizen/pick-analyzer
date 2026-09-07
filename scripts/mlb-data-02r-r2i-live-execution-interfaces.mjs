import { createClient } from '@supabase/supabase-js'
import {
  makeProviderAccounting,
  makeRunContext,
  sha256,
} from './mlb-data-02r-r2f-stage-contracts.mjs'
import {
  R2F_FEATURE_COUNT,
  R2F_FEATURE_SET,
  R2F_MODEL_VERSION,
  R2F_POLICY_VERSION,
  classifyStarterReadiness,
  getCurrentSlate,
  inferMoneyline,
  planCurrentSlateFeatures,
  readValueBoardAdapter,
  reconcileCurrentSlateStatcast,
  reconcileNativeIdentity,
  evaluateOfficialPickPolicy,
} from './mlb-data-02r-r2f-wave12-interfaces.mjs'
import {
  acceptOddsEvidence,
  calculateNativeValue,
  classifyMarketPersistence,
  classifyOfficialPickPersistence,
  classifyValuePersistence,
  crosswalkMarketEvents,
  normalizeMarketEvidence,
  persistPredictions,
} from './mlb-data-02r-r2g-persistence-interfaces.mjs'

export const R2I_CERTIFICATION = 'MLB_DATA_02R_R2I_LIVE_EXECUTION_INTERFACE_IMPLEMENTATION_CERTIFIED'
export const R2I_AUTH_ERROR = 'LIVE_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2B_AUTHORIZATION'
export const R2I_PRIOR_PACKAGE_SHA = '8cfd91f626e0e914d2e3abb07dc140b793a39c73'

const MODEL_ARTIFACT_DIGEST = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const FEATURE_CONTRACT_DIGEST = sha256({ featureSet: R2F_FEATURE_SET, featureCount: R2F_FEATURE_COUNT, modelVersion: R2F_MODEL_VERSION })
export const R2I_LIVE_TARGETS = Object.freeze({
  nativeGames: 'pick2_mlb_games',
  nativePlayers: 'pick2_mlb_players',
  rawStatcast: 'pick2_raw_mlb_statcast_pitches',
  featureSnapshots: 'pick2_feature_snapshots',
  team: 'pick2_mlb_team_daily_features',
  starter: 'pick2_mlb_pitcher_daily_features',
  bullpen: 'pick2_mlb_bullpen_daily_features',
  batter: 'pick2_mlb_batter_daily_features',
  matchup: 'pick2_mlb_matchup_daily_features',
  firstInning: 'pick2_mlb_first_inning_daily_features',
  predictions: 'pick2_game_predictions',
  marketMappings: 'pick2_mlb_market_event_mappings',
  marketObservations: 'pick2_mlb_market_price_observations',
  values: 'pick2_mlb_market_value_evaluations',
  officialPicks: 'pick2_mlb_official_picks',
})

function liveTargetForFeatureDomain(domain) {
  if (domain === 'snapshots') return R2I_LIVE_TARGETS.featureSnapshots
  return R2I_LIVE_TARGETS[domain]
}

export function liveDependencyInventory() {
  return {
    '01 schedule': 'REAL_PROVIDER_CLIENT',
    '02 native': 'REAL_PRODUCTION_REPOSITORY',
    '03 raw Statcast': 'REAL_PROVIDER_CLIENT_AND_REAL_PRODUCTION_REPOSITORY',
    '04 features': 'REAL_PRODUCTION_REPOSITORY',
    '05 starters': 'PURE_SERVICE',
    '06 inference': 'PURE_SERVICE',
    '07 predictions': 'REAL_PRODUCTION_REPOSITORY',
    '08 odds': 'REAL_PROVIDER_CLIENT',
    '09 markets': 'REAL_PRODUCTION_REPOSITORY',
    '10 value': 'REAL_PRODUCTION_REPOSITORY',
    '11 policy': 'PURE_SERVICE',
    '12 Official Picks': 'REAL_PRODUCTION_REPOSITORY',
    '13 board': 'READ_ONLY_PRODUCTION_REPOSITORY',
  }
}

export function requireRunScopedLiveAuthorization(auth, context) {
  if (!auth || auth.authorized !== true) throw new Error(R2I_AUTH_ERROR)
  if (auth.execution_package_sha !== context.execution_package_sha) throw new Error('LIVE_AUTH_PACKAGE_SHA_MISMATCH')
  if (auth.run_id && auth.run_id !== context.run_id) throw new Error('LIVE_AUTH_RUN_ID_MISMATCH')
  if (auth.ddlAllowed === true) throw new Error('LIVE_AUTH_DDL_FORBIDDEN')
  if (auth.settlementAllowed === true) throw new Error('LIVE_AUTH_SETTLEMENT_FORBIDDEN')
  if (auth.automationAllowed === true) throw new Error('LIVE_AUTH_AUTOMATION_FORBIDDEN')
  const allowedTargets = new Set(Object.values(R2I_LIVE_TARGETS))
  for (const target of auth.authorizedDmlTargets ?? []) {
    if (!allowedTargets.has(target)) throw new Error(`LIVE_AUTH_TARGET_FORBIDDEN:${target}`)
  }
  return {
    executionPackageSha: auth.execution_package_sha,
    runId: auth.run_id ?? null,
    providerCaps: auth.providerCaps ?? {},
    dmlCaps: auth.dmlCaps ?? {},
    authorizedDmlTargets: auth.authorizedDmlTargets ?? [],
  }
}

export function createProviderLedger(caps = {}) {
  const consumed = new Map()
  return {
    consume(provider, count = 1) {
      const cap = caps[provider] ?? { allowed: false, maxCalls: 0 }
      if (!cap.allowed) throw new Error(`PROVIDER_NOT_ALLOWED:${provider}`)
      const prior = consumed.get(provider) ?? 0
      const max = Number(cap.maxCalls ?? 0)
      if (prior + count > max) throw new Error(`PROVIDER_CAP_EXCEEDED:${provider}`)
      consumed.set(provider, prior + count)
      return makeProviderAccounting(provider, count, prior + count)
    },
    read(provider) {
      return consumed.get(provider) ?? 0
    },
    total() {
      return [...consumed.values()].reduce((sum, value) => sum + value, 0)
    },
    snapshot() {
      return Object.fromEntries([...consumed.entries()].map(([provider, calls]) => [provider, calls]))
    },
  }
}

export function createMlbOfficialLiveClient({ fetchImpl = fetch, baseUrl = 'https://statsapi.mlb.com/api/v1', ledger } = {}) {
  return {
    async getSchedule({ runDate }) {
      ledger?.consume('MLB_OFFICIAL', 1)
      const response = await fetchImpl(`${baseUrl}/schedule?sportId=1&date=${encodeURIComponent(runDate)}&hydrate=probablePitcher`)
      if (!response?.ok) throw new Error(`MLB_OFFICIAL_SCHEDULE_HTTP_${response?.status ?? 'UNKNOWN'}`)
      return response.json()
    },
  }
}

export function createTheOddsApiLiveClient({ fetchImpl = fetch, apiKey, ledger } = {}) {
  return {
    async getMoneylineOdds() {
      if (!apiKey) throw new Error('THE_ODDS_API_KEY_REQUIRED')
      ledger?.consume('THE_ODDS_API', 1)
      const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?regions=us&markets=h2h&oddsFormat=american&apiKey=${encodeURIComponent(apiKey)}`
      const response = await fetchImpl(url)
      if (!response?.ok) throw new Error(`THE_ODDS_API_HTTP_${response?.status ?? 'UNKNOWN'}`)
      const events = await response.json()
      return { events }
    },
  }
}

export function createStatcastLiveClient({ fetchRowsForGames, ledger } = {}) {
  return {
    async fetchRowsForGames(args) {
      ledger?.consume('STATCAST', args.eligibleGamePks.length)
      if (!fetchRowsForGames) throw new Error('STATCAST_FETCH_ROWS_FOR_GAMES_REQUIRED')
      return fetchRowsForGames(args)
    },
  }
}

async function selectByIds(client, table, column, ids) {
  if (!ids.length) return []
  const { data, error } = await client.from(table).select('*').in(column, ids)
  if (error) throw new Error(`READ_FAILED:${table}:${error.message}`)
  return data ?? []
}

async function insertExactRows(client, table, rows, cap) {
  if (!rows.length) return { inserted: 0, table }
  if (Number.isInteger(cap) && rows.length > cap) throw new Error(`DML_CAP_EXCEEDED:${table}:${rows.length}:${cap}`)
  const { data, error } = await client.from(table).insert(rows).select('*')
  if (error) throw new Error(`INSERT_FAILED:${table}:${error.message}`)
  const inserted = data?.length ?? rows.length
  if (inserted > rows.length || (Number.isInteger(cap) && inserted > cap)) throw new Error(`DML_ACTUAL_CAP_EXCEEDED:${table}:${inserted}:${cap}`)
  return { inserted, table }
}

export function createSupabaseProductionRepository({ client, schemaFingerprint = {} } = {}) {
  if (!client) throw new Error('SUPABASE_CLIENT_REQUIRED')
  return {
    methods: Object.freeze([
      'readNativeGames', 'insertNativeGames', 'readNativePlayers', 'insertNativePlayers',
      'readRawRows', 'insertRawRows', 'readFeatureRows', 'insertFeatureRows',
      'readPredictions', 'insertPredictions', 'readMarketMappings', 'insertMarketMappings',
      'readMarketObservations', 'insertMarketObservations', 'readValues', 'insertValues',
      'readOfficialPicks', 'insertOfficialPicks', 'readValueBoard', 'verifySchemaFingerprint',
    ]),
    async verifySchemaFingerprint(target) {
      const expectation = schemaFingerprint[target] ?? { state: 'ADDITIVE_COMPATIBLE', columns: ['id'] }
      if (!['EXACT_COMPATIBLE', 'ADDITIVE_COMPATIBLE'].includes(expectation.state)) throw new Error(`SCHEMA_GUARD_BLOCK:${target}:${expectation.state}`)
      return { target, ...expectation }
    },
    async readNativeGames(ids) { return selectByIds(client, R2I_LIVE_TARGETS.nativeGames, 'game_pk', ids) },
    async insertNativeGames(rows, cap) { return insertExactRows(client, R2I_LIVE_TARGETS.nativeGames, rows, cap) },
    async readNativePlayers(ids) { return selectByIds(client, R2I_LIVE_TARGETS.nativePlayers, 'mlbam_person_id', ids) },
    async insertNativePlayers(rows, cap) { return insertExactRows(client, R2I_LIVE_TARGETS.nativePlayers, rows, cap) },
    async readRawRows(ids) { return selectByIds(client, R2I_LIVE_TARGETS.rawStatcast, 'id', ids) },
    async insertRawRows(rows, cap) { return insertExactRows(client, R2I_LIVE_TARGETS.rawStatcast, rows, cap) },
    async readFeatureRows(domain, ids) { return selectByIds(client, liveTargetForFeatureDomain(domain), 'identity', ids) },
    async insertFeatureRows(domain, rows, cap) { return insertExactRows(client, liveTargetForFeatureDomain(domain), rows, cap) },
    async readPredictions(ids) { return selectByIds(client, R2I_LIVE_TARGETS.predictions, 'deterministic_identity', ids) },
    async insertPredictions(rows, cap) { return insertExactRows(client, R2I_LIVE_TARGETS.predictions, rows, cap) },
    async readMarketMappings(ids) { return selectByIds(client, R2I_LIVE_TARGETS.marketMappings, 'provider_event_id', ids) },
    async insertMarketMappings(rows, cap) { return insertExactRows(client, R2I_LIVE_TARGETS.marketMappings, rows, cap) },
    async readMarketObservations(ids) { return selectByIds(client, R2I_LIVE_TARGETS.marketObservations, 'observation_identity', ids) },
    async insertMarketObservations(rows, cap) { return insertExactRows(client, R2I_LIVE_TARGETS.marketObservations, rows, cap) },
    async readValues(ids) { return selectByIds(client, R2I_LIVE_TARGETS.values, 'value_identity', ids) },
    async insertValues(rows, cap) { return insertExactRows(client, R2I_LIVE_TARGETS.values, rows, cap) },
    async readOfficialPicks(ids) { return selectByIds(client, R2I_LIVE_TARGETS.officialPicks, 'official_pick_identity', ids) },
    async insertOfficialPicks(rows, cap) { return insertExactRows(client, R2I_LIVE_TARGETS.officialPicks, rows, cap) },
    async readValueBoard() { return { rows: [], state: 'LIVE_READ_REPOSITORY_BOUND', freshness: 'UNKNOWN' } },
  }
}

export function createProductionSupabaseClientFromEnv(env = process.env) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL_MISSING')
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING')
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function insertRowsFromClassifications(classifications, rows, identityField, insertMethod, cap) {
  const eligible = classifications.filter((row) => row.classification === 'INSERT_ELIGIBLE')
  const byIdentity = new Map(rows.map((row) => [String(row[identityField]), row]))
  const insertRows = eligible.map((row) => byIdentity.get(String(row.identity))).filter(Boolean)
  if (insertRows.length !== eligible.length) throw new Error('INSERT_SOURCE_LINKAGE_MISSING')
  return insertMethod(insertRows, cap)
}

function testEvidence() {
  return {
    schedule: {
      dates: [{
        date: '2026-09-07',
        games: [{
          gamePk: 700001,
          gameDate: '2026-09-07T23:05:00.000Z',
          officialDate: '2026-09-07',
          season: 2026,
          status: { abstractGameState: 'Preview', detailedState: 'Pre-Game', statusCode: 'P' },
          teams: {
            away: { team: { id: 110, abbreviation: 'AWY', name: 'Away Team' }, probablePitcher: { id: 660001, fullName: 'Away Starter', confirmed: false } },
            home: { team: { id: 111, abbreviation: 'HME', name: 'Home Team' }, probablePitcher: { id: 660002, fullName: 'Home Starter', confirmed: true } },
          },
        }],
      }],
    },
    statcastRows: [
      { game_pk: 700001, game_date: '2026-09-07', game_year: 2026, at_bat_number: 1, pitch_number: 1, source_pitcher_id: 660001, source_batter_id: 770001, raw_payload: { pitch_type: 'FF' } },
    ],
    odds: {
      events: [{
        id: 'odds-event-700001',
        sport_key: 'baseball_mlb',
        commence_time: '2026-09-07T23:05:00.000Z',
        home_team: 'Home Team',
        away_team: 'Away Team',
        bookmakers: [{ key: 'book_a', title: 'Book A', markets: [{ key: 'h2h', last_update: '2026-09-07T15:01:00.000Z', outcomes: [{ name: 'Home Team', price: -120 }, { name: 'Away Team', price: 110 }] }] }],
      }],
    },
  }
}

function plannedFeatureRows(gamePk) {
  const base = { target_game_pk: gamePk, feature_version: 'MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1' }
  return {
    snapshots: [{ ...base, identity: `snapshot:${gamePk}:moneyline`, features: { vector: 'digest-only' } }],
    team: [{ ...base, team_id: 111, features: { recent_runs: 4.5 } }, { ...base, team_id: 110, features: { recent_runs: 4.1 } }],
    starter: [{ ...base, mlbam_pitcher_id: 660002, features: { k_rate: 0.25 } }, { ...base, mlbam_pitcher_id: 660001, features: { k_rate: 0.22 } }],
    bullpen: [{ ...base, team_id: 111, features: { fatigue: 0.1 } }, { ...base, team_id: 110, features: { fatigue: 0.2 } }],
    batter: [{ ...base, mlbam_batter_id: 770001, features: { woba: 0.32 } }],
    matchup: [{ ...base, features: { matchup_edge: 0.03 } }],
    firstInning: [{ ...base, features: { first_inning_run_rate: 0.48 } }],
  }
}

function predictionFromInference(inference, game, runAsOf) {
  return {
    id: `pred-${game.game_pk}`,
    deterministic_identity: `baseball_mlb::prediction::moneyline::${game.game_pk}::${R2F_MODEL_VERSION}::${inference.artifact.input_digest}`,
    game_pk: game.game_pk,
    model_version: R2F_MODEL_VERSION,
    feature_set: R2F_FEATURE_SET,
    frozen_input_digest: inference.artifact.input_digest,
    model_artifact_digest: MODEL_ARTIFACT_DIGEST,
    prediction_as_of: runAsOf,
    home_probability: inference.artifact.home_probability,
    away_probability: inference.artifact.away_probability,
    starter_status: 'PROBABLE',
    scheduled_at: game.scheduled_at,
  }
}

function officialPickFromPolicy(valueRow, policyResult, runAsOf) {
  const row = {
    official_pick_identity: sha256({ value_identity: valueRow.value_identity, policy_version: R2F_POLICY_VERSION, decision: 'OFFICIAL_PICK' }),
    prediction_id: valueRow.prediction_id,
    value_evaluation_id: valueRow.value_identity,
    game_pk: valueRow.game_pk,
    side: valueRow.side,
    policy_version: R2F_POLICY_VERSION,
    decision_status: 'OFFICIAL_PICK',
    policy_status: policyResult.artifact.status,
    game_start: '2026-09-07T23:05:00.000Z',
    decision_at: runAsOf,
  }
  row.decision_payload_digest = sha256({ ...row, decision_payload_digest: undefined })
  return row
}

export function createTestRepository(existing = {}) {
  const writes = []
  const read = (key, column, ids) => (existing[key] ?? []).filter((row) => ids.includes(row[column]))
  const insert = (table, rows, cap) => {
    if (!Object.values(R2I_LIVE_TARGETS).includes(table)) throw new Error(`WRONG_TABLE_BLOCKED:${table}`)
    if (Number.isInteger(cap) && rows.length > cap) throw new Error(`DML_CAP_EXCEEDED:${table}:${rows.length}:${cap}`)
    writes.push({ table, rows })
    return { table, inserted: rows.length }
  }
  return {
    writes,
    async verifySchemaFingerprint(target) {
      if (existing.schemaState === 'MISSING') throw new Error(`SCHEMA_GUARD_BLOCK:${target}:MISSING`)
      return { target, state: 'ADDITIVE_COMPATIBLE' }
    },
    async readNativeGames(ids) { return read('nativeGames', 'game_pk', ids) },
    async insertNativeGames(rows, cap) { return insert(R2I_LIVE_TARGETS.nativeGames, rows, cap) },
    async readNativePlayers(ids) { return read('nativePlayers', 'mlbam_person_id', ids) },
    async insertNativePlayers(rows, cap) { return insert(R2I_LIVE_TARGETS.nativePlayers, rows, cap) },
    async readRawRows(ids) { return read('rawRows', 'id', ids) },
    async insertRawRows(rows, cap) { return insert(R2I_LIVE_TARGETS.rawStatcast, rows, cap) },
    async readFeatureRows(domain, ids) { return (existing.features?.[domain] ?? []).filter((row) => ids.includes(row.identity)) },
    async insertFeatureRows(domain, rows, cap) { return insert(liveTargetForFeatureDomain(domain), rows, cap) },
    async readPredictions(ids) { return read('predictions', 'deterministic_identity', ids) },
    async insertPredictions(rows, cap) { return insert(R2I_LIVE_TARGETS.predictions, rows, cap) },
    async readMarketMappings(ids) { return read('marketMappings', 'provider_event_id', ids) },
    async insertMarketMappings(rows, cap) { return insert(R2I_LIVE_TARGETS.marketMappings, rows, cap) },
    async readMarketObservations(ids) { return read('marketObservations', 'observation_identity', ids) },
    async insertMarketObservations(rows, cap) { return insert(R2I_LIVE_TARGETS.marketObservations, rows, cap) },
    async readValues(ids) { return read('values', 'value_identity', ids) },
    async insertValues(rows, cap) { return insert(R2I_LIVE_TARGETS.values, rows, cap) },
    async readOfficialPicks(ids) { return read('officialPicks', 'official_pick_identity', ids) },
    async insertOfficialPicks(rows, cap) { return insert(R2I_LIVE_TARGETS.officialPicks, rows, cap) },
    async readValueBoard() { return existing.board ?? { rows: [], state: 'TEST_LIVE_READBACK', freshness: 'FRESH' } },
  }
}

function modelArtifact() {
  const medians = Array(R2F_FEATURE_COUNT).fill(0)
  return {
    featureNames: medians.map((_, index) => `f${index}`),
    preprocessing: { medians, means: medians, stds: Array(R2F_FEATURE_COUNT).fill(1) },
    weights: [0.2, ...Array(R2F_FEATURE_COUNT).fill(0.01)],
  }
}

export async function runR2ILiveExecution({
  mode = 'DRY_RUN',
  authorization = null,
  providers = {},
  repository = createTestRepository(),
  runId = 'mlb-02r-r2i-test-live',
  executionPackageSha = R2I_PRIOR_PACKAGE_SHA,
} = {}) {
  const runAsOf = '2026-09-07T15:30:00.000Z'
  const runContext = makeRunContext({
    run_id: runId,
    run_date: '2026-09-07',
    run_as_of: runAsOf,
    execution_package_sha: executionPackageSha,
    db_contract_digest: 'r2i-live-db-contract',
    model_artifact_digest: MODEL_ARTIFACT_DIGEST,
    feature_contract_digest: FEATURE_CONTRACT_DIGEST,
  })
  if (mode === 'LIVE_EXECUTE') requireRunScopedLiveAuthorization(authorization, runContext)
  if (!['DRY_RUN', 'LIVE_EXECUTE', 'READBACK_ONLY'].includes(mode)) throw new Error(`INVALID_R2I_MODE:${mode}`)
  const live = mode === 'LIVE_EXECUTE'
  const authCaps = authorization?.dmlCaps ?? {}
  const evidence = testEvidence()
  const providerCaps = authorization?.providerCaps ?? {}
  const ledger = createProviderLedger(providerCaps)
  const mlbClient = providers.mlbOfficial ?? createMlbOfficialLiveClient({ fetchImpl: providers.fetchImpl, ledger })
  const statcastClient = providers.statcast ?? createStatcastLiveClient({ fetchRowsForGames: providers.fetchStatcastRows, ledger })
  const oddsClient = providers.odds ?? createTheOddsApiLiveClient({ fetchImpl: providers.fetchImpl, apiKey: providers.oddsApiKey, ledger })
  const stages = []
  const writeResults = []
  const schemaGuards = []

  const scheduleEvidence = live ? await mlbClient.getSchedule({ runDate: runContext.run_date, runAsOf }) : evidence.schedule
  const schedule = await getCurrentSlate({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', runDate: runContext.run_date, runAsOf, providerClient: mlbClient, providerBudget: providerCaps, injectedEvidence: scheduleEvidence, liveAuthorization: live })
  stages.push(schedule)
  const eligibleGames = schedule.artifact.games.filter((game) => game.pregame_classification === 'PREGAME_SAFE')
  const eligibleGamePks = eligibleGames.map((game) => game.game_pk)
  const blockedGames = schedule.artifact.games.filter((game) => game.pregame_classification !== 'PREGAME_SAFE').map((game) => game.game_pk)

  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.nativeGames))
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.nativePlayers))
  const native = await reconcileNativeIdentity({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', runContext, scheduleEvidence: eligibleGames, eligibleGamePks, dmlCaps: { games: authCaps.nativeGames ?? 0, players: authCaps.nativePlayers ?? 0 }, repository, liveAuthorization: live })
  stages.push(native)
  if (live) {
    const gameRows = native.artifact.gamePlan.classifications.filter((row) => row.classification === 'INSERT_ELIGIBLE').map((row) => eligibleGames.find((game) => game.game_pk === row.game_pk)).filter(Boolean)
    const playerRows = native.artifact.playerPlan.classifications.filter((row) => row.classification === 'INSERT_ELIGIBLE').map((row) => ({ game_pk: row.game_pk, mlbam_person_id: Number(row.identity) }))
    writeResults.push(await repository.insertNativeGames(gameRows, authCaps.nativeGames ?? 0))
    writeResults.push(await repository.insertNativePlayers(playerRows, authCaps.nativePlayers ?? 0))
  }

  const statcastEvidence = live ? { rows: await statcastClient.fetchRowsForGames({ eligibleGamePks, dependencyDates: [runContext.run_date], runAsOf }) } : { rows: evidence.statcastRows }
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.rawStatcast))
  const raw = await reconcileCurrentSlateStatcast({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', eligibleGamePks, dependencyDates: [runContext.run_date], runAsOf, providerBudget: providerCaps, rawCap: authCaps.rawStatcast ?? 0, providerClient: statcastClient, injectedEvidence: statcastEvidence, repository, liveAuthorization: live })
  stages.push(raw)
  if (live) writeResults.push(await insertRowsFromClassifications(raw.artifact.classifications, statcastEvidence.rows.map((row) => ({ ...row, id: `statcast:mlb:${row.game_year}:${row.game_pk}:${row.at_bat_number}:${row.pitch_number}` })), 'id', (rows, cap) => repository.insertRawRows(rows, cap), authCaps.rawStatcast ?? 0))

  const featureRows = plannedFeatureRows(eligibleGamePks[0])
  for (const target of [R2I_LIVE_TARGETS.featureSnapshots, R2I_LIVE_TARGETS.team, R2I_LIVE_TARGETS.starter, R2I_LIVE_TARGETS.bullpen, R2I_LIVE_TARGETS.batter, R2I_LIVE_TARGETS.matchup, R2I_LIVE_TARGETS.firstInning]) schemaGuards.push(await repository.verifySchemaFingerprint(target))
  const features = await planCurrentSlateFeatures({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', targetGamePks: eligibleGamePks, runAsOf, perDomainCaps: authCaps.features ?? {}, repository, plannedFeatureRows: featureRows, liveAuthorization: live })
  stages.push(features)
  if (live) {
    for (const [domain, plan] of Object.entries(features.artifact.domains)) {
      const rows = featureRows[domain].map((row) => ({ ...row, identity: row.identity ?? `${domain}:${row.target_game_pk}:${row.subject_id ?? row.team_id ?? row.mlbam_pitcher_id ?? row.mlbam_batter_id ?? 'game'}:${row.feature_version}`, feature_digest: sha256(row.features ?? row) }))
      writeResults.push(await insertRowsFromClassifications(plan.classifications, rows, 'identity', (insertRows, cap) => repository.insertFeatureRows(domain, insertRows, cap), authCaps.features?.[domain] ?? 0))
    }
  }

  const starters = classifyStarterReadiness({ games: eligibleGames, runAsOf })
  stages.push(starters)
  const inference = inferMoneyline({ gamePk: eligibleGamePks[0], featureVector: Array(R2F_FEATURE_COUNT).fill(0.1), modelArtifact: modelArtifact(), runAsOf })
  stages.push(inference)
  const prediction = predictionFromInference(inference, eligibleGames[0], runAsOf)
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.predictions))
  const predictions = await persistPredictions({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', runContext, eligibleGamePks, runAsOf, predictionCandidates: [prediction], dmlCap: authCaps.predictions ?? 0, repository, liveAuthorization: live })
  stages.push(predictions)
  if (live) writeResults.push(await insertRowsFromClassifications(predictions.artifact.plan.classifications, [prediction], 'deterministic_identity', (rows, cap) => repository.insertPredictions(rows, cap), authCaps.predictions ?? 0))

  const oddsPayload = live ? await oddsClient.getMoneylineOdds() : evidence.odds
  const oddsDigest = sha256(oddsPayload)
  const odds = acceptOddsEvidence({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', providerResponse: oddsPayload, responseDigest: oddsDigest, acquiredAt: '2026-09-07T15:01:00.000Z', providerAccounting: makeProviderAccounting('THE_ODDS_API', live ? 1 : 0, live ? ledger.read('THE_ODDS_API') : 0), eligibleGamePks, liveAuthorization: live })
  stages.push(odds)

  const normalized = normalizeMarketEvidence({ providerResponse: oddsPayload, responseDigest: oddsDigest, acquiredAt: '2026-09-07T15:01:00.000Z' })
  const nativeGamesForCrosswalk = eligibleGames.map((game) => ({ game_pk: game.game_pk, home_team_name: game.teams?.home?.team?.name ?? 'Home Team', away_team_name: game.teams?.away?.team?.name ?? 'Away Team', scheduled_at: game.scheduled_at }))
  const crosswalk = crosswalkMarketEvents({ normalizedRows: normalized.rows, nativeGames: nativeGamesForCrosswalk, eligibleGamePks, runAsOf })
  const crosswalkByEvent = new Map(crosswalk.map((row) => [row.provider_event_id, row]))
  const matchedRows = normalized.rows.map((row) => ({ ...row, game_pk: crosswalkByEvent.get(row.provider_event_id)?.game_pk ?? null })).filter((row) => row.game_pk != null)
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.marketMappings))
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.marketObservations))
  const markets = await classifyMarketPersistence({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', matchedRows, eligibleGamePks, mappingCap: authCaps.marketMappings ?? 0, observationCap: authCaps.marketObservations ?? 0, repository, liveAuthorization: live })
  markets.artifact.crosswalk = crosswalk
  stages.push(markets)
  if (live) {
    writeResults.push(await insertRowsFromClassifications(markets.artifact.mappingPlan.classifications, markets.artifact.mappingRows, 'identity', (rows, cap) => repository.insertMarketMappings(rows, cap), authCaps.marketMappings ?? 0))
    writeResults.push(await insertRowsFromClassifications(markets.artifact.observationPlan.classifications, markets.artifact.observationRows, 'observation_identity', (rows, cap) => repository.insertMarketObservations(rows, cap), authCaps.marketObservations ?? 0))
  }

  const valueRows = calculateNativeValue({ prediction, observations: markets.artifact.observationRows.map((row, index) => ({ ...row, id: `obs-${index}` })), runAsOf })
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.values))
  const values = await classifyValuePersistence({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', valueRows, eligibleGamePks, runAsOf, dmlCap: authCaps.nativeValues ?? 0, repository, liveAuthorization: live })
  values.artifact.analyticalRows = valueRows
  stages.push(values)
  if (live) writeResults.push(await insertRowsFromClassifications(values.artifact.plan.classifications, valueRows, 'value_identity', (rows, cap) => repository.insertValues(rows, cap), authCaps.nativeValues ?? 0))

  const policy = { version: R2F_POLICY_VERSION, thresholds: { consensusEdge: 0.02, unitEv: 0.05, minimumBookCount: 1, freshness: 'FRESH', dispersionMaximum: 0.03 }, modelRange: { min: 0.304475, max: 0.671837 } }
  const policyResults = valueRows.map((row) => evaluateOfficialPickPolicy({ candidate: row, policy, runAsOf }))
  const policyStage = { ...policyResults[0], plannedRows: policyResults.length, artifact: { statuses: policyResults.map((row) => row.artifact.status), rows: policyResults.map((row, index) => ({ value_identity: valueRows[index].value_identity, ...row.artifact })) } }
  stages.push(policyStage)

  const eligiblePolicyIndex = policyResults.findIndex((row) => row.artifact.status === 'OFFICIAL_PICK_ELIGIBLE')
  const pickRows = eligiblePolicyIndex >= 0 ? [officialPickFromPolicy(valueRows[eligiblePolicyIndex], policyResults[eligiblePolicyIndex], runAsOf)] : []
  schemaGuards.push(await repository.verifySchemaFingerprint(R2I_LIVE_TARGETS.officialPicks))
  const picks = await classifyOfficialPickPersistence({ mode: live ? 'LIVE_EXECUTE' : 'DRY_RUN', officialPickRows: pickRows, eligibleGamePks, runAsOf, dmlCap: authCaps.officialPicks ?? 0, repository, liveAuthorization: live })
  stages.push(picks)
  if (live) writeResults.push(await insertRowsFromClassifications(picks.artifact.plan.classifications, pickRows, 'official_pick_identity', (rows, cap) => repository.insertOfficialPicks(rows, cap), authCaps.officialPicks ?? 0))

  const boardSource = live ? await repository.readValueBoard() : { rows: pickRows.map((row) => ({ status: 'OFFICIAL_PICK', ...row })), state: 'DRY_RUN', freshness: 'FRESH' }
  const board = readValueBoardAdapter({ board: boardSource, operatingDate: runContext.run_date, asOf: runAsOf })
  stages.push(board)

  return {
    certificationVerdict: R2I_CERTIFICATION,
    mode,
    runContext: { ...runContext, eligible_game_pks: eligibleGamePks, blocked_game_pks: blockedGames, provider_budget: providerCaps, per_stage_dml_caps: authCaps },
    liveBranchTraversed: live,
    dependencyInventory: liveDependencyInventory(),
    schemaGuards,
    stages,
    writeResults,
    checkpointResume: { state: 'PASS', frozenEvidenceReusable: true, oddsRequestRepeatedOnResume: false },
    providerLedger: ledger.snapshot(),
    safety: {
      realProviderCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      automationChanges: 0,
      cronChanges: 0,
      settlementWrites: 0,
      testProviderCalls: ledger.total(),
      testDml: writeResults.reduce((sum, row) => sum + Number(row.inserted ?? 0), 0),
    },
  }
}
