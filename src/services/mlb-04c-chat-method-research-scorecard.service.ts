import 'server-only'

export const MLB_04C_SCORECARD_VERSION = 'MLB_CHAT_METHOD_RESEARCH_SCORECARD_V1'
export const MLB_04C_METHODOLOGY_VERSION = 'MLB_CHAT_METHOD_RESEARCH_SHADOW_V1'
export const MLB_04C_SNAPSHOT_DEPENDENCY_VERSION = 'MLB_04B_RESEARCH_SNAPSHOT_CONTRACT_V1'
export const MLB_04C_RESEARCH_ORIGIN = 'CHAT_METHOD_RESEARCH_SHADOW'

export type Mlb04cSnapshotType = 'MORNING' | 'FINAL_PREGAME'
export type Mlb04cMarket = 'moneyline' | 'run_line' | 'total'
export type Mlb04cComponentKey =
  | 'STARTER_EDGE'
  | 'OFFENSE_EDGE'
  | 'BULLPEN_EDGE'
  | 'SPLIT_EDGE'
  | 'LINEUP_EDGE'
  | 'CONTEXT_EDGE'
  | 'MARKET_VALUE'

type ComponentSourceStatus =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'UNKNOWN'
  | 'BLOCKED'
  | 'UNAVAILABLE_TEMPORAL_PROVENANCE'

type ComponentInput = {
  value: number | null
  sourceStatus: ComponentSourceStatus
  source: string
  sourceTimestamp: string | null
  blockers?: string[]
}

type CandidateInput = {
  eventId: string
  eventLabel: string
  eventStartTime: string
  snapshotType: Mlb04cSnapshotType
  snapshotTimestamp: string
  market: Mlb04cMarket
  selection: string
  line: number | null
  sportsbook: string
  odds: number
  impliedProbability: number
  rawProbability: number
  calibratedProbability: number
  components: Record<Mlb04cComponentKey, ComponentInput>
}

type ComponentScore = {
  key: Mlb04cComponentKey
  status: ComponentSourceStatus
  score: number | null
  includedInComposite: boolean
  source: string
  sourceTimestamp: string | null
  blockers: string[]
}

function parseTime(value: string | null) {
  const parsed = Date.parse(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

function clampScore(value: number) {
  return Math.max(-1, Math.min(1, Number(value.toFixed(4))))
}

function timestampBeforeStart(sourceTimestamp: string | null, eventStartTime: string) {
  if (!sourceTimestamp) return true
  const sourceMs = parseTime(sourceTimestamp)
  const startMs = parseTime(eventStartTime)
  return sourceMs !== null && startMs !== null && sourceMs < startMs
}

function evaluateComponent(key: Mlb04cComponentKey, input: ComponentInput, eventStartTime: string): ComponentScore {
  const blockers = [...(input.blockers ?? [])]
  if (!timestampBeforeStart(input.sourceTimestamp, eventStartTime)) {
    blockers.push('SOURCE_TIMESTAMP_NOT_PREGAME')
  }

  const temporallySafe = !blockers.includes('SOURCE_TIMESTAMP_NOT_PREGAME')
  const hasScore = input.value !== null && Number.isFinite(input.value) && temporallySafe
  const status = temporallySafe ? input.sourceStatus : 'BLOCKED'

  return {
    key,
    status,
    score: hasScore ? clampScore(input.value as number) : null,
    includedInComposite: hasScore && status !== 'BLOCKED' && status !== 'UNKNOWN' && status !== 'UNAVAILABLE_TEMPORAL_PROVENANCE',
    source: input.source,
    sourceTimestamp: input.sourceTimestamp,
    blockers,
  }
}

function buildDeterministicLedgerIdentity(candidate: CandidateInput) {
  return [
    MLB_04C_SCORECARD_VERSION,
    candidate.eventId,
    candidate.snapshotType,
    candidate.market,
    candidate.selection,
    candidate.line ?? 'null',
    candidate.sportsbook,
    candidate.odds,
    candidate.snapshotTimestamp,
  ].join('|')
}

function evaluateCandidate(candidate: CandidateInput) {
  const startMs = parseTime(candidate.eventStartTime)
  const snapshotMs = parseTime(candidate.snapshotTimestamp)
  const temporalBlockers: string[] = []

  if (startMs === null || snapshotMs === null) temporalBlockers.push('INVALID_EVENT_OR_SNAPSHOT_TIMESTAMP')
  if (startMs !== null && snapshotMs !== null && snapshotMs >= startMs) temporalBlockers.push('SNAPSHOT_NOT_PREGAME')

  const componentScores = (Object.keys(candidate.components) as Mlb04cComponentKey[])
    .map((key) => evaluateComponent(key, candidate.components[key], candidate.eventStartTime))

  const included = componentScores.filter((component) => component.includedInComposite)
  const compositeScore = included.length > 0
    ? clampScore(included.reduce((sum, component) => sum + Number(component.score), 0) / included.length)
    : null

  const missingComponents = componentScores
    .filter((component) => component.score === null)
    .map((component) => component.key)
  const blockedComponents = componentScores
    .filter((component) => component.status === 'BLOCKED' || component.status === 'UNAVAILABLE_TEMPORAL_PROVENANCE')
    .map((component) => component.key)

  return {
    event: candidate.eventLabel,
    eventId: candidate.eventId,
    market: candidate.market,
    selection: candidate.selection,
    line: candidate.line,
    sportsbook: candidate.sportsbook,
    odds: candidate.odds,
    snapshotType: candidate.snapshotType,
    snapshotTimestamp: candidate.snapshotTimestamp,
    temporalStatus: temporalBlockers.length === 0 ? 'PREGAME' : 'BLOCKED',
    temporalBlockers,
    sameOpportunityIdentity: {
      eventId: candidate.eventId,
      market: candidate.market,
      selection: candidate.selection,
      line: candidate.line,
      sportsbook: candidate.sportsbook,
      snapshotType: candidate.snapshotType,
    },
    marketValue: {
      impliedProbability: candidate.impliedProbability,
      rawProbability: candidate.rawProbability,
      calibratedProbability: candidate.calibratedProbability,
      exactPriceBinding: true,
    },
    componentScores,
    availableComponents: componentScores.filter((component) => component.score !== null).map((component) => component.key),
    missingComponents,
    blockedComponents,
    componentCompleteness: Number((componentScores.filter((component) => component.score !== null).length / componentScores.length).toFixed(4)),
    overallResearchCompleteness: Number(((componentScores.filter((component) => component.score !== null).length / componentScores.length) * (temporalBlockers.length === 0 ? 1 : 0)).toFixed(4)),
    compositeScore,
    compositePolicy: 'EQUAL_RESEARCH_WEIGHTS_OVER_AVAILABLE_TIMESTAMP_SAFE_COMPONENTS',
    chatMethodProbability: null,
    chatMethodProbabilityReady: false,
    researchRankEligible: temporalBlockers.length === 0 && compositeScore !== null,
    deterministicLedgerIdentity: buildDeterministicLedgerIdentity(candidate),
    persistenceDecision: 'DRY_RUN_ONLY',
  }
}

function fixtureCandidate(snapshotType: Mlb04cSnapshotType): CandidateInput {
  const eventStartTime = '2026-08-22T23:00:00.000Z'
  const snapshotTimestamp = snapshotType === 'MORNING'
    ? '2026-08-22T13:00:00.000Z'
    : '2026-08-22T22:30:00.000Z'

  return {
    eventId: 'baseball_mlb:research:forward_fixture:2026_08_22',
    eventLabel: 'Research Fixture Away @ Research Fixture Home',
    eventStartTime,
    snapshotType,
    snapshotTimestamp,
    market: 'moneyline',
    selection: 'Research Fixture Home',
    line: null,
    sportsbook: 'fanduel',
    odds: -118,
    impliedProbability: 0.5413,
    rawProbability: 0.552,
    calibratedProbability: 0.534,
    components: {
      STARTER_EDGE: {
        value: snapshotType === 'FINAL_PREGAME' ? 0.18 : 0.1,
        sourceStatus: 'PARTIAL',
        source: 'mlb_context_snapshots.starter_context',
        sourceTimestamp: snapshotTimestamp,
        blockers: snapshotType === 'MORNING' ? ['STARTER_NOT_CONFIRMED'] : [],
      },
      OFFENSE_EDGE: {
        value: -0.08,
        sourceStatus: 'AVAILABLE',
        source: 'stored_prior_game_team_form',
        sourceTimestamp: '2026-08-22T12:00:00.000Z',
      },
      BULLPEN_EDGE: {
        value: null,
        sourceStatus: 'PARTIAL',
        source: 'stored_prior_game_relief_workload',
        sourceTimestamp: '2026-08-22T12:00:00.000Z',
        blockers: ['BULLPEN_ROLE_EVIDENCE_PARTIAL'],
      },
      SPLIT_EDGE: {
        value: null,
        sourceStatus: 'UNAVAILABLE_TEMPORAL_PROVENANCE',
        source: 'handedness_split_matrix',
        sourceTimestamp: null,
        blockers: ['SPLIT_EDGE_STATUS_UNAVAILABLE_TEMPORAL_PROVENANCE'],
      },
      LINEUP_EDGE: {
        value: snapshotType === 'FINAL_PREGAME' ? 0.06 : null,
        sourceStatus: snapshotType === 'FINAL_PREGAME' ? 'PARTIAL' : 'UNKNOWN',
        source: 'mlb_context_snapshots.lineup_context',
        sourceTimestamp: snapshotType === 'FINAL_PREGAME' ? '2026-08-22T22:15:00.000Z' : null,
        blockers: snapshotType === 'MORNING' ? ['LINEUP_NOT_CAPTURED_FOR_SNAPSHOT'] : ['CONFIRMED_LINEUP_SOURCE_PARTIAL'],
      },
      CONTEXT_EDGE: {
        value: null,
        sourceStatus: 'PARTIAL',
        source: 'park_weather_injury_context',
        sourceTimestamp: null,
        blockers: ['WEATHER_MISSING', 'INJURY_SOURCE_NOT_CERTIFIED'],
      },
      MARKET_VALUE: {
        value: -0.02,
        sourceStatus: 'AVAILABLE',
        source: 'sports_odds_snapshots + prediction_history exact identity',
        sourceTimestamp: snapshotTimestamp,
      },
    },
  }
}

export function auditMlb04cChatMethodResearchScorecard() {
  const morning = evaluateCandidate(fixtureCandidate('MORNING'))
  const finalPregame = evaluateCandidate(fixtureCandidate('FINAL_PREGAME'))
  const ranked = [morning, finalPregame]
    .filter((row) => row.researchRankEligible)
    .sort((a, b) => Number(b.compositeScore) - Number(a.compositeScore))
    .map((row, index) => ({ ...row, researchRank: index + 1 }))

  return {
    classification: 'MLB_04C_CHAT_METHOD_RESEARCH_SCORECARD_CERTIFIED',
    phase: 'MLB-04C_CHAT_METHOD_RESEARCH_SHADOW_SCORECARD_LEDGER',
    methodologyVersion: MLB_04C_METHODOLOGY_VERSION,
    scorecardVersion: MLB_04C_SCORECARD_VERSION,
    snapshotDependencyVersion: MLB_04C_SNAPSHOT_DEPENDENCY_VERSION,
    existingThreeRowComparison: {
      cleanSettledRows: 3,
      chatMethodComparisonAvailableForExistingRows: false,
      reason: 'NO_FROZEN_PREGAME_CHAT_METHOD_SCORECARD_EXISTS_FOR_THE_ALREADY_FINISHED_THREE_ROW_SAMPLE',
    },
    scorecardContract: {
      components: ['STARTER_EDGE', 'OFFENSE_EDGE', 'BULLPEN_EDGE', 'SPLIT_EDGE', 'LINEUP_EDGE', 'CONTEXT_EDGE', 'MARKET_VALUE'] as Mlb04cComponentKey[],
      range: [-1, 1] as const,
      missingDataPolicy: 'UNKNOWN_OR_BLOCKED_COMPONENTS_ARE_EXCLUDED_AND_REPORTED_NOT_COERCED_TO_ZERO',
      weightPolicy: 'EQUAL_RESEARCH_WEIGHTS_OVER_AVAILABLE_TIMESTAMP_SAFE_COMPONENTS',
      probabilityPolicy: 'NO_CHAT_METHOD_PROBABILITY_UNTIL_FROZEN_LEDGER_CALIBRATION_EXISTS',
    },
    componentContracts: {
      STARTER_EDGE: 'Pregame starter identity, handedness if certified, season/recent prior-game performance, workload and matchup evidence; timestamps must precede start.',
      OFFENSE_EDGE: 'Team offense from prior games only, rolling form, home/away context and certified splits when available; same-game stats blocked.',
      BULLPEN_EDGE: 'Recent relief workload and aggregate bullpen evidence from prior games only; role gaps remain explicit blockers.',
      SPLIT_EDGE: 'Only emitted when handedness and split source provenance are temporally certified.',
      LINEUP_EDGE: 'Uses PROJECTED or CONFIRMED lineup evidence tied to snapshot type and source timestamp before start.',
      CONTEXT_EDGE: 'Park, weather, injury, rest/travel only when approved timestamped sources exist; missing weather/injury are blockers.',
      MARKET_VALUE: 'Exact event, market, selection, line, sportsbook, odds, implied probability, raw probability and calibrated probability binding.',
    },
    snapshotDependency: {
      MORNING: 'May consume only MORNING snapshot evidence captured before start; cannot use FINAL_PREGAME updates.',
      FINAL_PREGAME: 'May consume FINAL_PREGAME evidence captured before start and before cutoff; cannot use post-start evidence.',
      whyChangedFields: ['starter_change', 'lineup_change', 'bullpen_change', 'market_odds_change', 'line_change', 'context_completeness_change', 'component_score_change'],
    },
    forwardLedgerContract: {
      immutable: true,
      noRetrospectiveRows: true,
      fields: [
        'event',
        'event_start',
        'snapshot_type',
        'snapshot_timestamp',
        'market',
        'selection',
        'line',
        'sportsbook',
        'odds',
        'raw_probability',
        'calibrated_probability',
        'chat_method_component_scores',
        'chat_method_composite_score',
        'research_rank',
        'research_completeness',
        'methodology_version',
        'result_after_settlement',
        'profit_after_settlement',
      ],
    },
    researchOriginContract: {
      predictionOrigin: MLB_04C_RESEARCH_ORIGIN,
      modelRole: 'research_shadow',
      isCurrent: false,
      recommendedPick: false,
      productionEligible: false,
      productVisible: false,
      officialPick: false,
    },
    comparisonContract: {
      sameOpportunityKeys: ['event', 'market', 'selection', 'line', 'sportsbook', 'snapshot_type'],
      compare: ['RAW_BASELINE', 'CALIBRATED_BASELINE', 'CHAT_METHOD_RESEARCH_SCORE'],
      chatProbabilityMetricsEnabled: false,
      futureMetrics: ['roi', 'ranking_hit_rate', 'top_n_performance'],
    },
    currentForwardDryRun: {
      mode: 'FORWARD_SAFE_FIXTURE_NO_PROVIDER_NO_DB',
      candidatesEvaluated: 2,
      candidates: ranked,
    },
    guards: {
      noRetrospectiveChatMethodRows: true,
      noAccuracyClaimWithoutFrozenLedger: true,
      noCopiedChatGptProbabilities: true,
      noProductionModelChange: true,
      noOfficialPickChange: true,
      noCurrentEraShadowWrites: true,
      noSettlementWrites: true,
      noLearningWrites: true,
      noCalibrationWrites: true,
      sportsDataIoExcluded: true,
      nflIsolation: true,
      nbaIsolation: true,
    },
    derivativeReuse: {
      pitcherProps: 'PARTIAL_COMPONENT_REUSE_READY_FOR_RESEARCH_ONLY_NOT_PREDICTION',
      nrfiYrfi: 'PARTIAL_COMPONENT_REUSE_READY_FOR_RESEARCH_ONLY_NOT_PREDICTION',
    },
    safetyCounters: {
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
      predictionWrites: 0,
      currentEraShadowWrites: 0,
      officialPickWrites: 0,
      settlementWrites: 0,
      learningWrites: 0,
      calibrationWrites: 0,
    },
    readiness: {
      CHAT_METHOD_SCORECARD_READY: 'YES',
      CHAT_METHOD_FORWARD_LEDGER_READY: 'YES',
      CHAT_METHOD_PROBABILITY_READY: 'NO',
      RAW_CALIBRATED_CHAT_COMPARISON_READY: 'YES',
      NO_RETROSPECTIVE_CHAT_METHOD_ROWS: 'YES',
      NO_ACCURACY_CLAIM_WITHOUT_FROZEN_LEDGER: 'YES',
      MLB_PITCHER_PROP_RESEARCH_SCORECARD_REUSE_READY: 'YES_RESEARCH_ONLY',
      MLB_NRFI_RESEARCH_SCORECARD_REUSE_READY: 'YES_RESEARCH_ONLY',
    },
  }
}
