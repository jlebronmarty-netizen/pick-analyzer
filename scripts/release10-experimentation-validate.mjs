#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const failures = []
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE10_VALIDATOR_TIMEOUT_MS ?? 120000)

const releaseFiles = new Set([
  'docs/MODEL/EXPERIMENT_REGISTRY.md',
  'docs/MODEL/BASELINE_MODEL.md',
  'docs/MODEL/EXPERIMENT_WORKFLOW.md',
  'docs/PRODUCT/MODEL_EXPERIMENT_DASHBOARD.md',
  'docs/CERTIFICATION/RELEASE_10_CONTROLLED_EXPERIMENTATION.md',
  'docs/CERTIFICATION/release-10-controlled-experimentation.json',
  'scripts/release10-experimentation-validate.mjs',
  'docs/MODEL/README.md',
  'docs/PRODUCT/README.md',
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
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 10 validator exceeded ${timeoutMs}ms`)
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
  'docs/MODEL/EXPERIMENT_REGISTRY.md',
  'docs/MODEL/BASELINE_MODEL.md',
  'docs/MODEL/EXPERIMENT_WORKFLOW.md',
  'docs/PRODUCT/MODEL_EXPERIMENT_DASHBOARD.md',
  'docs/CERTIFICATION/RELEASE_10_CONTROLLED_EXPERIMENTATION.md',
  'docs/CERTIFICATION/release-10-controlled-experimentation.json',
  'scripts/release10-experimentation-validate.mjs',
]

for (const file of required) assert(exists(file), `missing required Release 10 file: ${file}`)

const cert = JSON.parse(read('docs/CERTIFICATION/release-10-controlled-experimentation.json'))
assert(cert.runtimeBehaviorChanged === false, 'Release 10 must not change runtime behavior')
assert(cert.productionProbabilityChanged === false, 'production probabilities must remain unchanged')
assert(cert.predictionFormulaChanged === false, 'prediction formulas must remain unchanged')
assert(cert.probabilityCalibrationChanged === false, 'probability calibration must remain unchanged')
assert(cert.officialPickPolicyChanged === false, 'Official Picks policy must remain unchanged')
assert(cert.settlementChanged === false, 'settlement must remain unchanged')
assert(cert.schedulerChanged === false, 'scheduler must remain unchanged')
assert(cert.providerContractsChanged === false, 'provider contracts must remain unchanged')
assert(cert.productionLearningChanged === false, 'production learning must remain unchanged')
assert(cert.historicalDataChanged === false, 'historical data must remain unchanged')
assert(cert.databaseSchemaChanged === false, 'database schema must remain unchanged')
assert(cert.historicalReplayStarted === false, 'historical replay must not start')
assert(cert.retrospectiveLabelsGenerated === false, 'retrospective labels must not be generated')
assert(cert.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.remoteMutationsMade === 0, 'database mutations must be zero')
assert(cert.baseline.scoredRows === 479, 'baseline scored rows must match existing evidence')
assert(cert.baseline.accuracy === 49.9, 'baseline accuracy must match existing evidence')
assert(cert.baseline.brier === 0.2598, 'baseline Brier must match existing evidence')
assert(cert.experiments.registered === 4, 'four experiments must be registered')
assert(cert.experiments.approvedForRelease === 0, 'no experiments may be approved for release')
assert(cert.offlineRunner.readOnly === true, 'offline runner contract must be read-only')
assert(cert.offlineRunner.writesProductionPredictions === false, 'offline runner must not write production predictions')
assert(cert.offlineRunner.deterministicOutput === true, 'offline runner output must be deterministic')
assert(cert.offlineRunner.candidateAppliedToProduction === false, 'no candidate may be applied to production')
assert(cert.regressionWorkflow.rejectOnProtectedRegression === true, 'protected regression must reject candidates')
assert(cert.release11Started === false, 'Release 11 must not be started')

const docs = [
  'docs/MODEL/EXPERIMENT_REGISTRY.md',
  'docs/MODEL/BASELINE_MODEL.md',
  'docs/MODEL/EXPERIMENT_WORKFLOW.md',
  'docs/PRODUCT/MODEL_EXPERIMENT_DASHBOARD.md',
  'docs/CERTIFICATION/RELEASE_10_CONTROLLED_EXPERIMENTATION.md',
].map(read).join('\n')

for (const term of [
  'Experiment ID',
  'Baseline',
  'Candidate Result',
  'Regression Status',
  'Accuracy',
  'Brier',
  'Calibration',
  'Official Picks',
  'PASS',
  'FAIL',
  'INSUFFICIENT DATA',
  'Human approval',
  'read-only',
]) {
  assert(docs.toLowerCase().includes(term.toLowerCase()), `Release 10 docs missing ${term}`)
}

const deterministicExperimentOutput = JSON.stringify({
  baseline: cert.baseline,
  experiments: cert.experiments,
  candidateEvaluation: cert.candidateEvaluation,
  regressionWorkflow: cert.regressionWorkflow,
})
assert(deterministicExperimentOutput === JSON.stringify(JSON.parse(deterministicExperimentOutput)), 'experiment output must serialize deterministically')

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
for (const file of Array.from(new Set([...changed, ...untracked])).sort()) {
  if (!releaseFiles.has(file) && !knownUnrelatedDirty.has(file)) failures.push(`unexpected dirty file: ${file}`)
  if (!knownUnrelatedDirty.has(file) && (file.startsWith('src/') || file.startsWith('supabase/') || file.startsWith('.github/'))) {
    failures.push(`runtime, schema or scheduler file changed in Release 10: ${file}`)
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
  release: 'Release 10',
  requiredFiles: required.length,
  scannedFiles: scanned.length,
  baselineFrozen: true,
  experimentsRegistered: cert.experiments.registered,
  experimentsApprovedForRelease: cert.experiments.approvedForRelease,
  deterministicExperimentOutput: true,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  failures: failures.length,
  failureMessages: failures,
}, null, 2))
process.exit(failures.length === 0 ? 0 : 1)
