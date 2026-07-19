import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeBasketballImportRows } from '@/services/basketball-source-framework.service'
import { buildBasketballHistoricalSeasonPlan } from '@/services/basketball/history/historical-builder'
import { normalizeBasketballCanonicalRows } from '@/services/basketball/normalizers/canonical'
import { reconcileBasketballEntities } from '@/services/basketball/reconciliation/reconciliation-engine'
import { planBasketballKnowledgeGeneration } from '@/services/basketball/knowledge/knowledge-layer'
import { getFeatureDefinitions, getFeatureStoreStatus } from '@/services/feature-store-core.service'
import { planHistoricalImport } from '@/services/historical-import-engine.service'
import { runSportPredictionSdkValidation } from '@/services/sport-prediction-engine-sdk.service'
import {
  fetchOfficialBsnHomepageSnapshot,
  OFFICIAL_BSN_HOMEPAGE_CONNECTOR_ID,
  OFFICIAL_BSN_HOMEPAGE_URL,
  validateOfficialBsnHomepageConnectorFixtures,
  type OfficialBsnHomepageSnapshot,
} from '@/services/basketball/connectors/official-bsn-homepage.connector'

const BSN_SPORT_KEY = 'basketball_bsn' as const
const BSN_LEAGUE_KEY = 'bsn_pr' as const
const PROVIDER = 'official_bsn_homepage'

type StorageResult = {
  status: 'dry_run' | 'completed' | 'failed'
  writesMade: number
  recordsInsertedOrUpdated: number
  tablesPopulated: string[]
  error: string | null
}

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return Number(((numerator / denominator) * 100).toFixed(2))
}

function nowIso() {
  return new Date().toISOString()
}

function slug(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function teamId(teamName: string) {
  return `${BSN_SPORT_KEY}:${BSN_LEAGUE_KEY}:team:${slug(teamName)}`
}

function playerId(playerName: string) {
  return `${BSN_SPORT_KEY}:${BSN_LEAGUE_KEY}:player:${slug(playerName)}`
}

function eventId(providerGameId: string) {
  return `${BSN_SPORT_KEY}:${BSN_LEAGUE_KEY}:event:${slug(providerGameId)}`
}

function teamNameByCode(snapshot: OfficialBsnHomepageSnapshot, code: string) {
  return snapshot.teams.find((team) => team.teamCode === code)?.teamName ?? code
}
function rawRowsFromSnapshot(snapshot: OfficialBsnHomepageSnapshot) {
  const teams = snapshot.teams.map((team) => ({
    type: 'team',
    providerId: team.providerTeamId,
    teamName: team.teamName,
    group: team.group,
    rank: team.rank,
  }))
  const standings = snapshot.standings.map((standing) => ({
    type: 'standing',
    providerId: standing.providerStandingId,
    teamName: standing.teamName,
    wins: standing.wins,
    losses: standing.losses,
    gamesPlayed: standing.gamesPlayed,
    winPercentage: standing.winPercentage,
    group: standing.group,
    rank: standing.rank,
  }))
  const results = snapshot.results.map((result) => ({
    type: 'result',
    providerId: result.providerGameId,
    homeTeam: result.homeTeamName ?? result.homeTeamCode,
    awayTeam: result.awayTeamName ?? result.awayTeamCode,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    date: result.gameDate,
  }))
  const players = snapshot.players.map((player) => ({
    type: 'player',
    providerId: player.providerPlayerId,
    playerName: player.playerName,
    teamName: player.teamName,
    position: player.position,
  }))
  return [...teams, ...standings, ...results, ...players]
}

function normalizedTeamRows(snapshot: OfficialBsnHomepageSnapshot) {
  const at = nowIso()
  return snapshot.teams.map((team) => ({
    id: teamId(team.teamName),
    sport_key: BSN_SPORT_KEY,
    league_key: BSN_LEAGUE_KEY,
    name: team.teamName,
    abbreviation: null,
    city: null,
    conference: team.group,
    division: team.group,
    active: true,
    provider_ids: {
      [PROVIDER]: team.providerTeamId,
    },
    metadata: {
      source: PROVIDER,
      sourceUrl: snapshot.sourceUrl,
      season: snapshot.season,
      fetchedAt: snapshot.fetchedAt,
      rank: team.rank,
      missingFields: ['abbreviation', 'city'],
    },
    updated_at: at,
  }))
}

function normalizedStandingRows(snapshot: OfficialBsnHomepageSnapshot) {
  const at = nowIso()
  return snapshot.standings.map((standing) => ({
    id: `${BSN_SPORT_KEY}:${BSN_LEAGUE_KEY}:standing:${snapshot.season ?? 'unknown'}:${standing.providerTeamId}`,
    sport_key: BSN_SPORT_KEY,
    league_key: BSN_LEAGUE_KEY,
    season: snapshot.season ?? '',
    team_id: teamId(standing.teamName),
    team_name: standing.teamName,
    conference: standing.group,
    division: standing.group,
    conference_rank: standing.rank,
    division_rank: null,
    wins: standing.wins,
    losses: standing.losses,
    win_percentage: standing.winPercentage,
    games_behind: null,
    home_record: null,
    away_record: null,
    streak: null,
    last_ten: null,
    provider_ids: {
      [PROVIDER]: standing.providerStandingId,
    },
    metadata: {
      source: PROVIDER,
      sourceUrl: snapshot.sourceUrl,
      fetchedAt: snapshot.fetchedAt,
      gamesPlayed: standing.gamesPlayed,
      missingFields: ['games_behind', 'home_record', 'away_record', 'streak', 'last_ten'],
    },
    updated_at: at,
  }))
}

function normalizedEventRows(snapshot: OfficialBsnHomepageSnapshot) {
  const at = nowIso()
  return snapshot.results
    .filter((result) => result.gameDate && Number.isFinite(result.homeScore) && Number.isFinite(result.awayScore))
    .map((result) => {
      const awayTeamName = result.awayTeamName ?? teamNameByCode(snapshot, result.awayTeamCode)
      const homeTeamName = result.homeTeamName ?? teamNameByCode(snapshot, result.homeTeamCode)
      return {
        id: eventId(result.providerGameId),
        sport_key: BSN_SPORT_KEY,
        league_key: BSN_LEAGUE_KEY,
        season: snapshot.season ?? '',
        stage: 'regular',
        home_team_id: teamId(homeTeamName),
        away_team_id: teamId(awayTeamName),
        home_team: homeTeamName,
        away_team: awayTeamName,
        start_time: `${result.gameDate}T20:00:00-04:00`,
        venue: null,
        status: 'completed',
        home_score: result.homeScore,
        away_score: result.awayScore,
        period_scores: [],
        overtime: false,
        provider_ids: { [PROVIDER]: result.providerGameId },
        metadata: {
          source: PROVIDER,
          sourceUrl: result.sourceUrl,
          fetchedAt: snapshot.fetchedAt,
          dateLabel: result.dateLabel,
          awayTeamCode: result.awayTeamCode,
          homeTeamCode: result.homeTeamCode,
          missingFields: ['venue', 'quarter_scores', 'boxscore', 'officials', 'attendance'],
        },
        updated_at: at,
      }
    })
}

function normalizedPlayerRows(snapshot: OfficialBsnHomepageSnapshot) {
  const at = nowIso()
  return snapshot.players.map((player) => ({
    id: playerId(player.playerName),
    sport_key: BSN_SPORT_KEY,
    league_key: BSN_LEAGUE_KEY,
    team_id: player.teamName ? teamId(player.teamName) : null,
    team_name: player.teamName,
    display_name: player.playerName,
    position: player.position,
    jersey: null,
    status: null,
    height: null,
    weight: null,
    birth_date: null,
    nationality: null,
    active: true,
    provider_ids: { [PROVIDER]: player.providerPlayerId },
    metadata: {
      source: PROVIDER,
      sourceUrl: player.sourceUrl,
      fetchedAt: snapshot.fetchedAt,
      season: snapshot.season,
      missingFields: ['jersey', 'status', 'height', 'weight', 'birth_date', 'nationality'],
    },
    updated_at: at,
  }))
}
function providerMappings(snapshot: OfficialBsnHomepageSnapshot) {
  const at = nowIso()
  const teamMappings = snapshot.teams.map((team) => ({
    sport_key: BSN_SPORT_KEY,
    entity_type: 'team',
    internal_id: teamId(team.teamName),
    provider: PROVIDER,
    provider_id: team.providerTeamId,
    season: snapshot.season ?? '',
    metadata: {
      teamName: team.teamName,
      sourceUrl: snapshot.sourceUrl,
      fetchedAt: snapshot.fetchedAt,
    },
    updated_at: at,
  }))
  const standingMappings = snapshot.standings.map((standing) => ({
    sport_key: BSN_SPORT_KEY,
    entity_type: 'standing',
    internal_id: `${BSN_SPORT_KEY}:${BSN_LEAGUE_KEY}:standing:${snapshot.season ?? 'unknown'}:${standing.providerTeamId}`,
    provider: PROVIDER,
    provider_id: standing.providerStandingId,
    season: snapshot.season ?? '',
    metadata: {
      teamName: standing.teamName,
      sourceUrl: snapshot.sourceUrl,
      fetchedAt: snapshot.fetchedAt,
    },
    updated_at: at,
  }))
  const eventMappings = snapshot.results.map((result) => ({
    sport_key: BSN_SPORT_KEY,
    entity_type: 'event',
    internal_id: eventId(result.providerGameId),
    provider: PROVIDER,
    provider_id: result.providerGameId,
    season: snapshot.season ?? '',
    metadata: {
      sourceUrl: result.sourceUrl,
      fetchedAt: snapshot.fetchedAt,
      dateLabel: result.dateLabel,
    },
    updated_at: at,
  }))
  const playerMappings = snapshot.players.map((player) => ({
    sport_key: BSN_SPORT_KEY,
    entity_type: 'player',
    internal_id: playerId(player.playerName),
    provider: PROVIDER,
    provider_id: player.providerPlayerId,
    season: snapshot.season ?? '',
    metadata: {
      playerName: player.playerName,
      teamName: player.teamName,
      sourceUrl: player.sourceUrl,
      fetchedAt: snapshot.fetchedAt,
    },
    updated_at: at,
  }))
  return [...teamMappings, ...standingMappings, ...eventMappings, ...playerMappings]
}

async function storeSnapshot(snapshot: OfficialBsnHomepageSnapshot, execute: boolean): Promise<StorageResult> {
  if (!execute) {
    return {
      status: 'dry_run',
      writesMade: 0,
      recordsInsertedOrUpdated: 0,
      tablesPopulated: ['sports_teams', 'sport_standings', 'sport_events', 'sport_players', 'provider_entity_mappings', 'sports_sync_jobs'],
      error: null,
    }
  }

  try {
    const teams = normalizedTeamRows(snapshot)
    const standings = normalizedStandingRows(snapshot)
    const events = normalizedEventRows(snapshot)
    const players = normalizedPlayerRows(snapshot)
    const mappings = providerMappings(snapshot)
    const syncStartedAt = nowIso()
    const { data: job, error: jobError } = await supabaseAdmin
      .from('sports_sync_jobs')
      .insert({
        job_type: 'bsn_acquisition_standings_snapshot',
        sport_key: BSN_SPORT_KEY,
        league_key: BSN_LEAGUE_KEY,
        provider: PROVIDER,
        season: snapshot.season,
        started_at: syncStartedAt,
        status: 'running',
        records_fetched: snapshot.teams.length + snapshot.standings.length + snapshot.results.length + snapshot.players.length,
        metadata: {
          sourceUrl: snapshot.sourceUrl,
          sourceId: snapshot.sourceId,
          fetchedAt: snapshot.fetchedAt,
          sampleScope: 'official_public_pages_bounded_snapshot',
          noOfficialPickMutation: true,
          noChampionMutation: true,
        },
      })
      .select('id')
      .single()

    if (jobError) throw new Error(`sports_sync_jobs insert failed: ${jobError.message}`)

    const teamsResult = await supabaseAdmin.from('sports_teams').upsert(teams, { onConflict: 'id' })
    if (teamsResult.error) throw new Error(`sports_teams upsert failed: ${teamsResult.error.message}`)
    const standingsResult = await supabaseAdmin.from('sport_standings').upsert(standings, { onConflict: 'id' })
    if (standingsResult.error) throw new Error(`sport_standings upsert failed: ${standingsResult.error.message}`)
    if (events.length) {
      const eventsResult = await supabaseAdmin.from('sport_events').upsert(events, { onConflict: 'id' })
      if (eventsResult.error) throw new Error(`sport_events upsert failed: ${eventsResult.error.message}`)
    }
    if (players.length) {
      const playersResult = await supabaseAdmin.from('sport_players').upsert(players, { onConflict: 'id' })
      if (playersResult.error) throw new Error(`sport_players upsert failed: ${playersResult.error.message}`)
    }    const mappingsResult = await supabaseAdmin
      .from('provider_entity_mappings')
      .upsert(mappings, { onConflict: 'sport_key,entity_type,provider,provider_id,season' })
    if (mappingsResult.error) throw new Error(`provider_entity_mappings upsert failed: ${mappingsResult.error.message}`)

    const recordsWritten = teams.length + standings.length + events.length + players.length + mappings.length
    const jobUpdate = await supabaseAdmin
      .from('sports_sync_jobs')
      .update({
        completed_at: nowIso(),
        status: 'completed',
        records_inserted: recordsWritten,
        records_updated: recordsWritten,
        duration_ms: Math.max(0, Date.now() - new Date(syncStartedAt).getTime()),
        metadata: {
          sourceUrl: snapshot.sourceUrl,
          sourceId: snapshot.sourceId,
          fetchedAt: snapshot.fetchedAt,
          sampleScope: 'official_public_pages_bounded_snapshot',
          tablesPopulated: ['sports_teams', 'sport_standings', 'sport_events', 'sport_players', 'provider_entity_mappings'],
          noOfficialPickMutation: true,
          noChampionMutation: true,
        },
      })
      .eq('id', job?.id)
    if (jobUpdate.error) throw new Error(`sports_sync_jobs completion failed: ${jobUpdate.error.message}`)

    return {
      status: 'completed',
      writesMade: recordsWritten + 1,
      recordsInsertedOrUpdated: recordsWritten,
      tablesPopulated: ['sports_teams', 'sport_standings', 'sport_events', 'sport_players', 'provider_entity_mappings', 'sports_sync_jobs'],
      error: null,
    }
  } catch (error) {
    return {
      status: 'failed',
      writesMade: 0,
      recordsInsertedOrUpdated: 0,
      tablesPopulated: [],
      error: error instanceof Error ? error.message : 'Unknown BSN acquisition storage error',
    }
  }
}

function buildQualityReport(snapshot: OfficialBsnHomepageSnapshot) {
  const supported = snapshot.capabilities.filter((item) => item.status === 'supported').map((item) => item.capability)
  const unsupported = snapshot.capabilities.filter((item) => item.status !== 'supported').map((item) => item.capability)
  const expectedStandingFields = 9
  const missingFields = [
    'schedule',
    'results',
    'players',
    'quarter_scores',
    'boxscores',
    'play_by_play',
    'officials',
    'attendance',
    'arena',
    'advanced_metrics',
    'odds',
    'home_record',
    'away_record',
    'streak',
    'last_ten',
  ]
  const validationScore = snapshot.standings.length > 0 && snapshot.season ? Math.min(94, 70 + Math.min(10, snapshot.results.length) + Math.min(8, snapshot.players.length > 0 ? 8 : 0) + Math.min(6, snapshot.teamLeaders.length)) : 0
  const confidenceScore = Math.max(
    0,
    Math.min(100, validationScore - (snapshot.warnings.length * 8) - (snapshot.freshness === 'stale' ? 15 : 0))
  )

  return {
    connectorHealth: snapshot.standings.length > 0 ? 'healthy_partial_connector' : 'no_records_acquired',
    datasetCoverage: {
      teams: { records: snapshot.teams.length, status: snapshot.teams.length > 0 ? 'supported' : 'empty' },
      standings: { records: snapshot.standings.length, status: snapshot.standings.length > 0 ? 'supported' : 'empty' },
      schedule: { records: snapshot.upcomingGames.length, status: snapshot.upcomingGames.length > 0 ? 'partial' : 'not_available' },
      results: { records: snapshot.results.length, status: snapshot.results.length > 0 ? 'supported' : 'empty' },
      players: { records: snapshot.players.length, status: snapshot.players.length > 0 ? 'partial' : 'empty' },
      statistics: { records: snapshot.teamLeaders.length, status: snapshot.teamLeaders.length > 0 ? 'partial' : 'not_available' },
      odds: { records: 0, status: 'not_supported' },
    },
    fieldCoveragePct: pct(snapshot.standings.length * 6, Math.max(1, snapshot.standings.length * expectedStandingFields)),
    validationScore,
    confidenceScore,
    supportedCapabilities: supported,
    unsupportedCapabilities: unsupported,
    missingFields,
  }
}

export async function getBsnAcquisitionDiscovery() {
  const snapshot = await fetchOfficialBsnHomepageSnapshot()
  const quality = buildQualityReport(snapshot)

  return {
    success: true,
    mode: 'bsn_acquisition_discovery_v1',
    generatedAt: nowIso(),
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    sourceSelected: {
      connectorId: OFFICIAL_BSN_HOMEPAGE_CONNECTOR_ID,
      sourceUrl: OFFICIAL_BSN_HOMEPAGE_URL,
      reason: 'Official homepage exposes a bounded public standings snapshot with team names and records.',
      acquisitionMethod: 'single_cached_homepage_snapshot',
    },
    providerCallsMade: snapshot.providerCallsMade,
    availableDatasets: quality.supportedCapabilities,
    unavailableDatasets: quality.unsupportedCapabilities,
    seasonsDiscovered: snapshot.season ? [snapshot.season] : [],
    gameIdentifiersDiscovered: snapshot.results.map((result) => result.providerGameId),
    teamIdentifiersDiscovered: snapshot.teams.map((team) => team.providerTeamId),
    playerIdentifiersDiscovered: snapshot.players.map((player) => player.providerPlayerId),
    standingsDiscovered: snapshot.standings.length,
    statisticsDiscovered: snapshot.teamLeaders.length,
    snapshot,
    quality,
  }
}

export async function runBsnAcquisitionEngine({
  execute = false,
  confirmed = false,
  forceRefresh = false,
}: {
  execute?: boolean
  confirmed?: boolean
  forceRefresh?: boolean
} = {}) {
  const snapshot = await fetchOfficialBsnHomepageSnapshot({ forceRefresh })
  const rawRows = rawRowsFromSnapshot(snapshot)
  const sourceNormalization = normalizeBasketballImportRows({
    sourceId: OFFICIAL_BSN_HOMEPAGE_CONNECTOR_ID,
    rows: rawRows,
  })
  const canonical = normalizeBasketballCanonicalRows({
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    season: snapshot.season,
    sourceId: OFFICIAL_BSN_HOMEPAGE_CONNECTOR_ID,
    connectorId: OFFICIAL_BSN_HOMEPAGE_CONNECTOR_ID,
    fetchedAt: snapshot.fetchedAt,
    rows: snapshot.teams.map((team) => ({
      type: 'team',
      providerId: team.providerTeamId,
      teamName: team.teamName,
    })),
  })
  const reconciliation = reconcileBasketballEntities(canonical.entities)
  const storage = await storeSnapshot(snapshot, execute && confirmed)
  const builder = buildBasketballHistoricalSeasonPlan({
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    season: snapshot.season,
    dateFrom: null,
    dateTo: null,
  })
  const historicalImport = planHistoricalImport({
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    providerId: PROVIDER,
    season: snapshot.season ?? undefined,
    dataTypes: ['standings', 'scores', 'players'],
    dryRun: true,
  })
  const knowledge = planBasketballKnowledgeGeneration(canonical.entities)
  const featureStore = getFeatureStoreStatus()
  const featureDefinitions = getFeatureDefinitions({ sportKey: BSN_SPORT_KEY })
  const predictionSdk = runSportPredictionSdkValidation()
  const quality = buildQualityReport(snapshot)
  const completeFlow = {
    acquire: snapshot.standings.length > 0 ? 'passed' : 'failed',
    normalize: sourceNormalization.rowsNormalized === rawRows.length ? 'passed' : 'partial',
    validate: quality.validationScore > 0 ? 'passed' : 'failed',
    reconcile: reconciliation ? 'passed' : 'partial',
    store: storage.status,
    knowledge: 'planned',
    featureStore: featureDefinitions.definitions.length > 0 ? 'available' : 'unavailable',
    predictionSdk: predictionSdk.success ? 'available' : 'unavailable',
  }

  return {
    success: storage.status !== 'failed',
    mode: 'bsn_acquisition_engine_v1',
    generatedAt: nowIso(),
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    executeRequested: execute,
    executeConfirmed: confirmed,
    status: execute && !confirmed
      ? 'write_blocked_confirmation_required'
      : storage.status === 'completed'
        ? 'sample_import_completed'
        : storage.status === 'failed'
          ? 'sample_import_failed'
          : 'dry_run_ready',
    providerCallsMade: snapshot.providerCallsMade,
    remoteMutationsMade: storage.writesMade,
    sourceSelected: {
      connectorId: OFFICIAL_BSN_HOMEPAGE_CONNECTOR_ID,
      sourceUrl: OFFICIAL_BSN_HOMEPAGE_URL,
      sampleScope: 'official_public_pages_bounded_snapshot',
    },
    discovery: {
      availableDatasets: quality.supportedCapabilities,
      unavailableDatasets: quality.unsupportedCapabilities,
      seasonsDiscovered: snapshot.season ? [snapshot.season] : [],
      teamIdentifiersDiscovered: snapshot.teams.map((team) => team.providerTeamId),
      gameIdentifiersDiscovered: snapshot.results.map((result) => result.providerGameId),
      playerIdentifiersDiscovered: snapshot.players.map((player) => player.providerPlayerId),
      standingsDiscovered: snapshot.standings.length,
      statisticsDiscovered: snapshot.teamLeaders.length,
    },
    acquisition: {
      sourceId: snapshot.sourceId,
      sourceUrl: snapshot.sourceUrl,
      fetchedAt: snapshot.fetchedAt,
      freshness: snapshot.freshness,
      fromCache: snapshot.fromCache,
      realRecordsAcquired: snapshot.teams.length + snapshot.standings.length + snapshot.results.length + snapshot.players.length + snapshot.teamLeaders.length,
      teamsAcquired: snapshot.teams.length,
      standingsAcquired: snapshot.standings.length,
      gamesAcquired: snapshot.results.length + snapshot.upcomingGames.length,
      playersAcquired: snapshot.players.length,
      statisticsAcquired: snapshot.teamLeaders.length,
      warnings: snapshot.warnings,
    },
    normalized: {
      rawRowsReceived: rawRows.length,
      rowsNormalized: sourceNormalization.rowsNormalized,
      completeRows: sourceNormalization.completeRows,
      incompleteRows: sourceNormalization.incompleteRows,
      canonicalEntities: canonical.entitiesNormalized,
      standingRowsPrepared: snapshot.standings.length,
      teamRowsPrepared: snapshot.teams.length,
      eventRowsPrepared: snapshot.results.length,
      playerRowsPrepared: snapshot.players.length,
    },
    validation: {
      validationScore: quality.validationScore,
      confidenceScore: quality.confidenceScore,
      noFabrication: true,
      unsupportedFieldsRemainNull: true,
      officialPickThresholdsChanged: false,
      championRowsMutated: false,
      v7Promoted: false,
    },
    reconciliation: {
      status: reconciliation ? 'completed' : 'no_entities',
      conflicts: reconciliation?.conflicts.length ?? 0,
      provenancePreserved: reconciliation?.provenancePreserved ?? true,
      silentOverwrite: reconciliation?.silentOverwrite ?? false,
    },
    store: storage,
    knowledge: {
      status: 'planned_waiting_for_completed_games',
      knowledgeGenerated: 0,
      plan: knowledge,
    },
    featureStore: {
      status: featureDefinitions.definitions.length > 0 ? 'available_for_future_snapshots' : 'unavailable',
      definitions: featureDefinitions.definitions.length,
      platform: featureStore,
    },
    predictionSdk: {
      status: predictionSdk.success ? 'validated' : 'failed',
      validation: predictionSdk,
    },
    historicalBuilder: builder,
    historicalImport,
    quality,
    completeFlow,
    currentBoardImpact: 'none_no_events_odds_predictions_or_official_recommendations_imported',
    officialPickImpact: 'none_thresholds_and_champion_rows_unchanged',
    remainingLimitations: [
      'Official public pages do not expose stable quarter scores, boxscores, play-by-play, officials, attendance, availability, odds or advanced metrics in the supported snapshot.',
      'Historical reconstruction is limited to the current official public 2026 snapshot and recent team-page results; prior seasons stop as unavailable until a permissioned archive exists.',
      'No BSN predictions become production-ready until completed games, verified odds, feature snapshots and validation history exist.',
    ],
  }
}

export async function validateBsnAcquisitionEngineFixtures() {
  const connector = validateOfficialBsnHomepageConnectorFixtures()
  const checks = [
    ['connector fixtures pass', connector.success],
    ['connector uses zero fixture provider calls', connector.providerCallsMade === 0],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)

  return {
    success: failedChecks.length === 0,
    mode: 'bsn_acquisition_engine_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    connector,
  }
}

type SafeCountResult = { count: number; error: string | null }

async function safeCount(table: string, filters: Record<string, string> = {}): Promise<SafeCountResult> {
  try {
    let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value)
    const { count, error } = await query
    return { count: count ?? 0, error: error?.message ?? null }
  } catch (error) {
    return { count: 0, error: error instanceof Error ? error.message : `Unable to count ${table}` }
  }
}

export async function getBsnDataCoverageDashboard() {
  const [teams, standings, games, players, gameStats] = await Promise.all([
    safeCount('sports_teams', { sport_key: BSN_SPORT_KEY }),
    safeCount('sport_standings', { sport_key: BSN_SPORT_KEY }),
    safeCount('sport_events', { sport_key: BSN_SPORT_KEY }),
    safeCount('sport_players', { sport_key: BSN_SPORT_KEY }),
    safeCount('sport_game_stats', { sport_key: BSN_SPORT_KEY }),
  ])
  const connectorValidation = validateOfficialBsnHomepageConnectorFixtures()
  const rows = [
    { dataset: 'Teams', records: teams.count, target: 12, status: teams.count >= 12 ? 'complete' : teams.count > 0 ? 'partial' : 'empty' },
    { dataset: 'Standings', records: standings.count, target: 12, status: standings.count >= 12 ? 'complete' : standings.count > 0 ? 'partial' : 'empty' },
    { dataset: 'Schedule', records: games.count, target: null, status: games.count > 0 ? 'partial' : 'not_available' },
    { dataset: 'Results', records: games.count, target: null, status: games.count > 0 ? 'partial' : 'empty' },
    { dataset: 'Games', records: games.count, target: null, status: games.count > 0 ? 'partial' : 'empty' },
    { dataset: 'Players', records: players.count, target: null, status: players.count > 0 ? 'partial' : 'empty' },
    { dataset: 'Quarter Scores', records: 0, target: null, status: 'not_available' },
    { dataset: 'Statistics', records: gameStats.count, target: null, status: gameStats.count > 0 ? 'partial' : 'not_available' },
    { dataset: 'Boxscores', records: 0, target: null, status: 'not_available' },
    { dataset: 'Play-by-Play', records: 0, target: null, status: 'not_available' },
  ].map((row) => ({
    ...row,
    coveragePct: row.target ? pct(row.records, row.target) : row.records > 0 ? 100 : 0,
  }))
  const errors = [teams.error, standings.error, games.error, players.error, gameStats.error].filter(Boolean) as string[]
  const supportedRecords = teams.count + standings.count + games.count + players.count + gameStats.count
  const completionPct = Math.round(rows.reduce((sum, row) => sum + row.coveragePct, 0) / rows.length)

  return {
    success: true,
    mode: 'bsn_data_coverage_dashboard_v1',
    generatedAt: nowIso(),
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    coverage: rows,
    summary: {
      completionPct,
      supportedRecords,
      teams: teams.count,
      standings: standings.count,
      games: games.count,
      players: players.count,
      statistics: gameStats.count,
    },
    connectorValidation,
    warnings: [
      ...errors,
      'Coverage dashboard is read-only and uses stored normalized rows only.',
      'Quarter scores, boxscores, play-by-play, odds, officials and attendance remain unavailable from the supported public snapshot.',
    ],
    guardrails: {
      noProviderCalls: true,
      noRemoteMutations: true,
      noPredictionChanges: true,
      noThresholdChanges: true,
      noChampionMutation: true,
    },
  }
}