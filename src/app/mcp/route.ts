import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'

import { findMlbPlayers, getMlbGamesForDate } from '@/services/mlb-mcp-readonly.service'
import {
  getMlbStatcastBatterProfile,
  getMlbStatcastCoverage,
  getMlbStatcastPitcherProfile,
  getMlbStatcastTeamProfile,
  MLB_STATCAST_METRIC_DEFINITIONS,
} from '@/services/mlb-statcast-query.service'
import { getMlbStatcastMatchup } from '@/services/mlb-statcast-matchup.service'
import { getMlbPitcherKShadowProjection } from '@/services/mlb-pitcher-k-shadow.service'
import { getMlbPitcherBbShadowProjection } from '@/services/mlb-pitcher-bb-shadow.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'
export const maxDuration = 60

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  }
}

const seasonSchema = z.number().int().min(2008).max(2100).default(2026)

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'mlb_find_player',
      {
        title: 'Find MLB Player',
        description: 'Find MLB players by name and return MLBAM person IDs used by the Statcast tools. Read-only.',
        inputSchema: z.object({
          query: z.string().trim().min(1).max(100),
          limit: z.number().int().min(1).max(20).default(10),
        }),
        annotations: READ_ONLY,
      },
      async ({ query, limit }) => jsonResult({ players: await findMlbPlayers({ query, limit }) }),
    )

    server.registerTool(
      'mlb_games_for_date',
      {
        title: 'MLB Games For Date',
        description: 'List native MLB games for a YYYY-MM-DD date with gamePk, teams, status, schedule and any available pregame pitcher candidates. Read-only.',
        inputSchema: z.object({
          date: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),
        }),
        annotations: READ_ONLY,
      },
      async ({ date }) => jsonResult({ date, games: await getMlbGamesForDate({ date }) }),
    )

    server.registerTool(
      'mlb_statcast_coverage',
      {
        title: 'MLB Statcast Coverage',
        description: 'Return certified Statcast database coverage, including pitch and game counts by season. Read-only.',
        inputSchema: z.object({
          season: seasonSchema.optional(),
        }),
        annotations: READ_ONLY,
      },
      async ({ season }) => jsonResult({
        coverage: await getMlbStatcastCoverage(season),
        metricDefinitions: MLB_STATCAST_METRIC_DEFINITIONS,
      }),
    )

    server.registerTool(
      'mlb_pitcher_profile',
      {
        title: 'MLB Pitcher Statcast Profile',
        description: 'Return a pitcher Statcast season profile, pitch mix, recent game logs and rolling windows. pitcherId is MLBAM. Read-only.',
        inputSchema: z.object({
          pitcherId: z.number().int().positive(),
          season: seasonSchema,
          recentGames: z.number().int().min(3).max(30).default(20),
        }),
        annotations: READ_ONLY,
      },
      async ({ pitcherId, season, recentGames }) => jsonResult({
        profile: await getMlbStatcastPitcherProfile({ pitcherId, season, recentGames }),
        metricDefinitions: MLB_STATCAST_METRIC_DEFINITIONS,
      }),
    )

    server.registerTool(
      'mlb_batter_profile',
      {
        title: 'MLB Batter Statcast Profile',
        description: 'Return a batter Statcast season profile and recent game logs. batterId is MLBAM. Read-only.',
        inputSchema: z.object({
          batterId: z.number().int().positive(),
          season: seasonSchema,
          recentGames: z.number().int().min(3).max(30).default(20),
        }),
        annotations: READ_ONLY,
      },
      async ({ batterId, season, recentGames }) => jsonResult({
        profile: await getMlbStatcastBatterProfile({ batterId, season, recentGames }),
        metricDefinitions: MLB_STATCAST_METRIC_DEFINITIONS,
      }),
    )

    server.registerTool(
      'mlb_team_profile',
      {
        title: 'MLB Team Statcast Profile',
        description: 'Return team batting and pitching Statcast season summaries. team should be the canonical MLB abbreviation such as LAD, NYY, BOS, ARI or CHW. Read-only.',
        inputSchema: z.object({
          team: z.string().trim().min(2).max(4),
          season: seasonSchema,
        }),
        annotations: READ_ONLY,
      },
      async ({ team, season }) => jsonResult({
        profile: await getMlbStatcastTeamProfile({ team, season }),
        metricDefinitions: MLB_STATCAST_METRIC_DEFINITIONS,
      }),
    )

    server.registerTool(
      'mlb_matchup',
      {
        title: 'MLB Pitcher vs Team or Lineup Matchup',
        description: 'Return descriptive Statcast matchup evidence for a pitcher versus a team and optional batter MLBAM IDs. Includes arsenal, hand splits, pitch-type pressure and head-to-head. It is descriptive evidence, not a betting recommendation. Read-only.',
        inputSchema: z.object({
          pitcherId: z.number().int().positive(),
          opponentTeam: z.string().trim().min(2).max(4),
          season: seasonSchema,
          batterIds: z.array(z.number().int().positive()).max(13).default([]),
        }),
        annotations: READ_ONLY,
      },
      async ({ pitcherId, opponentTeam, season, batterIds }) => jsonResult({
        matchup: await getMlbStatcastMatchup({ pitcherId, opponentTeam, season, batterIds }),
        caveat: 'Descriptive Statcast evidence only. No calibrated betting probability or recommendation is produced by this tool.',
      }),
    )

    server.registerTool(
      'mlb_project_pitcher_strikeouts',
      {
        title: 'MLB Pitcher Strikeout Shadow Projection',
        description: 'Run the certified MLB_PITCHER_K_V1 research-only shadow model from frozen pregame features. Calibrated probabilities are only returned for certified lines 2.5, 3.5, 4.5 and 5.5. No sportsbook price, EV or pick is generated. Read-only.',
        inputSchema: z.object({
          gamePk: z.number().int().positive(),
          pitcherId: z.number().int().positive(),
          opponentTeam: z.string().trim().min(2).max(4),
          line: z.number().positive().optional(),
        }),
        annotations: READ_ONLY,
      },
      async ({ gamePk, pitcherId, opponentTeam, line }) => jsonResult({
        projection: await getMlbPitcherKShadowProjection({ targetGamePk: gamePk, pitcherId, opponentTeam, line }),
        caveat: 'Research-only shadow model. recommendation=null, EV=null, providerCalls=0 and Official Pick writes=0 by contract.',
      }),
    )

    server.registerTool(
      'mlb_project_pitcher_walks',
      {
        title: 'MLB Pitcher Walk Shadow Projection',
        description: 'Run the certified MLB_PITCHER_BB_V1 research-only shadow model from frozen pregame features. BB includes intentional walks and excludes HBP. Calibrated probabilities are only returned for lines 0.5, 1.5, 2.5 and 3.5. No sportsbook price, EV or pick is generated. Read-only.',
        inputSchema: z.object({
          gamePk: z.number().int().positive(),
          pitcherId: z.number().int().positive(),
          line: z.number().positive().optional(),
        }),
        annotations: READ_ONLY,
      },
      async ({ gamePk, pitcherId, line }) => jsonResult({
        projection: await getMlbPitcherBbShadowProjection({ targetGamePk: gamePk, pitcherId, line }),
        caveat: 'Research-only shadow model. recommendation=null, EV=null, providerCalls=0 and Official Pick writes=0 by contract.',
      }),
    )
  },
  {
    serverInfo: { name: 'pick-analyzer-mlb-readonly', version: '1.0.0' },
    instructions: 'Read-only MLB analytics server. Use discovery tools to resolve gamePk and MLBAM IDs before profile, matchup or shadow projection calls. Never treat shadow projections as betting recommendations.',
    verboseLogs: false,
    maxSubscriptions: 0,
  },
)

export { handler as GET, handler as POST }
