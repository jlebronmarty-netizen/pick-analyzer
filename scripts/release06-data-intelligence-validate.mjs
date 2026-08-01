#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE06_VALIDATOR_TIMEOUT_MS ?? 120000)
const maxFiles = Number(process.env.RELEASE06_VALIDATOR_MAX_FILES ?? 7000)

const releaseFiles = new Set([
  'src/services/model-segments.service.ts',
  'src/app/api/model/segments/route.ts',
  'src/app/api/model/intelligence/route.ts',
  'docs/DATA/PREDICTION_CONTEXT_INVENTORY.md',
  'docs/DATA/SEGMENT_ENGINE.md',
  'docs/DATA/INTELLIGENCE_API.md',
  'docs/DATA/FEATURE_SNAPSHOT.md',
  'docs/CERTIFICATION/RELEASE_06_DATA_INTELLIGENCE.md',
  'docs/CERTIFICATION/release-06-data-intelligence.json',
  'scripts/release06-data-intelligence-validate.mjs',
  'docs/CERTIFICATION/README.md',
  'docs/MASTER_PROGRAM/PICK_ANALYZER_MASTER_PROGRAM_V2.md',
  'docs/ARCHITECTURE/RUNTIME_DEPENDENCY_GRAPH.md',
  'docs/CERTIFICATION/DOCUMENTATION_VALIDATION.md',
  'docs/PRODUCT/FEATURE_MATRIX_V2.md',
  'docs/PRODUCT/PREDICTION_PIPELINE_AUDIT.md',
  'docs/PRODUCT/PRODUCT_INVENTORY_V2.md',
  'docs/PRODUCT/ROUTE_AUDIT_V2.md',
])

const knownUnrelatedDirty = new Set([
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
  'docs/build-memory-optimization-v1-phase-b-final.json',
  'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
  'docs/build-memory-optimization-v1-phase-b.json',
])

const requiredFiles = [
  'src/services/model-segments.service.ts',
  'src/app/api/model/segments/route.ts',
  'src/app/api/model/intelligence/route.ts',
  'docs/DATA/PREDICTION_CONTEXT_INVENTORY.md',
  'docs/DATA/SEGMENT_ENGINE.md',
  'docs/DATA/INTELLIGENCE_API.md',
  'docs/DATA/FEATURE_SNAPSHOT.md',
  'docs/CERTIFICATION/RELEASE_06_DATA_INTELLIGENCE.md',
  'docs/CERTIFICATION/release-06-data-intelligence.json',
]

const failures = []

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
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 06 validator exceeded ${timeoutMs}ms`)
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
      if (files.length > maxFiles) throw new Error(`Release 06 validator exceeded max file guard ${maxFiles}`)
    }
  }
  return files
}

for (const file of requiredFiles) assert(exists(file), `missing required Release 06 file: ${file}`)

const cert = JSON.parse(read('docs/CERTIFICATION/release-06-data-intelligence.json'))
assert(cert.predictionFormulaChanged === false, 'prediction formulas must remain unchanged')
assert(cert.probabilityCalibrationChanged === false, 'probability calibration must remain unchanged')
assert(cert.officialPickThresholdsChanged === false, 'Official Pick thresholds must remain unchanged')
assert(cert.learningWeightsChanged === false, 'learning weights must remain unchanged')
assert(cert.providerContractsChanged === false, 'provider contracts must remain unchanged')
assert(cert.schedulerBehaviorChanged === false, 'scheduler behavior must remain unchanged')
assert(cert.settlementRulesChanged === false, 'settlement rules must remain unchanged')
assert(cert.databaseSchemaChanged === false, 'database schema must remain unchanged')
assert(cert.historicalReplayStarted === false, 'historical replay must not start')
assert(cert.retrospectiveLabelsGenerated === false, 'retrospective labels must not be generated')
assert(cert.readOnlyGuarantees.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.readOnlyGuarantees.remoteMutationsMade === 0, 'remote mutations must be zero')
assert(cert.newApis.includes('/api/model/segments'), 'segments API missing from cert')
assert(cert.newApis.includes('/api/model/intelligence'), 'intelligence API missing from cert')
assert(cert.release07Started === false, 'Release 07 must not be started')

const service = read('src/services/model-segments.service.ts')
for (const term of ['probabilityBucket', 'confidenceBucket', 'providerCallsMade: 0', 'remoteMutationsMade: 0', 'readOnly: true', 'model_segments_v1', 'model_intelligence_v1']) {
  assert(service.includes(term), `segment service missing ${term}`)
}
assert(!service.includes('.insert('), 'segment service must not insert')
assert(!service.includes('.update('), 'segment service must not update')
assert(!service.includes('.delete('), 'segment service must not delete')
assert(!service.includes('/providers/'), 'segment service must not call provider routes')

const segmentsRoute = read('src/app/api/model/segments/route.ts')
const intelligenceRoute = read('src/app/api/model/intelligence/route.ts')
assert(segmentsRoute.includes('getModelSegments'), 'segments route must call segment engine')
assert(intelligenceRoute.includes('getModelIntelligence'), 'intelligence route must call intelligence engine')

const docs = [
  'docs/DATA/PREDICTION_CONTEXT_INVENTORY.md',
  'docs/DATA/SEGMENT_ENGINE.md',
  'docs/DATA/INTELLIGENCE_API.md',
  'docs/DATA/FEATURE_SNAPSHOT.md',
  'docs/CERTIFICATION/RELEASE_06_DATA_INTELLIGENCE.md',
].map(read).join('\n')
for (const term of ['Home/Away', 'Favorite/Underdog', 'opening line', 'closing line', 'Learning label', 'No provider calls', 'No database mutations']) {
  assert(docs.toLowerCase().includes(term.toLowerCase()), `Release 06 docs missing ${term}`)
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
}

const scanned = [...walk('src'), ...walk('docs'), ...walk('scripts')]
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
  requiredFiles: requiredFiles.length,
  readOnly: true,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  deterministicBuckets: true,
  newApis: cert.newApis,
  warnings: 0,
  failures: failures.length,
  touchedFiles,
  failureMessages: failures,
}

console.log(JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)
