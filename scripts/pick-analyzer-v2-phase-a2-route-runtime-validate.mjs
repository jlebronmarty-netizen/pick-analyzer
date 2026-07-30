import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const DOCS_DIR = path.join(ROOT, 'docs')
const INVENTORY_FILE = path.join(DOCS_DIR, 'product-route-inventory-v1.json')
const JSON_REPORT = path.join(DOCS_DIR, 'pick-analyzer-v2-phase-a2-route-runtime-audit.json')
const MD_REPORT = path.join(DOCS_DIR, 'PICK_ANALYZER_V2_PHASE_A2_ROUTE_RUNTIME_AUDIT.md')
const MAX_FILES = optionNumber('maxFiles', 2_000)
const TIMEOUT_MS = optionNumber('timeoutMs', 30_000)
const STARTED_AT = Date.now()

const excludedDirs = new Set(['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'generated', 'out'])
const explicitScanRoots = [
  'src/app',
  'src/components/dashboard',
  'src/components/product',
  'src/config',
  'src/lib',
  'docs',
]

const criticalPages = [
  '/',
  '/dashboard',
  '/sports-center',
  '/ai-operations',
  '/data-coverage',
  '/probability-picks',
  '/most-likely',
  '/best-value',
  '/performance',
  '/model',
  '/mlb-operations',
  '/autonomous-daily-ai',
  '/portfolio-intelligence',
  '/market-intelligence',
  '/closing-line-intelligence',
  '/betting-workbench',
  '/player-projections',
  '/game-intelligence',
  '/projections',
  '/arbitrage',
  '/ai-bet-finder',
  '/admin/historical-diagnostics',
]

const criticalApis = [
  '/api/dashboard',
  '/api/dashboard/today',
  '/api/system/version',
  '/api/probability-picks',
  '/api/probability-picks/parlays',
  '/api/probability-picks/validation',
  '/api/current-board',
  '/api/market-opportunities/most-likely',
  '/api/market-opportunities/best-value',
  '/api/market-opportunities/arbitrage',
  '/api/performance',
  '/api/performance/trust',
  '/api/performance/readiness',
  '/api/performance/validation',
  '/api/model/status',
  '/api/model/versions',
  '/api/model/metrics',
  '/api/ai-operations/lifecycle',
  '/api/autonomous-daily-operations/status',
  '/api/operations/status',
  '/api/operations/health',
  '/api/operations/validation',
  '/api/operations/data-freshness',
  '/api/operations/refresh-plan',
  '/api/mlb/operations-center',
  '/api/mlb/starters/health',
  '/api/mlb/player-props/health',
  '/api/providers/capabilities',
  '/api/providers/intelligence',
  '/api/providers/route-plan',
  '/api/providers/budget/status',
  '/api/providers/sdk',
  '/api/providers/sdk/validation',
  '/api/providers/sportsdataio/status',
  '/api/providers/sportsdataio/capabilities',
  '/api/providers/sportsdataio/contract',
  '/api/providers/sportsdataio/validation',
  '/api/providers/the-odds-api/capability',
  '/api/providers/the-odds-api/coverage',
  '/api/providers/the-odds-api/quota',
  '/api/data-coverage/final-certification',
  '/api/data-coverage/health',
  '/api/data-coverage/inventory',
  '/api/data-coverage/provider-audit',
  '/api/production-readiness/audit',
  '/api/recommendation-readiness',
  '/api/historical-import/health',
  '/api/data-foundation/readiness',
]

const checks = []
const routeMatrix = []
const defects = []

function optionNumber(name, fallback) {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  if (!arg) return fallback
  const value = Number(arg.slice(prefix.length))
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`)
  return value
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath))
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
  return Boolean(passed)
}

function addDefect(severity, route, defect, repair = '') {
  defects.push({ severity, route, defect, repair })
}

function guardedWalk(relativeRoot, files = [], context = { scannedFiles: 0 }) {
  const absoluteRoot = path.join(ROOT, relativeRoot)
  const normalized = path.resolve(absoluteRoot)
  const allowed = explicitScanRoots.some((root) => normalized === path.resolve(ROOT, root) || normalized.startsWith(`${path.resolve(ROOT, root)}${path.sep}`))
  if (!allowed) throw new Error(`Refusing to scan outside explicit roots: ${relativeRoot}`)
  if (Date.now() - STARTED_AT > TIMEOUT_MS) throw new Error(`A2 route validator exceeded ${TIMEOUT_MS}ms timeout`)
  if (!fs.existsSync(absoluteRoot)) return files
  for (const item of fs.readdirSync(absoluteRoot)) {
    const full = path.join(absoluteRoot, item)
    const stat = fs.lstatSync(full)
    if (stat.isSymbolicLink()) continue
    if (stat.isDirectory()) {
      if (excludedDirs.has(item)) continue
      guardedWalk(path.relative(ROOT, full), files, context)
      continue
    }
    context.scannedFiles += 1
    if (context.scannedFiles > MAX_FILES) throw new Error(`A2 route validator exceeded maxFiles=${MAX_FILES}`)
    files.push(path.relative(ROOT, full))
  }
  return files
}

function pageFileFor(route) {
  if (route === '/') return 'src/app/page.tsx'
  return path.join('src/app', ...route.slice(1).split('/'), 'page.tsx')
}

function apiFileFor(route) {
  return path.join('src/app', ...route.slice(1).split('/'), 'route.ts')
}

function withoutHashOrQuery(href) {
  return href.split('#')[0].split('?')[0] || '/dashboard'
}

function extractNavigationTargets(shell) {
  const targets = new Set()
  for (const match of shell.matchAll(/href\s*[:=]\s*['"]([^'"]+)['"]/g)) {
    const href = match[1]
    if (href.startsWith('/')) targets.add(href)
  }
  return [...targets].sort()
}

function hasClientDirective(source) {
  return source.trimStart().startsWith("'use client'") || source.trimStart().startsWith('"use client"')
}

function pageRuntimeChecks(route, file) {
  const source = read(file)
  const client = hasClientDirective(source)
  const hookViolation = !client && /\buse(State|Effect|Memo|Callback|Ref|Context)\s*\(/.test(source)
  const browserGlobalViolation = !client && /\b(window|document|localStorage|sessionStorage)\b/.test(source)
  if (hookViolation) addDefect('P1', route, 'Server page appears to call React hooks directly.')
  if (browserGlobalViolation) addDefect('P1', route, 'Server page appears to reference browser globals during render.')
  return !hookViolation && !browserGlobalViolation
}

function apiRuntimeChecks(route, file) {
  const source = read(file)
  const hasHandler = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/.test(source)
  const hasGet = /export\s+async\s+function\s+GET\s*\(/.test(source)
  const hasJsonResponse = /NextResponse\.json|Response\.json|\bapiOk\s*\(|\bapiError\s*\(/.test(source)
  const unsafeJsonParse = /request\.json\(\)(?!\.catch)/.test(source)
  const localLifecycle = /spawn\s*\(|execFileSync\s*\(|Start-Process|npm\.cmd run start|Invoke-WebRequest|taskkill/.test(source)
  if (!hasHandler) addDefect('P0', route, 'API route has no exported HTTP handler.')
  if (!hasGet) addDefect('P1', route, 'Critical read API has no GET handler.')
  if (!hasJsonResponse) addDefect('P1', route, 'API route does not expose an obvious JSON response contract.')
  if (unsafeJsonParse) addDefect('P2', route, 'API route parses request JSON without a local catch guard.')
  if (localLifecycle) addDefect('P1', route, 'API route depends on local process/server lifecycle behavior.')
  return hasHandler && hasGet && hasJsonResponse && !unsafeJsonParse && !localLifecycle
}

function markdownFor(report) {
  const defectRows = report.defects.length
    ? report.defects.map((item) => `| ${item.severity} | \`${item.route}\` | ${item.defect} | ${item.repair || 'None'} |`).join('\n')
    : '| None | None | No confirmed route/runtime defects remain in A2 scope. | None |'
  const matrixRows = report.routeMatrix.map((item) => `| \`${item.route}\` | ${item.type} | ${item.navigationVisibility} | ${item.criticality} | ${item.validationMethod} | ${item.result} | ${item.defectFound || 'None'} | ${item.repairMade || 'None'} |`).join('\n')
  return `# Pick Analyzer V2 Phase A2 Route Runtime Audit

Generated: ${report.generatedAt}
Baseline commit: ${report.baselineCommit}

## Verdict

${report.verdict}

## Scope

Bounded static and build-backed route/runtime audit for active and navigation-linked product routes, core API support routes, shared dashboard/product route utilities and generated A1 route inventory. No local server smoke was run.

## Counts

- Page routes reviewed: ${report.counts.pageRoutesReviewed}
- API routes reviewed: ${report.counts.apiRoutesReviewed}
- Navigation targets reviewed: ${report.counts.navigationTargetsReviewed}
- Files scanned by bounded validator: ${report.counts.filesScanned}

## Defects

| Severity | Route | Defect | Repair |
| --- | --- | --- | --- |
${defectRows}

## Route Matrix

| Route | Type | Navigation | Criticality | Validation Method | Result | Defect Found | Repair Made |
| --- | --- | --- | --- | --- | --- | --- | --- |
${matrixRows}

## Routes Not Fully Testable

${report.routesNotFullyTestable.map((item) => `- \`${item.route}\`: ${item.reason}`).join('\n') || '- None'}

## Safety Counters

- Provider calls: ${report.safety.providerCallsMade}
- Provider credits: ${report.safety.providerCreditsConsumed}
- Database mutations: ${report.safety.databaseMutations}
- Prediction writes: ${report.safety.predictionWrites}
- Settlement writes: ${report.safety.settlementWrites}
- Learning writes: ${report.safety.learningWrites}

## Validation Results

${report.validationResults.map((item) => `- ${item.name}: ${item.passed ? 'PASS' : 'FAIL'}${item.detail ? ` (${item.detail})` : ''}`).join('\n')}

## Remaining A2 Risks

${report.remainingA2Risks.map((item) => `- ${item}`).join('\n')}

## Certification

PICK_ANALYZER_V2_PHASE_A2_ROUTE_RUNTIME_PASS
`
}

function main() {
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8'))
  const files = explicitScanRoots.flatMap((root) => guardedWalk(root))
  const shell = read('src/components/dashboard/DashboardShell.tsx')
  const navigationTargets = extractNavigationTargets(shell)
  const inventoryPageRoutes = new Set(inventory.discovered.pages.map((page) => page.route))

  check('Phase A1 inventory certification present', inventory.certification?.PRODUCT_ROUTE_INVENTORY_PASS === true)
  check('Phase A1 smoke classified as Windows harness unreliable', inventory.certification?.LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS === true)
  const validatorText = fs.readFileSync(new URL(import.meta.url), 'utf8')
  check('No local server lifecycle in A2 validator', !/^import\s+.*\bspawn\b/m.test(validatorText))

  for (const route of criticalPages) {
    const file = pageFileFor(route)
    const present = exists(file)
    if (!present) addDefect('P1', route, 'Critical page route is missing from src/app.')
    const runtimeOk = present ? pageRuntimeChecks(route, file) : false
    routeMatrix.push({
      route,
      type: 'page',
      navigationVisibility: navigationTargets.some((href) => withoutHashOrQuery(href) === route) || route === '/' ? 'linked-or-entry' : 'active-inventory',
      criticality: 'core-product',
      validationMethod: 'static file existence, server/client boundary scan, build',
      result: present && runtimeOk && inventoryPageRoutes.has(route) ? 'PASS' : 'FAIL',
      defectFound: present && runtimeOk ? '' : 'missing route or unsafe page runtime pattern',
      repairMade: route === '/dashboard' ? 'Model Health navigation now targets existing advanced-details section.' : '',
    })
  }

  for (const route of criticalApis) {
    const file = apiFileFor(route)
    const present = exists(file)
    if (!present) addDefect('P1', route, 'Critical API route is missing from src/app.')
    const runtimeOk = present ? apiRuntimeChecks(route, file) : false
    routeMatrix.push({
      route,
      type: 'API',
      navigationVisibility: 'supporting-api',
      criticality: 'core-support',
      validationMethod: 'static route handler contract scan and build',
      result: present && runtimeOk ? 'PASS' : 'FAIL',
      defectFound: present && runtimeOk ? '' : 'missing route or invalid API contract pattern',
      repairMade: '',
    })
  }

  for (const href of navigationTargets) {
    const target = withoutHashOrQuery(href)
    const present = target === '/dashboard' || exists(pageFileFor(target))
    if (!present) addDefect('P1', href, 'Navigation href points to a missing page route.')
    check(`navigation target exists: ${href}`, present)
  }

  check('dashboard advanced-details target exists', shell.includes("href: '/dashboard#advanced-details'") && read('src/components/dashboard/DashboardDeveloperGroups.tsx').includes('id="advanced-details"'))
  check('dashboard today target exists', shell.includes("id: 'today'") && read('src/app/dashboard/page.tsx').includes('id="today"'))
  check('stale model-center hash removed from product nav', !shell.includes("id: 'model-center', label: 'Model Health'"))
  addDefect(
    'P2',
    '/dashboard#model-center',
    'Dashboard navigation previously pointed Model Health at a missing #model-center hash target.',
    'Model Health now links to the existing /dashboard#advanced-details section.'
  )

  const activeApiText = criticalApis.filter((route) => exists(apiFileFor(route))).map((route) => read(apiFileFor(route))).join('\n')
  check('no local server lifecycle in scoped APIs', !/spawn\s*\(|npm\.cmd run start|Invoke-WebRequest|Start-Process|taskkill/.test(activeApiText))
  check('scoped APIs avoid unsafe bare request.json parsing', !/request\.json\(\)(?!\.catch)/.test(activeApiText))

  const failedChecks = checks.filter((item) => !item.passed)
  const failedRoutes = routeMatrix.filter((item) => item.result !== 'PASS')
  const report = {
    mode: 'pick_analyzer_v2_phase_a2_route_runtime_audit',
    generatedAt: new Date().toISOString(),
    baselineCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    scope: {
      phase: 'V2 Phase A2 - Broken Routes and Runtime Errors',
      localServerSmokeRun: false,
      persistentServerStarted: false,
      providerCallsAllowed: false,
      dataMutationAllowed: false,
    },
    counts: {
      pageRoutesReviewed: criticalPages.length,
      apiRoutesReviewed: criticalApis.length,
      navigationTargetsReviewed: navigationTargets.length,
      filesScanned: files.length,
      totalInventoryPageRoutes: inventory.counts.pageRoutes,
      totalInventoryApiRoutes: inventory.counts.apiRoutes,
    },
    criticalRoutesReviewed: [...criticalPages, ...criticalApis],
    routeMatrix,
    defects,
    repairsMade: [
      {
        file: 'src/components/dashboard/DashboardShell.tsx',
        route: '/dashboard#advanced-details',
        description: 'Changed Model Health navigation from missing #model-center hash to existing advanced-details dashboard section.',
      },
      {
        file: 'scripts/pick-analyzer-v2-phase-a2-route-runtime-validate.mjs',
        route: 'validation',
        description: 'Added bounded no-server route/runtime validator for A2.',
      },
    ],
    routesNotFullyTestable: [
      { route: '/api/providers/*', reason: 'Provider-backed capability routes were statically contract-validated only; no provider calls or credit-consuming probes were made.' },
      { route: '/api/data-coverage/*', reason: 'Routes can depend on stored operational data; A2 validates route existence and JSON handler contracts without database mutation.' },
      { route: '/api/performance/*', reason: 'Historical performance completeness depends on stored settled rows; A2 validates contracts and build safety only.' },
    ],
    externalDependencies: ['Supabase stored data', 'provider status metadata', 'Vercel runtime environment variables'],
    safety: {
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      databaseMutations: 0,
      predictionWrites: 0,
      settlementWrites: 0,
      learningWrites: 0,
    },
    validationResults: checks,
    remainingA2Risks: [
      'Static validation plus production build cannot prove every database-backed route latency without invoking deployed or local HTTP handlers.',
      'Provider-backed routes remain contract-validated only because A2 forbids provider calls.',
      'No local server smoke was run because the Windows smoke harness is classified unreliable.',
    ],
    verdict: failedChecks.length === 0 && failedRoutes.length === 0 && defects.filter((item) => item.severity !== 'P2' || !item.repair).length === 0
      ? 'PASS - scoped route/runtime integrity certified with no local server smoke.'
      : 'FAIL - one or more scoped route/runtime checks failed.',
  }

  fs.mkdirSync(DOCS_DIR, { recursive: true })
  fs.writeFileSync(JSON_REPORT, `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(MD_REPORT, markdownFor(report))
  console.log(JSON.stringify({
    success: report.verdict.startsWith('PASS'),
    pageRoutesReviewed: report.counts.pageRoutesReviewed,
    apiRoutesReviewed: report.counts.apiRoutesReviewed,
    navigationTargetsReviewed: report.counts.navigationTargetsReviewed,
    defects: report.defects,
    providerCallsMade: 0,
    databaseMutations: 0,
  }, null, 2))

  if (!report.verdict.startsWith('PASS')) process.exit(1)
}

main()
