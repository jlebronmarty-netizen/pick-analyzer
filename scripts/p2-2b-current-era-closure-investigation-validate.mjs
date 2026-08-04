import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const adaptive = read('src/services/adaptive-refresh-orchestrator.service.ts')
const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const allowed = new Set([
  'src/services/adaptive-refresh-orchestrator.service.ts',
  'src/services/provider-budget.service.ts',
  'scripts/p2-2b-current-era-closure-investigation-validate.mjs',
  'scripts/p2-2c-protected-scheduler-closure-recovery-validate.mjs',
  'docs/CERTIFICATION/P2_2B_CURRENT_ERA_CLOSURE_INVESTIGATION.md',
  'docs/CERTIFICATION/p2-2b-current-era-closure-investigation.json',
  'docs/CERTIFICATION/README.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
  'scripts/p2-2-new-epoch-daily-closure-validate.mjs',
  'scripts/p2-2a-performance-presentation-consistency-validate.mjs',
  'scripts/p2-1a-canonical-market-prediction-granularity-validate.mjs',
  'scripts/p2-1-supported-market-coverage-validate.mjs',
  'scripts/p2-0-prediction-epoch-v2-validate.mjs',
  'scripts/p1-4-e2e-production-pipeline-validate.mjs',
  'scripts/p1-3-production-evaluation-policy-validate.mjs',
  'scripts/p1-2-e2e-system-integrity-validate.mjs',
])

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const disallowed = changed.filter((file) => !allowed.has(file))

check('prior-date result-sync classifier exists', adaptive.includes('function isPriorDateResultImportCandidate'))
check('prior-date classifier does not create settlement eligibility', adaptive.includes('!isAuthoritativeSettlementResult(staleMissingResult)'))
check('prior-date classifier requires event start time', adaptive.includes('if (!event?.start_time) return false'))
check('prior-date classifier excludes current and future dates', adaptive.includes('eventDate >= currentDate'))
check('prior-date classifier requires elapsed start time', adaptive.includes('return startMs < now.getTime()'))
check('missing-result backlog uses prior-date classifier', adaptive.includes('return isPriorDateResultImportCandidate(eventsById.get(row.game_id), now)'))
check('authoritative settlement still requires game_results score', adaptive.includes('return Boolean(result && result.game_id && result.home_score !== null && result.away_score !== null)'))
check('fixture pins prior-date scheduled result import behavior', adaptive.includes('prior-date scheduled event is result-sync actionable but not settlement-ready'))
check('no prediction policy mutation introduced', !adaptive.includes('official_pick_eligible = true') && !adaptive.includes('recommendation_eligible = true'))
check('only bounded P2.2B files changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((item) => !item.passed)
const report = {
  success: failedChecks.length === 0,
  mode: 'p2_2b_current_era_closure_investigation_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(report, null, 2))
if (!report.success) process.exit(1)
