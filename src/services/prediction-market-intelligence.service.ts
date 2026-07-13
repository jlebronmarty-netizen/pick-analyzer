export type BookMarketLine = {
  sportsbook: string
  team: string
  odds: number
}

export type PredictionMarketIntelligence = {
  marketAverageOdds: number
  bestOdds: number
  worstOdds: number
  bestBook: string
  slowBook: string
  valueGap: number
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
  sharpConfidence: number
  sharpSignal: boolean
  sharpLabel:
    | 'SHARP_VALUE'
    | 'POSSIBLE_STEAM'
    | 'STALE_BOOK'
    | 'MARKET_WATCH'
    | 'NO_SHARP_SIGNAL'
  bettingUrgency: 'BET_NOW' | 'PLAYABLE' | 'MONITOR' | 'AVOID'
  urgencyScore: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function getDecimalOdds(americanOdds: number) {
  return americanOdds > 0
    ? 1 + americanOdds / 100
    : 1 + 100 / Math.abs(americanOdds)
}

function getAverage(values: number[]) {
  if (!values.length) return 0

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function decimalToAmerican(decimalOdds: number) {
  if (decimalOdds >= 2) {
    return Math.round((decimalOdds - 1) * 100)
  }

  return Math.round(-100 / (decimalOdds - 1))
}

function getBestLine(lines: BookMarketLine[]) {
  return [...lines].sort(
    (a, b) => getDecimalOdds(b.odds) - getDecimalOdds(a.odds)
  )[0]
}

function getWorstLine(lines: BookMarketLine[]) {
  return [...lines].sort(
    (a, b) => getDecimalOdds(a.odds) - getDecimalOdds(b.odds)
  )[0]
}

function getMarketAverageOdds(lines: BookMarketLine[]) {
  const averageDecimal = getAverage(lines.map((line) => getDecimalOdds(line.odds)))

  return decimalToAmerican(averageDecimal)
}

export function getPredictionMarketIntelligence({
  team,
  odds,
  edge,
  ev,
  confidence,
  lines,
}: {
  team: string
  odds: number
  edge: number
  ev: number
  confidence: number
  lines: BookMarketLine[]
}): PredictionMarketIntelligence {
  const matchingLines = lines.filter(
    (line) => line.team.trim().toLowerCase() === team.trim().toLowerCase()
  )

  const usableLines =
    matchingLines.length > 0
      ? matchingLines
      : [
          {
            sportsbook: 'Current Book',
            team,
            odds,
          },
        ]

  const bestLine = getBestLine(usableLines)
  const worstLine = getWorstLine(usableLines)
  const marketAverageOdds = getMarketAverageOdds(usableLines)

  const bestDecimal = getDecimalOdds(bestLine.odds)
  const worstDecimal = getDecimalOdds(worstLine.odds)
  const averageDecimal = getDecimalOdds(marketAverageOdds)

  const valueGap = round((bestDecimal - averageDecimal) * 100)
  const marketSpread = round((bestDecimal - worstDecimal) * 100)

  const staleLine = valueGap >= 3
  const steamMove = marketSpread >= 4 && usableLines.length >= 4
  const reverseLineMovement = edge >= 8 && ev >= 8 && bestLine.odds < marketAverageOdds

  let movementSignal: PredictionMarketIntelligence['movementSignal'] = 'NORMAL'

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
        marketSpread * 5 +
        edge * 0.8 +
        ev * 0.25 +
        confidence * 0.15
    )
  )

  const sharpConfidence = round(
    Math.min(
      100,
      confidence * 0.4 +
        marketMovementScore * 0.3 +
        edge * 0.2 +
        ev * 0.1
    )
  )

  let sharpSignal = false
  let sharpLabel: PredictionMarketIntelligence['sharpLabel'] = 'NO_SHARP_SIGNAL'

  if (sharpConfidence >= 80 && staleLine) {
    sharpSignal = true
    sharpLabel = 'SHARP_VALUE'
  } else if (steamMove && marketMovementScore >= 70) {
    sharpSignal = true
    sharpLabel = 'POSSIBLE_STEAM'
  } else if (staleLine) {
    sharpSignal = true
    sharpLabel = 'STALE_BOOK'
  } else if (reverseLineMovement) {
    sharpSignal = true
    sharpLabel = 'MARKET_WATCH'
  }

  const urgencyScore = round(
    Math.min(
      100,
      sharpConfidence * 0.35 +
        marketMovementScore * 0.3 +
        valueGap * 8 +
        confidence * 0.15
    )
  )

  let bettingUrgency: PredictionMarketIntelligence['bettingUrgency'] = 'MONITOR'

  if (sharpSignal && staleLine && urgencyScore >= 75) {
    bettingUrgency = 'BET_NOW'
  } else if (confidence >= 75 && ev >= 10 && edge >= 8) {
    bettingUrgency = 'PLAYABLE'
  } else if (confidence < 60 || ev < 3 || edge < 3) {
    bettingUrgency = 'AVOID'
  }

  return {
    marketAverageOdds,
    bestOdds: bestLine.odds,
    worstOdds: worstLine.odds,
    bestBook: bestLine.sportsbook,
    slowBook: worstLine.sportsbook,
    valueGap,
    steamMove,
    reverseLineMovement,
    staleLine,
    movementSignal,
    marketMovementScore,
    sharpConfidence,
    sharpSignal,
    sharpLabel,
    bettingUrgency,
    urgencyScore,
  }
}