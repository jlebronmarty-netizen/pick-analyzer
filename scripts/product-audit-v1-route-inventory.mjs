import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, lstatSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const APP_DIR = join(ROOT, 'src', 'app')
const DOCS_DIR = join(ROOT, 'docs')
const DEFAULT_MAX_FILES = 5_000
const DEFAULT_TIMEOUT_MS = 30_000
const PROGRESS_EVERY_FILES = 100
const SCAN_ROOTS = [APP_DIR]
const EXCLUDED_DIR_NAMES = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'generated',
  'node_modules',
  'out',
])

function optionNumber(name, fallback) {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  const raw = arg ? arg.slice(prefix.length) : process.env[`PRODUCT_AUDIT_${name.toUpperCase()}`]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`)
  return parsed
}

const MAX_FILES = optionNumber('maxFiles', DEFAULT_MAX_FILES)
const TIMEOUT_MS = optionNumber('timeoutMs', DEFAULT_TIMEOUT_MS)

const majorRoutes = [
  {
    route: '/',
    navigationLabel: 'Home',
    section: 'HOME',
    primaryPurpose: 'Entry point and product launch surface.',
    apiDependencies: [],
    sportScope: 'multi-sport overview',
    dataSource: 'page shell',
    classification: 'PREVIEW',
    emptyStateBehavior: 'Static shell or redirect-style product entry.',
    currentUsefulness: 'Useful as a starting point only.',
    knownBlockers: ['Primary daily workflows live under Dashboard and Probability Picks.'],
  },
  {
    route: '/dashboard',
    navigationLabel: 'Dashboard',
    section: 'HOME',
    primaryPurpose: 'Current product status, current board, operations and advanced data panels.',
    apiDependencies: ['/api/dashboard', '/api/dashboard/today', '/api/system/version'],
    sportScope: 'multi-sport with MLB production surfaces and many diagnostic panels',
    dataSource: 'current stored data, model-generated summaries and operations diagnostics',
    classification: 'CURRENT_STORED',
    emptyStateBehavior: 'Shows panel-level unavailable states and warnings.',
    currentUsefulness: 'High, but dense and mixes product and operator concerns.',
    knownBlockers: ['Navigation density', 'some advanced panels expose technical states to normal users'],
  },
  {
    route: '/probability-picks',
    navigationLabel: 'Probability Picks',
    section: 'PICKS',
    primaryPurpose: 'Projection-only ranking of valid pregame probability rows and informational parlay combinations.',
    apiDependencies: ['/api/probability-picks', '/api/probability-picks/parlays'],
    sportScope: 'currently MLB-certified limited; other sports must not rank until certified',
    dataSource: 'prediction_history and MLB pitcher projection preview',
    classification: 'MODEL_GENERATED',
    emptyStateBehavior: 'Projection-only empty states; should include sport eligibility detail.',
    currentUsefulness: 'High when MLB rows exist; needs explicit eligibility labeling.',
    knownBlockers: ['non-MLB future rows can be accepted before sport certification unless filtered'],
  },
  {
    route: '/most-likely',
    navigationLabel: 'Most Likely',
    section: 'PICKS',
    primaryPurpose: 'Highest-probability informational opportunities from Current Board scan.',
    apiDependencies: ['/api/market-opportunities/most-likely'],
    sportScope: 'current board eligible sports',
    dataSource: 'stored prediction and market opportunity data',
    classification: 'CURRENT_STORED',
    emptyStateBehavior: 'Explains when Current Board has no active official candidates.',
    currentUsefulness: 'High for scanning likely outcomes.',
    knownBlockers: ['depends on stored current-board coverage and aligned markets'],
  },
  {
    route: '/best-value',
    navigationLabel: 'Best Value',
    section: 'PICKS',
    primaryPurpose: 'Positive value and policy-gated market opportunities.',
    apiDependencies: ['/api/market-opportunities/best-value'],
    sportScope: 'current board eligible sports',
    dataSource: 'stored prediction and market opportunity data',
    classification: 'CURRENT_STORED',
    emptyStateBehavior: 'Explains missing value or market blockers.',
    currentUsefulness: 'Useful when stored prices and policy gates are available.',
    knownBlockers: ['market coverage gaps'],
  },
  {
    route: '/arbitrage',
    navigationLabel: 'Arbitrage',
    section: 'MARKETS',
    primaryPurpose: 'Arbitrage scan that requires verified multi-book prices.',
    apiDependencies: ['/api/market-opportunities/arbitrage'],
    sportScope: 'markets with multi-book support',
    dataSource: 'stored market intelligence',
    classification: 'BLOCKED',
    emptyStateBehavior: 'States that consensus-only prices cannot prove arbitrage.',
    currentUsefulness: 'Limited until multi-book data is present.',
    knownBlockers: ['multi-book provider coverage unavailable'],
  },
  {
    route: '/ai-bet-finder',
    navigationLabel: 'AI Bet Finder',
    section: 'MARKETS',
    primaryPurpose: 'Deterministic assistant over existing board and market intelligence.',
    apiDependencies: ['/api/ai-bet-finder'],
    sportScope: 'current board eligible sports',
    dataSource: 'stored Current Board and market opportunity data',
    classification: 'CURRENT_STORED',
    emptyStateBehavior: 'Explains when no active candidates exist.',
    currentUsefulness: 'Useful as an explanation and triage surface.',
    knownBlockers: ['depends on stored board coverage'],
  },
  {
    route: '/projections',
    navigationLabel: 'Team Projections',
    section: 'PROJECTIONS',
    primaryPurpose: 'Team/game projection overview.',
    apiDependencies: ['/api/projections', '/api/mlb/projections'],
    sportScope: 'MLB plus universal projection surfaces',
    dataSource: 'stored/model-generated projections',
    classification: 'MODEL_GENERATED',
    emptyStateBehavior: 'Projection unavailable states.',
    currentUsefulness: 'Useful where stored projection rows exist.',
    knownBlockers: ['sport-specific maturity varies'],
  },
  {
    route: '/player-projections',
    navigationLabel: 'Player Projections',
    section: 'PROJECTIONS',
    primaryPurpose: 'MLB pitcher projection board and player prop comparison empty states.',
    apiDependencies: ['/api/mlb/player-projections', '/api/mlb/player-props'],
    sportScope: 'MLB',
    dataSource: 'MLB pitcher projection engine and stored player-prop rows',
    classification: 'MODEL_GENERATED',
    emptyStateBehavior: 'Projection Only and No prop available states.',
    currentUsefulness: 'High for pitcher workload analysis; market comparison is limited by prop coverage.',
    knownBlockers: ['player-prop ingestion entitlement and identity overlap'],
  },
  {
    route: '/betting-workbench',
    navigationLabel: 'Betting Workbench',
    section: 'MARKETS',
    primaryPurpose: 'Market review workspace for stored opportunities.',
    apiDependencies: ['/api/current-board', '/api/market-intelligence'],
    sportScope: 'current board eligible sports',
    dataSource: 'stored board and market intelligence',
    classification: 'CURRENT_STORED',
    emptyStateBehavior: 'Workbench unavailable or empty-state messaging.',
    currentUsefulness: 'Useful for operators and advanced users.',
    knownBlockers: ['market depth and technical language'],
  },
  {
    route: '/performance',
    navigationLabel: 'Performance',
    section: 'PERFORMANCE',
    primaryPurpose: 'Historical product performance, trust, calibration and prediction history.',
    apiDependencies: ['/api/performance', '/api/performance/trust'],
    sportScope: 'multi-sport stored history',
    dataSource: 'stored settled prediction history',
    classification: 'CURRENT_STORED',
    emptyStateBehavior: 'Insufficient comparison states when history is missing.',
    currentUsefulness: 'High for model accountability.',
    knownBlockers: ['requires settled rows and clear distinction between product and diagnostic rows'],
  },
  {
    route: '/ai-operations',
    navigationLabel: 'AI Operations',
    section: 'OPERATIONS',
    primaryPurpose: 'Operational evidence for autonomous daily operations.',
    apiDependencies: ['/api/ai-operations/lifecycle', '/api/autonomous-daily-operations/status'],
    sportScope: 'multi-sport operations',
    dataSource: 'operations diagnostics',
    classification: 'INTERNAL_ONLY',
    emptyStateBehavior: 'Temporarily unavailable panel state.',
    currentUsefulness: 'High for operators, not a primary consumer screen.',
    knownBlockers: ['developer-oriented language'],
  },
  {
    route: '/model',
    navigationLabel: 'Model',
    section: 'PERFORMANCE',
    primaryPurpose: 'Model status, versions, learning, calibration and rollback diagnostics.',
    apiDependencies: ['/api/model/status', '/api/model/versions', '/api/model/metrics'],
    sportScope: 'multi-sport model operations',
    dataSource: 'stored model diagnostics',
    classification: 'INTERNAL_ONLY',
    emptyStateBehavior: 'Panel-level unavailable states.',
    currentUsefulness: 'High for governance and operators.',
    knownBlockers: ['should remain clearly administrative'],
  },
  {
    route: '/mlb-operations',
    navigationLabel: 'MLB Operations',
    section: 'OPERATIONS',
    primaryPurpose: 'MLB provider, starters, projections and market operations.',
    apiDependencies: ['/api/mlb/operations-center', '/api/mlb/starters/health', '/api/mlb/player-props/health'],
    sportScope: 'MLB',
    dataSource: 'stored MLB operational diagnostics',
    classification: 'CURRENT_STORED',
    emptyStateBehavior: 'Blocked and readiness states for unavailable provider capabilities.',
    currentUsefulness: 'High for operators.',
    knownBlockers: ['provider contracts and market coverage'],
  },
  {
    route: '/game-intelligence',
    navigationLabel: 'Game Intelligence',
    section: 'PROJECTIONS',
    primaryPurpose: 'Game-level intelligence list and drilldown.',
    apiDependencies: ['/api/mlb/game-intelligence'],
    sportScope: 'MLB',
    dataSource: 'stored/model-generated MLB game intelligence',
    classification: 'MODEL_GENERATED',
    emptyStateBehavior: 'Unavailable or no event intelligence state.',
    currentUsefulness: 'Useful for MLB game review.',
    knownBlockers: ['event coverage and current stored data availability'],
  },
  {
    route: '/admin/historical-diagnostics',
    navigationLabel: 'Historical Diagnostics',
    section: 'ADMINISTRATION',
    primaryPurpose: 'Historical import and data-foundation diagnostics.',
    apiDependencies: ['/api/historical-import/health', '/api/data-foundation/readiness'],
    sportScope: 'multi-sport data foundation',
    dataSource: 'migration readiness and import diagnostics',
    classification: 'MIGRATION_PENDING',
    emptyStateBehavior: 'Migration-pending and diagnostic states.',
    currentUsefulness: 'High for administrators only.',
    knownBlockers: ['DATA_FOUNDATION_V2_EPOCH inactive and seed unapplied'],
  },
]

function ensureWithinExplicitScanRoots(dir) {
  const normalized = dir.toLowerCase()
  const allowed = SCAN_ROOTS.some((root) => normalized === root.toLowerCase() || normalized.startsWith(`${root.toLowerCase()}${sep}`))
  if (!allowed) throw new Error(`Refusing to scan outside explicit source roots: ${dir}`)
}

function walk(dir, context, files = []) {
  ensureWithinExplicitScanRoots(dir)
  if (Date.now() > context.deadlineAt) throw new Error(`Inventory scan exceeded ${TIMEOUT_MS}ms timeout`)
  for (const item of readdirSync(dir)) {
    const full = join(dir, item)
    const stat = lstatSync(full)
    if (stat.isSymbolicLink()) continue
    if (stat.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(item)) continue
      walk(full, context, files)
      continue
    }
    files.push(full)
    context.scannedFiles += 1
    if (context.scannedFiles > MAX_FILES) throw new Error(`Inventory scan exceeded maxFiles=${MAX_FILES}`)
    if (context.scannedFiles % PROGRESS_EVERY_FILES === 0) {
      console.error(`[product-route-inventory] scanned ${context.scannedFiles} files`)
    }
  }
  return files
}

function routeFromFile(file, suffix) {
  const rel = relative(APP_DIR, file).split(sep).join('/')
  const without = rel.slice(0, -suffix.length)
  const parts = without.split('/').filter((part) => part !== 'page' && part !== 'route' && !part.startsWith('('))
  const route = '/' + parts.join('/')
  return route === '/' ? '/' : route.replace(/\/$/, '')
}

function classifyApi(route) {
  if (route.includes('/cron/') || route.includes('/execute') || route.includes('/sync') || route.includes('/import') || route.includes('/seed') || route.includes('/backfill') || route.includes('/recalculate') || route.includes('/settle')) {
    return 'MUTATION_OR_PROTECTED'
  }
  if (route.includes('/validation') || route.includes('/health') || route.includes('/readiness') || route.includes('/status')) return 'READ_ONLY_DIAGNOSTIC'
  return 'READ_MOSTLY'
}

function scanSourceForFetches(file) {
  const text = readFileSync(file, 'utf8')
  return [...new Set([...text.matchAll(/fetch\(['"`]([^'"`]+)['"`]/g)].map((match) => match[1]))].filter((value) => value.startsWith('/api/'))
}

function discover() {
  const context = {
    deadlineAt: Date.now() + TIMEOUT_MS,
    scannedFiles: 0,
  }
  const files = SCAN_ROOTS.flatMap((dir) => walk(dir, context))
  console.error(`[product-route-inventory] completed source scan: ${context.scannedFiles} files`)
  const pages = files.filter((file) => file.endsWith(`${sep}page.tsx`)).map((file) => ({
    route: routeFromFile(file, 'page.tsx'),
    file: relative(ROOT, file),
    inlineApiDependencies: scanSourceForFetches(file),
  })).sort((a, b) => a.route.localeCompare(b.route))
  const apis = files.filter((file) => file.endsWith(`${sep}route.ts`)).map((file) => {
    const route = routeFromFile(file, 'route.ts')
    return {
      route,
      file: relative(ROOT, file),
      classification: classifyApi(route),
    }
  }).sort((a, b) => a.route.localeCompare(b.route))
  return { pages, apis }
}

function markdownFor(inventory) {
  const rows = inventory.majorRouteMatrix.map((item) => `| \`${item.route}\` | ${item.navigationLabel} | ${item.section} | ${item.classification} | ${item.currentUsefulness} | ${item.knownBlockers.join('; ') || 'None recorded'} |`)
  return `# Product Route Inventory V1

Generated: ${inventory.generatedAt}

## Summary

- User-facing page routes scanned: ${inventory.counts.pageRoutes}
- API routes scanned: ${inventory.counts.apiRoutes}
- Major product routes classified: ${inventory.majorRouteMatrix.length}
- API routes marked mutation/protected by path: ${inventory.counts.mutationOrProtectedApiRoutes}
- Bounded local smoke: skipped (${inventory.localSmoke.reason})
- Provider calls during audit: 0
- Remote mutations during audit: 0

## Major Route Matrix

| Route | Label | Section | Data State | Current Usefulness | Known Blockers |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## API Inventory

The machine-readable inventory in \`docs/product-route-inventory-v1.json\` includes every discovered \`src/app/api/**/route.ts\` file with a conservative path-based read-only/protected classification.

## Certification

PRODUCT_ROUTE_INVENTORY_PASS
`
}

async function main() {
  mkdirSync(DOCS_DIR, { recursive: true })
  const discovered = discover()
  const localSmoke = {
    skipped: true,
    reason: 'LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS; inventory generation is source-only and does not spawn a Next.js server.',
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
  const apiCounts = discovered.apis.reduce((acc, item) => {
    acc[item.classification] = (acc[item.classification] ?? 0) + 1
    return acc
  }, {})
  const inventory = {
    generatedAt: new Date().toISOString(),
    startingCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    counts: {
      pageRoutes: discovered.pages.length,
      apiRoutes: discovered.apis.length,
      readOnlyDiagnosticApiRoutes: apiCounts.READ_ONLY_DIAGNOSTIC ?? 0,
      readMostlyApiRoutes: apiCounts.READ_MOSTLY ?? 0,
      mutationOrProtectedApiRoutes: apiCounts.MUTATION_OR_PROTECTED ?? 0,
    },
    discovered,
    majorRouteMatrix: majorRoutes,
    localSmoke,
    certification: {
      PRODUCT_ROUTE_INVENTORY_PASS: true,
      PRODUCT_VISUAL_AUDIT_PASS: false,
      PRODUCT_FUNCTIONAL_AUDIT_PASS: false,
      LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS: true,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    },
  }
  writeFileSync(join(DOCS_DIR, 'product-route-inventory-v1.json'), `${JSON.stringify(inventory, null, 2)}\n`)
  writeFileSync(join(DOCS_DIR, 'PRODUCT_ROUTE_INVENTORY_V1.md'), markdownFor(inventory))
  console.log(JSON.stringify({
    success: true,
    pageRoutes: inventory.counts.pageRoutes,
    apiRoutes: inventory.counts.apiRoutes,
    smokeSkipped: localSmoke.skipped,
    smokeReason: localSmoke.reason,
    smokePassed: 0,
    smokeTotal: 0,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }, null, 2))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
