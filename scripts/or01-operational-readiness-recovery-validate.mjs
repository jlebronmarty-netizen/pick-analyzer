import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const orchestrator = read('src/services/adaptive-refresh-orchestrator.service.ts')
const health = read('src/services/operations-health.service.ts')
const status = read('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json')
const certification = read('docs/CERTIFICATION/OR_01_OPERATIONAL_READINESS_RECOVERY.md')
const certificationJson = JSON.parse(read('docs/CERTIFICATION/or-01-operational-readiness-recovery.json'))

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const allowed = new Set([
  'src/services/adaptive-refresh-orchestrator.service.ts',
  'scripts/or01-operational-readiness-recovery-validate.mjs',
  'docs/CERTIFICATION/OR_01_OPERATIONAL_READINESS_RECOVERY.md',
  'docs/CERTIFICATION/or-01-operational-readiness-recovery.json',
  'docs/MISSION_CONTROL/OR_01_OPERATIONAL_READINESS_RECOVERY.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/README.md',
  'docs/CERTIFICATION/README.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
])

const protectedMc08e = [
  'docs/CERTIFICATION/MC_08E_WATCHLIST_EXPERIENCE.md',
  'docs/CERTIFICATION/mc-08e-watchlist-experience.json',
  'docs/MISSION_CONTROL/MC_08E_WATCHLIST_EXPERIENCE.md',
  'scripts/mc08e-watchlist-experience-validate.mjs',
]

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const disallowed = changed.filter((file) => !allowed.has(file))
const protectedTouched = changed.filter((file) => protectedMc08e.includes(file))

check(
  'active market refresh preempts historical result recovery starvation',
  orchestrator.includes('activeMarketRefreshPreemptsHistoricalResultRecovery') &&
    orchestrator.includes("String(settlementBacklog?.oldestMissingResultDate) < String(activeSlateDate)") &&
    orchestrator.includes("return status.currentGames > 0 ? 'midday_refresh' : 'morning_sync'")
)
check(
  'settlement-ready rows still remain highest priority',
  orchestrator.includes("if (dueDomains.includes('settlement')) return 'settle'") &&
    orchestrator.includes("const effectiveNextAction = dueDomains.includes('settlement')\n    ? 'settle'")
)
check(
  'result sync remains available for true result backlog',
  orchestrator.includes("if (dueDomains.includes('results')) return 'sync_results'") &&
    orchestrator.includes("? 'sync_results'")
)
check(
  'read-only status still performs zero provider calls and zero mutations',
  orchestrator.includes('providerCallsAddedByStatusRead: 0') &&
    orchestrator.includes('providerCallsMade: 0') &&
    orchestrator.includes('remoteMutationsMade: 0')
)
check(
  'health still refuses to greenwash stale markets',
  health.includes("input.adaptiveBlockers.includes('odds_not_current')") &&
    health.includes("'market_freshness_critical'") &&
    health.includes('Market freshness never falls back to scheduler invocation time')
)
check(
  'settlement eligibility remains authoritative',
  orchestrator.includes('function isAuthoritativeSettlementResult') &&
    orchestrator.includes('result.home_score !== null && result.away_score !== null')
)
check(
  'OR-01 certification records remaining production evidence honestly',
  certification.includes('OR_01_REPOSITORY_RECOVERY_DEPLOYMENT_REQUIRED') &&
    certification.includes('Market Freshness: REMAINS CRITICAL until production writer refreshes active markets')
)
check(
  'Mission Control status records OR-01 recovery state',
  status.includes('"or01"') &&
    status.includes('"repositoryRepair": "COMPLETE"')
)
check(
  'certification JSON is valid OR-01 artifact',
  certificationJson.id === 'or_01_operational_readiness_recovery' &&
    certificationJson.providerCallsMade === 0 &&
    certificationJson.remoteMutationsMade === 0
)
check('only bounded OR-01 files changed', disallowed.length === 0, disallowed.join(', '))
check('paused MC-08E artifacts remain isolated', protectedTouched.length === 0, protectedTouched.join(', '))

const failedChecks = checks.filter((entry) => !entry.passed)
const result = {
  success: failedChecks.length === 0,
  mode: 'or01_operational_readiness_recovery_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  predictionWrites: 0,
  resultWrites: 0,
  settlementWrites: 0,
  learningWrites: 0,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
