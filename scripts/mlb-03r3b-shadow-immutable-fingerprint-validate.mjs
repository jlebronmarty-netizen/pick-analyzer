import {
  canonicalizeMlbShadowImmutableEvidence,
  fingerprintMlbShadowImmutableEvidence,
  immutableEvidenceFromMlbShadowRow,
  MLB_SHADOW_IMMUTABLE_FINGERPRINT_VERSION,
  serializeMlbShadowImmutableEvidence,
} from './lib/mlb-shadow-immutable-fingerprint.mjs'

function check(name, pass) {
  if (!pass) throw new Error(`${name} failed`)
}

const canary1Fixture = {
  sport_key: 'baseball_mlb',
  game_id: 'baseball_mlb:mlb:sportsdataio:event:79208',
  market: 'moneyline',
  selection: 'WSH',
  line: null,
  sportsbook: 'betmgm',
  odds: 155,
  odds_timestamp: '2026-08-20T22:27:10.697Z',
  implied_probability: 0.39215686274509803,
  raw_model_probability: 0.40979999999999994,
  calibrated_probability: 0.5123,
  model_version: 'MLB_CALIBRATED_SHADOW_V1',
  calibration_version: 'mlb_market_empirical_calibration_v1_2026_08_20',
  candidate_key:
    'baseball_mlb|baseball_mlb:mlb:sportsdataio:event:79208|moneyline|wsh|null|betmgm|CURRENT_ERA_SHADOW|MLB_CALIBRATED_SHADOW_V1|mlb_market_empirical_calibration_v1_2026_08_20|MORNING',
  idempotency_key:
    'baseball_mlb|baseball_mlb:mlb:sportsdataio:event:79208|moneyline|wsh|null|betmgm|CURRENT_ERA_SHADOW|MLB_CALIBRATED_SHADOW_V1|mlb_market_empirical_calibration_v1_2026_08_20|MORNING',
  source_prediction_id: 'ab11fa9b-7d92-5816-972e-e1186756393b',
  snapshot_type: 'MORNING',
}

const expectedCanary1Fingerprint = '78868b4ef923ee5155cee83c2fa865ccf6c4943ecf31f45176cc7bd9f372be48'
const baseline = fingerprintMlbShadowImmutableEvidence(canary1Fixture)
const reordered = fingerprintMlbShadowImmutableEvidence({
  snapshot_type: canary1Fixture.snapshot_type,
  source_prediction_id: canary1Fixture.source_prediction_id,
  idempotency_key: canary1Fixture.idempotency_key,
  candidate_key: canary1Fixture.candidate_key,
  calibration_version: canary1Fixture.calibration_version,
  model_version: canary1Fixture.model_version,
  calibrated_probability: '0.5123000',
  raw_model_probability: '0.409800',
  implied_probability: '0.39215686274509803',
  odds_timestamp: '2026-08-20 22:27:10.697+00',
  odds: '155',
  sportsbook: 'BetMGM',
  line: null,
  selection: 'wsh',
  market: 'MONEYLINE',
  game_id: canary1Fixture.game_id,
  sport_key: canary1Fixture.sport_key,
  status: 'settled',
  result: 'win',
  settled_at: '2026-08-21T04:00:00.000Z',
})

const sportsbookChanged = fingerprintMlbShadowImmutableEvidence({ ...canary1Fixture, sportsbook: 'draftkings' })
const oddsChanged = fingerprintMlbShadowImmutableEvidence({ ...canary1Fixture, odds: 156 })
const lineChanged = fingerprintMlbShadowImmutableEvidence({ ...canary1Fixture, line: 1.5 })
const calibratedChanged = fingerprintMlbShadowImmutableEvidence({ ...canary1Fixture, calibrated_probability: 0.5124 })
const sourceChanged = fingerprintMlbShadowImmutableEvidence({ ...canary1Fixture, source_prediction_id: 'different-source' })

const rowFixture = {
  sport_key: canary1Fixture.sport_key,
  game_id: canary1Fixture.game_id,
  market: canary1Fixture.market,
  selection: canary1Fixture.selection,
  line: canary1Fixture.line,
  sportsbook: canary1Fixture.sportsbook,
  odds: canary1Fixture.odds,
  odds_timestamp: '2026-08-20T22:27:10.697+00:00',
  implied_probability: 39.2157,
  model_probability: 51.23,
  model_version: canary1Fixture.model_version,
  prediction_group_key: canary1Fixture.candidate_key,
  idempotency_key: canary1Fixture.idempotency_key,
  parent_prediction_id: canary1Fixture.source_prediction_id,
  certification_metadata: {
    rawModelProbability: 0.40979999999999994,
    calibratedProbability: 0.5123,
    calibrationVersion: canary1Fixture.calibration_version,
    candidateKey: canary1Fixture.candidate_key,
    sourcePredictionId: canary1Fixture.source_prediction_id,
    snapshotType: canary1Fixture.snapshot_type,
    selectedPriceEvidence: {
      oddsTimestamp: canary1Fixture.odds_timestamp,
      impliedProbability: canary1Fixture.implied_probability,
    },
  },
}

check('version constant matches certified contract', MLB_SHADOW_IMMUTABLE_FINGERPRINT_VERSION === 'mlb_current_era_shadow_canary_immutable_fingerprint_v1')
check('canary 1 canonical reproduction', baseline === expectedCanary1Fingerprint)
check('different object key order stable', reordered === baseline)
check('timestamp formatting stable', reordered === baseline)
check('lifecycle fields excluded', reordered === baseline)
check('sportsbook change changes fingerprint', sportsbookChanged !== baseline)
check('odds change changes fingerprint', oddsChanged !== baseline)
check('line change changes fingerprint', lineChanged !== baseline)
check('calibrated probability change changes fingerprint', calibratedChanged !== baseline)
check('source prediction change changes fingerprint', sourceChanged !== baseline)
check('line remains canonical null', canonicalizeMlbShadowImmutableEvidence(canary1Fixture).line === null)
check('row extraction reproduces canary 1', fingerprintMlbShadowImmutableEvidence(immutableEvidenceFromMlbShadowRow(rowFixture)) === baseline)

console.log(JSON.stringify({
  success: true,
  mode: 'mlb_03r3b_shadow_immutable_fingerprint_validator_v1',
  version: MLB_SHADOW_IMMUTABLE_FINGERPRINT_VERSION,
  canonicalSerializedPayload: serializeMlbShadowImmutableEvidence(canary1Fixture),
  canary1Fingerprint: baseline,
  checks: 12,
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))
