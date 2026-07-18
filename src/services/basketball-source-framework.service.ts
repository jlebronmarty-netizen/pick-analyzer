import 'server-only'

import { SportKey } from '@/config/sports.config'
import { MarketKey } from '@/types/multi-sport'

export type BasketballLeagueKey = 'bsn_pr' | 'nba' | 'ncaa_mbb' | 'euroleague' | 'fiba' | 'wnba' | string
export type BasketballSourceType = 'official' | 'future_api' | 'csv_import' | 'manual_entry' | 'future_provider'
export type BasketballSourceStatus = 'ready' | 'partial' | 'blocked' | 'waiting' | 'unknown'
export type BasketballImportMode = 'validate' | 'dry_run' | 'import'
export type BasketballConnectorCapability =
  | 'teams'
  | 'schedule'
  | 'results'
  | 'standings'
  | 'players'
  | 'venues'
  | 'statistics'
  | 'quarter_scores'
  | 'first_half'
  | 'availability'
  | 'odds'
  | 'playoffs'
  | 'series'

export type BasketballSourceConnector = {
  id: string
  type: BasketballSourceType
  sportKey: SportKey
  leagueKey: BasketballLeagueKey
  displayName: string
  status: BasketballSourceStatus
  priority: number
  approvedForLiveImport: boolean
  approvedForProductionPredictions: boolean
  providerCallsRequired: boolean
  writePathEnabled: boolean
  capabilities: Record<BasketballConnectorCapability, BasketballSourceStatus>
  ttl: Partial<Record<BasketballConnectorCapability, string>>
  cost: string
  reliability: string
  legalAccess: string
  maintenanceBurden: string
  limitations: string[]
  evidence: string[]
}

export type BasketballNormalizedImportRecord = {
  id: string
  kind: 'team' | 'game' | 'result' | 'standing' | 'player' | 'venue' | 'team_stat' | 'odds'
  sportKey: SportKey
  leagueKey: BasketballLeagueKey
  sourceId: string
  providerId: string | null
  canonicalId: string
  normalized: Record<string, unknown>
  quality: {
    complete: boolean
    missingFields: string[]
    warnings: string[]
  }
}

const BSN_SPORT_KEY: SportKey = 'basketball_bsn'
const BSN_LEAGUE_KEY = 'bsn_pr'

const BASKETBALL_ABSTRACTIONS = [
  'quarter',
  'half',
  'pace',
  'possessions',
  'offensive_rating',
  'defensive_rating',
  'net_rating',
  'home_court',
  'travel',
  'rest',
  'back_to_back',
  'playoffs',
  'series',
  'momentum',
  'clutch',
  'overtime',
  'close_games',
  'pressure',
] as const

const TEAM_DNA_DOMAINS = [
  'identity',
  'offense',
  'defense',
  'pace',
  'home_court',
  'travel',
  'momentum',
  'recent_form',
  'clutch',
  'depth',
  'consistency',
  'playoff_performance',
  'series_performance',
] as const

const CORE_MARKETS: MarketKey[] = ['moneyline', 'spread', 'total', 'first_half']

function connector(
  input: Omit<BasketballSourceConnector, 'sportKey' | 'leagueKey'>
): BasketballSourceConnector {
  return {
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    ...input,
  }
}

const BSN_SOURCE_CONNECTORS: BasketballSourceConnector[] = [
  connector({
    id: 'official_bsn',
    type: 'official',
    displayName: 'Official BSN digital properties',
    status: 'partial',
    priority: 1,
    approvedForLiveImport: false,
    approvedForProductionPredictions: false,
    providerCallsRequired: false,
    writePathEnabled: false,
    capabilities: {
      teams: 'partial',
      schedule: 'partial',
      results: 'partial',
      standings: 'partial',
      players: 'partial',
      venues: 'partial',
      statistics: 'partial',
      quarter_scores: 'unknown',
      first_half: 'unknown',
      availability: 'blocked',
      odds: 'blocked',
      playoffs: 'partial',
      series: 'partial',
    },
    ttl: {
      teams: '90d',
      schedule: '12h',
      results: '5m_after_finals',
      standings: '30m',
      players: '7d',
      statistics: '30m',
      playoffs: '30m',
      series: '30m',
    },
    cost: 'free_public_surface',
    reliability: 'official_but_no_documented_api',
    legalAccess: 'terms_and_permission_review_required_before_automation',
    maintenanceBurden: 'medium_high_without_api_contract',
    limitations: [
      'No documented production API verified.',
      'Do not scrape aggressively or bypass access restrictions.',
      'Official data can inform connector shape but not production ingestion until approved.',
    ],
    evidence: [
      'Official BSN web pages expose schedule, results, standings, teams, players, leaders and statistics.',
      'Official app listings describe live games, real-time results/statistics, standings and individual leaders.',
    ],
  }),
  connector({
    id: 'bsn_csv_import',
    type: 'csv_import',
    displayName: 'BSN CSV Import',
    status: 'ready',
    priority: 2,
    approvedForLiveImport: false,
    approvedForProductionPredictions: false,
    providerCallsRequired: false,
    writePathEnabled: false,
    capabilities: {
      teams: 'ready',
      schedule: 'ready',
      results: 'ready',
      standings: 'ready',
      players: 'ready',
      venues: 'ready',
      statistics: 'ready',
      quarter_scores: 'ready',
      first_half: 'ready',
      availability: 'partial',
      odds: 'partial',
      playoffs: 'ready',
      series: 'ready',
    },
    ttl: {
      teams: 'manual_versioned',
      schedule: 'manual_versioned',
      results: 'manual_versioned',
      standings: 'manual_versioned',
      statistics: 'manual_versioned',
      odds: 'manual_versioned',
    },
    cost: 'operator_time',
    reliability: 'depends_on_source_file_lineage',
    legalAccess: 'requires_user_owned_or_permissioned_file',
    maintenanceBurden: 'medium',
    limitations: [
      'Current route validates and plans only; persistence stays disabled until audit-trail write approval.',
      'Odds rows remain informational until market source and timestamp lineage are present.',
    ],
    evidence: [
      'Shared normalized tables can store BSN teams, events, standings, players, game stats and odds.',
    ],
  }),
  connector({
    id: 'bsn_manual_entry',
    type: 'manual_entry',
    displayName: 'BSN Manual Entry',
    status: 'ready',
    priority: 3,
    approvedForLiveImport: false,
    approvedForProductionPredictions: false,
    providerCallsRequired: false,
    writePathEnabled: false,
    capabilities: {
      teams: 'ready',
      schedule: 'ready',
      results: 'ready',
      standings: 'partial',
      players: 'partial',
      venues: 'ready',
      statistics: 'partial',
      quarter_scores: 'partial',
      first_half: 'partial',
      availability: 'partial',
      odds: 'partial',
      playoffs: 'partial',
      series: 'partial',
    },
    ttl: {
      teams: 'operator_confirmed',
      schedule: 'operator_confirmed',
      results: 'operator_confirmed',
      odds: 'operator_confirmed',
    },
    cost: 'operator_time',
    reliability: 'high_when_double_entered_and_audited',
    legalAccess: 'operator_attested_source_required',
    maintenanceBurden: 'high',
    limitations: [
      'Manual entries require reason and idempotency key.',
      'Manual entries cannot silently overwrite existing records.',
      'Manual entries cannot mutate official picks or champion rows.',
    ],
    evidence: [
      'Existing BSN admin validation route already enforces dry-run-only guardrails.',
    ],
  }),
  connector({
    id: 'bsn_future_api',
    type: 'future_api',
    displayName: 'Future BSN API',
    status: 'waiting',
    priority: 4,
    approvedForLiveImport: false,
    approvedForProductionPredictions: false,
    providerCallsRequired: true,
    writePathEnabled: false,
    capabilities: {
      teams: 'unknown',
      schedule: 'unknown',
      results: 'unknown',
      standings: 'unknown',
      players: 'unknown',
      venues: 'unknown',
      statistics: 'unknown',
      quarter_scores: 'unknown',
      first_half: 'unknown',
      availability: 'unknown',
      odds: 'unknown',
      playoffs: 'unknown',
      series: 'unknown',
    },
    ttl: {},
    cost: 'unknown',
    reliability: 'unknown_until_contract_verified',
    legalAccess: 'provider_contract_required',
    maintenanceBurden: 'unknown',
    limitations: ['No API contract is configured.'],
    evidence: ['Reserved connector slot for a permissioned API.'],
  }),
  connector({
    id: 'bsn_future_provider',
    type: 'future_provider',
    displayName: 'Future Sports/Odds Provider',
    status: 'waiting',
    priority: 5,
    approvedForLiveImport: false,
    approvedForProductionPredictions: false,
    providerCallsRequired: true,
    writePathEnabled: false,
    capabilities: {
      teams: 'unknown',
      schedule: 'unknown',
      results: 'unknown',
      standings: 'unknown',
      players: 'unknown',
      venues: 'unknown',
      statistics: 'unknown',
      quarter_scores: 'unknown',
      first_half: 'unknown',
      availability: 'unknown',
      odds: 'unknown',
      playoffs: 'unknown',
      series: 'unknown',
    },
    ttl: {
      odds: '5m',
    },
    cost: 'subscription_dependent',
    reliability: 'unknown_for_bsn',
    legalAccess: 'subscription_and_terms_required',
    maintenanceBurden: 'low_after_contract',
    limitations: ['Do not assume BSN coverage exists until entitlement is verified.'],
    evidence: ['Provider Adapter SDK can host a future BSN provider without changing model consumers.'],
  }),
]

function slug(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function stringValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function numberValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const parsed = Number(row[key])
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function dateValue(row: Record<string, unknown>, keys: string[]) {
  const value = stringValue(row, keys)
  const parsed = value ? new Date(value) : null
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : ''
}

function sourceById(id: string) {
  return BSN_SOURCE_CONNECTORS.find((source) => source.id === id) ?? null
}

function classifyRawRow(row: Record<string, unknown>): BasketballNormalizedImportRecord['kind'] {
  const explicit = stringValue(row, ['kind', 'type', 'recordType']).toLowerCase()
  if (['team', 'game', 'result', 'standing', 'player', 'venue', 'team_stat', 'odds'].includes(explicit)) {
    return explicit as BasketballNormalizedImportRecord['kind']
  }
  if (stringValue(row, ['homeTeam', 'home_team', 'awayTeam', 'away_team'])) return 'game'
  if (numberValue(row, ['homeScore', 'home_score']) !== null || numberValue(row, ['awayScore', 'away_score']) !== null) return 'result'
  if (stringValue(row, ['team', 'teamName', 'name'])) return 'team'
  return 'game'
}

function requiredFields(kind: BasketballNormalizedImportRecord['kind']) {
  return {
    team: ['teamName'],
    game: ['homeTeam', 'awayTeam', 'startTime'],
    result: ['homeTeam', 'awayTeam', 'homeScore', 'awayScore'],
    standing: ['teamName'],
    player: ['playerName'],
    venue: ['venueName'],
    team_stat: ['teamName'],
    odds: ['eventId', 'market', 'selection', 'odds'],
  }[kind]
}

function normalizedFields(kind: BasketballNormalizedImportRecord['kind'], row: Record<string, unknown>) {
  const homeTeam = stringValue(row, ['homeTeam', 'home_team', 'home'])
  const awayTeam = stringValue(row, ['awayTeam', 'away_team', 'away'])
  const teamName = stringValue(row, ['teamName', 'team_name', 'team', 'name'])
  const playerName = stringValue(row, ['playerName', 'player_name', 'player', 'name'])
  const venueName = stringValue(row, ['venueName', 'venue_name', 'venue', 'arena'])
  const startTime = dateValue(row, ['startTime', 'start_time', 'date', 'gameDate'])
  const homeScore = numberValue(row, ['homeScore', 'home_score'])
  const awayScore = numberValue(row, ['awayScore', 'away_score'])
  const market = stringValue(row, ['market'])
  const selection = stringValue(row, ['selection', 'outcome'])
  const odds = numberValue(row, ['odds', 'price'])
  const quarterScores = stringValue(row, ['quarterScores', 'quarter_scores'])
  const firstHalfHome = numberValue(row, ['firstHalfHome', 'first_half_home'])
  const firstHalfAway = numberValue(row, ['firstHalfAway', 'first_half_away'])

  return {
    team: { teamName, abbreviation: stringValue(row, ['abbreviation', 'abbr']), city: stringValue(row, ['city']) },
    game: { homeTeam, awayTeam, startTime, venueName, status: stringValue(row, ['status']) || 'scheduled', playoffRound: stringValue(row, ['playoffRound', 'round']), seriesId: stringValue(row, ['seriesId', 'series_id']) },
    result: { homeTeam, awayTeam, startTime, homeScore, awayScore, quarterScores, firstHalfHome, firstHalfAway, status: 'completed' },
    standing: { teamName, wins: numberValue(row, ['wins', 'w']), losses: numberValue(row, ['losses', 'l']), group: stringValue(row, ['group', 'conference']) },
    player: { playerName, teamName, position: stringValue(row, ['position', 'pos']) },
    venue: { venueName, city: stringValue(row, ['city']), country: stringValue(row, ['country']) || 'Puerto Rico' },
    team_stat: { teamName, pace: numberValue(row, ['pace']), offensiveRating: numberValue(row, ['offensiveRating', 'off_rating']), defensiveRating: numberValue(row, ['defensiveRating', 'def_rating']), netRating: numberValue(row, ['netRating', 'net_rating']) },
    odds: { eventId: stringValue(row, ['eventId', 'event_id']), market, selection, odds, sportsbook: stringValue(row, ['sportsbook']), snapshotAt: dateValue(row, ['snapshotAt', 'snapshot_at']) },
  }[kind]
}

export function normalizeBasketballImportRows({
  sourceId = 'bsn_csv_import',
  rows = [],
}: {
  sourceId?: string | null
  rows?: Array<Record<string, unknown>> | null
}) {
  const safeSourceId = sourceId || 'bsn_csv_import'
  const safeRows = Array.isArray(rows) ? rows : []
  const normalized = safeRows.map((row, index): BasketballNormalizedImportRecord => {
    const kind = classifyRawRow(row)
    const fields = normalizedFields(kind, row)
    const required = requiredFields(kind)
    const aliases = {
      teamName: ['teamName', 'team_name', 'team', 'name'],
      playerName: ['playerName', 'player_name', 'player', 'name'],
      venueName: ['venueName', 'venue_name', 'venue', 'arena'],
      homeTeam: ['homeTeam', 'home_team', 'home'],
      awayTeam: ['awayTeam', 'away_team', 'away'],
      startTime: ['startTime', 'start_time', 'date', 'gameDate'],
      homeScore: ['homeScore', 'home_score'],
      awayScore: ['awayScore', 'away_score'],
      eventId: ['eventId', 'event_id'],
      market: ['market'],
      selection: ['selection', 'outcome'],
      odds: ['odds', 'price'],
    } as Record<string, string[]>
    const missingFields = required.filter((field) => {
      const keys = aliases[field] ?? [field]
      if (field === 'homeScore' || field === 'awayScore' || field === 'odds') return numberValue(row, keys) === null
      return !stringValue(row, keys)
    })
    const canonicalBasis = [
      kind,
      stringValue(row, ['id', 'providerId', 'provider_id']),
      stringValue(row, ['eventId', 'event_id']),
      stringValue(row, ['teamName', 'team_name', 'team', 'name']),
      stringValue(row, ['homeTeam', 'home_team', 'home']),
      stringValue(row, ['awayTeam', 'away_team', 'away']),
      stringValue(row, ['startTime', 'start_time', 'date', 'gameDate']),
      index,
    ].filter(Boolean).join(':')
    const canonicalId = `basketball_bsn:${BSN_LEAGUE_KEY}:${slug(canonicalBasis) || `row_${index + 1}`}`

    return {
      id: `${safeSourceId}:${index + 1}`,
      kind,
      sportKey: BSN_SPORT_KEY,
      leagueKey: BSN_LEAGUE_KEY,
      sourceId: safeSourceId,
      providerId: stringValue(row, ['providerId', 'provider_id', 'id']) || null,
      canonicalId,
      normalized: fields,
      quality: {
        complete: missingFields.length === 0,
        missingFields,
        warnings: [
          kind === 'odds' && !stringValue(row, ['snapshotAt', 'snapshot_at']) ? 'odds_snapshot_timestamp_missing' : null,
          kind === 'result' && !stringValue(row, ['quarterScores', 'quarter_scores']) ? 'quarter_scores_missing' : null,
        ].filter(Boolean) as string[],
      },
    }
  })
  const complete = normalized.filter((row) => row.quality.complete).length
  return {
    success: true,
    mode: 'basketball_import_normalization_v1',
    sourceId: safeSourceId,
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    providerCallsMade: 0,
    rowsReceived: safeRows.length,
    rowsNormalized: normalized.length,
    completeRows: complete,
    incompleteRows: normalized.length - complete,
    records: normalized,
  }
}

export function getBasketballSourceFramework({ sportKey = BSN_SPORT_KEY, leagueKey = BSN_LEAGUE_KEY }: { sportKey?: SportKey; leagueKey?: BasketballLeagueKey } = {}) {
  const connectors = sportKey === BSN_SPORT_KEY && leagueKey === BSN_LEAGUE_KEY ? BSN_SOURCE_CONNECTORS : []
  return {
    success: true,
    mode: 'basketball_source_framework_v1',
    generatedAt: new Date().toISOString(),
    sportKey,
    leagueKey,
    providerCallsMade: 0,
    blueprintFor: ['basketball_bsn', 'basketball_nba', 'basketball_ncaa', 'basketball_euroleague', 'basketball_fiba', 'basketball_wnba', 'future_basketball_leagues'],
    architecture: {
      platformConsumersDoNotKnowSource: true,
      normalizedTablesFirst: true,
      sourceLineageRequired: true,
      qualityAndFreshnessRequired: true,
      dryRunBeforeImportRequired: true,
      officialPicksRequireVerifiedOdds: true,
    },
    connectors,
    connectorTypes: ['official', 'future_api', 'csv_import', 'manual_entry', 'future_provider'] satisfies BasketballSourceType[],
    normalizedDomains: ['teams', 'games', 'schedule', 'results', 'standings', 'quarter_scores', 'first_half', 'statistics', 'venues', 'series', 'playoffs', 'players', 'availability', 'odds'],
    basketballAbstractions: BASKETBALL_ABSTRACTIONS,
    teamDnaDomains: TEAM_DNA_DOMAINS,
    supportedMarkets: CORE_MARKETS,
    guardrails: {
      noAggressiveScraping: true,
      noAccessRestrictionBypass: true,
      noFakeOdds: true,
      noFakeEv: true,
      noFakeOfficialPicks: true,
      noChampionMutation: true,
      noProviderCallsInValidation: true,
      importWritesDisabledUntilAuditApproved: true,
    },
  }
}

export function getBasketballSourceQualityReport({ sourceId = 'official_bsn' }: { sourceId?: string | null } = {}) {
  const framework = getBasketballSourceFramework()
  const selected = sourceById(sourceId ?? 'official_bsn') ?? BSN_SOURCE_CONNECTORS[0]
  const capabilities = Object.entries(selected.capabilities)
  const ready = capabilities.filter(([, status]) => status === 'ready').length
  const partial = capabilities.filter(([, status]) => status === 'partial').length
  const blocked = capabilities.filter(([, status]) => status === 'blocked').length
  const unknown = capabilities.filter(([, status]) => status === 'unknown' || status === 'waiting').length
  const score = Math.round(((ready * 1 + partial * 0.55) / Math.max(1, capabilities.length)) * 100)

  return {
    success: true,
    mode: 'basketball_source_quality_report_v1',
    generatedAt: new Date().toISOString(),
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    providerCallsMade: 0,
    source: selected,
    score,
    status: selected.approvedForLiveImport ? 'ready_for_dry_run_import' : selected.status === 'ready' ? 'validation_ready_write_blocked' : 'source_approval_required',
    capabilityCounts: { ready, partial, blocked, unknown, total: capabilities.length },
    ttl: selected.ttl,
    lineage: {
      sourceIdRequired: true,
      fetchedAtRequired: true,
      sourceDocumentUrlRequiredForManualOrCsv: true,
      operatorReasonRequiredForManual: true,
      providerMappingRequiredBeforePredictionUse: true,
    },
    frameworkGuardrails: framework.guardrails,
    limitations: selected.limitations,
  }
}

export function validateBasketballSourceInput(input: Record<string, unknown> = {}) {
  const sourceId = String(input.sourceId ?? input.source ?? 'bsn_csv_import')
  const mode = String(input.mode ?? 'validate') as BasketballImportMode
  const source = sourceById(sourceId)
  const rows = Array.isArray(input.rows) ? input.rows.filter((row) => row && typeof row === 'object') as Array<Record<string, unknown>> : []
  const errors = [
    !source ? 'unknown_source_id' : null,
    !['validate', 'dry_run', 'import'].includes(mode) ? 'unsupported_mode' : null,
    mode === 'import' ? 'import_writes_disabled_until_audit_trail_is_approved' : null,
    rows.length === 0 && (source?.type === 'csv_import' || source?.type === 'manual_entry') ? 'rows_required_for_csv_or_manual_validation' : null,
  ].filter(Boolean) as string[]
  const normalized = normalizeBasketballImportRows({ sourceId, rows })
  const rowErrors = normalized.records
    .filter((row) => !row.quality.complete)
    .map((row) => ({ id: row.id, kind: row.kind, missingFields: row.quality.missingFields }))

  return {
    success: errors.length === 0 && rowErrors.length === 0,
    mode: 'basketball_source_validation_v1',
    generatedAt: new Date().toISOString(),
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    sourceId,
    importMode: mode,
    providerCallsMade: 0,
    writesMade: 0,
    sourceStatus: source?.status ?? 'unknown',
    errors,
    rowErrors,
    warnings: [
      source && !source.approvedForProductionPredictions ? 'source_not_approved_for_production_predictions' : null,
      source && !source.writePathEnabled ? 'write_path_disabled' : null,
      rows.some((row) => classifyRawRow(row) === 'odds') ? 'odds_require_verified_market_source_before_ev_or_best_value' : null,
    ].filter(Boolean) as string[],
    normalized,
    acceptedForWrite: false,
    acceptedForPredictionUse: false,
    guardrails: {
      dryRunOnly: true,
      importRequiresConfirmedAuditTrail: true,
      noOfficialPickMutation: true,
      noChampionMutation: true,
    },
  }
}

export function planBasketballSourceImport(input: Record<string, unknown> = {}) {
  const validation = validateBasketballSourceInput(input)
  const source = sourceById(validation.sourceId)
  const normalized = validation.normalized
  const recordsByKind = normalized.records.reduce<Record<string, number>>((acc, row) => {
    acc[row.kind] = (acc[row.kind] ?? 0) + 1
    return acc
  }, {})

  return {
    success: true,
    mode: 'basketball_source_import_plan_v1',
    generatedAt: new Date().toISOString(),
    sportKey: BSN_SPORT_KEY,
    leagueKey: BSN_LEAGUE_KEY,
    sourceId: validation.sourceId,
    sourceType: source?.type ?? 'unknown',
    providerCallsPlanned: source?.providerCallsRequired ? 0 : 0,
    providerCallsMade: 0,
    writesPlanned: 0,
    writesMade: 0,
    importAllowed: false,
    validationPassed: validation.success,
    status: validation.success ? 'dry_run_plan_ready_write_blocked' : 'validation_failed',
    recordsByKind,
    targetTables: {
      team: 'sports_teams',
      game: 'sport_events',
      result: 'sport_events',
      standing: 'sport_standings',
      player: 'sport_players',
      venue: 'sport_events.venue',
      team_stat: 'sport_game_stats',
      odds: 'sports_odds_snapshots',
    },
    requiredApprovalsBeforeWrite: [
      'source_lineage_review',
      'audit_trail_write_path',
      'idempotency_key_policy',
      'provider_mapping_validation',
      'rollback_plan',
    ],
    currentBoardImpact: 'prepared_empty_until_normalized_events_odds_and_predictions_exist',
    officialPickImpact: 'none_official_picks_remain_blocked',
    validation,
  }
}

export function validateBasketballSourceFrameworkFixtures() {
  const good = validateBasketballSourceInput({
    sourceId: 'bsn_csv_import',
    mode: 'dry_run',
    rows: [
      { type: 'game', homeTeam: 'Criollos', awayTeam: 'Cangrejeros', startTime: '2026-07-18T20:00:00-04:00', venue: 'Coliseo Roger Mendoza' },
      { type: 'result', homeTeam: 'Criollos', awayTeam: 'Cangrejeros', homeScore: 95, awayScore: 78, quarterScores: '20-18,25-20,24-18,26-22' },
      { type: 'odds', eventId: 'fixture-game', market: 'moneyline', selection: 'Criollos', odds: -120, snapshotAt: '2026-07-18T12:00:00-04:00' },
    ],
  })
  const bad = validateBasketballSourceInput({ sourceId: 'bsn_csv_import', mode: 'dry_run', rows: [{ type: 'game', homeTeam: 'Criollos' }] })
  const importAttempt = validateBasketballSourceInput({ sourceId: 'bsn_manual_entry', mode: 'import', rows: [{ type: 'team', teamName: 'Criollos' }] })
  const framework = getBasketballSourceFramework()
  const quality = getBasketballSourceQualityReport({ sourceId: 'official_bsn' })
  const plan = planBasketballSourceImport({
    sourceId: 'bsn_csv_import',
    mode: 'dry_run',
    rows: [{ type: 'team', teamName: 'Criollos de Caguas' }],
  })
  const checks = [
    ['source connectors include official bsn', framework.connectors.some((item) => item.id === 'official_bsn')],
    ['csv source validates complete rows', good.success],
    ['incomplete row fails validation', !bad.success && bad.rowErrors.length === 1],
    ['import mode is blocked', !importAttempt.success && importAttempt.errors.includes('import_writes_disabled_until_audit_trail_is_approved')],
    ['official source is not production approved', quality.source.approvedForProductionPredictions === false],
    ['dry-run import plans no writes', plan.writesPlanned === 0 && plan.writesMade === 0],
    ['basketball abstractions are reusable', framework.basketballAbstractions.includes('possessions')],
    ['team dna includes series performance', framework.teamDnaDomains.includes('series_performance')],
    ['official picks remain blocked', plan.officialPickImpact === 'none_official_picks_remain_blocked'],
    ['provider calls remain zero', good.providerCallsMade === 0 && quality.providerCallsMade === 0 && plan.providerCallsMade === 0],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)

  return {
    success: failedChecks.length === 0,
    mode: 'basketball_source_framework_validation_v1',
    generatedAt: new Date().toISOString(),
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    writesMade: 0,
  }
}
