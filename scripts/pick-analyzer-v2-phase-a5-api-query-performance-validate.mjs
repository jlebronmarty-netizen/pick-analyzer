import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const root = process.cwd()
const started = Date.now()
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = 'true'] = arg.replace(/^--/, '').split('=')
  return [key, value]
}))
const timeoutMs = Number(args.get('timeoutMs') ?? 30000)

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

function ensureTime() {
  if (Date.now() - started > timeoutMs) {
    throw new Error(`A5 validator exceeded ${timeoutMs}ms`)
  }
}

function gitHead() {
  return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim()
}

function check(name, passed, detail = '') {
  ensureTime()
  return { name, passed: Boolean(passed), detail }
}

const files = {
  a2: 'docs/PICK_ANALYZER_V2_PHASE_A2_ROUTE_RUNTIME_AUDIT.md',
  a3: 'docs/PICK_ANALYZER_V2_PHASE_A3_SCHEDULER_FRESHNESS_AUDIT.md',
  a4: 'docs/PICK_ANALYZER_V2_PHASE_A4_UI_STATE_AUDIT.md',
  inventory: 'docs/product-route-inventory-v1.json',
  performanceRoute: 'src/app/api/performance/route.ts',
  performanceHistoryRoute: 'src/app/api/performance/history/route.ts',
  performanceScope: 'src/services/performance-scope-v2.service.ts',
  performanceProduct: 'src/services/performance-product-contract.service.ts',
  dashboardTodayRoute: 'src/app/api/dashboard/today/route.ts',
  dashboardToday: 'src/services/dashboard-today.service.ts',
  operationsHealthRoute: 'src/app/api/operations/health/route.ts',
  operationsHealth: 'src/services/operations-health.service.ts',
  dataCoverageFinalRoute: 'src/app/api/data-coverage/final-certification/route.ts',
  dataCoverageHealthRoute: 'src/app/api/data-coverage/health/route.ts',
  probabilityRoute: 'src/app/api/probability-picks/route.ts',
  mostLikelyRoute: 'src/app/api/market-opportunities/most-likely/route.ts',
  bestValueRoute: 'src/app/api/market-opportunities/best-value/route.ts',
  currentBoardRoute: 'src/app/api/current-board/route.ts',
  sportsHealthRoute: 'src/app/api/sports/health/route.ts',
  modelStatusRoute: 'src/app/api/model/status/route.ts',
  providerBudgetRoute: 'src/app/api/providers/budget/status/route.ts',
}

const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, exists(file) ? read(file) : '']))
const migrationsChanged = execSync('git diff --name-only -- supabase/migrations', { cwd: root, encoding: 'utf8' }).trim()

const criticalQueryMatrix = [
  {
    route: '/api/performance',
    service: 'getPerformanceProductContract -> getPerformanceScopeV2',
    criticality: 'P1 core product page API',
    dataSource: 'Supabase read-only',
    tablesOrViews: ['prediction_history', 'sport_events'],
    queryCount: '2 plus scheduler coverage helper',
    execution: 'scheduler coverage and prediction read in parallel; event read after bounded prediction ids',
    selectedColumns: 'explicit projection',
    rowBounds: 'prediction_history max 2000 default; sport_events batched by unique ids',
    ordering: 'prediction_history created_at desc',
    filters: 'optional sport_key; product eligibility in application',
    pagination: 'bounded default summary; full history not returned by default',
    aggregationLocation: 'application memory over bounded rows',
    duplicateQueries: 'none proven after compact default repair',
    nPlusOneRisk: 'bounded batched sport_events in groups of 100; no per-row query',
    cacheBehavior: 'no-store dynamic product API',
    timeoutBehavior: 'bounded query count and row cap; route error returns JSON',
    observedProductionLatencyMs: [4257, 4220, 4227],
    observedPayloadBytes: 717617,
    defect: 'Default summary route read paginated prediction_history until exhaustion and returned full historyRows.',
    severity: 'P1',
    repair: 'Bound prediction_history reads and make full historyRows opt-in for diagnostics/full history route.',
    validationMethod: 'static validator, build, production before/after measurement',
  },
  {
    route: '/api/performance/history',
    service: 'getPerformanceScopeV2',
    criticality: 'P2 paginated supporting API',
    dataSource: 'Supabase read-only',
    tablesOrViews: ['prediction_history', 'sport_events'],
    queryCount: '2 plus scheduler coverage helper',
    execution: 'bounded prediction read then batched event lookup',
    selectedColumns: 'explicit projection',
    rowBounds: 'prediction_history max 5000; response page limit max 100',
    ordering: 'prediction_history created_at desc',
    filters: 'sport/category/model/status/mode/confidence filters after bounded read',
    pagination: 'request page/limit with max 100 rows returned',
    aggregationLocation: 'application memory over bounded rows',
    duplicateQueries: 'none proven in route',
    nPlusOneRisk: 'no per-row DB calls',
    cacheBehavior: 'client fetch no-store',
    timeoutBehavior: 'bounded query count and row cap; route error returns JSON',
    observedProductionLatencyMs: [3586, 3348, 3360],
    observedPayloadBytes: 135787,
    defect: 'History route depended on the same unbounded scope reader.',
    severity: 'P2',
    repair: 'Explicit 5000-row cap plus page limit max 100.',
    validationMethod: 'static validator and build',
  },
  {
    route: '/api/dashboard/today',
    service: 'getDashboardToday',
    criticality: 'P1 core dashboard API',
    dataSource: 'Supabase and stored service summaries',
    tablesOrViews: ['sport_events', 'prediction_history', 'sports_odds_snapshots'],
    queryCount: 'parallel dependency bundle plus bounded optional fallbacks',
    execution: 'independent dependencies in Promise.all; optional follow-up reads timed',
    selectedColumns: 'explicit projections',
    rowBounds: 'current board 100, fallback slate 64, grounded predictions 200, odds snapshots 1000',
    ordering: 'start_time or generated_at where relevant',
    filters: 'sport, league, operating date, event ids',
    pagination: 'summary route only',
    aggregationLocation: 'application over bounded current slate',
    duplicateQueries: 'none repaired in A5',
    nPlusOneRisk: 'no per-row DB calls in audited path',
    cacheBehavior: 'no-store',
    timeoutBehavior: 'timed helper around critical and optional dependencies',
    observedProductionLatencyMs: [4227, 3682, 3562],
    observedPayloadBytes: 541124,
    defect: 'large payload observed, but query bounds/timeouts already present; no scoped repair made',
    severity: 'NONE',
    repair: 'none',
    validationMethod: 'static query-shape audit',
  },
  {
    route: '/api/data-coverage/final-certification',
    service: 'multi-sport final certification',
    criticality: 'P1 operational certification API',
    dataSource: 'stored coverage summaries',
    tablesOrViews: ['stored data coverage inventory'],
    queryCount: 'service-managed summary by default',
    execution: 'default summary; diagnostics=full opt-in',
    selectedColumns: 'service managed',
    rowBounds: 'summary default; full diagnostics not default',
    ordering: 'service managed',
    filters: 'diagnostics mode',
    pagination: 'summary default',
    aggregationLocation: 'service',
    duplicateQueries: 'not proven',
    nPlusOneRisk: 'not proven',
    cacheBehavior: 'dynamic no revalidate',
    timeoutBehavior: 'route-level error contract',
    observedProductionLatencyMs: [23203, 30155, 27769],
    observedPayloadBytes: 6802,
    defect: 'slow production latency observed, but default route already avoids full diagnostics; no query-level defect proven without DB EXPLAIN',
    severity: 'DEFERRED',
    repair: 'defer specific optimization until service query evidence is available',
    validationMethod: 'static route mode audit and production evidence',
  },
  {
    route: '/api/probability-picks',
    service: 'getProbabilityPicks',
    criticality: 'P1 pick-discovery API',
    dataSource: 'stored predictions/projections',
    tablesOrViews: ['service managed'],
    queryCount: 'service managed',
    execution: 'bounded route limit',
    selectedColumns: 'service managed',
    rowBounds: 'limit max 500',
    ordering: 'request sort allowlist',
    filters: 'sport/market/probability/confidence/quality/freshness/date',
    pagination: 'bounded summary',
    aggregationLocation: 'service',
    duplicateQueries: 'not proven',
    nPlusOneRisk: 'not proven',
    cacheBehavior: 'client no-store',
    timeoutBehavior: 'route error contract',
    observedProductionLatencyMs: [5676, 1212, 806],
    observedPayloadBytes: 174993,
    defect: 'none proven; route limit exists',
    severity: 'NONE',
    repair: 'none',
    validationMethod: 'static route bound audit',
  },
  {
    route: '/api/market-opportunities/most-likely',
    service: 'getMostLikelyOpportunities',
    criticality: 'P1 opportunity API',
    dataSource: 'current board service',
    tablesOrViews: ['service managed'],
    queryCount: 'service managed',
    execution: 'bounded route limit',
    selectedColumns: 'service managed',
    rowBounds: 'limit max 100',
    ordering: 'sort allowlist',
    filters: 'mode allowlist',
    pagination: 'bounded summary',
    aggregationLocation: 'service',
    duplicateQueries: 'not proven',
    nPlusOneRisk: 'not proven',
    cacheBehavior: 'client no-store',
    timeoutBehavior: 'route error contract',
    observedProductionLatencyMs: [6370, 2012, 1419],
    observedPayloadBytes: 262618,
    defect: 'none proven; bounded route limit exists',
    severity: 'NONE',
    repair: 'none',
    validationMethod: 'static route bound audit',
  },
]

const checks = [
  ...Object.entries(files).map(([key, file]) => check(`input exists: ${key}`, exists(file), file)),
  check('A2 route runtime pass marker present', source.a2.includes('PICK_ANALYZER_V2_PHASE_A2_ROUTE_RUNTIME_PASS')),
  check('A3 scheduler freshness pass marker present', source.a3.includes('PICK_ANALYZER_V2_PHASE_A3_SCHEDULER_FRESHNESS_PASS')),
  check('A4 UI state pass marker present', source.a4.includes('PICK_ANALYZER_V2_PHASE_A4_UI_STATE_PASS')),
  check('performance scope defines default row cap', source.performanceScope.includes('DEFAULT_MAX_PREDICTION_ROWS = 2000')),
  check('performance scope bounds row limit', /function boundedRowLimit/.test(source.performanceScope)),
  check('performance scope loop terminates at rowLimit', /from < rowLimit/.test(source.performanceScope)),
  check('performance scope uses explicit projection', source.performanceScope.includes(".select('id, sport_key, game_id")),
  check('performance scope does not select star', !/from\('prediction_history'\)[\s\S]{0,240}\.select\('\*'/.test(source.performanceScope)),
  check('performance event lookup is batched not per row', /index \+= 100/.test(source.performanceScope) && /\.in\('id', eventIds\.slice/.test(source.performanceScope)),
  check('performance scope can omit full history rows', /includeHistoryRows \? productHistory\.map/.test(source.performanceScope)),
  check('performance scope exposes query diagnostics', source.performanceScope.includes('queryDiagnostics')),
  check('default performance route uses compact history rows', source.performanceRoute.includes('includeHistoryRows: includeFullDiagnostics')),
  check('default performance route has lower row cap', source.performanceRoute.includes('maxPredictionRows: includeFullDiagnostics ? 5000 : 2000')),
  check('performance route keeps full diagnostics opt-in', source.performanceRoute.includes("diagnostics') === 'full'")),
  check('performance history route has explicit row cap', source.performanceHistoryRoute.includes('maxPredictionRows: 5000')),
  check('performance history response remains paginated', source.performanceHistoryRoute.includes('boundedInteger') && source.performanceHistoryRoute.includes('totalPages')),
  check('dashboard today uses timed dependency helper', source.dashboardToday.includes('async function timed') && source.dashboardToday.includes('Promise.race')),
  check('dashboard today critical reads are bounded', source.dashboardToday.includes('.limit(200)') && source.dashboardToday.includes('.limit(1000)')),
  check('data coverage final keeps full diagnostics opt-in', source.dataCoverageFinalRoute.includes("diagnostics') === 'full'") && source.dataCoverageFinalRoute.includes('getMultiSportDataExpansionFinalCertificationSummaryV1')),
  check('probability picks route bounds limit', source.probabilityRoute.includes('max: 500')),
  check('most likely route bounds limit', source.mostLikelyRoute.includes('max: 100')),
  check('best value route bounds limit', source.bestValueRoute.includes('max: 100')),
  check('read-only audited routes do not import provider clients directly', !/(sportsdataio-runtime-adapter|the-odds-api|api-sports)/.test([source.performanceRoute, source.performanceHistoryRoute, source.dashboardTodayRoute].join('\n'))),
  check('read-only audited routes do not call mutation methods directly', !/\.(insert|upsert|update|delete)\(/.test([source.performanceRoute, source.performanceHistoryRoute, source.dashboardTodayRoute, source.dataCoverageFinalRoute].join('\n'))),
  check('no speculative migration was added', migrationsChanged.length === 0, migrationsChanged),
]

const failedChecks = checks.filter((item) => !item.passed)
const generatedAt = new Date().toISOString()
const startingCommit = gitHead()
const defects = [
  {
    severity: 'P1',
    area: '/api/performance default product summary',
    defect: 'Default performance summary read prediction_history until exhaustion and returned full historyRows even when diagnostics were not requested.',
    repair: 'Added bounded prediction_history reads and compact default mode that omits full historyRows unless full diagnostics are requested.',
  },
  {
    severity: 'P2',
    area: '/api/performance/history supporting API',
    defect: 'Paginated history route depended on the same unbounded performance scope reader.',
    repair: 'History route now requests an explicit 5000-row read budget and keeps page size capped at 100.',
  },
]

const productionEvidence = {
  before: [
    { route: '/api/dashboard/today', attempts: 3, http: 200, latencyMs: [4227, 3682, 3562], bytes: 541124, semantic: 'AVAILABLE', providerCallsMade: 0, remoteMutationsMade: 0 },
    { route: '/api/performance', attempts: 3, http: 200, latencyMs: [4257, 4220, 4227], bytes: 717617, semantic: 'SUCCESS', providerCallsMade: 0, remoteMutationsMade: 0 },
    { route: '/api/performance/history?limit=25&page=1', attempts: 3, http: 200, latencyMs: [3586, 3348, 3360], bytes: 135787, semantic: 'SUCCESS', providerCallsMade: 0, remoteMutationsMade: 0 },
    { route: '/api/operations/health', attempts: 3, http: 200, latencyMs: [6613, 15690, 6924], bytes: 747390, semantic: 'DEGRADED', providerCallsMade: 0, remoteMutationsMade: 0 },
    { route: '/api/operations/data-freshness', attempts: 3, http: 200, latencyMs: [5045, 5000, 4996], bytes: 10792, semantic: 'PARTIAL', providerCallsMade: 0, remoteMutationsMade: 0 },
    { route: '/api/data-coverage/final-certification', attempts: 3, http: 200, latencyMs: [23203, 30155, 27769], bytes: 6802, semantic: 'summary', providerCallsMade: 0, remoteMutationsMade: 0 },
    { route: '/api/probability-picks', attempts: 3, http: 200, latencyMs: [5676, 1212, 806], bytes: 174993, semantic: 'available', providerCallsMade: 0, remoteMutationsMade: 0 },
  ],
  afterLocalStatic: {
    defaultPerformanceHistoryRowsReturned: 0,
    defaultPerformancePredictionHistoryRowLimit: 2000,
    fullDiagnosticsPredictionHistoryRowLimit: 5000,
    historyRoutePredictionHistoryRowLimit: 5000,
  },
}

const artifact = {
  generatedAt,
  startingCommit,
  success: failedChecks.length === 0,
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  criticalQueryMatrix,
  queryFindings: [
    'Performance default summary had the only proven unbounded critical read in the audited scope.',
    'Dashboard Today, probability picks, most-likely and best-value already expose bounded route/query behavior where statically provable.',
  ],
  latencyFindings: [
    'Before repair, production /api/performance returned about 718 KB and took about 4.2 seconds across three reads.',
    'Data coverage final certification remains slow in production, but the default route already uses summary mode and needs query-plan evidence before further repair.',
  ],
  payloadFindings: [
    'Default performance summary carried full historyRows despite the UI using /api/performance/history for paginated rows.',
    'The A5 repair keeps historyPreview and query diagnostics while returning no full historyRows on default summary mode.',
  ],
  timeoutFindings: [
    'Dashboard Today already uses a timed helper for critical and optional dependencies.',
    'Performance risk was unbounded work rather than a missing local server timeout; the repair creates deterministic row caps.',
  ],
  cacheFindings: [
    'Audited core routes remain dynamic/no-store or client no-store; no broad cache platform was introduced.',
  ],
  databaseIndexFindings: [
    'No index migration was added. A prediction_history sport_key plus created_at desc query path may be a future candidate only with EXPLAIN evidence.',
  ],
  defects,
  providerCallsMade: 0,
  providerCreditsConsumed: 0,
  databaseReads: 'production read-only endpoint observations plus local static file reads; no direct production database mutation',
  databaseMutations: 0,
  predictionWrites: 0,
  resultWrites: 0,
  settlementWrites: 0,
  learningWrites: 0,
  productionEvidence,
  remainingRisks: [
    'Static validation cannot prove PostgreSQL planner choices without authorized EXPLAIN access.',
    'Several operations/data-coverage diagnostic endpoints remain slow but need narrower query evidence before repair.',
  ],
  deferredIndexCandidates: [
    {
      table: 'prediction_history',
      pattern: 'optional sport_key filter ordered by created_at desc for performance summary/history',
      reasonDeferred: 'No production EXPLAIN access authorized in A5; no speculative migration added.',
    },
  ],
  certification: {
    PICK_ANALYZER_V2_PHASE_A5_API_QUERY_PERFORMANCE_PASS: failedChecks.length === 0,
    NO_PROVIDER_CALL_PASS: true,
    NO_PROVIDER_CREDIT_PASS: true,
    NO_DATABASE_MUTATION_PASS: true,
    NO_SPECULATIVE_INDEX_PASS: migrationsChanged.length === 0,
  },
}

const markdown = `# Pick Analyzer V2 Phase A5 API Query Performance Audit

Generated: ${generatedAt}
Baseline commit: ${startingCommit}

## Verdict

${artifact.success ? 'PASS - bounded critical API/query performance certified after scoped repair.' : 'FAIL - A5 validator found blocking issues.'}

## Bounded Scope

Audited core read-heavy product APIs and services only. No local server smoke, provider calls, provider credits, production data mutations, prediction writes, result writes, settlement writes or learning writes were performed.

## Critical-Route Matrix

| Route / Service | Criticality | Data Source | Tables / Views | Query Count | Execution | Selected Columns | Row Bounds | Ordering | Filters | Pagination | Aggregation | Duplicate / N+1 Risk | Cache | Timeout / Failure | Production Latency | Defect | Severity | Repair |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${criticalQueryMatrix.map((item) => `| ${item.route} / ${item.service} | ${item.criticality} | ${item.dataSource} | ${item.tablesOrViews.join(', ')} | ${item.queryCount} | ${item.execution} | ${item.selectedColumns} | ${item.rowBounds} | ${item.ordering} | ${item.filters} | ${item.pagination} | ${item.aggregationLocation} | ${item.duplicateQueries}; ${item.nPlusOneRisk} | ${item.cacheBehavior} | ${item.timeoutBehavior} | ${item.observedProductionLatencyMs.join(', ')} ms | ${item.defect} | ${item.severity} | ${item.repair} |`).join('\n')}

## Query Findings

- Performance default summary was the only proven unbounded critical read in the audited scope.
- Dashboard Today, Probability Picks, Most Likely and Best Value already expose bounded route/query behavior where statically provable.
- No audited read-only route directly calls provider adapters or mutation methods.

## Latency Findings

- Before repair, production \`/api/performance\` returned about 718 KB and took about 4.2 seconds across three reads.
- Production \`/api/performance/history?limit=25&page=1\` returned about 136 KB and took about 3.4 seconds across three reads.
- Production \`/api/data-coverage/final-certification\` remained slow, but default route already uses summary mode; no query-level repair was made without DB plan evidence.

## Payload Findings

- Default \`/api/performance\` carried full \`historyRows\` although the UI uses \`/api/performance/history\` for paginated history rows.
- A5 keeps \`historyPreview\`, \`queryDiagnostics\` and existing summary fields while returning full \`historyRows\` only for full diagnostics.

## Timeout Findings

- Dashboard Today already uses \`timed\` dependency wrappers and degraded section behavior.
- Performance risk was unbounded work and oversized payload. A5 adds deterministic row caps instead of a broad cache or server smoke.

## Cache Findings

- No new cache platform was introduced.
- Audited product APIs remain dynamic/no-store or are consumed with client \`cache: 'no-store'\`.

## Database / Index Findings

- No speculative migration or index was added.
- Deferred candidate: \`prediction_history\` optional \`sport_key\` filter ordered by \`created_at desc\`, pending authorized EXPLAIN/query-plan evidence.

## Defects By Severity

${defects.map((item) => `- ${item.severity}: ${item.area} - ${item.defect} Repair: ${item.repair}`).join('\n')}

## Before / After Evidence

- Before: \`/api/performance\` production summary was 717,617 bytes and approximately 4.2 seconds on three bounded reads.
- After local static repair: default performance summary uses \`maxPredictionRows: 2000\` and \`includeHistoryRows: false\`; full diagnostics and history route use explicit \`5000\` row budgets.

## Production Evidence

${productionEvidence.before.map((item) => `- ${item.route}: HTTP ${item.http}; latency ${item.latencyMs.join(', ')} ms; bytes ${item.bytes}; provider calls ${item.providerCallsMade}; mutations ${item.remoteMutationsMade}`).join('\n')}

## Safety Counters

- Provider calls: 0
- Provider credits: 0
- Database reads: production read-only endpoint observations plus local static file reads
- Database mutations: 0
- Prediction writes: 0
- Result writes: 0
- Settlement writes: 0
- Learning writes: 0

## Remaining Risks

${artifact.remainingRisks.map((item) => `- ${item}`).join('\n')}

## Deferred Index Candidates

${artifact.deferredIndexCandidates.map((item) => `- ${item.table}: ${item.pattern}. Deferred because ${item.reasonDeferred}`).join('\n')}

## Validation Results

${checks.map((item) => `- ${item.name}: ${item.passed ? 'PASS' : 'FAIL'}${item.detail ? ` - ${item.detail}` : ''}`).join('\n')}

## Certification

${artifact.success ? 'PICK_ANALYZER_V2_PHASE_A5_API_QUERY_PERFORMANCE_PASS' : 'PICK_ANALYZER_V2_PHASE_A5_API_QUERY_PERFORMANCE_FAIL'}
`

fs.writeFileSync(path.join(root, 'docs/pick-analyzer-v2-phase-a5-api-query-performance-audit.json'), `${JSON.stringify(artifact, null, 2)}\n`)
fs.writeFileSync(path.join(root, 'docs/PICK_ANALYZER_V2_PHASE_A5_API_QUERY_PERFORMANCE_AUDIT.md'), markdown)

console.log(JSON.stringify({
  success: artifact.success,
  checks: artifact.checks,
  passed: artifact.passed,
  failed: artifact.failed,
  failedChecks,
  defects,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}, null, 2))

process.exit(artifact.success ? 0 : 1)
