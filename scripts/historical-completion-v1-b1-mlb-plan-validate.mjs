import fs from 'node:fs'

const plan = JSON.parse(fs.readFileSync('docs/mlb-season-coverage-plan-v3.json', 'utf8'))
const doc = fs.readFileSync('docs/MLB_SEASON_COVERAGE_PLAN_V3.md', 'utf8')

const checks = [
  ['previous season window defined', plan.targetWindows.some((window) => window.key === 'previous_completed_mlb_season' && window.season === '2025')],
  ['current safe window defined', plan.targetWindows.some((window) => window.key === 'current_mlb_safe_completed' && window.endDate === '2026-07-26')],
  ['future schedule window defined', plan.targetWindows.some((window) => window.key === 'current_mlb_future_schedule')],
  ['bounded manifests exist', plan.manifests.length >= 5],
  ['no mutations approved', plan.manifests.every((manifest) => manifest.mutationApproved === false)],
  ['zero provider calls', plan.providerCallsMade === 0],
  ['no historical imports executed', plan.historicalImportsExecuted === 0],
  ['certification marker present', doc.includes('MLB_SEASON_PLAN_V3_PASS')],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'mlb_season_coverage_plan_v3_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
