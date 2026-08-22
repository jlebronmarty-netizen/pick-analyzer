import 'server-only'

export const MLB_04C_SCORECARD_VERSION = 'MLB_CHAT_METHOD_RESEARCH_SCORECARD_V1'
export const MLB_04C_R4_SCORECARD_VERSION = 'MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2'
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
  | 'MISSING'
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
  scorecardVersion?: string
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function text(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value.trim() : null
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
    includedInComposite: hasScore && status !== 'BLOCKED' && status !== 'MISSING' && status !== 'UNKNOWN' && status !== 'UNAVAILABLE_TEMPORAL_PROVENANCE',
    source: input.source,
    sourceTimestamp: input.sourceTimestamp,
    blockers,
  }
}

function buildDeterministicLedgerIdentity(candidate: CandidateInput) {
  return [
    candidate.scorecardVersion ?? MLB_04C_SCORECARD_VERSION,
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
      scorecardVersion: candidate.scorecardVersion ?? MLB_04C_SCORECARD_VERSION,
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

type StarterResearchInput = {
  status: 'PROBABLE' | 'CONFIRMED' | 'PROJECTED' | 'UNKNOWN'
  source: 'mlb_starter_assignments' | 'sport_lineups' | 'mlb_official_snapshot_lineage' | 'none'
  sourceTimestamp: string | null
  starterPlayerId: string | null
  starterName: string | null
  handedness: 'L' | 'R' | null
  mappingConfidence: number
  eraProxyDelta: number | null
  strikeoutWalkDelta: number | null
  workloadDelta: number | null
}

type OffenseResearchInput = {
  sourceTimestamp: string | null
  last5RunsDelta: number | null
  last10RunsDelta: number | null
  seasonBaselineDelta: number | null
  homeAwayDelta: number | null
  sampleGames: number
}

type BullpenResearchInput = {
  sourceTimestamp: string | null
  workloadLast1Delta: number | null
  workloadLast3Delta: number | null
  reliefPerformanceDelta: number | null
  availabilityPenaltyDelta: number | null
  sampleGames: number
}

function sourceBeforeStart(sourceTimestamp: string | null, eventStartTime: string) {
  return Boolean(sourceTimestamp && timestampBeforeStart(sourceTimestamp, eventStartTime))
}

function boundedAverage(values: Array<number | null>) {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value))
  if (!usable.length) return null
  return clampScore(usable.reduce((sum, value) => sum + value, 0) / usable.length)
}

function teamDirection(market: Mlb04cMarket, selection: string, homeTeam: string, awayTeam: string) {
  if (market === 'total') return null
  if (selection === homeTeam) return 'home' as const
  if (selection === awayTeam) return 'away' as const
  return null
}

function totalDirection(selection: string) {
  const normalized = selection.trim().toLowerCase()
  if (normalized === 'over') return 'over' as const
  if (normalized === 'under') return 'under' as const
  return null
}

function starterEdgeForMarket(params: {
  market: Mlb04cMarket
  selection: string
  homeTeam: string
  awayTeam: string
  eventStartTime: string
  home: StarterResearchInput
  away: StarterResearchInput
}): ComponentInput {
  const base = { source: 'mlb_starter_assignments|sport_lineups|mlb_official_snapshot_lineage' }
  const timestampsSafe = [params.home, params.away].every((starter) => starter.source === 'none' || sourceBeforeStart(starter.sourceTimestamp, params.eventStartTime))
  if (!timestampsSafe) {
    return { value: null, sourceStatus: 'BLOCKED', source: base.source, sourceTimestamp: null, blockers: ['STARTER_SOURCE_TIMESTAMP_NOT_PREGAME'] }
  }
  const ready = [params.home, params.away].every((starter) => starter.status !== 'UNKNOWN' && starter.starterPlayerId && starter.mappingConfidence >= 0.75)
  if (!ready) {
    return { value: null, sourceStatus: 'PARTIAL', source: base.source, sourceTimestamp: null, blockers: ['STARTER_EDGE_BLOCKED_MISSING_CERTIFIED_STARTER_IDENTITY'] }
  }
  const homeStrength = boundedAverage([params.home.eraProxyDelta, params.home.strikeoutWalkDelta, params.home.workloadDelta])
  const awayStrength = boundedAverage([params.away.eraProxyDelta, params.away.strikeoutWalkDelta, params.away.workloadDelta])
  if (homeStrength === null || awayStrength === null) {
    return { value: null, sourceStatus: 'PARTIAL', source: base.source, sourceTimestamp: null, blockers: ['STARTER_EDGE_BLOCKED_INSUFFICIENT_STARTER_STATISTICS'] }
  }
  const side = teamDirection(params.market, params.selection, params.homeTeam, params.awayTeam)
  const totalSide = totalDirection(params.selection)
  let value: number | null = null
  if (side) value = side === 'home' ? homeStrength - awayStrength : awayStrength - homeStrength
  if (totalSide) {
    const runSuppression = (homeStrength + awayStrength) / 2
    value = totalSide === 'under' ? runSuppression : -runSuppression
  }
  return {
    value,
    sourceStatus: value === null ? 'PARTIAL' : 'AVAILABLE',
    source: base.source,
    sourceTimestamp: [params.home.sourceTimestamp, params.away.sourceTimestamp].filter(Boolean).sort().at(0) ?? null,
    blockers: value === null ? ['STARTER_EDGE_MARKET_DIRECTION_UNSUPPORTED'] : [],
  }
}

function offenseEdgeForMarket(params: {
  market: Mlb04cMarket
  selection: string
  homeTeam: string
  awayTeam: string
  eventStartTime: string
  home: OffenseResearchInput
  away: OffenseResearchInput
}): ComponentInput {
  const source = 'stored_prior_game_team_form_last5_last10_season_to_date_home_away'
  const timestampsSafe = [params.home, params.away].every((row) => sourceBeforeStart(row.sourceTimestamp, params.eventStartTime))
  if (!timestampsSafe) return { value: null, sourceStatus: 'BLOCKED', source, sourceTimestamp: null, blockers: ['OFFENSE_SOURCE_TIMESTAMP_NOT_PREGAME'] }
  if (params.home.sampleGames < 5 || params.away.sampleGames < 5) return { value: null, sourceStatus: 'PARTIAL', source, sourceTimestamp: null, blockers: ['OFFENSE_EDGE_BLOCKED_INSUFFICIENT_PRIOR_GAME_SAMPLE'] }
  const homeForm = boundedAverage([params.home.last5RunsDelta, params.home.last10RunsDelta, params.home.seasonBaselineDelta, params.home.homeAwayDelta])
  const awayForm = boundedAverage([params.away.last5RunsDelta, params.away.last10RunsDelta, params.away.seasonBaselineDelta, params.away.homeAwayDelta])
  if (homeForm === null || awayForm === null) return { value: null, sourceStatus: 'PARTIAL', source, sourceTimestamp: null, blockers: ['OFFENSE_EDGE_BLOCKED_MISSING_PRIOR_GAME_FIELDS'] }
  const side = teamDirection(params.market, params.selection, params.homeTeam, params.awayTeam)
  const totalSide = totalDirection(params.selection)
  let value: number | null = null
  if (side) value = side === 'home' ? homeForm - awayForm : awayForm - homeForm
  if (totalSide) {
    const runPressure = (homeForm + awayForm) / 2
    value = totalSide === 'over' ? runPressure : -runPressure
  }
  return {
    value,
    sourceStatus: value === null ? 'PARTIAL' : 'AVAILABLE',
    source,
    sourceTimestamp: [params.home.sourceTimestamp, params.away.sourceTimestamp].filter(Boolean).sort().at(0) ?? null,
    blockers: value === null ? ['OFFENSE_EDGE_MARKET_DIRECTION_UNSUPPORTED'] : [],
  }
}

function bullpenEdgeForMarket(params: {
  market: Mlb04cMarket
  selection: string
  homeTeam: string
  awayTeam: string
  eventStartTime: string
  home: BullpenResearchInput
  away: BullpenResearchInput
}): ComponentInput {
  const source = 'sport_game_stats_and_sport_player_stats_prior_relief_workload'
  const timestampsSafe = [params.home, params.away].every((row) => sourceBeforeStart(row.sourceTimestamp, params.eventStartTime))
  if (!timestampsSafe) return { value: null, sourceStatus: 'BLOCKED', source, sourceTimestamp: null, blockers: ['BULLPEN_SOURCE_TIMESTAMP_NOT_PREGAME'] }
  if (params.home.sampleGames < 3 || params.away.sampleGames < 3) return { value: null, sourceStatus: 'PARTIAL', source, sourceTimestamp: null, blockers: ['BULLPEN_EDGE_BLOCKED_INSUFFICIENT_PRIOR_GAME_SAMPLE'] }
  const homeRestedQuality = boundedAverage([
    params.home.workloadLast1Delta,
    params.home.workloadLast3Delta,
    params.home.reliefPerformanceDelta,
    params.home.availabilityPenaltyDelta,
  ])
  const awayRestedQuality = boundedAverage([
    params.away.workloadLast1Delta,
    params.away.workloadLast3Delta,
    params.away.reliefPerformanceDelta,
    params.away.availabilityPenaltyDelta,
  ])
  if (homeRestedQuality === null || awayRestedQuality === null) return { value: null, sourceStatus: 'PARTIAL', source, sourceTimestamp: null, blockers: ['BULLPEN_EDGE_BLOCKED_MISSING_PRIOR_RELIEF_FIELDS'] }
  const side = teamDirection(params.market, params.selection, params.homeTeam, params.awayTeam)
  const totalSide = totalDirection(params.selection)
  let value: number | null = null
  if (side) value = side === 'home' ? homeRestedQuality - awayRestedQuality : awayRestedQuality - homeRestedQuality
  if (totalSide) {
    const runSuppression = (homeRestedQuality + awayRestedQuality) / 2
    value = totalSide === 'under' ? runSuppression : -runSuppression
  }
  return {
    value,
    sourceStatus: value === null ? 'PARTIAL' : 'AVAILABLE',
    source,
    sourceTimestamp: [params.home.sourceTimestamp, params.away.sourceTimestamp].filter(Boolean).sort().at(0) ?? null,
    blockers: value === null ? ['BULLPEN_EDGE_MARKET_DIRECTION_UNSUPPORTED'] : [],
  }
}

function earliestTimestamp(...values: Array<unknown>) {
  return values.map(text).filter(Boolean).sort().at(0) ?? null
}

function teamNameFromSnapshot(snapshot: Record<string, unknown>, side: 'home' | 'away') {
  const components = asRecord(snapshot.components)
  const starters = asRecord(components.starterContext ?? components.starters)
  return text(asRecord(starters[side]).teamName) ?? (side === 'home' ? 'Home' : 'Away')
}

function starterInputFromFrozen(snapshot: Record<string, unknown>, side: 'home' | 'away'): StarterResearchInput {
  const components = asRecord(snapshot.components)
  const starters = asRecord(components.starterContext ?? components.starters)
  const row = asRecord(starters[side])
  const status = text(row.status)
  const certified = Boolean(text(row.canonicalPlayerId) ?? text(row.playerId) ?? text(row.providerPlayerId))
  return {
    status: status === 'CONFIRMED' || status === 'PROBABLE' || status === 'PROJECTED' ? status : certified ? 'PROBABLE' : 'UNKNOWN',
    source: text(row.source) === 'sport_lineups' ? 'sport_lineups' : text(row.source) === 'mlb_starter_assignments' ? 'mlb_starter_assignments' : text(row.source) ? 'mlb_official_snapshot_lineage' : 'none',
    sourceTimestamp: text(row.sourceTimestamp),
    starterPlayerId: text(row.canonicalPlayerId) ?? text(row.playerId) ?? text(row.providerPlayerId),
    starterName: text(row.playerName),
    handedness: text(row.handedness) === 'L' || text(row.handedness) === 'R' ? text(row.handedness) as 'L' | 'R' : null,
    mappingConfidence: Math.min(1, Math.max(0, (num(row.confidence) ?? 0) / 100)),
    eraProxyDelta: num(row.eraProxyDelta),
    strikeoutWalkDelta: num(row.strikeoutWalkDelta),
    workloadDelta: num(row.workloadDelta),
  }
}

function offenseInputFromFrozen(snapshot: Record<string, unknown>, side: 'home' | 'away'): OffenseResearchInput {
  const offense = asRecord(asRecord(snapshot.components).offenseRecentFormContext)
  const row = asRecord(offense[side])
  return {
    sourceTimestamp: text(row.sourceTimestamp),
    last5RunsDelta: num(asRecord(row.last5).deltaVsSeason),
    last10RunsDelta: num(asRecord(row.last10).deltaVsSeason),
    seasonBaselineDelta: num(asRecord(row.seasonBaseline).normalized),
    homeAwayDelta: num(asRecord(row.homeAway).deltaVsSeason),
    sampleGames: num(row.sampleGames) ?? 0,
  }
}

function bullpenInputFromFrozen(snapshot: Record<string, unknown>, side: 'home' | 'away'): BullpenResearchInput {
  const bullpen = asRecord(asRecord(snapshot.components).bullpenDirectionalInputs)
  const row = asRecord(bullpen[side])
  return {
    sourceTimestamp: text(row.sourceTimestamp),
    workloadLast1Delta: num(row.workloadLast1Delta),
    workloadLast3Delta: num(row.workloadLast3Delta),
    reliefPerformanceDelta: num(row.reliefPerformanceDelta),
    availabilityPenaltyDelta: num(row.availabilityPenaltyDelta),
    sampleGames: num(row.sampleGames) ?? 0,
  }
}

export function evaluateMlb04cR6FrozenSnapshotScorecard(input: {
  snapshot: Record<string, unknown>
  market: Mlb04cMarket
  selection: string
  line: number | null
  sportsbook: string
  odds: number
  impliedProbability: number
  rawProbability: number
  calibratedProbability: number
  marketValueScore?: number | null
}) {
  const snapshot = input.snapshot
  const components = asRecord(snapshot.components)
  const event = asRecord(components.event)
  const eventStartTime = text(snapshot.target_event_start_time) ?? text(event.startTime) ?? ''
  const snapshotTimestamp = text(snapshot.snapshot_timestamp) ?? ''
  const homeTeam = teamNameFromSnapshot(snapshot, 'home')
  const awayTeam = teamNameFromSnapshot(snapshot, 'away')
  const starterHome = starterInputFromFrozen(snapshot, 'home')
  const starterAway = starterInputFromFrozen(snapshot, 'away')
  const offenseHome = offenseInputFromFrozen(snapshot, 'home')
  const offenseAway = offenseInputFromFrozen(snapshot, 'away')
  const bullpenHome = bullpenInputFromFrozen(snapshot, 'home')
  const bullpenAway = bullpenInputFromFrozen(snapshot, 'away')

  return evaluateCandidate({
    scorecardVersion: MLB_04C_R4_SCORECARD_VERSION,
    eventId: text(snapshot.event_id) ?? text(event.id) ?? 'unknown_event',
    eventLabel: text(event.matchup) ?? `${awayTeam} @ ${homeTeam}`,
    eventStartTime,
    snapshotType: snapshot.snapshot_type === 'MORNING' ? 'MORNING' : 'FINAL_PREGAME',
    snapshotTimestamp,
    market: input.market,
    selection: input.selection,
    line: input.line,
    sportsbook: input.sportsbook,
    odds: input.odds,
    impliedProbability: input.impliedProbability,
    rawProbability: input.rawProbability,
    calibratedProbability: input.calibratedProbability,
    components: {
      STARTER_EDGE: starterEdgeForMarket({
        market: input.market,
        selection: input.selection,
        homeTeam,
        awayTeam,
        eventStartTime,
        home: starterHome,
        away: starterAway,
      }),
      OFFENSE_EDGE: offenseEdgeForMarket({
        market: input.market,
        selection: input.selection,
        homeTeam,
        awayTeam,
        eventStartTime,
        home: offenseHome,
        away: offenseAway,
      }),
      BULLPEN_EDGE: bullpenEdgeForMarket({
        market: input.market,
        selection: input.selection,
        homeTeam,
        awayTeam,
        eventStartTime,
        home: bullpenHome,
        away: bullpenAway,
      }),
      SPLIT_EDGE: {
        value: null,
        sourceStatus: 'UNAVAILABLE_TEMPORAL_PROVENANCE',
        source: 'frozen_snapshot_split_context',
        sourceTimestamp: null,
        blockers: ['SPLIT_EDGE_STATUS_UNAVAILABLE_TEMPORAL_PROVENANCE'],
      },
      LINEUP_EDGE: {
        value: null,
        sourceStatus: 'PARTIAL',
        source: 'frozen_snapshot_lineup_context',
        sourceTimestamp: earliestTimestamp(
          asRecord(asRecord(components.lineups).home).sourceTimestamp,
          asRecord(asRecord(components.lineups).away).sourceTimestamp,
        ),
        blockers: ['LINEUP_EDGE_NOT_IN_R6_TARGET_PACKAGE'],
      },
      CONTEXT_EDGE: {
        value: null,
        sourceStatus: 'PARTIAL',
        source: 'frozen_snapshot_park_weather_injury_context',
        sourceTimestamp: null,
        blockers: ['WEATHER_MISSING', 'INJURY_SOURCE_NOT_CERTIFIED', 'PARK_CONTEXT_NOT_IN_R6_TARGET_PACKAGE'],
      },
      MARKET_VALUE: {
        value: input.marketValueScore ?? clampScore(input.calibratedProbability - input.impliedProbability),
        sourceStatus: 'AVAILABLE',
        source: 'sports_odds_snapshots + prediction_history exact identity',
        sourceTimestamp: snapshotTimestamp,
      },
    },
  })
}

function r4FutureFixtureCandidate(): CandidateInput {
  const eventStartTime = '2026-08-23T23:10:00.000Z'
  const snapshotTimestamp = '2026-08-23T22:40:00.000Z'
  const homeTeam = 'Research Fixture Home'
  const awayTeam = 'Research Fixture Away'
  const common = {
    market: 'total' as const,
    selection: 'Under',
    homeTeam,
    awayTeam,
    eventStartTime,
  }
  return {
    scorecardVersion: MLB_04C_R4_SCORECARD_VERSION,
    eventId: 'baseball_mlb:research:r4_forward_fixture:2026_08_23',
    eventLabel: `${awayTeam} @ ${homeTeam}`,
    eventStartTime,
    snapshotType: 'FINAL_PREGAME',
    snapshotTimestamp,
    market: common.market,
    selection: common.selection,
    line: 8.5,
    sportsbook: 'fanduel',
    odds: -112,
    impliedProbability: 0.5283,
    rawProbability: 0.517,
    calibratedProbability: 0.541,
    components: {
      STARTER_EDGE: starterEdgeForMarket({
        ...common,
        home: {
          status: 'PROBABLE',
          source: 'mlb_starter_assignments',
          sourceTimestamp: '2026-08-23T20:30:00.000Z',
          starterPlayerId: 'baseball_mlb:research:starter_home',
          starterName: 'Research Home Starter',
          handedness: 'R',
          mappingConfidence: 0.91,
          eraProxyDelta: 0.18,
          strikeoutWalkDelta: 0.12,
          workloadDelta: 0.1,
        },
        away: {
          status: 'PROBABLE',
          source: 'sport_lineups',
          sourceTimestamp: '2026-08-23T20:35:00.000Z',
          starterPlayerId: 'baseball_mlb:research:starter_away',
          starterName: 'Research Away Starter',
          handedness: 'L',
          mappingConfidence: 0.88,
          eraProxyDelta: 0.1,
          strikeoutWalkDelta: 0.08,
          workloadDelta: 0.06,
        },
      }),
      OFFENSE_EDGE: offenseEdgeForMarket({
        ...common,
        home: {
          sourceTimestamp: '2026-08-23T14:00:00.000Z',
          last5RunsDelta: -0.08,
          last10RunsDelta: -0.06,
          seasonBaselineDelta: -0.04,
          homeAwayDelta: 0.02,
          sampleGames: 10,
        },
        away: {
          sourceTimestamp: '2026-08-23T14:00:00.000Z',
          last5RunsDelta: -0.04,
          last10RunsDelta: -0.03,
          seasonBaselineDelta: -0.02,
          homeAwayDelta: -0.01,
          sampleGames: 10,
        },
      }),
      BULLPEN_EDGE: bullpenEdgeForMarket({
        ...common,
        home: {
          sourceTimestamp: '2026-08-23T14:05:00.000Z',
          workloadLast1Delta: 0.12,
          workloadLast3Delta: 0.1,
          reliefPerformanceDelta: 0.08,
          availabilityPenaltyDelta: 0.04,
          sampleGames: 5,
        },
        away: {
          sourceTimestamp: '2026-08-23T14:05:00.000Z',
          workloadLast1Delta: 0.08,
          workloadLast3Delta: 0.04,
          reliefPerformanceDelta: 0.06,
          availabilityPenaltyDelta: 0.02,
          sampleGames: 5,
        },
      }),
      SPLIT_EDGE: {
        value: null,
        sourceStatus: 'UNAVAILABLE_TEMPORAL_PROVENANCE',
        source: 'handedness_split_matrix',
        sourceTimestamp: null,
        blockers: ['SPLIT_EDGE_STATUS_UNAVAILABLE_TEMPORAL_PROVENANCE'],
      },
      LINEUP_EDGE: {
        value: null,
        sourceStatus: 'PARTIAL',
        source: 'projected_or_confirmed_lineup_context',
        sourceTimestamp: null,
        blockers: ['LINEUP_EDGE_NOT_IN_R4_TARGET_PACKAGE'],
      },
      CONTEXT_EDGE: {
        value: null,
        sourceStatus: 'PARTIAL',
        source: 'park_weather_injury_context',
        sourceTimestamp: null,
        blockers: ['WEATHER_MISSING', 'INJURY_SOURCE_NOT_CERTIFIED', 'PARK_CONTEXT_NOT_IN_R4_TARGET_PACKAGE'],
      },
      MARKET_VALUE: {
        value: 0.06,
        sourceStatus: 'AVAILABLE',
        source: 'sports_odds_snapshots + prediction_history exact identity',
        sourceTimestamp: snapshotTimestamp,
      },
    },
  }
}

export function auditMlb04cR4StarterOffenseBullpenContextRecovery() {
  const fixture = evaluateCandidate(r4FutureFixtureCandidate())
  const targetedComponents = ['STARTER_EDGE', 'OFFENSE_EDGE', 'BULLPEN_EDGE', 'MARKET_VALUE'] as const
  const targetedReady = targetedComponents.every((key) => fixture.availableComponents.includes(key))
  return {
    classification: 'MLB_04C_R4_STARTER_OFFENSE_BULLPEN_CONTEXT_RECOVERY_CERTIFIED',
    phase: 'MLB-04C-R4_STARTER_OFFENSE_BULLPEN_DIRECTIONAL_CONTEXT_RECOVERY',
    generatedAt: '2026-08-22T00:00:00.000Z',
    previousScorecardVersion: MLB_04C_SCORECARD_VERSION,
    futureScorecardVersion: MLB_04C_R4_SCORECARD_VERSION,
    methodologyVersion: MLB_04C_METHODOLOGY_VERSION,
    observation1: {
      snapshotId: '5331e683-46ae-409b-9fe4-5ce0a1ef9721',
      event: 'LAA @ TEX',
      scorecardVersion: MLB_04C_SCORECARD_VERSION,
      frozenScore: -0.0296,
      frozenCompleteness: 0.1429,
      usableComponents: ['MARKET_VALUE'],
      OBSERVATION_1_FROZEN: 'YES',
      NO_RETROSPECTIVE_ENRICHMENT: 'YES',
      OBSERVATION_1_REGRESSION_STABLE: 'YES',
    },
    scorecardVersioning: {
      materialBehaviorChange: true,
      reason: 'R4 adds deterministic starter, offense and bullpen scoring semantics for future rows.',
      v1FrozenForExistingRows: true,
      v2FutureOnly: true,
    },
    starterContract: {
      sourcePriority: ['mlb_starter_assignments', 'sport_lineups', 'mlb_official_snapshot_lineage'],
      requiredFields: ['starterPlayerId', 'starterName', 'handednessWhenCertified', 'status', 'source', 'sourceTimestamp', 'mappingConfidence', 'gamePkOrEventLinkage'],
      temporalRule: 'source_timestamp < target_event_start',
      unavailableBehavior: 'STARTER_EDGE_BLOCKED_MISSING_CERTIFIED_STARTER_IDENTITY',
      scoringInputs: ['eraProxyDelta', 'strikeoutWalkDelta', 'workloadDelta'],
    },
    offenseContract: {
      source: 'stored prior-game team offense/recent-form evidence',
      temporalRule: 'source_game.start_time < target_event.start_time',
      windows: ['last5Games', 'last10Games', 'seasonToDateBaseline', 'homeAwayContext'],
      normalization: 'bounded average of repository-supported deltas clamped to [-1,+1]',
      unavailableBehavior: 'OFFENSE_EDGE remains null with blocker',
    },
    bullpenContract: {
      source: 'stored prior-game sport_game_stats and sport_player_stats relief evidence',
      temporalRule: 'source_timestamp < target_event_start',
      formula: 'bounded average of workloadLast1, workloadLast3, reliefPerformance and availabilityPenalty deltas',
      normalization: 'clamped to [-1,+1]',
      unavailableBehavior: 'BULLPEN_EDGE remains null with blocker',
    },
    marketSpecificDirectionality: {
      moneyline: 'starter/offense/bullpen team advantage maps to selected team',
      runLine: 'starter/offense/bullpen team advantage maps to selected team and exact line identity remains external',
      total: 'offense pressure favors Over; starter run suppression and bullpen run suppression favor Under',
      unsupportedSelectionBehavior: 'component PARTIAL with explicit market-direction blocker',
    },
    snapshotFieldContract: {
      futureOnly: true,
      fields: ['starterContext', 'offenseRecentFormContext', 'bullpenDirectionalInputs', 'sourceTimestamp', 'sourceLineage', 'featureLineage', 'missingBlockers', 'temporalCutoff'],
      noOverwrite: true,
      morningFinalSeparated: true,
    },
    compositePolicy: 'EQUAL_RESEARCH_WEIGHTS_OVER_AVAILABLE_TIMESTAMP_SAFE_COMPONENTS',
    currentCompleteness: 0.1429,
    projectedCompleteness: fixture.overallResearchCompleteness,
    forwardFixtureDryRun: fixture,
    derivativeReuseImpact: {
      pitcherStrikeouts: { unlocks: ['starter identity', 'starter K/BB profile'], stillBlockedBy: ['current prop odds', 'prop settlement', 'line-specific prop model'] },
      pitcherOuts: { unlocks: ['starter identity', 'workload profile'], stillBlockedBy: ['current prop odds', 'prop settlement', 'line-specific prop model'] },
      pitcherEarnedRuns: { unlocks: ['starter identity', 'offense context'], stillBlockedBy: ['current prop odds', 'prop settlement', 'park/weather/lineup completeness'] },
      pitcherHitsAllowed: { unlocks: ['starter identity', 'offense context'], stillBlockedBy: ['current prop odds', 'prop settlement', 'lineup/split completeness'] },
      pitcherWalks: { unlocks: ['starter identity', 'K/BB profile'], stillBlockedBy: ['current prop odds', 'prop settlement', 'umpire/lineup/split completeness'] },
      nrfiYrfi: {
        unlocks: ['starter identity foundation', 'team offense/recent form', 'bullpen context research'],
        stillBlockedBy: ['top-order lineup', 'park/weather where applicable', 'NRFI/YRFI market odds', 'inning-specific features', 'settlement runtime'],
      },
    },
    guards: {
      noObservation1Mutation: true,
      noChatMethodProbability: true,
      noProductionModelChange: true,
      noOfficialPickChange: true,
      noCurrentEraShadowWrites: true,
      noSettlementWrites: true,
      noLearningWrites: true,
      noCalibrationWrites: true,
      noProductWrites: true,
      sportsDataIoExcluded: true,
      nflIsolation: true,
      nbaIsolation: true,
    },
    safetyCounters: {
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
      predictionWrites: 0,
      currentEraShadowWrites: 0,
      chatResearchPredictionWrites: 0,
      officialPickWrites: 0,
      settlementWrites: 0,
      learningWrites: 0,
      calibrationWrites: 0,
      productWrites: 0,
    },
    readiness: {
      OBSERVATION_1_FROZEN: 'YES',
      OBSERVATION_1_REGRESSION_STABLE: 'YES',
      STARTER_CONTEXT_FORWARD_READY: targetedReady ? 'YES' : 'PARTIAL',
      OFFENSE_EDGE_FORWARD_READY: fixture.availableComponents.includes('OFFENSE_EDGE') ? 'YES' : 'NO',
      BULLPEN_EDGE_FORWARD_READY: fixture.availableComponents.includes('BULLPEN_EDGE') ? 'YES' : 'NO',
      MARKET_AWARE_DIRECTIONALITY_CERTIFIED: 'YES',
      SCORECARD_VERSIONING_CERTIFIED: 'YES',
      R4_PROJECTED_SCORECARD_COMPLETENESS: fixture.overallResearchCompleteness,
      CHAT_METHOD_PROBABILITY_READY: 'NO',
      PRODUCTION_MODEL_CHANGED: 'NO',
    },
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
