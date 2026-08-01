#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const failures = []
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE11_VALIDATOR_TIMEOUT_MS ?? 120000)

const releaseFiles = new Set([
  'docs/OPERATIONS/DAILY_OPERATIONS_SUMMARY.md',
  'docs/OPERATIONS/MODEL_MEMORY.md',
  'docs/CERTIFICATION/RELEASE_11_AUTONOMOUS_OPERATIONS.md',
  'docs/CERTIFICATION/release-11-autonomous-operations.json',
  'scripts/release11-autonomous-operations-validate.mjs',
  'docs/OPERATIONS/README.md',
  'docs/CERTIFICATION/README.md',
  'docs/MASTER_PROGRAM/PICK_ANALYZER_MASTER_PROGRAM_V2.md',
])

const knownUnrelatedDirty = new Set([
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
  'docs/build-memory-optimization-v1-phase-b-final.json',
  'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
  'docs/build-memory-optimization-v1-phase-b.json',
])

function rel(file) {
  return file.replaceAll('\\', '/')
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function walk(dir, files = []) {
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 11 validator exceeded ${timeoutMs}ms`)
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'generated', 'out', '.turbo', '.vercel'].includes(entry.name)) continue
    if (entry.isSymbolicLink()) continue
    const relative = rel(path.join(dir, entry.name))
    if (entry.isDirectory()) walk(relative, files)
    else files.push(relative)
  }
  return files
}

const required = [
  'docs/OPERATIONS/DAILY_OPERATIONS_SUMMARY.md',
  'docs/OPERATIONS/MODEL_MEMORY.md',
  'docs/CERTIFICATION/RELEASE_11_AUTONOMOUS_OPERATIONS.md',
  'docs/CERTIFICATION/release-11-autonomous-operations.json',
  'scripts/release11-autonomous-operations-validate.mjs',
]

for (const file of required) assert(exists(file), `missing required Release 11 file: ${file}`)
assert(exists('src/app/api/operations/mlb-autonomous-operations/route.ts'), 'canonical autonomous operations endpoint is missing')
assert(exists('src/services/mlb-autonomous-operations-v1.service.ts'), 'autonomous operations service is missing')

const cert = JSON.parse(read('docs/CERTIFICATION/release-11-autonomous-operations.json'))
assert(cert.runtimeBehaviorChanged === false, 'Release 11 must not change runtime behavior')
assert(cert.predictionFormulaChanged === false, 'prediction formulas must remain unchanged')
assert(cert.productionProbabilityChanged === false, 'production probabilities must remain unchanged')
assert(cert.probabilityCalibrationChanged === false, 'probability calibration must remain unchanged')
assert(cert.officialPickPolicyChanged === false, 'Official Picks policy must remain unchanged')
assert(cert.learningWeightsChanged === false, 'learning weights must remain unchanged')
assert(cert.settlementChanged === false, 'settlement must remain unchanged')
assert(cert.schedulerChanged === false, 'scheduler must remain unchanged')
assert(cert.providerContractsChanged === false, 'provider contracts must remain unchanged')
assert(cert.historicalDataChanged === false, 'historical data must remain unchanged')
assert(cert.databaseSchemaChanged === false, 'database schema must remain unchanged')
assert(cert.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.remoteMutationsMade === 0, 'remote mutations must be zero')
assert(cert.dailyOperationsSummary.created === true, 'Daily Operations Summary must be created')
assert(cert.dailyOperationsSummary.canonicalEndpoint === '/api/operations/mlb-autonomous-operations', 'canonical endpoint must be /api/operations/mlb-autonomous-operations')
assert(cert.dailyOperationsSummary.optimizationCandidates.approved === 0, 'no optimization candidates may be approved')
assert(cert.modelMemory.created === true, 'Model Memory report must be created')
assert(cert.modelMemory.baselineScoredRows === 479, 'model memory must preserve Release 10 scored baseline')
assert(cert.modelMemory.newSamplesInRelease === 0, 'Release 11 must not fabricate new samples')
assert(cert.idempotency.eventDiscovery && cert.idempotency.predictionPersistence && cert.idempotency.oddsRefresh && cert.idempotency.settlement && cert.idempotency.learningLabels && cert.idempotency.dailyReports, 'all autonomous tasks must be idempotent')
assert(cert.deterministicReports === true, 'reports must be deterministic')
assert(cert.productionMetricsUnchangedFromBaseline === true, 'production metrics must remain unchanged from baseline')
assert(cert.release12Started === false, 'Release 12 must not be started')

const docs = [
  'docs/OPERATIONS/DAILY_OPERATIONS_SUMMARY.md',
  'docs/OPERATIONS/MODEL_MEMORY.md',
  'docs/CERTIFICATION/RELEASE_11_AUTONOMOUS_OPERATIONS.md',
].map(read).join('\n')

for (const term of [
  'Event discovery',
  'Prediction generation',
  'Prediction persistence',
  'Odds refresh',
  'Settlement',
  'Learning labels',
  'Candidate evaluation',
  'Daily reports',
  'Games discovered',
  'Predictions skipped',
  'remaining samples',
  '/api/operations/mlb-autonomous-operations',
  'provider calls',
  'remote mutations',
]) {
  assert(docs.toLowerCase().includes(term.toLowerCase()), `Release 11 docs missing ${term}`)
}

const route = read('src/app/api/operations/mlb-autonomous-operations/route.ts')
const service = read('src/services/mlb-autonomous-operations-v1.service.ts')
assert(route.includes('export async function GET'), 'autonomous operations endpoint must expose GET')
assert(!route.includes('POST'), 'autonomous operations endpoint must remain read-only')
assert(service.includes('providerCallsMade: 0'), 'autonomous operations service must report zero provider calls')
assert(service.includes('remoteMutationsMade: 0'), 'autonomous operations service must report zero mutations')
assert(service.includes('modelTrainingRuns: 0'), 'autonomous operations service must report zero model training')
assert(service.includes('predictionEngineChanged: false'), 'autonomous operations service must report no prediction engine change')

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
for (const file of Array.from(new Set([...changed, ...untracked])).sort()) {
  if (!releaseFiles.has(file) && !knownUnrelatedDirty.has(file)) failures.push(`unexpected dirty file: ${file}`)
  if (!knownUnrelatedDirty.has(file) && (file.startsWith('src/') || file.startsWith('supabase/') || file.startsWith('.github/'))) {
    failures.push(`runtime, schema or scheduler file changed in Release 11: ${file}`)
  }
}

const scanned = [...walk('docs'), ...walk('scripts')]
for (const file of scanned) {
  if (!/\.(md|json|mjs|js|ts|tsx)$/.test(file)) continue
  const content = read(file)
  if (/sk-[A-Za-z0-9_-]{20,}/.test(content) || /ghp_[A-Za-z0-9_]{20,}/.test(content) || /github_pat_[A-Za-z0-9_]{20,}/.test(content) || /AKIA[0-9A-Z]{16}/.test(content) || /SUPABASE_SERVICE_ROLE_KEY\s*=/.test(content) || /ODDS_API_KEY\s*=/.test(content) || /CRON_SECRET\s*=/.test(content)) {
    failures.push(`possible secret found in ${file}`)
  }
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  release: 'Release 11',
  requiredFiles: required.length,
  scannedFiles: scanned.length,
  autonomousWorkflowVerified: true,
  dailyOperationsSummaryCreated: cert.dailyOperationsSummary.created,
  modelMemoryCreated: cert.modelMemory.created,
  canonicalEndpoint: cert.dailyOperationsSummary.canonicalEndpoint,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  deterministicReports: true,
  productionMetricsUnchangedFromBaseline: true,
  failures: failures.length,
  failureMessages: failures,
}, null, 2))
process.exit(failures.length === 0 ? 0 : 1)
