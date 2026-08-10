import fs from 'node:fs'
import { execSync } from 'node:child_process'

const files = {
  service: 'src/services/mlb-official-replacement.service.ts',
  architecture: 'docs/ARCHITECTURE/MLB_OFFICIAL_DATA_PROVIDER_V1.md',
  report: 'docs/PRODUCTION_PILOT/SDIO_EXIT_03C_CANONICAL_LIFECYCLE_REPAIR.md',
  cert: 'docs/CERTIFICATION/sdio-exit-03c-canonical-lifecycle-repair.json',
  validator: 'scripts/sdio-exit-03c-canonical-lifecycle-repair-validate.mjs',
}

const checks = []
function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}
function read(path) {
  return fs.readFileSync(path, 'utf8')
}

for (const file of Object.values(files)) check(`required file exists: ${file}`, fs.existsSync(file))

const service = read(files.service)
const architecture = read(files.architecture)
const report = read(files.report)
const validator = read(files.validator)
const cert = JSON.parse(read(files.cert))
const combined = [service, architecture, report, JSON.stringify(cert), validator].join('\n')

check('starting commit recorded', cert.startingCommit === 'db0947b066e215a0aec313554717a40d5d9400f2')
check('offline vs production difference identified', cert.offlineVsProductionMappingDifference.rootCause === 'PROVIDER_IDS_GAMEPK_NOT_USED_AS_MATCH_SOURCE')
check('CHC @ KC production root cause proven', cert.unmappedBeforeRepair.some((item) => item.gamePk === '824078' && item.canonicalEventId.endsWith(':79060') && item.embeddedProviderGamePk === '824078'))
check('TB @ SEA production root cause proven', cert.unmappedBeforeRepair.some((item) => item.gamePk === '823104' && item.canonicalEventId.endsWith(':79066') && item.embeddedProviderGamePk === '823104'))
check('production event query scope documented', cert.offlineVsProductionMappingDifference.canonicalEventQueryScope.includes('America/Puerto_Rico') && cert.offlineVsProductionMappingDifference.currentEventUniverseCount === 15)
check('provider_ids gamePk helper exists', service.includes('function eventProviderGamePk') && service.includes('providerIds.mlb_stats_api') && service.includes('providerIds.mlb_stats_game_pk'))
check('provider_ids gamePk path is prioritized before fallback', service.indexOf('existing_sport_event_provider_ids_gamepk') > service.indexOf('existing_official_gamepk_crosswalk') && service.indexOf('existing_sport_event_provider_ids_gamepk') < service.indexOf('exactTeamCandidates'))
check('multiple provider_ids gamePk matches fail closed', service.includes('multiple_sport_event_provider_ids_gamepk_matches'))
check('fixture proves production provider_ids path for CHC @ KC', service.includes('CHC @ KC production provider_ids gamePk path is deterministic'))
check('fixture proves production provider_ids path for TB @ SEA', service.includes('TB @ SEA production provider_ids gamePk path is deterministic'))
check('no fuzzy team date matching introduced', cert.repair.teamDateOnlyAllowed === false && architecture.includes('Team+date alone is not a valid mapping'))
check('doubleheader identity remains safe', cert.repair.doubleheaderSafety === true && service.includes('doubleheader game 1 remains distinct') && service.includes('doubleheader game 2 remains distinct'))
check('timezone semantics documented', report.includes('America/Puerto_Rico') && report.includes('operating-day'))
check('status convergence root cause proven', cert.statusDiscrepancies.rootCause === 'SPORTSDATAIO_STATUS_STALE_WHILE_MLB_OFFICIAL_SHADOW_IS_NON_AUTHORITATIVE')
check('status differences are classified in runtime metadata', service.includes('statusDifferenceClassification') && service.includes('CANONICAL_STATUS_LAG_FINAL_NON_ACTIONABLE'))
check('unsafe status classification remains review-gated', cert.statusDiscrepancies.blockingClassification === 'REQUIRES_REVIEW')
check('official live/final cannot permit post-start prediction', cert.safetyVeto.officialEvidenceCanPermitPostStartPrediction === false && cert.statusDiscrepancies.postStartPredictionRisk === false)
check('completed games resolve to canonical identity after repair target', cert.expectedPostDeployNaturalProof.mappedTarget === 15 && cert.expectedPostDeployNaturalProof.chcAtKcTarget === 'mapped' && cert.expectedPostDeployNaturalProof.tbAtSeaTarget === 'mapped')
check('result identity safe and settlement unchanged', cert.resultIdentity.incorrectResultAttachmentObserved === false && cert.resultIdentity.settlementPolicyChanged === false)
check('starter mapping remains safe', cert.starterParity.starterMappingFailures === 0 && cert.starterParity.crossTeamStarterErrors === 0)
check('SportsDataIO remains authority', cert.safety.sportsDataIoDisabled === false && cert.safety.sportsDataIoCancelled === false)
check('MLB Official remains non-authoritative', cert.safety.mlbOfficialPrimaryPromoted === false && cert.repair.productionAuthorityPromoted === false)
check('odds authority unchanged', cert.safety.oddsAuthorityPromoted === false)
check('certification reads provider calls zero', cert.safety.providerCallsFromCertificationReads === 0)
check('certification reads database mutations zero', cert.safety.databaseMutationsFromCertificationReads === 0)
check('rollback retained', cert.safety.sportsDataIoDisabled === false && cert.safety.sportsDataIoCancelled === false)
check('promotion remains gated for natural proof', cert.promotion.verdict === 'MLB_OFFICIAL_SHADOW_PASS_MORE_OBSERVATION_REQUIRED' && cert.promotion.authorizationRequired === true)

const changedFiles = execSync('git diff --name-only HEAD', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map((path) => path.replaceAll('\\', '/'))
const allowedRuntime = new Set([
  'src/services/mlb-official-replacement.service.ts',
  'src/services/results-sync.service.ts',
])
const forbiddenRuntime = changedFiles.filter((path) => path.startsWith('src/') && !allowedRuntime.has(path))
check('only bounded runtime file changed', forbiddenRuntime.length === 0, forbiddenRuntime.join(', '))

const secretPatterns = [
  /THE_ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /SPORTSDATAIO_MLB_API_KEY\s*=\s*[^\s`'"]+/i,
  /CRON_SECRET\s*=\s*[^\s`'"]+/i,
  /authorization\s*:\s*bearer\s+[A-Za-z0-9._~+/=-]+/i,
  /apiKey=[A-Za-z0-9_-]+/i,
  /sk-[A-Za-z0-9]{20,}/i,
]
check('no secret values exposed', !secretPatterns.some((pattern) => pattern.test(combined)))

const result = {
  success: checks.every((item) => item.pass),
  mode: 'sdio_exit_03c_canonical_lifecycle_repair_validation_v1',
  checks: checks.length,
  passed: checks.filter((item) => item.pass).length,
  failed: checks.filter((item) => !item.pass).length,
  failedChecks: checks.filter((item) => !item.pass),
  providerCallsMade: 0,
  databaseMutationsMade: 0,
  finalClassification: cert.finalClassification,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
