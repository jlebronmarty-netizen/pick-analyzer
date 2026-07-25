import { NextRequest } from 'next/server'
import { apiOk, errorMessage, requestId } from '@/lib/api-contract'
import { getMlbCurrentLineupContext } from '@/services/mlb-current-lineup-context.service'
import { getMlbPlayerProjectionEngine } from '@/services/mlb-player-projection-engine.service'

export async function GET(request: NextRequest) {
  const id = requestId(request)
  const date = request.nextUrl.searchParams.get('date')
  try {
    const [lineups, projections] = await Promise.all([
      getMlbCurrentLineupContext({ date }),
      getMlbPlayerProjectionEngine({ date, limit: 200 }),
    ])
    const projectionCounts = projections.projections.reduce<Record<string, number>>((acc, projection) => {
      if (!projection.eventId) return acc
      acc[projection.eventId] = (acc[projection.eventId] ?? 0) + 1
      return acc
    }, {})
    return apiOk({
      success: true,
      mode: 'mlb_game_intelligence_index_v1',
      generatedAt: new Date().toISOString(),
      selectedDate: lineups.selectedDate,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      summary: {
        ...lineups.summary,
        playerProjectionsGenerated: projections.summary.projectionsGenerated,
        pitcherProjections: projections.summary.pitcherProjections,
        batterProjections: projections.summary.batterProjections,
        blockedProjections: projections.summary.blockedProjections,
      },
      games: lineups.games.map((game) => ({
        ...game,
        playerProjections: projectionCounts[game.eventId] ?? 0,
        playerIntelligenceAvailable: (projectionCounts[game.eventId] ?? 0) > 0,
      })),
      blockers: Array.from(new Set([...lineups.blockers, ...Object.keys(projections.currentSlate.blockerSummary)])),
    }, id)
  } catch (error) {
    const message = errorMessage(error, 'Unknown MLB game intelligence index error')
    return apiOk({
      success: true,
      mode: 'mlb_game_intelligence_index_v1',
      status: 'DEGRADED_TYPED_EMPTY',
      generatedAt: new Date().toISOString(),
      selectedDate: date,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      summary: {
        games: 0,
        confirmedStarters: 0,
        probableStarters: 0,
        expectedStarters: 0,
        confirmedLineups: 0,
        expectedLineups: 0,
        eligiblePitchers: 0,
        eligibleBatters: 0,
        playerProjectionsGenerated: 0,
        pitcherProjections: 0,
        batterProjections: 0,
        blockedProjections: 0,
      },
      games: [],
      blockers: ['GAME_INTELLIGENCE_STORED_CONTEXT_UNAVAILABLE'],
      diagnostics: {
        error: message,
        fallback: 'typed_empty_no_provider_calls_no_remote_mutations',
      },
    }, id)
  }
}
