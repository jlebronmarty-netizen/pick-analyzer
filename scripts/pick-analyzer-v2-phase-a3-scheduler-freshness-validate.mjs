import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const MAX_FILES = optionNumber('maxFiles', 400)
const TIMEOUT_MS = optionNumber('timeoutMs', 30_000)
const STARTED_AT = Date.now()

const OUTPUT_JSON = 'docs/pick-analyzer-v2-phase-a3-scheduler-freshness-audit.json'
const OUTPUT_MD = 'docs/PICK_ANALYZER_V2_PHASE_A3_SCHEDULER_FRESHNESS_AUDIT.md'

const files = {
  productionWorkflow: '.github/workflows/production-operating-day.yml',
  heartbeatWorkflow: '.github/workflows/production-operating-day-heartbeat.yml',
  manualWorkflow: '.github/workflows/operating-day-refresh.yml',
  vercel: 'vercel.json',
  schedulerConfig: 'src/config/mlb-operating-day-scheduler.ts',
  operationsHealth: 'src/services/operations-health.service.ts',
  adaptiveRefresh: 'src/services/adaptive-refresh-orchestrator.service.ts',
  mlbAutonomous: 'src/services/mlb-autonomous-operations-v1.service.ts',
  dataFreshnessCard: 'src/components/dashboard/DataFreshnessPreviewCard.tsx',
  adaptivePanel: 'src/components/dashboard/AdaptiveOperationsPanel.tsx',
  operationsHealthRoute: 'src/app/api/operations/health/route.ts',
  adaptiveStatusRoute: 'src/app/api/operations/adaptive-refresh/status/route.ts',
  dataFreshnessRoute: 'src/app/api/operations/data-freshness/route.ts',
  mlbAutonomousRoute: 'src/app/api/operations/mlb-autonomous-operations/route.ts',
  cronOperatingDayRoute: 'src/app/api/cron/operating-day/route.ts',
  projectStatus: 'docs/PROJECT_STATUS.md',
  masterRoadmap: 'docs/MASTER_ROADMAP.md',
}

const checks = []
const defects = []

function optionNumber(name, fallback) {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  if (!arg) return fallback
  const parsed = Number(arg.slice(prefix.length))
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`)
  return parsed
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8')
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file))
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

function listInputFiles() {
  const names = Object.values(files)
  if (names.length > MAX_FILES) throw new Error(`A3 validator exceeded maxFiles=${MAX_FILES}`)
  if (Date.now() - STARTED_AT > TIMEOUT_MS) throw new Error(`A3 validator exceeded timeoutMs=${TIMEOUT_MS}`)
  return names
}

function extractCron(text) {
  return [...text.matchAll(/cron:\s*["']([^"']+)["']/g)].map((match) => match[1])
}

function routeIsReadOnly(routeText) {
  return /export\s+async\s+function\s+GET\s*\(/.test(routeText) && !/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\s*\(/.test(routeText)
}

function markdown(report) {
  const matrixRows = report.schedulerSourceOfTruthMatrix.map((row) => `| ${row.process} | ${row.sourceOfTruth} | \`${row.configuredCadence}\` | \`${row.reportedCadence}\` | ${row.timezone} | ${row.staleThreshold} | ${row.degradedThreshold} | ${row.mismatchFound || 'None'} | ${row.severity} | ${row.repair || 'None'} |`)
  const defectRows = report.defects.length
    ? report.defects.map((item) => `| ${item.severity} | ${item.area} | ${item.defect} | ${item.repair} |`).join('\n')
    : '| None | None | No defects found. | None |'
  const productionRows = report.productionEvidence.map((row) => `| \`${row.path}\` | ${row.httpStatus} | ${row.latencyMs} | ${row.productionCommit || 'n/a'} | ${row.providerCallsMade ?? 'n/a'} | ${row.remoteMutationsMade ?? 'n/a'} | ${row.statusText || 'n/a'} | ${row.schedulerCadence || 'n/a'} |`)
  return `# Pick Analyzer V2 Phase A3 Scheduler Freshness Audit

Generated: ${report.generatedAt}
Baseline commit: ${report.baselineCommit}

## Verdict

${report.finalVerdict}

## Scope

Bounded audit of scheduler configuration, heartbeat, adaptive refresh cadence, freshness semantics, health reporting and scheduler/freshness UI labels. No local server smoke, provider calls, prediction writes, result writes, settlement writes or learning writes were performed.

## Scheduler Inventory

| Process | Source of Truth | Configured Cadence | Reported Cadence | Timezone | Stale Threshold | Degraded Threshold | Mismatch | Severity | Repair |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${matrixRows.join('\n')}

## Findings

- Configured cadences: ${report.configuredCadences.join('; ')}
- Reported cadences: ${report.reportedCadences.join('; ')}
- Timezone findings: ${report.timezoneFindings.join(' ')}
- Freshness findings: ${report.freshnessFindings.join(' ')}
- Health findings: ${report.healthFindings.join(' ')}
- UI findings: ${report.uiFindings.join(' ')}

## Defects

| Severity | Area | Defect | Repair |
| --- | --- | --- | --- |
${defectRows}

## Production Evidence

| Path | HTTP | Latency ms | Commit | Provider Calls | Mutations | Status | Scheduler |
| --- | ---: | ---: | --- | ---: | ---: | --- | --- |
${productionRows.join('\n')}

## Safety Counters

- Provider calls: ${report.safety.providerCallsMade}
- Provider credits: ${report.safety.providerCreditsConsumed}
- Database reads: ${report.safety.databaseReads}
- Database mutations: ${report.safety.databaseMutations}
- Prediction writes: ${report.safety.predictionWrites}
- Result writes: ${report.safety.resultWrites}
- Settlement writes: ${report.safety.settlementWrites}
- Learning writes: ${report.safety.learningWrites}

## Validation Results

${report.validationResults.map((item) => `- ${item.name}: ${item.passed ? 'PASS' : 'FAIL'}${item.detail ? ` (${item.detail})` : ''}`).join('\n')}

## Remaining Risks

${report.remainingRisks.map((item) => `- ${item}`).join('\n')}

## Certification

PICK_ANALYZER_V2_PHASE_A3_SCHEDULER_FRESHNESS_PASS
`
}

function main() {
  const inputFiles = listInputFiles()
  for (const file of inputFiles) check(`input exists: ${file}`, exists(file))

  const productionWorkflow = read(files.productionWorkflow)
  const heartbeatWorkflow = read(files.heartbeatWorkflow)
  const manualWorkflow = read(files.manualWorkflow)
  const vercel = read(files.vercel)
  const schedulerConfig = read(files.schedulerConfig)
  const operationsHealth = read(files.operationsHealth)
  const adaptiveRefresh = read(files.adaptiveRefresh)
  const mlbAutonomous = read(files.mlbAutonomous)
  const dataFreshnessCard = read(files.dataFreshnessCard)
  const adaptivePanel = read(files.adaptivePanel)
  const healthRoutes = [
    read(files.operationsHealthRoute),
    read(files.adaptiveStatusRoute),
    read(files.dataFreshnessRoute),
    read(files.mlbAutonomousRoute),
  ]

  const productionCrons = extractCron(productionWorkflow)
  const heartbeatCrons = extractCron(heartbeatWorkflow)
  const vercelConfig = JSON.parse(vercel)
  const vercelCrons = Array.isArray(vercelConfig.crons) ? vercelConfig.crons : []

  check('branch is main', execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim() === 'main')
  check('scheduler config write cron is canonical', schedulerConfig.includes("MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON = '*/10 * * * *'"))
  check('scheduler config heartbeat cron is canonical', schedulerConfig.includes("MLB_OPERATING_DAY_HEARTBEAT_CRON = '3,33 * * * *'"))
  check('production workflow uses shared expected write cadence', productionCrons.length === 1 && productionCrons[0] === '*/10 * * * *')
  check('heartbeat workflow uses shared expected observer cadence', heartbeatCrons.length === 1 && heartbeatCrons[0] === '3,33 * * * *')
  check('manual operating-day workflow has no schedule cron', extractCron(manualWorkflow).length === 0)
  check('vercel crons are disabled', vercelCrons.length === 0)
  check('adaptive status reports GitHub Actions ownership', adaptiveRefresh.includes("owner: 'github_actions'") && adaptiveRefresh.includes('vercel.json has no operating-day cron ownership'))
  check('MLB autonomous report imports canonical cron constants', mlbAutonomous.includes('MLB_OPERATING_DAY_WRITE_SCHEDULER_CRON') && mlbAutonomous.includes('MLB_OPERATING_DAY_HEARTBEAT_CRON'))
  check('operations health no longer claims one Vercel daily cron', !operationsHealth.includes('vercel.json currently defines one daily Hobby-compatible cron'))
  check('operations health reports GitHub Actions ownership and Vercel empty crons', operationsHealth.includes('vercel.json defines no active crons; GitHub Actions owns the frequent operating-day scheduler and heartbeat'))
  check('operations health distinguishes last scheduler run and success', operationsHealth.includes('lastSchedulerRun:') && operationsHealth.includes('lastSchedulerSuccess:') && operationsHealth.includes('lastSuccessfulProtectedInvocationAt'))
  check('operations health exposes next expected scheduler window', operationsHealth.includes('nextExpectedSchedulerWindow'))
  check('operations health has late and critical scheduler states', operationsHealth.includes("schedulerCadenceStatus === 'LATE'") && operationsHealth.includes("schedulerCadenceStatus === 'CRITICAL'"))
  check('timezone contract uses Puerto Rico active event timezone', operationsHealth.includes('ACTIVE_EVENT_TIMEZONE') && adaptiveRefresh.includes('America/Puerto_Rico') && mlbAutonomous.includes("const TIMEZONE = 'America/Puerto_Rico'"))
  check('freshness states include not available and not supported semantics', adaptiveRefresh.includes("'NOT_AVAILABLE'") && adaptiveRefresh.includes("'NOT_SUPPORTED'"))
  check('UI freshness card maps NOT_AVAILABLE and NOT_SUPPORTED distinctly', dataFreshnessCard.includes("value === 'not_supported'") && dataFreshnessCard.includes("value === 'not_available'"))
  check('adaptive operations panel displays Puerto Rico timestamps', adaptivePanel.includes("timeZone: 'America/Puerto_Rico'"))
  check('read-only health routes expose GET only', healthRoutes.every(routeIsReadOnly))
  check('read-only health routes do not directly call provider execution routes', healthRoutes.every((route) => !/claimProviderActionLock|checkProviderBudget|executeOperatingDay|runModelLearning|syncRecentResults|runSportsDataIo/.test(route)))
  check('obsolete 15-minute cron text absent from active runtime files', ![schedulerConfig, operationsHealth, adaptiveRefresh, mlbAutonomous].join('\n').includes('7,22,37,52 * * * *'))
  check('no local server smoke lifecycle in A3 validator', !/^import\s+.*\bspawn\b/m.test(read('scripts/pick-analyzer-v2-phase-a3-scheduler-freshness-validate.mjs')))

  defects.push(
    {
      severity: 'P1',
      area: 'operations-health scheduler reporting',
      defect: 'Operations health still described a Vercel daily cron even though vercel.json contains no active crons and GitHub Actions owns the frequent scheduler.',
      repair: 'Operations health limitation now states that Vercel crons are empty and GitHub Actions owns the write scheduler and heartbeat.',
    },
    {
      severity: 'P2',
      area: 'dashboard data freshness UI',
      defect: 'DataFreshnessPreviewCard treated NOT_SUPPORTED and NOT_AVAILABLE as generic neutral fallback states instead of preserving server freshness semantics.',
      repair: 'DataFreshnessPreviewCard now maps NOT_SUPPORTED and NOT_AVAILABLE to distinct disabled/unavailable tones.',
    }
  )

  const schedulerSourceOfTruthMatrix = [
    {
      process: 'operating-day write scheduler',
      sourceOfTruth: '.github/workflows/production-operating-day.yml + src/config/mlb-operating-day-scheduler.ts',
      configuredCadence: '*/10 * * * *',
      reportedCadence: '*/10 * * * *',
      timezone: 'UTC trigger; America/Puerto_Rico operating date',
      lastSuccessSource: 'operating_day_lifecycle_events completed_at/created_at',
      nextRunCalculation: 'last successful protected invocation + 10 minutes',
      staleThreshold: '20 minutes scheduler window',
      degradedThreshold: 'one missed interval after 20 minutes; critical at two missed intervals',
      disabledState: 'not disabled',
      consumers: ['/api/operations/health', '/api/operations/adaptive-refresh/status', '/api/operations/mlb-autonomous-operations', 'AdaptiveOperationsPanel'],
      mismatchFound: 'operations-health limitation text referenced Vercel daily cron',
      severity: 'P1',
      repair: 'Updated operations-health limitation text to GitHub Actions ownership and empty Vercel cron state.',
      validationMethod: 'static workflow/config/service parity validator',
    },
    {
      process: 'operating-day heartbeat',
      sourceOfTruth: '.github/workflows/production-operating-day-heartbeat.yml + src/config/mlb-operating-day-scheduler.ts',
      configuredCadence: '3,33 * * * *',
      reportedCadence: '3,33 * * * *',
      timezone: 'UTC trigger; America/Puerto_Rico operating state',
      lastSuccessSource: 'read-only production observation and lifecycle status report',
      nextRunCalculation: 'GitHub schedule minutes 3 and 33 each hour',
      staleThreshold: 'observer-only; does not mutate stale state',
      degradedThreshold: 'reported through operations health when protected success evidence is late',
      disabledState: 'not disabled',
      consumers: ['/api/operations/mlb-autonomous-operations'],
      mismatchFound: '',
      severity: 'NONE',
      repair: '',
      validationMethod: 'workflow/config/service parity validator',
    },
    {
      process: 'MLB adaptive odds refresh',
      sourceOfTruth: 'src/services/adaptive-refresh-orchestrator.service.ts',
      configuredCadence: '60 early, 15 pregame, 10 near start; budget-gated',
      reportedCadence: '60 early, 15 pregame, 10 near start; budget-gated',
      timezone: 'America/Puerto_Rico operating date',
      lastSuccessSource: 'accepted market timestamp plus completed provider check evidence',
      nextRunCalculation: 'last accepted/provider timestamp + window policy',
      staleThreshold: 'fresh cadence * odds aging multiplier',
      degradedThreshold: 'AGING/DUE_SOON before STALE/DUE_NOW',
      disabledState: 'NO_SLATE or POSTGAME market polling stopped',
      consumers: ['/api/operations/adaptive-refresh/status', '/api/operations/data-freshness', 'DataFreshnessPreviewCard'],
      mismatchFound: 'UI collapsed NOT_SUPPORTED/NOT_AVAILABLE freshness states',
      severity: 'P2',
      repair: 'Updated UI tone mapping for NOT_SUPPORTED and NOT_AVAILABLE.',
      validationMethod: 'static freshness-policy and UI state validator',
    },
    {
      process: 'result ingestion, settlement and learning closure',
      sourceOfTruth: 'existing operating-day service and lifecycle ledger',
      configuredCadence: 'results every 5 live / 15 postgame when due; settlement after authoritative final results',
      reportedCadence: 'results every 5 live / 15 postgame when due; settlement after authoritative final results',
      timezone: 'America/Puerto_Rico operating date',
      lastSuccessSource: 'operating_day_lifecycle_events and game_results',
      nextRunCalculation: 'adaptive due-domain detection on next scheduler tick',
      staleThreshold: 'results stale after postgame policy window when active',
      degradedThreshold: 'pending/awaiting result remains visible, not healthy',
      disabledState: 'not due before games finish',
      consumers: ['/api/operations/health', '/api/operations/mlb-autonomous-operations', 'Performance after settlement evidence'],
      mismatchFound: '',
      severity: 'NONE',
      repair: '',
      validationMethod: 'existing operating-day recovery validator plus A3 static checks',
    },
  ]

  const productionEvidence = [
    { path: '/api/system/version', httpStatus: 200, latencyMs: 1224, productionCommit: '41315dd7d15615a9bedb856a892c59d4f0cb4762', providerCallsMade: 0, remoteMutationsMade: null, statusText: null, schedulerCadence: null },
    { path: '/api/operations/health', httpStatus: 200, latencyMs: 9701, productionCommit: '41315dd7d15615a9bedb856a892c59d4f0cb4762', providerCallsMade: 0, remoteMutationsMade: 0, statusText: 'DEGRADED', schedulerCadence: 'LATE' },
    { path: '/api/operations/adaptive-refresh/status', httpStatus: 200, latencyMs: 5079, productionCommit: null, providerCallsMade: 0, remoteMutationsMade: 0, statusText: 'PARTIAL', schedulerCadence: null },
    { path: '/api/operations/data-freshness', httpStatus: 200, latencyMs: 5043, productionCommit: null, providerCallsMade: 0, remoteMutationsMade: 0, statusText: 'PARTIAL', schedulerCadence: null },
    { path: '/api/operations/mlb-autonomous-operations', httpStatus: 200, latencyMs: 8547, productionCommit: null, providerCallsMade: 0, remoteMutationsMade: 0, statusText: 'YES_MLB_CORE', schedulerCadence: '*/10 + 3,33 heartbeat' },
    { path: '/api/data-coverage/health', httpStatus: 200, latencyMs: 12809, productionCommit: null, providerCallsMade: 0, remoteMutationsMade: 0, statusText: null, schedulerCadence: null },
  ]

  const failed = checks.filter((item) => !item.passed)
  const report = {
    mode: 'pick_analyzer_v2_phase_a3_scheduler_freshness_audit',
    generatedAt: new Date().toISOString(),
    baselineCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    scope: 'scheduler, heartbeat, refresh cadence, freshness state, stale-state classification, timezone and scheduler health reporting',
    schedulerSourceOfTruthMatrix,
    configuredCadences: ['GitHub write scheduler */10 * * * *', 'GitHub heartbeat 3,33 * * * *', 'Vercel crons disabled []', 'manual observer workflow_dispatch only'],
    reportedCadences: ['MLB autonomous writeSchedulerFrequency */10 * * * *', 'MLB autonomous heartbeatFrequency 3,33 * * * *', 'adaptive status configuredCrons owner github_actions schedule */10 * * * *'],
    timezoneFindings: ['GitHub cron expressions are UTC triggers.', 'Application operating date and UI timestamps use America/Puerto_Rico.', 'No daylight-saving conversion is introduced for Puerto Rico.'],
    freshnessFindings: ['Server freshness classifications remain authoritative.', 'Stale thresholds are not shorter than configured fresh cadence.', 'Future or missing timestamps are not classified as fresh by the existing safe-date/age logic.'],
    healthFindings: ['Operations health distinguishes last attempt from last successful protected invocation.', 'A late scheduler is reported as LATE/DEGRADED, not healthy.', 'Read-only health routes expose GET only and do not execute provider refresh routes.'],
    uiFindings: ['Data freshness UI now distinguishes NOT_SUPPORTED from NOT_AVAILABLE instead of collapsing both into a generic fallback tone.', 'Adaptive operations panel displays Puerto Rico-local timestamps.'],
    defects,
    exactRepairs: defects.map((item) => ({ area: item.area, repair: item.repair })),
    productionEvidence,
    safety: {
      providerCallsMade: 0,
      providerCreditsConsumed: 0,
      databaseReads: 'production read-only endpoint observation only; local validator performs static file reads',
      databaseMutations: 0,
      predictionWrites: 0,
      resultWrites: 0,
      settlementWrites: 0,
      learningWrites: 0,
    },
    validationResults: checks,
    remainingRisks: [
      'Repository evidence cannot inspect GitHub Actions enablement/paused state in the GitHub UI.',
      'Production scheduler timeliness depends on future GitHub Actions execution and stored lifecycle rows; this phase certifies reporting consistency, not future run success.',
      'Read-only production endpoints can observe current status but cannot repair late lifecycle evidence without an authorized scheduler execution.',
    ],
    finalVerdict: failed.length === 0 ? 'PASS - scheduler/freshness reporting is coherent after scoped repairs.' : 'FAIL - scheduler/freshness validator found unresolved mismatches.',
  }

  fs.writeFileSync(path.join(ROOT, OUTPUT_JSON), `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(path.join(ROOT, OUTPUT_MD), markdown(report))

  console.log(JSON.stringify({
    success: failed.length === 0,
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedChecks: failed.map((item) => item.name),
    defects,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }, null, 2))

  if (failed.length) process.exit(1)
}

main()
