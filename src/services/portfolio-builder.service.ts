import { getTopPicks } from '@/services/top-picks.service'
import { optimizePortfolio } from '@/services/portfolio-optimizer.service'

type PortfolioPick = {
  id: string
  team: string
  opponent: string
  sport_key: string
  odds: number
  confidence: number
  ev: number
  edge: number
  risk_grade?: string
  kelly_percent?: number
  recommended_stake?: number
}

type Portfolio = {
  name: string
  expectedRoi: number
  averageConfidence: number
  picks: PortfolioPick[]
}

function calculateAverageConfidence(
  picks: PortfolioPick[]
) {
  if (!picks.length) {
    return 0
  }

  return Number(
    (
      picks.reduce(
        (sum, pick) => sum + pick.confidence,
        0
      ) / picks.length
    ).toFixed(2)
  )
}

function calculateExpectedRoi(
  picks: PortfolioPick[]
) {
  if (!picks.length) {
    return 0
  }

  return Number(
    (
      picks.reduce(
        (sum, pick) => sum + pick.ev,
        0
      ) / picks.length
    ).toFixed(2)
  )
}

function buildPortfolio(
  name: string,
  grades: string[],
  maxPicks: number,
  picks: PortfolioPick[]
): Portfolio {
  const selected = optimizePortfolio(
    picks
      .filter(
        (pick) =>
          pick.risk_grade &&
          grades.includes(
            pick.risk_grade
          )
      )
      .sort(
        (a, b) =>
          b.confidence -
          a.confidence
      )
      .slice(0, maxPicks)
  )

  return {
    name,
    expectedRoi:
      calculateExpectedRoi(selected),
    averageConfidence:
      calculateAverageConfidence(
        selected
      ),
    picks: selected,
  }
}

export async function buildPortfolios() {
  const topPicks =
    await getTopPicks()

  const sourcePicks =
    topPicks.bestBets as PortfolioPick[]

  const conservative =
    buildPortfolio(
      'Conservative',
      ['A+', 'A'],
      3,
      sourcePicks
    )

  const balanced =
    buildPortfolio(
      'Balanced',
      ['A+', 'A', 'B'],
      5,
      sourcePicks
    )

  const aggressive =
    buildPortfolio(
      'Aggressive',
      ['A+', 'A', 'B', 'C'],
      8,
      sourcePicks
    )

  return {
    success: true,
    generatedAt:
      new Date().toISOString(),

    portfolios: {
      conservative,
      balanced,
      aggressive,
    },
  }
}