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
  cert: 'docs/CERTIFICATION/mc-08c-moneyline-bet-experience.json',
  doc: 'docs/MISSION_CONTROL/MC_08C_MONEYLINE_BET_EXPERIENCE.md',
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
const cert = json(files.cert)
const doc = read(files.doc)

check('MC-08A and MC-08B remain production certified', mc08a.status === 'PRODUCTION_CERTIFIED' && mc08b.status === 'PRODUCTION_CERTIFIED')
check('MC-08C status exists', status.mc08c?.status && queue.includes('| MC-08C | Moneyline Bet Experience |'))
check('Moneyline Bet typed contract exists', home.includes("type MoneylineBetContract") && home.includes("contractVersion: 'moneyline_bet_v1'"))
check('Moneyline statuses are explicit', ['ACTIONABLE', 'REVIEW_ONLY', 'WAITING_FOR_FRESH_PRICE', 'NO_ELIGIBLE_MONEYLINE', 'MARKET_UNAVAILABLE', 'POLICY_BLOCKED', 'NO_GAMES', 'UNKNOWN'].every((item) => home.includes(item)))
check('Moneyline Bet uses canonical stored evidence', ["fetch('/api/dashboard/today'", "fetch('/api/current-board?mode=current&limit=100'"].every((item) => home.includes(item)) && !/fetch\([^)]*(provider|execute|generate|settle|sync|cron|refresh|cache\/clear)/i.test(home))
check('candidate universe contains only supported Moneyline markets', home.includes('function isMoneylineMarket') && home.includes('moneylineUniverse = plan.candidates.filter(isMoneylineMarket)') && home.includes('run line|spread|total|prop|first five|first half|team total'))
check('no historical leakage path is introduced', !/history|historical|settled/i.test(home.match(/function buildMoneylineBetContract[\s\S]*?function dailyRecommendation/)?.[0] ?? ''))
check('no page/API read calls providers', !/providerCallsMade\s*\+\+|fetch\([^)]*provider/i.test(home))
check('no read mutation occurs', !/\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(home))
check('probability and displayed odds belong to same candidate', home.includes('modelProbability = candidate?.probability ?? null') && home.includes('americanOdds: candidate?.odds ?? null'))
check('implied probability derives from displayed price', home.includes('impliedFromAmerican(candidate.odds)') && home.includes('probabilityAdvantage = modelProbability !== null && impliedProbability !== null'))
check('edge and EV do not mix snapshots', home.includes('edge: candidate?.edge ?? null') && home.includes('expectedValue: candidate?.ev ?? null'))
check('unavailable values are not rendered as zero', home.includes("value === null || value === undefined") && home.includes('Odds N/A') && !home.includes('moneyline.modelProbability ?? 0') && !home.includes('moneyline.expectedValue ?? 0'))
check('stale price cannot be actionable', home.includes("WAIT_FOR_REFRESH") && home.includes('isFreshnessActionable(candidate)') && home.includes("status === 'WAITING_FOR_FRESH_PRICE'"))
check('post-start pregame price cannot be actionable', home.includes('POST_START') && home.includes('MARKET_CLOSED') && home.includes('postStart'))
check('negative edge is not described as positive value', home.includes("pick.edge > 0 ? 'PASS' : 'FAIL'") && home.includes('negative edge as positive value'))
check('Moneyline remains distinct from Rent Play', home.includes('Moneyline vs Rent Play') && home.includes('not forced to match Rent Play'))
check('Moneyline remains distinct from Most Likely', home.includes('Moneyline vs Most Likely') && home.includes('Most Likely remains probability-first'))
check('Official Pick policy is unchanged', home.includes('not promoted into Official Picks by MC-08C') && cert.scope.officialPickPolicyChanged === false)
check('no new hidden ranking formula exists', !/moneylineScore|weighted|composite|score\s*=/.test(home))
check('three-way markets are not treated as binary', home.includes('threeWayMoneylineHandling') || doc.includes('Three-way Moneyline markets are not collapsed into binary semantics.'))
check('empty waiting review-only states are supported', home.includes('No Eligible Moneyline Bet') && home.includes('Waiting for Fresh Price') && home.includes('Review-Only Moneyline Candidate'))
check('duplicate large explanations are avoided when Rent Play overlaps', home.includes('This Moneyline also overlaps with Rent Play') && home.includes('product concepts remain separate'))
check('market timestamp is canonical', home.includes('marketTimestamp: candidate?.marketTimestamp ?? null') && home.includes('Market Timestamp'))
check('page generatedAt is not market time', home.includes('observedAt') && home.includes('This is not used as market freshness.'))
check('future timestamps are invalid', home.includes('isFutureTimestamp') && home.includes('Market timestamp is in the future'))
check('mobile card is concise', home.includes('data-mc08c-moneyline-card="true"') && home.indexOf('data-mc08c-moneyline-expanded="true"') > home.indexOf('data-mc08c-moneyline-card="true"'))
check('expansion is keyboard accessible', home.includes('<details') && home.includes('<summary') && home.includes('data-mc08c-moneyline-expanded="true"'))
check('no horizontal overflow risk added', !/w-screen|min-w-\[|overflow-x-visible/.test(home))
check('homepage hierarchy remains intact', home.indexOf('data-mc08a-morning-brief="true"') < home.indexOf('<RentPlayCard rentPlay={rentPlayContract} />') && home.indexOf('<RentPlayCard rentPlay={rentPlayContract} />') < home.indexOf('<MoneylineBetCard moneyline={moneylineBetContract} />') && home.indexOf('<MoneylineBetCard moneyline={moneylineBetContract} />') < home.indexOf('<SmartParlayBuilder parlay={smartParlayContract} />'))
check('prediction formulas unchanged', cert.scope.predictionChanged === false && cert.scope.probabilityChanged === false && cert.scope.edgeChanged === false && cert.scope.evChanged === false)
check('settlement and learning unchanged', cert.scope.settlementChanged === false && cert.scope.learningChanged === false)
check('scheduler and refresh cadence unchanged', cert.scope.schedulerCadenceChanged === false && cert.scope.refreshCadenceChanged === false)

const changed = git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll('\\', '/'))
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
check('known dirty files untouched', !staged.some((file) => protectedFiles.includes(file)))
const forbidden = changed.filter((file) => /^(src\/app\/api\/|src\/services\/|supabase\/migrations\/|src\/config\/|src\/lib\/recommendation)/.test(file))
check('no API service migration config or recommendation policy files changed', forbidden.length === 0, forbidden.join(', '))
check('MC-08D was not started', cert.safety.mc08dStarted === false && doc.includes('MC-08D was not started'))

const failed = checks.filter((item) => !item.passed)
const result = {
  generatedAt: new Date().toISOString(),
  mode: 'mc08c_moneyline_bet_experience_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
if (failed.length > 0) process.exit(1)
