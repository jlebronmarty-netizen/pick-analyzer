import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const checks = []

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const service = read('src/services/probability-picks.service.ts')
const types = read('src/types/probability-picks.ts')
const page = read('src/components/probability-picks/ProbabilityPicksClient.tsx')
const briefing = read('src/app/ai-operations/page.tsx')
const doc = read('docs/PROBABILITY_PICKS_V2.md')

for (const text of [
  'version: VERSION',
  'version: PARLAY_VERSION',
  'sportEligibility',
  'topSignals',
  'freshnessSummary',
  'filterMetadata',
  'sortMetadata',
  'briefingContext',
  'qualificationReasons',
  'mainRisks',
  'presentation',
  'multiSportAvailable',
]) {
  check(`service contains ${text}`, service.includes(text))
}

for (const text of [
  'Probability Picks V2',
  'Today Overview',
  'Top Probability Signals',
  'By Sport',
  'Sports Not Ready Today',
  'Methodology And Definitions',
  'Projection Only / No Recommendation',
  'All Eligible Sports',
  'Maximum Risk',
  'Data Freshness',
  'Certification Level',
  'Sort',
]) {
  check(`page contains ${text}`, page.includes(text))
}

for (const text of [
  '/probability-picks#today-overview',
  '/probability-picks#top-signals',
  '/probability-picks?sport=baseball_mlb#by-sport',
  '/probability-picks#not-ready-today',
]) {
  check(`ai briefing deep link ${text}`, briefing.includes(text))
}

for (const status of [
  'CERTIFIED_ACTIVE',
  'CERTIFIED_LIMITED',
  'PREVIEW',
  'SHADOW_ONLY',
  'INSUFFICIENT_DATA',
  'ENGINE_NOT_CERTIFIED',
  'OUT_OF_SEASON',
  'STALE',
  'BLOCKED',
]) {
  check(`eligibility status ${status}`, types.includes(status) && service.includes(status))
}

for (const marker of [
  'PROBABILITY_PICKS_V2_PASS',
  'PROBABILITY_PICKS_MULTI_SPORT_ELIGIBILITY_PASS',
  'PROBABILITY_PICKS_GLOBAL_RANKING_PASS',
  'PROBABILITY_PICKS_BY_SPORT_PASS',
  'PROBABILITY_PICKS_EXPLANATION_PASS',
  'PROBABILITY_PICKS_FILTERING_PASS',
  'PROBABILITY_PICKS_SORTING_PASS',
  'PROBABILITY_PICKS_FRESHNESS_PASS',
  'PROBABILITY_PICKS_EMPTY_STATE_PASS',
  'PROBABILITY_PICKS_AI_BRIEFING_INTEGRATION_PASS',
  'PROBABILITY_PICKS_PARLAY_PRESENTATION_PASS',
  'PROBABILITY_PICKS_API_COMPATIBILITY_PASS',
  'NO_PROBABILITY_CHANGE_PASS',
  'NO_THRESHOLD_CHANGE_PASS',
  'NO_CORRELATION_MATH_CHANGE_PASS',
  'NO_DATABASE_MUTATION_PASS',
  'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
]) {
  check(`doc marker ${marker}`, doc.includes(marker))
}

const pageForbidden = /\b(EV|Kelly|bankroll|stake|Official Pick|Portfolio|sportsbook|bookmaker|implied probability|fair odds|arbitrage recommendation|betting advice)\b/i
check('probability page avoids forbidden product language', !pageForbidden.test(page))

const changedFiles = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((file) => file.replaceAll('\\', '/'))

const forbiddenChanges = changedFiles.filter((file) => [
  /^supabase\/migrations\//,
  /^\.github\//,
  /^src\/services\/.*learning/i,
  /^src\/services\/.*settlement/i,
  /^src\/services\/.*prediction-engine/i,
  /^src\/services\/.*scheduler/i,
].some((pattern) => pattern.test(file)))

check('no migration scheduler learning settlement or prediction-engine files changed', forbiddenChanges.length === 0, forbiddenChanges.join(', '))
check('probability service keeps v1 mode for compatibility', service.includes("const MODE = 'probability_picks_v1'"))
check('parlay mode keeps v1 mode for compatibility', service.includes("const PARLAY_MODE = 'probability_parlays_v1'"))
check('balanced parlay thresholds unchanged', service.includes("return { probability: 56, confidence: 55, quality: 52, maxPenalty: 28 }"))
check('provider calls remain zero contract', service.includes('providerCallsMade: 0') && page.includes('Provider calls: 0'))
check('remote mutations remain zero contract', service.includes('remoteMutationsMade: 0') && page.includes('Remote mutations: 0'))

const failed = checks.filter((item) => !item.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  checks,
  changedFiles,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
}, null, 2))

if (failed.length) process.exit(1)
