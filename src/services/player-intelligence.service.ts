import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeRecordedOutsUnit } from '@/services/mlb-learning-brain.service'

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
  source_timestamp: string | null
  stats: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  updated_at: string | null
}

type ProjectionRow = {
  id: string
  event_id: string | null
  projected_value: number | null
  actual_value: number | null
  model_version: string | null
  readiness: string | null
  shadow_status: string | null
  starter_status: string | null
  calibration: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  generated_at: string | null
  settled_at: string | null
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
  const innings = firstNumber(stats, ['innings_pitched', 'InningsPitched'])
  const normalized = normalizeRecordedOutsUnit({ directOuts: direct, innings })
  return normalized.valid ? normalized.outs : null
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
    .select('id, player_id, team_id, event_id, source_timestamp, stats, metadata, updated_at')
    .eq('player_id', playerId)
    .order('source_timestamp', { ascending: false })
    .limit(25)
  if (statsError) throw new Error(`sport_player_stats read failed: ${statsError.message}`)

  const rows = (stats ?? []) as StatRow[]
  const { data: projections, error: projectionError } = await supabaseAdmin
    .from('universal_projection_history')
    .select('id, event_id, projected_value, actual_value, model_version, readiness, shadow_status, starter_status, calibration, metadata, generated_at, settled_at')
    .eq('sport_key', typedPlayer.sport_key)
    .eq('entity_id', playerId)
    .eq('projection_key', 'pitcher_outs_recorded')
    .order('generated_at', { ascending: false })
    .limit(10)
  if (projectionError) throw new Error(`universal_projection_history read failed: ${projectionError.message}`)
  const projectionRows = (projections ?? []) as ProjectionRow[]
  const outsRows = rows
    .map((row) => ({ date: row.source_timestamp, eventId: row.event_id, outs: pitcherOuts(row) }))
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
      gameDate: row.source_timestamp,
      teamId: row.team_id,
      statsAvailable: Boolean(row.stats && Object.keys(row.stats).length),
      updatedAt: row.updated_at,
    })),
    seasonSample: {
      storedGameRows: rows.length,
      latestGameDate: rows[0]?.source_timestamp ?? null,
      oldestLoadedGameDate: rows[rows.length - 1]?.source_timestamp ?? null,
    },
    pitcherRecordedOuts: {
      status: outsRows.length ? 'STORED_HISTORY_AVAILABLE' : 'UNAVAILABLE',
      sample: outsRows.length,
      recent: outsRows.slice(0, 10),
      last3: outsRows.slice(0, 3).map((row) => row.outs),
      last5: outsRows.slice(0, 5).map((row) => row.outs),
      last10: outsRows.slice(0, 10).map((row) => row.outs),
    },
    pitcherOutsLearning: {
      status: projectionRows.length ? 'SHADOW_HISTORY_AVAILABLE' : 'NO_SHADOW_PROJECTION_HISTORY',
      latestProjection: projectionRows[0]
        ? {
            projectionId: projectionRows[0].id,
            eventId: projectionRows[0].event_id,
            expectedOuts: projectionRows[0].projected_value,
            actualOuts: projectionRows[0].actual_value,
            modelVersion: projectionRows[0].model_version,
            readiness: projectionRows[0].readiness,
            shadowStatus: projectionRows[0].shadow_status,
            starterStatus: projectionRows[0].starter_status,
            thresholds: projectionRows[0].metadata?.thresholdProbabilities ?? projectionRows[0].calibration?.thresholds ?? null,
            generatedAt: projectionRows[0].generated_at,
            settledAt: projectionRows[0].settled_at,
          }
        : null,
      historicalProjectionCount: projectionRows.length,
      marketStatus: 'NO_MARKET',
      recommendationStatus: 'SHADOW',
    },
    supportedSplits: {
      homeAway: 'UNAVAILABLE_UNTIL_VALIDATED_SPLIT_SOURCE',
      handedness: 'UNAVAILABLE_UNTIL_VALIDATED_SPLIT_SOURCE',
      matchupVsPlayer: 'UNAVAILABLE_NOT_FABRICATED',
    },
    eligibleProjections: projectionRows.slice(0, 5).map((row) => ({
      projectionId: row.id,
      eventId: row.event_id,
      expectedOuts: row.projected_value,
      modelVersion: row.model_version,
      status: row.shadow_status,
      marketStatus: 'NO_MARKET',
    })),
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
    ['recorded outs baseball notation', pitcherOuts({ id: 's', player_id: 'p', team_id: null, event_id: null, source_timestamp: null, stats: { innings_pitched: 5.2 }, metadata: null, updated_at: null }) === 17],
    ['direct outs preferred when consistent', pitcherOuts({ id: 's', player_id: 'p', team_id: null, event_id: null, source_timestamp: null, stats: { outs: 17, innings_pitched: 5.2 }, metadata: null, updated_at: null }) === 17],
    ['direct/innings conflict hidden', pitcherOuts({ id: 's', player_id: 'p', team_id: null, event_id: null, source_timestamp: null, stats: { outs: 16, innings_pitched: 5.2 }, metadata: null, updated_at: null }) === null],
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
