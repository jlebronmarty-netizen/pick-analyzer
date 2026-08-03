import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const checks = []

const files = {
  home: 'src/components/home/HomeBettingPlan.tsx',
  performanceRoute: 'src/app/api/performance/route.ts',
  performanceClient: 'src/components/performance/PerformanceProductClient.tsx',
  performanceScope: 'src/services/performance-scope-v2.service.ts',
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8')
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file))
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

for (const file of Object.values(files)) check(`input exists: ${file}`, exists(file))

const home = read(files.home)
const performanceRoute = read(files.performanceRoute)
const performanceClient = read(files.performanceClient)
const performanceScope = read(files.performanceScope)

check('homepage exposes canonical current-day fields', ['currentGames?: number', 'lifecycleCounts?:', 'gameCoverageSummary?:', 'schedulerCoverage?:'].every((item) => home.includes(item)))
check('homepage has deterministic positive-count helper', home.includes('function firstPositiveCount') && home.includes('if (parsed > 0) return parsed'))
check('Games Today uses canonical operating-day count before current-board candidates', home.indexOf('data.currentGames') < home.indexOf('data.viewModel?.selectors?.currentBoardSummary?.candidates') && home.indexOf('data.lifecycleCounts?.totalScheduledToday') < home.indexOf('data.viewModel?.selectors?.currentBoardSummary?.candidates'))
check('Games Today cannot be zero when currentGames is populated', /const gamesToday = firstPositiveCount\([\s\S]*data\.currentGames[\s\S]*data\.lifecycleCounts\?\.totalScheduledToday[\s\S]*\)/.test(home))
check('Decision Summary and header share the same dashboard response contract', home.includes('DailyBrief data={data}') && home.includes('DecisionSummary data={data} plan={plan}'))
check('Games Skipped uses scheduler coverage before candidate leftovers', home.indexOf('data.schedulerCoverage?.skippedToday') < home.indexOf('plan.candidates.length - plan.candidates.filter'))
check('Technical lifecycle metric uses canonical current-day count', home.includes('firstPositiveCount(data.totalScheduledToday, data.currentGames, data.lifecycleCounts?.totalScheduledToday)'))
check('homepage reads remain no-store and read-only', ["fetch('/api/dashboard/today', { cache: 'no-store' })", "fetch('/api/current-board?mode=current&limit=100', { cache: 'no-store' })"].every((item) => home.includes(item)))
check('homepage does not call providers or mutation routes', !/fetch\([^)]*(provider|execute|generate|settle|sync|cron|refresh|cache\/clear)/i.test(home))
check('Performance scope documents Puerto Rico timeline bucketing', performanceScope.includes("const TIMEZONE = 'America/Puerto_Rico'") && performanceScope.includes("generatedUses: 'event_start_ast_date_fallback_prediction_generated_at'"))
check('Performance timeline exposes production eligible count', performanceRoute.includes('productionEligible: item.eligible') && performanceClient.includes('Production Eligible {item.productionEligible ?? 0}'))
check('Performance timeline exposes non-production rows', performanceRoute.includes('nonProductionRows') && performanceClient.includes('Non-production rows'))
check('Performance zero-sample message explains generated-but-not-production-evaluable rows', performanceRoute.includes('not production-evaluable') && performanceClient.includes('generated rows can include analyzed, quarantined or blocked rows'))
check('settled rows are not fabricated', !/result\s*=\s*['"]settled['"]|settledRows\s*=\s*generated|productionSettled:\s*item\.generated/.test([performanceRoute, performanceClient, home].join('\n')))
check('no prediction formulas or policy keywords changed in repair files', !/model_probability\s*[+\-*/]=|officialThreshold|kelly|learning weight|scheduler cadence/i.test([home, performanceRoute, performanceClient].join('\n')))
check('no provider calls or remote mutations introduced in performance route', performanceRoute.includes('providerCallsMade: 0') && performanceRoute.includes('remoteMutationsMade: 0') && !/\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(performanceRoute))
check('MC-08E artifacts are not part of this isolated repair worktree', !exists('docs/CERTIFICATION/MC_08E_WATCHLIST_EXPERIENCE.md') && !exists('docs/CERTIFICATION/mc-08e-watchlist-experience.json') && !exists('docs/MISSION_CONTROL/MC_08E_WATCHLIST_EXPERIENCE.md') && !exists('scripts/mc08e-watchlist-experience-validate.mjs'))

const changed = git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll('\\', '/'))
const allowed = new Set([
  'src/components/home/HomeBettingPlan.tsx',
  'src/app/api/performance/route.ts',
  'src/components/performance/PerformanceProductClient.tsx',
  'scripts/p1-homepage-performance-date-consistency-validate.mjs',
  'scripts/mc08a-homepage-experience-validate.mjs',
  'scripts/mc08b-rent-play-experience-validate.mjs',
  'scripts/mc08c-moneyline-bet-experience-validate.mjs',
  'scripts/mc08d-smart-parlay-experience-validate.mjs',
  'scripts/mission-control-v1-validate.mjs',
])
const disallowed = changed.filter((file) => !allowed.has(file) && !file.startsWith('.p1-evidence/'))
check('only bounded P1 repair files are modified', disallowed.length === 0, disallowed.join(', '))

const failed = checks.filter((item) => !item.passed)
const result = {
  generatedAt: new Date().toISOString(),
  mode: 'p1_homepage_performance_date_consistency_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
if (failed.length > 0) process.exit(1)
