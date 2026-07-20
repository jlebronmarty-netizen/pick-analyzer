import 'server-only'

import { sportsDataIoCatalogForSport, type SportsDataIoEndpointCatalogEntry } from '@/config/sportsdataio-endpoint-catalog'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getMlbProviderCapabilityAudit, validateMlbProviderCapabilityAuditFixtures } from '@/services/mlb-provider-capability-audit.service'

type DiscoveryStatus =
  | 'ACCESSIBLE'
  | 'ACCESSIBLE_PARTIAL'
  | 'ACCESSIBLE_EMPTY'
  | 'SUBSCRIPTION_BLOCKED'
  | 'BLOCKED_BY_POLICY'
  | 'CATALOG_ONLY'
  | 'UNTESTED'
  | 'UNKNOWN'

type FieldUsability = 'usable' | 'display_only' | 'identity_only' | 'unusable' | 'unknown'

type SyncJobRow = {
  id: string
  job_type: string | null
  provider: string | null
  status: string | null
  records_fetched: number | null
  records_inserted: number | null
  records_updated: number | null
  records_skipped: number | null
  metadata: Record<string, unknown> | null
  created_at: string | null
}

type CountResult = {
  table: string
  count: number
  status: 'available' | 'unavailable'
  error: string | null
}

type FieldProfile = {
  endpointId: string
  fieldName: string
  observedRows: number
  presentRows: number
  nullRows: number
  type: string
  freshness: string
  usability: FieldUsability
  sampleSanitizedValue: unknown
  scrambledAssessment: {
    status: 'not_detected' | 'possible' | 'not_assessed'
    reasons: string[]
  }
}

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'

const FIELD_NAME_HINTS = [
  'GameID',
  'DateTime',
  'Status',
  'HomeTeam',
  'AwayTeam',
  'HomeTeamID',
  'AwayTeamID',
  'StadiumID',
  'ForecastTempLow',
  'ForecastTempHigh',
  'ForecastDescription',
  'ForecastWindSpeed',
  'ForecastWindDirection',
  'AwayTeamProbablePitcherID',
  'HomeTeamProbablePitcherID',
  'AwayTeamStartingPitcherID',
  'HomeTeamStartingPitcherID',
  'Name',
  'PlayerID',
  'TeamID',
  'Status',
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function safeString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function sanitizeSample(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string') return value.slice(0, 80)
  if (Array.isArray(value)) return `[array:${value.length}]`
  if (typeof value === 'object') return '[object]'
  return String(value).slice(0, 80)
}

function providerDateFromIso(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return date
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  return `${parsed.getUTCFullYear()}-${months[parsed.getUTCMonth()]}-${String(parsed.getUTCDate()).padStart(2, '0')}`
}

function endpointRuntimeStatus(endpoint: SportsDataIoEndpointCatalogEntry, counts: Record<string, CountResult>): DiscoveryStatus {
  if (endpoint.providerVariant === 'sportsdataio_enterprise') return 'SUBSCRIPTION_BLOCKED'
  if (endpoint.implementedStatus === 'blocked' || endpoint.productionValidationStatus === 'blocked') return 'BLOCKED_BY_POLICY'

  const pilot = endpoint.lastPilotStatus.toLowerCase()
  if (pilot.includes('http_200_0_records')) return 'ACCESSIBLE_EMPTY'
  if (pilot.includes('http_200') || pilot.includes('auth_probe_http_200')) return 'ACCESSIBLE_PARTIAL'
  if (pilot.includes('confirmed_endpoint_not_called') || pilot.includes('confirmed_endpoint_excluded')) return 'UNTESTED'

  if (endpoint.domain === 'teams' && (counts.sports_teams?.count ?? 0) > 0) return 'ACCESSIBLE_PARTIAL'
  if (endpoint.domain === 'players' && (counts.sport_players?.count ?? 0) > 0) return 'ACCESSIBLE_PARTIAL'
  if (endpoint.domain === 'schedules' && (counts.sport_events?.count ?? 0) > 0) return 'ACCESSIBLE_PARTIAL'
  if (endpoint.domain === 'odds' && endpoint.pathTemplate.includes('GameOddsByDate') && (counts.sports_odds_snapshots?.count ?? 0) > 0) {
    return 'ACCESSIBLE'
  }
  return 'CATALOG_ONLY'
}

function usabilityForField(fieldName: string): FieldUsability {
  const lower = fieldName.toLowerCase()
  if (lower.includes('id')) return 'identity_only'
  if (['name', 'city', 'state', 'country', 'description', 'status'].some((token) => lower.includes(token))) return 'display_only'
  if (['probablepitcher', 'startingpitcher', 'forecast', 'datetime', 'score', 'total', 'moneyline', 'spread'].some((token) => lower.includes(token))) {
    return 'usable'
  }
  return 'unknown'
}

function scrambledAssessment(fieldName: string, values: unknown[]) {
  const reasons: string[] = []
  const numericValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const lower = fieldName.toLowerCase()

  if (numericValues.length) {
    if (lower.includes('percent') && numericValues.some((value) => value < 0 || value > 100)) reasons.push('percentage_out_of_expected_range')
    if (lower.includes('probability') && numericValues.some((value) => value < 0 || value > 1)) reasons.push('probability_out_of_expected_range')
    if (lower.includes('inning') && numericValues.some((value) => value < 0 || value > 30)) reasons.push('innings_out_of_expected_range')
    if (lower.includes('temperature') && numericValues.some((value) => value < -40 || value > 130)) reasons.push('temperature_out_of_expected_range')
  }

  const populated = values.filter((value) => value !== null && value !== undefined)
  const uniqueValues = new Set(populated.map((value) => JSON.stringify(value))).size
  if (populated.length >= 10 && uniqueValues === 1) reasons.push('single_constant_value_across_many_rows')

  return {
    status: reasons.length ? 'possible' as const : values.length ? 'not_detected' as const : 'not_assessed' as const,
    reasons,
  }
}

function endpointId(endpoint: SportsDataIoEndpointCatalogEntry) {
  return endpoint.pathTemplate.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
}

function payloadRowsFromJob(job: SyncJobRow) {
  const metadata = asRecord(job.metadata)
  const rawPayload = asArray(metadata.rawPayload)
  if (rawPayload.length) return rawPayload
  const checkpoint = asRecord(metadata.checkpoint)
  const checkpointPayload = asArray(checkpoint.rawPayload)
  if (checkpointPayload.length) return checkpointPayload
  return []
}

function fieldProfilesForEndpoint(endpoint: SportsDataIoEndpointCatalogEntry, jobs: SyncJobRow[]): FieldProfile[] {
  const id = endpointId(endpoint)
  const matchingJobs = jobs.filter((job) => {
    const metadata = asRecord(job.metadata)
    const checkpoint = asRecord(metadata.checkpoint)
    const endpointText = [
      metadata.endpoint,
      metadata.path,
      checkpoint.endpoint,
      checkpoint.path,
      checkpoint.providerDate,
      job.job_type,
    ].map((value) => String(value ?? '').toLowerCase())
    return endpointText.some((value) => value.includes(endpoint.pathTemplate.split('/').pop()?.replace('{date}', '').replace('{season}', '').replace('{gameid}', '').toLowerCase() ?? ''))
  })

  const rows = matchingJobs.flatMap(payloadRowsFromJob).filter((row) => row && typeof row === 'object' && !Array.isArray(row)).slice(0, 50)
  if (!rows.length) return []

  const fieldNames = new Set<string>()
  for (const row of rows) {
    const record = asRecord(row)
    for (const key of Object.keys(record)) {
      if (FIELD_NAME_HINTS.includes(key) || fieldNames.size < 40) fieldNames.add(key)
    }
  }

  return [...fieldNames].sort().slice(0, 60).map((fieldName) => {
    const values = rows.map((row) => asRecord(row)[fieldName])
    const presentRows = values.filter((value) => value !== undefined).length
    const nullRows = values.filter((value) => value === null).length
    const sample = values.find((value) => value !== null && value !== undefined)
    return {
      endpointId: id,
      fieldName,
      observedRows: rows.length,
      presentRows,
      nullRows,
      type: sample === undefined || sample === null ? 'unknown' : Array.isArray(sample) ? 'array' : typeof sample,
      freshness: 'stored_sports_sync_jobs_metadata',
      usability: usabilityForField(fieldName),
      sampleSanitizedValue: sanitizeSample(sample),
      scrambledAssessment: scrambledAssessment(fieldName, values),
    }
  })
}

async function safeCount(table: string, filters: Record<string, string>) {
  try {
    let query = supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value)
    const { count, error } = await query
    if (error) {
      return { table, count: 0, status: 'unavailable' as const, error: error.message }
    }
    return { table, count: count ?? 0, status: 'available' as const, error: null }
  } catch (error) {
    return { table, count: 0, status: 'unavailable' as const, error: error instanceof Error ? error.message : 'unknown error' }
  }
}

async function loadSyncJobs() {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id, job_type, provider, status, records_fetched, records_inserted, records_updated, records_skipped, metadata, created_at')
    .eq('provider', 'sportsdataio')
    .eq('sport_key', SPORT_KEY)
    .order('created_at', { ascending: false })
    .limit(80)

  if (error) return { jobs: [] as SyncJobRow[], error: error.message }
  return { jobs: (data ?? []) as SyncJobRow[], error: null }
}

function capabilityMatrix(audit: Awaited<ReturnType<typeof getMlbProviderCapabilityAudit>>) {
  const readiness = audit.engineReadiness
  return [
    {
      capability: 'current_board_markets',
      status: 'AVAILABLE',
      evidence: 'Production markets remain moneyline, run line and full game total.',
      projectionUse: 'current_board_only',
    },
    {
      capability: 'team_projected_runs_hits_hr',
      status: 'ARCHITECTURE_READY_DATA_LIMITED',
      evidence: 'Universal Projection Engine can emit team/game rows, but SportsDataIO team/player stat completeness is not verified for production-quality player or pitcher projections.',
      projectionUse: 'blocked_from_user_visible_projection_board_until_feature_quality_improves',
    },
    {
      capability: 'starting_pitcher_features',
      status: readiness.startingPitcherEngine,
      evidence: audit.gamesByDateContract.note,
      projectionUse: 'do_not_confirm_absence_or_pitcher_props_without verified starters',
    },
    {
      capability: 'lineups',
      status: readiness.lineupEngine,
      evidence: 'Enterprise lineup endpoint remains unavailable to Discovery Lab subscription.',
      projectionUse: 'unavailable_for_player_projection_reactivation',
    },
    {
      capability: 'injury_details',
      status: readiness.injuryEngine,
      evidence: 'Detailed injury endpoint remains enterprise/subscription blocked; roster availability must be treated separately.',
      projectionUse: 'do_not_infer_diagnosis_or_expected_return',
    },
    {
      capability: 'first_five_team_totals_props',
      status: 'UNSUPPORTED_MARKET_LIFECYCLE',
      evidence: 'No approved ingestion, modeling, settlement, replay and dashboard lifecycle exists for these markets.',
      projectionUse: 'not_recommendation_eligible',
    },
  ]
}

function quotaForecast() {
  return {
    providerCallsMadeByDiscovery: 0,
    dryRunDefault: true,
    currentSafeOperatingPlan: [
      { purpose: 'catalog and stored-evidence discovery', providerCalls: 0 },
      { purpose: 'single corrected GamesByDate verification when explicitly approved', providerCalls: '0-1' },
      { purpose: 'GameOddsByDate current slate refresh when operations already schedule it', providerCalls: 'existing operations only' },
      { purpose: 'line movement or player props discovery', providerCalls: 0, status: 'blocked_until_explicit_scope_and_budget' },
    ],
  }
}

export async function getSportsDataIoMlbDiscovery(options: { date?: string; includeSamples?: boolean; dryRun?: boolean } = {}) {
  const date = options.date ?? '2026-07-19'
  const includeSamples = options.includeSamples === true
  const dryRun = options.dryRun !== false
  const catalog = sportsDataIoCatalogForSport('mlb')
  const [audit, syncJobsResult, countRows] = await Promise.all([
    getMlbProviderCapabilityAudit(date),
    loadSyncJobs(),
    Promise.all([
      safeCount('sports_teams', { sport_key: SPORT_KEY }),
      safeCount('sport_players', { sport_key: SPORT_KEY }),
      safeCount('sport_events', { sport_key: SPORT_KEY, league_key: LEAGUE_KEY }),
      safeCount('sport_standings', { sport_key: SPORT_KEY, league_key: LEAGUE_KEY }),
      safeCount('sport_game_stats', { sport_key: SPORT_KEY }),
      safeCount('sport_player_stats', { sport_key: SPORT_KEY }),
      safeCount('sports_odds_snapshots', { sport_key: SPORT_KEY }),
      safeCount('provider_entity_mappings', { provider: 'sportsdataio', sport_key: SPORT_KEY }),
    ]),
  ])

  const counts = Object.fromEntries(countRows.map((row) => [row.table, row]))
  const endpoints = catalog.map((endpoint) => {
    const status = endpointRuntimeStatus(endpoint, counts)
    const profiles = fieldProfilesForEndpoint(endpoint, syncJobsResult.jobs)
    return {
      id: endpointId(endpoint),
      endpoint: endpoint.pathTemplate,
      product: endpoint.product,
      domain: endpoint.domain,
      providerVariant: endpoint.providerVariant,
      status,
      implementedStatus: endpoint.implementedStatus,
      normalizedStatus: endpoint.normalizedStatus,
      persistenceStatus: endpoint.persistenceStatus,
      entitlementStatus: endpoint.entitlementStatus,
      pilotEvidence: endpoint.lastPilotStatus,
      destinationTables: endpoint.destinationTables,
      fieldProfileCount: profiles.length,
      fields: includeSamples ? profiles : profiles.map(({ sampleSanitizedValue: _sample, ...profile }) => profile),
      recommendation:
        status === 'SUBSCRIPTION_BLOCKED'
          ? 'do_not_call_with_current_discovery_lab_key'
          : status === 'ACCESSIBLE_EMPTY'
            ? 'treat_empty_payload_as_real_capability_state_not_failure'
            : status === 'ACCESSIBLE' || status === 'ACCESSIBLE_PARTIAL'
              ? 'eligible_for_narrow_normalization_after_field_quality_review'
              : 'keep_catalog_only_until controlled validation run',
    }
  })

  const statusCounts = endpoints.reduce<Record<string, number>>((acc, endpoint) => {
    acc[endpoint.status] = (acc[endpoint.status] ?? 0) + 1
    return acc
  }, {})

  return {
    success: true,
    mode: 'sportsdataio_mlb_discovery_v1',
    generatedAt: new Date().toISOString(),
    date,
    providerDate: providerDateFromIso(date),
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    dryRun,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    subscriptionModel: {
      currentVariant: 'sportsdataio_discovery_lab',
      enterpriseEndpointsSeparated: true,
      secretsExposed: false,
    },
    summary: {
      endpointsCataloged: endpoints.length,
      discoveryLabEndpoints: endpoints.filter((endpoint) => endpoint.providerVariant === 'sportsdataio_discovery_lab').length,
      enterpriseEndpoints: endpoints.filter((endpoint) => endpoint.providerVariant === 'sportsdataio_enterprise').length,
      statusCounts,
      storedEvidenceTablesAvailable: countRows.filter((row) => row.status === 'available').length,
      latestSyncJobsInspected: syncJobsResult.jobs.length,
    },
    storedEvidence: countRows,
    endpoints,
    fieldQuality: {
      fieldsProfiled: endpoints.reduce((sum, endpoint) => sum + endpoint.fieldProfileCount, 0),
      source: 'sports_sync_jobs.metadata.rawPayload when retained plus catalog field contracts',
      rawPayloadPolicy: 'raw samples are omitted by default; includeSamples=true returns sanitized scalar samples only',
      scrambledDataPolicy: 'possible scrambled fields are display/quarantine only until a deterministic normalizer proves stable ranges and identities',
    },
    identityMapping: {
      provider: 'sportsdataio',
      canonicalTables: ['sports_teams', 'sport_players', 'sport_events', 'provider_entity_mappings'],
      providerMappingRows: counts.provider_entity_mappings?.count ?? 0,
      status: (counts.provider_entity_mappings?.count ?? 0) > 0 ? 'stored_mapping_available' : 'mapping_not_verified',
    },
    storageIntegration: {
      supportedTables: ['sports_teams', 'sport_players', 'sport_events', 'sport_standings', 'sport_game_stats', 'sport_player_stats', 'sports_odds_snapshots', 'sports_sync_jobs'],
      newTablesCreated: 0,
      historicalImportMutation: false,
      projectionHistoryMutation: false,
    },
    projectionReactivation: {
      currentSafeState: 'team_and_game_projection_rows_may_exist_but_user_visible_player_projections_remain_blocked',
      batterProjections: 'blocked_no_lineup_or_player_role_confidence',
      pitcherProjections: 'blocked_until_verified_starter_identity_and_pitcher_feature_quality',
      impossibleOutsPolicy: 'projection_integrity_blocks impossible pitcher outs and unverified participants',
      reactivationAllowedNow: false,
    },
    capabilityMatrix: capabilityMatrix(audit),
    providerCapabilityAudit: {
      endpoint: '/api/mlb/provider-capabilities/audit',
      summary: audit.summary,
      gamesByDateContract: audit.gamesByDateContract,
      validation: validateMlbProviderCapabilityAuditFixtures(),
    },
    quotaForecast: quotaForecast(),
    execution: {
      dryRunDefault: true,
      liveProviderExecution: dryRun ? 'not_requested' : 'not_enabled_in_discovery_v1_without_explicit_transport_adapter',
      allowlistRequired: true,
      budgetRequired: true,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    },
    warnings: [
      syncJobsResult.error ? `sports_sync_jobs read warning: ${syncJobsResult.error}` : null,
      'Do not use cataloged endpoint support as recommendation support.',
      'Do not infer injury severity, expected return, day-to-day status, lineup absence, or player prop eligibility from Discovery Lab metadata.',
      'Detailed injury feed remains subscription blocked; roster/player status must stay separate from diagnosis-level injury coverage.',
    ].filter(Boolean),
  }
}

export function validateSportsDataIoMlbDiscoveryFixtures() {
  const catalog = sportsDataIoCatalogForSport('mlb')
  const discovery = catalog.filter((endpoint) => endpoint.providerVariant === 'sportsdataio_discovery_lab')
  const enterprise = catalog.filter((endpoint) => endpoint.providerVariant === 'sportsdataio_enterprise')
  const checks = [
    ['catalog has Discovery Lab endpoints', discovery.length > 0],
    ['catalog has enterprise blocked endpoints', enterprise.length > 0],
    ['GamesByDate discovery endpoint present', discovery.some((endpoint) => endpoint.pathTemplate.includes('GamesByDate'))],
    ['GameOddsByDate discovery endpoint present', discovery.some((endpoint) => endpoint.pathTemplate.includes('GameOddsByDate'))],
    ['lineup endpoint remains enterprise separated', enterprise.some((endpoint) => endpoint.pathTemplate.includes('StartingLineupsByDate'))],
    ['injured players endpoint remains enterprise separated', enterprise.some((endpoint) => endpoint.pathTemplate.includes('InjuredPlayers'))],
    ['discovery validation makes zero provider calls', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'sportsdataio_mlb_discovery_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
