import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const exists = (path) => fs.existsSync(path)
const checks = []
const check = (name, passed) => checks.push({ name, passed: Boolean(passed) })

const certPath = 'docs/CERTIFICATION/pr-01-final-production-readiness-audit.json'
const certMdPath = 'docs/CERTIFICATION/PR_01_FINAL_PRODUCTION_READINESS_AUDIT.md'
const route = read('src/app/api/performance/route.ts')
const scope = read('src/services/performance-scope-v2.service.ts')
const status = JSON.parse(read('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json'))
const cert = exists(certPath) ? JSON.parse(read(certPath)) : {}

check('PR-01 markdown exists', exists(certMdPath))
check('PR-01 JSON exists', exists(certPath))
check('PR-01 keeps production pilot not ready', cert.productionPilotWeekReady === false && cert.mc08hRerun === false)
check('PR-01 records not-ready classification', cert.classification === 'PR_01_PRODUCTION_PILOT_NOT_READY')
check('Current Era equation balances', cert.currentEra?.equationBalanced === true && cert.currentEra?.silentPendingRows === 0)
check('Aug 4 equation balances without silent pending', cert.aug4Reconciliation?.equationBalanced === true && cert.aug4Reconciliation?.silentPending === 0)
check('Aug 4 first missing step is result import', cert.aug4Reconciliation?.firstMissingStep === 'RESULT_IMPORT')
check('Replay remains isolated', cert.replay?.isolated === true && cert.replay?.includedInCurrentEraTrust === false)
check('Homepage scope difference documented', cert.homepage?.scopeDifferenceExplained === true)
check('Mission Control auto-run remains disabled by gate', ['MC-08H', 'OR-01H', 'OR-02', 'OR-02A'].includes(status.currentMission?.id) && status.mc08h?.productionPilotWeekReady === false)
check('Performance route exposes selected pipeline readiness helper', route.includes('function selectedPipelineReadiness('))
check('Performance header no longer maps readiness score to selectedTrust.trustScore', !route.includes('score: selectedTrust.trustScore'))
check('Performance readiness status is derived from pipeline score', route.includes('pipelineReadinessStatus(pipelineReadinessScore)'))
check('Performance timeline uses Puerto Rico timezone', scope.includes("const TIMEZONE = 'America/Puerto_Rico'"))
check('Performance timeline buckets by event start with fallback', scope.includes('item.event?.start_time ?? item.row.commence_time ?? item.row.generated_at'))
check('No prediction behavior change is claimed', cert.runtimeRepair?.predictionChanged === false)
check('No settlement behavior change is claimed', cert.runtimeRepair?.settlementChanged === false)
check('No learning behavior change is claimed', cert.runtimeRepair?.learningChanged === false)
check('No scheduler behavior change is claimed', cert.runtimeRepair?.schedulerChanged === false)
check('No provider behavior change is claimed', cert.runtimeRepair?.providerChanged === false)
check('Audit reads made zero provider calls', cert.providerCallsMadeByAuditReads === 0)
check('Audit reads made zero remote mutations', cert.remoteMutationsMadeByAuditReads === 0)

const failed = checks.filter((item) => !item.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'pr01_final_production_readiness_validate_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed.map((item) => item.name),
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}, null, 2))

if (failed.length) process.exit(1)
