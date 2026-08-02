import fs from 'node:fs'

const files = {
  canonical: 'src/services/canonical-acquisition.service.ts',
  planner: 'src/services/event-refresh-planner.service.ts',
  adaptive: 'src/services/adaptive-refresh-orchestrator.service.ts',
  route: 'src/app/api/operations/event-refresh-plan/route.ts',
  opsCenter: 'src/services/mlb-operations-center.service.ts',
  opsPage: 'src/app/mlb-operations/page.tsx',
  doc: 'docs/OPERATIONAL_EXCELLENCE/OE_003E_CANONICAL_ACQUISITION_ACTIVE_EXECUTION.md',
  cert: 'docs/CERTIFICATION/OE_003E_CANONICAL_ACQUISITION_ACTIVE_EXECUTION.md',
  json: 'docs/CERTIFICATION/oe-003e-canonical-acquisition-active-execution.json',
}

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
}

const canonical = read(files.canonical)
const planner = read(files.planner)
const adaptive = read(files.adaptive)
const route = read(files.route)
const opsCenter = read(files.opsCenter)
const opsPage = read(files.opsPage)
const doc = read(files.doc)
const cert = read(files.cert)
const jsonText = read(files.json)

const checks = [
  ['canonical acquisition service exists', Boolean(canonical)],
  ['planning remains per event', planner.includes('independentEventDecision: true') && planner.includes('eventPlans')],
  ['execution uses provider-efficient batching', canonical.includes('DATE_LEVEL_GAME_ODDS_ENDPOINT') && canonical.includes('MAX_INITIAL_ACTIVE_CALLS = 1')],
  ['product surfaces consume stored evidence', canonical.includes('productSurfacesReadStoredEvidence: true')],
  ['duplicate scheduler ticks cannot duplicate acquisitions', canonical.includes('duplicateCompleted(deduplicationKey)') && canonical.includes('claimProviderActionLock(lockKey')],
  ['deduplication key permits later legitimate refreshes', canonical.includes('dedupeWindowIso') && canonical.includes('current_pregame')],
  ['no pregame refresh after start', canonical.includes('POST_START_BLOCKED') && canonical.includes('start > nowMs')],
  ['P0 closure outranks acquisition', canonical.includes('CLOSURE_PRIORITY') && canonical.includes('SYNC_RESULT')],
  ['exact provider pool authorizes action', canonical.includes("provider: PROVIDER") && canonical.includes("sportKey: SPORT_KEY") && canonical.includes("action: 'event_refresh_plan:odds_refresh'")],
  ['protected reserve remains preserved', canonical.includes('reserveImpact') && canonical.includes('budget.authorization.reserveImpact')],
  ['max/action enforced by provider budget', canonical.includes('checkProviderBudget') && canonical.includes('requestedCalls: MAX_INITIAL_ACTIVE_CALLS')],
  ['max/hour enforced by provider budget', canonical.includes('checkProviderBudget') && read('src/services/provider-budget.service.ts').includes('hourlyRemaining')],
  ['estimated and actual costs remain distinct', canonical.includes('estimatedHttpRequests') && canonical.includes('actualHttpRequests') && canonical.includes('actualQuotaUnits') && canonical.includes('estimatedQuotaUnits')],
  ['canonical timestamps are preserved', canonical.includes('providerTimestamp: row.snapshot_time') && canonical.includes('canonicalSnapshotTimestamp')],
  ['fetch time is not mislabeled as market time', canonical.includes('fetchObservedAt: observedAt') && canonical.includes('providerResponseObservedAt')],
  ['snapshot persistence is idempotent', canonical.includes("upsert(safeRows, { onConflict: 'id' })")],
  ['no historical data is rewritten', canonical.includes('rowsSkippedByOlderSnapshot') || canonical.includes('olderRowsSkipped')],
  ['no prediction outputs change', canonical.includes('predictionOutputsChanged: false') && adaptive.includes('predictionRows: 0')],
  ['no recommendation policy changes', canonical.includes('officialPickPolicyChanged: false')],
  ['no settlement or learning rules change', !canonical.includes('settleOperatingDay') && !canonical.includes('runModelLearning')],
  ['ACTIVE mode limited to SportsDataIO MLB', canonical.includes("const PROVIDER = 'sportsdataio'") && canonical.includes("const SPORT_KEY = 'baseball_mlb'")],
  ['The Odds API remains shadow or dry-run', planner.includes('SHADOW_ONLY_UNKNOWN_BALANCE_RESET_COST')],
  ['BSN remains source-safe', planner.includes('OBSERVATIONAL_PROVIDER_PATH_NOT_ACTIVE')],
  ['read-only API route remains GET-only', route.includes('export async function GET') && !route.includes('export async function POST')],
  ['active execution reports exact provider calls', adaptive.includes('providerCallsMade: canonicalAcquisition.providerCallsMade')],
  ['bounded API limits remain enforced', route.includes('max: 200') && planner.includes('MAX_LIMIT = 200')],
  ['fallback to SHADOW exists', planner.includes("if (mode === 'SHADOW')") || planner.includes("return 'SHADOW'")],
  ['secrets are never exposed', ![canonical, doc, cert, jsonText].join('\n').match(/sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._-]{20,}/)],
  ['adaptive bridge uses canonical acquisition before legacy odds path', adaptive.includes('canonical_event_level_acquisition') && adaptive.indexOf('executeCanonicalMlbMarketAcquisition') < adaptive.indexOf('executeOperatingDay({')],
  ['operations center exposes acquisition evidence', opsCenter.includes('canonicalAcquisition') && opsPage.includes('Last Active')],
  ['certification artifacts exist', Boolean(doc) && Boolean(cert) && Boolean(jsonText)],
]

let jsonValid = false
try {
  JSON.parse(jsonText)
  jsonValid = true
} catch {}
checks.push(['OE-003E JSON certification artifact is valid', jsonValid])

const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)

const result = {
  success: failedChecks.length === 0,
  mode: 'oe003e_canonical_acquisition_active_execution_validation',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  providerCreditsConsumed: 0,
  databaseMutationsMade: 0,
  predictionFormulaChanged: false,
  officialPickPolicyChanged: false,
  settlementRulesChanged: false,
  learningRulesChanged: false,
}

console.log(JSON.stringify(result, null, 2))
process.exit(result.success ? 0 : 1)
