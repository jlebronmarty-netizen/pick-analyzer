import { getEnabledSports } from '@/config/sports.config'
import { syncRecentResults } from '@/services/results-sync.service'
import { recalculateTeamStatsFromResults } from '@/services/team-stats-calculator.service'
import { recalculateHeadToHead } from '@/services/team-matchups-calculator.service'
import { settlePredictionHistory } from '@/services/prediction-history.service'

export async function runDailySportsPipeline() {
  const sports = getEnabledSports()
  const results = []

  for (const sport of sports) {
    try {
      const sync = await syncRecentResults(sport.key, 3)
      const stats = await recalculateTeamStatsFromResults(sport.key)
      const h2h = await recalculateHeadToHead(sport.key)
      const settlement = await settlePredictionHistory(sport.key)

      results.push({
        success: true,
        sportKey: sport.key,
        sync,
        stats,
        h2h,
        settlement,
      })
    } catch (error) {
      results.push({
        success: false,
        sportKey: sport.key,
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected pipeline error',
      })
    }
  }

  return {
    success: true,
    results,
  }
}