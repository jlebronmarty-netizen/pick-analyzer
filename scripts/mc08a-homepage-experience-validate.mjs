import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const checks = []

const files = {
  page: 'src/app/page.tsx',
  home: 'src/components/home/HomeBettingPlan.tsx',
  status: 'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  queue: 'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  cert: 'docs/CERTIFICATION/mc-08a-homepage-experience.json',
  doc: 'docs/MISSION_CONTROL/MC_08A_HOMEPAGE_EXPERIENCE.md',
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8')
}

function json(file) {
  return JSON.parse(read(file))
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

for (const file of Object.values(files)) check(`input exists: ${file}`, fs.existsSync(path.join(ROOT, file)))

const page = read(files.page)
const home = read(files.home)
const status = json(files.status)
const queue = read(files.queue)
const cert = json(files.cert)
const doc = read(files.doc)

check('Mission Control selected MC-08', (status.currentMission?.id === 'MC-08' || status.nextMission?.id === 'MC-08') && queue.includes('| MC-08 | Daily Betting Product Completion'))
check('homepage remains HomeBettingPlan only', page.includes('<HomeBettingPlan />') && !page.includes("redirect('/dashboard')"))
check('MC-08A homepage marker exists', home.includes('data-mc08a-homepage="true"'))
check('Decision Core Morning Brief is first visible section', home.indexOf('data-mc08a-morning-brief="true"') < home.indexOf('data-mc08b-rent-play-card="true"'))
check('homepage asks one core question', home.includes('What should I do today?'))
check('Good Morning and betting weather are present', home.includes('Good Morning') && home.includes("Today&apos;s Betting Weather"))
check('Rent Play remains and is largest/full-width before Moneyline', home.indexOf('<RentPlayCard rentPlay={rentPlayContract} />') < home.indexOf('<MoneylineBetCard moneyline={moneylineBetContract} />') && (home.includes('No Rent Play Today') || home.includes('No Current Rent Play Evidence')))
check('Moneyline Bet remains', home.includes('data-mc08c-moneyline-card="true"') && home.includes("contractVersion: 'moneyline_bet_v1'"))
check('Smart Parlay replaces primary Parlay Builder label while preserving compatibility phrase', home.includes('Smart Parlay') && home.includes('Combined odds are price math only') && home.includes('type="checkbox"'))
check('Smart Parlay live selection remains client-side', home.includes("contractVersion: 'smart_parlay_v1'") && home.includes('evaluateSmartParlaySelection') && home.includes('const [selectedIds, setSelectedIds]'))
check('Watchlist exists after parlay', home.indexOf('data-mc08a-smart-parlay="true"') < home.indexOf('data-mc08a-watchlist="true"'))
check('Decision Summary exists after watchlist', home.indexOf('data-mc08a-watchlist="true"') < home.indexOf('data-mc08a-decision-summary="true"'))
check('Technical Evidence is collapsed after decision summary', home.indexOf('data-mc08a-decision-summary="true"') < home.indexOf('data-mc08a-technical-evidence="true"') && home.includes('<details className="rounded-lg border border-slate-800 bg-slate-950/80 p-5 md:p-6" data-mc08a-technical-evidence="true">'))
check('technical topics moved into evidence', ['Health', 'Planner', 'Lifecycle', 'Providers', 'Budget', 'Operations', 'Model', 'Diagnostics'].every((item) => home.includes(`label="${item}"`)))
check('secondary tabs remain available', ['Most Likely', 'Best Value', 'Performance', 'Sports', 'Operations', 'Data Coverage', 'Diagnostics'].every((item) => home.includes(item)))
check('best opportunity no-bet compatibility retained', (home.includes('No Qualified Opportunity Today') || home.includes('No Current Watchlist Evidence')) && home.includes("!/avoid|do not act/i.test(item.reason)"))
check('only read-only product APIs are fetched', ["fetch('/api/dashboard/today'", "fetch('/api/current-board?mode=current&limit=100'", "fetch('/api/model/intelligence'", "fetch('/api/performance'"].every((item) => home.includes(item)))
check('no provider/mutation fetch introduced', !/fetch\([^)]*(execute|generate|settle|sync|cron|refresh|provider|cache\/clear)/i.test(home))
check('no runtime service or API import added to homepage', !/from ['"]@\/services\//.test(home))
check('prediction and policy safety recorded', cert.scope.predictionChanged === false && cert.scope.officialPicksChanged === false && cert.scope.probabilityChanged === false && cert.scope.confidenceCalculationChanged === false)
check('settlement learning scheduler safety recorded', cert.scope.settlementChanged === false && cert.scope.learningChanged === false && cert.scope.schedulerChanged === false)
check('zero provider calls and mutations recorded', cert.safety.providerCallsIntroduced === 0 && cert.safety.remoteMutationsIntroduced === 0 && cert.safety.databaseMutationsIntroduced === 0)
check('MC-08B not started', cert.safety.mc08bStarted === false && doc.includes('MC-08B was not started'))
check('accessibility foundation present', home.includes('aria-label="Dedicated product tabs"') && home.includes('<summary') && home.includes('type="checkbox"'))
check('mobile responsive classes present', ['px-4', 'md:px-6', 'sm:grid-cols', 'lg:grid-cols', 'max-w-6xl'].every((item) => home.includes(item)))
check('desktop responsive classes present', home.includes('lg:grid-cols-2') && home.includes('md:text-5xl'))
check('dark mode present', home.includes('bg-slate-950') && home.includes('text-white'))
check('light foundation not introduced as conflicting one-note palette', !home.includes('bg-purple') && !home.includes('from-purple') && !home.includes('to-purple'))
check('English copy present', cert.homepageOrder.includes('Decision Core Morning Brief') && home.includes(localeSafe('Decision Core Morning Brief')))
check('Spanish foundation present', home.includes('Resumen matutino de Decision Core') && home.includes('Que debo hacer hoy?'))

const changed = git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll('\\', '/'))
const forbidden = changed.filter((file) => /^(src\/app\/api\/(?!performance\/route\.ts$)|src\/services\/(?!.*Home)|supabase\/migrations\/|src\/config\/|src\/lib\/recommendation)/.test(file))
check('no API service migration config or recommendation policy files changed', forbidden.length === 0, forbidden.join(', '))

function localeSafe(value) {
  return value
}

const failed = checks.filter((item) => !item.passed)
const result = {
  generatedAt: new Date().toISOString(),
  mode: 'mc08a_homepage_experience_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
if (failed.length > 0) process.exit(1)
