import fs from 'node:fs'

const files = {
  independence: 'docs/ARCHITECTURE/MLB_PROVIDER_INDEPENDENCE_V1.md',
  architecture: 'docs/ARCHITECTURE/SPORTSDATAIO_EXIT_ARCHITECTURE_V1.md',
  pilot: 'docs/PRODUCTION_PILOT/SDIO_EXIT_02_FULL_MLB_REPLACEMENT.md',
  cert: 'docs/CERTIFICATION/sdio-exit-02-full-mlb-replacement.json',
  validator: 'scripts/sdio-exit-02-full-mlb-replacement-validate.mjs',
  acquisition: 'src/services/canonical-acquisition.service.ts',
  operatingDay: 'src/services/operating-day.service.ts',
  results: 'src/services/results-sync.service.ts',
  starters: 'src/services/mlb-starter-sync.service.ts',
  teamStats: 'src/services/mlb-team-stats-sync.service.ts',
  odds03a: 'docs/CERTIFICATION/odds-03a-natural-dual-read-proof.json',
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function exists(path) {
  return fs.existsSync(path)
}

const missing = Object.values(files).filter((path) => !exists(path))
if (missing.length) {
  console.error(JSON.stringify({ success: false, missing }, null, 2))
  process.exit(1)
}

const independence = read(files.independence)
const architecture = read(files.architecture)
const pilot = read(files.pilot)
const cert = JSON.parse(read(files.cert))
const acquisition = read(files.acquisition)
const operatingDay = read(files.operatingDay)
const results = read(files.results)
const starters = read(files.starters)
const teamStats = read(files.teamStats)
const odds03a = JSON.parse(read(files.odds03a))
const combined = [independence, architecture, pilot, JSON.stringify(cert), read(files.validator)].join('\n')

const checks = [
  ['every MLB SportsDataIO dependency classified', Object.keys(cert.domains).length >= 20 && cert.runtimeConsumers.length >= 10],
  ['schedule replacement blocked explicitly', cert.domains.schedule === 'BLOCKED' && pilot.includes('no idempotent slate discovery writer has replaced SportsDataIO')],
  ['status replacement certified through MLB Stats API', cert.domains.eventStatus === 'PASS_WITH_MLB_STATS_API' && operatingDay.includes('statsapi.mlb.com')],
  ['results replacement certified through MLB Stats API', cert.domains.results === 'PASS_WITH_MLB_STATS_API' && results.includes('MLB_STATS_BASE_URL')],
  ['settlement compatible through canonical results', cert.domains.settlement === 'PASS_DEPENDS_ON_RESULT_IMPORT'],
  ['starter replacement blocked explicitly', cert.domains.startingPitchers === 'BLOCKED_CRITICAL' && starters.includes('GAMES_BY_DATE_JOB')],
  ['team stats replacement not falsely certified', cert.domains.teamStats === 'PARTIAL_NOT_PARITY_CERTIFIED' && teamStats.includes('API_SPORTS_KEY')],
  ['player stats replacement blocked', cert.domains.playerStats === 'BLOCKED_FOR_PROPS_AND_PLAYER_MODELS'],
  ['injuries classified as not required today', cert.domains.injuries === 'NOT_REQUIRED_CURRENT_PRODUCTION'],
  ['lineups classified accurately', cert.domains.lineups === 'PARTIAL_STARTERS_BLOCKED'],
  ['historical dependency remains removed', cert.historicalDependency.classification === 'HISTORICAL_DEPENDENCY_REMOVED' && cert.historicalDependency.historicalReplayPredictions === 7290],
  ['provider crosswalk safe/retained', cert.domains.providerMapping === 'RETAIN_LINEAGE' && independence.includes('SportsDataIO IDs must remain for lineage')],
  ['no canonical duplicate event claim', pilot.includes('Do not create duplicate canonical games') === false && cert.domains.eventIdentity === 'PARTIAL'],
  ['feature semantics preserved', cert.safety.predictionFormulasChanged === false && cert.safety.officialPickPolicyChanged === false],
  ['HR-03 remains shadow', cert.safety.hr03RemainsShadowOnly === true],
  ['ODDS-03C untouched', cert.safety.odds03cUntouched === true && cert.odds03cStatus === 'WAIT_FOR_MULTI_EVENT_WINDOW'],
  ['SportsDataIO calls during certification = 0', cert.safety.sportsDataIoCallsDuringCertification === 0],
  ['The Odds API manual calls = 0', cert.safety.theOddsApiManualCallsDuringCertification === 0],
  ['provider failure behavior fail-closed documented', pilot.includes('Failure Policy') && pilot.includes('Do not infer final/live from elapsed time')],
  ['multi-sport paths unchanged/account blocker', cert.cancellationGates.MULTI_SPORT_ISOLATION === 'PASS_FOR_MLB_SCOPE_ACCOUNT_NOT_READY'],
  ['subscription not cancelled', cert.safety.sportsDataIoCancelled === false],
  ['rollback preserved', cert.cancellationGates.ROLLBACK === 'PASS' && acquisition.includes("const PROVIDER = 'sportsdataio'")],
  ['SportsDataIO remains product odds authority', cert.sportsDataIoProductionOddsAuthority === true],
  ['The Odds API remains shadow-only', cert.theOddsApiStatus === 'SHADOW_NON_AUTHORITATIVE' && odds03a.finalClassification],
  ['final decision is partial not cancellation-ready', cert.mlbSportsDataIoExitDecision === 'MLB_SPORTSDATAIO_EXIT_PARTIAL' && cert.sportsDataIoAccountCancellationReady === 'NO'],
  ['no secret values exposed', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SPORTSDATAIO_MLB_API_KEY\s*=\s*\S+|THE_ODDS_API_KEY\s*=\s*\S+|CRON_SECRET\s*=\s*\S+)/.test(combined)],
]

const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failedChecks.length === 0,
  mode: 'sdio_exit_02_full_mlb_replacement_validation_v1',
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
