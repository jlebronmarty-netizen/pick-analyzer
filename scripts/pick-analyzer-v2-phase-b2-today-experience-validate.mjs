import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const checks = []

const files = {
  dashboardPage: 'src/app/dashboard/page.tsx',
  shell: 'src/components/dashboard/DashboardShell.tsx',
  todayPanel: 'src/components/dashboard/TodayDecisionPanel.tsx',
  advancedDisclosure: 'src/components/dashboard/AdvancedEvidenceDisclosure.tsx',
  developerGroups: 'src/components/dashboard/DashboardDeveloperGroups.tsx',
  apiRoute: 'src/app/api/dashboard/today/route.ts',
  json: 'docs/pick-analyzer-v2-phase-b2-today-experience.json',
  markdown: 'docs/PICK_ANALYZER_V2_PHASE_B2_TODAY_EXPERIENCE.md',
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

function exists(file) {
  return fs.existsSync(filePath(file))
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

for (const file of Object.values(files)) check(`input exists: ${file}`, exists(file))

const dashboardPage = read(files.dashboardPage)
const shell = read(files.shell)
const todayPanel = read(files.todayPanel)
const advancedDisclosure = read(files.advancedDisclosure)
const developerGroups = read(files.developerGroups)
const apiRoute = read(files.apiRoute)
const artifact = JSON.parse(read(files.json))
const markdown = read(files.markdown)

check('Today is the primary page concept', dashboardPage.includes('TodayDecisionPanel') && dashboardPage.includes('Decision Cockpit'))
check('legacy broad UserTodayPanel is not embedded on Today', !dashboardPage.includes('UserTodayPanel'))
check('Today uses existing dashboard API only', todayPanel.includes("fetch('/api/dashboard/today'") && !todayPanel.includes("fetch('/api/market-opportunities"))
check('Today render path has no provider imports', !/from ['"]@\/services\/.*provider|from ['"]@\/services\/.*odds-api/i.test(todayPanel))
check('Today render path has no mutation route fetch', !/fetch\([^)]*(execute|generate|settle|sync|cron|refresh|cache\/clear)/i.test(todayPanel))
check('verdict labels are limited to BET REVIEW WAIT PASS', ["'BET'", "'REVIEW'", "'WAIT'", "'PASS'"].every((label) => todayPanel.includes(label)) && !/Verdict = .*OFFICIAL/i.test(todayPanel))
check('Best Opportunity shell is present', todayPanel.includes("data-b2-best-opportunity=\"true\"") && todayPanel.includes('Today&apos;s Best Opportunity'))
check('no Best Opportunity is falsely labeled Official', todayPanel.includes("opportunity?.status === 'official' ? 'Official Pick'") && todayPanel.includes('Best Available - Not Official'))
check('no new official thresholds were introduced', !/(confidence|Confidence)\s*[<>]=?\s*80|77 \/ 80|requirements met|Requirements met/i.test(todayPanel))
check('no numeric AI conviction score is introduced', !/conviction.*(1-10|score|\/10)/i.test(todayPanel))
check('AI Conviction shell is placeholder-safe', todayPanel.includes('data-b2-conviction-shell') && todayPanel.includes('B2 does not create a new conviction formula'))
check('Actionability shell is placeholder-safe', todayPanel.includes('data-b2-actionability-shell') && todayPanel.includes('verdict and freshness context'))
check('Official Pick Readiness shell defers structured gates', todayPanel.includes('data-b2-readiness-shell') && todayPanel.includes('deferred to B3'))
check('advanced evidence is collapsed by default', advancedDisclosure.includes('useState(false)') && advancedDisclosure.includes('Show Evidence') && advancedDisclosure.includes('opened ? <div'))
check('existing advanced groups are preserved', dashboardPage.includes('DashboardDeveloperGroups') && developerGroups.includes('Advanced Details'))
check('full Most Likely and Best Value lists are not embedded on Today', !dashboardPage.includes('MostLikelyTool') && !dashboardPage.includes('BestValueTool') && todayPanel.includes('/most-likely') && todayPanel.includes('/best-value'))
check('state handling includes loading', todayPanel.includes('aria-busy="true"') && todayPanel.includes('Loading today'))
check('state handling includes no official pick', todayPanel.includes('No Official Pick') && todayPanel.includes('Best Available - Not Official'))
check('state handling includes no opportunity', todayPanel.includes('No eligible opportunity visible') && todayPanel.includes('does not fabricate'))
check('state handling includes stale wait path', todayPanel.includes("return { label: 'WAIT'") && todayPanel.includes('stale'))
check('state handling includes error state', todayPanel.includes('Today unavailable') && todayPanel.includes('Open Operations'))
check('navigation keeps existing URLs', [
  '/dashboard',
  '/probability-picks',
  '/most-likely',
  '/best-value',
  '/performance',
  '/sports-center',
  '/betting-workbench',
  '/game-intelligence',
  '/market-intelligence',
  '/portfolio-intelligence',
  '/closing-line-intelligence',
  '/ai-operations',
  '/autonomous-daily-ai',
  '/mlb-operations',
  '/data-coverage',
  '/arbitrage',
].every((href) => shell.includes(href)))
check('navigation exposes five primary product concepts', ['Today', 'Opportunities', 'Performance', 'Sports', 'More'].every((label) => shell.includes(`label: '${label}'`)))
check('dashboard API remains lazy existing contract', apiRoute.includes('loadDashboardTodayService') && !/from ['"]@\/services\/.*provider/i.test(apiRoute) && !/export async function (POST|PUT|PATCH|DELETE)/.test(apiRoute))
check('B2 artifact documents no provider calls', artifact.safety?.providerCallsMade === 0 && markdown.includes('0 introduced by B2'))
check('B2 artifact documents no mutations', artifact.safety?.databaseMutations === 0 && artifact.safety?.predictionWrites === 0)

const staged = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean)
check('unrelated dirty files are not staged', knownUnrelated.every((file) => !staged.includes(file)), staged.join(', '))

const finalVerdict = checks.every((item) => item.passed)
  ? 'PICK_ANALYZER_V2_PHASE_B2_TODAY_EXPERIENCE_PASS'
  : 'PICK_ANALYZER_V2_PHASE_B2_TODAY_EXPERIENCE_FAIL'

const result = {
  generatedAt: new Date().toISOString(),
  baselineCommit: artifact.baselineCommit,
  verdict: finalVerdict,
  checks: checks.length,
  passed: checks.filter((item) => item.passed).length,
  failed: checks.filter((item) => !item.passed).length,
  failedChecks: checks.filter((item) => !item.passed),
  safety: artifact.safety,
}

console.log(JSON.stringify(result, null, 2))
if (!checks.every((item) => item.passed)) process.exit(1)
