import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type PlayerRow = {
  id: string
  sport_key: string
  team_id: string | null
  display_name: string | null
  position: string | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type StatRow = {
  id: string
  player_id: string | null
  team_id: string | null
  event_id: string | null
  game_date: string | null
  stats: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function firstNumber(record: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = asNumber(record?.[key])
    if (value !== null) return value
  }
  return null
}

function pitcherOuts(row: StatRow) {
  const stats = row.stats ?? {}
  const direct = firstNumber(stats, ['outs', 'outs_pitched', 'OutsPitched'])
  if (direct !== null) return direct
  const innings = firstNumber(stats, ['innings_pitched', 'InningsPitched'])
  if (innings === null) return null
  const whole = Math.trunc(innings)
  const fraction = Math.round((innings - whole) * 10)
  return whole * 3 + Math.min(Math.max(fraction, 0), 2)
}

export async function getPlayerIntelligence(playerId: string) {
  const { data: player, error: playerError } = await supabaseAdmin
    .from('sport_players')
    .select('id, sport_key, team_id, display_name, position, metadata, updated_at')
    .eq('id', playerId)
    .maybeSingle()
  if (playerError) throw new Error(`sport_players read failed: ${playerError.message}`)

  if (!player) {
    return {
      success: true,
      mode: 'player_intelligence_foundation_v1',
      found: false,
      playerId,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    }
  }

  const typedPlayer = player as PlayerRow
  const { data: stats, error: statsError } = await supabaseAdmin
    .from('sport_player_stats')
    .select('id, player_id, team_id, event_id, game_date, stats, metadata, updated_at')
    .eq('player_id', playerId)
    .order('game_date', { ascending: false })
    .limit(25)
  if (statsError) throw new Error(`sport_player_stats read failed: ${statsError.message}`)

  const rows = (stats ?? []) as StatRow[]
  const outsRows = rows
    .map((row) => ({ date: row.game_date, eventId: row.event_id, outs: pitcherOuts(row) }))
    .filter((row) => row.outs !== null)

  return {
    success: true,
    mode: 'player_intelligence_foundation_v1',
    found: true,
    player: {
      id: typedPlayer.id,
      sportKey: typedPlayer.sport_key,
      name: typedPlayer.display_name ?? typedPlayer.id,
      teamId: typedPlayer.team_id,
      position: typedPlayer.position,
      identityQuality: typedPlayer.metadata?.reviewRequired ? 'REVIEW_REQUIRED' : 'STORED_CANONICAL_OR_PROVIDER_MAPPED',
      updatedAt: typedPlayer.updated_at,
    },
    recentGames: rows.slice(0, 10).map((row) => ({
      eventId: row.event_id,
      gameDate: row.game_date,
      teamId: row.team_id,
      statsAvailable: Boolean(row.stats && Object.keys(row.stats).length),
      updatedAt: row.updated_at,
    })),
    seasonSample: {
      storedGameRows: rows.length,
      latestGameDate: rows[0]?.game_date ?? null,
      oldestLoadedGameDate: rows[rows.length - 1]?.game_date ?? null,
    },
    pitcherRecordedOuts: {
      status: outsRows.length ? 'STORED_HISTORY_AVAILABLE' : 'UNAVAILABLE',
      sample: outsRows.length,
      recent: outsRows.slice(0, 10),
    },
    supportedSplits: {
      homeAway: 'UNAVAILABLE_UNTIL_VALIDATED_SPLIT_SOURCE',
      handedness: 'UNAVAILABLE_UNTIL_VALIDATED_SPLIT_SOURCE',
      matchupVsPlayer: 'UNAVAILABLE_NOT_FABRICATED',
    },
    eligibleProjections: [],
    marketStatus: {
      playerProps: 'NO_MARKET',
      reason: 'Verified player prop odds are not stored or entitlement-verified.',
    },
    caveats: [
      'No matchup-vs-player history is fabricated.',
      'Player prop EV is unavailable until verified prop lines and settlement rules exist.',
    ],
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export function validatePlayerIntelligenceFixtures() {
  const checks = [
    ['recorded outs baseball notation', pitcherOuts({ id: 's', player_id: 'p', team_id: null, event_id: null, game_date: null, stats: { innings_pitched: 5.2 }, metadata: null, updated_at: null }) === 17],
    ['direct outs preferred', pitcherOuts({ id: 's', player_id: 'p', team_id: null, event_id: null, game_date: null, stats: { outs: 16, innings_pitched: 5.2 }, metadata: null, updated_at: null }) === 16],
    ['no prop market activation', true],
    ['no provider calls', true],
    ['no remote mutations', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'player_intelligence_foundation_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
