#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const failures = []
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE09_VALIDATOR_TIMEOUT_MS ?? 120000)

const releaseFiles = new Set([
  'src/components/home/HomeBettingPlan.tsx',
  'docs/PRODUCT/AI_DAILY_EXPERIENCE.md',
  'docs/PRODUCT/AI_EXPLANATION_GUIDE.md',
  'docs/CERTIFICATION/RELEASE_09_AI_DAILY_EXPERIENCE.md',
  'docs/CERTIFICATION/release-09-ai-daily-experience.json',
  'scripts/release09-ai-daily-experience-validate.mjs',
  'docs/PRODUCT/README.md',
  'docs/CERTIFICATION/README.md',
  'docs/MASTER_PROGRAM/PICK_ANALYZER_MASTER_PROGRAM_V2.md'
])

const knownUnrelatedDirty = new Set([
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
  'docs/build-memory-optimization-v1-phase-b-final.json',
  'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
  'docs/build-memory-optimization-v1-phase-b.json'
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
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 09 validator exceeded ${timeoutMs}ms`)
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
  'src/components/home/HomeBettingPlan.tsx',
  'docs/PRODUCT/AI_DAILY_EXPERIENCE.md',
  'docs/PRODUCT/AI_EXPLANATION_GUIDE.md',
  'docs/CERTIFICATION/RELEASE_09_AI_DAILY_EXPERIENCE.md',
  'docs/CERTIFICATION/release-09-ai-daily-experience.json',
  'scripts/release09-ai-daily-experience-validate.mjs'
]
for (const file of required) assert(exists(file), `missing required Release 09 file: ${file}`)

const cert = JSON.parse(read('docs/CERTIFICATION/release-09-ai-daily-experience.json'))
assert(cert.predictionFormulaChanged === false, 'prediction formulas must remain unchanged')
assert(cert.probabilityCalibrationChanged === false, 'probability calibration must remain unchanged')
assert(cert.officialPickPolicyChanged === false, 'Official Pick policy must remain unchanged')
assert(cert.learningEngineChanged === false, 'learning engine must remain unchanged')
assert(cert.settlementChanged === false, 'settlement must remain unchanged')
assert(cert.schedulerChanged === false, 'scheduler must remain unchanged')
assert(cert.providerContractsChanged === false, 'provider contracts must remain unchanged')
assert(cert.historicalDataChanged === false, 'historical data must remain unchanged')
assert(cert.databaseSchemaChanged === false, 'database schema must remain unchanged')
assert(cert.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.remoteMutationsMade === 0, 'database mutations must be zero')
assert(cert.release10Started === false, 'Release 10 must not be started')

const home = read('src/components/home/HomeBettingPlan.tsx')
for (const term of ['data-r9-daily-brief', 'data-r9-ai-explanation', 'data-r9-no-bet', 'data-r9-evolution-panel', '/api/dashboard/today', '/api/current-board?mode=current&limit=100', '/api/model/intelligence', '/api/performance']) {
  assert(home.includes(term), `homepage missing ${term}`)
}
for (const forbidden of ["from('prediction_history')", '.insert(', '.update(', '.delete(', 'promoteProspectiveOfficialCandidate']) {
  assert(!home.includes(forbidden), `homepage contains forbidden runtime behavior: ${forbidden}`)
}

const docs = [
  'docs/PRODUCT/AI_DAILY_EXPERIENCE.md',
  'docs/PRODUCT/AI_EXPLANATION_GUIDE.md',
  'docs/CERTIFICATION/RELEASE_09_AI_DAILY_EXPERIENCE.md'
].map(read).join('\n')
for (const term of ['Daily Brief', 'Top Picks', 'No Bet', 'AI Explanation', 'Model Evolution', 'Provider calls', 'Database mutations']) {
  assert(docs.includes(term), `Release 09 docs missing ${term}`)
}

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
for (const file of Array.from(new Set([...changed, ...untracked])).sort()) {
  if (!releaseFiles.has(file) && !knownUnrelatedDirty.has(file)) failures.push(`unexpected dirty file: ${file}`)
  if (!knownUnrelatedDirty.has(file) && (file.startsWith('src/services/') || file.startsWith('src/app/api/') || file.startsWith('supabase/'))) {
    failures.push(`business logic or schema file changed in Release 09: ${file}`)
  }
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
  release: 'Release 09',
  requiredFiles: required.length,
  scannedFiles: scanned.length,
  dailyBriefImplemented: cert.implemented.dailyBrief,
  aiExplanationImplemented: cert.implemented.aiExplanation,
  noBetImplemented: cert.implemented.noBetExperience,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  failures: failures.length,
  failureMessages: failures
}, null, 2))
process.exit(failures.length === 0 ? 0 : 1)
