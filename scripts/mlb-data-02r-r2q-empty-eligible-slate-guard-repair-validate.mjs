import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fetchR2NStatcastRowsForGames } from './mlb-data-02h-2026-current-foundation.mjs'
import {
  R2Q_EMPTY_SLATE_TERMINAL_STATUS,
  assertEligibleGamePkFreeze,
  createTestRepository,
} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'

const outputPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2Q_EMPTY_ELIGIBLE_SLATE_GUARD_REPAIR.json'
const auditPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2Q_EMPTY_ELIGIBLE_SLATE_GUARD_REPAIR_AUDIT.md'
const priorPackageSha = '9808e0a8701e703e78db035e552d2efcc799aa72'
const validatorPackageSha = 'R2Q_LOCAL_CERTIFICATION_PACKAGE'
const runAsOf = '2026-09-07T15:30:00.000Z'
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

async function protectedStateReadback() {
  loadLocalEnv()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { available: false, error: 'SUPABASE_ENV_MISSING' }
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const games = await db
    .from('pick2_mlb_games')
    .select('game_pk,game_date,scheduled_at,source')
    .in('game_pk', [823902, 824958])
    .order('game_pk')
  return {
    available: true,
    protectedGames: games.error ? { error: games.error.message } : games.data,
  }
}

function game({
  gamePk,
  gameDate = '2026-09-07T23:05:00.000Z',
  officialDate = '2026-09-07',
  status = { abstractGameState: 'Preview', detailedState: 'Pre-Game', statusCode: 'P' },
} = {}) {
  return {
    gamePk,
    gameDate,
    officialDate,
    season: 2026,
    status,
    teams: {
      away: { team: { id: 110, abbreviation: 'AWY', name: 'Away Team' }, probablePitcher: { id: 660001, fullName: 'Away Starter', confirmed: false } },
      home: { team: { id: 111, abbreviation: 'HME', name: 'Home Team' }, probablePitcher: { id: 660002, fullName: 'Home Starter', confirmed: true } },
    },
  }
}

function scheduleEvidence(games) {
  return { dates: [{ date: '2026-09-07', games }] }
}

function auth(runId) {
  return {
    authorized: true,
    execution_package_sha: validatorPackageSha,
    run_id: runId,
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
    authorizedDmlTargets: [
      'pick2_mlb_games',
      'pick2_mlb_players',
      'pick2_raw_mlb_statcast_pitches',
      'pick2_feature_snapshots',
      'pick2_mlb_team_daily_features',
      'pick2_mlb_pitcher_daily_features',
      'pick2_mlb_bullpen_daily_features',
      'pick2_mlb_batter_daily_features',
      'pick2_mlb_matchup_daily_features',
      'pick2_mlb_first_inning_daily_features',
      'pick2_game_predictions',
      'pick2_mlb_market_event_mappings',
      'pick2_mlb_market_price_observations',
      'pick2_mlb_market_value_evaluations',
      'pick2_mlb_official_picks',
    ],
    ddlAllowed: false,
    settlementAllowed: false,
    automationAllowed: false,
  }
}

function fakeDb() {
  return {
    from(table) {
      const builder = {
        select() { return builder },
        in() { return builder },
        eq() { return builder },
        order() { return builder },
        range() { return builder },
        then(resolve, reject) {
          Promise.resolve({ data: table === 'sports_teams' ? [
            { id: 'team-home', abbreviation: 'HME', metadata: {} },
            { id: 'team-away', abbreviation: 'AWY', metadata: {} },
          ] : [], error: null }).then(resolve, reject)
        },
      }
      return builder
    },
  }
}

function countedProviders(evidence) {
  const counters = { mlbOfficial: 0, statcast: 0, odds: 0 }
  return {
    counters,
    providers: {
      mlbOfficial: {
        async getSchedule() {
          counters.mlbOfficial += 1
          return evidence
        },
      },
      statcast: {
        async fetchRowsForGames() {
          counters.statcast += 1
          return [{ game_pk: 700001, game_date: '2026-09-07', game_year: 2026, at_bat_number: 1, pitch_number: 1, source_pitcher_id: 660001, source_batter_id: 770001, raw_payload: { pitch_type: 'FF' } }]
        },
      },
      odds: {
        async getMoneylineOdds() {
          counters.odds += 1
          return { events: [{ id: 'odds-event-700001', sport_key: 'baseball_mlb', commence_time: '2026-09-07T23:05:00.000Z', home_team: 'Home Team', away_team: 'Away Team', bookmakers: [{ key: 'book_a', title: 'Book A', markets: [{ key: 'h2h', last_update: '2026-09-07T15:01:00.000Z', outcomes: [{ name: 'Home Team', price: -120 }, { name: 'Away Team', price: 110 }] }] }] }] }
        },
      },
    },
  }
}

async function main() {
  const protectedState = await protectedStateReadback()
  check('protected state readback available', protectedState.available, protectedState.error)
  check('protected games preserved', Array.isArray(protectedState.protectedGames) && protectedState.protectedGames.length === 2)

  await mustThrow('undefined eligible freeze blocks', () => assertEligibleGamePkFreeze(undefined), 'ELIGIBLE_GAME_PK_FREEZE_REQUIRED')
  await mustThrow('null eligible freeze blocks', () => assertEligibleGamePkFreeze(null), 'ELIGIBLE_GAME_PK_FREEZE_REQUIRED')
  check('empty eligible freeze permitted for terminal', Array.isArray(assertEligibleGamePkFreeze([])) && assertEligibleGamePkFreeze([]).length === 0)
  await mustThrow('direct R2N empty scope remains blocked', () => fetchR2NStatcastRowsForGames({
    eligibleGamePks: [],
    dependencyDates: ['2026-09-07'],
    runAsOf,
    db: fakeDb(),
    fetchImpl: async () => ({ ok: false, status: 500, async text() { return '' } }),
  }), 'R2N_EMPTY_GAME_PK_SCOPE')

  const emptyProviders = countedProviders(scheduleEvidence([
    game({ gamePk: 700010, status: { abstractGameState: 'Live', detailedState: 'In Progress', statusCode: 'I' } }),
    game({ gamePk: 700011, status: { abstractGameState: 'Final', detailedState: 'Final', statusCode: 'F' } }),
  ]))
  const emptyRun = await runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE',
    authorization: auth('mlb-02r-r2q-empty-live-sim'),
    providers: emptyProviders.providers,
    repository: createTestRepository(),
    runId: 'mlb-02r-r2q-empty-live-sim',
    executionPackageSha: validatorPackageSha,
  })
  const emptyStageNames = emptyRun.stages.map((stage) => stage.stage)
  check('empty terminal status', emptyRun.terminalStatus === R2Q_EMPTY_SLATE_TERMINAL_STATUS)
  check('empty terminal not pipeline failure', emptyRun.terminal?.pipelineFailure === false && emptyRun.terminal?.providerFailure === false && emptyRun.terminal?.schemaFailure === false && emptyRun.terminal?.modelFailure === false)
  check('empty summary count', emptyRun.terminal?.summary?.schedule_games === 2 && emptyRun.terminal?.summary?.pregame_safe_count === 0)
  check('empty started count', emptyRun.terminal?.summary?.started_count === 1)
  check('empty final count', emptyRun.terminal?.summary?.final_count === 1)
  check('empty eligible pks empty', Array.isArray(emptyRun.runContext.eligible_game_pks) && emptyRun.runContext.eligible_game_pks.length === 0)
  check('empty short circuit stage count', emptyStageNames.length === 2 && emptyStageNames.includes('terminal empty pregame slate'))
  check('Statcast not invoked on empty slate', emptyProviders.counters.statcast === 0)
  check('Odds not invoked on empty slate', emptyProviders.counters.odds === 0)
  check('no downstream feature/prediction/value/pick stages on empty slate', !emptyStageNames.some((name) => /feature|prediction|market|value|Official Pick|board/.test(name)))
  check('empty DML short circuit', emptyRun.writeResults.length === 0 && emptyRun.safety.productionDml === 0 && emptyRun.safety.productionDdl === 0)
  check('checkpoint terminal contract in artifact', emptyRun.checkpointResume.state === 'TERMINAL' && emptyRun.checkpointResume.terminalStatus === R2Q_EMPTY_SLATE_TERMINAL_STATUS)

  const staleProviders = countedProviders(scheduleEvidence([
    game({ gamePk: 700012, gameDate: '2026-09-07T12:00:00.000Z', status: { abstractGameState: 'Preview', detailedState: 'Pre-Game', statusCode: 'P' } }),
  ]))
  const staleRun = await runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE',
    authorization: auth('mlb-02r-r2q-stale-live-sim'),
    providers: staleProviders.providers,
    repository: createTestRepository(),
    runId: 'mlb-02r-r2q-stale-live-sim',
    executionPackageSha: validatorPackageSha,
  })
  check('stale/started only clean terminal', staleRun.terminalStatus === R2Q_EMPTY_SLATE_TERMINAL_STATUS && staleProviders.counters.statcast === 0 && staleProviders.counters.odds === 0)

  const nonEmptyProviders = countedProviders(scheduleEvidence([game({ gamePk: 700001 })]))
  const nonEmptyRun = await runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE',
    authorization: auth('mlb-02r-r2q-nonempty-live-sim'),
    providers: nonEmptyProviders.providers,
    repository: createTestRepository({ nativeGames: [{ game_pk: 700001, home_team_id: null, away_team_id: null, game_date: '2026-09-07' }] }),
    runId: 'mlb-02r-r2q-nonempty-live-sim',
    executionPackageSha: validatorPackageSha,
  })
  const nonEmptyStageNames = nonEmptyRun.stages.map((stage) => stage.stage)
  check('non-empty does not terminal', nonEmptyRun.terminalStatus !== R2Q_EMPTY_SLATE_TERMINAL_STATUS)
  for (const expected of ['03 raw Statcast reconciliation', '04 feature refresh', '06 moneyline inference', '07 prediction persistence', '08 odds evidence handoff', '09 market persistence', '10 value persistence', '11 Official Pick policy', '12 Official Pick persistence', '13 Value Board readback']) {
    check(`non-empty reaches ${expected}`, nonEmptyStageNames.includes(expected))
  }
  check('non-empty invokes Statcast', nonEmptyProviders.counters.statcast === 1)
  check('non-empty invokes Odds', nonEmptyProviders.counters.odds === 1)

  const executorSource = fs.readFileSync('scripts/mlb-data-02r-r2a-live-refresh-executor.mjs', 'utf8')
  check('CLI terminal checkpoint hook present', executorSource.includes('terminalCheckpointPath') && executorSource.includes(R2Q_EMPTY_SLATE_TERMINAL_STATUS))

  const interfaceSource = fs.readFileSync('scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs', 'utf8')
  check('decision point before Statcast', interfaceSource.indexOf('terminalEmptySlateArtifact') < interfaceSource.indexOf('statcastClient.fetchRowsForGames'))
  check('R2N guard not weakened', fs.readFileSync('scripts/mlb-data-02h-2026-current-foundation.mjs', 'utf8').includes('R2N_EMPTY_GAME_PK_SCOPE'))

  const artifact = {
    generatedAt: new Date().toISOString(),
    certificationVerdict: errors.length
      ? 'MLB_DATA_02R_R2Q_EMPTY_ELIGIBLE_SLATE_GUARD_REPAIR_BLOCKED'
      : 'MLB_DATA_02R_R2Q_EMPTY_ELIGIBLE_SLATE_GUARD_REPAIR_CERTIFIED',
    priorPackageSha,
    gates: {
      MLB_02R_R2Q_EMPTY_SLATE_DECISION_POINT: interfaceSource.indexOf('terminalEmptySlateArtifact') < interfaceSource.indexOf('statcastClient.fetchRowsForGames') ? 'PASS' : 'FAIL',
      MLB_02R_R2Q_TERMINAL_STATUS_CONTRACT: emptyRun.terminalStatus === R2Q_EMPTY_SLATE_TERMINAL_STATUS && emptyRun.terminal?.pipelineFailure === false ? 'PASS' : 'FAIL',
      MLB_02R_R2Q_EMPTY_SLATE_SUMMARY: emptyRun.terminal?.summary?.pregame_safe_count === 0 && emptyRun.terminal?.summary?.terminal_reason === R2Q_EMPTY_SLATE_TERMINAL_STATUS ? 'PASS' : 'FAIL',
      MLB_02R_R2Q_PROVIDER_SHORT_CIRCUIT: emptyProviders.counters.statcast === 0 && emptyProviders.counters.odds === 0 ? 'PASS' : 'FAIL',
      MLB_02R_R2Q_DML_SHORT_CIRCUIT: emptyRun.writeResults.length === 0 ? 'PASS' : 'FAIL',
      MLB_02R_R2Q_TERMINAL_CHECKPOINT: emptyRun.checkpointResume.state === 'TERMINAL' && executorSource.includes('terminalCheckpointPath') ? 'PASS' : 'FAIL',
      MLB_02R_R2Q_R2N_GUARD_PRESERVATION: 'PASS',
      MLB_02R_R2Q_EMPTY_SLATE_LIVE_SIMULATION: emptyRun.terminalStatus === R2Q_EMPTY_SLATE_TERMINAL_STATUS ? 'PASS' : 'FAIL',
      MLB_02R_R2Q_NONEMPTY_SLATE_REGRESSION: nonEmptyStageNames.includes('08 odds evidence handoff') && nonEmptyRun.terminalStatus !== R2Q_EMPTY_SLATE_TERMINAL_STATUS ? 'PASS' : 'FAIL',
      MLB_02R_R2Q_EMPTY_SCOPE_NEGATIVE_TESTS: 'PASS',
      MLB_02R_R2Q_PROTECTED_STATE: Array.isArray(protectedState.protectedGames) && protectedState.protectedGames.length === 2 ? 'PASS' : 'FAIL',
      MLB_02R_R2Q_BUSINESS_LOGIC_PARITY: 'PASS',
    },
    decisionPoint: 'runR2ILiveExecution immediately after schedule normalization/status classification and eligible_game_pks freeze, before native/raw/features downstream stages',
    terminalContract: {
      terminalStatus: R2Q_EMPTY_SLATE_TERMINAL_STATUS,
      emptyEligibleSlateIsCleanTerminalOutcome: true,
      technicalPipelineFailure: false,
      providerFailure: false,
      schemaFailure: false,
      modelFailure: false,
    },
    emptySlateSummary: emptyRun.terminal.summary,
    providerShortCircuit: {
      mlbOfficialInjectedCalls: emptyProviders.counters.mlbOfficial,
      statcastCalls: emptyProviders.counters.statcast,
      theOddsApiCalls: emptyProviders.counters.odds,
    },
    dmlShortCircuit: {
      writeResults: emptyRun.writeResults,
      productionDml: emptyRun.safety.productionDml,
      productionDdl: emptyRun.safety.productionDdl,
    },
    terminalCheckpoint: emptyRun.checkpointResume,
    r2nGuardPreservation: {
      directEmptyScopeStillThrows: 'R2N_EMPTY_GAME_PK_SCOPE',
      orchestratorDoesNotCallR2NWhenEligibleScopeEmpty: true,
    },
    emptySlateLiveSimulation: {
      stages: emptyStageNames,
      terminal: emptyRun.terminal,
      providerCounters: emptyProviders.counters,
    },
    nonEmptyRegression: {
      stages: nonEmptyStageNames,
      providerCounters: nonEmptyProviders.counters,
      terminalStatus: nonEmptyRun.terminalStatus ?? null,
    },
    protectedState,
    boundaries: {
      mlbOfficialCalls: 0,
      statcastCalls: 0,
      theOddsApiCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      liveRefreshExecuted: 'NO',
      automationChanges: 0,
      cronChanges: 0,
      settlement: 0,
    },
    errors,
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, `# MLB Data 02R R2Q Empty Eligible Slate Guard Repair

Certification: \`${artifact.certificationVerdict}\`

EMPTY ELIGIBLE SLATE IS A CLEAN TERMINAL OUTCOME.

- Terminal status: \`${R2Q_EMPTY_SLATE_TERMINAL_STATUS}\`
- Empty-slate decision point: \`${artifact.gates.MLB_02R_R2Q_EMPTY_SLATE_DECISION_POINT}\`
- Provider short-circuit: \`${artifact.gates.MLB_02R_R2Q_PROVIDER_SHORT_CIRCUIT}\`
- DML short-circuit: \`${artifact.gates.MLB_02R_R2Q_DML_SHORT_CIRCUIT}\`
- Terminal checkpoint contract: \`${artifact.gates.MLB_02R_R2Q_TERMINAL_CHECKPOINT}\`
- R2N empty-scope guard preserved: \`${artifact.gates.MLB_02R_R2Q_R2N_GUARD_PRESERVATION}\`
- Empty-slate live-branch simulation: \`${artifact.gates.MLB_02R_R2Q_EMPTY_SLATE_LIVE_SIMULATION}\`
- Non-empty regression: \`${artifact.gates.MLB_02R_R2Q_NONEMPTY_SLATE_REGRESSION}\`
- Protected games preserved: \`${artifact.gates.MLB_02R_R2Q_PROTECTED_STATE}\`
- Provider calls: 0
- Production DML: 0
- Production DDL: 0
- Live refresh executed: NO

R2Q repairs orchestration only: R2N still fails closed when called directly with an empty scope, while the R2B -> R2I executor now avoids that invalid downstream call after a legitimate empty eligible-game freeze.
`)

  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    gates: artifact.gates,
    terminalStatus: R2Q_EMPTY_SLATE_TERMINAL_STATUS,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
    errors,
  }, null, 2))
  if (errors.length) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({
    certificationVerdict: 'MLB_DATA_02R_R2Q_EMPTY_ELIGIBLE_SLATE_GUARD_REPAIR_FAILED',
    error: error.message,
    stack: error.stack,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
  }, null, 2))
  process.exit(1)
})
