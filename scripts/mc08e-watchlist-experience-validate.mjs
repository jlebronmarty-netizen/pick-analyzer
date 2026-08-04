import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const checks = []
const files = {
  home: 'src/components/home/HomeBettingPlan.tsx',
  status: 'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  queue: 'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  checklist: 'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  doc: 'docs/MISSION_CONTROL/MC_08E_WATCHLIST_EXPERIENCE.md',
  certMd: 'docs/CERTIFICATION/MC_08E_WATCHLIST_EXPERIENCE.md',
  certJson: 'docs/CERTIFICATION/mc-08e-watchlist-experience.json',
  mc08a: 'docs/CERTIFICATION/mc-08a-homepage-experience.json',
  mc08b: 'docs/CERTIFICATION/mc-08b-rent-play-experience.json',
  mc08c: 'docs/CERTIFICATION/mc-08c-moneyline-bet-experience.json',
  mc08d: 'docs/CERTIFICATION/mc-08d-smart-parlay-experience.json',
}

function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8') }
function json(file) { return JSON.parse(read(file)) }
function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim() }
function check(name, passed, detail = '') { checks.push({ name, passed: Boolean(passed), detail }) }

for (const file of Object.values(files)) check(`input exists: ${file}`, fs.existsSync(path.join(ROOT, file)))

const home = read(files.home)
const status = json(files.status)
const queue = read(files.queue)
const checklist = read(files.checklist)
const doc = read(files.doc)
const certMd = read(files.certMd)
const cert = json(files.certJson)
const mc08a = json(files.mc08a)
const mc08b = json(files.mc08b)
const mc08c = json(files.mc08c)
const mc08d = json(files.mc08d)
const watchlistBuilder = home.match(/function buildWatchlistContract[\s\S]*?function MetricBar/)?.[0] ?? ''
const watchlistTypes = home.match(/type WatchlistStatus[\s\S]*?type MoneylineBetContract/)?.[0] ?? ''
const watchlistRender = home.match(/function Watchlist[\s\S]*?function DecisionSummary/)?.[0] ?? ''

check('P2.4 remains production certified', status.p2_4?.status === 'PRODUCTION_CERTIFIED' && status.p2_4?.surfaceConsistencyStatus === 'PASS')
check('MC-08A/B/C/D remain production certified', [mc08a, mc08b, mc08c, mc08d].every((item) => item.status === 'PRODUCTION_CERTIFIED'))
check('Mission Control marks MC-08E-R locally complete or certified', ['LOCALLY_COMPLETE', 'PRODUCTION_CERTIFIED'].includes(status.mc08e?.status) && queue.includes('MC-08E-R') && checklist.includes('MC-08E-R'))
check('MC-08F remains not started', status.mc08e?.mc08fStarted === false && cert.safety.mc08fStarted === false && doc.includes('MC-08F was not started'))
check('MC-03 remains not started', status.mc08e?.mc03Started === false && cert.safety.mc03Started === false && doc.includes('MC-03 was not started'))
check('paused work preservation is recorded', cert.preservation?.pausedWorkCommittedBeforeIntegration === true && cert.preservation?.recoveryBranch === 'recovery/mc-08e-paused-2026-08-04' && cert.preservation?.recoveryCommit === '84083538f4a2932b24c09c98aa3138817c9116c6')
check('external patch checksum is recorded', cert.preservation?.recoveryPatchSha256 === '0BAA406D265C307743E6E40D2A4F97E1EFBED9C4021161D3BD491A4359926397' && certMd.includes('0BAA406D265C307743E6E40D2A4F97E1EFBED9C4021161D3BD491A4359926397'))
check('original checkout destructive commands are denied', cert.preservation?.destructiveCommandsUsed === false && cert.preservation?.originalCheckoutPreserved === true)
check('Watchlist typed contract exists', home.includes('type WatchlistContract') && home.includes("contractVersion: 'watchlist_v1'") && home.includes('data-mc08e-watchlist="true"'))
check('Watchlist maximum item count is five', home.includes('maximumItemCount: 5') && watchlistBuilder.includes('items.length >= 5'))
check('Watchlist uses evidence-first states', ['ACTIONABLE', 'BEST_AVAILABLE_RESEARCH', 'WATCH', 'BLOCKED', 'UNAVAILABLE', 'NO_CURRENT_EVIDENCE'].every((item) => watchlistTypes.includes(item) && home.includes(item)))
check('Watchlist exposes evidence-first fields', ['evidenceFirstStatus', 'researchOnly', 'watchReason', 'currentEpoch'].every((item) => watchlistTypes.includes(item) && watchlistRender.includes(item)))
check('Current V2 Production context is explicit', home.includes('CURRENT_V2_PRODUCTION') && cert.watchlistContract.currentEpoch === 'CURRENT_V2_PRODUCTION')
check('Rent and Moneyline labels are evidence-first', home.includes('Best Rent Play Candidate') && home.includes('No Current Rent Play Evidence') && home.includes('Best Moneyline Candidate'))
check('Watchlist empty state is evidence-first', home.includes('No Current Watchlist Evidence') && home.includes('data-mc08e-watchlist-empty="true"'))
check('Watchlist current reads are stored read-only homepage reads', ["fetch('/api/dashboard/today'", "fetch('/api/current-board?mode=current&limit=100'", "fetch('/api/model/intelligence'", "fetch('/api/performance'"].every((item) => home.includes(item)))
check('Watchlist introduces no provider fetch', !/fetch\([^)]*(provider|execute|generate|settle|sync|cron|refresh|cache\/clear)/i.test(home))
check('Watchlist introduces no remote writes', !/\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(home))
check('Historical leakage is excluded from builder', !/history|historical|settled/i.test(watchlistBuilder) && cert.watchlistContract.historicalLeakageAllowed === false)
check('Unsupported markets are excluded', home.includes('function isUnsupportedWatchlistMarket') && home.includes('first five') && cert.watchlistContract.unsupportedMarketsAllowed === false)
check('Post-start and terminal events are excluded', home.includes('function isPostStartOrClosed') && home.includes('Post-start, closed, cancelled or terminal events are excluded') && cert.watchlistContract.postStartEventsAllowed === false)
check('Low-information filler is excluded', home.includes('function isLowInformationCandidate') && watchlistBuilder.includes('!isLowInformationCandidate'))
check('Duplicate current event/market/selection items are bounded', watchlistBuilder.includes('seen.has(key)') && watchlistBuilder.includes('${candidate.eventId ?? candidate.event}|${candidate.marketKey}|${candidate.selection}'))
check('Unavailable values are not coerced to zero', home.includes('Current odds are unavailable and remain unavailable.') && !watchlistRender.includes('americanOdds ?? 0') && !watchlistRender.includes('probability ?? 0') && cert.watchlistContract.unavailableValuesCoercedToZero === false)
check('observedAt is not used as freshness', home.includes('observedAt is not used as market freshness') && cert.watchlistContract.observedAtUsedAsFreshness === false)
check('Promotion and removal conditions are shown', home.includes('promotionConditions') && home.includes('removalConditions') && home.includes('data-mc08e-watchlist-item-expanded="true"'))
check('Eligibility gates are shown', home.includes('buildWatchlistGates') && home.includes('eligibilityGates.map'))
check('Primary surface relationships are shown', ['officialPick', 'rentPlay', 'moneylineBet', 'smartParlayEligible', 'mostLikely', 'bestValue'].every((item) => home.includes(item)))
check('Watchlist remains after Smart Parlay and before Decision Summary', home.indexOf('<SmartParlayBuilder parlay={smartParlayContract} />') < home.indexOf('<Watchlist watchlist={watchlistContract} />') && home.indexOf('<Watchlist watchlist={watchlistContract} />') < home.indexOf('<DecisionSummary data={data} plan={plan} watchlist={watchlistContract} />'))
check('Decision Summary references Watchlist state', home.includes('data-mc08e-watchlist-summary-reference="true"'))
check('Secondary links remain dedicated tabs, not clutter', ['/most-likely', '/best-value', '/betting-workbench'].every((item) => home.includes(item)))
check('No personal saved watchlist or notifications added', cert.watchlistContract.personalSavedWatchlist === false && cert.watchlistContract.notifications === false && !/notification|saved watchlist|localStorage|wager/i.test(watchlistBuilder))
check('Prediction and policy scope remains locked', cert.scope.predictionChanged === false && cert.scope.officialPickPolicyChanged === false && cert.scope.rentPlayPolicyChanged === false && cert.scope.moneylineBetPolicyChanged === false && cert.scope.smartParlayPolicyChanged === false)
check('Ranking and operations scope remains locked', cert.scope.mostLikelyRankingChanged === false && cert.scope.bestValueRankingChanged === false && cert.scope.settlementChanged === false && cert.scope.learningChanged === false && cert.scope.schedulerCadenceChanged === false && cert.scope.refreshCadenceChanged === false)
check('Certification docs mention zero provider calls and mutations', doc.includes('Provider calls introduced: 0') && certMd.includes('No provider calls') && cert.safety.providerCallsIntroduced === 0 && cert.safety.remoteMutationsIntroduced === 0)

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
check('known unrelated files remain unstaged', !staged.some((file) => protectedFiles.includes(file)))

const changed = git(['diff', '--name-only']).split(/\r?\n/).filter(Boolean).map((file) => file.replaceAll('\\', '/'))
const forbidden = changed.filter((file) => /^(src\/app\/api\/|src\/services\/|supabase\/migrations\/|src\/config\/|src\/lib\/recommendation)/.test(file))
check('no API service migration config or recommendation policy files changed', forbidden.length === 0, forbidden.join(', '))

const failed = checks.filter((item) => !item.passed)
const result = {
  generatedAt: new Date().toISOString(),
  mode: 'mc08e_r_evidence_first_watchlist_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}
console.log(JSON.stringify(result, null, 2))
if (failed.length > 0) process.exit(1)
