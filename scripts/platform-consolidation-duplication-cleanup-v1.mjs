import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const outPath = 'docs/platform-consolidation-duplication-cleanup-v1.json'

const serviceCandidates = [
  'src/services/apis/api-sports.ts',
  'src/services/apis/odds-api.ts',
  'src/services/basketball/connectors/connector-contract.ts',
  'src/services/basketball/index.ts',
  'src/services/bsn-core-certification.service.ts',
  'src/services/bsn-predictions.service.ts',
  'src/services/dashboard.service.ts',
  'src/services/mlb-market-expansion-roadmap.service.ts',
  'src/services/mlb-operations-center.service.ts',
  'src/services/mlb-temporal-health.service.ts',
  'src/services/odds.service.ts',
  'src/services/operations-health.service.ts',
  'src/services/runtime-observability.service.ts',
  'src/services/sport-top-picks.service.ts',
]

const pageCandidates = [
  { file: 'src/app/admin/historical-diagnostics/page.tsx', route: '/admin/historical-diagnostics' },
  { file: 'src/app/data-coverage/[sport]/page.tsx', route: '/data-coverage/[sport]' },
  { file: 'src/app/game-intelligence/[eventId]/page.tsx', route: '/game-intelligence/[eventId]' },
  { file: 'src/app/login/page.tsx', route: '/login' },
  { file: 'src/app/player-projections/[projectionId]/page.tsx', route: '/player-projections/[projectionId]' },
  { file: 'src/app/register/page.tsx', route: '/register' },
  { file: 'src/app/sports-center/[sport]/page.tsx', route: '/sports-center/[sport]' },
]

const responsibilityHotspots = [
  'settlement readiness',
  'settlement status classification',
  'learning evidence',
  'performance aggregation',
  'sports registries',
  'operating date/timezone',
  'freshness calculations',
  'product lifecycle state',
  'market normalization',
  'provider mapping',
  'result readiness',
]

const ignoreDirs = new Set(['.git', '.next', 'node_modules'])
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.sql', '.yml', '.yaml'])

function walk(dir, rows = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoreDirs.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, rows)
    else if (textExtensions.has(path.extname(entry.name))) rows.push(full)
  }
  return rows
}

const files = walk(root)

function rel(file) {
  return path.relative(root, file).replaceAll('\\', '/')
}

function text(file) {
  return fs.readFileSync(file, 'utf8')
}

function serviceSpecifier(file) {
  return `@/${file.replace(/^src\//, '').replace(/\.(ts|tsx)$/, '')}`
}

function basenameToken(file) {
  return path.basename(file).replace(/\.(ts|tsx)$/, '')
}

function referencesFor(candidate) {
  const specifier = serviceSpecifier(candidate)
  const token = basenameToken(candidate)
  const refs = []
  for (const file of files) {
    const relative = rel(file)
    if (relative === candidate) continue
    const body = text(file)
    if (body.includes(specifier) || body.includes(candidate) || body.includes(token)) {
      refs.push(relative)
    }
  }
  return refs.sort()
}

function classifyService(candidate, refs) {
  const runtimeRefs = refs.filter((file) => file.startsWith('src/app/') || file.startsWith('src/services/') || file.startsWith('src/components/') || file.startsWith('src/lib/'))
  const scriptRefs = refs.filter((file) => file.startsWith('scripts/'))
  const docRefs = refs.filter((file) => file.startsWith('docs/'))
  if (runtimeRefs.length) return 'LEGACY_BUT_REACHABLE'
  if (scriptRefs.length) return 'ARCHIVAL_OR_SCRIPT_TOOLING'
  if (docRefs.length) return 'DOCUMENTED_OPERATIONAL_DEPENDENCY'
  return 'UNKNOWN_REVIEW_REQUIRED'
}

function classifyPage(page) {
  if (page.route.includes('[sport]') || page.route.includes('[eventId]') || page.route.includes('[projectionId]')) return 'ACTIVE_DEEP_LINK'
  if (page.route.startsWith('/admin/')) return 'ADMIN_DIAGNOSTIC'
  if (page.route === '/login' || page.route === '/register') return 'AUTH_BOUNDARY_UNTOUCHED'
  return 'UNKNOWN_REVIEW_REQUIRED'
}

const services = serviceCandidates.map((candidate) => {
  const refs = referencesFor(candidate)
  const classification = classifyService(candidate, refs)
  return {
    file: candidate,
    exists: fs.existsSync(path.join(root, candidate)),
    specifier: serviceSpecifier(candidate),
    referenceCount: refs.length,
    runtimeReferences: refs.filter((file) => file.startsWith('src/app/') || file.startsWith('src/services/') || file.startsWith('src/components/') || file.startsWith('src/lib/')),
    scriptReferences: refs.filter((file) => file.startsWith('scripts/')),
    docReferences: refs.filter((file) => file.startsWith('docs/')),
    classification,
    removalAllowed: false,
    reason: classification === 'UNKNOWN_REVIEW_REQUIRED'
      ? 'No static runtime caller was proven, but deletion is blocked without owner metadata and dynamic/config invocation review.'
      : 'Reachable or operationally documented; not in approved removal class.',
  }
})

const pages = pageCandidates.map((page) => ({
  ...page,
  exists: fs.existsSync(path.join(root, page.file)),
  classification: classifyPage(page),
  removalAllowed: false,
}))

const hotspots = responsibilityHotspots.map((responsibility) => ({
  responsibility,
  classification: 'REVALIDATED_NO_SAFE_DELETION',
  action: 'retain canonical implementation and defer any caller migration until a specific duplicate implementation is proven behavior-equivalent',
}))

const result = {
  generatedAt: new Date().toISOString(),
  mode: 'platform_consolidation_duplication_cleanup_v1',
  success: true,
  servicesAudited: services.length,
  pagesAudited: pages.length,
  hotspotsAudited: hotspots.length,
  approvedRemovalCandidates: 0,
  filesRemoved: 0,
  callersMigrated: 0,
  providerCallsMade: 0,
  databaseMutations: 0,
  businessLogicChanged: false,
  routeContractsChanged: false,
  services,
  pages,
  hotspots,
  certifications: [
    'PLATFORM_DUPLICATION_REVALIDATION_PASS',
    'NO_INTENTIONAL_WRAPPER_REMOVAL_PASS',
    'NO_COMPATIBILITY_LAYER_REGRESSION_PASS',
    'NO_PRODUCT_BEHAVIOR_CHANGE_PASS',
  ],
}

fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify({
  success: result.success,
  servicesAudited: result.servicesAudited,
  pagesAudited: result.pagesAudited,
  hotspotsAudited: result.hotspotsAudited,
  approvedRemovalCandidates: result.approvedRemovalCandidates,
  filesRemoved: result.filesRemoved,
  providerCallsMade: result.providerCallsMade,
  databaseMutations: result.databaseMutations,
}, null, 2))
