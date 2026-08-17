import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const CERTIFICATION_PATH = 'docs/CERTIFICATION/nfl-01-p0-resume-initialization-repair.json'
const CHECKPOINT_PATH = 'data/imports/balldontlie/nfl/nfl-01-start-checkpoint.json'
const ACCOUNTING_PATH = 'data/imports/balldontlie/nfl/nfl-01-request-accounting.json'
const EXECUTOR_PATH = 'scripts/nfl-01-balldontlie-historical-import-readiness.mjs'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NFL_BALLDONTLIE_TRIAL_ACTIVE: 'false',
      NFL_BALLDONTLIE_HISTORICAL_EXECUTION_AUTHORIZED: 'false',
      BALLDONTLIE_API_KEY: '',
    },
  })
  const combined = `${result.stdout}\n${result.stderr}`
  if (combined.includes('UV_HANDLE_CLOSING')) throw new Error('UV_HANDLE_CLOSING_REGRESSION')
  if (result.status !== 0) throw new Error(`COMMAND_FAILED:${args.join(' ')}:${combined}`)
  const jsonStart = result.stdout.indexOf('{')
  if (jsonStart < 0) throw new Error(`JSON_OUTPUT_MISSING:${args.join(' ')}`)
  return JSON.parse(result.stdout.slice(jsonStart))
}

const certification = readJson(CERTIFICATION_PATH)
const checkpoint = readJson(CHECKPOINT_PATH)
const accounting = readJson(ACCOUNTING_PATH)
const executor = readFileSync(EXECUTOR_PATH, 'utf8')

const fixture = runNode([
  '--loader',
  './scripts/local-ts-loader.mjs',
  EXECUTOR_PATH,
  '--checkpoint-initialization-fixture-test',
])
const preflight = runNode([
  '--loader',
  './scripts/local-ts-loader.mjs',
  EXECUTOR_PATH,
  '--p0-resume-preflight',
  '--all-certified-seasons',
])

const requestIds = checkpoint.entries.map((entry) => entry.requestId)
const p0Entries = checkpoint.entries.filter((entry) => !entry.requestId.includes('_probe_'))
const probeEntries = checkpoint.entries.filter((entry) => entry.requestId.includes('_probe_'))
const firstP0 = p0Entries.find((entry) => !entry.completed)

const checks = {
  certificationStatusPass:
    certification.status === 'NFL_01_BALLDONTLIE_P0_RESUME_INITIALIZATION_REPAIR_CERTIFIED',
  fixturePasses: fixture.success === true && fixture.providerCallsMade === 0,
  preflightPasses: preflight.success === true && preflight.providerCallsMade === 0,
  undefinedCursorGuardRemoved: executor.includes('CHECKPOINT_ENTRY_MISSING') && executor.includes('ensureCheckpointQueueEntries'),
  liveCheckpointPreservesProbeEntries: probeEntries.length === 3 && probeEntries.every((entry) => entry.completed === true),
  liveCheckpointHasP0Entries: p0Entries.length === 21,
  noDuplicateRequestIds: requestIds.length === new Set(requestIds).size,
  firstP0WorkItemExpected:
    firstP0?.requestId === 'bdl_nfl_teams_all' &&
    firstP0?.feed === 'teams' &&
    firstP0?.season === 'all' &&
    firstP0?.cursor === null,
  accountingPreserved:
    accounting.totalCalls === 10 &&
    accounting.callsByFeed.teams === 1 &&
    accounting.callsByFeed.games === 3 &&
    accounting.callsByFeed.team_stats === 6 &&
    accounting.recordsCaptured === 848,
  noProviderCallsDuringRepair: certification.providerCallsDuringRepair === 0,
  noProductionMutationsDuringRepair: certification.productionDatabaseMutationsDuringRepair === 0,
  p0ResumeReady: certification.p0ResumeReady === true,
  rawProbePayloadsStillExist: [
    'data/imports/balldontlie/nfl/probe/01_teams.json',
    'data/imports/balldontlie/nfl/probe/02_games.json',
    'data/imports/balldontlie/nfl/probe/03_team_stats.cursor-65790.json',
  ].every((path) => existsSync(path)),
}

const success = Object.values(checks).every(Boolean)

const result = {
  success,
  mode: 'nfl_01_p0_resume_initialization_repair_validation_v1',
  status: success
    ? 'NFL_01_BALLDONTLIE_P0_RESUME_INITIALIZATION_REPAIR_CERTIFIED'
    : 'NFL_01_BALLDONTLIE_P0_RESUME_INITIALIZATION_REPAIR_BLOCKED',
  providerCallsMade: 0,
  productionDatabaseMutationsMade: 0,
  checks,
  firstP0WorkItem: preflight.firstWorkItem,
}

console.log(JSON.stringify(result, null, 2))
process.exitCode = success ? 0 : 1
