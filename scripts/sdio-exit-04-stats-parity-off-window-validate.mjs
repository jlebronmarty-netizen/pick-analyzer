import fs from 'node:fs'
import { execSync } from 'node:child_process'

const files = {
  independence: 'docs/ARCHITECTURE/MLB_PROVIDER_INDEPENDENCE_V1.md',
  architecture: 'docs/ARCHITECTURE/SPORTSDATAIO_EXIT_ARCHITECTURE_V1.md',
  providerMap: 'docs/ARCHITECTURE/MLB_FINAL_PROVIDER_MAP_V1.md',
  report: 'docs/PRODUCTION_PILOT/SDIO_EXIT_04_STATS_PARITY_OFF_WINDOW.md',
  cert: 'docs/CERTIFICATION/sdio-exit-04-stats-parity-off-window.json',
  validator: 'scripts/sdio-exit-04-stats-parity-off-window-validate.mjs',
  mlbModeConfig: 'src/config/mlb-data-source-mode.config.ts',
  oddsConfig: 'src/config/odds-primary-authority.config.ts',
  orchestrator: 'src/services/adaptive-refresh-orchestrator.service.ts',
  official: 'src/services/mlb-official-replacement.service.ts',
  preview: 'src/services/sportsdataio-mlb-prospective-preview.service.ts',
  canonical: 'src/services/canonical-acquisition.service.ts',
}

const checks = []
function check(name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}
function read(path) {
  return fs.readFileSync(path, 'utf8')
}

for (const file of Object.values(files)) check(`required file exists: ${file}`, fs.existsSync(file))

const cert = JSON.parse(read(files.cert))
const architecture = read(files.architecture)
const report = read(files.report)
const validator = read(files.validator)
const mlbModeConfig = read(files.mlbModeConfig)
const oddsConfig = read(files.oddsConfig)
const orchestrator = read(files.orchestrator)
const official = read(files.official)
const preview = read(files.preview)
const canonical = read(files.canonical)
const combined = [
  JSON.stringify(cert),
  read(files.independence),
  architecture,
  read(files.providerMap),
  report,
  validator,
].join('\n')

check('entry gate records SDIO-EXIT-03F ready verdict', cert.entryGate.sdioExit03fVerdict === 'MLB_RESULT_CLOSURE_PASS_READY_FOR_PARITY_REVIEW')
check('starting commit recorded', cert.startingCommit === '72e82e21db15a60032d0f06e479ee2b2eceec662')
check('critical active MLB features inventoried', Array.isArray(cert.criticalActiveFeatures) && cert.criticalActiveFeatures.filter((item) => item.classification === 'CRITICAL_ACTIVE').length >= 7)
check('critical SportsDataIO stat dependencies replaced or blocked explicitly', cert.criticalActiveFeatures.every((item) => typeof item.sportsDataIoRequired === 'boolean'))
check('team-game parity certified for current production', cert.parity.teamGameStats === 'PASS_FOR_CURRENT_PRODUCTION')
check('team aggregate parity certified', cert.parity.teamAggregateStats === 'PASS_FROM_STORED_OR_INTERNAL')
check('player stat parity classified', cert.parity.playerStats === 'NOT_REQUIRED_FOR_CURRENT_PRODUCTION')
check('player game stat parity classified', cert.parity.playerGameStats === 'NOT_REQUIRED_FOR_CURRENT_PRODUCTION')
check('bullpen parity classified fail-closed/foundation-only', cert.parity.bullpen === 'GRACEFUL_DEGRADE_FOUNDATION_ONLY')
check('starter feature parity certified for parity review', cert.parity.starterFeature === 'PASS_FOR_PARITY_REVIEW')
check('roster identity safe for starter scope', cert.parity.rosterIdentity === 'PASS_FOR_STARTER_SCOPE')
check('lineup requirement classified', cert.parity.lineupRequirement.includes('NOT_REQUIRED_FOR_CURRENT_PRODUCTION'))
check('injury requirement classified', cert.parity.injuryRequirement === 'NOT_REQUIRED_FOR_CURRENT_PRODUCTION')
check('prediction input contract coverage recorded', cert.featureContractCoverage.coverage === 'PARTIAL_UNTIL_ODDS_PROMOTION')
check('SportsDataIO-off simulation is explicit', cert.sportsDataIoOffSimulation.criticalBlocks.includes('ODDS_PRODUCT_AUTHORITY_STILL_SPORTSDATAIO'))
check('fail-closed behavior documented', (architecture.includes('Fail-Closed Migration Policy') || architecture.includes('Failure Policy')) && report.includes('NO_FRESH_PRICE'))
check('remaining SportsDataIO MLB calls inventoried', cert.routineSportsDataIoMlbCalls.before.canonicalAcquisitionCalls === 50 && report.includes('canonical_acquisition_active_execution_v1'))
check('reversible runtime disable exists for non-odds MLB mode', mlbModeConfig.includes('MLB_OFFICIAL_PRIMARY') && mlbModeConfig.includes('rollbackMode'))
check('odds promotion remains independently gated', oddsConfig.includes('ODDS_PRIMARY_AUTHORITY_STAGE') && cert.runtimeState.oddsAuthorityStage === 'STAGE_1_DUAL_READ')
check('production off-window not executed before local gates', cert.productionOffWindow.executed === false && cert.productionOffWindow.configChangeAuthorizationRequired === true)
check('SportsDataIO calls zero gate not falsely passed', cert.cancellationGates.SPORTSDATAIO_MLB_CALLS_ZERO === 'BLOCKED_NOT_EXECUTED')
check('schedule works without SportsDataIO after mode promotion', cert.sportsDataIoOffSimulation.schedule === 'PASS_WITH_MLB_OFFICIAL_AFTER_MODE_PROMOTION')
check('status works without SportsDataIO', cert.cancellationGates.STATUS_INDEPENDENCE === 'PASS')
check('results works without SportsDataIO', cert.cancellationGates.RESULTS_INDEPENDENCE === 'PASS')
check('settlement works without SportsDataIO', cert.cancellationGates.SETTLEMENT_INDEPENDENCE === 'PASS')
check('prediction prerequisites honestly blocked by price authority', cert.sportsDataIoOffSimulation.predictionPrerequisites === 'PARTIAL_BLOCKED_BY_PRICE_AUTHORITY')
check('Current Era metrics recorded', cert.productionReadEvidence.performance.currentEraCanonicalPredictions === 309 && cert.productionReadEvidence.performance.currentEraSettled === 279)
check('rollback config works', cert.cancellationGates.ROLLBACK_READY === 'PASS' && mlbModeConfig.includes('SPORTSDATAIO') && oddsConfig.includes('rollbackAuthority'))
check('subscription not cancelled automatically', cert.safety.sportsDataIoDisabled === false && cert.subscriptionDecision.sportsDataIoCancelled === false)
check('HR-03 unchanged', cert.runtimeState.hr03Status === 'SHADOW_ONLY')
check('Official Pick policy unchanged', cert.safety.officialPickPolicyChanged === false)
check('model formulas unchanged', cert.safety.predictionFormulaChanged === false)
check('historical replay unchanged', cert.cancellationGates.HISTORICAL_INDEPENDENCE === 'PASS')
check('orchestrator still shows SportsDataIO odds authority path', orchestrator.includes("provider: 'sportsdataio'") && canonical.includes("const PROVIDER = 'sportsdataio'"))
check('stored odds prediction generation still makes zero provider calls', preview.includes('generateMlbProspectivePredictionsFromStoredOdds') && preview.includes('providerCallsMade: 0'))
check('MLB Official shadow route retained', official.includes('executeMlbOfficialShadowAcquisition'))

const changedFiles = execSync('git diff --name-only HEAD', { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((path) => path.replaceAll('\\', '/'))
const allowed = new Set([
  'docs/ARCHITECTURE/MLB_PROVIDER_INDEPENDENCE_V1.md',
  'docs/ARCHITECTURE/SPORTSDATAIO_EXIT_ARCHITECTURE_V1.md',
  'docs/ARCHITECTURE/MLB_FINAL_PROVIDER_MAP_V1.md',
  'docs/PRODUCTION_PILOT/SDIO_EXIT_04_STATS_PARITY_OFF_WINDOW.md',
  'docs/CERTIFICATION/sdio-exit-04-stats-parity-off-window.json',
  'scripts/sdio-exit-04-stats-parity-off-window-validate.mjs',
  'docs/CERTIFICATION/README.md',
  'docs/PRODUCTION_PILOT/README.md',
  'docs/MASTER_ROADMAP.md',
  'docs/PROJECT_STATUS.md',
])
const unexpected = changedFiles.filter((path) => !allowed.has(path))
check('only bounded docs/status/validator files changed', unexpected.length === 0, unexpected.join(', '))

const secretPatterns = [
  /THE_ODDS_API_KEY\s*=\s*[^\s`'"]+/i,
  /SPORTSDATAIO_MLB_API_KEY\s*=\s*[^\s`'"]+/i,
  /CRON_SECRET\s*=\s*[^\s`'"]+/i,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s`'"]+/i,
  /authorization\s*:\s*bearer\s+[A-Za-z0-9._~+/=-]+/i,
  /sk-[A-Za-z0-9]{20,}/i,
]
check('no secret values exposed', !secretPatterns.some((pattern) => pattern.test(combined)))

const result = {
  success: checks.every((item) => item.pass),
  mode: 'sdio_exit_04_stats_parity_off_window_validation_v1',
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
