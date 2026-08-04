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
  cert: 'docs/CERTIFICATION/mc-08b-rent-play-experience.json',
  doc: 'docs/MISSION_CONTROL/MC_08B_RENT_PLAY_EXPERIENCE.md',
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
const cert = json(files.cert)
const doc = read(files.doc)

check('MC-08A remains production certified', mc08a.status === 'PRODUCTION_CERTIFIED' && status.mc08a?.status === 'PRODUCTION_CERTIFIED')
check('MC-08 is the selected parent mission', (status.currentMission?.id === 'MC-08' || status.nextMission?.id === 'MC-08') && queue.includes('| MC-08 | Daily Betting Product Completion'))
check('Rent Play typed contract exists', home.includes("type RentPlayContract") && home.includes("contractVersion: 'rent_play_v1'"))
check('Rent Play statuses are explicit', ['ACTIONABLE', 'WAITING_FOR_FRESH_PRICE', 'NO_ELIGIBLE_PLAY', 'MARKET_UNAVAILABLE', 'POLICY_BLOCKED', 'NO_GAMES', 'UNKNOWN'].every((item) => home.includes(item)))
check('Rent Play uses canonical stored homepage evidence', ["fetch('/api/dashboard/today'", "fetch('/api/current-board?mode=current&limit=100'"].every((item) => home.includes(item)) && !/fetch\([^)]*(provider|execute|generate|settle|sync|cron|refresh|cache\/clear)/i.test(home))
check('no mutation or provider call path introduced', !/\.insert\(|\.upsert\(|\.update\(|\.delete\(|providerCallsMade\s*\+\+|from ['"]@\/services\//.test(home))
check('actionable binary probability must be above 50', home.includes("Number(candidate?.probability ?? 0) > 50") && home.includes("probability > 50 ? 'PASS' : 'FAIL'"))
check('stale price cannot be actionable', home.includes("WAIT_FOR_REFRESH") && home.includes("STALE") && home.includes("isFreshnessActionable"))
check('post-start market cannot be actionable', home.includes("POST_START") && home.includes("MARKET_CLOSED"))
check('negative edge cannot be safest actionable', home.includes("edge > 0 ? 'PASS' : 'FAIL'") && home.includes('negative-edge candidate'))
check('unavailable EV is not rendered as zero', home.includes("ev === null ? 'NOT_AVAILABLE'") && home.includes('signedPct(rentPlay.expectedValue)') && !home.includes('rentPlay.expectedValue ?? 0'))
check('unavailable probability is not rendered as zero', home.includes("probability === null ? 'NOT_AVAILABLE'") && home.includes("value === null || value === undefined") && !home.includes('rentPlay.modelProbability ?? 0'))
check('Most Likely remains distinct from Rent Play', home.includes('Most Likely Distinction') && home.includes('Most Likely is the highest modeled probability'))
check('Official Pick policy remains distinct', home.includes('Official Pick Distinction') && home.includes('not promoted into Official Picks'))
check('no new hidden ranking formula is introduced', !/rentPlayScore|safetyScore|score\s*=\s*|weighted/i.test(home))
check('empty/waiting/candidate states are supported', (home.includes('No Rent Play Today') || home.includes('No Current Rent Play Evidence')) && home.includes('Waiting for fresh price') && (home.includes('Best Available Candidate - Not Rent Play') || home.includes('Best Rent Play Candidate')))
check('readiness gates use approved statuses', ['PASS', 'FAIL', 'PENDING', 'NOT_AVAILABLE'].every((item) => home.includes(item)))
check('market timestamp comes from candidate stored evidence', home.includes('marketTimestamp: candidate?.marketTimestamp ?? null') && home.includes('Last Market Update'))
check('page-generated time is not market freshness', home.includes('observedAt') && home.includes('marketAgeMinutesFromCanonicalTimestamp') && home.includes('This is not used as market freshness.'))
check('future timestamp is invalid', home.includes('isFutureTimestamp') && home.includes('Market timestamp is in the future'))
check('collapsed mobile card is concise', home.includes('data-mc08b-rent-play-card="true"') && home.indexOf('data-mc08b-rent-play-expanded="true"') > home.indexOf('data-mc08b-rent-play-card="true"'))
check('expanded evidence is keyboard accessible', home.includes('<details') && home.includes('<summary') && home.includes('data-mc08b-rent-play-expanded="true"'))
check('homepage hierarchy remains intact', home.indexOf('data-mc08a-morning-brief="true"') < home.indexOf('<RentPlayCard rentPlay={rentPlayContract} />') && home.indexOf('<RentPlayCard rentPlay={rentPlayContract} />') < home.indexOf('<MoneylineBetCard moneyline={moneylineBetContract} />') && home.indexOf('data-mc08a-smart-parlay="true"') < home.indexOf('data-mc08a-watchlist="true"'))
check('prediction and policy changes are recorded false', cert.scope.predictionChanged === false && cert.scope.officialPickPolicyChanged === false && cert.scope.predictionRankingChanged === false)
check('settlement learning scheduler changes recorded false', cert.scope.settlementChanged === false && cert.scope.learningChanged === false && cert.scope.schedulerCadenceChanged === false && cert.scope.refreshCadenceChanged === false)
check('known dirty files untouched by staged diff', !git(['diff', '--cached', '--name-only']).split(/\r?\n/).some((file) => ['src/app/login/page.tsx', 'src/app/register/page.tsx'].includes(file)))
check('MC-08C was not started', cert.safety.mc08cStarted === false && doc.includes('MC-08C was not started'))

const changed = git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll('\\', '/'))
const forbidden = changed.filter((file) => /^(src\/app\/api\/(?!performance\/route\.ts$)|src\/services\/|supabase\/migrations\/|src\/config\/|src\/lib\/recommendation)/.test(file))
check('no API service migration config or recommendation policy files changed', forbidden.length === 0, forbidden.join(', '))

const failed = checks.filter((item) => !item.passed)
const result = {
  generatedAt: new Date().toISOString(),
  mode: 'mc08b_rent_play_experience_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
if (failed.length > 0) process.exit(1)
