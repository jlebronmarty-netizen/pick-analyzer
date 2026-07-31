export type ReadinessState = 'PASS' | 'FAIL' | 'PENDING' | 'NOT_APPLICABLE' | 'NOT_AVAILABLE'

export type Selector = {
  status?: 'AVAILABLE' | 'EMPTY' | 'BLOCKED'
  eventId?: string | null
  matchup?: string | null
  market?: string | null
  marketLabel?: string | null
  selection?: string | null
  line?: number | null
  metricName?: string
  metricValue?: number | null
  modelProbability?: number | null
  confidence?: number | null
  priceState?: string
  americanOdds?: number | null
  sportsbook?: string | null
  impliedProbability?: number | null
  edge?: number | null
  expectedValue?: number | null
  freshness?: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_TIMESTAMP'
  blocker?: string | null
  rankingReason?: string
}

export type TodayDecisionData = {
  success: boolean
  status?: 'AVAILABLE' | 'PARTIAL' | 'DEGRADED' | 'UNAVAILABLE'
  generatedAt?: string
  operatingDate?: string
  gamesWaitingForOdds?: number
  officialPicks?: number
  freshness?: 'fresh' | 'partial' | 'stale' | 'empty'
  nextAction?: string
  latestOddsTimestamp?: string | null
  summary?: { recommendation?: string }
  warnings?: string[]
  viewModel?: {
    generatedAt?: string
    selectors?: {
      highestProjectedOutcome?: Selector
      highestRankedPricedMarket?: Selector
      mostLikelySummary?: { selector?: Selector }
      bestAvailableValue?: Selector
      marketFreshnessSummary?: {
        state?: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN_TIMESTAMP'
        latestOddsTimestamp?: string | null
      }
    }
  }
  sections?: {
    officialPicks?: { status?: string; data?: unknown[]; reason?: string | null }
    groundedOpportunities?: { status?: string; data?: Array<Record<string, unknown>>; reason?: string | null }
  }
  providerCallsMade?: number
  remoteMutationsMade?: number
}

export type NormalizedBestOpportunity = {
  opportunityId: string
  sport: string
  eventId: string | null
  eventLabel: string
  startTime: string | null
  selection: string
  market: string
  side: string | null
  odds: number | null
  oddsFormat: 'AMERICAN' | 'UNAVAILABLE'
  sportsbook: string
  modelProbability: number | null
  impliedProbability: number | null
  confidence: number | null
  edge: number | null
  expectedValue: number | null
  freshnessStatus: string
  freshnessTimestamp: string | null
  dataQualityStatus: string
  dataQualityScore: number | null
  recommendationStatus: 'OFFICIAL_PICK' | 'INFORMATIONAL' | 'NO_OPPORTUNITY'
  officialPick: boolean
  officialPickReason: string
  blockers: string[]
  warnings: string[]
  supportingReasons: string[]
  source: string
  provenance: string
  updatedAt: string | null
}

export type ReadinessGateRow = {
  id: string
  label: string
  state: ReadinessState
  currentValue: string
  requiredValue: string
  explanation: string
}

export type OfficialPickReadiness = {
  status: 'OFFICIAL' | 'NOT_OFFICIAL' | 'PARTIAL' | 'NO_OPPORTUNITY'
  requirementsMet: number
  knownApplicableRequirements: number
  notAvailableRequirements: number
  summary: string
  blockerSummary: string
  rows: ReadinessGateRow[]
}

const supportedMarkets = new Set(['moneyline', 'spread', 'run_line', 'run line', 'total'])

export function labelize(value: unknown, fallback = 'Not yet available') {
  const text = String(value ?? '').trim()
  if (!text || text === 'null' || text === 'undefined') return fallback
  return text.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function numberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function rawText(value: unknown) {
  return String(value ?? '').trim()
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => rawText(item)).filter(Boolean)
}

export function plainBlocker(code: unknown) {
  const normalized = rawText(code).toUpperCase()
  const map: Record<string, string> = {
    PRODUCTION_GATE_BLOCKED: 'Production data gate is not satisfied.',
    TRIAL_ROW: 'This row is marked as trial evidence.',
    SCRAMBLED_ROW: 'This row is marked as scrambled test evidence.',
    QUARANTINED_ROW: 'This row is quarantined.',
    EVENT_NOT_FUTURE: 'The event is no longer safely pregame.',
    EVENT_ALREADY_SETTLED: 'The event already has a terminal result.',
    MISSING_EVENT: 'Event evidence is missing.',
    MISSING_PARTICIPANTS: 'Team or matchup evidence is incomplete.',
    UNSUPPORTED_MARKET: 'This market is not supported for Official Picks.',
    MISSING_OFFERED_ODDS: 'Stored offered odds are missing.',
    ODDS_AFTER_CUTOFF: 'The stored odds snapshot is after the cutoff.',
    STALE_ODDS: 'Stored odds are stale.',
    MISSING_FEATURE_SNAPSHOT: 'Feature snapshot evidence is missing.',
    MISSING_MODEL_VERSION: 'Model version evidence is missing.',
    MISSING_FEATURE_SET_VERSION: 'Feature set version evidence is missing.',
    INVALID_PROBABILITY: 'Model probability is missing or invalid.',
    LOW_DATA_QUALITY: 'Data quality is below the existing policy requirement.',
    LOW_DATA_SUFFICIENCY: 'Data sufficiency is below the existing policy requirement.',
    CALIBRATION_INSUFFICIENT: 'Calibration evidence is not sufficient yet.',
    LOW_CONFIDENCE: 'Confidence is below the existing Official Pick threshold.',
    LOW_MODEL_PROBABILITY: 'Model probability is below the existing policy requirement.',
    NON_POSITIVE_EDGE: 'Modeled edge is not positive.',
    NON_POSITIVE_EV: 'Expected value is not positive.',
    LOW_EDGE: 'Modeled edge is below the existing Official Pick threshold.',
    LOW_EV: 'Expected value is below the existing Official Pick threshold.',
    UNRESOLVED_CRITICAL_MAPPINGS: 'Critical event or market mapping is unresolved.',
    DUPLICATE_RECOMMENDATION_IDENTITY: 'A duplicate recommendation identity was detected.',
    CRITICAL_WARNING: 'A critical validation warning is present.',
    NO_STORED_ODDS: 'Stored odds are not available.',
    STALE_MARKET: 'Stored market evidence is stale.',
    UNAVAILABLE: 'Required evidence is unavailable.',
  }
  return map[normalized] ?? labelize(code, 'Existing policy did not expose a blocker reason.')
}

function firstOfficial(data: TodayDecisionData) {
  const row = data.sections?.officialPicks?.data?.[0]
  return row && typeof row === 'object' ? row as Record<string, unknown> : null
}

function selectorAvailable(selector: Selector | undefined) {
  return Boolean(selector && selector.status === 'AVAILABLE' && selector.selection)
}

function idFrom(parts: Array<unknown>) {
  const raw = parts.map((part) => rawText(part)).filter(Boolean).join(':')
  return raw || 'no-opportunity'
}

function normalizeRow(
  source: string,
  row: Record<string, unknown>,
  data: TodayDecisionData,
  officialPick: boolean,
): NormalizedBestOpportunity {
  const blockers = stringList(row.blockers)
  const warnings = stringList(row.validationWarnings ?? row.validation_warnings)
  const odds = numberOrNull(row.americanOdds ?? row.odds)
  const modelProbability = numberOrNull(row.modelProbability ?? row.model_probability ?? row.probability)
  const impliedProbability = numberOrNull(row.marketImpliedProbability ?? row.impliedProbability ?? row.implied_probability)
  const edge = numberOrNull(row.edgePercentagePoints ?? row.edge)
  const expectedValue = numberOrNull(row.expectedValuePercent ?? row.expectedValue ?? row.ev)
  const confidence = numberOrNull(row.confidence)
  const timestampObject = row.timestamps && typeof row.timestamps === 'object' ? row.timestamps as Record<string, unknown> : {}
  const freshnessTimestamp = rawText(timestampObject.oddsSnapshotAt ?? row.oddsTimestamp ?? row.odds_timestamp ?? data.latestOddsTimestamp) || null
  const dataQualityScore = numberOrNull(row.dataQualityScore ?? row.data_quality_score)
  const reason = officialPick
    ? 'This opportunity is marked official by the existing production policy.'
    : plainBlocker(row.reasonNotOfficial ?? row.blocker ?? blockers[0] ?? data.summary?.recommendation)
  return {
    opportunityId: idFrom([row.predictionId ?? row.id, row.eventId ?? row.game_id, row.market, row.selection]),
    sport: labelize(row.sportKey ?? row.sport_key ?? row.sport ?? 'MLB'),
    eventId: rawText(row.eventId ?? row.game_id) || null,
    eventLabel: labelize(row.matchup ?? row.eventLabel, 'Event not yet available'),
    startTime: rawText(row.scheduledTime ?? row.commence_time) || null,
    selection: labelize(row.selection ?? row.team, 'Selection not yet available'),
    market: labelize(row.marketLabel ?? row.market, 'Market not yet available'),
    side: rawText(row.normalizedSelection ?? row.side) || null,
    odds,
    oddsFormat: odds === null ? 'UNAVAILABLE' : 'AMERICAN',
    sportsbook: labelize(row.sportsbook, 'Sportsbook unavailable'),
    modelProbability,
    impliedProbability,
    confidence,
    edge,
    expectedValue,
    freshnessStatus: labelize(row.freshnessStatus ?? row.freshness, 'Freshness unavailable'),
    freshnessTimestamp,
    dataQualityStatus: dataQualityScore === null ? (officialPick ? 'Official Pick evidence' : 'Stored evidence') : 'Certified score available',
    dataQualityScore,
    recommendationStatus: officialPick ? 'OFFICIAL_PICK' : 'INFORMATIONAL',
    officialPick,
    officialPickReason: reason,
    blockers,
    warnings,
    supportingReasons: supportingReasons({ modelProbability, impliedProbability, edge, expectedValue, confidence }),
    source,
    provenance: officialPick ? 'sections.officialPicks.data[0]' : 'sections.groundedOpportunities.data[0]',
    updatedAt: freshnessTimestamp ?? (rawText(row.updatedAt ?? row.generated_at ?? data.generatedAt) || null),
  }
}

function normalizeSelector(source: string, selector: Selector, data: TodayDecisionData): NormalizedBestOpportunity {
  const odds = numberOrNull(selector.americanOdds)
  const modelProbability = numberOrNull(selector.modelProbability)
  const impliedProbability = numberOrNull(selector.impliedProbability)
  const edge = numberOrNull(selector.edge)
  const expectedValue = numberOrNull(selector.expectedValue ?? selector.metricValue)
  const confidence = numberOrNull(selector.confidence)
  const blocker = rawText(selector.blocker) || rawText(selector.rankingReason)
  const freshnessTimestamp = data.latestOddsTimestamp ?? data.viewModel?.selectors?.marketFreshnessSummary?.latestOddsTimestamp ?? data.generatedAt ?? null
  return {
    opportunityId: idFrom([selector.eventId, selector.market, selector.selection, source]),
    sport: 'MLB',
    eventId: selector.eventId ?? null,
    eventLabel: labelize(selector.matchup, 'Event not yet available'),
    startTime: null,
    selection: labelize(selector.selection, 'Selection not yet available'),
    market: labelize(selector.marketLabel ?? selector.market, 'Market not yet available'),
    side: null,
    odds,
    oddsFormat: odds === null ? 'UNAVAILABLE' : 'AMERICAN',
    sportsbook: labelize(selector.sportsbook, 'Sportsbook unavailable'),
    modelProbability,
    impliedProbability,
    confidence,
    edge,
    expectedValue,
    freshnessStatus: labelize(selector.freshness ?? selector.priceState, 'Freshness unavailable'),
    freshnessTimestamp,
    dataQualityStatus: 'Stored market evidence',
    dataQualityScore: null,
    recommendationStatus: 'INFORMATIONAL',
    officialPick: false,
    officialPickReason: plainBlocker(blocker || data.summary?.recommendation || 'Not an Official Pick under the existing production policy.'),
    blockers: blocker ? [blocker] : [],
    warnings: data.warnings ?? [],
    supportingReasons: supportingReasons({ modelProbability, impliedProbability, edge, expectedValue, confidence }),
    source,
    provenance: `viewModel.selectors.${source.replaceAll(' ', '')}`,
    updatedAt: freshnessTimestamp,
  }
}

function supportingReasons(values: {
  modelProbability: number | null
  impliedProbability: number | null
  confidence: number | null
  edge: number | null
  expectedValue: number | null
}) {
  const reasons: string[] = []
  if (values.modelProbability !== null) reasons.push('Model probability is available.')
  if (values.impliedProbability !== null) reasons.push('Implied probability is available from stored odds.')
  if (values.edge !== null && values.edge > 0) reasons.push('Modeled edge is positive.')
  if (values.expectedValue !== null && values.expectedValue > 0) reasons.push('Expected value is positive.')
  if (values.confidence !== null) reasons.push('Confidence is available.')
  return reasons
}

export function normalizeBestOpportunity(data: TodayDecisionData): NormalizedBestOpportunity | null {
  const officialRow = firstOfficial(data)
  if (officialRow && Number(data.officialPicks ?? 0) > 0) return normalizeRow('Official Pick', officialRow, data, true)

  const selectors = data.viewModel?.selectors
  if (selectorAvailable(selectors?.bestAvailableValue)) return normalizeSelector('Best Value', selectors!.bestAvailableValue!, data)
  if (selectorAvailable(selectors?.highestRankedPricedMarket)) return normalizeSelector('Highest Ranked Priced Market', selectors!.highestRankedPricedMarket!, data)
  if (selectorAvailable(selectors?.mostLikelySummary?.selector)) return normalizeSelector('Most Likely', selectors!.mostLikelySummary!.selector!, data)
  if (selectorAvailable(selectors?.highestProjectedOutcome)) return normalizeSelector('Highest Projected Outcome', selectors!.highestProjectedOutcome!, data)

  const grounded = data.sections?.groundedOpportunities?.data?.[0]
  return grounded ? normalizeRow('Grounded Opportunity', grounded, data, false) : null
}

function gate(id: string, label: string, state: ReadinessState, currentValue: string, requiredValue: string, explanation: string): ReadinessGateRow {
  return { id, label, state, currentValue, requiredValue, explanation }
}

function hasBlocker(opportunity: NormalizedBestOpportunity, terms: string[]) {
  const haystack = opportunity.blockers.map((item) => item.toUpperCase())
  return haystack.some((blocker) => terms.some((term) => blocker.includes(term)))
}

function freshnessGate(opportunity: NormalizedBestOpportunity) {
  const value = opportunity.freshnessStatus.toUpperCase()
  if (value.includes('FRESH') || value.includes('AVAILABLE')) return 'PASS'
  if (value.includes('AGING')) return 'PENDING'
  if (value.includes('STALE') || value.includes('EXPIRED') || value.includes('NO STORED')) return 'FAIL'
  return 'NOT_AVAILABLE'
}

export function buildOfficialPickReadiness(opportunity: NormalizedBestOpportunity | null): OfficialPickReadiness {
  if (!opportunity) {
    const rows = [
      gate('opportunity_source', 'Opportunity source', 'NOT_AVAILABLE', 'No opportunity', 'Existing source data', 'No supported opportunity is currently exposed by the Today contract.'),
    ]
    return {
      status: 'NO_OPPORTUNITY',
      requirementsMet: 0,
      knownApplicableRequirements: 0,
      notAvailableRequirements: 1,
      summary: 'No known Official Pick requirements can be evaluated without an opportunity.',
      blockerSummary: 'No supported opportunity is currently visible.',
      rows,
    }
  }

  const marketKey = opportunity.market.toLowerCase()
  const official = opportunity.officialPick
  const rows = [
    gate('sport_certification', 'Sport certification', opportunity.sport.toLowerCase().includes('mlb') ? 'PASS' : 'NOT_AVAILABLE', opportunity.sport, 'MLB production scope', 'MLB is the certified current production prediction scope.'),
    gate('market_support', 'Market support', supportedMarkets.has(marketKey) ? 'PASS' : marketKey.includes('not yet') ? 'NOT_AVAILABLE' : 'FAIL', opportunity.market, 'Moneyline, spread/run line or total', supportedMarkets.has(marketKey) ? 'Market is within the existing supported recommendation set.' : 'Market support could not be proven from the normalized opportunity.'),
    gate('pregame_eligibility', 'Pregame eligibility', hasBlocker(opportunity, ['EVENT_NOT_FUTURE', 'EVENT_ALREADY_SETTLED', 'ODDS_AFTER_CUTOFF']) ? 'FAIL' : 'NOT_AVAILABLE', opportunity.startTime ?? 'Not exposed', 'Safely pregame', 'The Today presentation does not recalculate lifecycle safety; it only displays proven blockers when exposed.'),
    gate('odds_availability', 'Odds availability', opportunity.odds !== null && opportunity.impliedProbability !== null ? 'PASS' : 'FAIL', opportunity.oddsFormat === 'AMERICAN' ? String(opportunity.odds) : 'Missing', 'Stored offered odds with implied probability', 'Stored offered odds are required before an Official Pick can be actioned.'),
    gate('odds_freshness', 'Odds freshness', freshnessGate(opportunity), opportunity.freshnessStatus, 'Fresh or policy-current stored odds', 'Freshness is taken from the existing Today/Current Board evidence.'),
    gate('probability_availability', 'Probability availability', opportunity.modelProbability !== null ? 'PASS' : 'NOT_AVAILABLE', opportunity.modelProbability === null ? 'Missing' : `${opportunity.modelProbability}`, 'Stored model probability', 'The model probability must already exist; B3 does not compute it.'),
    gate('confidence_threshold', 'Confidence threshold', official ? 'PASS' : hasBlocker(opportunity, ['LOW_CONFIDENCE']) ? 'FAIL' : 'NOT_AVAILABLE', opportunity.confidence === null ? 'Not exposed' : `${opportunity.confidence}`, 'Existing Official Pick policy threshold', 'Threshold result is shown only when Official status or an existing blocker proves it.'),
    gate('edge_threshold', 'Edge threshold', official ? 'PASS' : hasBlocker(opportunity, ['LOW_EDGE', 'NON_POSITIVE_EDGE']) ? 'FAIL' : 'NOT_AVAILABLE', opportunity.edge === null ? 'Not exposed' : `${opportunity.edge}`, 'Existing Official Pick policy threshold', 'B3 displays existing edge evidence without changing edge rules.'),
    gate('ev_threshold', 'EV threshold', official ? 'PASS' : hasBlocker(opportunity, ['LOW_EV', 'NON_POSITIVE_EV']) ? 'FAIL' : 'NOT_AVAILABLE', opportunity.expectedValue === null ? 'Not exposed' : `${opportunity.expectedValue}`, 'Existing Official Pick policy threshold', 'B3 displays existing EV evidence without changing EV rules.'),
    gate('data_quality_threshold', 'Data quality threshold', official ? 'PASS' : hasBlocker(opportunity, ['LOW_DATA_QUALITY', 'LOW_DATA_SUFFICIENCY', 'CALIBRATION_INSUFFICIENT']) ? 'FAIL' : 'NOT_AVAILABLE', opportunity.dataQualityScore === null ? opportunity.dataQualityStatus : `${opportunity.dataQualityScore}`, 'Existing policy data-quality requirement', 'Data-quality pass/fail is exposed only when the source contract proves it.'),
    gate('policy_blocker_absence', 'Policy blocker absence', official ? 'PASS' : opportunity.blockers.length ? 'FAIL' : 'NOT_AVAILABLE', opportunity.blockers.length ? `${opportunity.blockers.length} blocker(s)` : 'No blocker list exposed', 'No policy blockers', 'Existing blockers are translated into user-facing language.'),
    gate('official_recommendation_eligibility', 'Official recommendation eligibility', official ? 'PASS' : 'FAIL', opportunity.recommendationStatus, 'OFFICIAL_PICK', official ? 'The existing production policy marked this as an Official Pick.' : 'This opportunity remains informational.'),
  ] as ReadinessGateRow[]

  const evaluated = rows.filter((row) => row.state !== 'NOT_APPLICABLE' && row.state !== 'NOT_AVAILABLE')
  const requirementsMet = evaluated.filter((row) => row.state === 'PASS').length
  const notAvailableRequirements = rows.filter((row) => row.state === 'NOT_AVAILABLE').length
  const blockerSummary = official
    ? 'All exposed Official Pick gates passed under the existing production policy.'
    : (opportunity.blockers.length ? opportunity.blockers.map(plainBlocker).slice(0, 3).join(' ') : opportunity.officialPickReason)

  return {
    status: official ? 'OFFICIAL' : notAvailableRequirements ? 'PARTIAL' : 'NOT_OFFICIAL',
    requirementsMet,
    knownApplicableRequirements: evaluated.length,
    notAvailableRequirements,
    summary: `${requirementsMet} of ${evaluated.length} known applicable requirements met; ${notAvailableRequirements} requirement${notAvailableRequirements === 1 ? '' : 's'} not available from the current contract.`,
    blockerSummary,
    rows,
  }
}
