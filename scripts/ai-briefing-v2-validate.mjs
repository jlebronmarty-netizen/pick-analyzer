import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const checks = []

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const page = read('src/app/ai-operations/page.tsx')
const doc = read('docs/AI_BRIEFING_V2_DAILY_DECISION_ENGINE.md')

for (const text of [
  "Today's Decision Briefing",
  'Is today worth betting?',
  'Qualified Picks',
  'Certified Sports',
  'Highest Projection Signals',
  'What Needs Attention',
  'Data And Model Health',
  'Sport Summary',
  'Where To Go Next',
  'Projection Only',
  'No Recommendation',
  'Probability Picks',
  'Current Board',
  'Player Projections',
  'Performance',
]) {
  check(`page contains ${text}`, page.includes(text))
}

for (const imported of [
  'getProbabilityPicks',
  'getProbabilityParlays',
  'getPerformanceProductContract',
  'getCurrentBoard',
  'getAiLearningLifecycle',
]) {
  check(`uses existing contract ${imported}`, page.includes(imported))
}

for (const marker of [
  'AI_BRIEFING_V2_PASS',
  'DAILY_DECISION_ENGINE_PASS',
  'PRODUCT_SUMMARY_PASS',
  'DATA_HEALTH_SUMMARY_PASS',
  'MODEL_HEALTH_SUMMARY_PASS',
  'SPORT_STATUS_SUMMARY_PASS',
  'NO_RECOMMENDATION_PASS',
  'NO_PROBABILITY_CHANGE_PASS',
  'NO_MODEL_CHANGE_PASS',
  'NO_DATABASE_MUTATION_PASS',
  'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
]) {
  check(`doc marker ${marker}`, doc.includes(marker))
}

const visibleCopyOnlyForbidden = [
  'Kelly',
  'bankroll',
  'stake',
  'Portfolio',
]
for (const term of visibleCopyOnlyForbidden) {
  check(`forbidden product term absent: ${term}`, !page.includes(term))
}

const changedFiles = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const forbiddenPatterns = [
  /^src\/services\//,
  /^src\/app\/api\//,
  /^supabase\/migrations\//,
]
const forbidden = changedFiles.filter((file) => forbiddenPatterns.some((pattern) => pattern.test(file.replaceAll('\\', '/'))))
check('no services api routes or migrations changed', forbidden.length === 0, forbidden.join(', '))

const failed = checks.filter((item) => !item.passed)
console.log(JSON.stringify({ success: failed.length === 0, checks, changedFiles }, null, 2))
if (failed.length) process.exit(1)
