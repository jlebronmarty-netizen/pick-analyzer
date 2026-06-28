export type MarketIntelligenceResult = {
  bettingUrgency:
    | 'BET_NOW'
    | 'WAIT'
    | 'MONITOR'
    | 'AVOID'
  urgencyScore: number
  valueWindow:
    | 'OPEN'
    | 'CLOSING'
    | 'CLOSED'
    | 'UNKNOWN'
  publicSharpIndicator:
    | 'SHARP_SIDE'
    | 'PUBLIC_SIDE'
    | 'MIXED'
    | 'UNKNOWN'
  closingLineProjection: string
  closingLineRisk:
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
  intelligenceSummary: string
}

function round(value: number) {
  return Number(value.toFixed(2))
}

export function getMarketIntelligence({
  alertType,
  sharpSignal,
  sharpConfidence,
  marketMovementScore,
  valueGap,
  staleLine,
  steamMove,
  reverseLineMovement,
  lineValue,
  marketPressure,
}: {
  alertType: string
  sharpSignal: boolean
  sharpConfidence: number
  marketMovementScore: number
  valueGap: number
  staleLine: boolean
  steamMove: boolean
  reverseLineMovement: boolean
  lineValue: number
  marketPressure: number
}): MarketIntelligenceResult {
  const urgencyScore = round(
    Math.min(
      100,
      sharpConfidence * 0.35 +
        marketMovementScore * 0.3 +
        valueGap * 8 +
        lineValue * 4 +
        marketPressure * 3
    )
  )

  let bettingUrgency: MarketIntelligenceResult['bettingUrgency'] = 'MONITOR'

  if (
    sharpSignal &&
    staleLine &&
    urgencyScore >= 75
  ) {
    bettingUrgency = 'BET_NOW'
  } else if (
    alertType === 'LIVE_VALUE' &&
    urgencyScore >= 70
  ) {
    bettingUrgency = 'BET_NOW'
  } else if (
    reverseLineMovement ||
    marketPressure >= 5
  ) {
    bettingUrgency = 'WAIT'
  } else if (
    alertType === 'WATCHLIST' ||
    urgencyScore < 45
  ) {
    bettingUrgency = 'AVOID'
  }

  const valueWindow =
    bettingUrgency === 'BET_NOW'
      ? 'OPEN'
      : bettingUrgency === 'WAIT'
        ? 'CLOSING'
        : bettingUrgency === 'AVOID'
          ? 'CLOSED'
          : 'UNKNOWN'

  const publicSharpIndicator =
    sharpSignal && sharpConfidence >= 70
      ? 'SHARP_SIDE'
      : steamMove
        ? 'MIXED'
        : reverseLineMovement
          ? 'MIXED'
          : 'UNKNOWN'

  const closingLineRisk =
    valueGap >= 4 || staleLine
      ? 'HIGH'
      : marketPressure >= 3
        ? 'MEDIUM'
        : 'LOW'

  const closingLineProjection =
    valueGap >= 4
      ? 'Best line may disappear soon.'
      : steamMove
        ? 'Market may continue moving quickly.'
        : reverseLineMovement
          ? 'Market is moving against the model side.'
          : 'No major closing-line pressure detected.'

  const intelligenceSummary =
    bettingUrgency === 'BET_NOW'
      ? 'Value window is open. Best available line is meaningfully better than the market.'
      : bettingUrgency === 'WAIT'
        ? 'Market movement is unstable. Waiting may reduce risk.'
        : bettingUrgency === 'AVOID'
          ? 'Signal is not strong enough for a premium play.'
          : 'Monitor the line for additional movement.'

  return {
    bettingUrgency,
    urgencyScore,
    valueWindow,
    publicSharpIndicator,
    closingLineProjection,
    closingLineRisk,
    intelligenceSummary,
  }
}