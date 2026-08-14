import {
  NBA_02A_FEATURE_VERSION,
  NBA_02A_MODEL_VERSION,
  NBA_02A_RECONSTRUCTION_VERSION,
  NBA_02A_REPLAY_REGIME,
  assertNba02aPregameTemporalSafety,
  buildNba02aFeatureSnapshotKey,
} from '@/services/nba-historical-feature-reconstruction.service'

export const NBA_02B1_REPLAY_VERSION = 'NBA_MODEL_REPLAY_V1'
export const NBA_02B1_REPLAY_ORIGIN = 'HISTORICAL_REPLAY_SHADOW'
export const NBA_02B1_CANARY_VERSION = 'nba_02b1_replay_canary_v1'
export const NBA_02B1_MAX_GAMES = 36
export const NBA_02B1_TARGET_GAMES = 24
export const NBA_02B1_MARKETS = ['moneyline', 'spread', 'total', 'first_half'] as const

export type Nba02b1Market = (typeof NBA_02B1_MARKETS)[number]

export function buildNba02b1PredictionIdempotencyKey(input: {
  eventId: string
  market: Nba02b1Market
  selection: string
  line: number | null
}) {
  return [
    'basketball_nba',
    NBA_02B1_REPLAY_ORIGIN,
    NBA_02B1_REPLAY_VERSION,
    NBA_02A_MODEL_VERSION,
    NBA_02A_FEATURE_VERSION,
    input.eventId,
    input.market,
    input.selection,
    input.line === null ? 'null' : Number(input.line).toFixed(1),
  ].join('|')
}

export function buildNba02b1FeatureIdentity(input: {
  eventId: string
  market: Nba02b1Market
  featureAsOf: string
}) {
  return {
    reconstructionVersion: NBA_02A_RECONSTRUCTION_VERSION,
    replayRegime: NBA_02A_REPLAY_REGIME,
    replayVersion: NBA_02B1_REPLAY_VERSION,
    modelVersion: NBA_02A_MODEL_VERSION,
    featureVersion: NBA_02A_FEATURE_VERSION,
    featureSnapshotKey: buildNba02aFeatureSnapshotKey({
      eventId: input.eventId,
      market: input.market,
      featureAsOf: input.featureAsOf,
      modelVersion: NBA_02A_MODEL_VERSION,
      featureVersion: NBA_02A_FEATURE_VERSION,
      regime: NBA_02A_REPLAY_REGIME,
    }),
  }
}

export function validateNba02b1ReplayCanaryContract() {
  const featureAsOf = '2024-01-01T00:00:00.000Z'
  const gameStartTime = '2024-01-01T03:00:00.000Z'
  const identity = buildNba02b1FeatureIdentity({
    eventId: 'nba_canary_event',
    market: 'spread',
    featureAsOf,
  })
  const idempotencyKey = buildNba02b1PredictionIdempotencyKey({
    eventId: 'nba_canary_event',
    market: 'spread',
    selection: 'Boston Celtics',
    line: -4.5,
  })
  const safe = assertNba02aPregameTemporalSafety({
    featureAsOf,
    gameStartTime,
    oddsTimestamp: '2024-01-01T01:00:00.000Z',
  })
  const unsafe = assertNba02aPregameTemporalSafety({
    featureAsOf: gameStartTime,
    gameStartTime,
    oddsTimestamp: '2024-01-01T04:00:00.000Z',
  })

  return {
    success:
      NBA_02B1_MARKETS.length === 4 &&
      NBA_02B1_TARGET_GAMES <= NBA_02B1_MAX_GAMES &&
      idempotencyKey.includes(NBA_02B1_REPLAY_ORIGIN) &&
      identity.replayRegime === NBA_02A_REPLAY_REGIME &&
      identity.modelVersion === NBA_02A_MODEL_VERSION &&
      identity.featureVersion === NBA_02A_FEATURE_VERSION &&
      idempotencyKey ===
        buildNba02b1PredictionIdempotencyKey({
          eventId: 'nba_canary_event',
          market: 'spread',
          selection: 'Boston Celtics',
          line: -4.5,
        }) &&
      safe.passed &&
      !unsafe.passed,
    mode: NBA_02B1_CANARY_VERSION,
    identity,
    idempotencyKey,
    markets: NBA_02B1_MARKETS,
    replayVersion: NBA_02B1_REPLAY_VERSION,
    replayOrigin: NBA_02B1_REPLAY_ORIGIN,
    safe,
    unsafe,
  }
}
