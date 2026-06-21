import { TeamStats } from '@/types/database'
import { calculateTeamRating } from '@/utils/team-rating'

export function getRatingFromTeamStats(
  team: TeamStats,
  isHomeTeam: boolean
) {
  return calculateTeamRating({
    winPercentage: team.win_percentage ?? 0.5,
    last10Wins: team.last_10_wins,
    last10Losses: team.last_10_losses,
    isHomeTeam,
    streak: team.streak,
  })
}