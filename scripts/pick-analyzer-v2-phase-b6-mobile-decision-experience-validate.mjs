import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const checks = []

const files = {
  today: 'src/components/dashboard/TodayDecisionPanel.tsx',
  shell: 'src/components/dashboard/DashboardShell.tsx',
  advanced: 'src/components/dashboard/AdvancedEvidenceDisclosure.tsx',
  json: 'docs/pick-analyzer-v2-phase-b6-mobile-decision-experience.json',
  markdown: 'docs/PICK_ANALYZER_V2_PHASE_B6_MOBILE_DECISION_EXPERIENCE.md',
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

const today = read(files.today)
const shell = read(files.shell)
const advanced = read(files.advanced)
const artifact = JSON.parse(read(files.json))
const markdown = read(files.markdown)

const primaryGroup = shell.match(/label: 'Primary',[\s\S]*?items: \[([\s\S]*?)\],\s*\},\s*\{\s*label: 'Opportunities'/)
const primaryItemCount = primaryGroup ? (primaryGroup[1].match(/label: '/g) ?? []).length : 0

check('five or fewer bottom-nav items', primaryItemCount > 0 && primaryItemCount <= 5, String(primaryItemCount))
check('Opportunities navigation preserved', shell.includes('data-b5-1-mobile-opportunities-trigger="true"') && shell.includes('data-b5-1-mobile-opportunity-sheet="true"'))
check('sticky verdict mobile-only', today.includes('data-b6-sticky-verdict-strip="true"') && today.includes('md:hidden') && today.includes('sticky top-'))
check('best opportunity hero has mobile marker and wrapping', today.includes('data-b6-mobile-best-opportunity-hero="true"') && today.includes('break-words text-3xl'))
check('compact conviction and actionability present', today.includes('data-b6-compact-conviction-actionability="true"') && today.includes('line-clamp-2') && today.includes('data-b5-conviction-card="true"') && today.includes('data-b5-actionability-card="true"'))
check('no numeric Conviction or Actionability scores', !/convictionScore|actionabilityScore|score\s*\/\s*10|0-10|1-10/i.test(today))
check('mobile segmented details exist', today.includes('data-b6-mobile-decision-segments="true"') && today.includes('role="tablist"') && today.includes('role="tab"') && today.includes('role="tabpanel"'))
check('Why Risks Readiness remain accessible', ['Why', 'Risks', 'Readiness'].every((label) => today.includes(`label: '${label}'`) || today.includes(`label: "${label}"`)))
check('risk blocker remains summarized outside selected segment', today.includes('data-b6-risk-summary="true"') && today.includes("actionability.state === 'DO NOT ACT'"))
check('readiness rows stack on mobile', today.includes('sm:flex-row sm:items-center sm:justify-between') && !today.includes('truncate text-xs font-bold text-slate-300">{row.label}'))
const probabilityMetricIndex = today.indexOf('<PremiumMetric label="Probability"')
const impliedMetricIndex = today.indexOf('<PremiumMetric label="Implied"')
check('primary metrics prioritized and compact', today.includes('data-b6-primary-metrics="true"') && probabilityMetricIndex >= 0 && impliedMetricIndex > probabilityMetricIndex && today.includes('grid-cols-2'))
check('no wide core tables on Today', !/<table/i.test(today))
check('alternatives limited on mobile', today.includes('data-b6-mobile-alternatives-preview="true"') && today.includes("index > 2 ? 'hidden md:block'"))
check('Advanced Evidence remains collapsed', advanced.includes('<details') && !advanced.includes('open={true}') && advanced.includes('data-b6-mobile-advanced-evidence="true"'))
check('bottom nav safe-area padding remains', shell.includes('safe-area-inset-bottom') && shell.includes('data-b5-1-mobile-bottom-nav="true"'))
check('known mobile breakpoint classes exist', ['md:hidden', 'md:block', 'md:p-', 'sm:grid-cols-2', 'xl:grid-cols'].every((token) => today.includes(token) || shell.includes(token)))
check('safe-area support exists', shell.includes('env(safe-area-inset-bottom') && today.includes('data-b6-sticky-verdict-strip'))
check('state handling markers exist', today.includes('data-b6-mobile-loading-state="true"') && today.includes('data-b6-mobile-error-state="true"'))
check('desktop non-regression marker exists', today.includes('data-b6-desktop-decision-details="true"') && shell.includes('xl:block'))
check('B2 through B5.1 markers remain', ['data-b2-today-shell', 'data-b3-best-opportunity-readiness', 'data-b4-decision-cockpit', 'data-b5-ai-explanation', 'data-b5-change-mind'].every((marker) => today.includes(marker)) && shell.includes('data-b5-1-mobile-opportunities-trigger'))

const changed = git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll('\\', '/'))
const forbidden = changed.filter((file) => /^(src\/app\/api\/|src\/services\/|supabase\/migrations\/|src\/config\/recommendation|src\/lib\/recommendation)/.test(file))
check('no API service migration or policy files changed', forbidden.length === 0, forbidden.join(', '))
check('no provider or mutation routes introduced', !/providerCallsMade\s*\+\+|fetch\([^)]*(execute|generate|settle|sync|cron|refresh|cache\/clear)|from ['"]@\/services\/.*provider|from ['"]@\/services\/.*odds-api/i.test(today + shell + advanced))
check('artifact records zero calls and mutations', artifact.safety.providerCallsIntroduced === 0 && artifact.safety.databaseMutations === 0 && artifact.safety.predictionWrites === 0 && artifact.safety.settlementWrites === 0 && artifact.safety.learningWrites === 0)
check('B7 was not started', artifact.b7Started === false && markdown.includes('B7 was not started'))

const staged = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean)
check('unrelated dirty files are not staged', knownUnrelated.every((file) => !staged.includes(file)), staged.join(', '))

const result = {
  generatedAt: new Date().toISOString(),
  baselineCommit: artifact.baselineCommit,
  verdict: checks.every((item) => item.passed)
    ? 'PICK_ANALYZER_V2_PHASE_B6_MOBILE_DECISION_EXPERIENCE_PASS'
    : 'PICK_ANALYZER_V2_PHASE_B6_MOBILE_DECISION_EXPERIENCE_FAIL',
  checks: checks.length,
  passed: checks.filter((item) => item.passed).length,
  failed: checks.filter((item) => !item.passed).length,
  failedChecks: checks.filter((item) => !item.passed),
  safety: artifact.safety,
}

console.log(JSON.stringify(result, null, 2))
if (!checks.every((item) => item.passed)) process.exit(1)
