export type SharpMoneyResult = {
  sharpSignal: boolean
  sharpLabel:
    | 'SHARP_VALUE'
    | 'POSSIBLE_STEAM'
    | 'STALE_BOOK'
    | 'MARKET_WATCH'
    | 'NO_SHARP_SIGNAL'
  sharpSummary: string
}

export function getSharpMoneySignal({
  steamMove,
  staleLine,
  reverseLineMovement,
  sharpConfidence,
  marketMovementScore,
  valueGap,
}: {
  steamMove: boolean
  staleLine: boolean
  reverseLineMovement: boolean
  sharpConfidence: number
  marketMovementScore: number
  valueGap: number
}): SharpMoneyResult {
  if (
    sharpConfidence >= 80 &&
    staleLine &&
    valueGap >= 3
  ) {
    return {
      sharpSignal: true,
      sharpLabel: 'SHARP_VALUE',
      sharpSummary:
        'Strong market value detected. Best available line is meaningfully better than consensus.',
    }
  }

  if (
    steamMove &&
    marketMovementScore >= 70
  ) {
    return {
      sharpSignal: true,
      sharpLabel: 'POSSIBLE_STEAM',
      sharpSummary:
        'Possible steam move detected. Market prices are separated enough to suggest fast movement.',
    }
  }

  if (
    staleLine &&
    valueGap >= 3
  ) {
    return {
      sharpSignal: true,
      sharpLabel: 'STALE_BOOK',
      sharpSummary:
        'Stale line detected. One sportsbook is offering a better price than the market average.',
    }
  }

  if (reverseLineMovement) {
    return {
      sharpSignal: true,
      sharpLabel: 'MARKET_WATCH',
      sharpSummary:
        'Reverse line movement profile detected. Monitor before betting.',
    }
  }

  return {
    sharpSignal: false,
    sharpLabel: 'NO_SHARP_SIGNAL',
    sharpSummary: 'No strong sharp-money signal detected right now.',
  }
}