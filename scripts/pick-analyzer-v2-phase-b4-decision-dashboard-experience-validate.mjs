import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const checks = []

const files = {
  panel: 'src/components/dashboard/TodayDecisionPanel.tsx',
  shell: 'src/components/dashboard/DashboardShell.tsx',
  b4Json: 'docs/pick-analyzer-v2-phase-b4-decision-dashboard-experience.json',
  b4Markdown: 'docs/PICK_ANALYZER_V2_PHASE_B4_DECISION_DASHBOARD_EXPERIENCE.md',
  b3Json: 'docs/pick-analyzer-v2-phase-b3-best-opportunity-readiness.json',
  b3Validator: 'scripts/pick-analyzer-v2-phase-b3-best-opportunity-readiness-validate.mjs',
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

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

for (const file of Object.values(files)) check(`input exists: ${file}`, fs.existsSync(filePath(file)))

const panel = read(files.panel)
const shell = read(files.shell)
const artifact = JSON.parse(read(files.b4Json))
const markdown = read(files.b4Markdown)

check('B4 decision cockpit marker exists', panel.includes('data-b4-decision-cockpit="true"'))
check('large verdict hero exists', panel.includes('data-b4-verdict-hero="true"') && panel.includes('text-6xl') && panel.includes('md:text-7xl'))
check('best opportunity hero exists', panel.includes('data-b4-best-opportunity-hero="true"') && panel.includes('Today&apos;s Best Opportunity'))
check('compact metrics are visualized', panel.includes('data-b4-compact-metrics="true"') && panel.includes('PremiumMetric') && panel.includes('data-b3-evidence-graphics="true"'))
check('why and risks are max-three card sections', panel.includes('InsightGrid title="Why"') && panel.includes('InsightGrid title="Risks"') && panel.includes('items.slice(0, 3)'))
check('readiness progress is visual and non-table', panel.includes('data-b4-readiness-progress="true"') && panel.includes('readinessPercent(readiness)') && !panel.includes('<table'))
check('alternatives are limited and link to existing routes', panel.includes('data-b4-alternatives-preview="true"') && panel.includes('/most-likely') && panel.includes('/best-value') && panel.includes('cards.slice(0, 6)'))
check('performance snapshot exists and uses existing product route', panel.includes('data-b4-performance-snapshot="true"') && panel.includes("fetch('/api/performance'") && panel.includes('Open Performance -&gt;'))
check('advanced evidence remains outside Today and collapsed via existing component', markdown.includes('Advanced: remains collapsed') && artifact.experienceSections.includes('advanced_collapsed'))
check('mobile bottom navigation exists', shell.includes('data-b4-mobile-bottom-nav="true"') && shell.includes('Primary mobile navigation') && shell.includes('productNavGroups[0].items'))
check('primary B2/B3 compatibility markers remain', ['data-b2-today-shell', 'data-b2-best-opportunity', 'data-b2-readiness-shell', 'data-b3-best-opportunity-readiness'].every((marker) => panel.includes(marker)))
check('no new formulas or thresholds introduced', !new RegExp('minimumOfficial|minimumConfidence|minimumEdge|minimumEv|RECOMMENDATION_THRESHOLDS|conviction.*score|score\\s*/\\s*10', 'i').test(panel))
check('no sportsbook or casino styling copy', !/(casino|parlay boost|same game parlay|risk free|sportsbook style)/i.test(panel + markdown))
check('no provider imports or mutation route fetches', !/from ['"]@\/services\/.*provider|from ['"]@\/services\/.*odds-api/i.test(panel + shell) && !/fetch\([^)]*(execute|generate|settle|sync|cron|refresh|cache\/clear)/i.test(panel))
check('artifact records presentation-only safety', artifact.logicSafety?.businessLogicChanged === false && artifact.logicSafety?.officialPickPolicyChanged === false && artifact.apiSafety?.databaseMutations === 0)
check('artifact records no later phase started', ['B5', 'B6', 'B7', 'B8'].every((phase) => Object.hasOwn(artifact.deferredWork, phase)) && markdown.includes('B5:'))

const staged = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean)
check('unrelated dirty files are not staged', knownUnrelated.every((file) => !staged.includes(file)), staged.join(', '))

const result = {
  generatedAt: new Date().toISOString(),
  baselineCommit: artifact.baselineCommit,
  verdict: checks.every((item) => item.passed)
    ? 'PICK_ANALYZER_V2_PHASE_B4_DECISION_DASHBOARD_EXPERIENCE_PASS'
    : 'PICK_ANALYZER_V2_PHASE_B4_DECISION_DASHBOARD_EXPERIENCE_FAIL',
  checks: checks.length,
  passed: checks.filter((item) => item.passed).length,
  failed: checks.filter((item) => !item.passed).length,
  failedChecks: checks.filter((item) => !item.passed),
  safety: artifact.apiSafety,
}

console.log(JSON.stringify(result, null, 2))
if (!checks.every((item) => item.passed)) process.exit(1)
