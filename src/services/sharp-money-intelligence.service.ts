import { getTopPicks } from '@/services/top-picks.service'

type PickRow = {
  id?: string
  team: string
  opponent: string
  sport_key?: string
  sportsbook?: string
  odds: number
  confidence: number
  edge: number
  ev: number
  model_probability?: number
  implied_probability?: number
  smart_score?: number
  adaptive_score?: number
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function sharpScore(pick: PickRow) {
  const confidence = Number(pick.confidence ?? 0)
  const edge = Number(pick.edge ?? 0)
  const ev = Number(pick.ev ?? 0)
  const adaptive = Number(pick.adaptive_score ?? pick.smart_score ?? 0)
  const odds = Number(pick.odds ?? 0)

  const oddsValue =
    odds > 0 ? Math.min(odds / 20, 20) : Math.min(Math.abs(odds) / 12, 18)

  return round(
    clamp(
      confidence * 0.25 +
        adaptive * 0.25 +
        edge * 1.35 +
        ev * 1.15 +
        oddsValue,
      0,
      100
    )
  )
}

function getSignal(score: number) {
  if (score >= 85) return 'STEAM_MOVE'
  if (score >= 75) return 'STRONG_SHARP'
  if (score >= 65) return 'SHARP_LEAN'
  if (score >= 50) return 'MARKET_WATCH'
  return 'NO_SIGNAL'
}

function getRisk(score: number) {
  if (score >= 75) return 'LOW'
  if (score >= 55) return 'MEDIUM'
  return 'HIGH'
}

function estimatePublicPercent(pick: PickRow, score: number) {
  const odds = Number(pick.odds ?? 0)
  const favoriteBias = odds < 0 ? 12 : -8
  const sharpFade = score >= 70 ? -10 : 0

  return round(clamp(55 + favoriteBias + sharpFade, 18, 82))
}

function estimateConsensusPercent(pick: PickRow, score: number) {
  const model = Number(pick.model_probability ?? pick.confidence ?? 0)
  return round(clamp((model + score) / 2, 0, 100))
}

function estimateClosingLine(pick: PickRow, score: number) {
  const odds = Number(pick.odds ?? 0)
  const moveCents = score >= 85 ? 18 : score >= 75 ? 12 : score >= 65 ? 7 : 3

  if (odds < 0) return odds - moveCents
  return odds - moveCents
}

function getMoves(pick: PickRow, score: number) {
  const ev = Number(pick.ev ?? 0)
  const edge = Number(pick.edge ?? 0)
  const publicPercent = estimatePublicPercent(pick, score)

  return {
    steamMove: score >= 85 && ev >= 8,
    reverseLineMovement: score >= 70 && publicPercent < 45 && edge >= 4,
    publicFade: score >= 70 && publicPercent < 45,
    valueWindow: ev >= 5 && edge >= 3,
    lateMoneyCandidate: score >= 80,
    lineFreeze: score >= 65 && ev >= 5 && edge >= 4,
  }
}

function buildReasons(pick: PickRow, score: number) {
  const moves = getMoves(pick, score)
  const reasons: string[] = []

  if (moves.steamMove) {
    reasons.push('Steam move profile detected from strong EV, edge and model confidence.')
  }

  if (moves.reverseLineMovement) {
    reasons.push('Reverse line movement candidate: model edge is stronger than estimated public support.')
  }

  if (moves.publicFade) {
    reasons.push('Public fade candidate: sharp score is high while estimated public support is limited.')
  }

  if (moves.valueWindow) {
    reasons.push('Current line still appears to offer a positive value window.')
  }

  if (moves.lateMoneyCandidate) {
    reasons.push('Late sharp money candidate based on combined market and model strength.')
  }

  if (moves.lineFreeze) {
    reasons.push('Possible line freeze: value remains despite strong model-side signal.')
  }

  if (reasons.length === 0) {
    reasons.push('No major sharp-money pattern detected yet.')
  }

  return reasons
}

export async function getSharpMoneyIntelligence() {
  const topPicks = await getTopPicks()

  const pool = [...topPicks.bestBets, ...topPicks.topEv, ...topPicks.topConfidence]
    .filter((pick: any, index, arr) => {
      const key = `${pick.team}-${pick.opponent}-${pick.odds}`
      return (
        arr.findIndex(
          (item: any) => `${item.team}-${item.opponent}-${item.odds}` === key
        ) === index
      )
    })
    .slice(0, 30) as PickRow[]

  const signals = pool
    .map((pick) => {
      const score = sharpScore(pick)
      const moves = getMoves(pick, score)
      const publicPercent = estimatePublicPercent(pick, score)
      const consensusPercent = estimateConsensusPercent(pick, score)
      const expectedClosingLine = estimateClosingLine(pick, score)
      const valueCents = round(Number(pick.odds ?? 0) - expectedClosingLine)

      return {
        ...pick,
        formattedOdds: formatOdds(Number(pick.odds ?? 0)),
        sharpScore: score,
        signal: getSignal(score),
        risk: getRisk(score),
        publicPercent,
        consensusPercent,
        expectedClosingLine,
        expectedClosingLineFormatted: formatOdds(expectedClosingLine),
        valueCents,
        moves,
        reasons: buildReasons(pick, score),
      }
    })
    .sort((a, b) => b.sharpScore - a.sharpScore)

  const strongSignals = signals.filter((item) => item.sharpScore >= 75)
  const watchList = signals.filter(
    (item) => item.sharpScore >= 55 && item.sharpScore < 75
  )
  const publicFades = signals.filter((item) => item.moves.publicFade)
  const valueWindows = signals.filter((item) => item.moves.valueWindow)

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    summary: {
      totalSignals: signals.length,
      strongSignals: strongSignals.length,
      watchList: watchList.length,
      publicFades: publicFades.length,
      valueWindows: valueWindows.length,
      bestSignal: signals[0] ?? null,
      averageSharpScore: round(
        signals.reduce((sum, item) => sum + item.sharpScore, 0) /
          Math.max(signals.length, 1)
      ),
    },
    strongSignals,
    watchList,
    publicFades,
    valueWindows,
    signals,
  }
}