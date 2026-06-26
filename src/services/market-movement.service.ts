type BookLine = {
  sportsbook: string
  odds: number
  formattedOdds: string
}

export type MarketMovementResult = {
  steamMove: boolean
  reverseLineMovement: boolean
  staleLine: boolean
  movementSignal:
    | 'STEAM_MOVE'
    | 'STALE_LINE'
    | 'REVERSE_LINE'
    | 'VALUE_GAP'
    | 'NORMAL'
  marketMovementScore: number
  valueGap: number
  sharpConfidence: number
  bestBook: string
  slowBook: string
  marketDirection: 'TOWARD_PICK' | 'AGAINST_PICK' | 'NEUTRAL'
  marketPressure: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function getDecimalOdds(americanOdds: number) {
  return americanOdds > 0
    ? 1 + americanOdds / 100
    : 1 + 100 / Math.abs(americanOdds)
}

function getImpliedProbability(americanOdds: number) {
  if (americanOdds < 0) {
    return (Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)) * 100
  }

  return (100 / (americanOdds + 100)) * 100
}

function getBestLine(books: BookLine[]) {
  return [...books].sort(
    (a, b) => getDecimalOdds(b.odds) - getDecimalOdds(a.odds)
  )[0]
}

function getWorstLine(books: BookLine[]) {
  return [...books].sort(
    (a, b) => getDecimalOdds(a.odds) - getDecimalOdds(b.odds)
  )[0]
}

function calculateValueGap(bestOdds: number, consensusOdds: number) {
  const bestDecimal = getDecimalOdds(bestOdds)
  const consensusDecimal = getDecimalOdds(consensusOdds)

  return round((bestDecimal - consensusDecimal) * 100)
}

function calculateMarketPressure(bestOdds: number, worstOdds: number) {
  const bestImplied = getImpliedProbability(bestOdds)
  const worstImplied = getImpliedProbability(worstOdds)

  return round(Math.abs(bestImplied - worstImplied))
}

function getMarketDirection(bestOdds: number, consensusOdds: number) {
  const bestImplied = getImpliedProbability(bestOdds)
  const consensusImplied = getImpliedProbability(consensusOdds)

  const diff = consensusImplied - bestImplied

  if (diff >= 1.5) return 'AGAINST_PICK'
  if (diff <= -1.5) return 'TOWARD_PICK'

  return 'NEUTRAL'
}

export function analyzeMarketMovement({
  books,
  bestOdds,
  worstOdds,
  consensusOdds,
  lineValue,
  smartScore,
  edge,
  ev,
  confidence,
}: {
  books: BookLine[]
  bestOdds: number
  worstOdds: number
  consensusOdds: number
  lineValue: number
  smartScore: number
  edge: number
  ev: number
  confidence: number
}): MarketMovementResult {
  const bestLine = getBestLine(books)
  const worstLine = getWorstLine(books)

  const valueGap = calculateValueGap(bestOdds, consensusOdds)
  const marketPressure = calculateMarketPressure(bestOdds, worstOdds)
  const marketDirection = getMarketDirection(bestOdds, consensusOdds)

  const staleLine = valueGap >= 3 || lineValue >= 3
  const steamMove = marketPressure >= 4 && books.length >= 5
  const reverseLineMovement =
    marketDirection === 'AGAINST_PICK' && edge >= 8 && ev >= 8

  let movementSignal: MarketMovementResult['movementSignal'] = 'NORMAL'

  if (steamMove) movementSignal = 'STEAM_MOVE'
  if (staleLine) movementSignal = 'STALE_LINE'
  if (reverseLineMovement) movementSignal = 'REVERSE_LINE'
  if (!steamMove && !staleLine && !reverseLineMovement && valueGap >= 2) {
    movementSignal = 'VALUE_GAP'
  }

  const marketMovementScore = round(
    Math.min(
      100,
      valueGap * 8 +
        marketPressure * 5 +
        smartScore * 0.25 +
        edge * 0.6 +
        ev * 0.25
    )
  )

  const sharpConfidence = round(
    Math.min(
      100,
      confidence * 0.35 +
        smartScore * 0.25 +
        marketMovementScore * 0.25 +
        edge * 0.15
    )
  )

  return {
    steamMove,
    reverseLineMovement,
    staleLine,
    movementSignal,
    marketMovementScore,
    valueGap,
    sharpConfidence,
    bestBook: bestLine?.sportsbook ?? 'Unknown',
    slowBook: worstLine?.sportsbook ?? 'Unknown',
    marketDirection,
    marketPressure,
  }
}