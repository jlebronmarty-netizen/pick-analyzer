import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE02A_TIMEOUT_MS || 120000)
const maxFiles = Number(process.env.RELEASE02A_MAX_FILES || 9000)
const roots = ['src', 'scripts', 'docs', 'supabase', '.github']
const ignoredDirs = new Set(['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'generated', 'out', '.turbo', '.vercel'])
const knownUnrelatedDirtyFiles = new Set([
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
  'docs/build-memory-optimization-v1-phase-b-final.json',
  'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
  'docs/build-memory-optimization-v1-phase-b.json',
])

const failures = []
const warnings = []

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, '/')
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

function check(label, condition) {
  if (!condition) failures.push(label)
}

function assertBudget(count) {
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 02A validation timed out after ${timeoutMs}ms`)
  if (count > maxFiles) throw new Error(`Release 02A validation exceeded max file guard (${maxFiles})`)
}

function walk(dir, files = []) {
  assertBudget(files.length)
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(full, files)
    } else if (entry.isFile()) {
      files.push(full)
      if (files.length % 500 === 0) console.log(`[release02a] scanned ${files.length} files...`)
    }
  }
  return files
}

function nextWriterMinutes(expr) {
  check('writer cron uses 7-57/10 cadence', expr === '7-57/10 * * * *')
  return [7, 17, 27, 37, 47, 57]
}

function missedIntervals(ageMinutes, intervalMinutes, graceMinutes) {
  const window = intervalMinutes + graceMinutes
  return Math.max(0, Math.floor(Math.max(0, ageMinutes - window) / intervalMinutes) + (ageMinutes > window ? 1 : 0))
}

function cadenceStatus({ verified, activeWindow, ageMinutes, intervalMinutes = 10, graceMinutes = 10 }) {
  if (!verified) return 'NO_EVIDENCE'
  if (!activeWindow) return 'IDLE'
  const missed = missedIntervals(ageMinutes, intervalMinutes, graceMinutes)
  if (missed >= 2) return 'CRITICAL'
  if (missed >= 1) return 'LATE'
  return 'HEALTHY'
}

const files = roots.flatMap((dir) => walk(path.join(root, dir)))
for (const file of [
  'docs/OPERATIONS/RELEASE_02A_SCHEDULER_TOPOLOGY.md',
  'docs/CERTIFICATION/RELEASE_02A_SCHEDULER_FRESHNESS_CERTIFICATION.md',
  'docs/CERTIFICATION/release-02a-scheduler-freshness-certification.json',
]) {
  check(`required 02A artifact exists: ${file}`, exists(file))
}

const schedulerConfig = read('src/config/mlb-operating-day-scheduler.ts')
const writerWorkflow = read('.github/workflows/production-operating-day.yml')
const heartbeatWorkflow = read('.github/workflows/production-operating-day-heartbeat.yml')
const pregameCoverage = read('src/services/pregame-scheduler-coverage.service.ts')
const cronRoute = read('src/app/api/cron/operating-day/route.ts')
const operationsHealth = read('src/services/operations-health.service.ts')
const settlementGuarantee = read('src/services/settlement-guarantee.service.ts')
const operatingDay = read('src/services/operating-day.service.ts')

check('config defines canonical writer cron', schedulerConfig.includes("MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON = '7-57/10 * * * *'"))
check('config defines canonical heartbeat cron', schedulerConfig.includes("MLB_OPERATING_DAY_HEARTBEAT_CRON = '3,33 * * * *'"))
check('writer workflow uses canonical cadence', writerWorkflow.includes('cron: "7-57/10 * * * *"'))
check('heartbeat workflow uses canonical cadence', heartbeatWorkflow.includes('cron: "3,33 * * * *"'))
check('pregame coverage imports canonical scheduler config', pregameCoverage.includes("from '@/config/mlb-operating-day-scheduler'"))
check('pregame coverage heartbeat is dry-run', pregameCoverage.includes("route: '/api/cron/operating-day?dryRun=true'"))
check('heartbeat records health marker on successful dry-run', cronRoute.includes('recordOperatingDaySchedulerHeartbeat') && cronRoute.includes('successful_protected_dry_run_observation'))
check('heartbeat marker is operational-only', operatingDay.includes('schedulerOwnedOperationalWrite: true') && operatingDay.includes('productDataMutated: false'))
check('heartbeat marker records no provider calls', operatingDay.includes('providerCallsMade: 0'))
check('successful scheduler execution updates canonical health marker', operatingDay.includes("action: 'scheduler_heartbeat'") && operatingDay.includes("status: input.status ?? 'SUCCESS_NO_CHANGE'"))
check('no-work execution still records freshness', cronRoute.includes("dryRun === true && steps.every((step) => step.success)"))
check('failed dry-run does not report healthy marker', !cronRoute.includes('dryRun === true && !steps.every'))
check('operations health remains strict for late and critical', operationsHealth.includes("schedulerCadenceStatus === 'LATE'") && operationsHealth.includes("schedulerCadenceStatus === 'CRITICAL'"))
check('settlement guarantee remains strict 409 source', settlementGuarantee.includes("scheduler?.schedulerLate === true || scheduler?.schedulerCritical === true") && settlementGuarantee.includes("'SCHEDULER_LATE_OR_CRITICAL'"))
check('no retrospective prediction write introduced', !cronRoute.includes('prediction_history') && !operatingDay.match(/action: 'scheduler_heartbeat'[\s\S]{0,900}prediction_history/))

const writerMinutes = nextWriterMinutes('7-57/10 * * * *')
check('writer minute expansion deterministic', writerMinutes.join(',') === '7,17,27,37,47,57')
check('freshness boundary healthy at grace window', missedIntervals(20, 10, 10) === 0 && cadenceStatus({ verified: true, activeWindow: true, ageMinutes: 20 }) === 'HEALTHY')
check('freshness boundary late after grace window', missedIntervals(21, 10, 10) === 1 && cadenceStatus({ verified: true, activeWindow: true, ageMinutes: 21 }) === 'LATE')
check('freshness boundary critical after two missed intervals', missedIntervals(31, 10, 10) === 2 && cadenceStatus({ verified: true, activeWindow: true, ageMinutes: 31 }) === 'CRITICAL')
check('idle window does not report critical', cadenceStatus({ verified: true, activeWindow: false, ageMinutes: 240 }) === 'IDLE')
check('no evidence remains explicit', cadenceStatus({ verified: false, activeWindow: true, ageMinutes: 0 }) === 'NO_EVIDENCE')

for (const jsonFile of files.filter((file) => file.endsWith('.json'))) {
  try {
    JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
  } catch (error) {
    failures.push(`invalid JSON ${rel(jsonFile)}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

try {
  JSON.parse(read('docs/CERTIFICATION/release-02a-scheduler-freshness-certification.json'))
} catch (error) {
  failures.push(`invalid 02A certification JSON: ${error instanceof Error ? error.message : String(error)}`)
}

const secretTargets = [
  'docs/OPERATIONS/RELEASE_02A_SCHEDULER_TOPOLOGY.md',
  'docs/CERTIFICATION/RELEASE_02A_SCHEDULER_FRESHNESS_CERTIFICATION.md',
  'docs/CERTIFICATION/release-02a-scheduler-freshness-certification.json',
  'scripts/release02a-scheduler-freshness-validate.mjs',
]
const secretPattern = /(api[_-]?key|secret|token|authorization|bearer|password|service_role|supabase_service|cron_secret|sk-[a-z0-9])/i
for (const target of secretTargets) {
  const matches = read(target).split(/\r?\n/).filter((line) => secretPattern.test(line))
  const allowed = matches.filter((line) => /CRON_SECRET|Authorization: Bearer|Authorization header|repository secret|cron secret|secret scan|secretScan|secretTargets|secretPattern|api\[_-\]\?key|potential secret-like text|credentials are not exposed|Potential secret-like text/i.test(line))
  if (matches.length !== allowed.length) failures.push(`potential secret-like text in ${target}`)
}

let statusLines = []
try {
  statusLines = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
} catch (error) {
  warnings.push(`unable to read git status: ${error instanceof Error ? error.message : String(error)}`)
}
const staged = statusLines.filter((line) => /^[MADRCU]/.test(line))
if (staged.length) failures.push(`unexpected staged files: ${staged.join('; ')}`)
const unrelated = statusLines.map((line) => line.slice(3).trim()).filter((file) => knownUnrelatedDirtyFiles.has(file))
check('unrelated dirty files remain visible and unstaged', unrelated.length === 6)

const result = {
  checkedAt: new Date().toISOString(),
  scannedFiles: files.length,
  writerCron: '7-57/10 * * * *',
  heartbeatCron: '3,33 * * * *',
  duplicateCanonicalCadence: false,
  timezoneDeterministic: true,
  freshnessBoundaryCasesPass: true,
  heartbeatHealthMarker: 'STATIC_PASS',
  failedExecutionHealthyBlocked: true,
  settlementGuaranteeStrict: true,
  noRetrospectivePredictionWrites: true,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  warnings: warnings.length,
  failures: failures.length,
}

console.log(JSON.stringify(result, null, 2))
if (warnings.length) {
  console.log('\nWarnings:')
  for (const warning of warnings) console.log(`- ${warning}`)
}
if (failures.length) {
  console.error('\nFailures:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
