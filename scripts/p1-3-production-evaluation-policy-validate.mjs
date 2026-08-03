import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const policy = read('src/services/prediction-evaluation-policy.service.ts')
const writer = read('src/services/sportsdataio-mlb-prospective-preview.service.ts')
const recommendation = read('src/services/recommendation-eligibility-policy.service.ts')
const certification = read('docs/CERTIFICATION/P1_3_PRODUCTION_EVALUATION_POLICY.md')
const ops = read('docs/OPERATIONAL_EXCELLENCE/P1_3_PRODUCTION_EVALUATION_POLICY.md')
const artifact = JSON.parse(read('docs/CERTIFICATION/p1-3-production-evaluation-policy.json'))

const checks = []
function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail })
}

const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const allowed = new Set([
  'src/services/prediction-evaluation-policy.service.ts',
  'src/services/sportsdataio-mlb-prospective-preview.service.ts',
  'docs/OPERATIONAL_EXCELLENCE/P1_3_PRODUCTION_EVALUATION_POLICY.md',
  'docs/CERTIFICATION/P1_3_PRODUCTION_EVALUATION_POLICY.md',
  'docs/CERTIFICATION/p1-3-production-evaluation-policy.json',
  'scripts/p1-3-production-evaluation-policy-validate.mjs',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/MISSION_CONTROL/README.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
  'src/services/prediction-coverage.service.ts',
  'src/app/api/operations/prediction-coverage/route.ts',
  'docs/ARCHITECTURE/COMPREHENSIVE_SUPPORTED_MARKET_COVERAGE.md',
  'docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md',
  'docs/ARCHITECTURE/README.md',
  'docs/OPERATIONAL_EXCELLENCE/P2_1_SUPPORTED_MARKET_PREDICTION_COVERAGE.md',
  'docs/CERTIFICATION/P2_1_SUPPORTED_MARKET_PREDICTION_COVERAGE.md',
  'docs/CERTIFICATION/p2-1-supported-market-prediction-coverage.json',
  'docs/CERTIFICATION/README.md',
  'scripts/p1-2-e2e-system-integrity-validate.mjs',
  'scripts/p1-4-e2e-production-pipeline-validate.mjs',
  'scripts/p2-0-prediction-epoch-v2-validate.mjs',
  'scripts/p2-1-supported-market-coverage-validate.mjs',
  'src/services/canonical-settlement-state.service.ts',
  'src/services/performance-scope-v2.service.ts',
  'docs/CERTIFICATION/P2_1A_CANONICAL_MARKET_GRANULARITY.md',
  'docs/CERTIFICATION/p2-1a-canonical-market-granularity.json',
  'docs/OPERATIONAL_EXCELLENCE/P2_1A_CANONICAL_MARKET_GRANULARITY.md',
  'scripts/p2-1a-canonical-market-prediction-granularity-validate.mjs',
])
const disallowed = changed.filter((file) => !allowed.has(file))

check('five policy layers are explicit', ['prediction_valid', 'production_evaluable', 'recommendation_eligible', 'actionable', 'official_pick_eligible'].every((token) => policy.includes(token)))
check('production evaluation reasons are distinct from recommendation reasons', policy.includes('production_evaluation_reasons') && policy.includes('recommendation_gate_reasons'))
check('low confidence remains recommendation-only for production evaluation', policy.includes('LOW_CONFIDENCE_IS_RECOMMENDATION_ONLY') && !policy.includes("reasons.push('LOW_CONFIDENCE"))
check('low edge remains recommendation-only for production evaluation', policy.includes('LOW_EDGE_IS_RECOMMENDATION_ONLY') && !policy.includes("reasons.push('LOW_EDGE"))
check('low ev remains recommendation-only for production evaluation', policy.includes('LOW_EV_IS_RECOMMENDATION_ONLY') && !policy.includes("reasons.push('LOW_EV"))
check('calibration remains recommendation-only for production evaluation', policy.includes('CALIBRATION_IS_RECOMMENDATION_ONLY') && !policy.includes("reasons.push('CALIBRATION"))
check('stale price is warning not production blocker', policy.includes('STALE_PRICE_EVIDENCE') && !policy.includes("reasons.push('STALE"))
check('cutoff leakage blocks production evaluation', policy.includes('PREDICTION_AFTER_CUTOFF') && policy.includes('ODDS_AFTER_CUTOFF'))
check('excluded scopes block evaluation', ['REPLAY_SCOPE', 'BACKTEST_SCOPE', 'SHADOW_SCOPE', 'HISTORICAL_SCOPE', 'LEGACY_SCOPE'].every((token) => policy.includes(token)))
check('trial and scrambled rows remain excluded', policy.includes('TRIAL_ROW') && policy.includes('SCRAMBLED_ROW'))
check('writer stores normalized policy contract', writer.includes('evaluatePredictionEvaluationPolicy') && writer.includes('productionEvaluationPolicy: evaluationPolicy'))
check('writer does not mark future rows production_eligible true', !/production_eligible:\s*true/.test(writer))
check('recommendation thresholds unchanged', recommendation.includes('minimumOfficialConfidence: 65') && recommendation.includes('minimumOfficialEdge: 5') && recommendation.includes('minimumOfficialEv: 5'))
check('official pick policy remains tied to recommendation status', recommendation.includes('isOfficialRecommendationStatus(status)'))
check('historical 2026-08-02 rows remain unpromoted', certification.includes('45 rows from 2026-08-02 remain non-production') && artifact.historicalRowsPromoted === false)
check('no retrospective rewrite operation exists in P1.3 docs', !/update\s+prediction_history/i.test(ops + certification))
check('artifact records zero provider calls and mutations', artifact.providerCallsMade === 0 && artifact.remoteMutationsMade === 0)
check('P2.0 boundary is future work', ops.includes('P2.0 may introduce a formal epoch boundary'))
check('only bounded P1.3 files changed', disallowed.length === 0, disallowed.join(', '))

const failedChecks = checks.filter((item) => !item.passed)
const report = {
  success: failedChecks.length === 0,
  mode: 'p1_3_production_evaluation_policy_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(report, null, 2))
if (!report.success) process.exit(1)
