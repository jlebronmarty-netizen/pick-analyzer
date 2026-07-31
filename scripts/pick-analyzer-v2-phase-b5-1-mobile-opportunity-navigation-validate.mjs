import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const checks = []

const files = {
  shell: 'src/components/dashboard/DashboardShell.tsx',
  today: 'src/components/dashboard/TodayDecisionPanel.tsx',
  json: 'docs/pick-analyzer-v2-phase-b5-1-mobile-opportunity-navigation.json',
  markdown: 'docs/PICK_ANALYZER_V2_PHASE_B5_1_MOBILE_OPPORTUNITY_NAVIGATION.md',
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

for (const file of Object.values(files)) {
  check(`input exists: ${file}`, fs.existsSync(filePath(file)))
}

const shell = read(files.shell)
const today = read(files.today)
const artifact = JSON.parse(read(files.json))
const markdown = read(files.markdown)

const primaryGroup = shell.match(/label: 'Primary',[\s\S]*?items: \[([\s\S]*?)\],\s*\},\s*\{\s*label: 'Opportunities'/)
const primaryItemCount = primaryGroup ? (primaryGroup[1].match(/label: '/g) ?? []).length : 0

check('exactly five or fewer primary bottom-nav items', primaryItemCount > 0 && primaryItemCount <= 5, String(primaryItemCount))
check('visible Opportunities primary item exists', shell.includes("label: 'Opportunities'") && shell.includes('data-b5-1-mobile-opportunities-trigger="true"'))
check('mobile opportunity sheet exists', shell.includes('data-b5-1-mobile-opportunity-sheet="true"') && shell.includes('role="dialog"') && shell.includes('aria-modal="true"'))
check('Most Likely reachable through visible mobile UI', shell.includes("label: 'Most Likely'") && shell.includes("href: '/most-likely'") && markdown.includes('Today -> Opportunities -> Most Likely'))
check('Best Value reachable through visible mobile UI', shell.includes("label: 'Best Value'") && shell.includes("href: '/best-value'") && markdown.includes('Today -> Opportunities -> Best Value'))
check('Probability Picks / Official Picks reachable', shell.includes("label: 'Official Picks / Probability Picks'") && shell.includes("href: '/probability-picks'"))
check('Current Board / Watchlist reachable when supported', shell.includes("label: 'Current Board / Watchlist'") && artifact.routeInventory.currentBoardPageRouteExists === false && artifact.routeInventory.currentBoardApiRouteExists === true)
check('Todays Best Opportunity reachable', shell.includes("label: \"Today's Best Opportunity\"") && artifact.accessPaths.todayBestOpportunity.length === 3)
check('all existing page URLs remain unchanged', ['/dashboard', '/probability-picks', '/most-likely', '/best-value', '/performance', '/sports-center'].every((route) => shell.includes(route) || today.includes(route)))
check('no redirect or route deletion introduced', !/redirect\(|permanentRedirect\(|notFound\(/.test(shell))
check('menu closes after navigation and backdrop closes', shell.includes('onClick={() => setOpportunitiesOpen(false)}') && shell.includes('data-b5-1-mobile-opportunity-backdrop="true"'))
check('escape close and focus management present', shell.includes("event.key === 'Escape'") && shell.includes('firstOpportunityLinkRef.current?.focus()') && shell.includes('opportunityButtonRef.current?.focus()'))
check('visible labels not icon-only', artifact.accessibility.visibleTextLabels === true && artifact.accessibility.iconsOnly === false && shell.includes('<span className="block text-sm font-black text-white">{item.label}</span>'))
check('safe-area spacing present', shell.includes('safe-area-inset-bottom') && shell.includes('min-h-14'))
check('desktop navigation markers remain present', shell.includes('xl:block') && shell.includes('data-b4-mobile-bottom-nav="true"') && shell.includes('<SportSelector />'))
check('B2 through B5 Today markers remain present', ['data-b2-today-shell', 'data-b3-best-opportunity-readiness', 'data-b4-decision-cockpit', 'data-b5-ai-explanation'].every((marker) => today.includes(marker)))
check('no API service migration or policy files changed', git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean).every((file) => !/^(src\/app\/api\/|src\/services\/|supabase\/migrations\/|src\/config\/recommendation|src\/lib\/recommendation)/.test(file.replaceAll('\\', '/'))))
check('no provider or mutation path introduced', !/providerCallsMade\s*\+\+|fetch\([^)]*(execute|generate|settle|sync|cron|refresh|cache\/clear)|from ['"]@\/services\/.*provider|from ['"]@\/services\/.*odds-api/i.test(shell))
check('artifact records zero calls and mutations', artifact.safety.providerCallsIntroduced === 0 && artifact.safety.databaseMutations === 0 && artifact.safety.predictionWrites === 0 && artifact.safety.settlementWrites === 0 && artifact.safety.learningWrites === 0)
check('B6 was not started', artifact.b6Started === false && markdown.includes('B6 was not started'))

const staged = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean)
check('unrelated dirty files are not staged', knownUnrelated.every((file) => !staged.includes(file)), staged.join(', '))

const result = {
  generatedAt: new Date().toISOString(),
  baselineCommit: artifact.baselineCommit,
  verdict: checks.every((item) => item.passed)
    ? 'PICK_ANALYZER_V2_PHASE_B5_1_MOBILE_OPPORTUNITY_NAVIGATION_PASS'
    : 'PICK_ANALYZER_V2_PHASE_B5_1_MOBILE_OPPORTUNITY_NAVIGATION_FAIL',
  checks: checks.length,
  passed: checks.filter((item) => item.passed).length,
  failed: checks.filter((item) => !item.passed).length,
  failedChecks: checks.filter((item) => !item.passed),
  safety: artifact.safety,
}

console.log(JSON.stringify(result, null, 2))
if (!checks.every((item) => item.passed)) process.exit(1)
