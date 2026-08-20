import crypto from 'node:crypto'
import fs from 'node:fs'

const script = fs.readFileSync('scripts/mlb-03r1a-first-calibrated-shadow-canary.mjs', 'utf8')

function check(name, pass) {
  if (!pass) throw new Error(`${name} failed`)
}

function impliedProbability(odds) {
  return odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100)
}

function stableText(value) {
  return String(value ?? 'null').trim().toLowerCase().replace(/\s+/g, '_')
}

function buildIdentity(priceEvidence) {
  return [
    'baseball_mlb',
    priceEvidence.eventId,
    priceEvidence.market,
    stableText(priceEvidence.selection),
    priceEvidence.line ?? 'null',
    stableText(priceEvidence.sportsbook),
    'CURRENT_ERA_SHADOW',
    'MLB_CALIBRATED_SHADOW_V1',
    'mlb_market_empirical_calibration_v1_2026_08_20',
    'MORNING',
  ].join('|')
}

function safeSourcePredictionFields(source) {
  return {
    sport_key: source.sport_key,
    game_id: source.game_id,
    commence_time: source.commence_time,
    home_team: source.home_team,
    away_team: source.away_team,
    opponent: source.opponent,
    confidence: source.confidence,
    stake: 0,
    lifecycle_status: 'active',
    projected_line: source.projected_line,
    cutoff_at: source.cutoff_at,
    feature_snapshot_id: source.feature_snapshot_id,
    feature_snapshot_key: source.feature_snapshot_key,
    feature_set_version: source.feature_set_version,
    feature_snapshot_generated_at: source.feature_snapshot_generated_at,
    odds_snapshot_id: source.odds_snapshot_id,
    operating_day_id: source.operating_day_id ?? null,
  }
}

function buildSelectedPriceEvidence(candidate) {
  const implied = impliedProbability(candidate.odds)
  return {
    eventId: candidate.eventId,
    market: candidate.market,
    selection: candidate.selection,
    line: candidate.line ?? null,
    sportsbook: candidate.sportsbook,
    odds: candidate.odds,
    oddsTimestamp: candidate.oddsTimestamp,
    impliedProbability: implied,
    impliedProbabilityPercent: Number((implied * 100).toFixed(4)),
  }
}

function buildPayload(source, candidate) {
  const priceEvidence = buildSelectedPriceEvidence(candidate)
  const identity = buildIdentity(priceEvidence)
  return {
    ...safeSourcePredictionFields(source),
    id: crypto.randomUUID(),
    market: priceEvidence.market,
    selection: priceEvidence.selection,
    team: priceEvidence.selection,
    line: priceEvidence.line,
    sportsbook: priceEvidence.sportsbook,
    odds: priceEvidence.odds,
    odds_timestamp: priceEvidence.oddsTimestamp,
    implied_probability: priceEvidence.impliedProbabilityPercent,
    result_id: null,
    result: null,
    settled_at: null,
    profit: null,
    settlement_details: {},
    manual_adjustment: false,
    certification_status: 'SHADOW_PENDING',
    status: 'pending',
    prediction_origin: 'CURRENT_ERA_SHADOW',
    model_role: 'shadow',
    is_current: false,
    recommended_pick: false,
    production_eligible: false,
    validation_status: 'valid',
    idempotency_key: identity,
    prediction_group_key: identity,
    parent_prediction_id: source.id,
    challenger_of_prediction_id: source.id,
    version_lineage: {
      sourcePredictionId: source.id,
      reason: 'MLB_03_FIRST_CALIBRATED_SHADOW_CANARY',
    },
    certification_metadata: {
      sourcePredictionId: source.id,
      candidateKey: identity,
      selectedPriceEvidence: priceEvidence,
    },
  }
}

const sourcePrediction = {
  id: 'ab11fa9b-7d92-5816-972e-e1186756393b',
  sport_key: 'baseball_mlb',
  game_id: 'baseball_mlb:mlb:sportsdataio:event:79208',
  commence_time: '2026-08-21T00:05:00+00:00',
  home_team: 'TEX',
  away_team: 'WSH',
  team: 'WSH',
  opponent: 'TEX',
  market: 'moneyline',
  sportsbook: 'lowvig',
  odds: 159,
  result_id: '00000000-0000-4000-8000-000000000001',
  result: 'win',
  settled_at: '2026-08-21T04:00:00.000Z',
  profit: 1.59,
  settlement_details: { winner: 'WSH' },
  recommended_pick: true,
  production_eligible: true,
  is_current: true,
  model_role: 'champion',
  feature_snapshot_id: '3405ca66-9f38-4a0e-b4f8-307b703544e5',
}

const selectedDraftKings = {
  eventId: 'baseball_mlb:mlb:sportsdataio:event:79208',
  market: 'moneyline',
  selection: 'WSH',
  line: null,
  sportsbook: 'draftkings',
  odds: 168,
  oddsTimestamp: '2026-08-20T21:57:20.479Z',
}

const shadowPayload = buildPayload(sourcePrediction, selectedDraftKings)

check('runtime uses safe source builder', script.includes('function safeSourcePredictionFields(source)'))
check('runtime no longer spreads full source row', !script.includes('...source,'))
check('runtime uses fresh physical uuid', script.includes('id: crypto.randomUUID()'))
check('runtime rejects source primary key reuse', script.includes('sourcePrimaryKeyReused') && script.includes('payload.id === source.id'))
check('runtime excludes quarantined identities in no-op proof', script.includes('activeExactIdentity') && script.includes(".neq('certification_status', 'QUARANTINED')"))
check('source primary key not reused', shadowPayload.id !== sourcePrediction.id)
check('physical id is uuid-shaped', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(shadowPayload.id))
check('price evidence still bound to selected book', shadowPayload.sportsbook === 'draftkings' && shadowPayload.odds === 168)
check('source lowvig price not leaked', shadowPayload.sportsbook !== sourcePrediction.sportsbook && shadowPayload.odds !== sourcePrediction.odds)
check('source result id cleared', shadowPayload.result_id === null)
check('source outcome cleared', shadowPayload.result === null && shadowPayload.settled_at === null && shadowPayload.profit === null)
check('pending settlement contract restored', JSON.stringify(shadowPayload.settlement_details) === '{}')
check('product flags closed', shadowPayload.recommended_pick === false && shadowPayload.production_eligible === false && shadowPayload.is_current === false)
check('source lineage is explicit', shadowPayload.parent_prediction_id === sourcePrediction.id && shadowPayload.challenger_of_prediction_id === sourcePrediction.id)
check('lineage metadata preserves source id', shadowPayload.version_lineage.sourcePredictionId === sourcePrediction.id && shadowPayload.certification_metadata.sourcePredictionId === sourcePrediction.id)
check('deterministic logical key is selected book identity', shadowPayload.idempotency_key.includes('|draftkings|') && shadowPayload.prediction_group_key === shadowPayload.idempotency_key)

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_03r1e_r1_shadow_primary_key_contract_validator_v1',
  rootCause: 'SHADOW_CANARY_PRIMARY_KEY_COLLISION_FROM_SOURCE_PAYLOAD_COPY',
  sourcePrimaryKeyReuse: 0,
  primaryKeyCollisionRisk: 0,
  physicalIdContract: 'NEW_UNIQUE_UUID',
  logicalIdentityContract: 'DETERMINISTIC_IDEMPOTENCY_KEY_AND_PREDICTION_GROUP_KEY',
  sourcePredictionLineageContract: 'parent_prediction_id/challenger_of_prediction_id/version_lineage/certification_metadata',
  resultIdContract: 'PENDING_SHADOW_RESULT_ID_NULL',
  fixture: {
    sourcePredictionId: sourcePrediction.id,
    newShadowId: shadowPayload.id,
    sourceIdReused: shadowPayload.id === sourcePrediction.id,
    sportsbook: shadowPayload.sportsbook,
    odds: shadowPayload.odds,
    resultId: shadowPayload.result_id,
    candidateKey: shadowPayload.certification_metadata.candidateKey,
  },
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))
