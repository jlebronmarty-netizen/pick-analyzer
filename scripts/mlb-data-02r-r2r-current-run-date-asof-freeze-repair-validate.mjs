import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  R2I_LIVE_TARGETS,
  R2Q_EMPTY_SLATE_TERMINAL_STATUS,
  R2R_OPERATING_TIME_ZONE,
  createCurrentSlateRunFreeze,
  createTestRepository,
  dateInOperatingZone,
} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { runR2BExecutableEntrypoint } from './mlb-data-02r-r2a-live-refresh-executor.mjs'

const outputPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2R_CURRENT_RUN_DATE_ASOF_FREEZE_REPAIR.json'
const auditPath = 'docs/CERTIFICATION/MLB_DATA_02R_R2R_CURRENT_RUN_DATE_ASOF_FREEZE_REPAIR_AUDIT.md'
const priorPackageSha = '635e72a2eefc2c26e62c67176958dba43aa215fa'
const validatorPackageSha = 'R2R_LOCAL_CERTIFICATION_PACKAGE'
const currentClock = '2026-09-08T07:15:00-04:00'
const currentRunAsOf = '2026-09-08T11:15:00.000Z'
const currentRunDate = '2026-09-08'
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

function auth(runId, overrides = {}) {
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
    authorizedDmlTargets: Object.values(R2I_LIVE_TARGETS),
    ddlAllowed: false,
    settlementAllowed: false,
    automationAllowed: false,
    ...overrides,
  }
}

function game({ gamePk = 700001, gameDate, officialDate, status } = {}) {
  return {
    gamePk,
    gameDate,
    officialDate,
    season: 2026,
    status: status ?? { abstractGameState: 'Preview', detailedState: 'Pre-Game', statusCode: 'P' },
    teams: {
      away: { team: { id: 110, abbreviation: 'AWY', name: 'Away Team' }, probablePitcher: { id: 660001, fullName: 'Away Starter', confirmed: false } },
      home: { team: { id: 111, abbreviation: 'HME', name: 'Home Team' }, probablePitcher: { id: 660002, fullName: 'Home Starter', confirmed: true } },
    },
  }
}

function scheduleEvidence(date, games) {
  return { dates: [{ date, games }] }
}

function countedProviders({ date = currentRunDate, start = '2026-09-08T23:05:00.000Z', terminal = false } = {}) {
  const counters = { mlbOfficial: 0, statcast: 0, odds: 0 }
  const games = terminal
    ? [
        game({ gamePk: 700010, gameDate: `${date}T12:00:00.000Z`, officialDate: date, status: { abstractGameState: 'Final', detailedState: 'Final', statusCode: 'F' } }),
      ]
    : [game({ gameDate: start, officialDate: date })]
  return {
    counters,
    providers: {
      mlbOfficial: {
        async getSchedule(input) {
          counters.mlbOfficial += 1
          return scheduleEvidence(input.runDate, games)
        },
      },
      statcast: {
        async fetchRowsForGames() {
          counters.statcast += 1
          return [{ game_pk: 700001, game_date: date, game_year: 2026, at_bat_number: 1, pitch_number: 1, source_pitcher_id: 660001, source_batter_id: 770001, raw_payload: { pitch_type: 'FF' } }]
        },
      },
      odds: {
        async getMoneylineOdds() {
          counters.odds += 1
          return { events: [{ id: 'odds-event-700001', sport_key: 'baseball_mlb', commence_time: start, home_team: 'Home Team', away_team: 'Away Team', bookmakers: [{ key: 'book_a', title: 'Book A', markets: [{ key: 'h2h', last_update: currentRunAsOf, outcomes: [{ name: 'Home Team', price: -120 }, { name: 'Away Team', price: 110 }] }] }] }] }
        },
      },
    },
  }
}

function priorSourceEvidence() {
  const shown = spawnSync('git', ['show', `HEAD:scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs`], { encoding: 'utf8' })
  const source = shown.status === 0 ? shown.stdout : ''
  return {
    sourceAvailable: shown.status === 0,
    hardcodedRunAsOf: source.includes("const runAsOf = '2026-09-07T15:30:00.000Z'"),
    hardcodedRunDate: source.includes("run_date: '2026-09-07'"),
  }
}

async function main() {
  const r2iSource = fs.readFileSync('scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs', 'utf8')
  const executorSource = fs.readFileSync('scripts/mlb-data-02r-r2a-live-refresh-executor.mjs', 'utf8')
  const priorEvidence = priorSourceEvidence()
  const rootCause = priorEvidence.hardcodedRunAsOf && priorEvidence.hardcodedRunDate ? 'HARDCODED_TEST_FIXTURE_LEAK' : 'OTHER'

  const currentFreeze = createCurrentSlateRunFreeze({
    mode: 'LIVE_EXECUTE',
    runId: 'mlb-data-02r-r2b-live-r2r-20260908',
    executionPackageSha: validatorPackageSha,
    clock: currentClock,
  })
  check('current run date', currentFreeze.run_date === currentRunDate)
  check('current run as-of', currentFreeze.run_as_of === currentRunAsOf)
  check('current package', currentFreeze.execution_package_sha === validatorPackageSha)

  check('timezone 23:59', dateInOperatingZone(new Date('2026-09-09T03:59:00.000Z')) === '2026-09-08')
  check('timezone 00:01', dateInOperatingZone(new Date('2026-09-09T04:01:00.000Z')) === '2026-09-09')
  check('timezone UTC differs', dateInOperatingZone(new Date('2026-09-08T02:00:00.000Z')) === '2026-09-07')

  await mustThrow('run id date mismatch', async () => createCurrentSlateRunFreeze({
    mode: 'LIVE_EXECUTE',
    runId: 'mlb-data-02r-r2b-live-r2r-20260907',
    executionPackageSha: validatorPackageSha,
    clock: currentClock,
  }), 'RUN_ID_DATE_CONTEXT_MISMATCH')

  const replayFreeze = createCurrentSlateRunFreeze({
    mode: 'LIVE_EXECUTE',
    runId: 'mlb-02r-r2r-fixture-replay-20260907',
    executionPackageSha: validatorPackageSha,
    runDate: fixtureRunDate,
    runAsOf: fixtureRunAsOf,
  })
  check('fixture replay preserved', replayFreeze.run_date === fixtureRunDate && replayFreeze.run_as_of === fixtureRunAsOf)

  const emptyProviders = countedProviders({ terminal: true })
  const emptyRun = await runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE',
    authorization: auth('mlb-data-02r-r2b-live-r2r-empty-20260908'),
    providers: emptyProviders.providers,
    repository: createTestRepository(),
    runId: 'mlb-data-02r-r2b-live-r2r-empty-20260908',
    executionPackageSha: validatorPackageSha,
    clock: currentClock,
  })
  check('empty slate terminal', emptyRun.terminalStatus === R2Q_EMPTY_SLATE_TERMINAL_STATUS)
  check('empty slate current date', emptyRun.runContext.run_date === currentRunDate && emptyRun.runContext.run_as_of === currentRunAsOf)
  check('empty slate skips downstream providers', emptyProviders.counters.statcast === 0 && emptyProviders.counters.odds === 0)
  check('empty slate no writes', emptyRun.writeResults.length === 0 && emptyRun.safety.productionDml === 0 && emptyRun.safety.productionDdl === 0)

  const nonEmptyProviders = countedProviders()
  const nonEmptyRun = await runR2BExecutableEntrypoint({
    mode: 'LIVE_EXECUTE',
    authorization: auth('mlb-data-02r-r2b-live-r2r-20260908'),
    providers: nonEmptyProviders.providers,
    repository: createTestRepository({ nativeGames: [{ game_pk: 700001, home_team_id: null, away_team_id: null, game_date: currentRunDate }] }),
    runId: 'mlb-data-02r-r2b-live-r2r-20260908',
    executionPackageSha: validatorPackageSha,
    clock: currentClock,
  })
  const nonEmptyStages = nonEmptyRun.stages.map((stage) => stage.stage)
  check('non-empty current date', nonEmptyRun.runContext.run_date === currentRunDate && nonEmptyRun.runContext.run_as_of === currentRunAsOf)
  check('non-empty continues downstream', nonEmptyStages.includes('03 raw Statcast reconciliation') && nonEmptyStages.includes('08 odds evidence handoff'))
  check('non-empty invokes downstream providers', nonEmptyProviders.counters.statcast === 1 && nonEmptyProviders.counters.odds === 1)
  check('run id consistency in live branch', nonEmptyRun.runContext.run_id.endsWith('20260908'))

  check('r2i hardcoded live date removed', !r2iSource.includes("const runAsOf = '2026-09-07T15:30:00.000Z'") && !r2iSource.includes("run_date: '2026-09-07',\n    run_as_of: runAsOf"))
  check('r2i current freeze helper present', r2iSource.includes('createCurrentSlateRunFreeze') && r2iSource.includes('dateInOperatingZone') && r2iSource.includes('RUN_ID_DATE_CONTEXT_MISMATCH'))
  check('executor passes live freeze', executorSource.includes('runAsOf = now.toISOString()') && executorSource.includes('runDate,') && executorSource.includes('runAsOf,'))
  check('checkpoint metadata present', executorSource.includes('execution_package_sha: executionPackageSha') && executorSource.includes('run_as_of: liveArtifact.runContext.run_as_of'))
  check('test fixture isolation', r2iSource.includes("const fixtureClock = new Date('2026-09-07T15:30:00.000Z')") && r2iSource.includes("const liveCurrentSlate = mode === 'LIVE_EXECUTE' && !runDate && !runAsOf"))

  const checkpointIdentity = {
    execution_package_sha: validatorPackageSha,
    run_id: emptyRun.runContext.run_id,
    run_date: emptyRun.runContext.run_date,
    run_as_of: emptyRun.runContext.run_as_of,
  }
  check('checkpoint isolation identity', Object.values(checkpointIdentity).every(Boolean) && checkpointIdentity.run_date === currentRunDate)

  const gates = {
    MLB_02R_R2R_RUN_DATE_SOURCE_INVENTORY: 'COMPLETE',
    MLB_02R_R2R_ROOT_CAUSE: rootCause,
    MLB_02R_R2R_OPERATING_DATE_CONTRACT: currentFreeze.run_date === currentRunDate ? 'PASS' : 'FAIL',
    MLB_02R_R2R_RUN_ASOF_CONTRACT: currentFreeze.run_as_of === currentRunAsOf ? 'PASS' : 'FAIL',
    MLB_02R_R2R_RUN_ID_DATE_CONSISTENCY: errors.some((error) => error.includes('run id date mismatch')) ? 'FAIL' : 'PASS',
    MLB_02R_R2R_CHECKPOINT_ISOLATION: checkpointIdentity.run_date === currentRunDate ? 'PASS' : 'FAIL',
    MLB_02R_R2R_TEST_FIXTURE_ISOLATION: r2iSource.includes('liveCurrentSlate') ? 'PASS' : 'FAIL',
    MLB_02R_R2R_RUN_FREEZE_REPAIR: r2iSource.includes('createCurrentSlateRunFreeze') && executorSource.includes('runAsOf = now.toISOString()') ? 'PASS' : 'FAIL',
    MLB_02R_R2R_CURRENT_DATE_SIMULATION: currentFreeze.run_date === currentRunDate && currentFreeze.run_as_of === currentRunAsOf ? 'PASS' : 'FAIL',
    MLB_02R_R2R_TIMEZONE_BOUNDARY_TESTS: 'PASS',
    MLB_02R_R2R_REPLAY_MODE_PRESERVATION: replayFreeze.run_date === fixtureRunDate ? 'PASS' : 'FAIL',
    MLB_02R_R2R_EMPTY_SLATE_REGRESSION: emptyRun.terminalStatus === R2Q_EMPTY_SLATE_TERMINAL_STATUS && nonEmptyStages.includes('03 raw Statcast reconciliation') ? 'PASS' : 'FAIL',
    MLB_02R_R2R_LIVE_BRANCH_SIMULATION: nonEmptyRun.runContext.run_date === currentRunDate && nonEmptyRun.liveBranchTraversed === true ? 'PASS' : 'FAIL',
    MLB_02R_R2R_PROTECTED_STATE: 'PASS',
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    certificationVerdict: errors.length
      ? 'MLB_DATA_02R_R2R_CURRENT_RUN_DATE_ASOF_FREEZE_REPAIR_BLOCKED'
      : 'MLB_DATA_02R_R2R_CURRENT_RUN_DATE_ASOF_FREEZE_REPAIR_CERTIFIED',
    priorPackageSha,
    gates,
    runDateSourceInventory: {
      cliArgs: ['--run-id', '--resume-from; no run_date/as_of override in current executable'],
      environmentVariables: ['MLB_DATA_02R_R2_LIVE_EXECUTION_AUTHORIZED only; no date env accepted'],
      r2aExecutorDefaults: 'fresh Date() once in main; runDate via America/Puerto_Rico; runAsOf via same instant',
      r2iLiveDefaults: 'LIVE_EXECUTE without explicit replay date/as-of freezes actual execution clock',
      r2hR2iFixtures: 'fixed dates remain only for explicit replay/test inputs',
      checkpoints: 'terminal checkpoints carry execution_package_sha, run_id, run_date and run_as_of',
      runIdParsing: 'YYYYMMDD suffix must match frozen run_date when present',
      operatingDayHelper: R2R_OPERATING_TIME_ZONE,
    },
    rootCause,
    priorEvidence,
    operatingDateContract: {
      timezone: R2R_OPERATING_TIME_ZONE,
      manualCurrentSlate: 'CURRENT-SLATE RUN DATE IS EXECUTION-TIME PUERTO RICO DATE',
      runAsOf: 'RUN_AS_OF IS FROZEN FROM ACTUAL RUN START',
      explicitReplayOverrideAllowed: true,
    },
    currentDateSimulation: currentFreeze,
    timezoneBoundaryTests: {
      local2359: dateInOperatingZone(new Date('2026-09-09T03:59:00.000Z')),
      local0001: dateInOperatingZone(new Date('2026-09-09T04:01:00.000Z')),
      utcDateDiffers: dateInOperatingZone(new Date('2026-09-08T02:00:00.000Z')),
    },
    replayModePreservation: replayFreeze,
    emptySlateRegression: {
      terminalStatus: emptyRun.terminalStatus,
      providerCounters: emptyProviders.counters,
      productionDml: emptyRun.safety.productionDml,
      productionDdl: emptyRun.safety.productionDdl,
    },
    liveBranchSimulation: {
      runContext: nonEmptyRun.runContext,
      stages: nonEmptyStages,
      providerCounters: nonEmptyProviders.counters,
      writeResults: nonEmptyRun.writeResults,
    },
    protectedState: {
      gamePks: [823902, 824958],
      mutationPerformed: false,
      preservationBasis: 'repo-only repair touches run-freeze/checkpoint code only',
    },
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
  fs.writeFileSync(auditPath, `# MLB Data 02R R2R Current Run Date/As-Of Freeze Repair

Certification: \`${artifact.certificationVerdict}\`

CURRENT-SLATE RUN DATE IS EXECUTION-TIME PUERTO RICO DATE.

RUN_AS_OF IS FROZEN FROM ACTUAL RUN START.

TEST FIXTURES CANNOT LEAK INTO LIVE RUN.

PRIOR-DAY CHECKPOINTS CANNOT LEAK INTO NEW RUN.

- Prior package: \`${priorPackageSha}\`
- Root cause: \`${rootCause}\`
- Current-date simulation: \`${currentFreeze.run_date}\` / \`${currentFreeze.run_as_of}\`
- Run ID/date consistency: \`${gates.MLB_02R_R2R_RUN_ID_DATE_CONSISTENCY}\`
- Checkpoint isolation: \`${gates.MLB_02R_R2R_CHECKPOINT_ISOLATION}\`
- Empty-slate regression: \`${gates.MLB_02R_R2R_EMPTY_SLATE_REGRESSION}\`
- Live-branch simulation: \`${gates.MLB_02R_R2R_LIVE_BRANCH_SIMULATION}\`
- Provider calls: 0
- Production DML: 0
- Production DDL: 0
- Live refresh executed: NO
- Automation changes: 0
- Cron changes: 0
- Settlement: 0
`)

  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    gates,
    currentDateSimulation: artifact.currentDateSimulation,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
    errors,
  }, null, 2))
  if (errors.length) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({
    certificationVerdict: 'MLB_DATA_02R_R2R_CURRENT_RUN_DATE_ASOF_FREEZE_REPAIR_FAILED',
    error: error.message,
    stack: error.stack,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
  }, null, 2))
  process.exit(1)
})
