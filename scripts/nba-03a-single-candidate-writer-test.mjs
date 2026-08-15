import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    const raw = trimmed.slice(index + 1).trim()
    if (!key || process.env[key]) continue
    process.env[key] = raw.replace(/^['"]|['"]$/g, '')
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'))

const {
  buildNbaCurrentEraShadowCandidateKey,
  buildNbaCurrentEraShadowModelMatchKey,
  buildNbaCurrentEraShadowPredictionRow,
  evaluateNbaCurrentEraShadowCandidate,
  findNbaCurrentEraShadowModelPrediction,
  selectNbaCurrentEraShadowWriteCandidate,
} = await import('../src/services/nba-current-era-shadow-canary.service.ts')

const generatedAt = '2026-10-01T16:00:00.000Z'
const event = {
  id: 'nba-event-1',
  sport_key: 'basketball_nba',
  league_key: 'nba',
  season: '2026-27',
  away_team: 'Boston Celtics',
  home_team: 'Detroit Pistons',
  start_time: '2026-10-01T23:00:00.000Z',
  status: 'scheduled',
  metadata: { production_eligible: true },
}
const odds = {
  id: 'odds-fanduel-1',
  event_id: event.id,
  provider: 'the-odds-api',
  sportsbook: 'FanDuel',
  market: 'spread',
  outcome: 'Detroit Pistons',
  price: -110,
  line: -1.5,
  snapshot_time: '2026-10-01T15:58:00.000Z',
  provider_timestamp: '2026-10-01T15:58:00.000Z',
  metadata: { production_eligible: true },
}
const modelPrediction = {
  gameId: event.id,
  market: 'spread',
  team: 'Detroit Pistons',
  sportsbook: 'DraftKings',
  line: -1.5,
  odds: -108,
  modelProbability: 54.25,
  impliedProbability: 51.92,
  edge: 2.33,
  ev: 4.42,
  confidence: 61,
  projectedLine: -2.1,
  smartScore: 58,
  adaptiveScore: 62,
  riskGrade: 'medium',
}

const candidate = evaluateNbaCurrentEraShadowCandidate({
  event,
  odds,
  generatedAt,
  existingLogicalKeys: new Set(),
  modelPredictions: [modelPrediction],
})

assert.equal(candidate.priceEligible, true, 'real The Odds API -110 with timestamp should be price eligible')
assert.equal(candidate.modelMatched, true, 'canonical model match should not require the same sportsbook')
assert.equal(candidate.writeEligible, true, 'candidate should be write eligible when price and model both match')
assert.equal(candidate.modelMatchKey, buildNbaCurrentEraShadowModelMatchKey({
  eventId: event.id,
  market: odds.market,
  selection: odds.outcome,
  line: odds.line,
}))

const missingModelCandidate = evaluateNbaCurrentEraShadowCandidate({
  event,
  odds,
  generatedAt,
  existingLogicalKeys: new Set(),
  modelPredictions: [],
})
assert.equal(missingModelCandidate.priceEligible, true)
assert.equal(missingModelCandidate.modelMatched, false)
assert.equal(missingModelCandidate.writeEligible, false)
assert.ok(missingModelCandidate.skipReasons.includes('MODEL_OUTPUT_MISSING'))

const fallbackMinus110Candidate = evaluateNbaCurrentEraShadowCandidate({
  event,
  odds: { ...odds, id: 'fallback-odds', snapshot_time: '', provider_timestamp: null },
  generatedAt,
  existingLogicalKeys: new Set(),
  modelPredictions: [modelPrediction],
})
assert.equal(fallbackMinus110Candidate.writeEligible, false)
assert.ok(fallbackMinus110Candidate.skipReasons.includes('INVALID_ODDS_VALUE'))
assert.ok(fallbackMinus110Candidate.skipReasons.includes('MISSING_REAL_ODDS'))

const lineMismatch = findNbaCurrentEraShadowModelPrediction({
  candidate: { eventId: event.id, market: 'spread', selection: 'Detroit Pistons', line: -2.5 },
  modelPredictions: [modelPrediction],
})
assert.equal(lineMismatch, null, 'spread/total line mismatch must not bind to canonical model output')

const logicalKey = ['basketball_nba', event.id, odds.market, odds.outcome, odds.line, odds.sportsbook, 'CURRENT_ERA_SHADOW', 'nba_prediction_engine_v1'].join('|')
const duplicateCandidate = evaluateNbaCurrentEraShadowCandidate({
  event,
  odds,
  generatedAt,
  existingLogicalKeys: new Set([logicalKey]),
  modelPredictions: [modelPrediction],
})
assert.equal(duplicateCandidate.writeEligible, false)
assert.ok(duplicateCandidate.skipReasons.includes('ALREADY_EXISTS'))

const candidateKey = buildNbaCurrentEraShadowCandidateKey({
  eventId: event.id,
  market: odds.market,
  selection: odds.outcome,
  line: odds.line,
  sportsbook: odds.sportsbook,
  oddsId: odds.id,
})
assert.equal(candidate.candidateKey, candidateKey)
assert.equal(selectNbaCurrentEraShadowWriteCandidate({ candidates: [candidate], candidateKey }).status, 'SELECTED')
assert.equal(selectNbaCurrentEraShadowWriteCandidate({ candidates: [candidate], candidateKey: 'missing' }).status, 'WRITE_CARDINALITY_NOT_ONE')
assert.equal(selectNbaCurrentEraShadowWriteCandidate({ candidates: [candidate, candidate], candidateKey }).status, 'WRITE_CARDINALITY_NOT_ONE')

const row = buildNbaCurrentEraShadowPredictionRow({ event, odds, generatedAt, modelPrediction })
assert.equal(row.prediction_origin, 'CURRENT_ERA_SHADOW')
assert.equal(row.recommended_pick, false)
assert.equal(row.production_eligible, false)
assert.equal(row.sport_key, 'basketball_nba')
assert.equal(row.game_id, event.id)
assert.equal(row.team, odds.outcome)
assert.equal(row.market, odds.market)
assert.equal(row.line, odds.line)
assert.equal(row.sportsbook, odds.sportsbook)
assert.equal(row.odds, -110)
assert.equal(row.model_probability, modelPrediction.modelProbability)
assert.equal(row.confidence, modelPrediction.confidence)
assert.equal(row.certification_metadata.officialPickEligible, false)
assert.equal(row.certification_metadata.productionLearningEligible, false)
assert.equal(row.certification_metadata.productionCalibrationEligible, false)
assert.equal(row.certification_metadata.productSurfaceVisible, false)
assert.equal(row.certification_metadata.candidateKey, candidateKey)
assert.equal(row.certification_metadata.priceEvidenceProvider, 'the-odds-api')
assert.equal(row.feature_snapshot.modelMatchKey, candidate.modelMatchKey)

console.log(JSON.stringify({
  status: 'PASS',
  tests: {
    selectorZero: 'PASS',
    selectorOne: 'PASS',
    selectorMultiple: 'PASS',
    modelMissing: 'PASS',
    modelPriceMatch: 'PASS',
    realMinus110: 'PASS',
    fallbackMinus110: 'PASS',
    duplicateInvocation: 'PASS',
    sportsbookPriceAttachedToCanonicalPrediction: 'PASS',
    lineMismatchRejected: 'PASS',
    officialPickIsolation: 'PASS',
    historicalReplayIsolation: 'PASS',
  },
}, null, 2))
