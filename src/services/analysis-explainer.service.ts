type ExplainPickInput = {
  team: string
  opponent: string
  odds: number
  model_probability: number
  implied_probability: number
  confidence: number
  edge: number
  ev: number
  risk_grade?: string
  risk_label?: string
  smart_score?: number
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`
}

export function explainPick(pick: ExplainPickInput) {
  const strengths: string[] = []
  const risks: string[] = []

  if (pick.edge >= 20) {
    strengths.push('Large market edge detected.')
  } else if (pick.edge >= 10) {
    strengths.push('Positive market edge.')
  }

  if (pick.ev >= 50) {
    strengths.push('Very strong expected value.')
  } else if (pick.ev >= 20) {
    strengths.push('Strong expected value.')
  }

  if (pick.confidence >= 85) {
    strengths.push('High model confidence.')
  } else if (pick.confidence >= 70) {
    strengths.push('Playable confidence level.')
  }

  if (pick.smart_score && pick.smart_score >= 85) {
    strengths.push('Elite Smart Score ranking.')
  }

  if (pick.odds > 250) {
    risks.push('Plus-money underdog with higher variance.')
  }

  if (pick.confidence < 70) {
    risks.push('Confidence is below premium-play range.')
  }

  if ((pick.smart_score ?? 0) < 65) {
    risks.push('Smart Score is moderate, not elite.')
  }

  return {
    title: `${pick.team} ML ${formatOdds(pick.odds)}`,
    matchup: `${pick.team} vs ${pick.opponent}`,
    summary: `${pick.team} grades as ${pick.risk_grade ?? 'N/A'} ${
      pick.risk_label ?? ''
    } with ${pick.confidence.toFixed(2)}% confidence, ${pick.edge.toFixed(
      2
    )}% edge and ${pick.ev.toFixed(2)}% EV.`,
    strengths,
    risks,
    biggestRisk:
      risks[0] ?? 'Main risk is normal sports variance and market movement.',
    recommendation:
      (pick.smart_score ?? 0) >= 85
        ? 'Strong play'
        : (pick.smart_score ?? 0) >= 70
          ? 'Playable with discipline'
          : 'Use caution',
  }
}