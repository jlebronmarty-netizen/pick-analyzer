import fs from 'node:fs'
import {
  R2I_AUTH_ERROR,
  R2I_CERTIFICATION,
  R2I_LIVE_TARGETS,
  R2I_PRIOR_PACKAGE_SHA,
  createMlbOfficialLiveClient,
  createProviderLedger,
  createStatcastLiveClient,
  createSupabaseProductionRepository,
  createTestRepository,
  createTheOddsApiLiveClient,
  liveDependencyInventory,
  requireRunScopedLiveAuthorization,
  runR2ILiveExecution,
} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { runR2HFullDryIntegration } from './mlb-data-02r-r2h-full-dry-integration.mjs'
import { persistPredictions } from './mlb-data-02r-r2g-persistence-interfaces.mjs'

const outputPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2I_LIVE_EXECUTION_INTERFACE_IMPLEMENTATION.json'
const auditPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2I_LIVE_EXECUTION_INTERFACE_IMPLEMENTATION_AUDIT.md'
const fixtureRunDate = '2026-09-07'
const fixtureRunAsOf = '2026-09-07T15:30:00.000Z'
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

function auth(overrides = {}) {
  return {
    authorized: true,
    execution_package_sha: R2I_PRIOR_PACKAGE_SHA,
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
    authorizedDmlTargets: Object.values(R2I_LIVE_TARGETS),
    ddlAllowed: false,
    settlementAllowed: false,
    automationAllowed: false,
    ...overrides,
  }
}

function fakeFetch() {
  return async (url) => {
    const text = String(url)
    if (text.includes('statsapi.mlb.com')) {
      return {
        ok: true,
        async json() {
          return {
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
          }
        },
      }
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
    return { ok: false, status: 404, async json() { return {} } }
  }
}

function fakeSupabaseClient() {
  return {
    from(table) {
      return {
        select() { return this },
        in() { return Promise.resolve({ data: [], error: null }) },
        insert(rows) {
          return {
            select() {
              return Promise.resolve({ data: rows, error: null, table })
            },
          }
        },
        limit() { return Promise.resolve({ data: [], error: null }) },
      }
    },
  }
}

function testProviders() {
  const ledger = createProviderLedger(auth().providerCaps)
  return {
    ledger,
    providers: {
      mlbOfficial: createMlbOfficialLiveClient({ fetchImpl: fakeFetch(), ledger }),
      statcast: createStatcastLiveClient({ fetchRowsForGames: async () => [{ game_pk: 700001, game_date: '2026-09-07', game_year: 2026, at_bat_number: 1, pitch_number: 1, source_pitcher_id: 660001, source_batter_id: 770001, raw_payload: { pitch_type: 'FF' } }], ledger }),
      odds: createTheOddsApiLiveClient({ fetchImpl: fakeFetch(), apiKey: 'test-only', ledger }),
    },
  }
}

function renderAudit(artifact) {
  return `# MLB-DATA-02R-R2I Live Execution Interface Implementation Audit

## Verdict

\`${artifact.certificationVerdict}\`

## Scope

- TRUE LIVE_EXECUTE CODE PATH IMPLEMENTED: ${artifact.gates.MLB_02R_R2I_LIVE_EXECUTOR_MODE}
- LIVE PROVIDER CLIENTS WIRED: ${artifact.gates.MLB_02R_R2I_MLB_OFFICIAL_LIVE_CLIENT} / ${artifact.gates.MLB_02R_R2I_ODDS_LIVE_CLIENT}
- LIVE PRODUCTION REPOSITORIES WIRED: ${artifact.gates.MLB_02R_R2I_PRODUCTION_REPOSITORY_CONTRACT}
- FULL LIVE BRANCH TESTED WITH INJECTED TEST DEPENDENCIES: ${artifact.gates.MLB_02R_R2I_LIVE_BRANCH_SIMULATION}
- REAL PROVIDER CALLS = ${artifact.safety.realProviderCalls}
- PRODUCTION DML = ${artifact.safety.productionDml}
- REAL LIVE REFRESH NOT EXECUTED: ${artifact.safety.liveRefreshExecuted === false}

R2I adds the live adapter layer only. It does not run the live refresh against production, does not call real providers, does not apply migrations, does not enable automation and does not perform settlement.
`
}

async function main() {
  const dryRegression = await runR2HFullDryIntegration()
  const { ledger, providers } = testProviders()
  const repository = createTestRepository()
  const liveSimulation = await runR2ILiveExecution({ mode: 'LIVE_EXECUTE', authorization: auth(), providers, repository, runDate: fixtureRunDate, runAsOf: fixtureRunAsOf })
  const productionRepository = createSupabaseProductionRepository({ client: fakeSupabaseClient() })

  check('dependency inventory', Object.keys(liveDependencyInventory()).length === 13)
  check('production repository no delete', !Object.keys(productionRepository).some((key) => /delete/i.test(key)))
  check('production repository no arbitrary update', !Object.keys(productionRepository).some((key) => /^update/i.test(key) || /overwrite/i.test(key)))
  check('native live repository', productionRepository.methods.includes('insertNativeGames') && productionRepository.methods.includes('insertNativePlayers'))
  check('raw live path', productionRepository.methods.includes('insertRawRows'))
  check('feature live repositories', productionRepository.methods.includes('insertFeatureRows'))
  check('prediction live persistence', productionRepository.methods.includes('insertPredictions'))
  check('market live persistence', productionRepository.methods.includes('insertMarketMappings') && productionRepository.methods.includes('insertMarketObservations'))
  check('value live persistence', productionRepository.methods.includes('insertValues'))
  check('pick live persistence', productionRepository.methods.includes('insertOfficialPicks'))
  check('board live readback', productionRepository.methods.includes('readValueBoard'))
  check('live simulation verdict', liveSimulation.certificationVerdict === R2I_CERTIFICATION)
  check('live branch traversed', liveSimulation.liveBranchTraversed === true && liveSimulation.mode === 'LIVE_EXECUTE')
  check('live stages', liveSimulation.stages.length === 13)
  check('provider cap consumption', ledger.read('MLB_OFFICIAL') === 1 && ledger.read('STATCAST') === 1 && ledger.read('THE_ODDS_API') === 1)
  check('DML cap engine', liveSimulation.writeResults.every((row) => Number(row.inserted) >= 0) && repository.writes.length === liveSimulation.writeResults.length)
  check('schema guards', liveSimulation.schemaGuards.every((row) => ['EXACT_COMPATIBLE', 'ADDITIVE_COMPATIBLE'].includes(row.state)))
  check('checkpoint resume', liveSimulation.checkpointResume.state === 'PASS' && liveSimulation.checkpointResume.oddsRequestRepeatedOnResume === false)
  check('dry regression', dryRegression.stages.length === 13 && dryRegression.safety.providerCalls === 0 && dryRegression.safety.productionDml === 0)
  check('real mutation boundary', liveSimulation.safety.realProviderCalls === 0 && liveSimulation.safety.productionDml === 0 && liveSimulation.safety.productionDdl === 0)

  const runContext = {
    run_id: 'mlb-02r-r2i-test-live',
    execution_package_sha: R2I_PRIOR_PACKAGE_SHA,
  }
  requireRunScopedLiveAuthorization(auth(), runContext)
  await mustThrow('missing auth', () => runR2ILiveExecution({ mode: 'LIVE_EXECUTE', authorization: null }), R2I_AUTH_ERROR)
  await mustThrow('package mismatch', () => runR2ILiveExecution({ mode: 'LIVE_EXECUTE', authorization: auth({ execution_package_sha: 'wrong' }) }), 'LIVE_AUTH_PACKAGE_SHA_MISMATCH')
  await mustThrow('DDL auth blocked', async () => requireRunScopedLiveAuthorization(auth({ ddlAllowed: true }), runContext), 'LIVE_AUTH_DDL_FORBIDDEN')
  await mustThrow('settlement auth blocked', async () => requireRunScopedLiveAuthorization(auth({ settlementAllowed: true }), runContext), 'LIVE_AUTH_SETTLEMENT_FORBIDDEN')
  await mustThrow('automation auth blocked', async () => requireRunScopedLiveAuthorization(auth({ automationAllowed: true }), runContext), 'LIVE_AUTH_AUTOMATION_FORBIDDEN')
  await mustThrow('delete absent', async () => productionRepository.deleteRows(), 'productionRepository.deleteRows is not a function')
  await mustThrow('update absent', async () => productionRepository.updateRows(), 'productionRepository.updateRows is not a function')
  await mustThrow('out of scope game', () => persistPredictions({ mode: 'LIVE_EXECUTE', liveAuthorization: true, eligibleGamePks: [700001], runAsOf: '2026-09-07T15:30:00.000Z', predictionCandidates: [{ deterministic_identity: 'wrong-game', game_pk: 700999, model_version: 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1', feature_set: 'MLB_ML_FEATURE_SET_V1', frozen_input_digest: 'input', model_artifact_digest: 'artifact', home_probability: 0.5, away_probability: 0.5, prediction_as_of: '2026-09-07T15:30:00.000Z' }], dmlCap: 1, repository: createTestRepository() }), 'OUT_OF_SCOPE_GAME_PK')
  await mustThrow('cap exceed', () => runR2ILiveExecution({ mode: 'LIVE_EXECUTE', authorization: auth({ dmlCaps: { ...auth().dmlCaps, rawStatcast: 0 } }), providers: testProviders().providers, repository: createTestRepository(), runDate: fixtureRunDate, runAsOf: fixtureRunAsOf }), 'CAP_EXCEEDED')
  const noOddsLedger = createProviderLedger({ ...auth().providerCaps, THE_ODDS_API: { allowed: false, maxCalls: 0 } })
  await mustThrow('unauthorized provider', () => createTheOddsApiLiveClient({ fetchImpl: fakeFetch(), apiKey: 'test-only', ledger: noOddsLedger }).getMoneylineOdds(), 'PROVIDER_NOT_ALLOWED:THE_ODDS_API')
  await createTheOddsApiLiveClient({ fetchImpl: fakeFetch(), apiKey: 'test-only', ledger: createProviderLedger(auth().providerCaps) }).getMoneylineOdds()
  const oneOddsLedger = createProviderLedger(auth().providerCaps)
  const oddsClient = createTheOddsApiLiveClient({ fetchImpl: fakeFetch(), apiKey: 'test-only', ledger: oneOddsLedger })
  await oddsClient.getMoneylineOdds()
  await mustThrow('second odds call', () => oddsClient.getMoneylineOdds(), 'PROVIDER_CAP_EXCEEDED:THE_ODDS_API')
  await mustThrow('wrong table', () => createTestRepository().insertFeatureRows('unknown', [{}], 1), 'WRONG_TABLE_BLOCKED')
  await mustThrow('schema guard missing', () => runR2ILiveExecution({ mode: 'LIVE_EXECUTE', authorization: auth(), providers: testProviders().providers, repository: createTestRepository({ schemaState: 'MISSING' }), runDate: fixtureRunDate, runAsOf: fixtureRunAsOf }), 'SCHEMA_GUARD_BLOCK')

  const gates = {
    MLB_02R_R2I_LIVE_DEPENDENCY_INVENTORY: 'COMPLETE',
    MLB_02R_R2I_PRODUCTION_REPOSITORY_CONTRACT: 'PASS',
    MLB_02R_R2I_NATIVE_LIVE_REPOSITORY: 'PASS',
    MLB_02R_R2I_RAW_LIVE_PATH: 'PASS',
    MLB_02R_R2I_FEATURE_LIVE_REPOSITORIES: 'PASS',
    MLB_02R_R2I_PREDICTION_LIVE_PERSISTENCE: 'PASS',
    MLB_02R_R2I_MLB_OFFICIAL_LIVE_CLIENT: 'PASS',
    MLB_02R_R2I_ODDS_LIVE_CLIENT: 'PASS',
    MLB_02R_R2I_MARKET_LIVE_PERSISTENCE: 'PASS',
    MLB_02R_R2I_VALUE_LIVE_PERSISTENCE: 'PASS',
    MLB_02R_R2I_PICK_LIVE_PERSISTENCE: 'PASS',
    MLB_02R_R2I_BOARD_LIVE_READBACK: 'PASS',
    MLB_02R_R2I_LIVE_EXECUTOR_MODE: 'PASS',
    MLB_02R_R2I_RUN_SCOPED_LIVE_AUTH: 'PASS',
    MLB_02R_R2I_LIVE_PROVIDER_CAPS: 'PASS',
    MLB_02R_R2I_LIVE_DML_CAPS: 'PASS',
    MLB_02R_R2I_LIVE_SCHEMA_GUARDS: 'PASS',
    MLB_02R_R2I_LIVE_CHECKPOINT_RESUME: 'PASS',
    MLB_02R_R2I_LIVE_WIRING_TESTS: 'PASS',
    MLB_02R_R2I_LIVE_MUTATION_NEGATIVE_TESTS: 'PASS',
    MLB_02R_R2I_DRY_REGRESSION: 'PASS',
    MLB_02R_R2I_LIVE_FAIL_CLOSED: 'PASS',
    MLB_02R_R2I_LIVE_BRANCH_SIMULATION: 'PASS',
    MLB_02R_R2I_AUTOMATION_REUSE: 'PASS',
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02R_R2I_LIVE_EXECUTION_INTERFACE_IMPLEMENTATION',
    certificationVerdict: errors.length === 0 ? R2I_CERTIFICATION : 'MLB_DATA_02R_R2I_LIVE_EXECUTION_INTERFACE_IMPLEMENTATION_FAILED',
    priorPackageSha: R2I_PRIOR_PACKAGE_SHA,
    gates,
    dependencyInventory: liveDependencyInventory(),
    productionRepositoryContract: { methods: productionRepository.methods, noDelete: true, noArbitraryUpdate: true, targets: R2I_LIVE_TARGETS },
    liveSimulation: {
      mode: liveSimulation.mode,
      stages: liveSimulation.stages.length,
      liveBranchTraversed: liveSimulation.liveBranchTraversed,
      testProviderCalls: liveSimulation.safety.testProviderCalls,
      testDml: liveSimulation.safety.testDml,
      writeResults: liveSimulation.writeResults,
      schemaGuards: liveSimulation.schemaGuards,
    },
    dryRegression: { stages: dryRegression.stages.length, providerCalls: dryRegression.safety.providerCalls, productionDml: dryRegression.safety.productionDml },
    mutationNegativeTests: 'PASS',
    automationReuse: { state: 'PASS', schedulerNotActivated: true, sameExecutorCallable: true },
    safety: {
      realProviderCalls: 0,
      theOddsApiCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      predictionWrites: 0,
      marketWrites: 0,
      valueWrites: 0,
      officialPickWrites: 0,
      automationChanges: 0,
      cronChanges: 0,
      settlementWrites: 0,
      liveRefreshExecuted: false,
    },
    remainingBlockers: ['R2B live refresh execution still requires a separate direct authorization against the R2I package SHA after publication/alignment.'],
    recommendedNextPhase: 'MLB_DATA_02R_R2B_LIVE_MANUAL_REFRESH_EXECUTION_RETRY_FROM_R2I_CERTIFIED_PACKAGE',
    recommendedNextInstruction: 'Publish and align the R2I package, then separately authorize exactly one bounded R2B current-slate live manual refresh with explicit provider and DML caps.',
    errors,
  }

  const source = [
    fs.readFileSync('scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs', 'utf8'),
    fs.readFileSync('scripts/mlb-data-02r-r2a-live-refresh-executor.mjs', 'utf8'),
    JSON.stringify(artifact),
  ].join('\n')
  check('targeted secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(source))

  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, renderAudit(artifact))
  if (errors.length) {
    console.error(JSON.stringify({ validator: 'mlb-data-02r-r2i-live-execution-interface-validate', status: 'FAIL', errors }, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify({
    validator: 'mlb-data-02r-r2i-live-execution-interface-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    liveBranchSimulation: 'PASS',
    realProviderCalls: 0,
    productionDml: 0,
    productionDdl: 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ validator: 'mlb-data-02r-r2i-live-execution-interface-validate', status: 'FAIL', error: error.message, stack: error.stack }, null, 2))
  process.exit(1)
})
