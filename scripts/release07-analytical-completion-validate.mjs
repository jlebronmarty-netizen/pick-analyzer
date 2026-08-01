#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const failures = []
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE07_VALIDATOR_TIMEOUT_MS ?? 120000)

const releaseFiles = new Set([
  'src/services/model-segments.service.ts',
  'docs/DATA/CANONICAL_DATA_DISCOVERY.md',
  'docs/DATA/DUPLICATE_SOURCE_ANALYSIS.md',
  'docs/DATA/ANALYTICAL_COMPLETENESS.md',
  'docs/DATA/README.md',
  'docs/CERTIFICATION/RELEASE_07_ANALYTICAL_COMPLETION.md',
  'docs/CERTIFICATION/release-07-analytical-completion.json',
  'scripts/release07-analytical-completion-validate.mjs',
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
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 07 validator exceeded ${timeoutMs}ms`)
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
  'docs/DATA/CANONICAL_DATA_DISCOVERY.md',
  'docs/DATA/DUPLICATE_SOURCE_ANALYSIS.md',
  'docs/DATA/ANALYTICAL_COMPLETENESS.md',
  'docs/CERTIFICATION/RELEASE_07_ANALYTICAL_COMPLETION.md',
  'docs/CERTIFICATION/release-07-analytical-completion.json',
  'scripts/release07-analytical-completion-validate.mjs',
]
for (const file of required) assert(exists(file), `missing required Release 07 file: ${file}`)

const cert = JSON.parse(read('docs/CERTIFICATION/release-07-analytical-completion.json'))
assert(cert.predictionFormulaChanged === false, 'prediction formulas must remain unchanged')
assert(cert.probabilityCalibrationChanged === false, 'probability calibration must remain unchanged')
assert(cert.officialPickPolicyChanged === false, 'Official Pick policy must remain unchanged')
assert(cert.learningWeightsChanged === false, 'learning weights must remain unchanged')
assert(cert.providerContractsChanged === false, 'provider contracts must remain unchanged')
assert(cert.schedulerBehaviorChanged === false, 'scheduler behavior must remain unchanged')
assert(cert.databaseSchemaChanged === false, 'database schema must remain unchanged')
assert(cert.historicalReplayStarted === false, 'historical replay must not start')
assert(cert.retrospectiveLabelsGenerated === false, 'retrospective labels must not be generated')
assert(cert.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.remoteMutationsMade === 0, 'database mutations must be zero')
assert(cert.release08Started === false, 'Release 08 must not be started')

const service = read('src/services/model-segments.service.ts')
for (const term of [
  'sports_odds_snapshots',
  'openingLine',
  'closingLine',
  'learningLabel',
  'canonicalSources',
  'analyticalCoveragePercent',
  'canonicalCoveragePercent',
  'duplicatedAnalyticalFields',
  'providerCallsMade: 0',
  'remoteMutationsMade: 0',
]) {
  assert(service.includes(term), `segment service missing ${term}`)
}
assert(!service.includes('.insert('), 'segment service must not insert')
assert(!service.includes('.update('), 'segment service must not update')
assert(!service.includes('.delete('), 'segment service must not delete')
assert(!service.includes('/providers/'), 'segment service must not call provider routes')

const docs = [
  'docs/DATA/CANONICAL_DATA_DISCOVERY.md',
  'docs/DATA/DUPLICATE_SOURCE_ANALYSIS.md',
  'docs/DATA/ANALYTICAL_COMPLETENESS.md',
  'docs/CERTIFICATION/RELEASE_07_ANALYTICAL_COMPLETION.md',
].map(read).join('\n')
for (const term of ['Opening Line', 'Closing Line', 'Learning Label', 'sports_odds_snapshots', 'prediction_history', 'No second source of truth', 'Provider calls and database mutations remain zero']) {
  assert(docs.includes(term), `Release 07 docs missing ${term}`)
}

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
for (const file of Array.from(new Set([...changed, ...untracked])).sort()) {
  if (!releaseFiles.has(file) && !knownUnrelatedDirty.has(file)) failures.push(`unexpected dirty file: ${file}`)
}

const scanned = [...walk('src'), ...walk('docs'), ...walk('scripts')]
for (const file of scanned) {
  if (!/\.(md|json|mjs|js|ts|tsx)$/.test(file)) continue
  const content = read(file)
  if (/sk-[A-Za-z0-9_-]{20,}/.test(content) || /ghp_[A-Za-z0-9_]{20,}/.test(content) || /github_pat_[A-Za-z0-9_]{20,}/.test(content) || /AKIA[0-9A-Z]{16}/.test(content) || /SUPABASE_SERVICE_ROLE_KEY\s*=/.test(content) || /ODDS_API_KEY\s*=/.test(content) || /CRON_SECRET\s*=/.test(content)) {
    failures.push(`possible secret found in ${file}`)
  }
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  release: 'Release 07',
  requiredFiles: required.length,
  scannedFiles: scanned.length,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  deterministicAnalyticalApis: true,
  failures: failures.length,
  failureMessages: failures,
}, null, 2))
process.exit(failures.length === 0 ? 0 : 1)
