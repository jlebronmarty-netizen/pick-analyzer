import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(path, 'utf8')
}

function json(path) {
  return JSON.parse(read(path))
}

let failures = 0
function check(name, passed) {
  if (passed) {
    console.log(`PASS ${name}`)
  } else {
    failures += 1
    console.error(`FAIL ${name}`)
  }
}

const cert = json('docs/CERTIFICATION/mlb-operating-day-autonomy-live-continuity.json')
const report = read('docs/CERTIFICATION/MLB_OPERATING_DAY_AUTONOMY_LIVE_CONTINUITY.md')
const orchestrator = read('src/services/adaptive-refresh-orchestrator.service.ts')

check('certification status is local repair ready', cert.status === 'LOCAL_REPAIR_READY_FOR_DEPLOYMENT')
check('root cause recorded', cert.rootCause === 'PRIOR_DAY_CLOSURE_DEBT_STARVED_CURRENT_DAY_PREGAME_MARKET_BOOTSTRAP')
check('production symptom recorded', cert.observation.gamesToday === 9 && cert.observation.pregame === 9 && cert.observation.predictions === 0)
check('current-day odds bootstrap preempts older closure debt', orchestrator.includes('activeMarketRefreshPreemptsClosureDebt') && orchestrator.includes('oldestReadyDate') && orchestrator.includes('oldestMissingResultDate'))
check('execution selector returns market refresh before settlement for preemption', orchestrator.includes("if (pregameOddsDue && activeMarketRefreshPreemptsClosureDebt) return status.currentGames > 0 ? 'midday_refresh' : 'morning_sync'"))
check('status selector reports preemption before settlement', orchestrator.includes('const effectiveNextAction = activeMarketRefreshPreemptsClosureDebt'))
check('same-day settlement remains in selector', orchestrator.includes("if (dueDomains.includes('settlement')) return 'settle'") && orchestrator.includes("? 'settle'"))
check('older closure resumes after bootstrap documented', report.includes('Older result and settlement closure') && report.includes('resumes after current slate odds/prediction continuity is restored.'))
check('SportsDataIO zero-call guard preserved', orchestrator.includes('shouldSuppressSportsDataIoOddsAcquisition') && orchestrator.includes('SKIPPED_AUTHORITY_NOT_SPORTSDATAIO'))
check('The Odds API Stage 3 path still executes', orchestrator.includes('executeTheOddsApiMlbDualReadAcquisition'))
check('stored odds prediction generation still triggered from The Odds API changes', orchestrator.includes('theOddsApiRowsChanged') && orchestrator.includes('generateMlbProspectivePredictionsFromStoredOdds'))
check('line-versioned writer still wired', orchestrator.includes('executeLineVersionedRepredictionWriter'))
check('MLB Official live/status path still wired', orchestrator.includes('executeMlbOfficialShadowAcquisition'))
check('no Vercel config change required', cert.repair.vercelConfigChanged === false)
check('prediction formulas unchanged by certification', cert.guardrails.predictionFormulaChanged === false)
check('Official thresholds unchanged by certification', cert.guardrails.officialPickThresholdsChanged === false)
check('settlement formula unchanged by certification', cert.guardrails.settlementFormulaChanged === false)
check('NBA history unaffected', cert.guardrails.nbaHistoricalDataModified === false && cert.guardrails.nbaCurrentEraActivated === false)
check('certification reads accounted as zero provider calls', cert.certification.providerCallsFromCertification === 0)
check('certification reads accounted as zero DB mutations', cert.certification.databaseMutationsFromCertification === 0)

if (failures) {
  console.error(`MLB operating-day autonomy validation failed: ${failures}`)
  process.exit(1)
}

console.log('MLB operating-day autonomy validation passed')
