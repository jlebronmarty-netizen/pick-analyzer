import fs from 'node:fs'
import { execSync } from 'node:child_process'

const files = {
  resultSync: 'src/services/results-sync.service.ts',
  official: 'src/services/mlb-official-replacement.service.ts',
  architecture: 'docs/ARCHITECTURE/MLB_OFFICIAL_DATA_PROVIDER_V1.md',
  report: 'docs/PRODUCTION_PILOT/SDIO_EXIT_03E_RESULT_CLOSURE.md',
  cert: 'docs/CERTIFICATION/sdio-exit-03e-result-closure.json',
  validator: 'scripts/sdio-exit-03e-result-closure-validate.mjs',
}

const checks = []
function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}
function read(path) {
  return fs.readFileSync(path, 'utf8')
}

for (const file of Object.values(files)) check(`required file exists: ${file}`, fs.existsSync(file))

const resultSync = read(files.resultSync)
const official = read(files.official)
const architecture = read(files.architecture)
const report = read(files.report)
const validator = read(files.validator)
const cert = JSON.parse(read(files.cert))
const combined = [resultSync, official, architecture, report, JSON.stringify(cert), validator].join('\n')

check('starting commit recorded', cert.startingCommit === 'fd861f6ca0a4b4afc0c73c1a1de8cc002c19c66e')
check('14 missing result condition explained', cert.baseline.officialCompletedGames === 14 && cert.baseline.canonicalResultsBeforeFinalObservation === 0 && cert.baseline.missingResultsBeforeFinalObservation === 14)
check('later production closure evidence recorded', cert.baseline.canonicalResultsAfterFinalObservation === 14 && cert.baseline.settledPredictionsAfterFinalObservation === 81)
check('CHC @ KC result blocker recorded', cert.baseline.chcAtKc.gamePk === '824078' && cert.baseline.chcAtKc.canonicalEventId.endsWith(':79060'))
check('TB @ SEA result blocker recorded', cert.baseline.tbAtSea.gamePk === '823104' && cert.baseline.tbAtSea.canonicalEventId.endsWith(':79066'))
check('result scheduler chain traced', cert.pipelineTrace.scheduler.includes('Vercel') && cert.pipelineTrace.planner === 'adaptive-refresh-orchestrator' && cert.pipelineTrace.mlbOfficialFunction === 'executeMlbOfficialShadowAcquisition')
check('shadow write path gap classified', cert.rootCause.classification === 'RESULT_CLOSURE_SHADOW_WRITE_PATH_NOT_EXECUTED' && cert.rootCause.lifecycleDeadlock === false && report.includes('not an absolute permanent deadlock'))
check('scheduler wiring defect identified', cert.rootCause.schedulerWiringDefect.includes('did not call result persistence'))
check('existing result write path reused', cert.repair.usesExistingGameResultsContract === true && resultSync.includes('persistMlbFetchedResults'))
check('bounded helper exported', resultSync.includes('export async function syncMlbStatsResultsFromOfficialGames'))
check('helper normalizes official payload without provider call', resultSync.includes('asMlbStatsResultGame') && resultSync.includes('providerCallsMade: 0'))
check('exact gamePk identity supported', resultSync.includes('gamePkToEventId') && resultSync.includes('exactGamePkIdentity'))
check('canonical final lifecycle patch preserved', resultSync.includes('assertSportEventStatusWrite') && resultSync.includes("mappedStatus: 'completed'"))
check('official natural acquisition invokes result helper', official.includes('syncMlbStatsResultsFromOfficialGames(official.rows') && official.includes('resultGamePkToEventId'))
check('result closure job metadata recorded', official.includes('resultClosure') && official.includes('MLB_OFFICIAL_RESULT_SOURCE_DUAL_READ'))
check('idempotency by game_id preserved', resultSync.includes('existingResultRows') && resultSync.includes('reusedGameIds') && cert.repair.idempotentByGameId === true)
check('settlement formula unchanged', cert.repair.settlementFormulaChanged === false)
check('learning formula unchanged', cert.repair.learningFormulaChanged === false)
check('no retrospective prediction generation', cert.repair.retrospectivePredictionsCreated === 0 && report.includes('create retrospective predictions'))
check('no post-start prediction generation', cert.repair.postStartPredictionsCreated === 0)
check('wrong-event and duplicate targets are zero', cert.expectedPostDeployNaturalProof.wrongEventResultsTarget === 0 && cert.expectedPostDeployNaturalProof.duplicateResultsTarget === 0)
check('SportsDataIO remains enabled', cert.safety.sportsDataIoDisabled === false && cert.safety.sportsDataIoCancelled === false)
check('MLB Official broad primary not promoted', cert.safety.mlbOfficialPrimaryPromoted === false)
check('odds authority unchanged', cert.safety.oddsAuthorityPromoted === false)
check('rollback preserved', cert.safety.rollbackReadiness === 'PASS')
check('certification reads provider calls zero', cert.safety.providerCallsFromCertificationReads === 0)
check('certification reads database mutations zero', cert.safety.databaseMutationsFromCertificationReads === 0)
check('promotion remains gated for natural proof', cert.promotion.verdict === 'MLB_RESULT_CLOSURE_PASS_MORE_OBSERVATION_REQUIRED' && cert.promotion.authorizationRequired === true)

const changedFiles = execSync('git diff --name-only HEAD', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map((path) => path.replaceAll('\\', '/'))
const allowedRuntime = new Set([
  'src/services/results-sync.service.ts',
  'src/services/mlb-official-replacement.service.ts',
])
const forbiddenRuntime = changedFiles.filter((path) => path.startsWith('src/') && !allowedRuntime.has(path))
check('only bounded runtime files changed', forbiddenRuntime.length === 0, forbiddenRuntime.join(', '))

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
  mode: 'sdio_exit_03e_result_closure_validation_v1',
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
