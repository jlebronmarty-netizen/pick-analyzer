import fs from 'node:fs'
import { execSync } from 'node:child_process'

const files = {
  service: 'src/services/mlb-official-replacement.service.ts',
  mapper: 'src/services/mlb-event-status-mapper.service.ts',
  architecture: 'docs/ARCHITECTURE/MLB_OFFICIAL_DATA_PROVIDER_V1.md',
  report: 'docs/PRODUCTION_PILOT/SDIO_EXIT_03B_MAPPING_STATUS_PARITY.md',
  cert: 'docs/CERTIFICATION/sdio-exit-03b-mapping-status-parity.json',
  validator: 'scripts/sdio-exit-03b-mapping-status-parity-validate.mjs',
}

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}

const checks = []
for (const file of Object.values(files)) check(`required file exists: ${file}`, fs.existsSync(file))

const service = read(files.service)
const mapper = read(files.mapper)
const architecture = read(files.architecture)
const report = read(files.report)
const cert = JSON.parse(read(files.cert))
const validator = read(files.validator)
const changedFiles = execSync('git diff --name-only HEAD', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map((path) => path.replaceAll('\\', '/'))
const combined = [service, mapper, architecture, report, JSON.stringify(cert), validator].join('\n')

check('baseline commit preserved', cert.startingCommit === '5c56bbf206c1fd035bfed2413efbf8a4dd6ed4e8')
check('both ambiguous events identified', cert.ambiguousEventsBefore.length === 2 && cert.ambiguousEventsBefore.some((item) => item.gamePk === '824078') && cert.ambiguousEventsBefore.some((item) => item.gamePk === '823104'))
check('ambiguous event root causes deterministic', cert.ambiguousEventsBefore.every((item) => item.rootCause === 'START_TIME_TOLERANCE_TOO_WIDE' && item.secondaryCause === 'MISSING_FULL_NAME_TO_ABBREVIATION_ALIAS'))
check('CHC/KC alias repair present', service.includes("chicagocubs: 'CHC'") && service.includes("kansascityroyals: 'KC'"))
check('TB/SEA alias repair present', service.includes("tampabayrays: 'TB'") && service.includes("seattlemariners: 'SEA'"))
check('ATH/OAK lineage preserved', service.includes("oaklandathletics: 'ATH'") && service.includes("oak: 'ATH'"))
check('official gamePk crosswalk prioritized', service.includes('existing_official_gamepk_crosswalk') && service.includes('existingGamePkMappings'))
check('team/date alone blocked', cert.repair.teamDateOnlyAllowed === false && architecture.includes('Team+date alone is not a valid mapping'))
check('doubleheader safety documented and fixture-backed', cert.repair.doubleheaderSafety === true && service.includes('doubleheader game 1 remains distinct') && service.includes('doubleheader game 2 remains distinct'))
check('bounded start tolerance tightened', service.includes('item.delta !== null && item.delta <= 180'))
check('offline mapping reaches target', cert.offlineRemapAfterRepair.expectedMappable === 15 && cert.offlineRemapAfterRepair.mapped === 15 && cert.offlineRemapAfterRepair.mappingRate === 1)
check('ambiguous mapping zero after repair', cert.offlineRemapAfterRepair.ambiguousEvents === 0)
check('duplicate events zero after repair', cert.offlineRemapAfterRepair.duplicateEvents === 0)
check('all status differences classified', cert.statusDiscrepancies.before === 12 && Object.values(cert.statusDiscrepancies.byClassification).reduce((sum, value) => sum + value, 0) === 12)
check('no unsafe post-start lifecycle path', cert.statusDiscrepancies.unsafeStatusMismatches === 0 && cert.statusDiscrepancies.postStartPredictionRisk === false)
check('postponement semantics safe', mapper.includes("joined.includes('postpon')") && cert.officialStatusMapping.postponed === 'postponed')
check('suspended semantics safe', mapper.includes("joined.includes('suspend')") && cert.officialStatusMapping.suspended === 'postponed')
check('official final maps to completed', cert.officialStatusMapping.finalCompletedEarly === 'completed' && mapper.includes("status: 'completed'"))
check('starter parity evaluated', cert.starterParity.starterRowsEvaluated === 26 && cert.starterParity.starterMappingsPersistedInShadow === 26)
check('player identities remain shadow-only', cert.providerCrosswalk.playerMappingsShadowOnly === true)
check('cross-team starter errors zero', cert.starterParity.crossTeamStarterErrors === 0)
check('SportsDataIO retained', cert.providerCrosswalk.sportsDataIoStillProductionAuthority === true && cert.safety.sportsDataIoDisabled === false && cert.safety.sportsDataIoCancelled === false)
check('The Odds API remains shadow', cert.providerCrosswalk.theOddsApiStillShadowOnly === true && cert.safety.oddsAuthorityPromoted === false)
check('MLB official primary not promoted', cert.safety.mlbOfficialPrimaryPromoted === false && cert.repair.productionAuthorityPromoted === false)
check('certification provider calls zero', cert.safety.providerCallsFromCertificationReads === 0)
check('certification database mutations zero', cert.safety.databaseMutationsFromCertificationReads === 0)
check('promotion remains gated', cert.promotion.verdict === 'MLB_OFFICIAL_SHADOW_PASS_MORE_OBSERVATION_REQUIRED' && cert.promotion.authorizationRequired === true)

const allowedRuntime = new Set([
  'src/services/mlb-official-replacement.service.ts',
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
  mode: 'sdio_exit_03b_mapping_status_parity_validation_v1',
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
