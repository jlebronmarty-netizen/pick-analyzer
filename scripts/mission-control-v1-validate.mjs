import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const root = process.cwd()
const checks = []

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function json(relativePath) {
  return JSON.parse(read(relativePath))
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const requiredFiles = [
  'docs/MISSION_CONTROL/README.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_PROGRAM_V2.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STOP_CONDITIONS.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_RESUME_GUIDE.md',
  'docs/CERTIFICATION/MISSION_CONTROL_V1.md',
  'docs/CERTIFICATION/mission-control-v1.json',
  'docs/OPERATIONAL_EXCELLENCE/MISSION_CONTROL_V1_IMPLEMENTATION.md',
  'src/services/mission-control.service.ts',
  'src/app/api/mission-control/route.ts',
  'src/app/mission-control/page.tsx',
]

for (const file of requiredFiles) {
  check(`required file exists: ${file}`, exists(file))
}

const status = json('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json')
const certification = json('docs/CERTIFICATION/mission-control-v1.json')
const service = read('src/services/mission-control.service.ts')
const route = read('src/app/api/mission-control/route.ts')
const page = read('src/app/mission-control/page.tsx')
const program = read('docs/MISSION_CONTROL/MISSION_CONTROL_PROGRAM_V2.md')
const queueDoc = read('docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md')
const stopDoc = read('docs/MISSION_CONTROL/MISSION_CONTROL_STOP_CONDITIONS.md')
const resume = read('docs/MISSION_CONTROL/MISSION_CONTROL_RESUME_GUIDE.md')
const projectStatus = read('docs/PROJECT_STATUS.md')
const roadmap = read('docs/MASTER_ROADMAP.md')
const startHere = read('START_HERE.md')
const certReadme = read('docs/CERTIFICATION/README.md')
const docsReadme = read('docs/README.md')

const requiredCategories = [
  'OPERATIONAL_READINESS',
  'MULTI_SPORT_DATA',
  'MULTI_SPORT_PREDICTION',
  'SETTLEMENT_AND_LEARNING',
  'PERFORMANCE_INTELLIGENCE',
  'DECISION_CORE_EVOLUTION',
  'MARKET_EXPANSION',
  'PRODUCT_EXPERIENCE',
  'AUTOMATION',
  'PROVIDER_INTEGRATION',
  'CERTIFICATION',
  'DOCUMENTATION',
  'TECHNICAL_DEBT',
  'EXTERNAL_DEPENDENCY',
]
const requiredStates = [
  'PLANNED',
  'READY',
  'ACTIVE',
  'PAUSED',
  'BLOCKED',
  'CONDITIONAL_PASS',
  'LOCALLY_COMPLETE',
  'DEPLOYED',
  'PRODUCTION_CERTIFIED',
  'SUPERSEDED',
  'CANCELLED',
  'UNKNOWN',
]
const requiredModes = ['MANUAL_ONLY', 'AGENT_ASSISTED', 'AUTONOMOUS_ELIGIBLE', 'AUTONOMOUS_ACTIVE', 'EXTERNAL_WAIT', 'READ_ONLY']
const requiredSports = ['MLB', 'NBA', 'NFL', 'NHL', 'Soccer', 'Tennis', 'UFC', 'BSN']
const requiredStops = ['HARD_STOP', 'MISSION_BLOCK', 'SPORT_BLOCK', 'PROVIDER_BLOCK', 'EXTERNAL_WAIT', 'HUMAN_APPROVAL']
const protectedDirtyFiles = [
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'docs/OPERATIONAL_EXCELLENCE/MORNING_OPERATIONAL_CHECKLIST.md',
  'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
  'docs/build-memory-optimization-v1-phase-b-final.json',
  'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
  'docs/build-memory-optimization-v1-phase-b.json',
]

check('status baseline commit is current baseline', status.baselineCommit === 'ddc79d7b4a5efa5068ff1e63bb68d95d84100e67')
check('certification baseline commit is current baseline', certification.baselineCommit === status.baselineCommit)
check('current mission is MC-00 or later Mission Control mission', ['MC-00', 'MC-01', 'MC-02'].includes(status.currentMission?.id))
check('next mission is deterministic', ['MC-01', 'MC-02', 'MC-08'].includes(status.nextMission?.id))
check('only MC-08 bounded product package may be active in status', status.missionCounts?.active === 0 || (status.missionCounts?.active === 1 && status.nextMission?.id === 'MC-08' && status.nextMission?.state === 'ACTIVE'))
check('mission count covers MC-00 through MC-10', status.missionCounts?.total === 11)
check('all required categories documented', requiredCategories.every((item) => status.taxonomies?.categories?.includes(item) && service.includes(item)))
check('all required states documented', requiredStates.every((item) => status.taxonomies?.states?.includes(item) && service.includes(item)))
check('all required modes documented', requiredModes.every((item) => status.taxonomies?.modes?.includes(item) && service.includes(item)))
check('all priorities documented', ['P0', 'P1', 'P2', 'P3', 'P4'].every((item) => status.taxonomies?.priorities?.includes(item) && service.includes(item)))
check('all required sports represented', requiredSports.every((item) => Object.prototype.hasOwnProperty.call(status.sportReadiness, item) && service.includes(`sport: '${item}'`)))
check('MLB is certified only DATA_READY sport', ['CERTIFIED', 'DATA_READY'].includes(status.sportReadiness.MLB) && !Object.entries(status.sportReadiness).some(([sport, state]) => sport !== 'MLB' && ['CERTIFIED', 'DATA_READY'].includes(state)))
check('OE-003A through OE-003F represented', ['OE-003A', 'OE-003B', 'OE-003C', 'OE-003D', 'OE-003E', 'OE-003F'].every((item) => service.includes(item) && certification.recentCertifiedEvidence.includes(item)))
check('stop condition types all documented', requiredStops.every((item) => stopDoc.includes(item) && service.includes(item)))
check('read-only API route only exports GET', route.includes('export async function GET') && !route.includes('POST') && !route.includes('PATCH') && !route.includes('DELETE'))
check('API route uses shared api contract', route.includes('apiOk') && route.includes('apiError') && route.includes('requestId'))
check('API route calls mission service', route.includes('getMissionControl'))
check('page is dynamic and read-only', page.includes("dynamic = 'force-dynamic'") && page.includes('getMissionControl') && page.includes('READ ONLY'))
check('page exposes mission queue', page.includes('Mission Queue') && page.includes('Sport Readiness') && page.includes('Provider Readiness'))
check('service exposes required response sections', ['currentMission', 'nextMission', 'queue', 'autonomousReadiness', 'projectHealth', 'sportReadiness', 'providerReadiness', 'recentCompletions', 'blockers', 'stopConditions', 'productionVersion', 'documentationVersion', 'generatedAt', 'evidence'].every((item) => service.includes(item)))
check('service composes OE read-only systems', ['getOperationsHealth', 'getEventLifecycleState', 'getEventRefreshPlan', 'getProviderBudgetStatus'].every((item) => service.includes(item)))
check('service reports zero provider calls', service.includes('providerCallsMade: 0') && certification.guardrails.providerCallsMade === 0)
check('service reports zero remote mutations', service.includes('remoteMutationsMade: 0') && certification.guardrails.remoteMutationsMade === 0)
check('service does not import provider adapters', !/from ['"].*adapter.*['"]/.test(service))
check('service does not expose mutation executors', !/\b(insert|upsert|delete|executeProtected|fetchProvider)\b/.test(service))
check('certification says local server smoke was not run', certification.guardrails.localServerSmokeRun === false)
check('certification says manual deployment was not run', certification.guardrails.manualDeployment === false)
check('resume guide contains reusable prompt', resume.includes('Reusable Continuation Prompt') && resume.includes('Use Mission Control to identify the next READY mission'))
check('queue doc keeps future gated missions inactive', queueDoc.includes('MC-03 remains PLANNED') && queueDoc.includes('MC-08 | Daily Betting Product Completion | PRODUCT_EXPERIENCE | P2 | ACTIVE'))
check('program documents source boundaries', program.includes('Source Boundaries') && program.includes('Mission Control owns only current execution state'))
check('project status updated for Mission Control', projectStatus.includes('Mission Control V1') && projectStatus.includes('MC-01 Operational Readiness Closure'))
check('master roadmap updated for Mission Control', roadmap.includes('Mission Control V1 update') && roadmap.includes('MC-01 Operational Readiness Closure'))
check('START_HERE links Mission Control', startHere.includes('docs/MISSION_CONTROL/README.md'))
check('docs README links Mission Control', docsReadme.includes('MISSION_CONTROL/README.md'))
check('certification README links Mission Control', certReadme.includes('mission-control-v1.json'))

for (const artifact of [
  'docs/CERTIFICATION/oe-003a-scheduler-health-semantics.json',
  'docs/CERTIFICATION/oe-003b-provider-budget-ledger-normalization.json',
  'docs/CERTIFICATION/oe-003c-per-event-lifecycle-state.json',
  'docs/CERTIFICATION/oe-003d-event-level-refresh-planner.json',
  'docs/CERTIFICATION/oe-003e-canonical-acquisition-active-execution.json',
  'docs/CERTIFICATION/oe-003f-product-freshness-sla.json',
]) {
  check(`OE artifact exists: ${artifact}`, exists(artifact))
}

const gitStatus = execSync('git status --short', { cwd: root, encoding: 'utf8' })
const stagedFiles = execSync('git diff --cached --name-only', { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
check('protected dirty files are not staged', protectedDirtyFiles.every((file) => !stagedFiles.includes(file)))
check('status output still includes protected dirty context or intended mission files', protectedDirtyFiles.some((file) => gitStatus.includes(file)) || gitStatus.includes('docs/MISSION_CONTROL'))

const failed = checks.filter((item) => !item.passed)
const result = {
  success: failed.length === 0,
  mode: 'mission_control_v1_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
