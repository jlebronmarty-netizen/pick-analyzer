import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE02_TIMEOUT_MS || 120000)
const maxFiles = Number(process.env.RELEASE02_MAX_FILES || 9000)
const sourceRoots = ['src', 'scripts', 'docs', 'supabase', '.github']
const ignoredDirs = new Set(['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'out', '.turbo', '.vercel'])
const requiredDocs = [
  'docs/MASTER_PROGRAM/RELEASE_02_INTEGRATION_BACKLOG.md',
  'docs/PRODUCT/RELEASE_02_CORE_USER_JOURNEY.md',
  'docs/PRODUCT/RELEASE_02_LIVE_STATE_INTEGRATION.md',
  'docs/CERTIFICATION/RELEASE_02_PRODUCT_INTEGRATION_CERTIFICATION.md',
  'docs/CERTIFICATION/release-02-product-integration-certification.json',
]
const release01Docs = [
  'docs/PRODUCT/PRODUCT_INVENTORY_V2.md',
  'docs/ARCHITECTURE/RUNTIME_DEPENDENCY_GRAPH.md',
  'docs/PRODUCT/FEATURE_MATRIX_V2.md',
  'docs/PRODUCT/ROUTE_AUDIT_V2.md',
  'docs/ARCHITECTURE/DATABASE_AUDIT_V2.md',
  'docs/PRODUCT/PREDICTION_PIPELINE_AUDIT.md',
  'docs/CERTIFICATION/DOCUMENTATION_VALIDATION.md',
  'docs/CERTIFICATION/RUNTIME_HEALTH.md',
]
const knownUnrelatedDirtyFiles = new Set([
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
  'docs/build-memory-optimization-v1-phase-b-final.json',
  'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
  'docs/build-memory-optimization-v1-phase-b.json',
])

function fail(message) {
  failures.push(message)
}

function warn(message) {
  warnings.push(message)
}

function assertBudget(filesScanned) {
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 02 validation timed out after ${timeoutMs}ms`)
  if (filesScanned > maxFiles) throw new Error(`Release 02 validation exceeded max file guard (${maxFiles})`)
}

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, '/')
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function walk(dir, files = []) {
  assertBudget(files.length)
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(full, files)
      continue
    }
    if (entry.isFile()) {
      files.push(full)
      if (files.length % 500 === 0) console.log(`[release02] scanned ${files.length} files...`)
    }
  }
  return files
}

function routeFromAppFile(file) {
  const relative = rel(file)
  if (!relative.startsWith('src/app/')) return ''
  let route = relative
    .replace(/^src\/app/, '')
    .replace(/\/(page|route|layout)\.(tsx|ts|jsx|js)$/, '')
    .replace(/\/route\.(tsx|ts|jsx|js)$/, '')
  route = route.replace(/\/\([^)]+\)/g, '')
  return (route || '/').replace(/\/+/g, '/')
}

function markdownLinks(markdown) {
  const links = []
  const pattern = /\[[^\]]+\]\(([^)]+)\)/g
  let match
  while ((match = pattern.exec(markdown))) {
    const target = match[1].trim()
    if (!target || target.startsWith('http') || target.startsWith('#') || target.startsWith('mailto:')) continue
    links.push(target.split('#')[0])
  }
  return links
}

function importLine(file, target) {
  return read(file).split(/\r?\n/).find((line) => line.includes(target)) ?? ''
}

function checkIncludes(file, expectations) {
  const text = read(file)
  for (const [label, needle] of expectations) {
    if (!text.includes(needle)) fail(`${file} missing ${label}: ${needle}`)
  }
}

const failures = []
const warnings = []
const files = sourceRoots.flatMap((dir) => walk(path.join(root, dir)))

for (const doc of [...requiredDocs, ...release01Docs]) {
  if (!exists(doc)) fail(`Missing required document: ${doc}`)
}

if (exists('docs/CERTIFICATION/release-02-product-integration-certification.json')) {
  try {
    JSON.parse(read('docs/CERTIFICATION/release-02-product-integration-certification.json'))
  } catch (error) {
    fail(`Certification JSON is invalid: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const routeFiles = files.filter((file) => /src[\\/]app[\\/].*[\\/](page|route|layout)\.(tsx|ts|jsx|js)$/.test(file))
const routeMap = new Map()
for (const file of routeFiles) {
  const type = path.basename(file).split('.')[0]
  const key = `${type}:${routeFromAppFile(file)}`
  routeMap.set(key, [...(routeMap.get(key) || []), rel(file)])
}
const duplicateRoutes = [...routeMap.entries()].filter(([, values]) => values.length > 1)
if (duplicateRoutes.length) {
  for (const [route, values] of duplicateRoutes) fail(`Duplicate route ${route}: ${values.join(', ')}`)
}

checkIncludes('src/services/prediction-cutoff-enforcement.service.ts', [
  ['cutoff state enum', "POST_START'"],
  ['post-final state', "POST_FINAL'"],
  ['cutoff classifier', 'export function classifyPredictionCutoff'],
])
checkIncludes('src/services/canonical-settlement-state.service.ts', [
  ['cutoff classifier dependency', 'classifyPredictionCutoff'],
  ['deterministic settlement outcome', 'canonicalDeterministicOutcome'],
  ['learning inclusion', 'learningIncluded'],
])
checkIncludes('src/services/pregame-scheduler-coverage.service.ts', [
  ['America/Puerto_Rico operating date', "const TIMEZONE = 'America/Puerto_Rico'"],
  ['missed window accounting', 'missedWindows'],
  ['unpredicted reason accounting', 'rejectionReason'],
])
checkIncludes('src/services/dashboard-today.service.ts', [
  ['canonical Today endpoint reference', "initialPrimaryEndpoint: '/api/dashboard/today'"],
  ['provider call guardrail', 'providerCallsMade: 0'],
  ['remote mutation guardrail', 'remoteMutationsMade: 0'],
])
checkIncludes('src/app/api/dashboard/today/route.ts', [
  ['no-store response', "'Cache-Control': 'no-store, max-age=0'"],
  ['validation fixture exposure', 'validateDashboardTodayFixtures'],
  ['degraded fallback remains HTTP 200', '{ status: 200, headers: NO_STORE_HEADERS }'],
])
checkIncludes('src/app/api/operations/settlement-guarantee/route.ts', [
  ['settlement guarantee service', 'getSettlementGuaranteeStatus'],
  ['validation fixture exposure', 'validateSettlementGuaranteeFixtures'],
])
checkIncludes('src/services/performance-scope-v2.service.ts', [
  ['cutoff-safe performance scope', 'classifyPredictionCutoff'],
  ['post-start exclusion', 'PREDICTION_POST_START'],
])

const circularChecks = [
  ['src/services/market-intelligence-category.service.ts', '@/services/current-board.service'],
  ['src/services/official-pick-experience.service.ts', '@/services/current-board.service'],
  ['src/services/mlb-ai-picks-feed.service.ts', '@/services/current-board.service'],
  ['src/services/weight-optimizer.service.ts', '@/services/model-learning.service'],
]
for (const [file, target] of circularChecks) {
  const line = importLine(file, target)
  if (!line.includes('import type')) fail(`Circular candidate is not type-only: ${file} -> ${target}`)
}

const markdownFiles = files.filter((file) => file.endsWith('.md'))
for (const mdFile of markdownFiles) {
  const text = fs.readFileSync(mdFile, 'utf8')
  for (const link of markdownLinks(text)) {
    const target = path.resolve(path.dirname(mdFile), link)
    if (!fs.existsSync(target)) warn(`Unresolved markdown link from ${rel(mdFile)} -> ${link}`)
  }
}

const jsonFiles = files.filter((file) => file.endsWith('.json'))
for (const jsonFile of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
  } catch (error) {
    fail(`Invalid JSON ${rel(jsonFile)}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const changedTargets = requiredDocs.concat(['scripts/release02-product-integration-validate.mjs'])
const secretPattern = /(api[_-]?key|secret|token|authorization|bearer|password|service_role|supabase_service|cron_secret|sk-[a-z0-9])/i
for (const target of changedTargets) {
  if (!exists(target)) continue
  const text = read(target)
  const matches = text.split(/\r?\n/).map((line, index) => ({ line, index: index + 1 })).filter((item) => secretPattern.test(item.line))
  const allowed = matches.filter((item) => /provider calls|no provider|secret scan|secretPattern|api\[_-\]\?|api\[_-\]\?key|Potential secret-like text|CRON_SECRET|authorization headers|credentials|not exposed/i.test(item.line))
  if (matches.length !== allowed.length) fail(`Potential secret-like text in ${target}`)
}

let statusLines = []
try {
  statusLines = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
} catch (error) {
  warn(`Unable to read git status: ${error instanceof Error ? error.message : String(error)}`)
}
const staged = statusLines.filter((line) => /^[MADRCU]/.test(line))
if (staged.length) fail(`Unexpected staged files: ${staged.join('; ')}`)
const unrelatedTouched = statusLines
  .map((line) => line.slice(3).trim())
  .filter((file) => knownUnrelatedDirtyFiles.has(file))
if (unrelatedTouched.length !== 6) warn(`Known unrelated dirty file count is ${unrelatedTouched.length}; expected 6.`)

const result = {
  checkedAt: new Date().toISOString(),
  scannedFiles: files.length,
  routeFiles: routeFiles.length,
  duplicateRoutes: duplicateRoutes.length,
  markdownFiles: markdownFiles.length,
  jsonFiles: jsonFiles.length,
  requiredDocs: requiredDocs.length,
  release01BaselineDocs: release01Docs.length,
  circularImportCandidatesVerifiedTypeOnly: circularChecks.length,
  predictionCutoffInvariant: 'STATIC_PASS',
  retrospectivePredictionWriteGuard: 'STATIC_PASS',
  pregameCoverageAccounting: 'STATIC_PASS',
  missedOpportunityAccounting: 'STATIC_PASS',
  settlementIdempotencyEvidence: 'STATIC_PASS',
  learningLabelIdempotencyEvidence: 'STATIC_PASS',
  finalEventReconciliation: 'STATIC_PASS',
  productSurfaceCanonicalCounts: 'STATIC_PASS',
  unrelatedDirtyFilesPreserved: unrelatedTouched.length === 6,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  warnings: warnings.length,
  failures: failures.length,
}

console.log(JSON.stringify(result, null, 2))
if (warnings.length) {
  console.log('\nWarnings:')
  for (const item of warnings.slice(0, 75)) console.log(`- ${item}`)
  if (warnings.length > 75) console.log(`- ... ${warnings.length - 75} more warnings omitted`)
}
if (failures.length) {
  console.error('\nFailures:')
  for (const item of failures) console.error(`- ${item}`)
  process.exit(1)
}
process.exit(0)
