type BettingExplanationInput = {
  team: string
  opponent: string
  formattedBestOdds: string
  bestSportsbook: string
  formattedConsensusOdds: string
  modelProbability: number
  impliedProbability: number
  edge: number
  ev: number
  confidence: number
  riskGrade: string
  riskLabel: string
  smartScore: number
  lineValue: number
  valueGap: number
  sharpSignal: boolean
  sharpLabel: string
  bettingUrgency: string
  urgencyScore: number
  valueWindow: string
  closingLineProjection: string
  intelligenceSummary: string
  recommendedStake: number
}

function formatPercent(value: number) {
  return `${Number(value).toFixed(2)}%`
}

function formatMoney(value: number) {
  return `$${Number(value).toFixed(2)}`
}

function getFinalRecommendation(input: BettingExplanationInput) {
  if (
    input.bettingUrgency === 'BET_NOW' &&
    input.sharpSignal &&
    input.confidence >= 75
  ) {
    return 'BET NOW'
  }

  if (input.bettingUrgency === 'BET_NOW') {
    return 'PLAYABLE NOW'
  }

  if (input.bettingUrgency === 'WAIT') {
    return 'WAIT FOR BETTER LINE'
  }

  if (input.bettingUrgency === 'AVOID') {
    return 'AVOID'
  }

  return 'MONITOR'
}

function getTone(recommendation: string) {
  if (recommendation === 'BET NOW') return 'Strong'
  if (recommendation === 'PLAYABLE NOW') return 'Positive'
  if (recommendation === 'WAIT FOR BETTER LINE') return 'Cautious'
  if (recommendation === 'AVOID') return 'Avoid'

  return 'Neutral'
}

export function buildBettingExplanation(input: BettingExplanationInput) {
  const finalRecommendation = getFinalRecommendation(input)
  const tone = getTone(finalRecommendation)

  const summary =
    `${input.team} ML is showing a ${tone.toLowerCase()} betting profile. ` +
    `The model projects ${formatPercent(input.modelProbability)} while the market implies ` +
    `${formatPercent(input.impliedProbability)}, creating an edge of ${formatPercent(input.edge)}.`

  const marketRead =
    `${input.bestSportsbook} currently has the best available line at ` +
    `${input.formattedBestOdds}, compared to a market consensus of ` +
    `${input.formattedConsensusOdds}. The current line value is ` +
    `${formatPercent(input.lineValue)}.`

  const sharpRead =
    input.sharpSignal
      ? `Sharp signal detected: ${input.sharpLabel}. ${input.intelligenceSummary}`
      : `No major sharp-money signal is confirmed yet. ${input.intelligenceSummary}`

  const riskRead =
    `Risk grade is ${input.riskGrade} (${input.riskLabel}) with a Smart Score of ` +
    `${input.smartScore.toFixed(2)} and model confidence of ${formatPercent(input.confidence)}.`

  const stakeRead =
    `Suggested stake based on bankroll and Kelly logic is ${formatMoney(input.recommendedStake)}.`

  const action =
    finalRecommendation === 'BET NOW'
      ? `Recommendation: BET NOW. The value window is open and the best line may not last.`
      : finalRecommendation === 'PLAYABLE NOW'
        ? `Recommendation: PLAYABLE NOW. The edge is strong, but monitor the market before placing a larger stake.`
        : finalRecommendation === 'WAIT FOR BETTER LINE'
          ? `Recommendation: WAIT. Market movement is unstable and a better entry may appear.`
          : finalRecommendation === 'AVOID'
            ? `Recommendation: AVOID. The signal is not strong enough for a premium play.`
            : `Recommendation: MONITOR. Keep watching for line movement or a stronger sharp signal.`

  return {
    aiRecommendation: finalRecommendation,
    aiTone: tone,
    aiSummary: summary,
    aiMarketRead: marketRead,
    aiSharpRead: sharpRead,
    aiRiskRead: riskRead,
    aiStakeRead: stakeRead,
    aiAction: action,
    aiFullExplanation: [
      summary,
      marketRead,
      sharpRead,
      riskRead,
      stakeRead,
      input.closingLineProjection,
      action,
    ].join(' '),
  }
}