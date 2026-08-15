import fs from 'node:fs'

const servicePath = 'src/services/nba-current-era-shadow-canary.service.ts'
const runnerPath = 'scripts/nba-03a-current-era-shadow-canary.mjs'
const testPath = 'scripts/nba-03a-single-candidate-writer-test.mjs'
const summaryPath = 'scripts/nba-03a-single-candidate-dry-run-summary.mjs'
const certPath = 'docs/CERTIFICATION/nba-03a-current-era-shadow-canary.json'
const docPath = 'docs/PRODUCTION_PILOT/NBA_03A_BLOCK5_CURRENT_ERA_SHADOW_CANARY.md'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

const service = read(servicePath)
const runner = read(runnerPath)
const test = read(testPath)
const summary = read(summaryPath)
const cert = JSON.parse(read(certPath))
const doc = read(docPath)
const checks = []

function check(name, passed) {
  checks.push({ name, passed: Boolean(passed) })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

check('status certified for single-candidate writer', cert.status === 'NBA_03A_BLOCK5_SINGLE_CANDIDATE_WRITER_CERTIFIED_READY_FOR_FIRST_SHADOW')
check('default mode remains dry-run', runner.includes(": 'dry-run'") && cert.canary.modeDefault === 'dry-run')
check('generic all-candidate write mode removed', !runner.includes("'write'") && !service.includes("mode === 'write'") && cert.canary.writeMode === 'write-one')
check('write-one exists and requires candidate key', runner.includes("'write-one'") && runner.includes('--candidate-key=') && runner.includes('WRITE_CARDINALITY_NOT_ONE'))
check('explicit stable candidate key exists', service.includes('buildNbaCurrentEraShadowCandidateKey') && service.includes('oddsId') && cert.writer.selector.includes('candidateKey'))
check('cardinality guard is shared and testable', service.includes('selectNbaCurrentEraShadowWriteCandidate') && service.includes("selected.length === 1 ? 'SELECTED' : 'WRITE_CARDINALITY_NOT_ONE'"))
check('savePredictionHistory receives exactly one row in write-one path', service.includes('savePredictionHistory([buildNbaCurrentEraShadowPredictionRow'))
check('model match is required', service.includes('MODEL_OUTPUT_MISSING') && service.includes('findNbaCurrentEraShadowModelPrediction') && cert.writer.modelOutputRequired === true)
check('model identity excludes sportsbook', service.includes('prediction.gameId === candidate.eventId') && service.includes('prediction.market === candidate.market') && service.includes('prediction.team === candidate.selection') && !service.includes('prediction.sportsbook === candidate.sportsbook'))
check('line identity is exact', service.includes('(prediction.line ?? null) === (candidate.line ?? null)') && cert.identity.modelPrediction.includes('line'))
check('price evidence identity preserves sportsbook odds id and timestamp', cert.identity.priceEvidence.includes('sportsbook') && cert.identity.priceEvidence.includes('oddsSnapshotId') && service.includes('priceEvidenceOddsSnapshotId'))
check('real -110 accepted with provenance', test.includes('real The Odds API -110 with timestamp should be price eligible') && cert.safety.realMinus110AllowedWithTimestamp === true)
check('fallback/default -110 forbidden', test.includes('fallbackMinus110Candidate') && service.includes('Number(odds.price) === -110 && !oddsTimestamp') && cert.safety.fakeMinus110Allowed === false)
check('CURRENT_ERA_SHADOW origin payload', service.includes("prediction_origin: 'CURRENT_ERA_SHADOW'") && service.includes("certification_status: 'SHADOW_PENDING'"))
check('Official Picks isolated', service.includes('recommended_pick: false') && service.includes('officialPickEligible: false') && cert.isolation.officialPickDelta === 0)
check('product visibility isolated', service.includes('productSurfaceVisible: false') && cert.isolation.productVisibilityDelta === 0)
check('learning/calibration isolated', service.includes('productionLearningEligible: false') && service.includes('productionCalibrationEligible: false'))
check('historical replay isolated', !service.includes("prediction_origin: 'HISTORICAL_REPLAY_SHADOW'") && cert.isolation.historicalReplayDelta === 0)
check('MLB isolated', cert.isolation.mlbMutationDelta === 0)
check('provider calls remain zero', !/fetch\s*\(/.test(service + runner + summary) && cert.accounting.providerCalls === 0)
check('dry-run summary is read-only', summary.includes("mode: 'dry-run'") && summary.includes('databaseMutationsFromDryRun'))
check('idempotency fixture covered', test.includes('ALREADY_EXISTS') && test.includes('duplicateInvocation'))
check('selector zero/one/multiple fixtures covered', test.includes('selectorZero') && test.includes('selectorOne') && test.includes('selectorMultiple'))
check('production dry-run found write-eligible model matches', cert.productionDryRun.writeEligible > 0 && cert.productionDryRun.modelMatched > 0)
check('production dry-run wrote no rows', cert.productionDryRun.currentEraShadowBefore === 0 && cert.productionDryRun.currentEraShadowAfter === 0 && cert.productionDryRun.inserts === 0)
check('first candidate key documented', typeof cert.productionDryRun.firstWriteEligible?.candidateKey === 'string' && doc.includes(cert.productionDryRun.firstWriteEligible.candidateKey))

const failed = checks.filter((item) => !item.passed)
console.log(`\nnba_03a_single_candidate_writer_validate_v1 ${failed.length ? 'FAIL' : 'PASS'} ${checks.length - failed.length}/${checks.length}`)
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2))
  process.exit(1)
}
