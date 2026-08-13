import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const orchestratorPath = 'src/services/adaptive-refresh-orchestrator.service.ts'
const docPath = 'docs/CERTIFICATION/MLB_FINAL_MARKET_FRESHNESS_FREEZE.md'
const certPath = 'docs/CERTIFICATION/mlb-final-market-freshness-freeze.json'

for (const file of [orchestratorPath, docPath, certPath]) {
  assert(fs.existsSync(file), `missing artifact: ${file}`)
}

const orchestrator = read(orchestratorPath)
const doc = read(docPath)
const cert = JSON.parse(read(certPath))

assert(orchestrator.includes("import { classifyPredictionCutoff }"), 'adaptive backlog must import cutoff classifier')
assert(orchestrator.includes('generated_at, cutoff_at, created_at'), 'adaptive backlog must read cutoff timestamps')
assert(orchestrator.includes('const cutoff = classifyPredictionCutoff(row, event)'), 'adaptive backlog must classify prediction cutoff')
assert(orchestrator.includes('item.hasAuthoritativeResult && item.cutoff.eligible'), 'settlement-ready rows must require cutoff eligibility')
assert(orchestrator.includes('cutoffBlockedRows'), 'cutoff-blocked rows must remain observable')
assert(orchestrator.includes('cutoffBlockedRowsByReason'), 'cutoff-blocked reasons must remain observable')
assert(orchestrator.includes("if (pregameOddsDue) return status.currentGames > 0 ? 'midday_refresh' : 'morning_sync'"), 'pregame stale rows must still trigger refresh eligibility')
assert(orchestrator.includes('executeTheOddsApiMlbDualReadAcquisition'), 'The Odds API acquisition path must remain wired')
assert(orchestrator.includes('shouldSuppressSportsDataIoOddsAcquisition'), 'SportsDataIO suppression guard must remain wired')
assert(orchestrator.includes('executeLineVersionedRepredictionWriter'), 'R2 writer path must remain wired')
assert(!orchestrator.includes('ODDS_PRIMARY_AUTHORITY_STAGE='), 'repair must not hardcode odds authority')
assert(!orchestrator.includes('MLB_DATA_SOURCE_MODE='), 'repair must not hardcode MLB data-source mode')

assert(cert.classification === 'MLB_FINAL_MARKET_FRESHNESS_RUNTIME_REPAIR_READY_FOR_DEPLOYMENT', 'cert classification mismatch')
assert(cert.productionEvidenceBeforeRepair.settlementGuarantee === 'PASS', 'settlement guarantee evidence must remain PASS')
assert(cert.productionEvidenceBeforeRepair.settlementReady === 0, 'ready rows must be recorded as zero')
assert(cert.productionEvidenceBeforeRepair.silentPending === 0, 'silent pending must be recorded as zero')
assert(cert.productionEvidenceBeforeRepair.settlementBlockedReason === 'PREDICTION_POST_START', 'post-start blocker must be explicit')
assert(cert.productionEvidenceBeforeRepair.eligiblePregameMarketRefreshGames === 3, 'pregame refresh denominator must be recorded')
assert(cert.productionEvidenceBeforeRepair.naturalSchedulerSelectedAction === 'settle', 'starvation evidence must be recorded')
assert(cert.rootCause.classification === 'SETTLEMENT_BACKLOG_CUTOFF_GATE_MISMATCH_STARVED_MARKET_REFRESH', 'root cause must be exact')
assert(cert.repair.cutoffBlockedRowsNoLongerPreemptMarketRefresh === true, 'cutoff-blocked rows must not preempt refresh')
assert(cert.repair.healthThresholdsWeakened === false, 'health thresholds must not be weakened')
assert(cert.safety.providerAuthorityChanged === false, 'provider authority must remain unchanged')
assert(cert.safety.sportsDataIoReactivated === false, 'SportsDataIO must remain suppressed/rollback-only')
assert(cert.safety.nbaHistoricalFoundationTouched === false, 'NBA foundation must remain untouched')
assert(cert.safety.providerCallsFromCertificationReads === 0, 'certification reads must make zero provider calls')
assert(cert.safety.databaseMutationsFromCertificationReads === 0, 'certification reads must make zero database mutations')

assert(doc.includes('MLB_FINAL_MARKET_FRESHNESS_RUNTIME_REPAIR_READY_FOR_DEPLOYMENT'), 'doc must carry repair-ready classification')
assert(doc.includes('PREDICTION_POST_START'), 'doc must explain post-start blocker')
assert(doc.includes('market refresh'), 'doc must explain market refresh recovery')
assert(doc.includes('No SportsDataIO fallback was reactivated'), 'doc must preserve SportsDataIO safety')

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_final_market_freshness_freeze_validate_v1',
  checks: 32,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  classification: cert.classification
}, null, 2))
