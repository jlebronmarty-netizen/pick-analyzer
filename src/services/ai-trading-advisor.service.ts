type AdvisorInput = {
  analytics?: any
  clv?: any
  calibration?: any
  topPicks?: any
  playOfTheDay?: any
  dailyReport?: any
  portfolio?: any
  bankrollManager?: any
  patterns?: any
}

type AdvisorRecommendation = {
  severity: 'high' | 'medium' | 'low'
  type: 'opportunity' | 'risk' | 'bankroll' | 'model' | 'market'
  title: string
  message: string
}

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function getOpportunityLevel(score: number) {
  if (score >= 80) return 'HIGH'
  if (score >= 60) return 'MEDIUM'
  if (score >= 40) return 'LOW'
  return 'WAIT'
}

function getMarketBias({
  roi,
  winRate,
  clvAverage,
  bestBets,
}: {
  roi: number
  winRate: number
  clvAverage: number
  bestBets: number
}) {
  if (roi > 5 && winRate >= 55 && clvAverage >= 0 && bestBets >= 2) {
    return 'AGGRESSIVE'
  }

  if (roi >= 0 && winRate >= 50 && bestBets >= 1) {
    return 'PLAYABLE'
  }

  if (bestBets >= 1) {
    return 'SELECTIVE'
  }

  return 'DEFENSIVE'
}

function getBestPick(input: AdvisorInput) {
  return (
    input.playOfTheDay?.play ??
    input.dailyReport?.todayCard?.playOfTheDay ??
    input.topPicks?.bestBets?.[0] ??
    input.topPicks?.topConfidence?.[0] ??
    input.topPicks?.topEv?.[0] ??
    null
  )
}

function hasUsefulPattern(pattern?: any) {
  return pattern && safeNumber(pattern.sample) >= 3
}

export function getAITradingAdvisor(input: AdvisorInput) {
  const roi = safeNumber(input.analytics?.overall?.roi)
  const winRate = safeNumber(input.analytics?.overall?.winRate)
  const profit = safeNumber(input.analytics?.overall?.profit)
  const pending = safeNumber(input.analytics?.overall?.pending)

  const clvAverage = safeNumber(input.clv?.summary?.averageClv)
  const calibrationScore = safeNumber(
    input.calibration?.overall?.calibrationScore
  )

  const modelStatus =
    input.calibration?.overall?.modelStatus ?? 'INSUFFICIENT_DATA'

  const bestBets = safeNumber(input.topPicks?.summary?.bestBetsCount)
  const recommendedPicks = safeNumber(
    input.topPicks?.summary?.recommendedPicks
  )

  const exposurePercent = safeNumber(
    input.bankrollManager?.stakePlan?.exposurePercent ??
      input.dailyReport?.summary?.bankrollExposurePercent
  )

  const patterns = input.patterns
  const bestSport = patterns?.bestSport
  const worstSport = patterns?.worstSport
  const bestSportsbook = patterns?.bestSportsbook
  const bestOddsRange = patterns?.bestOddsRange
  const bestConfidenceRange = patterns?.bestConfidenceRange
  const bestEVRange = patterns?.bestEVRange

  const bestPick = getBestPick(input)

  const patternBoost =
    (hasUsefulPattern(bestSport) ? Math.max(safeNumber(bestSport.roi), 0) * 0.35 : 0) +
    (hasUsefulPattern(bestOddsRange) ? Math.max(safeNumber(bestOddsRange.roi), 0) * 0.25 : 0) +
    (hasUsefulPattern(bestConfidenceRange) ? Math.max(safeNumber(bestConfidenceRange.roi), 0) * 0.2 : 0)

  const opportunityScore = Math.min(
    100,
    Math.max(
      0,
      bestBets * 12 +
        recommendedPicks * 4 +
        Math.max(roi, 0) * 1.5 +
        Math.max(clvAverage, 0) * 4 +
        Math.max(calibrationScore, 0) * 0.35 +
        patternBoost
    )
  )

  const opportunityLevel = getOpportunityLevel(opportunityScore)

  const marketBias = getMarketBias({
    roi,
    winRate,
    clvAverage,
    bestBets,
  })

  const recommendations: AdvisorRecommendation[] = []

  if (bestPick) {
    recommendations.push({
      severity: 'high',
      type: 'opportunity',
      title: 'Best Opportunity',
      message: `${bestPick.team} ML is the top board position right now with ${safeNumber(
        bestPick.confidence
      ).toFixed(2)}% confidence, ${safeNumber(bestPick.edge).toFixed(
        2
      )}% edge and ${safeNumber(bestPick.ev).toFixed(2)}% EV.`,
    })
  } else {
    recommendations.push({
      severity: 'medium',
      type: 'market',
      title: 'No Premium Play',
      message:
        'The board does not currently show a premium play. Preserve bankroll and wait for better market conditions.',
    })
  }

  if (hasUsefulPattern(bestSport)) {
    recommendations.push({
      severity: safeNumber(bestSport.roi) >= 0 ? 'low' : 'medium',
      type: 'market',
      title: 'Best Historical Sport',
      message: `${bestSport.key} is currently the strongest historical sport segment with ${bestSport.sample} settled picks, ${safeNumber(
        bestSport.roi
      ).toFixed(2)}% ROI and ${safeNumber(bestSport.winRate).toFixed(
        2
      )}% win rate.`,
    })
  }

  if (hasUsefulPattern(worstSport) && safeNumber(worstSport.roi) < 0) {
    recommendations.push({
      severity: 'medium',
      type: 'risk',
      title: 'Weak Historical Sport',
      message: `${worstSport.key} has been the weakest historical sport segment with ${safeNumber(
        worstSport.roi
      ).toFixed(2)}% ROI. Reduce exposure there until performance improves.`,
    })
  }

  if (hasUsefulPattern(bestSportsbook)) {
    recommendations.push({
      severity: 'low',
      type: 'market',
      title: 'Best Sportsbook Segment',
      message: `${bestSportsbook.key} has produced the best historical return with ${safeNumber(
        bestSportsbook.roi
      ).toFixed(2)}% ROI across ${bestSportsbook.sample} settled picks.`,
    })
  }

  if (hasUsefulPattern(bestOddsRange)) {
    recommendations.push({
      severity: 'low',
      type: 'market',
      title: 'Best Odds Range',
      message: `The strongest historical odds bucket is ${bestOddsRange.key}, producing ${safeNumber(
        bestOddsRange.roi
      ).toFixed(2)}% ROI and ${safeNumber(bestOddsRange.winRate).toFixed(
        2
      )}% win rate.`,
    })
  }

  if (hasUsefulPattern(bestConfidenceRange)) {
    recommendations.push({
      severity: 'low',
      type: 'model',
      title: 'Best Confidence Range',
      message: `The best-performing confidence bucket has been ${bestConfidenceRange.key}% with ${safeNumber(
        bestConfidenceRange.roi
      ).toFixed(2)}% ROI across ${bestConfidenceRange.sample} settled picks.`,
    })
  }

  if (hasUsefulPattern(bestEVRange)) {
    recommendations.push({
      severity: 'low',
      type: 'model',
      title: 'Best EV Range',
      message: `The most profitable EV bucket has been ${bestEVRange.key}% with ${safeNumber(
        bestEVRange.roi
      ).toFixed(2)}% ROI.`,
    })
  }

  if (modelStatus === 'NEEDS_RECALIBRATION' || calibrationScore < 50) {
    recommendations.push({
      severity: 'high',
      type: 'model',
      title: 'Reduce Stake Size',
      message:
        'Model calibration is still weak. Keep standard or reduced stake sizing until more settled data improves reliability.',
    })
  }

  if (clvAverage < 0) {
    recommendations.push({
      severity: 'medium',
      type: 'market',
      title: 'Negative CLV Warning',
      message:
        'The model is not consistently beating closing lines yet. Avoid chasing stale prices and verify odds before betting.',
    })
  }

  if (exposurePercent >= 6) {
    recommendations.push({
      severity: 'high',
      type: 'bankroll',
      title: 'Exposure Limit Warning',
      message:
        'Daily bankroll exposure is near the limit. Avoid adding extra picks unless the edge is clearly superior.',
    })
  } else if (exposurePercent <= 3 && bestBets >= 2) {
    recommendations.push({
      severity: 'low',
      type: 'bankroll',
      title: 'Exposure Available',
      message:
        'Current exposure is controlled. You may selectively allocate to the highest-rated singles.',
    })
  }

  if (bestBets === 0) {
    recommendations.push({
      severity: 'medium',
      type: 'risk',
      title: 'Avoid Parlays',
      message:
        'No strong best-bet cluster is available. Avoid forcing parlays from a weak board.',
    })
  } else if (bestBets <= 2) {
    recommendations.push({
      severity: 'medium',
      type: 'risk',
      title: 'Singles Preferred',
      message:
        'The board has limited qualified volume. Prioritize singles over multi-leg parlays.',
    })
  } else {
    recommendations.push({
      severity: 'low',
      type: 'opportunity',
      title: 'Parlays Allowed With Discipline',
      message:
        'There are enough qualified picks to consider a small correlated-risk controlled parlay.',
    })
  }

  const warnings = recommendations.filter(
    (item) => item.severity === 'high' || item.type === 'risk'
  )

  const patternOutlook = hasUsefulPattern(bestSport)
    ? ` Historical performance currently favors ${bestSport.key}, with ${safeNumber(
        bestSport.roi
      ).toFixed(2)}% ROI.`
    : ''

  const outlook =
    marketBias === 'AGGRESSIVE'
      ? `The board is strong, but exposure discipline still matters. Prioritize A/A+ singles and avoid unnecessary parlay risk.${patternOutlook}`
      : marketBias === 'PLAYABLE'
        ? `The board is playable. Focus on the strongest model edges and avoid expanding beyond recommended stake sizing.${patternOutlook}`
        : marketBias === 'SELECTIVE'
          ? `The board is selective. There may be one or two playable spots, but this is not a day to force volume.${patternOutlook}`
          : `The board is defensive. Preserve bankroll, wait for better odds, and avoid low-confidence plays.${patternOutlook}`

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    marketBias,
    opportunityLevel,
    opportunityScore: Number(opportunityScore.toFixed(2)),
    bestPick,
    patterns: {
      bestSport: bestSport ?? null,
      worstSport: worstSport ?? null,
      bestSportsbook: bestSportsbook ?? null,
      bestOddsRange: bestOddsRange ?? null,
      bestConfidenceRange: bestConfidenceRange ?? null,
      bestEVRange: bestEVRange ?? null,
    },
    summary: {
      roi,
      winRate,
      profit,
      pending,
      clvAverage,
      calibrationScore,
      modelStatus,
      bestBets,
      recommendedPicks,
      exposurePercent,
    },
    outlook,
    recommendations,
    warnings,
  }
}