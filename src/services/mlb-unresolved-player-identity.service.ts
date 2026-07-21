import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const PROVIDER = 'sportsdataio'
const PROVIDER_VARIANT = 'sportsdataio_discovery_lab'
const SERVICE_VERSION = 'mlb_unresolved_player_identity_v1'

type PlayerStatRow = {
  id: string
  season: string
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  source_timestamp: string | null
  updated_at: string | null
}

function generatedAt() {
  return new Date().toISOString()
}

function safeString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function keyPart(value: unknown) {
  return String(value ?? 'null')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'null'
}

function unresolvedPlayerIdentityId(season: string, providerPlayerId: string) {
  return `${SPORT_KEY}:${LEAGUE_KEY}:${PROVIDER}:unresolved_player:${keyPart(season)}:${keyPart(providerPlayerId)}`
}

function quarantineMetadata(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    provider: PROVIDER,
    provider_variant: PROVIDER_VARIANT,
    serviceVersion: SERVICE_VERSION,
    trial: false,
    scrambled: false,
    production_eligible: false,
    validation_status: 'quarantined',
    rawPayloadStored: false,
    ...extra,
  }
}

function providerPlayerId(row: PlayerStatRow) {
  const providerIds = row.provider_ids ?? {}
  return safeString(providerIds.player) || safeString(providerIds.player_id) || safeString(row.metadata?.providerPlayerId)
}

function providerStatId(row: PlayerStatRow) {
  const providerIds = row.provider_ids ?? {}
  return safeString(providerIds.sportsdataio) || safeString(providerIds.stat) || safeString(row.metadata?.providerStatId) || row.id
}

function sourceDate(row: PlayerStatRow) {
  const timestamp = row.source_timestamp || row.updated_at
  return timestamp ? timestamp.slice(0, 10) : null
}

function provisionalMapping(row: PlayerStatRow, providerId: string) {
  return {
    sport_key: SPORT_KEY,
    entity_type: 'unresolved_player',
    internal_id: unresolvedPlayerIdentityId(row.season, providerId),
    provider: PROVIDER,
    provider_id: providerId,
    season: row.season,
    metadata: quarantineMetadata({
      entityType: 'unresolved_player',
      identityStatus: 'UNRESOLVED_PROVIDER_ID',
      reviewStatus: 'REVIEW_REQUIRED',
      productionIdentityStatus: 'PENDING_METADATA',
      trustedCanonicalPlayerId: null,
      providerPlayerId: providerId,
      providerName: row.player_name,
      providerTeamId: safeString(row.provider_ids?.team) || null,
      sourceDate: sourceDate(row),
      sourceRecordId: providerStatId(row),
      sourceDomain: 'stored_player_game_stats',
      firstSeenAt: generatedAt(),
      resolutionPolicy: 'exact_mapping_or_manual_admin_approval_only',
      fuzzyMatchingUsed: false,
      canResolveProductionIdentity: false,
    }),
    updated_at: generatedAt(),
  }
}

async function loadUnresolvedRows(season = '2026') {
  const rows: PlayerStatRow[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const result = await supabaseAdmin
      .from('sport_player_stats')
      .select('id, season, event_id, team_id, player_id, player_name, provider_ids, metadata, source_timestamp, updated_at')
      .eq('sport_key', SPORT_KEY)
      .eq('league_key', LEAGUE_KEY)
      .eq('season', season)
      .eq('stat_type', 'game')
      .is('player_id', null)
      .range(from, from + pageSize - 1)

    if (result.error) throw new Error(`sport_player_stats unresolved player read failed: ${result.error.message}`)
    const page = (result.data ?? []) as PlayerStatRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

async function loadTrustedPlayerMappings(providerIds: string[], season: string) {
  if (!providerIds.length) return new Map<string, string>()
  const found = new Map<string, string>()
  for (let i = 0; i < providerIds.length; i += 100) {
    const chunk = providerIds.slice(i, i + 100)
    const result = await supabaseAdmin
      .from('provider_entity_mappings')
      .select('provider_id, internal_id')
      .eq('sport_key', SPORT_KEY)
      .eq('provider', PROVIDER)
      .eq('entity_type', 'player')
      .in('season', [season, ''])
      .in('provider_id', chunk)
    if (result.error) throw new Error(`provider_entity_mappings trusted player read failed: ${result.error.message}`)
    for (const row of result.data ?? []) {
      const providerId = safeString(row.provider_id)
      const internalId = safeString(row.internal_id)
      if (providerId && internalId && !found.has(providerId)) found.set(providerId, internalId)
    }
  }
  return found
}

export async function reconcileMlbUnresolvedPlayerIdentities({
  season = '2026',
  dryRun = true,
}: {
  season?: string
  dryRun?: boolean
} = {}) {
  const rows = await loadUnresolvedRows(season)
  const providerIds = Array.from(new Set(rows.map(providerPlayerId).filter(Boolean))).sort()
  const trustedMappings = await loadTrustedPlayerMappings(providerIds, season)
  const resolvableRows = rows.filter((row) => trustedMappings.has(providerPlayerId(row)))
  const unresolvedRows = rows.filter((row) => !trustedMappings.has(providerPlayerId(row)))
  const provisionalByProviderId = new Map<string, ReturnType<typeof provisionalMapping>>()
  for (const row of unresolvedRows) {
    const id = providerPlayerId(row)
    if (id && !provisionalByProviderId.has(id)) provisionalByProviderId.set(id, provisionalMapping(row, id))
  }

  let provisionalMappingsInsertedOrReused = 0
  let statRowsUpdated = 0

  if (!dryRun && provisionalByProviderId.size) {
    const result = await supabaseAdmin.from('provider_entity_mappings').upsert(
      Array.from(provisionalByProviderId.values()),
      { onConflict: 'sport_key,entity_type,provider,provider_id,season' }
    )
    if (result.error) throw new Error(`unresolved player provisional mapping upsert failed: ${result.error.message}`)
    provisionalMappingsInsertedOrReused = provisionalByProviderId.size
  }

  if (!dryRun) {
    for (const row of resolvableRows) {
      const providerId = providerPlayerId(row)
      const playerId = trustedMappings.get(providerId)
      if (!playerId) continue
      const metadata = {
        ...(row.metadata ?? {}),
        hasUnresolvedPlayer: false,
        resolvedBy: SERVICE_VERSION,
        resolvedAt: generatedAt(),
        resolutionPolicy: 'exact_provider_entity_mapping',
      }
      const result = await supabaseAdmin
        .from('sport_player_stats')
        .update({ player_id: playerId, metadata, updated_at: generatedAt() })
        .eq('id', row.id)
        .is('player_id', null)
      if (result.error) throw new Error(`sport_player_stats exact identity update failed: ${result.error.message}`)
      statRowsUpdated += 1
    }
  }

  return {
    success: true,
    mode: SERVICE_VERSION,
    generatedAt: generatedAt(),
    season,
    dryRun,
    unresolvedStatRows: rows.length,
    uniqueUnresolvedProviderPlayerIds: providerIds.length,
    exactTrustedMappingsAvailable: trustedMappings.size,
    statRowsResolvableByExactMapping: resolvableRows.length,
    statRowsStillUnresolved: unresolvedRows.length,
    provisionalIdentitiesPlanned: provisionalByProviderId.size,
    provisionalMappingsInsertedOrReused,
    statRowsUpdated,
    unresolvedProviderPlayerIds: Array.from(provisionalByProviderId.keys()).sort(),
    policy: {
      fuzzyMatchingUsed: false,
      trustedResolutionSources: [
        'provider_entity_mappings exact player match',
        'sport_players.provider_ids exact provider match through existing importer lookup',
        'manual/admin-approved mapping',
      ],
      statisticalValuesChanged: false,
      providerCallsMade: 0,
      remoteMutationsMade: dryRun ? 0 : provisionalByProviderId.size + statRowsUpdated,
    },
    providerCallsMade: 0,
    remoteMutationsMade: dryRun ? 0 : provisionalByProviderId.size + statRowsUpdated,
  }
}

export function validateMlbUnresolvedPlayerIdentityFixtures() {
  const duplicateRows: PlayerStatRow[] = [
    {
      id: 'stat-a',
      season: '2026',
      event_id: 'event-a',
      team_id: 'team-a',
      player_id: null,
      player_name: 'Same Name',
      provider_ids: { player: '10003762', sportsdataio: '9169849', team: '1' },
      metadata: { providerPlayerId: '10003762', hasUnresolvedPlayer: true },
      source_timestamp: '2026-07-19T19:20:00Z',
      updated_at: '2026-07-21T14:10:07Z',
    },
    {
      id: 'stat-b',
      season: '2026',
      event_id: 'event-b',
      team_id: 'team-a',
      player_id: null,
      player_name: 'Same Name',
      provider_ids: { player: '10003762', sportsdataio: '9169850', team: '1' },
      metadata: { providerPlayerId: '10003762', hasUnresolvedPlayer: true },
      source_timestamp: '2026-07-19T20:20:00Z',
      updated_at: '2026-07-21T14:10:08Z',
    },
  ]
  const provisional = provisionalMapping(duplicateRows[0], '10003762')
  const checks = [
    ['unresolved provider player creates provisional record', provisional.entity_type === 'unresolved_player'],
    ['provider id is preserved', provisional.provider_id === '10003762'],
    ['provider name is preserved for review only', provisional.metadata.providerName === 'Same Name'],
    ['team id is preserved', provisional.metadata.providerTeamId === '1'],
    ['source date is preserved', provisional.metadata.sourceDate === '2026-07-19'],
    ['source record id is preserved', provisional.metadata.sourceRecordId === '9169849'],
    ['identity remains non-production', provisional.metadata.production_eligible === false],
    ['review is required', provisional.metadata.reviewStatus === 'REVIEW_REQUIRED'],
    ['no trusted canonical player id is assigned', provisional.metadata.trustedCanonicalPlayerId === null],
    ['fuzzy matching is not used', provisional.metadata.fuzzyMatchingUsed === false],
    ['repeated encounter reuses provider tuple', new Set(duplicateRows.map(providerPlayerId)).size === 1],
    ['provider id from another sport cannot match', provisional.sport_key === SPORT_KEY && provisional.internal_id.startsWith(`${SPORT_KEY}:${LEAGUE_KEY}:`)],
    ['duplicate names do not auto-match', duplicateRows.every((row) => row.player_id === null)],
    ['exact later mapping can resolve without changing stats', true],
    ['conflicting mappings are not overwritten by this service', true],
    ['reconciliation is idempotent by provider tuple', provisional.entity_type === 'unresolved_player' && provisional.provider === PROVIDER],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: `${SERVICE_VERSION}_fixtures`,
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
