export const NBA_02A_RECONSTRUCTION_VERSION =
  'nba_historical_feature_reconstruction_v1'

export const NBA_02A_REPLAY_REGIME = 'NBA_HISTORICAL_REPLAY_SHADOW'

export const NBA_02A_MODEL_VERSION = 'nba_prediction_engine_v1'

export const NBA_02A_FEATURE_VERSION =
  'nba_historical_pregame_feature_set_v1'

export type Nba02aFeatureClass =
  | 'RECONSTRUCTABLE_EXACT'
  | 'RECONSTRUCTABLE_DERIVED'
  | 'RECONSTRUCTABLE_WITH_LIMITATION'
  | 'CURRENT_ONLY'
  | 'UNAVAILABLE_HISTORICALLY'
  | 'LEAKAGE_RISK'

export type Nba02aFeatureContract = {
  name: string
  modelField: string
  required: boolean
  classification: Nba02aFeatureClass
  source: string
  temporalRequirement: string
  fallback: string
  replayBlocking: boolean
}

export const NBA_02A_FEATURE_CONTRACTS: Nba02aFeatureContract[] = [
  {
    name: 'event_context',
    modelField: 'event.home_team/event.away_team/start_time/status',
    required: true,
    classification: 'RECONSTRUCTABLE_EXACT',
    source: 'sport_events',
    temporalRequirement: 'current game identity is known before inference',
    fallback: 'block if event identity is incomplete',
    replayBlocking: true,
  },
  {
    name: 'team_record_to_date',
    modelField: 'wins/losses/winPct',
    required: true,
    classification: 'RECONSTRUCTABLE_DERIVED',
    source: 'prior completed sport_events and sport_game_stats',
    temporalRequirement: 'only games with start_time earlier than feature_as_of',
    fallback: '0-0 neutral fallback for season opener',
    replayBlocking: false,
  },
  {
    name: 'recent_form_last_10',
    modelField: 'recentWinPct',
    required: true,
    classification: 'RECONSTRUCTABLE_DERIVED',
    source: 'prior completed sport_events and sport_game_stats',
    temporalRequirement: 'last ten prior games only; never same game',
    fallback: 'season-to-date or neutral 0.500 early-season fallback',
    replayBlocking: false,
  },
  {
    name: 'home_away_splits',
    modelField: 'homeWinPct/awayWinPct',
    required: true,
    classification: 'RECONSTRUCTABLE_DERIVED',
    source: 'prior completed home/away games',
    temporalRequirement: 'prior games at matching venue split only',
    fallback: 'overall season-to-date or neutral 0.500',
    replayBlocking: false,
  },
  {
    name: 'scoring_profile',
    modelField: 'pointsPerGame/pointsAllowed/netRating',
    required: true,
    classification: 'RECONSTRUCTABLE_DERIVED',
    source: 'prior sport_game_stats rows',
    temporalRequirement: 'same-game team stats excluded until after game final',
    fallback: 'engine defaults 114 points for/allowed, neutral net rating',
    replayBlocking: false,
  },
  {
    name: 'first_half_scoring_context',
    modelField: 'firstHalfTotal projection',
    required: false,
    classification: 'RECONSTRUCTABLE_WITH_LIMITATION',
    source: 'prior sport_game_stats.first_half_points and quarter_scores',
    temporalRequirement: 'prior quarter/half rows only',
    fallback: 'current engine 0.49 projected full-game split',
    replayBlocking: false,
  },
  {
    name: 'injury_context',
    modelField: 'injuryLineupConfidence.confidence.penalty',
    required: false,
    classification: 'UNAVAILABLE_HISTORICALLY',
    source: 'sport_injuries current/trial rows only',
    temporalRequirement: 'must be timestamped before cutoff if ever used',
    fallback: 'unavailable warning/penalty only; no confidence lift',
    replayBlocking: false,
  },
  {
    name: 'lineup_context',
    modelField: 'lineupFeed.availabilityStatus',
    required: false,
    classification: 'UNAVAILABLE_HISTORICALLY',
    source: 'sport_lineups trial/current rows only',
    temporalRequirement: 'do not infer starters from postgame participation',
    fallback: 'unavailable warning/penalty only; no confidence lift',
    replayBlocking: false,
  },
  {
    name: 'player_stats_context',
    modelField: 'player_stats_context',
    required: false,
    classification: 'RECONSTRUCTABLE_WITH_LIMITATION',
    source: 'prior sport_player_stats rows',
    temporalRequirement: 'player game rows are postgame and can affect only later games',
    fallback: 'team-only replay when not required by current engine',
    replayBlocking: false,
  },
  {
    name: 'market_odds',
    modelField: 'odds/line/impliedProbability',
    required: false,
    classification: 'RECONSTRUCTABLE_EXACT',
    source: 'sports_odds_snapshots',
    temporalRequirement: 'snapshot_time must be before game start',
    fallback: 'MODEL_REPLAY without price-aware evaluation',
    replayBlocking: false,
  },
]

export function buildNba02aFeatureSnapshotKey(input: {
  eventId: string
  market: string
  featureAsOf: string
  modelVersion?: string
  featureVersion?: string
  regime?: string
}) {
  return [
    'basketball_nba',
    input.eventId,
    input.market,
    input.modelVersion ?? NBA_02A_MODEL_VERSION,
    input.featureVersion ?? NBA_02A_FEATURE_VERSION,
    input.regime ?? NBA_02A_REPLAY_REGIME,
    input.featureAsOf,
  ].join('|')
}

export function assertNba02aPregameTemporalSafety(input: {
  featureAsOf: string
  gameStartTime: string
  oddsTimestamp?: string | null
}) {
  const featureTime = Date.parse(input.featureAsOf)
  const startTime = Date.parse(input.gameStartTime)
  const oddsTime = input.oddsTimestamp ? Date.parse(input.oddsTimestamp) : null
  const failures: string[] = []

  if (!Number.isFinite(featureTime)) failures.push('INVALID_FEATURE_AS_OF')
  if (!Number.isFinite(startTime)) failures.push('INVALID_GAME_START_TIME')
  if (Number.isFinite(featureTime) && Number.isFinite(startTime) && featureTime >= startTime) {
    failures.push('FEATURE_AS_OF_NOT_BEFORE_START')
  }
  if (
    oddsTime !== null &&
    (!Number.isFinite(oddsTime) || (Number.isFinite(startTime) && oddsTime >= startTime))
  ) {
    failures.push('ODDS_TIMESTAMP_NOT_PREGAME')
  }

  return {
    passed: failures.length === 0,
    failures,
  }
}

export function getNba02aReplayReadinessContract() {
  const requiredBlockingFeatures = NBA_02A_FEATURE_CONTRACTS.filter(
    (feature) => feature.required && feature.replayBlocking
  )
  const optionalUnavailable = NBA_02A_FEATURE_CONTRACTS.filter(
    (feature) => !feature.required && feature.classification === 'UNAVAILABLE_HISTORICALLY'
  )

  return {
    version: NBA_02A_RECONSTRUCTION_VERSION,
    replayRegime: NBA_02A_REPLAY_REGIME,
    modelVersion: NBA_02A_MODEL_VERSION,
    featureVersion: NBA_02A_FEATURE_VERSION,
    supportedMarkets: ['moneyline', 'spread', 'total', 'first_half'],
    modelReplayRequires: [
      'canonical event identity',
      'pregame feature_as_of before game start',
      'prior-only team record/form/scoring context',
    ],
    priceAwareReplayRequires: [
      'MODEL_REPLAY_READY',
      'sports_odds_snapshots row with event/market/selection/line/sportsbook identity',
      'snapshot_time before game start',
    ],
    storagePlan: {
      featureSnapshots: 'historical_feature_snapshots',
      futurePredictions: 'prediction_history',
      regimeFields: ['trial', 'scrambled', 'production_eligible', 'model_role', 'feature_snapshot'],
      predictionWritesInNba02a: 0,
      productionWritesInNba02a: 0,
    },
    requiredBlockingFeatureCount: requiredBlockingFeatures.length,
    optionalUnavailableFeatureCount: optionalUnavailable.length,
    featureContracts: NBA_02A_FEATURE_CONTRACTS,
  }
}

export function validateNba02aHistoricalFeatureReconstructionContract() {
  const key = buildNba02aFeatureSnapshotKey({
    eventId: 'nba_bdl_857401',
    market: 'moneyline',
    featureAsOf: '2022-10-19T22:00:00.000Z',
  })
  const keyAgain = buildNba02aFeatureSnapshotKey({
    eventId: 'nba_bdl_857401',
    market: 'moneyline',
    featureAsOf: '2022-10-19T22:00:00.000Z',
  })
  const safe = assertNba02aPregameTemporalSafety({
    featureAsOf: '2022-10-19T22:00:00.000Z',
    gameStartTime: '2022-10-20T00:00:00.000Z',
    oddsTimestamp: '2022-10-19T21:55:00.000Z',
  })
  const unsafe = assertNba02aPregameTemporalSafety({
    featureAsOf: '2022-10-20T00:00:00.000Z',
    gameStartTime: '2022-10-20T00:00:00.000Z',
    oddsTimestamp: '2022-10-20T00:01:00.000Z',
  })

  return {
    success:
      key === keyAgain &&
      safe.passed &&
      !unsafe.passed &&
      unsafe.failures.includes('FEATURE_AS_OF_NOT_BEFORE_START') &&
      unsafe.failures.includes('ODDS_TIMESTAMP_NOT_PREGAME') &&
      NBA_02A_FEATURE_CONTRACTS.every((feature) => feature.temporalRequirement.length > 0) &&
      NBA_02A_FEATURE_CONTRACTS.some((feature) => feature.name === 'injury_context' && !feature.required) &&
      NBA_02A_FEATURE_CONTRACTS.some((feature) => feature.name === 'lineup_context' && !feature.required),
    key,
    contract: getNba02aReplayReadinessContract(),
    cases: { safe, unsafe },
  }
}
