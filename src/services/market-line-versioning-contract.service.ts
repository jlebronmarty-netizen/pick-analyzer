import 'server-only'

export type MarketLineKind = 'moneyline' | 'spread' | 'total'
export type MarketLineDirection = 'UP' | 'DOWN' | 'UNCHANGED' | 'UNKNOWN'
export type MarketLineMovementClassification =
  | 'EXACT_LINE_AVAILABLE'
  | 'HALF_POINT_MOVE'
  | 'FULL_POINT_MOVE'
  | 'MULTI_POINT_MOVE'
  | 'ALTERNATE_LINES_AVAILABLE'
  | 'NO_CURRENT_MARKET'
  | 'UNKNOWN'

export type MarketLineEvidence = {
  provider: string
  eventId: string
  bookmaker: string
  bookmakerKey: string
  market: MarketLineKind
  selection: string
  line: number | null
  price: number
  sourceTimestamp: string | null
  capturedAt: string
}

export type PredictionLineIdentity = {
  predictionId: string
  eventId: string
  market: MarketLineKind
  selection: string
  line: number | null
  generatedAt: string | null
  cutoffAt: string | null
}

export type PregameRepredictionInput = {
  prediction: PredictionLineIdentity
  currentEvidence: MarketLineEvidence[]
  now: string
  eventStartTime: string | null
  requiredFeaturesAvailable: boolean
  exactPredictionAlreadyExists: boolean
}

function finiteLine(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function sameLine(left: number | null | undefined, right: number | null | undefined) {
  if (!finiteLine(left) && !finiteLine(right)) return true
  if (!finiteLine(left) || !finiteLine(right)) return false
  return Math.abs(left - right) < 0.001
}

function comparableLine(market: MarketLineKind, value: number | null | undefined) {
  if (!finiteLine(value)) return value
  return market === 'total' ? Math.abs(value) : value
}

function sameMarketLine(market: MarketLineKind, left: number | null | undefined, right: number | null | undefined) {
  return sameLine(comparableLine(market, left), comparableLine(market, right))
}

function parseTime(value: string | null | undefined) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function marketLineIdentityKey(input: Omit<MarketLineEvidence, 'price' | 'sourceTimestamp' | 'capturedAt'>) {
  const normalizedLine = comparableLine(input.market, input.line)
  const line = finiteLine(normalizedLine) ? normalizedLine.toFixed(3) : 'null'
  return [
    input.provider,
    input.eventId,
    input.bookmakerKey,
    input.market,
    input.selection,
    line,
  ].join('|')
}

export function filterExactLineEvidence(prediction: PredictionLineIdentity, evidence: MarketLineEvidence[]) {
  return evidence.filter((row) => (
    row.eventId === prediction.eventId &&
    row.market === prediction.market &&
    row.selection === prediction.selection &&
    sameMarketLine(prediction.market, row.line, prediction.line)
  ))
}

export function classifyLineMovement(predictionLine: number | null, evidence: MarketLineEvidence[]) {
  const market = evidence.find((row) => row.market)?.market ?? 'total'
  const currentLines = Array.from(new Set(
    evidence.map((row) => comparableLine(market, row.line)).filter(finiteLine),
  )).sort((left, right) => left - right)

  const comparablePredictionLine = comparableLine(market, predictionLine)
  if (!currentLines.length) {
    return {
      classification: 'NO_CURRENT_MARKET' as MarketLineMovementClassification,
      direction: 'UNKNOWN' as MarketLineDirection,
      predictionLine,
      currentLines,
      closestLine: null as number | null,
      delta: null as number | null,
    }
  }

  if (!finiteLine(comparablePredictionLine)) {
    return {
      classification: 'UNKNOWN' as MarketLineMovementClassification,
      direction: 'UNKNOWN' as MarketLineDirection,
      predictionLine,
      currentLines,
      closestLine: null as number | null,
      delta: null as number | null,
    }
  }

  if (currentLines.some((line) => sameLine(line, comparablePredictionLine))) {
    return {
      classification: 'EXACT_LINE_AVAILABLE' as MarketLineMovementClassification,
      direction: 'UNCHANGED' as MarketLineDirection,
      predictionLine,
      currentLines,
      closestLine: comparablePredictionLine,
      delta: 0,
    }
  }

  const closestLine = currentLines.reduce((best, line) => (
    Math.abs(line - comparablePredictionLine) < Math.abs(best - comparablePredictionLine) ? line : best
  ), currentLines[0])
  const delta = closestLine - comparablePredictionLine
  const absoluteDelta = Math.abs(delta)
  const classification: MarketLineMovementClassification = absoluteDelta === 0.5
    ? 'HALF_POINT_MOVE'
    : absoluteDelta === 1
      ? 'FULL_POINT_MOVE'
      : absoluteDelta > 1
        ? 'MULTI_POINT_MOVE'
        : 'ALTERNATE_LINES_AVAILABLE'

  return {
    classification,
    direction: delta > 0 ? 'UP' as const : delta < 0 ? 'DOWN' as const : 'UNCHANGED' as const,
    predictionLine,
    currentLines,
    closestLine,
    delta,
  }
}

export function evaluatePregameRepredictionEligibility(input: PregameRepredictionInput) {
  const exactEvidence = filterExactLineEvidence(input.prediction, input.currentEvidence)
  const movement = classifyLineMovement(input.prediction.line, input.currentEvidence)
  const nowMs = parseTime(input.now)
  const startMs = parseTime(input.eventStartTime)
  const cutoffMs = parseTime(input.prediction.cutoffAt)
  const eventPregame = nowMs !== null && startMs !== null && nowMs < startMs
  const cutoffSafe = nowMs !== null && cutoffMs !== null && nowMs < cutoffMs
  const supportedMarket = input.prediction.market === 'total' || input.prediction.market === 'spread'
  const freshCurrentPriceExists = input.currentEvidence.some((row) => row.sourceTimestamp)
  const exactLineAvailable = exactEvidence.length > 0
  const lineIdentityChanged = !exactLineAvailable && movement.classification !== 'NO_CURRENT_MARKET'
  const eligible = Boolean(
    eventPregame &&
    cutoffSafe &&
    supportedMarket &&
    freshCurrentPriceExists &&
    input.requiredFeaturesAvailable &&
    lineIdentityChanged &&
    !input.exactPredictionAlreadyExists,
  )

  return {
    eligible,
    mode: 'DRY_RUN_ONLY' as const,
    productionPredictionCreated: false,
    exactLineAvailable,
    lineIdentityChanged,
    movement,
    blockers: [
      eventPregame ? null : 'EVENT_NOT_PREGAME',
      cutoffSafe ? null : 'CUTOFF_NOT_SAFE',
      supportedMarket ? null : 'MARKET_NOT_SUPPORTED_FOR_LINE_VERSIONING',
      freshCurrentPriceExists ? null : 'FRESH_CURRENT_PRICE_MISSING',
      input.requiredFeaturesAvailable ? null : 'REQUIRED_FEATURES_MISSING',
      lineIdentityChanged ? null : 'LINE_IDENTITY_UNCHANGED_OR_MARKET_MISSING',
      input.exactPredictionAlreadyExists ? 'EXACT_NEW_LINE_PREDICTION_ALREADY_EXISTS' : null,
    ].filter((item): item is string => Boolean(item)),
  }
}

export function buildSupersessionLineageDraft(input: {
  oldPredictionId: string
  eventId: string
  market: MarketLineKind
  selection: string
  oldLine: number | null
  newLine: number | null
  sourcePriceTimestamp: string | null
}) {
  return {
    oldPredictionId: input.oldPredictionId,
    eventId: input.eventId,
    market: input.market,
    selection: input.selection,
    oldLine: input.oldLine,
    newLine: input.newLine,
    oldPredictionStatus: 'SUPERSEDED_BY_MARKET_MOVE',
    supersedeReason: 'MARKET_LINE_CHANGED',
    sourcePriceTimestamp: input.sourcePriceTimestamp,
    productionMutation: false,
  }
}

export function lineSpecificTotalSettlement(input: {
  selection: 'Over' | 'Under'
  predictionLine: number
  finalTotal: number
}) {
  if (input.finalTotal === input.predictionLine) return 'push'
  if (input.selection === 'Over') return input.finalTotal > input.predictionLine ? 'win' : 'loss'
  return input.finalTotal < input.predictionLine ? 'win' : 'loss'
}
