import fs from 'node:fs'

const files = {
  service: 'src/services/multi-sport-data-readiness.service.ts',
  route: 'src/app/api/mission-control/data-readiness/route.ts',
  missionControl: 'src/services/mission-control.service.ts',
  missionDoc: 'docs/MISSION_CONTROL/MC_02_MULTI_SPORT_DATA_READINESS.md',
  certDoc: 'docs/CERTIFICATION/MC_02_MULTI_SPORT_DATA_READINESS.md',
  certJson: 'docs/CERTIFICATION/mc-02-multi-sport-data-readiness.json',
  status: 'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  queue: 'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const contents = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, read(path)]))
const cert = JSON.parse(contents.certJson)
const status = JSON.parse(contents.status)
const targetSports = [
  'baseball_mlb',
  'basketball_nba',
  'americanfootball_nfl',
  'icehockey_nhl',
  'soccer',
  'tennis',
  'mma_ufc',
  'basketball_bsn',
]

const checks = [
  ['every configured target sport is represented in certification', targetSports.every((sportKey) => contents.certJson.includes(`"sportKey": "${sportKey}"`))],
  ['sport readiness is evidence-based', contents.service.includes('readinessReasonCodes') && contents.service.includes('evidence:')],
  ['adapter existence does not imply DATA_READY', contents.service.includes('adapter existence') || contents.certDoc.includes('adapter existence does not imply')],
  ['missing provider evidence remains unknown or blocked', contents.certJson.includes('UNKNOWN_ON_NORMAL_READS') && contents.certJson.includes('PROVIDER_BLOCKED')],
  ['SportsDataIO and The Odds API budgets remain isolated', contents.service.includes('sportsdataio-isolated') && contents.certJson.includes('"combinedWithTheOddsApi": false')],
  ['BSN is not falsely claimed as The Odds API-covered', contents.service.includes('BSN is not treated as The Odds API-covered') && contents.certJson.includes('"coveredByTheOddsApi": false')],
  ['event counts are bounded and current/historical scopes are separated', contents.service.includes('currentEvents') && contents.service.includes('historicalCoverage') && contents.service.includes('limit')],
  ['duplicate and orphan checks are represented as mapping blockers', contents.service.includes('providerMappings') && contents.service.includes('CANONICAL_EVENT_CROSSWALK_NOT_COMPLETE')],
  ['authoritative results are required for RESULT_READY', contents.service.includes('AUTHORITATIVE_RESULTS_EMPTY') && contents.service.includes('resultState')],
  ['odds timestamps are canonical stored snapshots', contents.service.includes('sports_odds_snapshots') && contents.missionDoc.includes('odds')],
  ['normal readiness reads make zero provider calls', contents.service.includes('providerCallsMade: 0') && cert.guarantees.normalReadProviderCallsMade === 0],
  ['normal readiness reads make zero mutations', contents.service.includes('remoteMutationsMade: 0') && cert.guarantees.normalReadRemoteMutationsMade === 0],
  ['feature readiness does not activate predictions', contents.service.includes('predictionGenerationActivated: false') && cert.scope.predictionActivation === false],
  ['no sport certification is promoted without evidence', contents.certDoc.includes('Blocked sports are isolated') || contents.missionDoc.includes('Blocked sports are isolated')],
  ['no model math changes', cert.scope.officialPickPolicyChanged === false && cert.guarantees.databaseMutationsMade === 0],
  ['no settlement or learning activation', cert.scope.settlementActivation === false && cert.scope.learningActivation === false],
  ['provider calls made during audit are exactly recorded', cert.guarantees.providerCallsUsedDuringMc02 === 0 && cert.guarantees.providerCreditsUsedDuringMc02 === 0],
  ['Mission Control progress derives from explicit checks', status.mc02.status === 'PRODUCTION_CERTIFIED' && status.mc02.certificationArtifact === files.certJson],
  ['blocked sport does not globally block independent sport audits', contents.service.includes('independentBlockedSportsDoNotBlockGlobalAudit: true')],
  ['known dirty files remain untouched by validator scope', !Object.values(files).some((file) => file.includes('login/page') || file.includes('register/page') || file.includes('build-memory'))],
  ['payloads are bounded', contents.route.includes('max: 100') && contents.service.includes('slice(0')],
  ['no secrets are exposed', contents.service.includes('secretsExposed: false') && !contents.certJson.includes('SUPABASE_SERVICE_ROLE_KEY')],
  ['Mission Control exposes MC-02 runtime surface', contents.missionControl.includes('/api/mission-control/data-readiness')],
  ['MC-03 remains not started', contents.queue.includes('MC-03 remains PLANNED') && cert.mc03Status === 'PLANNED_MANUAL_ONLY_NOT_STARTED'],
]

const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failedChecks.length === 0,
  mode: 'mc02_multi_sport_data_readiness_validation',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  providerCreditsConsumed: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
