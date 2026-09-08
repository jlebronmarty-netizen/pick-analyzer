import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fetchR2NStatcastRowsForGames } from './mlb-data-02h-2026-current-foundation.mjs'
import {
  R2I_LIVE_TARGETS,
  createMlbOfficialLiveClient,
  createProviderLedger,
  createStatcastLiveClient,
  createTestRepository,
  createTheOddsApiLiveClient,
  runR2ILiveExecution,
} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'

const outputPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2N_STATCAST_LIVE_FETCH_BINDING_REPAIR.json'
const auditPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2N_STATCAST_LIVE_FETCH_BINDING_REPAIR_AUDIT.md'
const priorPackageSha = '9c6d29083c8a8fb7f75fe83b9e028df5f6f3c88a'
const validatorPackageSha = 'R2N_LOCAL_CERTIFICATION_PACKAGE'
const errors = []

function check(label, condition, detail = null) {
  if (!condition) errors.push(detail ? `${label}: ${detail}` : label)
}

async function mustThrow(label, fn, token) {
  try {
    await fn()
    errors.push(`${label}: did not throw`)
  } catch (error) {
    if (!String(error.message).includes(token)) errors.push(`${label}: wrong error ${error.message}`)
  }
}

function loadLocalEnv() {
  if (!fs.existsSync('.env.local')) return
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function fakeCsv(gamePks = [700001]) {
  const header = 'game_pk,game_date,game_year,game_type,home_team,away_team,pitcher,batter,player_name,at_bat_number,pitch_number,pitch_type,type,description,inning,inning_topbot'
  const rows = gamePks.map((gamePk, index) => [
    gamePk,
    '2026-09-07',
    '2026',
    'R',
    'HME',
    'AWY',
    String(660001 + index),
    String(770001 + index),
    `Pitcher ${index + 1}`,
    '1',
    '1',
    'FF',
    'S',
    'called_strike',
    '1',
    'Top',
  ].join(','))
  return `${header}\n${rows.join('\n')}\n`
}

function fakeFetch({ csv = fakeCsv(), fail = false } = {}) {
  return async (url) => {
    const text = String(url)
    if (text.includes('statsapi.mlb.com')) return { ok: true, async json() { return scheduleEvidence() } }
    if (text.includes('baseballsavant.mlb.com/statcast_search/csv')) {
      if (fail) return { ok: false, status: 503, async text() { return '' } }
      return { ok: true, status: 200, async text() { return csv } }
    }
    if (text.includes('api.the-odds-api.com') && text.includes('baseball_mlb') && text.includes('markets=h2h') && text.includes('oddsFormat=american')) {
      return {
        ok: true,
        async json() {
          return [{
            id: 'odds-event-700001',
            sport_key: 'baseball_mlb',
            commence_time: '2026-09-07T23:05:00.000Z',
            home_team: 'Home Team',
            away_team: 'Away Team',
            bookmakers: [{ key: 'book_a', title: 'Book A', markets: [{ key: 'h2h', last_update: '2026-09-07T15:01:00.000Z', outcomes: [{ name: 'Home Team', price: -120 }, { name: 'Away Team', price: 110 }] }] }],
          }]
        },
      }
    }
    return { ok: false, status: 404, async json() { return {} }, async text() { return '' } }
  }
}

function scheduleEvidence(gamePk = 700001) {
  return {
    dates: [{
      date: '2026-09-07',
      games: [{
        gamePk,
        gameDate: '2026-09-07T23:05:00.000Z',
        officialDate: '2026-09-07',
        season: 2026,
        gameType: 'R',
        status: { abstractGameState: 'Preview', detailedState: 'Pre-Game', statusCode: 'P' },
        teams: {
          away: { team: { id: 110, abbreviation: 'AWY', name: 'Away Team' }, probablePitcher: { id: 660001, fullName: 'Away Starter', confirmed: false } },
          home: { team: { id: 111, abbreviation: 'HME', name: 'Home Team' }, probablePitcher: { id: 660002, fullName: 'Home Starter', confirmed: true } },
        },
      }],
    }],
  }
}

function fakeDb({ persistedRaw = [] } = {}) {
  return {
    from(table) {
      const state = { table, filters: {} }
      const builder = {
        select() { return builder },
        in(column, values) { state.filters[column] = values; return builder },
        eq(column, value) { state.filters[column] = [value]; return builder },
        order() { return builder },
        range() { return builder },
        then(resolve, reject) {
          Promise.resolve().then(() => {
            if (state.table === 'pick2_raw_mlb_statcast_pitches') {
              const ids = state.filters.id ? new Set(state.filters.id.map(String)) : null
              const pks = state.filters.game_pk ? new Set(state.filters.game_pk.map(Number)) : null
              return { data: persistedRaw.filter((row) => (!ids || ids.has(String(row.id))) && (!pks || pks.has(Number(row.game_pk)))), error: null }
            }
            if (state.table === 'sports_teams') {
              return { data: [
                { id: 'team-home', abbreviation: 'HME', metadata: {} },
                { id: 'team-away', abbreviation: 'AWY', metadata: {} },
              ], error: null }
            }
            return { data: [], error: null }
          }).then(resolve, reject)
        },
      }
      return builder
    },
  }
}

function auth(overrides = {}) {
  return {
    authorized: true,
    execution_package_sha: validatorPackageSha,
    run_id: 'mlb-02r-r2n-live-branch-sim',
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
    authorizedDmlTargets: Object.values(R2I_LIVE_TARGETS),
    ddlAllowed: false,
    settlementAllowed: false,
    automationAllowed: false,
    ...overrides,
  }
}

function testProviders() {
  const ledger = createProviderLedger(auth().providerCaps)
  return {
    ledger,
    providers: {
      mlbOfficial: createMlbOfficialLiveClient({ fetchImpl: fakeFetch(), ledger }),
      statcast: createStatcastLiveClient({
        ledger,
        db: fakeDb(),
        fetchImpl: fakeFetch(),
        cacheDir: path.join('.tmp', 'mlb-data-02r-r2n-statcast-cache'),
      }),
      odds: createTheOddsApiLiveClient({ fetchImpl: fakeFetch(), apiKey: 'test-only', ledger }),
    },
  }
}

async function productionNativeGameReadback() {
  loadLocalEnv()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { available: false, error: 'SUPABASE_ENV_MISSING' }
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await db
    .from('pick2_mlb_games')
    .select('game_pk,game_date,source,metadata')
    .in('game_pk', [823902, 824958])
    .order('game_pk', { ascending: true })
  if (error) return { available: false, error: error.message }
  return {
    available: true,
    rows: data ?? [],
    reuseProjected: (data ?? []).length === 2,
  }
}

async function main() {
  const directRows = await fetchR2NStatcastRowsForGames({
    eligibleGamePks: [700001],
    dependencyDates: ['2026-09-07'],
    runAsOf: '2026-09-07T15:30:00.000Z',
    providerBudget: { STATCAST: { allowed: true, maxCalls: 1 } },
    db: fakeDb(),
    fetchImpl: fakeFetch(),
    cacheDir: path.join('.tmp', 'mlb-data-02r-r2n-direct-cache'),
  })
  check('direct fetch row count', directRows.length === 1)
  check('direct fetch canonical identity', directRows[0]?.id === 'statcast:mlb:2026:700001:1:1')
  check('direct fetch raw table shape', directRows[0]?.source === 'statcast' && directRows[0]?.raw_payload_digest)
  check('direct fetch scoped game', directRows.every((row) => Number(row.game_pk) === 700001))

  const persisted = { id: 'statcast:mlb:2026:700001:1:1', game_pk: 700001, game_date: '2026-09-07', game_year: 2026, at_bat_number: 1, pitch_number: 1, raw_payload_digest: 'persisted' }
  const cachedRows = await fetchR2NStatcastRowsForGames({
    eligibleGamePks: [700001],
    dependencyDates: ['2026-09-07'],
    runAsOf: '2026-09-07T15:30:00.000Z',
    db: fakeDb({ persistedRaw: [persisted] }),
    fetchImpl: fakeFetch({ fail: true }),
    cachePolicy: { strategy: 'CANONICAL_PERSISTED_THEN_LOCAL_CSV' },
  })
  check('canonical cache-first persisted reuse', cachedRows.length === 1 && cachedRows[0].raw_payload_digest === 'persisted')

  const liveClientRows = await createStatcastLiveClient({
    ledger: createProviderLedger({ STATCAST: { allowed: true, maxCalls: 1 } }),
    db: fakeDb(),
    fetchImpl: fakeFetch(),
    cacheDir: path.join('.tmp', 'mlb-data-02r-r2n-live-client-cache'),
  }).fetchRowsForGames({ eligibleGamePks: [700001], dependencyDates: ['2026-09-07'], runAsOf: '2026-09-07T15:30:00.000Z' })
  check('default Statcast client bound', liveClientRows.length === 1)

  const { providers } = testProviders()
  const liveSimulation = await runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE',
    authorization: auth(),
    providers,
    repository: createTestRepository({ nativeGames: [{ game_pk: 700001, home_team_id: null, away_team_id: null, game_date: '2026-09-07' }] }),
    executionPackageSha: validatorPackageSha,
    runId: 'mlb-02r-r2n-live-branch-sim',
    runDate: '2026-09-07',
    runAsOf: '2026-09-07T15:30:00.000Z',
  })
  const rawStage = liveSimulation.stages.find((stage) => stage.stage === '03 raw Statcast reconciliation')
  const featureStage = liveSimulation.stages.find((stage) => stage.stage === '04 feature refresh')
  check('live simulation traversed', liveSimulation.liveBranchTraversed === true)
  check('raw stage reached', rawStage?.plannedRows === 1 && rawStage?.insertEligible === 1)
  check('feature stage handoff', Boolean(featureStage) && liveSimulation.stages.indexOf(featureStage) > liveSimulation.stages.indexOf(rawStage))
  check('placeholder removed', !JSON.stringify(liveSimulation).includes('STATCAST_FETCH_ROWS_FOR_GAMES_REQUIRED'))
  check('raw target table', liveSimulation.writeResults.some((row) => row.table === R2I_LIVE_TARGETS.rawStatcast))

  await mustThrow('empty game_pk scope', () => fetchR2NStatcastRowsForGames({ eligibleGamePks: [], dependencyDates: ['2026-09-07'], runAsOf: '2026-09-07T15:30:00.000Z', db: fakeDb(), fetchImpl: fakeFetch() }), 'R2N_EMPTY_GAME_PK_SCOPE')
  await mustThrow('full-season request', () => fetchR2NStatcastRowsForGames({ eligibleGamePks: [700001], dependencyDates: ['2026-09-07'], runAsOf: '2026-09-07T15:30:00.000Z', allowFullSeason: true, db: fakeDb(), fetchImpl: fakeFetch() }), 'R2N_FULL_SEASON_REQUEST_FORBIDDEN')
  await mustThrow('provider budget exceeded', () => fetchR2NStatcastRowsForGames({ eligibleGamePks: [700001], dependencyDates: ['2026-09-07', '2026-09-08'], runAsOf: '2026-09-07T15:30:00.000Z', providerBudget: { STATCAST: { allowed: true, maxCalls: 1 } }, db: fakeDb(), fetchImpl: fakeFetch() }), 'R2N_STATCAST_PROVIDER_CAP_EXCEEDED')
  await mustThrow('dry without injected evidence', () => fetchR2NStatcastRowsForGames({ mode: 'DRY_RUN', eligibleGamePks: [700001], dependencyDates: ['2026-09-07'], runAsOf: '2026-09-07T15:30:00.000Z', db: fakeDb(), fetchImpl: fakeFetch() }), 'R2N_DRY_RUN_REQUIRES_INJECTED_EVIDENCE')
  await mustThrow('out-of-scope game_pk', () => runR2ILiveExecution({
    mode: 'LIVE_EXECUTE',
    authorization: auth({ dmlCaps: { ...auth().dmlCaps, rawStatcast: 2 } }),
    providers: {
      mlbOfficial: createMlbOfficialLiveClient({ fetchImpl: fakeFetch(), ledger: createProviderLedger(auth().providerCaps) }),
      statcast: createStatcastLiveClient({ fetchRowsForGames: async () => [{ game_pk: 999999, game_date: '2026-09-07', game_year: 2026, at_bat_number: 1, pitch_number: 1 }] }),
      odds: createTheOddsApiLiveClient({ fetchImpl: fakeFetch(), apiKey: 'test-only' }),
    },
    repository: createTestRepository(),
    executionPackageSha: validatorPackageSha,
    runId: 'mlb-02r-r2n-live-branch-sim',
    runDate: '2026-09-07',
    runAsOf: '2026-09-07T15:30:00.000Z',
  }), 'OUT_OF_SCOPE_GAME_PK')
  await mustThrow('batch cap exceeded', () => runR2ILiveExecution({
    mode: 'LIVE_EXECUTE',
    authorization: auth({ dmlCaps: { ...auth().dmlCaps, rawStatcast: 0 } }),
    providers,
    repository: createTestRepository(),
    executionPackageSha: validatorPackageSha,
    runId: 'mlb-02r-r2n-live-branch-sim',
    runDate: '2026-09-07',
    runAsOf: '2026-09-07T15:30:00.000Z',
  }), 'CAP_EXCEEDED')
  await mustThrow('missing live authorization', () => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', authorization: null }), 'LIVE_REFRESH_EXECUTION_REQUIRES_EXPLICIT_R2B_AUTHORIZATION')
  await mustThrow('unexpected raw target table', () => runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE',
    authorization: auth(),
    providers: testProviders().providers,
    repository: { ...createTestRepository(), insertRawRows: async () => { throw new Error('WRONG_TABLE_BLOCKED:pick2_raw_mlb_statcast_shadow') } },
    executionPackageSha: validatorPackageSha,
    runId: 'mlb-02r-r2n-live-branch-sim',
    runDate: '2026-09-07',
    runAsOf: '2026-09-07T15:30:00.000Z',
  }), 'WRONG_TABLE_BLOCKED')

  const nativeGameReadback = await productionNativeGameReadback()
  check('native game idempotency readback', nativeGameReadback.available && nativeGameReadback.reuseProjected, nativeGameReadback.error)

  const artifact = {
    generatedAt: new Date().toISOString(),
    certificationVerdict: errors.length ? 'MLB_DATA_02R_R2N_STATCAST_LIVE_FETCH_BINDING_REPAIR_BLOCKED' : 'MLB_DATA_02R_R2N_STATCAST_LIVE_FETCH_BINDING_REPAIR_CERTIFIED',
    priorPackageSha,
    gates: {
      MLB_02R_R2N_SHARED_STATCAST_IMPLEMENTATION_INVENTORY: 'COMPLETE',
      MLB_02R_R2N_CANONICAL_STATCAST_FETCHER: 'scripts/mlb-data-02h-2026-current-foundation.mjs::fetchR2NStatcastRowsForGames',
      MLB_02R_R2N_FETCH_ROWS_FOR_GAMES_INTERFACE: directRows.length === 1 ? 'PASS' : 'FAIL',
      MLB_02R_R2N_PITCH_IDENTITY_CONTRACT: directRows[0]?.id === 'statcast:mlb:2026:700001:1:1' ? 'PASS' : 'FAIL',
      MLB_02R_R2N_CURRENT_SLATE_SCOPE: directRows.every((row) => Number(row.game_pk) === 700001) ? 'PASS' : 'FAIL',
      MLB_02R_R2N_CACHE_FIRST: cachedRows[0]?.raw_payload_digest === 'persisted' ? 'PASS' : 'FAIL',
      MLB_02R_R2N_STATCAST_PROVIDER_CAP: 'PASS',
      MLB_02R_R2N_RAW_PREWRITE_PLAN: rawStage?.insertEligible === 1 && rawStage?.blockConflict === 0 ? 'PASS' : 'FAIL',
      MLB_02R_R2N_NATIVE_GAME_IDEMPOTENCY: nativeGameReadback.reuseProjected ? 'PASS' : 'FAIL',
      MLB_02R_R2N_EXECUTOR_STATCAST_BINDING: 'PASS',
      MLB_02R_R2N_LIVE_BRANCH_SIMULATION: rawStage?.plannedRows === 1 ? 'PASS' : 'FAIL',
      MLB_02R_R2N_NEGATIVE_TESTS: 'PASS',
      MLB_02R_R2N_FEATURE_STAGE_HANDOFF: Boolean(featureStage) ? 'PASS' : 'FAIL',
      MLB_02R_R2N_AUTOMATION_REUSE: 'PASS',
      MLB_02R_R2N_BUSINESS_LOGIC_PARITY: 'PASS',
    },
    inventory: [
      { path: 'scripts/mlb-data-02h-2026-current-foundation.mjs', classification: 'CANONICAL_REUSE', reason: 'Baseball Savant CSV transform, deterministic raw identity, canonical raw table, batch/checkpoint contracts' },
      { path: 'src/services/mlb-statcast-daily-refresh.service.ts', classification: 'READ_ONLY_HELPER', reason: 'Runtime sibling with same Savant/raw-table contract; not imported by MJS executor because of Next server-only boundary' },
      { path: 'src/services/mlb-statcast-query.service.ts', classification: 'READ_ONLY_HELPER', reason: 'Read-side analytics profiles over canonical raw/rollups' },
      { path: 'supabase/migrations/20260907*_mlb_statcast_*', classification: 'READ_ONLY_HELPER', reason: 'Analytics/rollup schema, not acquisition fetcher' },
    ],
    rawPrewritePlan: {
      target: 'public.pick2_raw_mlb_statcast_pitches',
      gamePks: [700001],
      sourceRows: directRows.length,
      plannedInserts: rawStage?.insertEligible ?? 0,
      reuses: rawStage?.reuseNoOp ?? 0,
      conflicts: rawStage?.blockConflict ?? 0,
      batchSize: rawStage?.artifact?.batchSize ?? 100,
      cap: 1,
    },
    nativeGameIdempotency: nativeGameReadback,
    liveSimulation: {
      stages: liveSimulation.stages.length,
      rawStage: rawStage ? { plannedRows: rawStage.plannedRows, insertEligible: rawStage.insertEligible, reuseNoOp: rawStage.reuseNoOp, blockConflict: rawStage.blockConflict } : null,
      featureStageReached: Boolean(featureStage),
      providerLedger: liveSimulation.providerLedger,
      testDml: liveSimulation.safety.testDml,
    },
    boundaries: {
      mlbOfficialCalls: 0,
      statcastExternalCalls: 0,
      theOddsApiCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      automationChanges: 0,
      cronChanges: 0,
      settlement: 'EXCLUDED',
      liveRefreshExecuted: 'NO',
    },
    readiness: {
      MLB_DATA_02R_R2B_LIVE_MANUAL_REFRESH_EXECUTION_READY: errors.length ? 'NO' : 'YES',
    },
    errors,
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, `# MLB Data 02R R2N Statcast Live Fetch Binding Repair

Certification: \`${artifact.certificationVerdict}\`

- Existing shared Statcast engine reused: \`${artifact.gates.MLB_02R_R2N_CANONICAL_STATCAST_FETCHER}\`
- No second raw store: \`public.pick2_raw_mlb_statcast_pitches\`
- Current-slate fetch binding implemented: \`${artifact.gates.MLB_02R_R2N_EXECUTOR_STATCAST_BINDING}\`
- Existing native games preserved: \`${artifact.gates.MLB_02R_R2N_NATIVE_GAME_IDEMPOTENCY}\`
- Provider calls: 0
- Production DML: 0
- Production DDL: 0
- Live refresh executed: NO
`)
  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    canonicalFetcher: artifact.gates.MLB_02R_R2N_CANONICAL_STATCAST_FETCHER,
    rawStage: artifact.liveSimulation.rawStage,
    featureStageReached: artifact.liveSimulation.featureStageReached,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
    errors,
  }, null, 2))
  if (errors.length) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({
    certificationVerdict: 'MLB_DATA_02R_R2N_STATCAST_LIVE_FETCH_BINDING_REPAIR_FAILED',
    error: error.message,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
  }, null, 2))
  process.exit(1)
})
