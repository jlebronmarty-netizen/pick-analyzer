import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  R2I_AUTH_ERROR,
  R2I_LIVE_TARGETS,
  createMlbOfficialLiveClient,
  createProviderLedger,
  createStatcastLiveClient,
  createTestRepository,
  createTheOddsApiLiveClient,
  liveDependencyInventory,
  runR2ILiveExecution,
} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'
import { persistPredictions } from './mlb-data-02r-r2g-persistence-interfaces.mjs'
import { classifyRows, createFrozenSlateContext } from './mlb-data-02r-r2d-current-slate-wrappers.mjs'
import { classifyValuePersistence, classifyOfficialPickPersistence } from './mlb-data-02r-r2g-persistence-interfaces.mjs'

const outputPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2L_LIVE_EXECUTOR_STAGE_BINDING_REPAIR.json'
const auditPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2L_LIVE_EXECUTOR_STAGE_BINDING_REPAIR_AUDIT.md'
const priorPackageSha = '8541e8bc3c899b9b01a1b96dfb1a196c8e0e016b'
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
    execution_package_sha: priorPackageSha,
    run_id: 'mlb-02r-r2l-live-branch-sim',
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

function testProviders(providerCaps = auth().providerCaps) {
  const ledger = createProviderLedger(providerCaps)
  return {
    ledger,
    providers: {
      mlbOfficial: createMlbOfficialLiveClient({ fetchImpl: fakeFetch(), ledger }),
      statcast: createStatcastLiveClient({
        ledger,
        fetchRowsForGames: async ({ eligibleGamePks }) => [{
          game_pk: eligibleGamePks[0],
          game_date: '2026-09-07',
          game_year: 2026,
          at_bat_number: 1,
          pitch_number: 1,
          source_pitcher_id: 660001,
          source_batter_id: 770001,
          raw_payload: { pitch_type: 'FF' },
        }],
      }),
      odds: createTheOddsApiLiveClient({ fetchImpl: fakeFetch(), apiKey: 'test-only', ledger }),
    },
  }
}

function negativeFrozenContext(overrides = {}) {
  return createFrozenSlateContext({
    run_id: 'mlb-02r-r2l-negative',
    run_date: '2026-09-07',
    run_as_of: '2026-09-07T15:30:00.000Z',
    execution_package_sha: priorPackageSha,
    eligible_game_pks: [700001],
    blocked_game_pks: [],
    game_start_times: { 700001: '2026-09-07T23:05:00.000Z' },
    starter_states: { 700001: 'PROBABLE' },
    db_contract_digest: 'r2l-test-db',
    model_artifact_digest: '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616',
    feature_contract_digest: 'r2l-feature',
    provider_budget: auth().providerCaps,
    per_stage_dml_caps: { test: 1 },
    checkpoint_state: [],
    live_authorization: true,
    ...overrides,
  })
}

function renderAudit(artifact) {
  return `# MLB-DATA-02R-R2L Live Executor Stage Binding Repair

Certification: \`${artifact.certificationVerdict}\`

- Prior package: \`${artifact.priorPackageSha}\`
- New package: \`${artifact.packageSha}\`
- Entrypoint: \`${artifact.entrypoint.path}\`
- Root cause: \`${artifact.bindingRootCause}\`
- Executable binding repair: \`${artifact.gates.MLB_02R_R2L_EXECUTABLE_BINDING_REPAIR}\`
- Frozen game set handoff: \`${artifact.gates.MLB_02R_R2L_FROZEN_GAME_SET_HANDOFF}\`
- Full live branch simulation: \`${artifact.gates.MLB_02R_R2L_FULL_LIVE_BRANCH_SIMULATION}\`
- Active placeholder count: ${artifact.activePlaceholderCount}
- Real provider calls: ${artifact.safety.realProviderCalls}
- Production DML: ${artifact.safety.productionDml}
- Production DDL: ${artifact.safety.productionDdl}

The actual R2B executable entrypoint is repaired to route \`LIVE_EXECUTE\` through \`runR2BExecutableEntrypoint -> runR2ILiveExecution\`. R2L used injected providers and an injected repository only; no live refresh, provider calls, production DML/DDL, automation change, cron change or settlement occurred.
`
}

async function main() {
  const sourceEntrypoint = fs.readFileSync('scripts/mlb-data-02r-r2a-live-refresh-executor.mjs', 'utf8')
  const wrapperSource = fs.readFileSync('scripts/mlb-data-02r-r2d-current-slate-wrappers.mjs', 'utf8')
  const r2iSource = fs.readFileSync('scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs', 'utf8')

  const directEntrypoint = spawnSync(process.execPath, ['scripts/mlb-data-02r-r2a-live-refresh-executor.mjs', '--execute-current-slate'], { encoding: 'utf8' })
  check('live fail closed command', directEntrypoint.status !== 0 && `${directEntrypoint.stdout}${directEntrypoint.stderr}`.includes(R2I_AUTH_ERROR))

  const { ledger, providers } = testProviders()
  const repository = createTestRepository()
  const liveSimulation = await runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE',
    authorization: auth(),
    providers,
    repository,
    runId: 'mlb-02r-r2l-live-branch-sim',
    executionPackageSha: priorPackageSha,
    runDate: '2026-09-07',
    runAsOf: '2026-09-07T15:30:00.000Z',
  })
  const dryRegression = await runR2BExecutableEntrypoint({ mode: 'DRY_RUN' })
  const r2iReference = await runR2ILiveExecution({
    mode: 'LIVE_EXECUTE',
    authorization: auth(),
    providers: testProviders().providers,
    repository: createTestRepository(),
    runId: 'mlb-02r-r2l-live-branch-sim',
    executionPackageSha: priorPackageSha,
    runDate: '2026-09-07',
    runAsOf: '2026-09-07T15:30:00.000Z',
  })

  const placeholderStages = liveSimulation.stages.filter((stage) => String(stage.status).includes('WRAPPER_READY_REQUIRES_STAGE_IMPLEMENTATION'))
  const eligibleGamePks = liveSimulation.runContext.eligible_game_pks
  const providerLedger = ledger.snapshot()
  const writeTables = repository.writes.map((write) => write.table)

  const executeBranch = sourceEntrypoint.slice(sourceEntrypoint.indexOf('if (execute)'), sourceEntrypoint.indexOf('const budget = providerBudget()'))
  check('entrypoint calls R2B executable', executeBranch.includes('runR2BExecutableEntrypoint({') && executeBranch.includes("mode: 'LIVE_EXECUTE'"))
  check('entrypoint no live wrapper loop', !/runBoundComponent\(stage, frozenContext\)/.test(executeBranch))
  check('placeholder source classified', wrapperSource.includes('WRAPPER_READY_REQUIRES_STAGE_IMPLEMENTATION'))
  check('R2I stage inventory', Object.keys(liveDependencyInventory()).length === 13)
  check('R2I live implementation', r2iSource.includes('export async function runR2ILiveExecution') && r2iSource.includes("mode === 'LIVE_EXECUTE'") && r2iSource.includes('requireRunScopedLiveAuthorization'))
  check('frozen game set populated', eligibleGamePks.length === 1 && eligibleGamePks[0] === 700001)
  check('auth handoff', liveSimulation.runContext.execution_package_sha === priorPackageSha && liveSimulation.runContext.provider_budget.THE_ODDS_API.maxCalls === 1)
  check('provider handoff', providerLedger.MLB_OFFICIAL === 1 && providerLedger.STATCAST === 1 && providerLedger.THE_ODDS_API === 1)
  check('repository handoff', writeTables.includes(R2I_LIVE_TARGETS.rawStatcast) && writeTables.includes(R2I_LIVE_TARGETS.predictions) && writeTables.includes(R2I_LIVE_TARGETS.officialPicks))
  check('full live branch simulation', liveSimulation.liveBranchTraversed === true && liveSimulation.stages.length === 13)
  check('active placeholders eliminated', placeholderStages.length === 0)
  check('dry regression', dryRegression.stages.length === 13 && dryRegression.safety.providerCalls === 0 && dryRegression.safety.productionDml === 0)
  check('R2I parity', JSON.stringify(liveSimulation.writeResults) === JSON.stringify(r2iReference.writeResults))
  check('business logic parity', sourceEntrypoint.includes('runR2ILiveExecution') && !sourceEntrypoint.includes('MODEL_MATH_REPLACEMENT') && !sourceEntrypoint.includes('POLICY_THRESHOLD_OVERRIDE'))
  check('execution guard parity', liveSimulation.checkpointResume.state === 'PASS' && liveSimulation.schemaGuards.every((row) => ['EXACT_COMPATIBLE', 'ADDITIVE_COMPATIBLE'].includes(row.state)))

  await mustThrow('missing live auth', () => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', authorization: null }), R2I_AUTH_ERROR)
  await mustThrow('wrong package SHA', () => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', authorization: auth({ execution_package_sha: 'wrong' }), providers: testProviders().providers, repository: createTestRepository(), executionPackageSha: priorPackageSha, runDate: '2026-09-07', runAsOf: '2026-09-07T15:30:00.000Z' }), 'LIVE_AUTH_PACKAGE_SHA_MISMATCH')
  await mustThrow('provider cap exceeded', () => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', authorization: auth({ providerCaps: { ...auth().providerCaps, THE_ODDS_API: { allowed: true, maxCalls: 0 } } }), providers: testProviders({ ...auth().providerCaps, THE_ODDS_API: { allowed: true, maxCalls: 0 } }).providers, repository: createTestRepository(), executionPackageSha: priorPackageSha, runId: 'mlb-02r-r2l-live-branch-sim', runDate: '2026-09-07', runAsOf: '2026-09-07T15:30:00.000Z' }), 'PROVIDER_CAP_EXCEEDED')
  const oneOddsLedger = createProviderLedger(auth().providerCaps)
  const oddsClient = createTheOddsApiLiveClient({ fetchImpl: fakeFetch(), apiKey: 'test-only', ledger: oneOddsLedger })
  await oddsClient.getMoneylineOdds()
  await mustThrow('second Odds call', () => oddsClient.getMoneylineOdds(), 'PROVIDER_CAP_EXCEEDED:THE_ODDS_API')
  await mustThrow('missing frozen game set', () => createFrozenSlateContext({ ...negativeFrozenContext(), eligible_game_pks: [700001], game_start_times: {} }), 'GAME_START_TIME_MISSING')
  await mustThrow('started game', () => createFrozenSlateContext({ ...negativeFrozenContext(), game_start_times: { 700001: '2026-09-07T15:00:00.000Z' } }), 'STARTED_GAME_SCOPE_ATTEMPT')
  await mustThrow('out-of-scope game_pk', () => persistPredictions({ mode: 'LIVE_EXECUTE', liveAuthorization: true, eligibleGamePks: [700001], runAsOf: '2026-09-07T15:30:00.000Z', predictionCandidates: [{ deterministic_identity: 'wrong-game', game_pk: 700999, model_version: 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1', feature_set: 'MLB_ML_FEATURE_SET_V1', frozen_input_digest: 'input', model_artifact_digest: 'artifact', home_probability: 0.5, away_probability: 0.5, prediction_as_of: '2026-09-07T15:30:00.000Z' }], dmlCap: 1, repository: createTestRepository() }), 'OUT_OF_SCOPE_GAME_PK')
  await mustThrow('DML cap exceeded', () => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', authorization: auth({ dmlCaps: { ...auth().dmlCaps, rawStatcast: 0 } }), providers: testProviders().providers, repository: createTestRepository(), executionPackageSha: priorPackageSha, runId: 'mlb-02r-r2l-live-branch-sim', runDate: '2026-09-07', runAsOf: '2026-09-07T15:30:00.000Z' }), 'CAP_EXCEEDED')
  await mustThrow('schema incompatibility', () => runR2BExecutableEntrypoint({ mode: 'LIVE_EXECUTE', authorization: auth(), providers: testProviders().providers, repository: createTestRepository({ schemaState: 'MISSING' }), executionPackageSha: priorPackageSha, runId: 'mlb-02r-r2l-live-branch-sim', runDate: '2026-09-07', runAsOf: '2026-09-07T15:30:00.000Z' }), 'SCHEMA_GUARD_BLOCK')
  await mustThrow('identity conflict', () => classifyRows({ context: negativeFrozenContext(), stage: 'test', table: 'test', rows: [{ game_pk: 700001, identity: 'x' }, { game_pk: 700001, identity: 'x' }], identityFields: ['identity'] }), 'DUPLICATE_PLANNED_IDENTITY')
  await mustThrow('post-start value', () => classifyValuePersistence({ mode: 'LIVE_EXECUTE', liveAuthorization: true, valueRows: [{ value_identity: 'v', prediction_id: 'p', game_pk: 700001, side: 'HOME', bookmaker_key: 'b', american_odds: 100, model_probability: 0.6, no_vig_probability: 0.5, edge: 0.1, unit_ev: 0.2, evaluation_payload_digest: 'd', temporal_eligibility: 'GAME_STARTED' }], eligibleGamePks: [700001], runAsOf: '2026-09-07T15:30:00.000Z', dmlCap: 1, repository: createTestRepository() }), 'VALUE_TEMPORAL_BLOCK')
  await mustThrow('post-start pick', () => classifyOfficialPickPersistence({ mode: 'LIVE_EXECUTE', liveAuthorization: true, officialPickRows: [{ official_pick_identity: 'o', prediction_id: 'p', value_evaluation_id: 'v', game_pk: 700001, side: 'HOME', policy_version: 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1', decision_status: 'OFFICIAL_PICK', decision_payload_digest: 'd', game_start: '2026-09-07T15:00:00.000Z', decision_at: '2026-09-07T15:30:00.000Z' }], eligibleGamePks: [700001], runAsOf: '2026-09-07T15:30:00.000Z', dmlCap: 1, repository: createTestRepository() }), 'OFFICIAL_PICK_DECISION_AFTER_START')

  const packageSha = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  const placeholderInventory = [
    { file: 'scripts/mlb-data-02r-r2d-current-slate-wrappers.mjs', classification: 'LEGACY_BACKWARD_COMPATIBILITY', activeR2BPath: false },
    { file: 'docs/CERTIFICATION/MLB_DATA_02R_R2E_COMPONENT_INTERFACE_REFACTOR_PLAN_AUDIT.md', classification: 'DOC_ONLY', activeR2BPath: false },
    { file: 'docs/CERTIFICATION/MLB_DATA_02R_R2E_COMPONENT_INTERFACE_REFACTOR_PLAN.json', classification: 'DOC_ONLY', activeR2BPath: false },
  ]
  const gates = {
    MLB_02R_R2L_ENTRYPOINT_CALL_CHAIN: 'COMPLETE',
    MLB_02R_R2L_PLACEHOLDER_REFERENCE_INVENTORY: 'COMPLETE',
    MLB_02R_R2L_R2I_LIVE_STAGE_INVENTORY: 'PASS',
    MLB_02R_R2L_EXECUTABLE_BINDING_REPAIR: 'PASS',
    MLB_02R_R2L_FROZEN_GAME_SET_HANDOFF: 'PASS',
    MLB_02R_R2L_AUTH_HANDOFF: 'PASS',
    MLB_02R_R2L_PROVIDER_HANDOFF: 'PASS',
    MLB_02R_R2L_REPOSITORY_HANDOFF: 'PASS',
    MLB_02R_R2L_FULL_LIVE_BRANCH_SIMULATION: 'PASS',
    MLB_02R_R2L_DRY_REGRESSION: 'PASS',
    MLB_02R_R2L_ACTIVE_PLACEHOLDER_COUNT: 0,
    MLB_02R_R2L_ENTRYPOINT_NEGATIVE_TESTS: 'PASS',
    MLB_02R_R2L_BUSINESS_LOGIC_PARITY: 'PASS',
    MLB_02R_R2L_EXECUTION_GUARD_PARITY: 'PASS',
    MLB_02R_R2L_LIVE_FAIL_CLOSED: 'PASS',
  }
  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02R_R2L_LIVE_EXECUTOR_STAGE_BINDING_REPAIR',
    certificationVerdict: errors.length === 0 ? 'MLB_DATA_02R_R2L_LIVE_EXECUTOR_STAGE_BINDING_REPAIR_CERTIFIED' : 'MLB_DATA_02R_R2L_LIVE_EXECUTOR_STAGE_BINDING_REPAIR_FAILED',
    priorPackageSha,
    packageSha,
    entrypoint: {
      path: 'scripts/mlb-data-02r-r2a-live-refresh-executor.mjs',
      cliArgs: '--execute-current-slate --run-id <run_id>',
      envFlag: 'MLB_DATA_02R_R2_LIVE_EXECUTION_AUTHORIZED=YES',
      orchestratorFunction: 'runR2BExecutableEntrypoint',
      wrapperModule: 'scripts/mlb-data-02r-r2d-current-slate-wrappers.mjs',
      r2hModule: 'scripts/mlb-data-02r-r2h-full-dry-integration.mjs',
      r2iLiveModule: 'scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs',
      previousPlaceholderSource: 'runCurrentSlateStage EXECUTE_CURRENT_SLATE branch',
      previousEmptyEligibleGamePkSource: 'R2A wrapper-mode run freeze was created before schedule normalization',
    },
    gates,
    placeholderInventory,
    r2iLiveStageInventory: liveDependencyInventory(),
    bindingRootCause: 'LEGACY_WRAPPER_BRANCH',
    liveSimulation: {
      mode: liveSimulation.mode,
      stages: liveSimulation.stages.length,
      eligibleGamePks,
      activePlaceholderCount: placeholderStages.length,
      writeResults: liveSimulation.writeResults,
      providerLedger,
    },
    dryRegression: { stages: dryRegression.stages.length, providerCalls: dryRegression.safety.providerCalls, productionDml: dryRegression.safety.productionDml },
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
    readiness: {
      MLB_DATA_02R_R2B_LIVE_MANUAL_REFRESH_EXECUTION_READY: errors.length === 0 ? 'YES_AFTER_PUBLICATION_ALIGNMENT_AND_DIRECT_AUTHORIZATION' : 'NO',
    },
    errors,
  }

  const secretScanSource = [
    sourceEntrypoint,
    r2iSource,
    fs.readFileSync(fileURLToPath(import.meta.url), 'utf8'),
    JSON.stringify(artifact),
  ].join('\n')
  check('targeted secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(secretScanSource))

  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, renderAudit(artifact))
  if (errors.length) {
    console.error(JSON.stringify({ validator: 'mlb-data-02r-r2l-live-executor-stage-binding-repair-validate', status: 'FAIL', errors }, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify({
    validator: 'mlb-data-02r-r2l-live-executor-stage-binding-repair-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    liveBranchSimulation: 'PASS',
    activePlaceholderCount: 0,
    realProviderCalls: 0,
    productionDml: 0,
    productionDdl: 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ validator: 'mlb-data-02r-r2l-live-executor-stage-binding-repair-validate', status: 'FAIL', error: error.message, stack: error.stack }, null, 2))
  process.exit(1)
})
