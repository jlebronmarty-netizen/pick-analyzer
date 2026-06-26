import { explainPick } from '@/services/analysis-explainer.service'
import { buildHedges } from '@/services/hedge-builder.service'
import { generateSmartParlays } from '@/services/parlay-generator.service'
import { getPlayOfTheDay } from '@/services/play-of-the-day.service'
import { buildPortfolios } from '@/services/portfolio-builder.service'
import { getTopPicks } from '@/services/top-picks.service'

type ReportPick = {
  id: string
  team: string
  opponent: string
  sport_key: string
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

function sortBySmartScore(a: ReportPick, b: ReportPick) {
  return (
    (b.smart_score ?? 0) - (a.smart_score ?? 0) ||
    b.confidence - a.confidence ||
    b.ev - a.ev
  )
}

function getBestUnderdog(picks: ReportPick[]) {
  return [...picks]
    .filter((pick) => pick.odds > 0)
    .sort(sortBySmartScore)[0] ?? null
}

function getBestFavorite(picks: ReportPick[]) {
  return [...picks]
    .filter((pick) => pick.odds < 0)
    .sort(sortBySmartScore)[0] ?? null
}

function getHighestEv(picks: ReportPick[]) {
  return [...picks].sort((a, b) => b.ev - a.ev)[0] ?? null
}

function getHighestConfidence(picks: ReportPick[]) {
  return [...picks].sort((a, b) => b.confidence - a.confidence)[0] ?? null
}

function mapPick(pick: ReportPick | null) {
  if (!pick) return null

  return {
    ...pick,
    explanation: explainPick(pick),
  }
}

export async function getDailyReport(bankroll = 1000) {
  const [topPicks, playOfTheDay, portfolios, parlays, hedges] =
    await Promise.all([
      getTopPicks(),
      getPlayOfTheDay(),
      buildPortfolios(bankroll),
      generateSmartParlays(),
      buildHedges(bankroll),
    ])

  const sourcePicks = [
    ...(topPicks.bestBets as ReportPick[]),
    ...(topPicks.topConfidence as ReportPick[]),
    ...(topPicks.topEv as ReportPick[]),
  ]

  const unique = new Map<string, ReportPick>()

  for (const pick of sourcePicks) {
    const key = `${pick.sport_key}:${pick.team}:${pick.opponent}`
    const existing = unique.get(key)

    if (!existing || (pick.smart_score ?? 0) > (existing.smart_score ?? 0)) {
      unique.set(key, pick)
    }
  }

  const picks = [...unique.values()].sort(sortBySmartScore)

  const bestUnderdog = getBestUnderdog(picks)
  const bestFavorite = getBestFavorite(picks)
  const highestEv = getHighestEv(picks)
  const highestConfidence = getHighestConfidence(picks)

  return {
    success: true,
    bankroll,
    generatedAt: new Date().toISOString(),
    summary: {
      totalQualifiedPicks: picks.length,
      recommendedPicks: topPicks.summary.recommendedPicks,
      bestBets: topPicks.summary.bestBetsCount,
      parlayCount: parlays.count,
      hedgeCount: hedges.count,
    },
    todayCard: {
      playOfTheDay: playOfTheDay.play
        ? {
            ...playOfTheDay.play,
            explanation: explainPick(playOfTheDay.play),
          }
        : null,
      bestUnderdog: mapPick(bestUnderdog),
      bestFavorite: mapPick(bestFavorite),
      highestEv: mapPick(highestEv),
      highestConfidence: mapPick(highestConfidence),
    },
    portfolios: portfolios.portfolios,
    parlays: parlays.parlays,
    hedges: hedges.hedges.slice(0, 5),
    notes: [
      'Use portfolio recommendations as decision support, not guaranteed outcomes.',
      'Prefer lower exposure when multiple picks come from the same sport.',
      'Avoid forcing parlays when correlation warnings appear.',
    ],
  }
}