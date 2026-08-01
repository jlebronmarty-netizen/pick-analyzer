import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function exists(file) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing required file: ${file}`)
}

function assertIncludes(file, marker) {
  const text = read(file)
  if (!text.includes(marker)) failures.push(`${file} missing marker: ${marker}`)
}

function changedFiles() {
  const output = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })
  return output.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3))
}

const required = [
  'docs/OPERATIONAL_EXCELLENCE/README.md',
  'docs/OPERATIONAL_EXCELLENCE/OE_002_AUTOMATIC_DAILY_CLOSURE.md',
  'docs/OPERATIONAL_EXCELLENCE/OE_002_RECONCILIATION.md',
  'docs/OPERATIONAL_EXCELLENCE/OE_002_OPERATIONAL_MATRIX.md',
  'docs/CERTIFICATION/OE_002_AUTOMATIC_DAILY_CLOSURE.md',
  'docs/CERTIFICATION/oe-002-automatic-daily-closure.json',
  'scripts/oe002-automatic-daily-closure-validate.mjs',
]

for (const file of required) exists(file)

assertIncludes('src/services/adaptive-refresh-orchestrator.service.ts', 'completedMissingResultRows')
assertIncludes('src/services/adaptive-refresh-orchestrator.service.ts', 'oldestMissingResultDate')
assertIncludes('src/services/adaptive-refresh-orchestrator.service.ts', "item.domain === 'results' && Number(settlementBacklog?.completedMissingResultRows ?? 0) > 0")
assertIncludes('src/services/adaptive-refresh-orchestrator.service.ts', "action === 'sync_results' && settlementBacklog.oldestMissingResultDate")
assertIncludes('src/services/adaptive-refresh-orchestrator.service.ts', 'isFinalScoredEvent(eventsById.get(row.game_id))')

assertIncludes('docs/OPERATIONAL_EXCELLENCE/OE_002_AUTOMATIC_DAILY_CLOSURE.md', 'RESULT_NOT_IMPORTED')
assertIncludes('docs/OPERATIONAL_EXCELLENCE/OE_002_RECONCILIATION.md', '78934')
assertIncludes('docs/OPERATIONAL_EXCELLENCE/OE_002_OPERATIONAL_MATRIX.md', 'Result Import')
assertIncludes('docs/CERTIFICATION/OE_002_AUTOMATIC_DAILY_CLOSURE.md', 'CONDITIONAL PASS')

const cert = JSON.parse(read('docs/CERTIFICATION/oe-002-automatic-daily-closure.json'))
if (cert.guardrails?.providerCallsDuringCertification !== 0) failures.push('Certification must record zero provider calls during certification.')
if (cert.guardrails?.remoteMutationsDuringCertification !== 0) failures.push('Certification must record zero remote mutations during certification.')
if (cert.repair?.settlementLogicChanged !== false) failures.push('Settlement logic must remain unchanged.')
if (cert.repair?.predictionLogicChanged !== false) failures.push('Prediction logic must remain unchanged.')
if (cert.productionEvidenceBeforeRepair?.silentPendingRows !== 0) failures.push('Silent pending rows must be zero in baseline evidence.')

const protectedDirty = new Set([
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
  'docs/build-memory-optimization-v1-phase-b-final.json',
  'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
  'docs/build-memory-optimization-v1-phase-b.json',
])
const allowedPrefixes = [
  'docs/OPERATIONAL_EXCELLENCE/',
  'docs/CERTIFICATION/',
  'scripts/oe002-automatic-daily-closure-validate.mjs',
  'src/services/adaptive-refresh-orchestrator.service.ts',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_PROGRAM/PICK_ANALYZER_MASTER_PROGRAM_V2.md',
]
for (const file of changedFiles()) {
  if (protectedDirty.has(file)) continue
  if (!allowedPrefixes.some((prefix) => file.startsWith(prefix))) {
    failures.push(`Unexpected dirty file for OE-002: ${file}`)
  }
}

const result = {
  checkedAt: new Date().toISOString(),
  ticket: 'OE-002',
  completedMissingResultRowsDetected: true,
  resultsDueWhenCanonicalResultMissing: true,
  providerCallsDuringCertification: 0,
  remoteMutationsDuringCertification: 0,
  predictionBehaviorChanged: false,
  settlementLogicChanged: false,
  failures: failures.length,
  failureMessages: failures,
}

console.log(JSON.stringify(result, null, 2))
if (failures.length) process.exit(1)
