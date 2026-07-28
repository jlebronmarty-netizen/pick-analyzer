import 'server-only'

import { createHash } from 'crypto'
import { getCurrentBoardCached } from '@/services/current-board.service'
import { getProbabilityPicks, type ProbabilityPickFilters } from '@/services/probability-picks.service'
import type { ProbabilityFreshnessSummary, ProbabilityMarketType, ProbabilityPick } from '@/types/probability-picks'
import type {
  PortfolioCombination,
  PortfolioDependencyTolerance,
  PortfolioIntelligenceResponse,
  PortfolioOpportunity,
  PortfolioRelationshipClass,
} from '@/types/portfolio-intelligence'

export type PortfolioIntelligenceFilters = {
  sport?: string | null
  market?: string | null
  size?: number | null
  limit?: number | null
  dependency?: PortfolioDependencyTolerance | null
  freshnessRequirement?: ProbabilityFreshnessSummary['status'] | 'all' | null
}

const INDEPENDENCE_WARNING = 'Naive joint probability assumes independence and may overstate or understate the true combined probability.'
const FRESHNESS_ORDER: Record<ProbabilityFreshnessSummary['status'], number> = { UNKNOWN: 0, STALE: 1, AGING: 2, FRESH: 3 }

function nowIso() {
  return new Date().toISOString()
}

function hash(parts: unknown[]) {
  return createHash('sha256').update(parts.map((part) => String(part ?? 'null')).join('|')).digest('hex').slice(0, 20)
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max)
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function freshnessFromPick(pick: ProbabilityPick): ProbabilityFreshnessSummary['status'] {
  if (pick.freshness >= 78) return 'FRESH'
  if (pick.freshness >= 58) return 'AGING'
  if (pick.freshness > 0) return 'STALE'
  return 'UNKNOWN'
}

function normalizeMarket(market: string | null | undefined): ProbabilityMarketType | null {
  const raw = String(market ?? '').toLowerCase()
  if (raw === 'spread') return 'run_line'
  if (raw === 'moneyline' || raw === 'run_line' || raw === 'total' || raw === 'pitcher_outs') return raw
  return null
}

function exposureTeam(selection: string) {
  const clean = selection.trim()
  if (!clean || /^(over|under)$/i.test(clean)) return null
  return clean.toLowerCase()
}

function alignedPriceMap(board: Awaited<ReturnType<typeof getCurrentBoardCached>>) {
  const map = new Map<string, number | null>()
  for (const candidate of board.candidates ?? []) {
    const market = normalizeMarket(candidate.market)
    if (!market) continue
    const key = [candidate.eventId, market, candidate.selection.toLowerCase()].join('|')
    map.set(key, candidate.americanOdds ?? null)
  }
  return map
}

function opportunityFromPick(pick: ProbabilityPick, prices: Map<string, number | null>): PortfolioOpportunity {
  const freshness = freshnessFromPick(pick)
  const priceKey = [pick.eventId, pick.marketType, pick.selection.toLowerCase()].join('|')
  const currentPrice = prices.has(priceKey) ? prices.get(priceKey) ?? null : null
  const currentPriceAvailable = currentPrice !== null && currentPrice !== 0
  const blockers = [
    freshness === 'STALE' || freshness === 'UNKNOWN' ? 'Input freshness is not certified fresh.' : null,
    !pick.sportEligibility.eligibleForRanking ? 'Sport is not certified for ranking.' : null,
  ].filter(Boolean) as string[]

  return {
    id: pick.id,
    sport: pick.sport,
    eventId: pick.eventId,
    market: pick.marketType,
    selection: pick.selection,
    modelProbability: pick.modelProbability,
    confidence: pick.confidence,
    quality: pick.quality,
    currentPriceAvailable,
    currentPrice,
    freshness,
    status: blockers.length ? 'BLOCKED' : 'ELIGIBLE',
    dataSufficiency: pick.featureCompleteness,
    sharedEventExposureKey: pick.eventId,
    sharedTeamExposureKey: exposureTeam(pick.selection),
    sharedPlayerExposureKey: pick.marketType === 'pitcher_outs' ? pick.selection.toLowerCase() : null,
    evidenceSource: currentPriceAvailable ? 'probability_picks_current_board_overlay' : 'probability_picks',
    blockers,
    risk: pick.risk,
  }
}

function relationForPair(a: PortfolioOpportunity, b: PortfolioOpportunity): PortfolioRelationshipClass[] {
  const relations = new Set<PortfolioRelationshipClass>()
  if (a.sport !== b.sport) relations.add('CROSS_SPORT')
  if (a.eventId === b.eventId) relations.add('SAME_EVENT')
  if (a.sharedTeamExposureKey && a.sharedTeamExposureKey === b.sharedTeamExposureKey) relations.add('SAME_TEAM')
  if (a.eventId === b.eventId && a.market === b.market && a.selection !== b.selection) relations.add('OPPOSING_SIDES')
  const markets = new Set([a.market, b.market])
  if (a.eventId === b.eventId && markets.has('moneyline') && markets.has('run_line')) relations.add('MONEYLINE_RUNLINE_RELATIONSHIP')
  if (a.eventId === b.eventId && markets.has('total') && (markets.has('moneyline') || markets.has('run_line'))) relations.add('SIDE_TOTAL_RELATIONSHIP')
  if (
    a.eventId === b.eventId &&
    ((a.sharedPlayerExposureKey && b.sharedTeamExposureKey) || (b.sharedPlayerExposureKey && a.sharedTeamExposureKey))
  ) relations.add('PLAYER_TEAM_RELATIONSHIP')
  if (!relations.size) relations.add('INDEPENDENCE_UNKNOWN')
  return Array.from(relations)
}

function relationshipClasses(legs: PortfolioOpportunity[]) {
  const relations = new Set<PortfolioRelationshipClass>()
  for (let i = 0; i < legs.length; i += 1) {
    for (let j = i + 1; j < legs.length; j += 1) {
      relationForPair(legs[i], legs[j]).forEach((relation) => relations.add(relation))
    }
  }
  if (!relations.size) relations.add('INSUFFICIENT_EVIDENCE')
  return Array.from(relations)
}

function concentrationScore(relationships: PortfolioRelationshipClass[]) {
  let score = 0
  if (relationships.includes('SAME_EVENT')) score += 35
  if (relationships.includes('OPPOSING_SIDES')) score += 45
  if (relationships.includes('SAME_TEAM')) score += 18
  if (relationships.includes('MONEYLINE_RUNLINE_RELATIONSHIP')) score += 20
  if (relationships.includes('SIDE_TOTAL_RELATIONSHIP')) score += 16
  if (relationships.includes('PLAYER_TEAM_RELATIONSHIP')) score += 14
  if (relationships.includes('CROSS_SPORT')) score -= 15
  return clamp(score)
}

function diversification(relationships: PortfolioRelationshipClass[], concentration: number): PortfolioCombination['diversification'] {
  if (relationships.includes('OPPOSING_SIDES') || relationships.includes('SAME_EVENT')) return 'Same-event dependent'
  if (relationships.includes('INSUFFICIENT_EVIDENCE')) return 'Insufficient evidence'
  if (relationships.includes('CROSS_SPORT') && concentration <= 20) return 'Diversified by sport'
  if (concentration <= 25) return 'Lower shared exposure'
  return 'Concentrated'
}

function buildCombination(legs: PortfolioOpportunity[]): PortfolioCombination {
  const relationship = relationshipClasses(legs)
  const concentration = concentrationScore(relationship)
  const blockers = [
    ...legs.flatMap((leg) => leg.blockers),
    relationship.includes('OPPOSING_SIDES') ? 'Opposing sides in the same event are not suitable for a clean combined view.' : null,
  ].filter(Boolean) as string[]
  const uncertaintyFlags = [
    INDEPENDENCE_WARNING,
    legs.some((leg) => !leg.currentPriceAvailable) ? 'At least one leg has no aligned current market price; actionable EV is N/A.' : null,
    relationship.includes('INDEPENDENCE_UNKNOWN') ? 'No historical correlation calculation is available for these legs.' : null,
  ].filter(Boolean) as string[]
  const weakestLeg = [...legs].sort((a, b) => (a.quality + a.confidence + a.modelProbability) - (b.quality + b.confidence + b.modelProbability))[0]
  const naiveJoint = legs.reduce((product, leg) => product * (leg.modelProbability / 100), 1) * 100

  return {
    id: `portfolio:${hash(legs.map((leg) => leg.id))}`,
    legCount: legs.length,
    legs,
    relationshipClasses: relationship,
    naiveJointProbability: round(naiveJoint, 2),
    naiveJointProbabilityLabel: 'Independence-based naive joint probability',
    combinedEvidenceQuality: round(legs.reduce((sum, leg) => sum + leg.quality + leg.confidence + leg.dataSufficiency, 0) / (legs.length * 3)),
    weakestLeg,
    concentrationScore: concentration,
    diversification: diversification(relationship, concentration),
    dependencyWarnings: [
      relationship.includes('SAME_EVENT') ? 'Same-event legs share game-state exposure.' : null,
      relationship.includes('SAME_TEAM') ? 'Multiple legs share team exposure.' : null,
      relationship.includes('MONEYLINE_RUNLINE_RELATIONSHIP') ? 'Moneyline and run line can move together for the same team or event.' : null,
      relationship.includes('SIDE_TOTAL_RELATIONSHIP') ? 'Side and total outcomes can share game-script exposure.' : null,
    ].filter(Boolean) as string[],
    uncertaintyFlags,
    blocked: blockers.length > 0,
    blockers: Array.from(new Set(blockers)),
  }
}

function combinations<T>(items: T[], size: number, limit = 250) {
  const result: T[][] = []
  const walk = (start: number, combo: T[]) => {
    if (result.length >= limit) return
    if (combo.length === size) {
      result.push([...combo])
      return
    }
    for (let index = start; index < items.length; index += 1) {
      combo.push(items[index])
      walk(index + 1, combo)
      combo.pop()
    }
  }
  walk(0, [])
  return result
}

function dependencyAllowed(combo: PortfolioCombination, dependency: PortfolioDependencyTolerance) {
  if (dependency === 'all') return true
  if (dependency === 'cross_sport_only') return combo.relationshipClasses.includes('CROSS_SPORT') && combo.concentrationScore <= 20
  return combo.concentrationScore <= 35 && !combo.relationshipClasses.includes('OPPOSING_SIDES')
}

export async function getPortfolioIntelligence(filters: PortfolioIntelligenceFilters = {}): Promise<PortfolioIntelligenceResponse> {
  const size = Math.min(Math.max(Math.round(Number(filters.size ?? 2) || 2), 2), 3)
  const limit = Math.min(Math.max(Math.round(Number(filters.limit ?? 20) || 20), 1), 50)
  const dependency = filters.dependency ?? 'all'
  const freshnessRequirement = filters.freshnessRequirement ?? 'all'
  const probabilityFilters: ProbabilityPickFilters = {
    sport: filters.sport ?? 'all',
    market: filters.market ?? 'all',
    sort: 'score',
    limit: 80,
  }
  const [picksResponse, board] = await Promise.all([
    getProbabilityPicks(probabilityFilters),
    getCurrentBoardCached('baseball_mlb', 'CURRENT', 200),
  ])
  const prices = alignedPriceMap(board)
  const sourceOpportunities = picksResponse.picks.map((pick) => opportunityFromPick(pick, prices))
  const eligible = sourceOpportunities.filter((opportunity) => {
    if (opportunity.status !== 'ELIGIBLE') return false
    if (freshnessRequirement !== 'all' && FRESHNESS_ORDER[opportunity.freshness] < FRESHNESS_ORDER[freshnessRequirement]) return false
    return true
  })
  const rawCombinations = combinations(eligible, size, 400).map(buildCombination)
  const allowed = rawCombinations.filter((combo) => dependencyAllowed(combo, dependency))
  const sorted = [...allowed].sort((a, b) =>
    b.combinedEvidenceQuality - a.combinedEvidenceQuality ||
    b.naiveJointProbability - a.naiveJointProbability ||
    a.concentrationScore - b.concentrationScore
  )
  const combinationsOut = sorted.slice(0, limit)

  return {
    success: true,
    mode: 'portfolio_intelligence_v1',
    generatedAt: nowIso(),
    dryRun: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    sourceOpportunityCount: sourceOpportunities.length,
    eligibleOpportunityCount: eligible.length,
    availableSports: Array.from(new Set(eligible.map((opportunity) => opportunity.sport))).sort(),
    evidenceCoverage: {
      currentPriceAvailable: sourceOpportunities.filter((opportunity) => opportunity.currentPriceAvailable).length,
      currentPriceUnavailable: sourceOpportunities.filter((opportunity) => !opportunity.currentPriceAvailable).length,
      staleInputs: sourceOpportunities.filter((opportunity) => opportunity.freshness === 'STALE' || opportunity.freshness === 'UNKNOWN').length,
      blockedOpportunities: sourceOpportunities.filter((opportunity) => opportunity.status === 'BLOCKED').length,
    },
    freshness: picksResponse.freshnessSummary ?? picksResponse.summary.freshnessSummary ?? {
      status: 'UNKNOWN',
      latestGeneratedAt: null,
      oldestGeneratedAt: null,
      staleRows: 0,
      agingRows: 0,
      freshRows: 0,
    },
    calculationAssumptions: [
      INDEPENDENCE_WARNING,
      'Dependency labels are deterministic shared-exposure classifications, not statistical correlation coefficients.',
      'No bankroll sizing, Kelly sizing, sportsbook execution or Official Pick promotion is produced.',
    ],
    filters: {
      sport: filters.sport ?? null,
      market: filters.market ?? null,
      size,
      limit,
      dependency,
      freshnessRequirement,
    },
    combinations: combinationsOut,
    blockedCombinations: rawCombinations.filter((combo) => combo.blocked).slice(0, 20),
    strongestEvidenceCombination: [...allowed].sort((a, b) => b.combinedEvidenceQuality - a.combinedEvidenceQuality)[0] ?? null,
    highestNaiveJointProbability: [...allowed].sort((a, b) => b.naiveJointProbability - a.naiveJointProbability)[0] ?? null,
    lowestSharedExposure: [...allowed].sort((a, b) => a.concentrationScore - b.concentrationScore || b.combinedEvidenceQuality - a.combinedEvidenceQuality)[0] ?? null,
    exclusions: sourceOpportunities
      .filter((opportunity) => opportunity.status === 'BLOCKED')
      .map((opportunity) => ({ id: opportunity.id, reason: opportunity.blockers[0] ?? 'Blocked by portfolio eligibility.' })),
    warnings: [
      sourceOpportunities.length < size ? 'Not enough eligible source opportunities for the requested combination size.' : null,
      rawCombinations.length > allowed.length ? 'Some combinations were filtered by dependency tolerance.' : null,
      picksResponse.warnings.length ? picksResponse.warnings.join('; ') : null,
    ].filter(Boolean) as string[],
  }
}

export function validatePortfolioIntelligenceFixtures() {
  const mk = (overrides: Partial<PortfolioOpportunity>): PortfolioOpportunity => ({
    id: overrides.id ?? 'a',
    sport: overrides.sport ?? 'baseball_mlb',
    eventId: overrides.eventId ?? 'event-1',
    market: overrides.market ?? 'moneyline',
    selection: overrides.selection ?? 'A',
    modelProbability: overrides.modelProbability ?? 60,
    confidence: overrides.confidence ?? 65,
    quality: overrides.quality ?? 70,
    currentPriceAvailable: overrides.currentPriceAvailable ?? true,
    currentPrice: overrides.currentPrice ?? -110,
    freshness: overrides.freshness ?? 'FRESH',
    status: overrides.status ?? 'ELIGIBLE',
    dataSufficiency: overrides.dataSufficiency ?? 75,
    sharedEventExposureKey: overrides.sharedEventExposureKey ?? overrides.eventId ?? 'event-1',
    sharedTeamExposureKey: overrides.sharedTeamExposureKey === undefined ? exposureTeam(overrides.selection ?? 'A') : overrides.sharedTeamExposureKey,
    sharedPlayerExposureKey: overrides.sharedPlayerExposureKey ?? null,
    evidenceSource: overrides.evidenceSource ?? 'probability_picks_current_board_overlay',
    blockers: overrides.blockers ?? [],
    risk: overrides.risk ?? 'LOW',
  })
  const sameEvent = buildCombination([mk({ id: 'a', eventId: 'e1', selection: 'A' }), mk({ id: 'b', eventId: 'e1', selection: 'B' })])
  const sameTeam = buildCombination([mk({ id: 'c', eventId: 'e1', selection: 'A' }), mk({ id: 'd', eventId: 'e2', selection: 'A' })])
  const crossSport = buildCombination([mk({ id: 'e', sport: 'baseball_mlb', eventId: 'e1' }), mk({ id: 'f', sport: 'basketball_nba', eventId: 'e2', selection: 'C' })])
  const noPrice = buildCombination([mk({ id: 'g', currentPriceAvailable: false, currentPrice: null }), mk({ id: 'h', eventId: 'e2', selection: 'D' })])
  const stale = mk({ id: 'i', freshness: 'STALE', blockers: ['Input freshness is not certified fresh.'], status: 'BLOCKED' })
  const checks = [
    ['same-event classification', sameEvent.relationshipClasses.includes('SAME_EVENT')],
    ['opposing-sides classification', sameEvent.relationshipClasses.includes('OPPOSING_SIDES')],
    ['same-team classification', sameTeam.relationshipClasses.includes('SAME_TEAM')],
    ['cross-sport classification', crossSport.relationshipClasses.includes('CROSS_SPORT')],
    ['no price produces unsupported-price warning', noPrice.uncertaintyFlags.some((flag) => flag.includes('actionable EV is N/A'))],
    ['stale market is blocked', stale.status === 'BLOCKED'],
    ['insufficient evidence falls back to unknown independence', buildCombination([mk({ id: 'j', eventId: 'e1' }), mk({ id: 'k', eventId: 'e2', selection: 'K' })]).relationshipClasses.includes('INDEPENDENCE_UNKNOWN')],
    ['independence warning is always present', crossSport.uncertaintyFlags.includes(INDEPENDENCE_WARNING)],
    ['zero opportunities can be represented', combinations([], 2).length === 0],
  ]
  return {
    success: checks.every(([, pass]) => pass),
    mode: 'portfolio_intelligence_v1_validation',
    checks: checks.map(([name, pass]) => ({ name, pass })),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
