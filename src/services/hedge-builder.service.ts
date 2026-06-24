import { getTopPicks } from '@/services/top-picks.service'

type HedgePick = {
  id: string
  team: string
  opponent: string
  sport_key: string
  odds: number
  confidence: number
  ev: number
  edge: number
  recommended_stake?: number
}

type HedgeRecommendation = {
  primary: HedgePick
  hedge: {
    team: string
    stake: number
    protectionPercent: number
  }
}

function calculateProtectionPercent(
  confidence: number
) {
  if (confidence >= 90) return 25
  if (confidence >= 85) return 30
  if (confidence >= 80) return 35

  return 40
}

export async function buildHedges() {
  const topPicks = await getTopPicks()

  const picks =
    topPicks.bestBets as HedgePick[]

  const hedges: HedgeRecommendation[] =
    picks.slice(0, 10).map((pick) => {
      const protection =
        calculateProtectionPercent(
          pick.confidence
        )

      const primaryStake =
        pick.recommended_stake ?? 50

      const hedgeStake = Number(
        (
          primaryStake *
          (protection / 100)
        ).toFixed(2)
      )

      return {
        primary: pick,

        hedge: {
          team: pick.opponent,
          stake: hedgeStake,
          protectionPercent:
            protection,
        },
      }
    })

  return {
    success: true,
    generatedAt:
      new Date().toISOString(),
    count: hedges.length,
    hedges,
  }
}