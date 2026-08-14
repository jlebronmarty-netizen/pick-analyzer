import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const certPath = path.join(root, 'docs', 'CERTIFICATION', 'nba-02a-historical-feature-reconstruction.json')
const docPath = path.join(root, 'docs', 'PRODUCTION_PILOT', 'NBA_02A_HISTORICAL_FEATURE_RECONSTRUCTION.md')
const servicePath = path.join(root, 'src', 'services', 'nba-historical-feature-reconstruction.service.ts')

const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'))
const doc = fs.readFileSync(docPath, 'utf8')
const service = fs.readFileSync(servicePath, 'utf8')

const checks = []

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('certification status is replay canary ready', cert.status === 'NBA_02A_HISTORICAL_FEATURE_RECONSTRUCTION_PASS_READY_FOR_REPLAY_CANARY')
check('provider calls are zero', cert.providerCalls.ballDontLie === 0 && cert.providerCalls.theOddsApiHistorical === 0 && cert.providerCalls.sportsDataIo === 0)
check('no NBA prediction writes', cert.productionWrites.predictionWrites === 0)
check('no NBA current era writes', cert.productionWrites.currentEraWrites === 0)
check('no NBA official pick writes', cert.productionWrites.officialPickWrites === 0)
check('no production calibration writes', cert.productionWrites.productionCalibrationWrites === 0)
check('no production learning writes', cert.productionWrites.productionLearningWrites === 0)
check('canonical NBA games reconciled', cert.foundation.canonicalGames === 3710)
check('final NBA results reconciled', cert.foundation.finalResults === 3710)
check('team-game stats are two per game', cert.foundation.teamGameStats === cert.foundation.canonicalGames * 2)
check('quarter-score evidence present on team rows', cert.foundation.quarterScoreRows === cert.foundation.teamGameStats)
check('historical odds rows audited', cert.odds.rowsAudited === 29214)
check('post-start odds rejected', cert.odds.postStartRejected === 738)
check('no post-start odds accepted as replay ready', cert.leakage.oddsPostStartLeakageFailures === 0)
check('model replay events quantified', cert.replayReadiness.modelReplayReadyEvents === 3710)
check('model replay prediction volume quantified', cert.replayReadiness.expectedModelReplayPredictions === 14840)
check('moneyline price-aware events quantified', cert.replayReadiness.priceAwareMoneylineReady === 1196)
check('spread price-aware events quantified', cert.replayReadiness.priceAwareSpreadReady === 1196)
check('total price-aware events quantified', cert.replayReadiness.priceAwareTotalReady === 1196)
check('first-half price-aware unavailable', cert.replayReadiness.priceAwareFirstHalfReady === 0)
check('box scores not required', cert.modelContract.boxScoresRequired === false)
check('lineups not required', cert.modelContract.lineupsRequired === false)
check('injuries not required', cert.modelContract.injuriesRequired === false)
check('historical feature snapshots not persisted in NBA-02A', cert.featureReconstruction.historicalFeatureSnapshotsPersisted === 0)
check('deterministic feature key service exists', service.includes('buildNba02aFeatureSnapshotKey'))
check('temporal safety guard exists', service.includes('assertNba02aPregameTemporalSafety'))
check('feature_as_of must be before start', service.includes('FEATURE_AS_OF_NOT_BEFORE_START'))
check('odds timestamp must be pregame', service.includes('ODDS_TIMESTAMP_NOT_PREGAME'))
check('replay regime is shadow', service.includes('NBA_HISTORICAL_REPLAY_SHADOW') && cert.replayIsolation.historicalReplayRegime === 'NBA_HISTORICAL_REPLAY_SHADOW')
check('current model markets represented', ['moneyline', 'spread', 'total', 'first_half'].every((market) => cert.modelContract.supportedMarkets.includes(market)))
check('feature coverage includes required event context', cert.featureCoverage.some((item) => item.name === 'event_context' && item.required === true))
check('injury unavailable is non-blocking', cert.featureCoverage.some((item) => item.name === 'injury_context' && item.blocking === false))
check('lineup unavailable is non-blocking', cert.featureCoverage.some((item) => item.name === 'lineup_context' && item.blocking === false))
check('doc states no bulk replay', doc.includes('does not run bulk replay'))
check('doc states no provider calls', doc.includes('Provider calls during NBA-02A'))
check('doc names next replay canary phase', doc.includes('NBA-02B1_REPLAY_CANARY'))
check('MLB parallel state preserved', cert.mlbParallelStatus.sportsDataIoRoutineExternalCalls === 0 && cert.mlbParallelStatus.bootstrapSettled === 0)

const failed = checks.filter((item) => !item.passed)

if (failed.length) {
  console.error(`\nnba_02a_historical_feature_reconstruction_validate_v1 FAIL ${failed.length}/${checks.length}`)
  process.exit(1)
}

console.log(`\nnba_02a_historical_feature_reconstruction_validate_v1 PASS ${checks.length}/${checks.length}`)
