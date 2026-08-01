#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE05_VALIDATOR_TIMEOUT_MS ?? 120000)
const maxFiles = Number(process.env.RELEASE05_VALIDATOR_MAX_FILES ?? 6000)

const releaseFiles = new Set([
  'docs/MODEL/ROW_LEVEL_SEGMENT_ANALYSIS.md',
  'docs/MODEL/MODEL_OPTIMIZATION_REPORT.md',
  'docs/CERTIFICATION/RELEASE_05_MODEL_OPTIMIZATION.md',
  'docs/CERTIFICATION/release-05-model-optimization.json',
  'scripts/release05-model-optimization-validate.mjs',
  'docs/MODEL/README.md',
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

const requiredDocs = [
  'docs/MODEL/ROW_LEVEL_SEGMENT_ANALYSIS.md',
  'docs/MODEL/MODEL_OPTIMIZATION_REPORT.md',
  'docs/CERTIFICATION/RELEASE_05_MODEL_OPTIMIZATION.md',
  'docs/CERTIFICATION/release-05-model-optimization.json',
]

const protectedRuntimeFiles = [
  'src/services/sport-prediction-engine-sdk.service.ts',
  'src/services/recommendation-eligibility-policy.service.ts',
  'src/services/prospective-official-eligibility-gate.service.ts',
  'src/services/mlb-prediction-engine.service.ts',
  'src/services/model-learning.service.ts',
  'src/services/current-board.service.ts',
]

const failures = []
const warnings = []

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

function checkTimeout() {
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 05 validator exceeded ${timeoutMs}ms`)
}

function walk(dir, files = []) {
  checkTimeout()
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = rel(path.join(dir, entry.name))
    if (['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'generated', 'out', '.turbo', '.vercel'].includes(entry.name)) continue
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) walk(relative, files)
    else {
      files.push(relative)
      if (files.length > maxFiles) throw new Error(`Release 05 validator exceeded max file guard ${maxFiles}`)
    }
  }
  return files
}

for (const file of requiredDocs) assert(exists(file), `missing required Release 05 artifact: ${file}`)

const cert = JSON.parse(read('docs/CERTIFICATION/release-05-model-optimization.json'))
assert(cert.runtimeBehaviorChanged === false, 'runtime behavior must remain unchanged')
assert(cert.predictionFormulaChanged === false, 'prediction formulas must remain unchanged unless evidence accepted')
assert(cert.calibrationChanged === false, 'calibration must remain unchanged because evidence gate rejected changes')
assert(cert.officialPickThresholdsChanged === false, 'Official Pick thresholds must remain unchanged')
assert(cert.learningWeightsChanged === false, 'learning weights must remain unchanged')
assert(cert.providerContractsChanged === false, 'provider contracts must remain unchanged')
assert(cert.schedulerBehaviorChanged === false, 'scheduler behavior must remain unchanged')
assert(cert.historicalReplayStarted === false, 'historical replay must not start')
assert(cert.retrospectiveLabelsGenerated === false, 'retrospective labels must not be generated')
assert(Array.isArray(cert.modelChangesApplied) && cert.modelChangesApplied.length === 0, 'no model changes should be applied on insufficient evidence')
assert(cert.performanceEvidence?.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.performanceEvidence?.remoteMutationsMade === 0, 'remote mutations must be zero')
assert(cert.performanceEvidence?.scoredRows === 479, 'expected scored row evidence missing')
assert(cert.bucketEvidence?.probability?.p50To55?.scored === 11, 'probability bucket evidence mismatch')
assert(cert.bucketEvidence?.market?.totals?.scored === 145, 'market bucket evidence mismatch')
assert(cert.beforeAfter?.accuracyBefore === cert.beforeAfter?.accuracyAfter, 'before/after accuracy should be unchanged')
assert(cert.beforeAfter?.brierBefore === cert.beforeAfter?.brierAfter, 'before/after Brier should be unchanged')
assert(cert.release06Started === false, 'Release 06 must not be started')

const segmentDoc = read('docs/MODEL/ROW_LEVEL_SEGMENT_ANALYSIS.md')
for (const term of ['home/away', 'favorite/underdog', 'implied probability', 'expected value', 'push/void', 'providerCallsMade: 0']) {
  assert(segmentDoc.includes(term), `row-level segment analysis missing ${term}`)
}

const report = read('docs/MODEL/MODEL_OPTIMIZATION_REPORT.md')
for (const term of ['Probability Buckets', 'Confidence Buckets', 'Markets', 'Feature Contribution', 'Official Picks Safety', 'Before And After']) {
  assert(report.includes(term), `optimization report missing ${term}`)
}
assert(report.includes('No runtime model change was accepted'), 'optimization report must explicitly reject runtime model change')
assert(report.includes('First Half') && report.includes('First Five'), 'market bucket report must include First Half and First Five')

for (const file of protectedRuntimeFiles) {
  assert(exists(file), `protected runtime source missing: ${file}`)
}

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map(rel)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map(rel)
const touchedFiles = Array.from(new Set([...changed, ...untracked])).sort()

for (const file of touchedFiles) {
  if (!releaseFiles.has(file) && !knownUnrelatedDirty.has(file)) failures.push(`unexpected dirty file: ${file}`)
  if (file.startsWith('src/') && !knownUnrelatedDirty.has(file)) failures.push(`runtime source changed: ${file}`)
}

const scanned = [...walk('docs'), ...walk('scripts')]
for (const file of scanned) {
  if (!/\.(md|json|mjs|js|ts|tsx)$/.test(file)) continue
  const content = read(file)
  if (
    /sk-[A-Za-z0-9_-]{20,}/.test(content) ||
    /ghp_[A-Za-z0-9_]{20,}/.test(content) ||
    /github_pat_[A-Za-z0-9_]{20,}/.test(content) ||
    /AKIA[0-9A-Z]{16}/.test(content) ||
    /SUPABASE_SERVICE_ROLE_KEY\s*=/.test(content) ||
    /ODDS_API_KEY\s*=/.test(content) ||
    /CRON_SECRET\s*=/.test(content)
  ) {
    failures.push(`possible secret found in ${file}`)
  }
}

const result = {
  checkedAt: new Date().toISOString(),
  scannedFiles: scanned.length,
  requiredDocs: requiredDocs.length,
  protectedRuntimeFiles: protectedRuntimeFiles.length,
  scoredRows: cert.performanceEvidence.scoredRows,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  modelChangesApplied: cert.modelChangesApplied.length,
  modelChangesRejected: cert.modelChangesRejected.length,
  warnings: warnings.length,
  failures: failures.length,
  touchedFiles,
  failureMessages: failures,
}

console.log(JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)
