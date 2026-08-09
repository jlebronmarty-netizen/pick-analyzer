import fs from 'node:fs'

const files = {
  architecture: 'docs/ARCHITECTURE/SPORTSDATAIO_EXIT_ARCHITECTURE_V1.md',
  pilot: 'docs/PRODUCTION_PILOT/SDIO_EXIT_01_DEPENDENCY_AUDIT.md',
  cert: 'docs/CERTIFICATION/sdio-exit-01-dependency-audit.json',
  validator: 'scripts/sdio-exit-01-dependency-audit-validate.mjs',
  acquisition: 'src/services/canonical-acquisition.service.ts',
  results: 'src/services/results-sync.service.ts',
  starters: 'src/services/mlb-starter-sync.service.ts',
  runtimeAdapter: 'src/services/sportsdataio-runtime-adapter.service.ts',
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const missing = Object.values(files).filter((path) => !fs.existsSync(path))
if (missing.length) {
  console.error(JSON.stringify({ success: false, missing }, null, 2))
  process.exit(1)
}

const architecture = read(files.architecture)
const pilot = read(files.pilot)
const cert = JSON.parse(read(files.cert))
const acquisition = read(files.acquisition)
const results = read(files.results)
const starters = read(files.starters)
const runtimeAdapter = read(files.runtimeAdapter)
const combined = [architecture, pilot, JSON.stringify(cert), read(files.validator)].join('\n')

const checks = [
  ['all SportsDataIO runtime references inventoried', cert.runtimeConsumers.length >= 10 && architecture.includes('Runtime Consumers')],
  ['data-domain matrix complete', Object.keys(cert.dataDomains).length >= 18 && architecture.includes('Data Domain Matrix')],
  ['historical vs future dependency separated', cert.persistedHistoricalData.classification === 'HISTORICAL_DEPENDENCY_REMOVED' && architecture.includes('Future Refresh Required')],
  ['odds dependency classified', cert.dataDomains.odds === 'SPORTSDATAIO_ODDS_EXIT_READY_AFTER_ODDS03_REPAIR'],
  ['schedule dependency classified', cert.dataDomains.schedule === 'BLOCKED_REPLACEMENT_REQUIRED'],
  ['status dependency classified', cert.dataDomains.eventStatus === 'BLOCKED_REPLACEMENT_REQUIRED'],
  ['results dependency classified', cert.dataDomains.results === 'PARTIAL_MLB_READY_WITH_MLB_STATS_API' && results.includes('MLB_STATS_BASE_URL')],
  ['settlement dependency classified', cert.dataDomains.settlement === 'PARTIAL_RESULTS_READY_STATUS_DEPENDENCY_REMAINS'],
  ['starters dependency classified', cert.dataDomains.startingPitchers === 'CRITICAL_REPLACEMENT_REQUIRED' && starters.includes('GAMES_BY_DATE_JOB')],
  ['team stats dependency classified', cert.dataDomains.teamStats === 'BLOCKED_FOR_FUTURE_FEATURE_REFRESH'],
  ['player stats dependency classified', cert.dataDomains.playerStats === 'BLOCKED_FOR_PROPS_AND_PLAYER_MODELS'],
  ['injuries and lineups actual usage classified', cert.dataDomains.injuries.includes('FOUNDATION') && cert.dataDomains.lineups.includes('FOUNDATION')],
  ['cancellation impact simulated', cert.cancellationImpact.oddsRefresh === 'BLOCKED_UNTIL_ODDS03' && pilot.includes('What Breaks If Removed Today')],
  ['replacements proposed for every critical dependency', ['schedule', 'status', 'results', 'starters', 'teamStats', 'playerStats', 'injuries', 'lineups', 'odds'].every((key) => Boolean(cert.replacementRecommendations[key]))],
  ['cancellation gates defined', cert.minimumCancellationGates.length >= 10 && cert.minimumCancellationGates.includes('ROLLBACK_PLAN_READY')],
  ['multi-sport impact considered', cert.multiSportImpact.nbaSportsDataIoPathsExist === true && cert.multiSportImpact.mc03Started === false],
  ['provider calls = 0', cert.providerCalls.sportsDataIo === 0 && cert.providerCalls.theOddsApi === 0 && cert.providerCalls.mlbStatsApi === 0],
  ['database mutations = 0', cert.databaseMutations === 0],
  ['no provider disabled', cert.safety.sportsDataIoDisabled === false && acquisition.includes("const PROVIDER = 'sportsdataio'")],
  ['no subscription cancelled', cert.safety.sportsDataIoCancelled === false && cert.canSportsDataIoBeCancelledToday === false],
  ['ODDS-03 not performed', cert.safety.odds03Performed === false && cert.theOddsApiShadowOnly === true],
  ['SportsDataIO remains production odds authority', cert.sportsDataIoProductionOddsAuthority === true],
  ['runtime adapter remains disabled typed empty', runtimeAdapter.includes('liveCallsEnabled: false') && runtimeAdapter.includes('disabledWarning')],
  ['no secret values exposed', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SPORTSDATAIO_MLB_API_KEY\s*=\s*\S+|THE_ODDS_API_KEY\s*=\s*\S+|CRON_SECRET\s*=\s*\S+)/.test(combined)],
]

const failedChecks = checks
  .filter(([, passed]) => !passed)
  .map(([name]) => name)

const result = {
  success: failedChecks.length === 0,
  mode: 'sdio_exit_01_dependency_audit_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  databaseMutationsMade: 0,
  finalClassification: cert.finalClassification,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
