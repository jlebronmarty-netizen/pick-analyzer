import {
  plainBlocker,
  type NormalizedBestOpportunity,
  type OfficialPickReadiness,
  type ReadinessGateRow,
} from '@/components/dashboard/today-opportunity-readiness'

export type ConvictionLabel = 'VERY HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'AVOID' | 'UNAVAILABLE'
export type ActionabilityState = 'ACT NOW' | 'ACTIONABLE' | 'REVIEW FIRST' | 'WAIT' | 'DO NOT ACT' | 'UNAVAILABLE'

export type AiDecisionExplanation = {
  verdictSummary: string
  supportingReasons: string[]
  risks: string[]
  officialStatusExplanation: string
}

export type AiConvictionPresentation = {
  label: ConvictionLabel
  rationale: string
  evidence: string[]
  limitingFactor: string
}

export type ActionabilityPresentation = {
  state: ActionabilityState
  rationale: string
  primaryBlocker: string
  nextReviewAt: string | null
}

export type ChangeCondition = {
  conditionId: string
  currentState: string
  possibleChange: string
  expectedEffect: string
  qualifier: string
}

export type AiDecisionPresentation = {
  explanation: AiDecisionExplanation
  conviction: AiConvictionPresentation
  actionability: ActionabilityPresentation
  changeConditions: ChangeCondition[]
}

export type AiDecisionInput = {
  opportunity: NormalizedBestOpportunity | null
  readiness: OfficialPickReadiness
  freshnessStatus: string
  nextActionAt?: string | null
  warnings?: string[]
}

const supportedMarketFailure = 'This market is not supported for Official Picks.'
const noSingleChange = 'No single observed change is currently sufficient to justify a stronger recommendation.'

function gate(readiness: OfficialPickReadiness, id: string) {
  return readiness.rows.find((row) => row.id === id) ?? null
}

function gateFailed(readiness: OfficialPickReadiness, id: string) {
  return gate(readiness, id)?.state === 'FAIL'
}

function gatePending(readiness: OfficialPickReadiness, id: string) {
  return gate(readiness, id)?.state === 'PENDING'
}

function gateUnavailable(readiness: OfficialPickReadiness, id: string) {
  return gate(readiness, id)?.state === 'NOT_AVAILABLE'
}

function userGateText(row: ReadinessGateRow | null) {
  if (!row) return null
  if (row.id === 'policy_blocker_absence' && row.state === 'FAIL') return row.explanation
  return row.state === 'FAIL' ? row.explanation : null
}

function uniqueLimited(items: Array<string | null | undefined>, limit: number) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const text = String(item ?? '').trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    result.push(text)
    if (result.length === limit) break
  }
  return result
}

function staleEvidence(opportunity: NormalizedBestOpportunity | null, readiness: OfficialPickReadiness, freshnessStatus: string) {
  const freshness = `${opportunity?.freshnessStatus ?? ''} ${freshnessStatus}`.toLowerCase()
  return gateFailed(readiness, 'odds_freshness') || gatePending(readiness, 'odds_freshness') || freshness.includes('stale') || freshness.includes('aging')
}

function unsupportedMarket(readiness: OfficialPickReadiness) {
  return gateFailed(readiness, 'market_support')
}

function missingCoreEvidence(opportunity: NormalizedBestOpportunity | null, readiness: OfficialPickReadiness) {
  return (
    !opportunity ||
    opportunity.modelProbability === null ||
    opportunity.impliedProbability === null ||
    opportunity.odds === null ||
    gateUnavailable(readiness, 'probability_availability')
  )
}

function negativeValue(opportunity: NormalizedBestOpportunity | null) {
  return Boolean(
    opportunity &&
    ((opportunity.edge !== null && opportunity.edge <= 0) ||
      (opportunity.expectedValue !== null && opportunity.expectedValue <= 0))
  )
}

function positiveValue(opportunity: NormalizedBestOpportunity | null) {
  return Boolean(
    opportunity &&
    opportunity.edge !== null &&
    opportunity.edge > 0 &&
    opportunity.expectedValue !== null &&
    opportunity.expectedValue > 0
  )
}

function probabilityAdvantage(opportunity: NormalizedBestOpportunity | null) {
  return Boolean(
    opportunity &&
    opportunity.modelProbability !== null &&
    opportunity.impliedProbability !== null &&
    opportunity.modelProbability > opportunity.impliedProbability
  )
}

function primaryBlocker(opportunity: NormalizedBestOpportunity | null, readiness: OfficialPickReadiness) {
  if (!opportunity) return 'No supported opportunity is currently visible.'
  if (unsupportedMarket(readiness)) return supportedMarketFailure
  if (gateFailed(readiness, 'pregame_eligibility')) return 'The event is not proven safely pregame.'
  if (staleEvidence(opportunity, readiness, '')) return 'Stored odds are not fresh enough for immediate action.'
  if (negativeValue(opportunity)) return 'Value evidence is not positive.'
  if (opportunity.blockers.length) return plainBlocker(opportunity.blockers[0])
  const failed = readiness.rows.find((row) => row.state === 'FAIL')
  return userGateText(failed ?? null) ?? readiness.blockerSummary
}

function buildExplanation(input: AiDecisionInput): AiDecisionExplanation {
  const { opportunity, readiness, freshnessStatus, warnings = [] } = input
  const supportingReasons = uniqueLimited([
    probabilityAdvantage(opportunity) ? 'The model probability is above the implied market probability.' : null,
    positiveValue(opportunity) ? 'Current edge and expected value are positive.' : null,
    opportunity?.confidence !== null && opportunity?.confidence !== undefined ? 'Confidence evidence is available.' : null,
    opportunity?.freshnessStatus && !staleEvidence(opportunity, readiness, freshnessStatus) ? 'Stored market evidence is current enough for review.' : null,
    ...(opportunity?.supportingReasons ?? []),
  ], 3)

  const risks = uniqueLimited([
    unsupportedMarket(readiness) ? supportedMarketFailure : null,
    staleEvidence(opportunity, readiness, freshnessStatus) ? 'Odds are stale or aging, so immediate action is limited.' : null,
    negativeValue(opportunity) ? 'Edge or expected value is not positive.' : null,
    gateFailed(readiness, 'confidence_threshold') ? 'Confidence is below the existing Official Pick threshold.' : null,
    gateFailed(readiness, 'odds_availability') ? 'Stored offered odds are missing.' : null,
    opportunity && !opportunity.officialPick ? opportunity.officialPickReason : null,
    ...warnings.map(plainBlocker),
  ], 3)

  const officialStatusExplanation = opportunity?.officialPick
    ? 'This is an Official Pick because the existing production policy marked it official.'
    : opportunity
      ? 'This is not an Official Pick; it remains an informational best opportunity under existing policy.'
      : 'There is no visible opportunity to evaluate for Official Pick readiness.'

  return {
    verdictSummary: opportunity
      ? `${opportunity.selection} is the current best visible opportunity, but action remains governed by Official Pick policy.`
      : 'No supported opportunity is currently visible, so the safest decision is to wait or pass.',
    supportingReasons: supportingReasons.length ? supportingReasons : ['No complete positive signal is currently available.'],
    risks: risks.length ? risks : ['No additional risk text was returned by the current Today contract.'],
    officialStatusExplanation,
  }
}

function buildConviction(input: AiDecisionInput): AiConvictionPresentation {
  const { opportunity, readiness, freshnessStatus } = input
  const stale = staleEvidence(opportunity, readiness, freshnessStatus)
  if (!opportunity || missingCoreEvidence(opportunity, readiness)) {
    return {
      label: 'UNAVAILABLE',
      rationale: 'Core probability, pricing or opportunity evidence is missing.',
      evidence: ['Missing core evidence'],
      limitingFactor: 'Required evidence is unavailable.',
    }
  }
  if (unsupportedMarket(readiness) || negativeValue(opportunity)) {
    return {
      label: 'AVOID',
      rationale: unsupportedMarket(readiness) ? 'Existing policy does not support this market for Official Picks.' : 'Value evidence is not positive.',
      evidence: uniqueLimited([opportunity.market, opportunity.edge !== null ? `Edge ${opportunity.edge}` : null, opportunity.expectedValue !== null ? `EV ${opportunity.expectedValue}` : null], 3),
      limitingFactor: primaryBlocker(opportunity, readiness),
    }
  }
  if (opportunity.officialPick && !stale) {
    return {
      label: positiveValue(opportunity) ? 'VERY HIGH' : 'HIGH',
      rationale: 'Existing production policy marks this opportunity official and core evidence is available.',
      evidence: uniqueLimited(['Official Pick', probabilityAdvantage(opportunity) ? 'Probability advantage' : null, positiveValue(opportunity) ? 'Positive value' : null], 3),
      limitingFactor: 'No visible limiting factor from exposed readiness evidence.',
    }
  }
  if (opportunity.officialPick) {
    return {
      label: 'HIGH',
      rationale: 'The opportunity is official, but freshness limits immediate confidence.',
      evidence: ['Official Pick', 'Freshness limited'],
      limitingFactor: 'Stored odds are stale or aging.',
    }
  }
  if (stale) {
    return {
      label: 'MODERATE',
      rationale: 'The signal deserves review, but stale or aging odds prevent stronger conviction.',
      evidence: uniqueLimited([probabilityAdvantage(opportunity) ? 'Probability advantage' : null, positiveValue(opportunity) ? 'Positive value' : null, 'Freshness limited'], 3),
      limitingFactor: 'Stored odds are stale or aging.',
    }
  }
  if (positiveValue(opportunity) && probabilityAdvantage(opportunity)) {
    return {
      label: 'HIGH',
      rationale: 'Probability and value signals are positive, but this is still not an Official Pick.',
      evidence: ['Probability advantage', 'Positive edge', 'Positive EV'],
      limitingFactor: opportunity.officialPickReason,
    }
  }
  if (positiveValue(opportunity) || probabilityAdvantage(opportunity)) {
    return {
      label: 'MODERATE',
      rationale: 'Some useful signal is present, but the evidence is incomplete or not official.',
      evidence: uniqueLimited([positiveValue(opportunity) ? 'Positive value' : null, probabilityAdvantage(opportunity) ? 'Probability advantage' : null], 3),
      limitingFactor: opportunity.officialPickReason,
    }
  }
  return {
    label: 'LOW',
    rationale: 'The opportunity is visible, but exposed evidence does not support stronger attention.',
    evidence: ['Visible opportunity'],
    limitingFactor: primaryBlocker(opportunity, readiness),
  }
}

function buildActionability(input: AiDecisionInput): ActionabilityPresentation {
  const { opportunity, readiness, freshnessStatus, nextActionAt = null } = input
  if (!opportunity || missingCoreEvidence(opportunity, readiness)) {
    return {
      state: 'UNAVAILABLE',
      rationale: 'Required probability or pricing evidence is missing.',
      primaryBlocker: 'Required evidence is unavailable.',
      nextReviewAt: nextActionAt ?? null,
    }
  }
  if (unsupportedMarket(readiness) || gateFailed(readiness, 'pregame_eligibility') || negativeValue(opportunity)) {
    return {
      state: 'DO NOT ACT',
      rationale: 'Existing evidence blocks immediate action.',
      primaryBlocker: primaryBlocker(opportunity, readiness),
      nextReviewAt: nextActionAt ?? null,
    }
  }
  if (staleEvidence(opportunity, readiness, freshnessStatus) || gatePending(readiness, 'odds_freshness')) {
    return {
      state: 'WAIT',
      rationale: 'A fresher market update is needed before action is appropriate.',
      primaryBlocker: 'Stored odds are stale or aging.',
      nextReviewAt: nextActionAt ?? opportunity.updatedAt,
    }
  }
  if (opportunity.officialPick) {
    return {
      state: 'ACT NOW',
      rationale: 'The existing production policy marks this as an Official Pick and freshness is acceptable.',
      primaryBlocker: 'No immediate blocker exposed.',
      nextReviewAt: nextActionAt ?? null,
    }
  }
  if (readiness.status === 'OFFICIAL') {
    return {
      state: 'ACTIONABLE',
      rationale: 'Certified readiness evidence supports action, but the product remains conservative.',
      primaryBlocker: 'No immediate blocker exposed.',
      nextReviewAt: nextActionAt ?? null,
    }
  }
  return {
    state: 'REVIEW FIRST',
    rationale: 'The opportunity has useful evidence but is not an Official Pick.',
    primaryBlocker: opportunity.officialPickReason,
    nextReviewAt: nextActionAt ?? null,
  }
}

function buildChangeConditions(input: AiDecisionInput): ChangeCondition[] {
  const { opportunity, readiness, freshnessStatus, nextActionAt = null } = input
  const conditions: ChangeCondition[] = []
  if (!opportunity) {
    conditions.push({
      conditionId: 'opportunity_available',
      currentState: 'No supported opportunity is visible.',
      possibleChange: 'A supported priced opportunity becomes available.',
      expectedEffect: 'could allow the product to evaluate a stronger review state.',
      qualifier: 'This would not guarantee an Official Pick.',
    })
  } else {
    if (staleEvidence(opportunity, readiness, freshnessStatus)) {
      conditions.push({
        conditionId: 'fresh_odds_update',
        currentState: 'Stored odds are stale or aging.',
        possibleChange: 'A fresh odds update arrives.',
        expectedEffect: 'could improve actionability.',
        qualifier: nextActionAt ? `Review after ${nextActionAt}.` : 'This depends on the next stored refresh.',
      })
    }
    if (gateFailed(readiness, 'confidence_threshold')) {
      conditions.push({
        conditionId: 'confidence_gate',
        currentState: 'Confidence is below the existing Official Pick gate.',
        possibleChange: 'The existing confidence gate clears in stored evidence.',
        expectedEffect: 'could improve Official Pick readiness.',
        qualifier: 'This would still need the other policy gates to remain satisfied.',
      })
    }
    if (gateFailed(readiness, 'odds_availability')) {
      conditions.push({
        conditionId: 'priced_market_available',
        currentState: 'Stored offered odds are missing.',
        possibleChange: 'A supported price becomes available.',
        expectedEffect: 'could allow value evaluation.',
        qualifier: 'The line would still need to pass existing policy evidence.',
      })
    }
    if (opportunity.blockers.length) {
      conditions.push({
        conditionId: 'policy_blocker_resolution',
        currentState: plainBlocker(opportunity.blockers[0]),
        possibleChange: 'The current blocker resolves in stored evidence.',
        expectedEffect: 'could move this from review-only toward a stronger state.',
        qualifier: 'This does not promise Official Pick status.',
      })
    }
    if (positiveValue(opportunity) && conditions.length < 3) {
      conditions.push({
        conditionId: 'value_weakens',
        currentState: 'Edge and expected value are currently positive.',
        possibleChange: 'Edge or expected value becomes non-positive.',
        expectedEffect: 'would weaken conviction.',
        qualifier: 'This is a downside condition, not an action trigger.',
      })
    }
  }
  return conditions.slice(0, 3).length ? conditions.slice(0, 3) : [{
    conditionId: 'no_single_change',
    currentState: 'No decisive single condition is exposed.',
    possibleChange: noSingleChange,
    expectedEffect: 'would keep the recommendation conservative.',
    qualifier: 'The product will not fabricate certainty.',
  }]
}

export function buildAiDecisionPresentation(input: AiDecisionInput): AiDecisionPresentation {
  return {
    explanation: buildExplanation(input),
    conviction: buildConviction(input),
    actionability: buildActionability(input),
    changeConditions: buildChangeConditions(input),
  }
}
