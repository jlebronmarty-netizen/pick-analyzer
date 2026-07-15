type PickInput = {
  team: string
  opponent: string
  sport_key?: string
  sportsbook?: string
  market?: string
  odds: number
  confidence: number
  model_probability: number
  implied_probability: number
  edge: number
  ev: number
  risk_grade?: string
  risk_label?: string
  kelly_percent?: number
  recommended_stake?: number
  smart_score?: number
  adaptive_score?: number
  adaptive_adjustment?: any
  recommendation_status?: string
  recommendation_label?: string
  confidence_label?: string
  reliability_label?: string
  value_label?: string
  qualification_blockers?: string[]
}

function num(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`
}

function getVerdict(pick: PickInput) {
  if (pick.recommendation_label) return pick.recommendation_label
  if (num(pick.edge) <= 0 || num(pick.ev) <= 0) return 'Not recommended'

  const confidence = num(pick.confidence)
  const edge = num(pick.edge)
  const ev = num(pick.ev)
  const adaptiveScore = num(pick.adaptive_score ?? pick.smart_score)

  if (adaptiveScore >= 70 && confidence >= 75 && edge >= 8 && ev >= 10) {
    return 'Strong Play'
  }

  if (adaptiveScore >= 55 && confidence >= 65 && edge >= 5 && ev >= 5) {
    return 'Playable'
  }

  return 'Use Caution'
}

function getRisk(pick: PickInput) {
  if (pick.risk_label) return pick.risk_label
  if (pick.risk_grade === 'A+' || pick.risk_grade === 'A') return 'Low Risk'
  if (pick.risk_grade === 'B') return 'Medium Risk'
  return 'High Risk'
}

function buildReasons(pick: PickInput) {
  const reasons: string[] = []

  if (num(pick.model_probability) > num(pick.implied_probability)) {
    reasons.push(
      `Model probability is higher than implied probability by ${num(
        pick.edge
      ).toFixed(2)} percentage points.`
    )
  }

  if (num(pick.ev) > 0) {
    reasons.push(`Expected value is positive at ${num(pick.ev).toFixed(2)}%.`)
  } else {
    reasons.push('No modeled value is present because expected value is not positive.')
  }

  if (num(pick.confidence) >= 75) {
    reasons.push(`Confidence is strong at ${num(pick.confidence).toFixed(2)}%.`)
  } else if (num(pick.confidence) >= 65) {
    reasons.push(`Confidence is playable at ${num(pick.confidence).toFixed(2)}%.`)
  } else {
    reasons.push(`Confidence is moderate at ${num(pick.confidence).toFixed(2)}%.`)
  }

  if (pick.adaptive_adjustment?.strongestAdjustment) {
    const adj = pick.adaptive_adjustment.strongestAdjustment

    reasons.push(
      `Adaptive model adjustment was driven most by ${adj.factor} with a ${num(
        adj.multiplier,
        1
      ).toFixed(2)}x multiplier.`
    )
  }

  if (num(pick.kelly_percent) > 0) {
    reasons.push(
      `Kelly staking suggests ${num(pick.kelly_percent).toFixed(
        2
      )}% bankroll exposure before risk caps.`
    )
  }

  return reasons
}

function buildWarnings(pick: PickInput) {
  const warnings: string[] = []

  if (num(pick.edge) <= 0 || num(pick.ev) <= 0) {
    warnings.push('This selection is analyzed only and is not an official recommended wager.')
  }

  if (num(pick.odds) > 250) {
    warnings.push('This is a plus-money underdog with elevated variance.')
  }

  if (num(pick.confidence) < 65) {
    warnings.push('Confidence is below preferred premium-pick threshold.')
  }

  if (num(pick.edge) < 5) {
    warnings.push('Edge is thin compared with stronger value spots.')
  }

  for (const blocker of pick.qualification_blockers ?? []) {
    warnings.push(`Policy blocker: ${blocker}.`)
  }

  if (num(pick.adaptive_score ?? pick.smart_score) < num(pick.smart_score)) {
    warnings.push(
      'Adaptive scoring reduced the original smart score based on historical performance.'
    )
  }

  return warnings
}

export function explainPick(pick: PickInput) {
  const verdict = getVerdict(pick)
  const risk = getRisk(pick)
  const reasons = buildReasons(pick)
  const warnings = buildWarnings(pick)

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    pick: {
      team: pick.team,
      opponent: pick.opponent,
      sportKey: pick.sport_key ?? 'unknown',
      sportsbook: pick.sportsbook ?? 'Unknown',
      market: pick.market ?? 'moneyline',
      odds: pick.odds,
      formattedOdds: formatOdds(pick.odds),
    },
    verdict,
    risk,
    recommendationStatus: pick.recommendation_status ?? 'UNKNOWN',
    labels: {
      confidence: pick.confidence_label ?? 'Unknown',
      reliability: pick.reliability_label ?? 'Unknown',
      value: pick.value_label ?? 'Unknown',
    },
    scores: {
      confidence: num(pick.confidence),
      modelProbability: num(pick.model_probability),
      impliedProbability: num(pick.implied_probability),
      edge: num(pick.edge),
      ev: num(pick.ev),
      smartScore: num(pick.smart_score),
      adaptiveScore: num(pick.adaptive_score ?? pick.smart_score),
      kellyPercent: num(pick.kelly_percent),
      recommendedStake: num(pick.recommended_stake),
    },
    reasons,
    warnings,
    summary: `${pick.team} ${formatOdds(
      pick.odds
    )} grades as ${verdict}. The model gives it ${num(
      pick.model_probability
    ).toFixed(2)}% probability versus ${num(
      pick.implied_probability
    ).toFixed(2)}% implied probability, creating ${num(pick.edge).toFixed(
      2
    )}% edge and ${num(pick.ev).toFixed(2)}% EV.`,
  }
}
