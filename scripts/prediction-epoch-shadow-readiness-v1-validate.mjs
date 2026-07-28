import fs from 'node:fs'
import {
  getOddsChangeTriggeredPredictionRefreshV1,
  getPregameOddsRefreshCadenceSlaV1,
  validatePredictionEpochShadowReadinessFixtures,
} from '@/services/prediction-epoch-shadow-readiness.service'

const migration = fs.readFileSync('supabase/migrations/202607280001_prediction_epoch_shadow_readiness_v1.sql', 'utf8')
const doc = fs.readFileSync('docs/PREDICTION_EPOCH_SHADOW_READINESS_V1.md', 'utf8')
const status = fs.readFileSync('docs/PROJECT_STATUS.md', 'utf8')
const roadmap = fs.readFileSync('docs/MASTER_ROADMAP.md', 'utf8')

const validation = await validatePredictionEpochShadowReadinessFixtures()
const sla = await getPregameOddsRefreshCadenceSlaV1()
const refresh = await getOddsChangeTriggeredPredictionRefreshV1()

const checks = [
  ['fixture validation passes', validation.success],
  ['migration contains prediction_origin', migration.includes('prediction_origin')],
  ['migration contains certification_status', migration.includes('certification_status')],
  ['migration does not set production eligible', !/production_eligible\s*=\s*true/i.test(migration)],
  ['migration comments block backfill', migration.includes('does not backfill')],
  ['doc says shadow only', doc.includes('shadow-only')],
  ['doc blocks epoch activation', doc.includes('Do not activate')],
  ['cadence includes 10 minute rule', sla.cadence.moreThan90MinutesBeforeStart === '10 minutes'],
  ['cadence includes 5 minute rule', sla.cadence.final90MinutesBeforeStart === '5 minutes'],
  ['freshness SLA normal target', sla.freshnessTargets.normalActivePregameWindowMinutes === 12],
  ['freshness SLA final target', sla.freshnessTargets.final90MinutesWindowMinutes === 7],
  ['provider calls remain zero', sla.providerCallsMade === 0 && refresh.providerCallsMade === 0],
  ['change trigger does not regenerate on schedule alone', refresh.rule.includes('never regenerate merely because the scheduler ran')],
  ['project status updated', status.includes('Prediction Epoch Shadow Readiness V1')],
  ['roadmap updated', roadmap.includes('Prediction Epoch Shadow Readiness V1')],
]

const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
const result = {
  success: failedChecks.length === 0,
  mode: 'prediction_epoch_shadow_readiness_v1_validation',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  slaSummary: {
    activeEvents: sla.activeSlateEstimate.events,
    estimatedCallsRemainingToday: sla.activeSlateEstimate.estimatedCallsRemainingToday,
    estimatedCallsPerDayAtCombinedCadence: sla.fullSlateEstimate.estimatedCallsPerDayAtCombinedCadence,
    estimatedMarketRowsPerDayAtCombinedCadence: sla.fullSlateEstimate.estimatedMarketRowsPerDayAtCombinedCadence,
  },
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
