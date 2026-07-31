import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const checks = []

const files = {
  panel: 'src/components/dashboard/TodayDecisionPanel.tsx',
  helper: 'src/components/dashboard/today-opportunity-readiness.ts',
  budgetService: 'src/services/provider-budget.service.ts',
  adaptivePolicy: 'docs/ADAPTIVE_REFRESH_POLICY_V1.md',
  workflow: '.github/workflows/production-operating-day.yml',
  json: 'docs/pick-analyzer-v2-phase-b6-1-live-freshness-budget-audit.json',
  markdown: 'docs/PICK_ANALYZER_V2_PHASE_B6_1_LIVE_FRESHNESS_BUDGET_AUDIT.md',
}

const knownUnrelated = [
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
  'docs/build-memory-optimization-v1-phase-b-final.json',
  'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
  'docs/build-memory-optimization-v1-phase-b.json',
]

function filePath(file) {
  return path.join(ROOT, file)
}

function read(file) {
  return fs.readFileSync(filePath(file), 'utf8')
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

for (const file of Object.values(files)) check(`input exists: ${file}`, fs.existsSync(filePath(file)))

const panel = read(files.panel)
const helper = read(files.helper)
const budgetService = read(files.budgetService)
const adaptivePolicy = read(files.adaptivePolicy)
const workflow = read(files.workflow)
const artifact = JSON.parse(read(files.json))
const markdown = read(files.markdown)

check('page fetch time is not market update time in panel', panel.includes('Page {relativeTime(data.generatedAt)}') && !panel.includes('data.latestOddsTimestamp ?? data.generatedAt'))
check('opportunity selector market timestamp has no page fallback', panel.includes('function marketTimestampFor') && panel.includes('return data.latestOddsTimestamp ?? data.viewModel?.selectors?.marketFreshnessSummary?.latestOddsTimestamp ?? null'))
check('official row market timestamp has no page fallback', !panel.includes('oddsSnapshotAt ?? data.generatedAt') && !panel.includes(': data.generatedAt'))
check('grounded opportunity market timestamp has no page fallback', !panel.includes('grounded.oddsTimestamp ?? data.generatedAt'))
check('stale evidence cannot render FRESH in primary metric', panel.includes('function marketFreshnessDisplay') && panel.includes("return { label: 'STALE'") && panel.includes('<PremiumMetric label="Market Freshness"'))
check('future timestamps are invalid', panel.includes('Timestamp ahead of system clock') && panel.includes('Stored odds timestamp is ahead of the system clock'))
check('helper selector timestamp has no page fallback', helper.includes('marketFreshnessSummary?.latestOddsTimestamp ?? null') && !helper.includes('marketFreshnessSummary?.latestOddsTimestamp ?? data.generatedAt'))
check('generic metricValue is not blindly treated as EV', panel.includes('function selectorExpectedValue') && helper.includes('function selectorExpectedValue') && !panel.includes('selector.expectedValue ?? selector.metricValue') && !helper.includes('selector.expectedValue ?? selector.metricValue'))
check('metricValue fallback is limited to EV semantics', panel.includes("metricName.includes('expected value')") && helper.includes("metricName.includes('expected value')"))
check('budget calculation is MLB scoped by default', budgetService.includes("sportKey = input.sportKey ?? 'baseball_mlb'") && budgetService.includes('MLB_DAILY_CREDIT_BUDGET'))
check('budget allowance is classified configured only', artifact.providerBudget.allowanceSource === 'configured_only' && artifact.providerBudget.actualProviderQuotaProven === false && markdown.includes('configured only'))
check('scheduler cadence claim does not exceed trigger', workflow.includes('*/10 * * * *') && artifact.cadence.schedulerTickMinutes === 10 && artifact.cadence.trueFiveMinuteRefreshEnabled === false)
check('adaptive policy does not claim true 5 minute scheduler', adaptivePolicy.includes('Less than 2h before first pitch | 10 minutes') && markdown.includes('A 5 minute cadence requires'))
check('no all-sport 5-minute polling enabled', artifact.cadence.allSportFiveMinutePollingEnabled === false && markdown.includes('Broad all-sport 5 minute polling'))
check('post-start refresh is blocked by documented policy', adaptivePolicy.includes('After game starts | stop pregame odds') && artifact.cadence.documentedWindows.some((item) => item.window === 'after_start' && item.rule === 'stop_pregame_odds'))
check('provider calls and mutations accounted', artifact.safety.providerCallsMade === 0 && artifact.safety.providerCreditsUsed === 0 && artifact.safety.databaseMutations === 0)
check('prediction settlement learning writes accounted', artifact.safety.predictionWrites === 0 && artifact.safety.settlementWrites === 0 && artifact.safety.learningWrites === 0)
check('business formulas and Official Pick policy unchanged', artifact.safety.probabilityFormulaChanged === false && artifact.safety.evFormulaChanged === false && artifact.safety.edgeFormulaChanged === false && artifact.safety.officialPickPolicyChanged === false)
check('scheduler/provider mappings unchanged', artifact.safety.schedulerChanged === false && artifact.safety.providerMappingsChanged === false)
check('freshness timestamp map is explicit', ['PAGE_UPDATED', 'MARKET_UPDATED', 'PREDICTION_UPDATED', 'SYSTEM_UPDATED'].every((key) => artifact.freshnessTimestampMap[key] && markdown.includes(key)))
check('B7 was not started', artifact.b7Started === false && markdown.includes('B7 was not started'))

const staged = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean)
check('unrelated dirty files are not staged', knownUnrelated.every((file) => !staged.includes(file)), staged.join(', '))

const changed = git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll('\\', '/'))
const forbiddenBusinessFiles = changed.filter((file) => /^(src\/services\/(prediction|settlement|learning|model|recommendation)|src\/config\/recommendation|supabase\/migrations\/)/.test(file))
check('no business formula migration or policy files changed', forbiddenBusinessFiles.length === 0, forbiddenBusinessFiles.join(', '))

const result = {
  generatedAt: new Date().toISOString(),
  baselineCommit: artifact.baselineCommit,
  verdict: checks.every((item) => item.passed)
    ? 'PICK_ANALYZER_V2_PHASE_B6_1_LIVE_FRESHNESS_BUDGET_PASS'
    : 'PICK_ANALYZER_V2_PHASE_B6_1_LIVE_FRESHNESS_BUDGET_FAIL',
  checks: checks.length,
  passed: checks.filter((item) => item.passed).length,
  failed: checks.filter((item) => !item.passed).length,
  failedChecks: checks.filter((item) => !item.passed),
  safety: artifact.safety,
}

console.log(JSON.stringify(result, null, 2))
if (!checks.every((item) => item.passed)) process.exit(1)
