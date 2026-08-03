import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function parseJson(relativePath) {
  return JSON.parse(read(relativePath))
}

const checks = []

function check(name, condition, detail = '') {
  checks.push({ name, pass: Boolean(condition), detail })
}

const service = read('src/services/mission-control.service.ts')
const queueDoc = read('docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md')
const status = parseJson('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json')
const auditDoc = read('docs/MISSION_CONTROL/MC_02_1_QUEUE_AUDIT.md')
const cert = parseJson('docs/CERTIFICATION/mc-02-1-queue-audit.json')
const projectStatus = read('docs/PROJECT_STATUS.md')
const roadmap = read('docs/MASTER_ROADMAP.md')

const missionIds = ['MC-00', 'MC-01', 'MC-02', 'MC-03', 'MC-04', 'MC-05', 'MC-06', 'MC-07', 'MC-08', 'MC-09', 'MC-10']
const correctOrder = ['MC-00', 'MC-01', 'MC-02', 'MC-08', 'MC-03', 'MC-04', 'MC-05', 'MC-06', 'MC-07', 'MC-09', 'MC-10']

check('status remains on MC-02 certification', status.currentMission?.id === 'MC-02' && status.currentMission?.state === 'PRODUCTION_CERTIFIED')
check('next mission remains MC-08', status.nextMission?.id === 'MC-08' && status.nextMission?.state === 'READY')
check('MC-03 remains manual-only and not started in queue doc', queueDoc.includes('| MC-03 |') && queueDoc.includes('MANUAL_ONLY') && queueDoc.includes('MC-03 remains PLANNED and manual-only'))
check('service keeps MC-03 manual-only', service.includes("id: 'MC-03'") && service.includes("mode: 'MANUAL_ONLY'") && service.includes("readiness: 'NOT_READY'"))
check('service computes MC-08 as next ready mission after MC-02', service.includes("!['MC-00', 'MC-01', 'MC-02'].includes(mission.id)") && service.includes("mission.readiness === 'READY'"))
check('all Mission Control missions are inventoried', missionIds.every((id) => auditDoc.includes(`| ${id} |`)))
check('audit documents correct non-numeric execution order', correctOrder.every((id, index) => cert.correctExecutionOrder?.[index] === id))
check('audit explains why MC-08 appeared', Array.isArray(cert.whyMc08Appeared) && cert.whyMc08Appeared.length >= 5 && auditDoc.includes('Why MC-08 Appeared'))
check('audit says MC-03 should not come next', cert.mc03ShouldComeNext === false && auditDoc.includes('Should MC-03 come next: `false`'))
check('audit recommends MC-08', cert.recommendedNextMission === 'MC-08' && auditDoc.includes('Recommended next mission: `MC-08 Daily Betting Product Completion`'))
check('dependency graph has no circular self-dependencies', Object.entries(cert.dependencyGraph ?? {}).every(([id, dependencies]) => Array.isArray(dependencies) && !dependencies.includes(id)))
check('MC-04 remains downstream of MC-03', cert.dependencyGraph?.['MC-04']?.includes('MC-03'))
check('MC-08 is independent from MC-03', !cert.dependencyGraph?.['MC-08']?.includes('MC-03'))
check('queue repair was not required', cert.scope?.queueRepairRequired === false && Array.isArray(cert.queueChanges) && cert.queueChanges.length === 0)
check('audit is read-only', cert.scope?.readOnlyAudit === true && cert.scope?.runtimeBehaviorChanged === false)
check('prediction and model behavior unchanged', cert.scope?.predictionChanged === false && cert.scope?.modelChanged === false && cert.scope?.officialPicksChanged === false)
check('provider and scheduler behavior unchanged', cert.scope?.providersChanged === false && cert.scope?.schedulerChanged === false && cert.scope?.refreshCadenceChanged === false)
check('settlement and learning behavior unchanged', cert.scope?.settlementChanged === false && cert.scope?.learningChanged === false)
check('provider calls and mutations remain zero', cert.providerCallsMade === 0 && cert.remoteMutationsMade === 0 && cert.databaseMutationsMade === 0)
check('MC-03 was not started', cert.mc03Started === false)
check('sport paths are documented', ['MLB', 'NBA', 'NFL', 'NHL', 'Soccer', 'Tennis', 'UFC', 'BSN'].every((sport) => auditDoc.includes(`| ${sport} |`)))
check('roadmap and queue are consistent with MC-02 state', roadmap.includes('Mission Control MC-02 Multi-Sport Data Readiness') && queueDoc.includes('Next eligible mission after MC-02 certification: MC-08'))
check('project status acknowledges MC-02 certification', projectStatus.includes('Mission Control MC-02 Multi-Sport Data Readiness') && projectStatus.includes('MC-03 remains PLANNED'))
check('final classification is present', cert.finalClassification === 'MC_02_1_QUEUE_AUDIT_PASS')

const failed = checks.filter((item) => !item.pass)
for (const item of checks) {
  const suffix = item.detail ? ` - ${item.detail}` : ''
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${suffix}`)
}

console.log(`\nMission queue audit validation: ${checks.length - failed.length}/${checks.length} checks passed.`)

if (failed.length > 0) {
  process.exitCode = 1
}
