import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const certification = JSON.parse(readFileSync('docs/CERTIFICATION/nfl-01-windows-executor-shutdown-repair.json', 'utf8'))
const checkpoint = JSON.parse(readFileSync('data/imports/balldontlie/nfl/nfl-01-start-checkpoint.json', 'utf8'))
const accounting = JSON.parse(readFileSync('data/imports/balldontlie/nfl/nfl-01-request-accounting.json', 'utf8'))
const teamStatsRaw = JSON.parse(readFileSync('data/imports/balldontlie/nfl/probe/03_team_stats.json', 'utf8'))
const executorSource = readFileSync('scripts/nfl-01-balldontlie-historical-import-readiness.mjs', 'utf8')

function run(args) {
  return spawnSync(process.execPath, ['--loader', './scripts/local-ts-loader.mjs', 'scripts/nfl-01-balldontlie-historical-import-readiness.mjs', ...args], {
    encoding: 'utf8',
  })
}

function parse(stdout) {
  try {
    return JSON.parse(stdout)
  } catch {
    return null
  }
}

const shutdown = run(['--shutdown-fixture-test'])
const preflight = run(['--local-storage-preflight'])
const collision = run(['--collision-fixture-test'])

const shutdownResult = parse(shutdown.stdout)
const preflightResult = parse(preflight.stdout)
const collisionResult = parse(collision.stdout)

const teams = checkpoint.entries.find((entry) => entry.requestId === 'bdl_nfl_probe_teams_all')
const games = checkpoint.entries.find((entry) => entry.requestId === 'bdl_nfl_probe_games_2025')
const teamStats = checkpoint.entries.find((entry) => entry.requestId === 'bdl_nfl_probe_team_stats_2025')

const combinedStderr = `${shutdown.stderr}\n${preflight.stderr}\n${collision.stderr}`

const checks = {
  statusCertified: certification.status === 'NFL_01_BALLDONTLIE_WINDOWS_EXECUTOR_SHUTDOWN_REPAIR_CERTIFIED',
  teamStatsRawExistsAndUsable: teamStatsRaw.status === 200 && teamStatsRaw.payload?.data?.length === 100,
  teamStatsNextCursorUnderstood:
    (teamStatsRaw.payload?.meta?.next_cursor === 112 && teamStats?.cursor === 112) ||
    (teamStatsRaw.payload?.meta?.next_cursor === 112 && teamStats?.cursor === null && teamStats?.completed === true),
  checkpointStateConsistent:
    teams?.completed === true &&
    games?.completed === true &&
    (
      teamStats?.completed === false ||
      (teamStats?.completed === true && teamStats?.recordsCaptured >= 544)
    ),
  accountingConsistent:
    accounting.totalCalls >= 5 &&
    accounting.callsByFeed?.teams === 1 &&
    accounting.callsByFeed?.games === 3 &&
    accounting.callsByFeed?.team_stats >= 1 &&
    accounting.retries === 0 &&
    accounting.failures === 0,
  nextRequestIdentified:
    (
      preflightResult?.nextWork?.requestId === 'bdl_nfl_probe_team_stats_2025' &&
      preflightResult?.nextWork?.cursor === 112 &&
      preflightResult?.nextWork?.rawPath === 'data/imports/balldontlie/nfl/probe/03_team_stats.cursor-112.json'
    ) ||
    preflightResult?.nextWork === null,
  noDirectProcessExit: !executorSource.includes('process.exit('),
  shutdownFixturePasses: shutdown.status === 0 && shutdownResult?.success === true,
  localPreflightPasses: preflight.status === 0 && preflightResult?.success === true,
  collisionFixtureStillPasses: collision.status === 0 && collisionResult?.success === true,
  noUvHandleClosingAssertion: !combinedStderr.includes('UV_HANDLE_CLOSING') && !combinedStderr.includes('async.c'),
  providerCallsZeroInDiagnostic:
    certification.providerCallsDuringDiagnostic === 0 &&
    shutdownResult?.providerCallsMade === 0 &&
    preflightResult?.providerCallsMade === 0 &&
    collisionResult?.providerCallsMade === 0,
  productionMutationsZeroInDiagnostic:
    certification.productionDatabaseMutationsDuringDiagnostic === 0 &&
    shutdownResult?.productionDatabaseMutationsMade === 0 &&
    preflightResult?.productionDatabaseMutationsMade === 0 &&
    collisionResult?.productionDatabaseMutationsMade === 0,
  p0NotReady: certification.p0DownloadReady === false,
}

const result = {
  success: Object.values(checks).every(Boolean),
  mode: 'nfl_01_windows_executor_shutdown_repair_validation_v1',
  status: Object.values(checks).every(Boolean)
    ? 'NFL_01_BALLDONTLIE_WINDOWS_EXECUTOR_SHUTDOWN_REPAIR_CERTIFIED'
    : 'NFL_01_BALLDONTLIE_EXECUTOR_RUNTIME_BLOCKED',
  providerCallsMade: 0,
  productionDatabaseMutationsMade: 0,
  checks,
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
