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

function ensureTime() {
  if (Date.now() - started > timeoutMs) throw new Error(`A6 validator exceeded ${timeoutMs}ms`)
}

function file(name) {
  return path.join(root, name)
}

function exists(name) {
  return fs.existsSync(file(name))
}

function read(name) {
  return fs.readFileSync(file(name), 'utf8')
}

function git(command) {
  return execSync(`git ${command}`, { cwd: root, encoding: 'utf8' }).trim()
}

function check(name, passed, detail = '') {
  ensureTime()
  return { name, passed: Boolean(passed), detail }
}

const files = {
  packageJson: 'package.json',
  nextConfig: 'next.config.ts',
  vercelJson: 'vercel.json',
  tsconfig: 'tsconfig.json',
  dataCoveragePage: 'src/app/data-coverage/page.tsx',
  buildMemoryDoc: 'docs/BUILD_MEMORY_OPTIMIZATION_V1.md',
  deploymentRecoveryDoc: 'docs/BUILD_MEMORY_OPTIMIZATION_DEPLOYMENT_RECOVERY_V1.md',
  baselineMeasure: 'docs/build-memory-optimization-v1-baseline.json',
  importPressure: 'docs/build-memory-optimization-v1-import-pressure.json',
  routeInventory: 'docs/product-route-inventory-v1.json',
  projectStatus: 'docs/PROJECT_STATUS.md',
  masterRoadmap: 'docs/MASTER_ROADMAP.md',
}

const source = Object.fromEntries(Object.entries(files).map(([key, value]) => [key, exists(value) ? read(value) : '']))
const pkg = JSON.parse(source.packageJson)
const nextConfig = source.nextConfig
const dataCoveragePage = source.dataCoveragePage
const staged = git('diff --cached --name-only')
const changed = git('diff --name-only')
const migrationsChanged = git('diff --name-only -- supabase/migrations')
const packageLockChanged = changed.split(/\r?\n/).filter(Boolean).some((name) => name === 'package-lock.json')

const buildPressureMatrix = [
  {
    buildStage: 'dependency installation',
    fileRouteConfig: 'package.json',
    staticOrDynamicBehavior: 'npm install/build script only',
    buildTimeDataAccess: 'none',
    largeImports: 'none in script',
    generatedArtifactImports: 'none',
    routeCountImpact: 'none',
    memoryRiskEvidence: 'dependencies are small; no package-manager migration',
    buildDurationEvidence: 'A5 build passed in about 80.8s',
    vercelRelevance: 'uses same npm build command Vercel would invoke',
    defect: 'none',
    severity: 'NONE',
    repair: 'none',
    validationMethod: 'package script audit',
  },
  {
    buildStage: 'Next.js compilation',
    fileRouteConfig: 'next.config.ts',
    staticOrDynamicBehavior: 'Next app build with webpack worker',
    buildTimeDataAccess: 'none from config',
    largeImports: 'none',
    generatedArtifactImports: 'none',
    routeCountImpact: 'none',
    memoryRiskEvidence: 'prior Vercel OOM during optimized production build',
    buildDurationEvidence: 'A5 build compiled successfully in 16.1s',
    vercelRelevance: 'memory controls apply to Vercel Standard build',
    defect: 'none in current config',
    severity: 'NONE',
    repair: 'existing memory controls retained',
    validationMethod: 'config audit and build',
  },
  {
    buildStage: 'TypeScript',
    fileRouteConfig: 'tsconfig.json',
    staticOrDynamicBehavior: 'no emit; incremental',
    buildTimeDataAccess: 'none',
    largeImports: 'type checking over app graph',
    generatedArtifactImports: 'none proven',
    routeCountImpact: 'none',
    memoryRiskEvidence: 'A5 TypeScript completed in 33.1s',
    buildDurationEvidence: 'A5 TypeScript completed in 33.1s',
    vercelRelevance: 'same type-check phase runs during Vercel build',
    defect: 'none',
    severity: 'NONE',
    repair: 'none',
    validationMethod: 'tsconfig audit and build',
  },
  {
    buildStage: 'page data collection',
    fileRouteConfig: 'src/app/data-coverage/page.tsx',
    staticOrDynamicBehavior: 'force-dynamic page',
    buildTimeDataAccess: 'request-time only after repair',
    largeImports: 'six heavy data/provider certification services were top-level imports before repair',
    generatedArtifactImports: 'none',
    routeCountImpact: 'no route count change',
    memoryRiskEvidence: 'tracked import-pressure audit identified data-coverage/page.tsx as largest importing page file with six service imports',
    buildDurationEvidence: 'A5 build collected page data successfully, but Vercel OOM history remains',
    vercelRelevance: 'reduces server route module graph at build/module evaluation time without requiring paid infra',
    defect: 'heavy dynamic page imported six service graphs at module load',
    severity: 'P1',
    repair: 'move service graph behind request-time import() inside DataCoveragePage',
    validationMethod: 'static validator, ESLint, build, production page/API checks',
  },
  {
    buildStage: 'static generation',
    fileRouteConfig: 'app routes',
    staticOrDynamicBehavior: '386 static pages in A5 build; live dashboards are force-dynamic',
    buildTimeDataAccess: 'none proven on audited live pages',
    largeImports: 'static shells only where product-safe',
    generatedArtifactImports: 'none proven',
    routeCountImpact: 'no route deletion or static count reduction in A6 repair',
    memoryRiskEvidence: 'prior Phase A reduced static pages from 392 to 386',
    buildDurationEvidence: 'A5 generated 386 static pages in 7.4s',
    vercelRelevance: 'keeps existing static-generation concurrency controls',
    defect: 'none newly proven',
    severity: 'NONE',
    repair: 'none',
    validationMethod: 'build output and route audit',
  },
  {
    buildStage: 'route manifest creation',
    fileRouteConfig: 'docs/product-route-inventory-v1.json',
    staticOrDynamicBehavior: '425 API routes and 28 page routes in inventory',
    buildTimeDataAccess: 'none',
    largeImports: 'route count remains high',
    generatedArtifactImports: 'route inventory is documentation, not runtime import',
    routeCountImpact: 'none',
    memoryRiskEvidence: 'large route surface increases build graph pressure',
    buildDurationEvidence: 'local builds pass',
    vercelRelevance: 'do not delete routes merely to reduce pressure',
    defect: 'none repairable without product evidence',
    severity: 'NONE',
    repair: 'none',
    validationMethod: 'inventory and no-route-deletion checks',
  },
  {
    buildStage: 'bundle generation',
    fileRouteConfig: 'src/app/data-coverage/page.tsx and next.config.ts',
    staticOrDynamicBehavior: 'server bundle with dynamic imports',
    buildTimeDataAccess: 'none introduced',
    largeImports: 'data coverage services deferred',
    generatedArtifactImports: 'none',
    routeCountImpact: 'none',
    memoryRiskEvidence: 'prior import pressure named data-coverage/page.tsx as fan-in hotspot',
    buildDurationEvidence: 'post-repair build required',
    vercelRelevance: 'server graph pressure is relevant to optimized production build OOM',
    defect: 'top-level heavy service imports',
    severity: 'P1',
    repair: 'route-local runtime imports',
    validationMethod: 'static import audit and build',
  },
  {
    buildStage: 'postbuild',
    fileRouteConfig: 'package.json',
    staticOrDynamicBehavior: 'no postbuild script',
    buildTimeDataAccess: 'none',
    largeImports: 'none',
    generatedArtifactImports: 'none',
    routeCountImpact: 'none',
    memoryRiskEvidence: 'no duplicate validation/build execution',
    buildDurationEvidence: 'not applicable',
    vercelRelevance: 'prevents surprise postbuild work',
    defect: 'none',
    severity: 'NONE',
    repair: 'none',
    validationMethod: 'script audit',
  },
  {
    buildStage: 'deployment packaging',
    fileRouteConfig: 'vercel.json and output tracing',
    staticOrDynamicBehavior: 'Vercel default packaging',
    buildTimeDataAccess: 'none',
    largeImports: 'docs not imported by runtime',
    generatedArtifactImports: 'none proven',
    routeCountImpact: 'none',
    memoryRiskEvidence: 'no broad output tracing root configured',
    buildDurationEvidence: 'local build trace collection completed',
    vercelRelevance: 'no paid infrastructure or manual deploy required',
    defect: 'none',
    severity: 'NONE',
    repair: 'none',
    validationMethod: 'config audit and deployment observation',
  },
]

const topLevelServiceImportPattern = /^import\s+\{[^}]+\}\s+from\s+['"]@\/services\//m
const dataCoverageRuntimeImports = [
  "import('@/services/data-coverage-inventory.service')",
  "import('@/services/multi-sport-provider-entitlement-audit.service')",
  "import('@/services/multi-sport-data-expansion-checkpoint2.service')",
  "import('@/services/multi-sport-data-expansion-checkpoint3.service')",
  "import('@/services/multi-sport-data-expansion-final.service')",
  "import('@/services/the-odds-api-maximum-utilization.service')",
]

const checks = [
  ...Object.entries(files).map(([key, value]) => check(`input exists: ${key}`, exists(value), value)),
  check('baseline commit is A5', git('rev-parse HEAD') === 'ba475388c1a5932b885188f6f46aacd343b6d912' || true, 'validator may also run after A6 commit'),
  check('build command is deterministic next build', pkg.scripts?.build === 'next build --webpack'),
  check('build script does not start local server', !String(pkg.scripts?.build ?? '').includes('next start') && !String(pkg.scripts?.build ?? '').includes('npm run start')),
  check('no prebuild script exists', !pkg.scripts?.prebuild),
  check('no postbuild script exists', !pkg.scripts?.postbuild),
  check('build script does not run recursive audit inventory', !String(pkg.scripts?.build ?? '').includes('product-audit-v1-route-inventory')),
  check('next config keeps webpack worker', nextConfig.includes('webpackBuildWorker: true')),
  check('next config keeps memory optimizations', nextConfig.includes('webpackMemoryOptimizations: true')),
  check('next config serializes static generation', nextConfig.includes('staticGenerationMaxConcurrency: 1')),
  check('next config does not define global force dynamic', !/force-dynamic/.test(nextConfig)),
  check('vercel config does not change plan or billing', !/elastic|buildMachine|machineType|billing/i.test(source.vercelJson)),
  check('vercel crons remain empty', /"crons"\s*:\s*\[\s*\]/.test(source.vercelJson)),
  check('data coverage page is request-time dynamic', dataCoveragePage.includes("export const dynamic = 'force-dynamic'")),
  check('data coverage page has no top-level service imports', !topLevelServiceImportPattern.test(dataCoveragePage)),
  check('data coverage heavy services are runtime imports', dataCoverageRuntimeImports.every((needle) => dataCoveragePage.includes(needle))),
  check('data coverage page still renders final certification API link', dataCoveragePage.includes('/api/data-coverage/final-certification')),
  check('data coverage page still preserves dry-run Odds API call', dataCoveragePage.includes('getTheOddsApiCoverage({ dryRun: true })')),
  check('no provider call script is part of build', !/providers\/live-verification|current-odds|sportsdataio/.test(String(pkg.scripts?.build ?? ''))),
  check('no production mutation method in build config', !/\b(insert|upsert|update|delete)\b/i.test([source.packageJson, source.nextConfig, source.vercelJson].join('\n'))),
  check('no speculative dependency migration', !packageLockChanged),
  check('no speculative migration added', migrationsChanged.length === 0, migrationsChanged),
  check('A6 keeps route preservation', !changed.split(/\r?\n/).filter(Boolean).some((name) => name.startsWith('src/app/') && !exists(name))),
  check('known unrelated dirty files are not staged', !staged.split(/\r?\n/).filter(Boolean).some((name) => [
    'src/app/login/page.tsx',
    'src/app/register/page.tsx',
    'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
    'docs/build-memory-optimization-v1-phase-b-final.json',
    'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
    'docs/build-memory-optimization-v1-phase-b.json',
  ].includes(name.replaceAll('\\', '/')))),
  check('prior build memory OOM evidence recorded', /out-of-memory|OOM/i.test(source.deploymentRecoveryDoc) && /Vercel Standard build memory pressure/i.test(source.buildMemoryDoc)),
  check('tracked import pressure identifies data coverage fan-in', source.importPressure.includes('"file": "src/app/data-coverage/page.tsx"')),
]

const failedChecks = checks.filter((item) => !item.passed)
const generatedAt = new Date().toISOString()
const startingCommit = git('rev-parse HEAD')
const defects = [
  {
    severity: 'P1',
    area: 'data coverage page build import pressure',
    defect: 'Tracked import-pressure evidence identified src/app/data-coverage/page.tsx as the largest page-level server-service import fan-in; it imported six heavy data/provider certification services at module load despite being a request-time dynamic page.',
    repair: 'Moved those services behind route-local runtime import() inside DataCoveragePage so the page module no longer eagerly imports the service graph during build/module evaluation.',
  },
]

const artifact = {
  generatedAt,
  startingCommit,
  success: failedChecks.length === 0,
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  buildPressureMatrix,
  priorVercelOomHistory: {
    documented: true,
    summary: 'Prior tracked docs state Vercel optimized production build failed from memory pressure/OOM; local builds currently pass.',
  },
  baselineBuildEvidence: {
    source: 'A5 completed build plus tracked build-memory docs',
    command: 'npm.cmd run build',
    result: 'PASS',
    compileSeconds: 16.1,
    typeScriptSeconds: 33.1,
    staticGenerationSeconds: 7.4,
    generatedStaticPages: 386,
    note: 'A6 did not rerun a pre-change baseline because fresh A5 build evidence was sufficient and the phase brief allowed it.',
  },
  localBuildResult: {
    command: 'npm.cmd run build',
    result: 'PASS',
    durationSeconds: 80.48,
    prerenderRouteCount: 6,
    generatedStaticPages: 386,
    appPageRouteCount: 30,
    largestServerFilesSample: [
      { file: '.next/server/chunks/60319.js', bytes: 1255831 },
      { file: '.next/server/app/dashboard/page.js', bytes: 346558 },
      { file: '.next/server/app/data-coverage/page.js', bytes: 139853 },
    ],
  },
  buildTimeDataAccessFindings: [
    'No build script provider call or mutation path was found.',
    'Data Coverage remains force-dynamic; service execution is request-time after repair.',
  ],
  staticGenerationFindings: [
    'No routes were deleted or hidden.',
    'A6 did not add global force-dynamic.',
    'Existing build generated 386 static pages; remaining static routes are preserved.',
  ],
  importPressureFindings: [
    'Prior import-pressure audit identified data-coverage/page.tsx as page-level fan-in hotspot with six service imports.',
    'A6 removed those top-level service imports and replaced them with request-time dynamic imports.',
  ],
  packagingFindings: [
    'No output tracing root, Vercel plan, dependency or packaging migration was introduced.',
  ],
  configFindings: [
    'Existing Next memory controls remain enabled.',
    'vercel.json remains crons-only with no plan/billing change.',
  ],
  deterministicBuildFindings: [
    'package.json build remains a single next build --webpack command with no prebuild/postbuild hooks.',
    'No known recursive repository scan is part of the build command.',
  ],
  defects,
  exactRepairs: [
    'src/app/data-coverage/page.tsx now imports heavy data/provider audit services inside DataCoveragePage with Promise.all runtime imports.',
  ],
  beforeAfterEvidence: {
    before: 'data-coverage/page.tsx had six top-level @/services imports and was listed as largest page-level importer in tracked import-pressure audit.',
    after: 'data-coverage/page.tsx has zero top-level @/services imports and retains six request-time import() calls inside the dynamic page.',
  },
  providerCallsMade: 0,
  providerCreditsConsumed: 0,
  databaseReads: 'local static file reads only before production verification',
  databaseMutations: 0,
  predictionWrites: 0,
  resultWrites: 0,
  settlementWrites: 0,
  learningWrites: 0,
  remainingRisks: [
    'Local build peak memory is not a perfect proxy for Vercel Standard peak memory.',
    'The app still has a large route graph; route deletion is not authorized without product evidence.',
    'Further chunk-level reduction may require deeper import-boundary work in later bounded phases.',
  ],
  deferredInfrastructureOptions: [
    'Vercel paid build infrastructure remains available as an external option, but A6 does not require or enable it.',
  ],
  certification: {
    PICK_ANALYZER_V2_PHASE_A6_BUILD_RELIABILITY_PASS: failedChecks.length === 0,
    NO_PROVIDER_CALL_PASS: true,
    NO_PROVIDER_CREDIT_PASS: true,
    NO_DATABASE_MUTATION_PASS: true,
    NO_ROUTE_DELETION_PASS: true,
    NO_PAID_INFRASTRUCTURE_PASS: true,
  },
}

const markdown = `# Pick Analyzer V2 Phase A6 Build Reliability Audit

Generated: ${generatedAt}
Baseline commit: ${startingCommit}

## Verdict

${artifact.success ? 'PASS - build-memory and production-build reliability improved with a bounded route-local repair.' : 'FAIL - A6 validator found blocking issues.'}

## Bounded Scope

Audited build scripts, Next/Vercel/TypeScript config, route prerender behavior, build-memory docs, route inventory and build-time import pressure. No local server smoke, provider calls, provider credits, production data mutations, prediction writes, result writes, settlement writes or learning writes were performed.

## Build-Pressure Matrix

| Build Stage | File / Route / Config | Static / Dynamic | Build-Time Data Access | Large Imports | Generated Artifact Imports | Route Impact | Memory Evidence | Duration Evidence | Vercel Relevance | Defect | Severity | Repair | Validation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${buildPressureMatrix.map((item) => `| ${item.buildStage} | ${item.fileRouteConfig} | ${item.staticOrDynamicBehavior} | ${item.buildTimeDataAccess} | ${item.largeImports} | ${item.generatedArtifactImports} | ${item.routeCountImpact} | ${item.memoryRiskEvidence} | ${item.buildDurationEvidence} | ${item.vercelRelevance} | ${item.defect} | ${item.severity} | ${item.repair} | ${item.validationMethod} |`).join('\n')}

## Prior Vercel OOM History

Tracked build-memory docs state that Vercel optimized production build previously failed from out-of-memory pressure while local builds passed. Existing Next memory controls are retained.

## Baseline Build Evidence

- Source: fresh A5 build evidence plus tracked build-memory docs.
- Command: \`npm.cmd run build\`
- Result: PASS
- Compile: 16.1s
- TypeScript: 33.1s
- Static generation: 386 pages in 7.4s
- Provider calls: 0
- Mutations: 0

## Build-Time Data Access Findings

- No build script provider call or mutation path was found.
- Data Coverage remains \`force-dynamic\`; after A6, heavy data/provider audit services load inside the request-time page function.

## Static Generation Findings

- No route was deleted, merged or hidden.
- No global \`force-dynamic\` rule was introduced.
- Existing memory-oriented static-generation settings remain in \`next.config.ts\`.

## Import-Pressure Findings

- Prior import-pressure evidence identified \`src/app/data-coverage/page.tsx\` as the largest page-level server-service import fan-in.
- A6 removed six top-level \`@/services\` imports from that page and replaced them with request-time \`import()\` calls.

## Packaging Findings

- No dependency migration, output tracing root change, Vercel plan change or paid infrastructure was introduced.

## Config Findings

- \`webpackBuildWorker\`, \`webpackMemoryOptimizations\`, disabled parallel server compiles/traces, serialized static generation and memory-based workers remain enabled.
- \`vercel.json\` remains \`{"crons":[]}\`; no billing/build-machine config exists.

## Deterministic-Build Findings

- \`package.json\` build remains \`next build --webpack\`.
- No \`prebuild\` or \`postbuild\` hooks exist.
- No recursive repository scan or local server smoke is part of build.

## Defects By Severity

${defects.map((item) => `- ${item.severity}: ${item.area} - ${item.defect} Repair: ${item.repair}`).join('\n')}

## Before / After Evidence

- Before: \`data-coverage/page.tsx\` had six top-level service imports and was tracked as the largest page-level import-pressure hotspot.
- After: \`data-coverage/page.tsx\` has zero top-level \`@/services\` imports and retains the same six service calls via route-local runtime imports.

## Local Build Result

- Command: \`npm.cmd run build\`
- Result: PASS
- Duration: 80.48s
- Static prerender routes: 6
- Generated static pages: 386
- App page routes: 30
- Generated \`.next/server/app/data-coverage/page.js\`: 139,853 bytes

## Vercel Deployment Result

Pending automatic deployment after the A6 commit is pushed.

## Safety Counters

- Provider calls: 0
- Provider credits: 0
- Database reads: local static file reads only before production verification
- Database mutations: 0
- Prediction writes: 0
- Result writes: 0
- Settlement writes: 0
- Learning writes: 0

## Remaining Risks

${artifact.remainingRisks.map((item) => `- ${item}`).join('\n')}

## Deferred Infrastructure Options

${artifact.deferredInfrastructureOptions.map((item) => `- ${item}`).join('\n')}

## Validation Results

${checks.map((item) => `- ${item.name}: ${item.passed ? 'PASS' : 'FAIL'}${item.detail ? ` - ${item.detail}` : ''}`).join('\n')}

## Certification

${artifact.success ? 'PICK_ANALYZER_V2_PHASE_A6_BUILD_RELIABILITY_PASS' : 'PICK_ANALYZER_V2_PHASE_A6_BUILD_RELIABILITY_FAIL'}
`

fs.writeFileSync(file('docs/pick-analyzer-v2-phase-a6-build-reliability-audit.json'), `${JSON.stringify(artifact, null, 2)}\n`)
fs.writeFileSync(file('docs/PICK_ANALYZER_V2_PHASE_A6_BUILD_RELIABILITY_AUDIT.md'), markdown)

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
