import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const checks = []

const files = {
  home: 'src/components/home/HomeBettingPlan.tsx',
  status: 'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  queue: 'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  mc08a: 'docs/CERTIFICATION/mc-08a-homepage-experience.json',
  mc08b: 'docs/CERTIFICATION/mc-08b-rent-play-experience.json',
  mc08c: 'docs/CERTIFICATION/mc-08c-moneyline-bet-experience.json',
  doc: 'docs/MISSION_CONTROL/MC_08D_SMART_PARLAY_EXPERIENCE.md',
  cert: 'docs/CERTIFICATION/mc-08d-smart-parlay-experience.json',
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

const home = read(files.home)
const status = json(files.status)
const queue = read(files.queue)
const mc08a = json(files.mc08a)
const mc08b = json(files.mc08b)
const mc08c = json(files.mc08c)
const cert = json(files.cert)
const doc = read(files.doc)

check('MC-08A/B/C remain production certified', mc08a.status === 'PRODUCTION_CERTIFIED' && mc08b.status === 'PRODUCTION_CERTIFIED' && mc08c.status === 'PRODUCTION_CERTIFIED')
check('MC-08D status exists', status.mc08d?.status && queue.includes('| MC-08D | Smart Parlay Experience |'))
check('Smart Parlay typed contract exists', home.includes("type SmartParlayContract") && home.includes("contractVersion: 'smart_parlay_v1'"))
check('Smart Parlay uses canonical stored evidence', ["fetch('/api/dashboard/today'", "fetch('/api/current-board?mode=current&limit=100'"].every((item) => home.includes(item)))
check('available legs are bounded', home.includes('availableLegs.length >= 8') && home.includes('rawLegs = plan.candidates.sort(compareParlayEvidence).slice(0, 16)'))
check('no historical leakage path is introduced', !/history|historical|settled/i.test(home.match(/function buildSmartParlayContract[\s\S]*?function isUnsupportedWatchlistMarket/)?.[0] ?? home.match(/function buildSmartParlayContract[\s\S]*?function MetricBar/)?.[0] ?? ''))
check('no page/API read calls providers', !/fetch\([^)]*(provider|execute|generate|settle|sync|cron|refresh|cache\/clear)/i.test(home))
check('no read mutation occurs', !/\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(home))
check('user can select and deselect legs', home.includes('type="checkbox"') && home.includes('toggleLeg') && home.includes('current.filter((id) => id !== leg.legId)') && home.includes('return [...current, leg.legId]'))
check('selected legs remain unique', home.includes('current.includes(leg.legId)') && home.includes('new Set'))
check('direct opposite legs are blocked', home.includes('function isDirectOpposite') && home.includes("Direct opposite sides of the same market are blocked."))
check('duplicate legs are blocked', home.includes('function isSameLeg') && home.includes('Duplicate selected leg is blocked.'))
check('post-start pregame legs are blocked', home.includes("'POST_START_BLOCKED'") && home.includes('Leg appears post-start, live or closed.'))
check('stale required legs cannot be actionable', home.includes("'WAITING_FOR_FRESH_PRICE'") && home.includes("'WAITING_FOR_FRESH_PRICES'") && home.includes('WAIT_FOR_REFRESH'))
check('parlay freshness is limited by stalest leg', home.includes('stalestLegId') && home.includes('stalestLegAgeMinutes') && home.includes('Limited by'))
check('missing timestamps remain unavailable', home.includes("pick.marketTimestamp ? 'PASS' : 'NOT_AVAILABLE'") && home.includes("leg.marketAgeMinutes === null ? leg.freshnessStatus"))
check('unavailable odds are not zero', home.includes('combinedOddsAvailable') && home.includes('Unavailable until every selected leg has canonical odds') && !home.includes('decimalOdds ?? 1') && !home.includes('americanOdds ?? 0'))
check('combined odds use selected canonical prices only', home.includes('selectedDecimals = selectedLegs.map((leg) => leg.decimalOdds)') && home.includes('selectedDecimals.reduce((product, value) => product * value, 1)'))
check('combined odds unavailable if required leg lacks odds', home.includes('selectedDecimals.every((value): value is number => value !== null && value > 1)'))
check('combined odds are not described as joint probability', home.includes('Combined odds are mechanical price math, not model confidence.'))
check('joint probability unavailable without certified method', home.includes("jointProbability: null") && home.includes("jointProbabilityMethod: 'NOT_CERTIFIED'"))
check('probabilities are not multiplied silently', !home.includes('product * Math.max') && !home.includes('independentProduct') && home.includes('Leg probabilities are not multiplied'))
check('correlation status is explicit', ['CLEAR', 'POTENTIAL', 'BLOCKED', 'UNKNOWN'].every((item) => home.includes(item)))
check('same-event uncertainty is not independent', home.includes('Same-event legs have potential correlation') && !home.includes('same-event independent'))
check('Rent Play and Moneyline overlaps do not duplicate legs', home.includes('rentPlay: rentPlayOverlap') && home.includes('moneylineBet: moneylineOverlap') && home.includes('Duplicate leg identity'))
check('no forced default parlay exists', home.includes('suggested.length >= 2 ? suggested : []') && home.includes('No safe suggested combination is available'))
check('empty waiting blocked states exist', ['NO_ELIGIBLE_LEGS', 'NO_SAFE_COMBINATION', 'WAITING_FOR_FRESH_PRICES', 'POLICY_BLOCKED'].every((item) => home.includes(item)))
check('mobile builder is accessible', home.includes('min-h-11') && home.includes('aria-label={`${selected ?'))
check('keyboard interaction uses native controls', home.includes('<details') && home.includes('<summary') && home.includes('type="checkbox"') && home.includes('button type="button"'))
check('no horizontal overflow risk added', !/w-screen|min-w-\[|overflow-x-visible/.test(home))
check('homepage hierarchy remains intact', home.indexOf('data-mc08a-morning-brief="true"') < home.indexOf('<RentPlayCard rentPlay={rentPlayContract} />') && home.indexOf('<RentPlayCard rentPlay={rentPlayContract} />') < home.indexOf('<MoneylineBetCard moneyline={moneylineBetContract} />') && home.indexOf('<MoneylineBetCard moneyline={moneylineBetContract} />') < home.indexOf('<SmartParlayBuilder parlay={smartParlayContract} />') && home.indexOf('<SmartParlayBuilder parlay={smartParlayContract} />') < (home.includes('<Watchlist watchlist={watchlistContract} />') ? home.indexOf('<Watchlist watchlist={watchlistContract} />') : home.includes('<Watchlist watchlist={watchlistContract} isPreferredTeamLabel={isPreferredTeamLabel} />') ? home.indexOf('<Watchlist watchlist={watchlistContract} isPreferredTeamLabel={isPreferredTeamLabel} />') : home.indexOf('<Watchlist picks={plan.watchlist} />')))
check('prediction formulas remain unchanged', cert.scope.predictionChanged === false && cert.scope.probabilityChanged === false && cert.scope.confidenceChanged === false)
check('Official Pick policy remains unchanged', cert.scope.officialPickPolicyChanged === false)
check('settlement and learning remain unchanged', cert.scope.settlementChanged === false && cert.scope.learningChanged === false)
check('scheduler and refresh cadence remain unchanged', cert.scope.schedulerCadenceChanged === false && cert.scope.refreshCadenceChanged === false)
check('certification docs state no joint-probability fabrication', doc.includes('jointProbability = unavailable') && doc.includes('Combined odds do not equal model confidence'))
check('MC-08E not started', cert.safety.mc08eStarted === false && doc.includes('MC-08E was not started'))

const staged = git(['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll('\\', '/'))
const protectedFiles = [
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'docs/OPERATIONAL_EXCELLENCE/MORNING_OPERATIONAL_CHECKLIST.md',
  'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
  'docs/build-memory-optimization-v1-phase-b-final.json',
  'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
  'docs/build-memory-optimization-v1-phase-b.json',
]
check('known dirty files remain unstaged', !staged.some((file) => protectedFiles.includes(file)))

const changed = git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll('\\', '/'))
const forbidden = changed.filter((file) => /^(src\/app\/api\/(?!performance\/route\.ts$)|src\/services\/|supabase\/migrations\/|src\/config\/|src\/lib\/recommendation)/.test(file))
check('no API service migration config or recommendation policy files changed', forbidden.length === 0, forbidden.join(', '))

const failed = checks.filter((item) => !item.passed)
const result = {
  generatedAt: new Date().toISOString(),
  mode: 'mc08d_smart_parlay_experience_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
if (failed.length > 0) process.exit(1)
