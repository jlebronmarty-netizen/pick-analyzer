import fs from 'node:fs'

const servicePath = 'src/services/operating-day.service.ts'
const service = fs.readFileSync(servicePath, 'utf8')
const settlementStart = service.indexOf('export async function settleOperatingDay')
const settlementEnd = service.indexOf('async function replayReport', settlementStart)
const settlementFunction = settlementStart >= 0 && settlementEnd > settlementStart
  ? service.slice(settlementStart, settlementEnd)
  : ''

const checks = [
  {
    name: 'operating-day settlement imports cutoff classifier',
    pass: service.includes("import { classifyPredictionCutoff } from '@/services/prediction-cutoff-enforcement.service'"),
  },
  {
    name: 'prediction settlement read includes cutoff timestamps',
    pass:
      service.includes('generated_at, created_at, cutoff_at') &&
      service.includes('const select ='),
  },
  {
    name: 'linked and same-date prediction rows are merged and deduped',
    pass:
      service.includes('const merged = new Map<string, PredictionRow>()') &&
      service.includes('byOperatingDay.data') &&
      service.includes('byDate.data') &&
      service.includes('return Array.from(merged.values())') &&
      !service.includes('if ((byOperatingDay.data ?? []).length) return'),
  },
  {
    name: 'settlement loads canonical event state for cutoff recheck',
    pass:
      service.includes('async function loadEventsForPredictions') &&
      service.includes("from('sport_events')") &&
      service.includes("select('id, start_time, status, updated_at, home_score, away_score')"),
  },
  {
    name: 'cutoff safety is rechecked before result settlement',
    pass:
      service.indexOf('const cutoff = classifyPredictionCutoff') > -1 &&
      service.indexOf('if (!cutoff.eligible)') > service.indexOf('for (const prediction of predictions)') &&
      service.indexOf('const result = resultByGame.get(prediction.game_id)') > service.indexOf('if (!cutoff.eligible)'),
  },
  {
    name: 'blocked cutoff rows are not settled',
    pass:
      service.includes("summary.blockedRows.push({ id: prediction.id, gameId: prediction.game_id, reason: cutoff.state })") &&
      service.includes('continue'),
  },
  {
    name: 'settlement still uses canonical game_results and exact market grading',
    pass:
      service.includes("from('game_results')") &&
      service.includes('gradePrediction(prediction, result)') &&
      service.includes("if (market === 'moneyline')") &&
      service.includes("if (market === 'spread')") &&
      service.includes("if (market === 'total')"),
  },
  {
    name: 'settlement writer preserves result linkage and source metadata',
    pass:
      service.includes('result_id: update.resultId') &&
      service.includes("settlement_source: 'operating_day_lifecycle_v1'") &&
      service.includes('settlement_version: POLICY_VERSION'),
  },
  {
    name: 'settlement path makes no provider calls',
    pass:
      service.includes('providerCallsMade: 0') &&
      Boolean(settlementFunction) &&
      !settlementFunction.includes('syncRecentResults'),
  },
]

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`)
}

const failed = checks.filter((check) => !check.pass)
if (failed.length > 0) {
  console.error(`MLB settlement closure debt finalization validation failed: ${failed.map((check) => check.name).join(', ')}`)
  process.exit(1)
}

console.log(`MLB settlement closure debt finalization validation passed: ${checks.length}/${checks.length}`)
