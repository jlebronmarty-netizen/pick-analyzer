import { existsSync, readFileSync } from 'node:fs'

const files = [
  'docs/ARCHITECTURE/NBA_FINAL_PROVIDER_MAP_V1.md',
  'docs/ARCHITECTURE/NBA_DATA_FOUNDATION_V1.md',
  'docs/ARCHITECTURE/NBA_HISTORICAL_READINESS_V1.md',
  'docs/PRODUCTION_PILOT/NBA_01_DATA_FOUNDATION_PROVIDER_INDEPENDENCE.md',
  'docs/CERTIFICATION/nba-01-data-foundation-provider-independence.json',
  'docs/ARCHITECTURE/NBA_IMPLEMENTATION_MASTER_PLAN_V1.md',
]

const checks = []
const check = (name, passed) => checks.push({ name, passed: Boolean(passed) })
const read = (file) => readFileSync(file, 'utf8')

for (const file of files) check(`${file} exists`, existsSync(file))

const cert = JSON.parse(read('docs/CERTIFICATION/nba-01-data-foundation-provider-independence.json'))
const provider = read('docs/ARCHITECTURE/NBA_FINAL_PROVIDER_MAP_V1.md')
const foundation = read('docs/ARCHITECTURE/NBA_DATA_FOUNDATION_V1.md')
const readiness = read('docs/ARCHITECTURE/NBA_HISTORICAL_READINESS_V1.md')
const pilot = read('docs/PRODUCTION_PILOT/NBA_01_DATA_FOUNDATION_PROVIDER_INDEPENDENCE.md')
const plan = read('docs/ARCHITECTURE/NBA_IMPLEMENTATION_MASTER_PLAN_V1.md')

check('prior NBA work audited', Object.keys(cert.existingFoundation).length >= 9)
check('no unnecessary rebuild', Object.values(cert.existingFoundation).every((item) => item.action !== 'NEW'))
check('final provider map complete', Object.keys(cert.providerMap).length >= 14)
check('The Odds API role explicit', cert.providerMap.odds.source.includes('The Odds API') && cert.theOddsApi.nbaSportKey === 'basketball_nba')
check('official/free role explicit', cert.providerMap.schedule.source.includes('official/free') && cert.providerMap.results.source.includes('official/free'))
check('SportsDataIO dependency classified', cert.sportsDataIo.finalNbaSportsDataIoStatus === 'LEGACY_ONLY_DO_NOT_EXPAND')
check('canonical teams safe', cert.canonicalIdentity.teamsTotal === 30 && cert.canonicalIdentity.teamsMapped === 30 && cert.canonicalIdentity.teamsAmbiguous === 0)
check('canonical player strategy safe', cert.canonicalIdentity.playersTotal === 579 && cert.canonicalIdentity.playersMapped === 'PARTIAL')
check('event mapping safe for sample only', cert.canonicalIdentity.eventsTotal === 14 && cert.canonicalIdentity.eventsExactMapped === 'SAMPLE_ONLY')
check('schedule/status contract defined', provider.includes('Schedule') && readiness.includes('scheduled'))
check('result contract defined', provider.includes('Results') && cert.settlement.overtimeSemantics === 'FULL_GAME_INCLUDES_OVERTIME')
check('quarter/half coverage audited', cert.historicalFoundation.quarterScores.includes('PARTIAL') && cert.settlement.periodScoreReadiness.includes('PARTIAL'))
check('boxscore coverage audited', cert.historicalFoundation.boxscores === 'PARTIAL_SAMPLE')
check('historical data inventory complete', cert.storedEvidence.teams === 30 && cert.storedEvidence.events === 14)
check('authorized imports idempotent by plan', readiness.includes('checkpoint/resume') && cert.nba02Target.checkpointStrategy.includes('idempotent'))
check('no duplicate events overclaimed', cert.canonicalIdentity.duplicateEvents === 'NOT_CERTIFIED_BY_FULL_IMPORT')
check('no orphan results overclaimed', cert.canonicalIdentity.orphanEvents === 'NOT_CERTIFIED_BY_FULL_IMPORT')
check('feature store audited', cert.storedEvidence.featureSnapshots === 47 && cert.featureStore.featuresReady.includes('trial lineage counters'))
check('leakage risks documented', cert.featureStore.leakageRisks.length >= 3)
check('Prediction Engine V1 certified/reused', cert.existingFoundation.nbaPredictionEngineV1.action === 'REUSE_WITH_CERTIFICATION')
check('settlement audited', cert.settlement.moneyline.includes('CONTRACT_READY'))
check('learning audited through no production writes', cert.accounting.currentEraPredictionWrites === 0)
check('calibration audited', cert.calibration.moneyline.currentStatus === 'INSUFFICIENT_DATA')
check('Current Board plan ready', cert.operationsPlan.currentBoardPlan.includes('extend'))
check('R2 reuse plan ready', cert.operationsPlan.r2Plan.includes('line-versioning'))
check('scheduler plan ready', cert.operationsPlan.schedulerPlan.includes('no NBA jobs activated'))
check('provider budget estimated', cert.theOddsApi.explicitBudgetAuthorizationRequired === true)
check('replay blockers exact', cert.replayReadiness.moneyline.replayType === 'PARTIAL_REPLAY' && cert.replayReadiness.firstHalfTotal.replayType === 'BLOCKED')
check('NBA-02 scope prepared', cert.nextPhase === 'NBA-02_COMPLETE_HISTORICAL_FEATURE_RECONSTRUCTION_AND_REPLAY')
check('no production activation', cert.sportRegistry.productionReady === false && cert.stopBoundaries.nbaProductionActivationAuthorized === false)
check('no historical prediction fabrication', cert.accounting.historicalPredictionsGenerated === 0)
check('MLB regression clean', cert.mlbRegression.status === 'MLB_FINAL_CERTIFIED_WITH_FORWARD_MARKETS' && cert.mlbRegression.sportsDataIoRoutineMlbCalls === 0)
check('provider doc records no SportsDataIO expansion', provider.includes('not expanded'))
check('foundation doc records 0 production-eligible snapshots', foundation.includes('Production-eligible feature snapshots | 0'))
check('readiness doc separates model and price-aware replay', readiness.includes('MODEL_REPLAY') && readiness.includes('PRICE_AWARE_REPLAY'))
check('pilot doc records zero accounting', pilot.includes('| The Odds API calls | 0 |') && pilot.includes('| Database mutations | 0 |'))
check('master plan still says no implementation started by plan', plan.includes('No implementation is started by this plan.'))

const secretPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+/i,
  /CRON_SECRET\s*=\s*['"][^'"]+/i,
  /THE_ODDS_API_KEY\s*=\s*['"][^'"]+/i,
  /SPORTSDATAIO_MLB_API_KEY\s*=\s*['"][^'"]+/i,
  /Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/i,
]

for (const file of files) {
  const text = read(file)
  check(`no secret value exposed in ${file}`, !secretPatterns.some((pattern) => pattern.test(text)))
}

const failed = checks.filter((item) => !item.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'nba_01_data_foundation_provider_independence_validation_v1',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed.map((item) => item.name),
  providerCallsMade: 0,
  databaseMutationsMade: 0,
  classification: cert.finalClassification
}, null, 2))

if (failed.length) process.exit(1)
