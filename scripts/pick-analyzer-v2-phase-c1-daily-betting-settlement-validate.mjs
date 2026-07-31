import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const checks = []

const files = {
  homepage: 'src/app/page.tsx',
  homePlan: 'src/components/home/HomeBettingPlan.tsx',
  operatingDay: 'src/services/operating-day.service.ts',
  adaptiveRefresh: 'src/services/adaptive-refresh-orchestrator.service.ts',
  settlementGuarantee: 'src/services/settlement-guarantee.service.ts',
  settlementRoute: 'src/app/api/operations/settlement-guarantee/route.ts',
  json: 'docs/pick-analyzer-v2-phase-c1-daily-betting-settlement-guarantee.json',
  markdown: 'docs/PICK_ANALYZER_V2_PHASE_C1_DAILY_BETTING_AND_SETTLEMENT_GUARANTEE.md',
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

const homepage = read(files.homepage)
const homePlan = read(files.homePlan)
const operatingDay = read(files.operatingDay)
const adaptiveRefresh = read(files.adaptiveRefresh)
const guarantee = read(files.settlementGuarantee)
const route = read(files.settlementRoute)
const artifact = JSON.parse(read(files.json))
const markdown = read(files.markdown)

check('homepage no longer redirects to dashboard', homepage.includes('<HomeBettingPlan />') && !homepage.includes("redirect('/dashboard')"))
check('homepage is betting plan surface', homePlan.includes('data-c1-home-betting-plan="true"') && homePlan.includes("Today&apos;s Betting Plan"))
check('Rent Play section exists and is Official Pick only', homePlan.includes('Rent Play') && homePlan.includes('No Rent Play Today') && homePlan.includes('item.official && item.qualified'))
check('Moneyline section exists', homePlan.includes('Moneyline Bet') && homePlan.includes("item.market.toLowerCase().includes('moneyline')"))
check('Parlay Builder has client toggles and live metrics', homePlan.includes('Parlay Builder') && homePlan.includes('type="checkbox"') && homePlan.includes('const probability = selected.reduce') && homePlan.includes('const confidence = selected.length') && homePlan.includes('const ev = selected.length'))
check('Best Opportunity excludes AVOID and DO NOT ACT recommendation copy', homePlan.includes("!/avoid|do not act/i.test(item.reason)") && homePlan.includes('No Qualified Opportunity Today'))
check('homepage uses existing Today API only', homePlan.includes("fetch('/api/dashboard/today'") && !/fetch\([^)]*(generate|execute|settle|sync|cron|refresh|provider)/i.test(homePlan))
check('dedicated tabs move non-critical areas', ['Most Likely', 'Best Value', 'Performance', 'Sports', 'Operations', 'Data Coverage'].every((label) => homePlan.includes(label)))
check('visual betting metrics exist', ['MetricBar', 'StatusChip', 'Probability', 'Confidence', 'Edge', 'Freshness'].every((token) => homePlan.includes(token)))

const settleBranch = operatingDay.match(/action === 'settle'[\s\S]*?} else if \(action === 'replay'\)/)?.[0] ?? ''
check('automatic settlement is no longer prospective-only', settleBranch.includes('prospectiveOnly: false') && !settleBranch.includes('prospectiveOnly: true'))
check('run-line settlement grades with spread semantics', operatingDay.includes("if (market === 'spread')") && operatingDay.includes("if (market === 'run_line' || market === 'run line')"))
check('settlement summary records blocked reasons', operatingDay.includes('blockedRows') && operatingDay.includes('AUTHORITATIVE_RESULT_MISSING') && operatingDay.includes('UNSUPPORTED_OR_UNGRADABLE_MARKET') && operatingDay.includes('ODDS_MISSING_FOR_PROFIT_ACCOUNTING'))
const effectiveNextActionBranch = adaptiveRefresh.match(/const effectiveNextAction = dueDomains\.includes\('settlement'\)[\s\S]*?const totalEstimatedProviderCalls/)?.[0] ?? ''
const executableActionBranch = adaptiveRefresh.match(/function executableActionFromStatus[\s\S]*?function isSupportedAdaptiveAction/)?.[0] ?? ''
check('settlement due action preempts provider-backed odds refresh', effectiveNextActionBranch.includes("? 'settle'") && executableActionBranch.indexOf("dueDomains.includes('settlement')") < executableActionBranch.indexOf("dueDomains.includes('results')"))
check('settlement guarantee service reuses canonical classifier', guarantee.includes('classifyCanonicalSettlementState') && guarantee.includes('canonicalPendingReason'))
check('completed rows classify settled ready or blocked', guarantee.includes("state === 'SETTLED'") && guarantee.includes("state === 'READY_FOR_SETTLEMENT'") && guarantee.includes("state.startsWith('BLOCKED:')"))
check('silent pending is explicitly counted', guarantee.includes('silentPendingRows') && guarantee.includes('readyForSettlementRows'))
check('settlement guarantee monitor route exists', route.includes('getSettlementGuaranteeStatus') && route.includes('includeValidation'))
const mutationPattern = new RegExp('POST|PUT|PATCH|DELETE|\\.update\\(|\\.insert\\(|\\.upsert\\(|\\.delete\\(')
check('monitor route is read-only', !mutationPattern.test(route + guarantee))
check('learning and performance flow documented', guarantee.includes('settledRowsAvailableForLearning') && guarantee.includes('settledRowsAvailableForPerformance') && markdown.includes('automatic model training is not enabled'))
check('artifact records both goals implemented', artifact.goals.homepageBettingExperience.implemented === true && artifact.goals.settlementGuarantee.implemented === true)
check('artifact records no formula or policy changes', artifact.safety.predictionFormulaChanged === false && artifact.safety.officialPickPolicyChanged === false && artifact.safety.automaticModelTrainingEnabled === false)
check('artifact records zero provider calls', artifact.safety.providerCallsIntroduced === 0 && artifact.safety.providerCreditsUsed === 0)

const staged = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean)
check('known unrelated files are not staged', knownUnrelated.every((file) => !staged.includes(file)), staged.join(', '))

const result = {
  generatedAt: new Date().toISOString(),
  baselineCommit: artifact.baselineCommit,
  verdict: checks.every((item) => item.passed)
    ? 'PICK_ANALYZER_V2_PHASE_C1_DAILY_BETTING_SETTLEMENT_PASS'
    : 'PICK_ANALYZER_V2_PHASE_C1_DAILY_BETTING_SETTLEMENT_FAIL',
  checks: checks.length,
  passed: checks.filter((item) => item.passed).length,
  failed: checks.filter((item) => !item.passed).length,
  failedChecks: checks.filter((item) => !item.passed),
  safety: artifact.safety,
}

console.log(JSON.stringify(result, null, 2))
if (!checks.every((item) => item.passed)) process.exit(1)
