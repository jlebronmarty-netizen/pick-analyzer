import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(ROOT, file))
const cert = JSON.parse(read('docs/CERTIFICATION/p2-2d-current-era-settlement-closure.json'))
const p22 = JSON.parse(read('docs/CERTIFICATION/p2-2-new-epoch-daily-closure.json'))
const status = JSON.parse(read('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json'))
const queue = read('docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md')
const checklist = read('docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md')
const log = read('docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md')

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const allowed = new Set([
  'docs/CERTIFICATION/P2_2D_CURRENT_ERA_SETTLEMENT_CLOSURE.md',
  'docs/CERTIFICATION/p2-2d-current-era-settlement-closure.json',
  'docs/CERTIFICATION/P2_2_NEW_EPOCH_DAILY_CLOSURE.md',
  'docs/CERTIFICATION/p2-2-new-epoch-daily-closure.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'scripts/p2-2d-current-era-settlement-closure-validate.mjs',
  'scripts/p2-2-new-epoch-daily-closure-validate.mjs',
  'scripts/p2-2c-protected-scheduler-closure-recovery-validate.mjs',
  'scripts/p2-2b-current-era-closure-investigation-validate.mjs',
  'scripts/p2-2a-performance-presentation-consistency-validate.mjs',
  'scripts/p2-1a-canonical-market-prediction-granularity-validate.mjs',
  'scripts/p2-1-supported-market-coverage-validate.mjs',
  'scripts/p2-0-prediction-epoch-v2-validate.mjs',
  'scripts/p1-4-e2e-production-pipeline-validate.mjs',
  'scripts/p1-3-production-evaluation-policy-validate.mjs',
  'scripts/p1-2-e2e-system-integrity-validate.mjs',
])

const checks = []
function check(name, passed, detail = '') { checks.push({ name, passed: Boolean(passed), detail }) }
const disallowed = changed.filter((file) => !allowed.has(file))
const marketTotals = Object.values(cert.aug3CanonicalReconciliation.byMarket)
const marketExpected = marketTotals.reduce((sum, row) => sum + row.expected, 0)
const marketSettled = marketTotals.reduce((sum, row) => sum + row.settled, 0)
const marketPending = marketTotals.reduce((sum, row) => sum + row.pending, 0)
const marketBlocked = marketTotals.reduce((sum, row) => sum + row.blocked, 0)

check('P2.2D status passes', cert.status === 'PASS' && cert.classification === 'P2_2D_CURRENT_ERA_SETTLEMENT_CLOSED')
check('protected execution selected settle once for this phase', cert.protectedExecution.selectedAction === 'settle' && cert.protectedExecution.httpStatus === 200)
check('settlement execution used zero provider calls', cert.protectedExecution.providerCallsMade === 0)
check('settlement execution made no prediction or result writes', cert.protectedExecution.predictionWrites === 0 && cert.protectedExecution.resultWrites === 0)
check('Aug 3 canonical equation closes', cert.aug3CanonicalReconciliation.expectedCanonicalPredictions === 24 && cert.aug3CanonicalReconciliation.settled + cert.aug3CanonicalReconciliation.blocked + cert.aug3CanonicalReconciliation.explicitPending === 24)
check('Aug 3 silent pending is zero', cert.aug3CanonicalReconciliation.silentPending === 0)
check('market totals reconcile', marketExpected === 24 && marketSettled === 24 && marketPending === 0 && marketBlocked === 0)
check('moneyline run line total each have eight settled rows', cert.aug3CanonicalReconciliation.byMarket.moneyline.settled === 8 && cert.aug3CanonicalReconciliation.byMarket.spread.settled === 8 && cert.aug3CanonicalReconciliation.byMarket.total.settled === 8)
check('learning samples match settled canonical rows', cert.learningClosure.derivedLearningSamples === cert.learningClosure.settledCanonicalPredictions && cert.learningClosure.learningMissing === 0 && cert.learningClosure.learningDuplicates === 0)
check('no model promotion or champion change occurred', cert.learningClosure.modelWeightPromotion === false && cert.learningClosure.championChange === false)
check('Performance Current Era closed with 24 settled and 45 pending', cert.performanceClosure.canonicalPredictionRows === 69 && cert.performanceClosure.settledCanonicalRows === 24 && cert.performanceClosure.pendingCanonicalRows === 45)
check('settlement guarantee passed with no ready or silent pending rows', cert.crossSurface.settlementGuarantee.httpStatus === 200 && cert.crossSurface.settlementGuarantee.readyForSettlementRows === 0 && cert.crossSurface.settlementGuarantee.silentPendingRows === 0)
check('event lifecycle archived Aug 3 events after settlement', cert.crossSurface.eventLifecycleAug3.events === 8 && cert.crossSurface.eventLifecycleAug3.state === 'ARCHIVED')
check('non-production rows remain excluded', cert.aug3CanonicalReconciliation.nonProductionRowsExcluded === 28 && cert.performanceClosure.nonProductionAnalysisRows === 34)
check('P2.2 parent certification is passed', p22.status === 'PASS' && p22.classification === 'P2_2_PRODUCTION_CERTIFIED')
check('Mission Control marks P2.2 certified and allows later certified mission gates', status.p2_2.status === 'PRODUCTION_CERTIFIED' && (status.p2_3?.status || status.p2_4?.status || ['OR-02', 'OR-02A', 'MC-08H'].includes(status.currentMission?.id) || queue.includes('| P2.3 | Historical Progressive Replay V1 |')))
check('P2.3 and MC-03 not started', cert.p23Started === false && cert.mc03Started === false && p22.p23Started === false && p22.mc03Started === false)
check('MC-08E remains paused or was safely reconciled later', cert.mc08eResumed === false && p22.mc08eResumed === false && (checklist.includes('MC-08E: `PAUSED`') || queue.includes('MC-08E-R')) && (log.includes('MC-08E remains paused') || queue.includes('MC-08E-R')))
check('guardrails unchanged', Object.values(cert.guards).every((value) => value === false))
check('certification docs exist', exists('docs/CERTIFICATION/P2_2D_CURRENT_ERA_SETTLEMENT_CLOSURE.md') && exists('docs/CERTIFICATION/p2-2d-current-era-settlement-closure.json'))
check('only bounded P2.2D docs and validators changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((item) => !item.passed)
const result = {
  success: failedChecks.length === 0,
  mode: 'p2_2d_current_era_settlement_closure_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
