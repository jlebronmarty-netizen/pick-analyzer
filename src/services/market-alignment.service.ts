import 'server-only'

export type MarketAlignmentStatus =
  | 'ALIGNED'
  | 'MISSING_PRICE'
  | 'MISSING_PROBABILITY'
  | 'LINE_MISMATCH'
  | 'SELECTION_MISMATCH'
  | 'PERIOD_MISMATCH'
  | 'STALE_INPUT'
  | 'UNSUPPORTED_MARKET'

export type MarketFreshnessStatus = 'FRESH' | 'AGING' | 'STALE' | 'EXPIRED' | 'UNKNOWN'

export type MarketAlignmentContract = {
  alignmentStatus: MarketAlignmentStatus
  aligned: boolean
  eventId: string
  predictionId: string
  oddsSnapshotId: string | null
  marketType: string
  period: string
  selection: string
  normalizedSelection: string | null
  line: number | null
  americanOdds: number | null
  decimalOdds: number | null
  sportsbook: string | null
  modelProbability: number | null
  calibratedProbability: number | null
  marketImpliedProbability: number | null
  noVigProbability: number | null
  edgePercentagePoints: number | null
  expectedValuePercent: number | null
  snapshotEdgePercentagePoints: number | null
  snapshotExpectedValuePercent: number | null
  actionableEdgePercentagePoints: number | null
  actionableExpectedValuePercent: number | null
  actionableUnavailableReason: string | null
  marketInputTimestamp: string | null
  providerSourceTimestamp: string | null
  oddsIngestedAt: string | null
  marketAgeMinutes: number | null
  providerSourceAgeMinutes: number | null
  snapshotIngestionAgeMinutes: number | null
  freshnessStatus: MarketFreshnessStatus
  confidence: number | null
  risk: 'CONTROLLED' | 'MODERATE' | 'ELEVATED' | 'STALE_MARKET_INPUT' | 'UNAVAILABLE'
  recommendationCategory: string | null
  reasonCodes: string[]
  calculationVersion: 'market_alignment_v1'
}

type MarketAlignmentInput = {
  eventId: string
  predictionId: string
  oddsSnapshotId?: string | null
  marketType: string | null
  period?: string | null
  selection?: string | null
  normalizedSelection?: string | null
  oddsOutcome?: string | null
  line?: number | null
  oddsLine?: number | null
  americanOdds?: number | null
  sportsbook?: string | null
  modelProbability?: number | null
  calibratedProbability?: number | null
  noVigProbability?: number | null
  marketInputTimestamp?: string | null
  providerSourceTimestamp?: string | null
  oddsIngestedAt?: string | null
  marketAgeMinutes?: number | null
  providerSourceAgeMinutes?: number | null
  snapshotIngestionAgeMinutes?: number | null
  maxAllowedAgeMinutes?: number | null
  confidence?: number | null
  recommendationCategory?: string | null
  reasonCodes?: string[]
}

const SUPPORTED_MARKETS = new Set(['moneyline', 'spread', 'run_line', 'total'])

function finite(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function ageMinutes(value: string | null | undefined, now = Date.now()) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.round((now - parsed) / 60000))
}

function freshnessStatus(age: number | null, maxAllowedAgeMinutes: number | null | undefined): MarketFreshnessStatus {
  if (age === null) return 'UNKNOWN'
  const threshold = finite(maxAllowedAgeMinutes) ?? 30
  if (age <= Math.max(5, threshold / 2)) return 'FRESH'
  if (age <= threshold) return 'AGING'
  if (age > Math.max(threshold * 2, threshold + 60)) return 'EXPIRED'
  return 'STALE'
}

function riskStatus({
  aligned,
  freshness,
  confidence,
  edge,
  ev,
}: {
  aligned: boolean
  freshness: MarketFreshnessStatus
  confidence: number | null
  edge: number | null
  ev: number | null
}): MarketAlignmentContract['risk'] {
  if (!aligned) return 'UNAVAILABLE'
  if (freshness === 'STALE' || freshness === 'EXPIRED') return 'STALE_MARKET_INPUT'
  if ((confidence ?? 0) < 45 || (edge ?? 0) < -10 || (ev ?? 0) < -15) return 'ELEVATED'
  if ((confidence ?? 0) < 60 || (edge ?? 0) < 0 || (ev ?? 0) < 0 || freshness === 'AGING') return 'MODERATE'
  return 'CONTROLLED'
}

export function americanToDecimalOdds(americanOdds: number | null | undefined) {
  const odds = finite(americanOdds)
  if (odds === null || odds === 0) return null
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)
}

export function marketImpliedProbabilityFromAmerican(americanOdds: number | null | undefined) {
  const odds = finite(americanOdds)
  if (odds === null || odds === 0) return null
  return odds > 0 ? (100 / (odds + 100)) * 100 : (Math.abs(odds) / (Math.abs(odds) + 100)) * 100
}

export function expectedValuePercentFromAmerican(modelProbability: number | null | undefined, americanOdds: number | null | undefined) {
  const probability = finite(modelProbability)
  const decimalOdds = americanToDecimalOdds(americanOdds)
  if (probability === null || probability <= 0 || decimalOdds === null) return null
  return (probability / 100) * decimalOdds * 100 - 100
}

export function buildMarketAlignment(input: MarketAlignmentInput): MarketAlignmentContract {
  const marketType = String(input.marketType ?? 'unknown')
  const period = String(input.period ?? 'full_game')
  const selection = String(input.selection ?? '').trim()
  const normalizedSelection = input.normalizedSelection ? String(input.normalizedSelection).toLowerCase() : null
  const oddsOutcome = input.oddsOutcome ? String(input.oddsOutcome).toLowerCase() : null
  const line = finite(input.line)
  const oddsLine = finite(input.oddsLine)
  const americanOdds = finite(input.americanOdds)
  const modelProbability = finite(input.modelProbability)
  const calibratedProbability = finite(input.calibratedProbability)
  const marketAge = finite(input.marketAgeMinutes) ?? ageMinutes(input.marketInputTimestamp)
  const sourceAge = finite(input.providerSourceAgeMinutes) ?? ageMinutes(input.providerSourceTimestamp)
  const ingestionAge = finite(input.snapshotIngestionAgeMinutes) ?? ageMinutes(input.oddsIngestedAt)
  const freshness = freshnessStatus(marketAge, input.maxAllowedAgeMinutes)
  const reasonCodes = [...(input.reasonCodes ?? [])]

  let alignmentStatus: MarketAlignmentStatus = 'ALIGNED'
  if (!SUPPORTED_MARKETS.has(marketType)) alignmentStatus = 'UNSUPPORTED_MARKET'
  else if (modelProbability === null || modelProbability <= 0) alignmentStatus = 'MISSING_PROBABILITY'
  else if (americanOdds === null || americanOdds === 0) alignmentStatus = 'MISSING_PRICE'
  else if (oddsOutcome && normalizedSelection && oddsOutcome !== normalizedSelection && oddsOutcome !== selection.toLowerCase()) alignmentStatus = 'SELECTION_MISMATCH'
  else if ((marketType === 'spread' || marketType === 'run_line' || marketType === 'total') && (line === null || oddsLine === null || Math.abs(line - oddsLine) >= 0.001)) alignmentStatus = 'LINE_MISMATCH'
  else if (marketType === 'moneyline' && oddsLine !== null) alignmentStatus = 'LINE_MISMATCH'

  if (freshness === 'STALE') reasonCodes.push('STALE_INPUT')
  if (freshness === 'EXPIRED') reasonCodes.push('EXPIRED_INPUT')
  const aligned = alignmentStatus === 'ALIGNED'
  const decimalOdds = aligned ? americanToDecimalOdds(americanOdds) : null
  const marketImpliedProbability = aligned ? marketImpliedProbabilityFromAmerican(americanOdds) : null
  const edge = aligned && modelProbability !== null && marketImpliedProbability !== null ? modelProbability - marketImpliedProbability : null
  const ev = aligned ? expectedValuePercentFromAmerican(modelProbability, americanOdds) : null
  const actionableUnavailableReason = !aligned
    ? alignmentStatus
    : freshness === 'STALE' || freshness === 'EXPIRED'
      ? 'STALE_MARKET_INPUT'
      : freshness === 'UNKNOWN'
        ? 'UNKNOWN_MARKET_TIMESTAMP'
        : null
  const actionableEdge = actionableUnavailableReason ? null : edge
  const actionableEv = actionableUnavailableReason ? null : ev

  return {
    alignmentStatus,
    aligned,
    eventId: input.eventId,
    predictionId: input.predictionId,
    oddsSnapshotId: input.oddsSnapshotId ?? null,
    marketType,
    period,
    selection,
    normalizedSelection,
    line,
    americanOdds,
    decimalOdds: decimalOdds === null ? null : round(decimalOdds, 4),
    sportsbook: input.sportsbook ?? null,
    modelProbability,
    calibratedProbability,
    marketImpliedProbability: marketImpliedProbability === null ? null : round(marketImpliedProbability, 2),
    noVigProbability: finite(input.noVigProbability),
    edgePercentagePoints: edge === null ? null : round(edge, 2),
    expectedValuePercent: ev === null ? null : round(ev, 2),
    snapshotEdgePercentagePoints: edge === null ? null : round(edge, 2),
    snapshotExpectedValuePercent: ev === null ? null : round(ev, 2),
    actionableEdgePercentagePoints: actionableEdge === null ? null : round(actionableEdge, 2),
    actionableExpectedValuePercent: actionableEv === null ? null : round(actionableEv, 2),
    actionableUnavailableReason,
    marketInputTimestamp: input.marketInputTimestamp ?? null,
    providerSourceTimestamp: input.providerSourceTimestamp ?? null,
    oddsIngestedAt: input.oddsIngestedAt ?? null,
    marketAgeMinutes: marketAge,
    providerSourceAgeMinutes: sourceAge,
    snapshotIngestionAgeMinutes: ingestionAge,
    freshnessStatus: freshness,
    confidence: finite(input.confidence),
    risk: riskStatus({ aligned, freshness, confidence: finite(input.confidence), edge, ev }),
    recommendationCategory: input.recommendationCategory ?? null,
    reasonCodes: Array.from(new Set(reasonCodes)),
    calculationVersion: 'market_alignment_v1',
  }
}

export function validateMarketAlignmentFixtures() {
  const freshTimestamp = new Date(Date.now() - 8 * 60000).toISOString()
  const staleTimestamp = new Date(Date.now() - 60 * 60000).toISOString()
  const alignedBase: MarketAlignmentInput = {
    eventId: 'event-1',
    predictionId: 'prediction-1',
    oddsSnapshotId: 'odds-1',
    marketType: 'moneyline',
    period: 'full_game',
    selection: 'MIN',
    normalizedSelection: 'away',
    oddsOutcome: 'away',
    line: null,
    oddsLine: null,
    americanOdds: -110,
    modelProbability: 55,
    calibratedProbability: 55,
    sportsbook: 'Consensus',
    marketInputTimestamp: freshTimestamp,
    marketAgeMinutes: 8,
    maxAllowedAgeMinutes: 30,
    confidence: 62,
    recommendationCategory: 'AI Lean',
  }
  const checks = [
    ['-200 implied probability', marketImpliedProbabilityFromAmerican(-200)?.toFixed(1) === '66.7'],
    ['-150 implied probability', marketImpliedProbabilityFromAmerican(-150)?.toFixed(1) === '60.0'],
    ['-110 implied probability', marketImpliedProbabilityFromAmerican(-110)?.toFixed(1) === '52.4'],
    ['+100 implied probability', marketImpliedProbabilityFromAmerican(100)?.toFixed(1) === '50.0'],
    ['+150 implied probability', marketImpliedProbabilityFromAmerican(150)?.toFixed(1) === '40.0'],
    ['+200 implied probability', marketImpliedProbabilityFromAmerican(200)?.toFixed(1) === '33.3'],
    ['zero odds invalid', marketImpliedProbabilityFromAmerican(0) === null],
    ['-110 at 55 percent EV', expectedValuePercentFromAmerican(55, -110)?.toFixed(1) === '5.0'],
    ['+150 at 45 percent EV', expectedValuePercentFromAmerican(45, 150)?.toFixed(1) === '12.5'],
    ['-200 at 60 percent EV', expectedValuePercentFromAmerican(60, -200)?.toFixed(1) === '-10.0'],
    ['moneyline alignment', buildMarketAlignment(alignedBase).alignmentStatus === 'ALIGNED'],
    ['run-line alignment', buildMarketAlignment({ ...alignedBase, marketType: 'run_line', line: 1.5, oddsLine: 1.5 }).alignmentStatus === 'ALIGNED'],
    ['total alignment', buildMarketAlignment({ ...alignedBase, marketType: 'total', selection: 'Under', normalizedSelection: 'under', oddsOutcome: 'under', line: 8.5, oddsLine: 8.5 }).alignmentStatus === 'ALIGNED'],
    ['line mismatch', buildMarketAlignment({ ...alignedBase, marketType: 'run_line', line: 1.5, oddsLine: -1.5 }).alignmentStatus === 'LINE_MISMATCH'],
    ['selection mismatch', buildMarketAlignment({ ...alignedBase, oddsOutcome: 'home' }).alignmentStatus === 'SELECTION_MISMATCH'],
    ['missing probability', buildMarketAlignment({ ...alignedBase, modelProbability: null }).alignmentStatus === 'MISSING_PROBABILITY'],
    ['placeholder zero probability blocked', buildMarketAlignment({ ...alignedBase, modelProbability: 0 }).alignmentStatus === 'MISSING_PROBABILITY'],
    ['missing odds', buildMarketAlignment({ ...alignedBase, americanOdds: null }).alignmentStatus === 'MISSING_PRICE'],
    ['stale snapshot marked stale but structurally aligned', buildMarketAlignment({ ...alignedBase, marketInputTimestamp: staleTimestamp, marketAgeMinutes: 60 }).freshnessStatus === 'STALE'],
    ['stale hides actionable EV', buildMarketAlignment({ ...alignedBase, marketInputTimestamp: staleTimestamp, marketAgeMinutes: 60 }).actionableExpectedValuePercent === null],
    ['fresh exposes actionable EV', buildMarketAlignment(alignedBase).actionableExpectedValuePercent !== null],
    ['unknown timestamp is unknown', buildMarketAlignment({ ...alignedBase, marketInputTimestamp: null, marketAgeMinutes: null }).freshnessStatus === 'UNKNOWN'],
    ['positive EV', (buildMarketAlignment(alignedBase).expectedValuePercent ?? 0) > 0],
    ['negative EV', (buildMarketAlignment({ ...alignedBase, americanOdds: -200, modelProbability: 60 }).expectedValuePercent ?? 0) < 0],
    ['zero EV', expectedValuePercentFromAmerican(50, 100)?.toFixed(1) === '0.0'],
    ['edge rounding', buildMarketAlignment(alignedBase).edgePercentagePoints?.toFixed(1) === '2.6'],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'market_alignment_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    calculationVersion: 'market_alignment_v1',
  }
}
