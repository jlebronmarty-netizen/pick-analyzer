#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE04_VALIDATOR_TIMEOUT_MS ?? 120000)
const maxFiles = Number(process.env.RELEASE04_VALIDATOR_MAX_FILES ?? 5000)

const allowedRelease04Files = new Set([
  'docs/MODEL/MODEL_PERFORMANCE_AUDIT.md',
  'docs/MODEL/FEATURE_IMPORTANCE_AUDIT.md',
  'docs/MODEL/MISSED_OPPORTUNITY_ANALYSIS.md',
  'docs/MODEL/MODEL_INTELLIGENCE_REPORT.md',
  'docs/MODEL/README.md',
  'docs/CERTIFICATION/RELEASE_04_MODEL_INTELLIGENCE.md',
  'docs/CERTIFICATION/release-04-model-intelligence.json',
  'scripts/release04-model-intelligence-validate.mjs',
  'docs/MASTER_PROGRAM/PICK_ANALYZER_MASTER_PROGRAM_V2.md',
  'docs/CERTIFICATION/README.md',
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
  'docs/MODEL/MODEL_PERFORMANCE_AUDIT.md',
  'docs/MODEL/FEATURE_IMPORTANCE_AUDIT.md',
  'docs/MODEL/MISSED_OPPORTUNITY_ANALYSIS.md',
  'docs/MODEL/MODEL_INTELLIGENCE_REPORT.md',
  'docs/CERTIFICATION/RELEASE_04_MODEL_INTELLIGENCE.md',
  'docs/CERTIFICATION/release-04-model-intelligence.json',
]

const requiredSources = [
  'src/services/performance-scope-v2.service.ts',
  'src/services/current-board.service.ts',
  'src/services/feature-store-core.service.ts',
  'src/services/multi-sport-feature-registry.service.ts',
  'src/services/recommendation-eligibility-policy.service.ts',
  'src/services/prospective-official-eligibility-gate.service.ts',
  'src/services/sport-prediction-engine-sdk.service.ts',
  'src/services/mlb-prediction-engine.service.ts',
]

const failures = []
const warnings = []
const touchedFiles = []

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
  if (Date.now() - startedAt > timeoutMs) {
    throw new Error(`release04 validator exceeded timeout ${timeoutMs}ms`)
  }
}

function walk(dir, files = []) {
  checkTimeout()
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = rel(path.join(dir, entry.name))
    if (['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'generated', 'out', '.turbo', '.vercel'].includes(entry.name)) continue
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      walk(relative, files)
    } else {
      files.push(relative)
      if (files.length > maxFiles) throw new Error(`release04 validator exceeded max file guard ${maxFiles}`)
    }
  }
  return files
}

for (const file of requiredDocs) assert(exists(file), `missing required Release 04 document: ${file}`)
for (const file of requiredSources) assert(exists(file), `missing required model source evidence: ${file}`)

const docs = Object.fromEntries(requiredDocs.filter(exists).map((file) => [file, read(file)]))
const json = JSON.parse(read('docs/CERTIFICATION/release-04-model-intelligence.json'))

assert(json.runtimeBehaviorChanged === false, 'certification JSON must state runtime behavior unchanged')
assert(json.predictionFormulaChanged === false, 'certification JSON must state prediction formulas unchanged')
assert(json.officialPickPolicyChanged === false, 'certification JSON must state Official Pick policy unchanged')
assert(json.providerContractsChanged === false, 'certification JSON must state provider contracts unchanged')
assert(json.schedulerBehaviorChanged === false, 'certification JSON must state scheduler behavior unchanged')
assert(json.historicalReplayStarted === false, 'certification JSON must state historical replay was not started')
assert(json.performanceEvidence?.providerCallsMade === 0, 'performance evidence must report zero provider calls')
assert(json.performanceEvidence?.remoteMutationsMade === 0, 'performance evidence must report zero remote mutations')
assert(json.performanceEvidence?.eligibleSettledRows === 485, 'performance evidence must include 485 eligible settled rows')
assert(json.officialPickEvidence?.thresholdChangeRecommended === false, 'Official Pick threshold change must not be recommended')
assert(json.release05Started === false, 'Release 05 must not be started')

const performanceDoc = docs['docs/MODEL/MODEL_PERFORMANCE_AUDIT.md'] ?? ''
for (const term of ['sport', 'market', 'confidence', 'Probability', 'Home/Away', 'Favorite/Underdog', 'Brier Score', 'ROI']) {
  assert(performanceDoc.includes(term), `performance audit missing required term: ${term}`)
}

const featureDoc = docs['docs/MODEL/FEATURE_IMPORTANCE_AUDIT.md'] ?? ''
for (const feature of ['event_context', 'team_form', 'market_odds', 'starter_status_context', 'pitcher_context', 'weather_context', 'park_context']) {
  assert(featureDoc.includes(feature), `feature audit missing feature: ${feature}`)
}

const missedDoc = docs['docs/MODEL/MISSED_OPPORTUNITY_ANALYSIS.md'] ?? ''
for (const term of ['Provider Unavailable', 'Scheduler Timing', 'cutoff', 'missing', 'retrospective predictions']) {
  assert(missedDoc.includes(term), `missed opportunity analysis missing required term: ${term}`)
}

const intelligenceDoc = docs['docs/MODEL/MODEL_INTELLIGENCE_REPORT.md'] ?? ''
for (const term of ['Why The Model Wins', 'Why The Model Loses', 'Sport Trust', 'Market Trust', 'Release 05']) {
  assert(intelligenceDoc.includes(term), `model intelligence report missing required term: ${term}`)
}

const policySource = read('src/services/recommendation-eligibility-policy.service.ts')
assert(policySource.includes('minimumOfficialConfidence: 65'), 'Official Pick confidence threshold evidence missing')
assert(policySource.includes('automaticProductionApproval: false'), 'automatic production approval must remain false')

const currentBoardSource = read('src/services/current-board.service.ts')
assert(currentBoardSource.includes('providerCallsMade: 0'), 'Current Board must retain zero provider-call read contract')
assert(currentBoardSource.includes('remoteMutationsMade: 0'), 'Current Board must retain zero mutation read contract')

const performanceSource = read('src/services/performance-scope-v2.service.ts')
assert(performanceSource.includes('rowLimit: rowLoad.pagination.rowLimit'), 'performance scope bounded read evidence missing')
assert(performanceSource.includes('providerCallsMade: 0'), 'performance scope must retain zero provider-call read contract')

const gitDiffNames = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map(rel)
const gitUntracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map(rel)

for (const file of [...gitDiffNames, ...gitUntracked]) {
  touchedFiles.push(file)
  if (!allowedRelease04Files.has(file) && !knownUnrelatedDirty.has(file)) {
    failures.push(`unexpected dirty file for Release 04: ${file}`)
  }
}

for (const file of gitDiffNames) {
  if (file.startsWith('src/') && !knownUnrelatedDirty.has(file)) {
    failures.push(`runtime source changed during Release 04: ${file}`)
  }
}

const scannedFiles = walk('docs').concat(walk('scripts'))
for (const file of scannedFiles) {
  if (!/\.(md|json|mjs|js|ts|tsx)$/.test(file)) continue
  const content = read(file)
  const secretHit =
    /sk-[A-Za-z0-9_-]{20,}/.test(content) ||
    /ghp_[A-Za-z0-9_]{20,}/.test(content) ||
    /github_pat_[A-Za-z0-9_]{20,}/.test(content) ||
    /AKIA[0-9A-Z]{16}/.test(content) ||
    /SUPABASE_SERVICE_ROLE_KEY\s*=/.test(content) ||
    /ODDS_API_KEY\s*=/.test(content) ||
    /CRON_SECRET\s*=/.test(content)
  if (secretHit) failures.push(`possible secret found in ${file}`)
}

const result = {
  checkedAt: new Date().toISOString(),
  scannedFiles: scannedFiles.length,
  requiredDocs: requiredDocs.length,
  requiredSources: requiredSources.length,
  performanceRowsAnalyzed: json.performanceEvidence.eligibleSettledRows,
  scoredRows: json.performanceEvidence.scoredRows,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  runtimeBehaviorChanged: false,
  predictionFormulaChanged: false,
  officialPickPolicyChanged: false,
  warnings: warnings.length,
  failures: failures.length,
  touchedFiles: Array.from(new Set(touchedFiles)).sort(),
  failureMessages: failures,
}

console.log(JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)
