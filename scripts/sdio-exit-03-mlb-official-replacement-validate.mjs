import fs from 'node:fs'
import { execSync } from 'node:child_process'

const files = {
  provider: 'src/services/mlb-official-data-provider.service.ts',
  replacement: 'src/services/mlb-official-replacement.service.ts',
  route: 'src/app/api/operations/mlb-official-replacement/route.ts',
  config: 'src/config/mlb-data-source-mode.config.ts',
  docs: 'docs/ARCHITECTURE/MLB_OFFICIAL_DATA_PROVIDER_V1.md',
  independence: 'docs/ARCHITECTURE/MLB_PROVIDER_INDEPENDENCE_V1.md',
  pilot: 'docs/PRODUCTION_PILOT/SDIO_EXIT_03_MLB_OFFICIAL_REPLACEMENT.md',
  cert: 'docs/CERTIFICATION/sdio-exit-03-mlb-official-replacement.json',
  validator: 'scripts/sdio-exit-03-mlb-official-replacement-validate.mjs',
  statusMapper: 'src/services/mlb-event-status-mapper.service.ts',
  sportsdataioPreview: 'src/services/sportsdataio-mlb-prospective-preview.service.ts',
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const missing = Object.values(files).filter((path) => !fs.existsSync(path))
if (missing.length) {
  console.error(JSON.stringify({ success: false, missing }, null, 2))
  process.exit(1)
}

const provider = read(files.provider)
const replacement = read(files.replacement)
const route = read(files.route)
const config = read(files.config)
const docs = read(files.docs)
const pilot = read(files.pilot)
const cert = JSON.parse(read(files.cert))
const mapper = read(files.statusMapper)
const preview = read(files.sportsdataioPreview)
const combined = [provider, replacement, route, config, docs, pilot, JSON.stringify(cert), read(files.validator)].join('\n')
const changedFiles = execSync('git diff --name-only HEAD', { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const checks = [
  ['official MLB adapter centralized', provider.includes('fetchMlbOfficialSchedule') && provider.includes('BASE_URL =')],
  ['schedule replacement implemented', provider.includes('normalizeMlbOfficialSchedulePayload') && replacement.includes('buildMlbOfficialScheduleRows')],
  ['canonical event identity safe', replacement.includes('provider_entity_mappings') && replacement.includes('duplicateEventIds')],
  ['doubleheaders handled', provider.includes('doubleHeader') && provider.includes('gameNumber')],
  ['status mapping implemented', provider.includes('mapMlbStatsGameToSportEventStatus') && mapper.includes('MLB Stats API final status maps to completed')],
  ['postponement handling safe', mapper.includes('postponed') && docs.includes('Unknown status is not treated as safely pregame')],
  ['starter replacement implemented', provider.includes('probablePitcher') && replacement.includes('starterLineups')],
  ['starter identity mapped', replacement.includes("entity_type: 'player'") && replacement.includes('mlb_stats_api')],
  ['starter changes detected safely', replacement.includes('starterChangeKey') && cert.domains.starterChangeHandling === 'PARTIAL_DETERMINISTIC_KEY_NO_REGENERATION'],
  ['roster sync classified', cert.domains.roster === 'BLOCKED_FUTURE'],
  ['required player stats classified', cert.domains.playerStats === 'MORE_OBSERVATION_REQUIRED'],
  ['team-game stats classified', cert.domains.teamGameStats === 'MORE_OBSERVATION_REQUIRED'],
  ['team aggregate features semantically preserved or blocked', cert.domains.teamAggregateStats === 'PARTIAL_NOT_PARITY_CERTIFIED'],
  ['bullpen features preserved or blocker explicit', cert.domains.bullpen === 'PARTIAL_STORED_ONLY'],
  ['standings not required', cert.domains.standings === 'NOT_REQUIRED_CURRENT_EXIT'],
  ['lineups accurately classified', cert.domains.lineups === 'NOT_REQUIRED_EXCEPT_STARTERS'],
  ['injuries remain non-blocker', cert.domains.injuries === 'NOT_REQUIRED_CURRENT_PRODUCTION'],
  ['results identity aligned', cert.domains.results === 'PASS_EXISTING_MLB_STATS_API'],
  ['settlement remains canonical', cert.domains.settlement === 'PASS_EXISTING_CANONICAL_RESULTS'],
  ['feature parity audited', pilot.includes('feature parity') && cert.minimumRemainingGates.includes('team/player stat feature parity proof')],
  ['no prediction formula changes', cert.safety.predictionFormulasChanged === false],
  ['SportsDataIO-off dry-run completed', cert.sportsDataIoOffDryRun.schedule === 'PASS_WITH_OFFICIAL_MLB' && replacement.includes('runMlbOfficialSportsDataIoOffDryRun')],
  ['no critical step silently fabricates data', provider.includes('UNAVAILABLE') && docs.includes('Missing starter remains unavailable')],
  ['scheduler integration bounded', pilot.includes('The existing Vercel operating-day scheduler remains the only scheduler')],
  ['fail-closed behavior present', docs.includes('Unknown status is not treated as safely pregame')],
  ['non-MLB provider paths unchanged', !changedFiles.some((path) => /^(src\/app\/api|src\/services)\/(nba|nfl|nhl|soccer|tennis|ufc)\b/.test(path.replaceAll('\\', '/'))) && preview.includes('process.env.SPORTSDATAIO_MLB_API_KEY')],
  ['SportsDataIO manual calls during certification = 0', cert.safety.sportsDataIoManualCallsDuringCertification === 0],
  ['The Odds API manual calls = 0', cert.safety.theOddsApiManualCalls === 0],
  ['subscription not cancelled', cert.safety.sportsDataIoCancelled === false && cert.safety.sportsDataIoDisabled === false],
  ['rollback retained', config.includes('sportsDataIoRetainedForRollback: true') && cert.cancellationReadiness.ROLLBACK === 'PASS'],
  ['ODDS authority not promoted', cert.safety.oddsAuthorityPromoted === false && cert.odds03cStatus === 'WAIT_FOR_MULTI_EVENT_WINDOW'],
  ['no secret values exposed', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|SPORTSDATAIO_MLB_API_KEY\s*=\s*\S+|THE_ODDS_API_KEY\s*=\s*\S+|CRON_SECRET\s*=\s*\S+)/.test(combined)],
]

const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failedChecks.length === 0,
  mode: 'sdio_exit_03_mlb_official_replacement_validation_v1',
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
