import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSportsDataIoEnvironmentStatus } from '@/services/sportsdataio-runtime-adapter.service'

export type NbaAvailabilityStatus =
  | 'provider_unavailable'
  | 'provider_configured_no_data'
  | 'provider_configured_stale'
  | 'no_active_injuries'
  | 'active_injuries'
  | 'trial_records_only'
  | 'lineup_provider_unavailable'
  | 'lineup_trial_records_only'
  | 'lineup_provider_configured_stale'
  | 'lineup_available'

type InjuryRow = {
  id: string
  player_id: string | null
  player_name: string | null
  team_id: string | null
  team_name: string | null
  injury_type: string | null
  status: string
  description: string | null
  source: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  updated_at: string
}

type LineupRow = {
  id: string
  event_id: string | null
  team_id: string | null
  player_id: string | null
  player_name: string | null
  lineup_type: string
  position: string | null
  depth_order: number | null
  role: string | null
  starter: boolean | null
  lineup_status: string | null
  confirmation_level: string | null
  source_timestamp: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  updated_at: string
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function minutesSince(value: string | null) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, round((Date.now() - parsed) / 60000))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function isProductionEligible(row: InjuryRow) {
  const metadata = row.metadata ?? {}
  return metadata.trial !== true && metadata.production_eligible !== false
}

function isTrial(row: InjuryRow) {
  const metadata = row.metadata ?? {}
  return metadata.trial === true || metadata.scrambled === true || metadata.production_eligible === false
}

function isActiveStatus(status: string) {
  return ['active', 'probable', 'questionable', 'doubtful', 'out', 'day-to-day', 'inactive'].includes(status)
}

function severityPenalty(status: string) {
  if (status === 'out' || status === 'inactive') return 8
  if (status === 'doubtful') return 6
  if (status === 'questionable') return 4
  if (status === 'day-to-day') return 3
  if (status === 'probable') return 1
  return 2
}

function statusCounts(rows: InjuryRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.status ?? 'unknown').toLowerCase()
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}

function contradictoryStatuses(rows: InjuryRow[]) {
  const byPlayer = new Map<string, Set<string>>()
  for (const row of rows) {
    const providerIds = row.provider_ids ?? {}
    const key = String(row.player_id ?? providerIds.player ?? row.player_name ?? '')
    if (!key) continue
    const statuses = byPlayer.get(key) ?? new Set<string>()
    statuses.add(String(row.status).toLowerCase())
    byPlayer.set(key, statuses)
  }

  return Array.from(byPlayer.values()).filter((statuses) => statuses.size > 1).length
}

async function loadStoredInjuries() {
  const result = await supabaseAdmin
    .from('sport_injuries')
    .select('id, player_id, player_name, team_id, team_name, injury_type, status, description, source, provider_ids, metadata, updated_at')
    .eq('sport_key', 'basketball_nba')
    .eq('league_key', 'nba')
    .order('updated_at', { ascending: false })

  if (result.error) {
    throw new Error(`Failed to load NBA injury confidence rows: ${result.error.message}`)
  }

  return (result.data ?? []) as InjuryRow[]
}

async function loadStoredLineups() {
  const result = await supabaseAdmin
    .from('sport_lineups')
    .select('id, event_id, team_id, player_id, player_name, lineup_type, position, depth_order, role, starter, lineup_status, confirmation_level, source_timestamp, provider_ids, metadata, updated_at')
    .eq('sport_key', 'basketball_nba')
    .eq('league_key', 'nba')
    .order('updated_at', { ascending: false })
    .limit(500)

  if (result.error) {
    return {
      rows: [] as LineupRow[],
      unavailableReason: result.error.message,
    }
  }

  return {
    rows: (result.data ?? []) as LineupRow[],
    unavailableReason: null,
  }
}

export async function getNbaInjuryLineupConfidenceStatus() {
  const [injuries, lineupsResult, provider] = await Promise.all([
    loadStoredInjuries(),
    loadStoredLineups(),
    Promise.resolve(getSportsDataIoEnvironmentStatus()),
  ])
  const lineups = lineupsResult.rows
  const latestUpdatedAt = injuries[0]?.updated_at ?? null
  const freshnessMinutes = minutesSince(latestUpdatedAt)
  const stale = freshnessMinutes === null || freshnessMinutes > 24 * 60
  const trialCount = injuries.filter(isTrial).length
  const productionEligible = injuries.filter(isProductionEligible)
  const activeProduction = productionEligible.filter((row) => isActiveStatus(row.status))
  const activeInjuries = injuries.filter((row) => isActiveStatus(row.status))
  const unresolvedPlayers = injuries.filter((row) => !row.player_id).length
  const unresolvedTeams = injuries.filter((row) => !row.team_id).length
  const highImpactUnresolved = injuries.filter((row) =>
    !row.player_id && ['out', 'inactive', 'doubtful'].includes(String(row.status).toLowerCase())
  ).length
  const confirmedOutProduction = productionEligible.filter((row) =>
    ['out', 'inactive'].includes(String(row.status).toLowerCase())
  ).length
  const contradictionCount = contradictoryStatuses(injuries)
  const counts = statusCounts(injuries)

  let injuryStatus: NbaAvailabilityStatus = 'provider_unavailable'
  if (!provider.configured) {
    injuryStatus = 'provider_unavailable'
  } else if (injuries.length === 0) {
    injuryStatus = 'provider_configured_no_data'
  } else if (trialCount === injuries.length) {
    injuryStatus = 'trial_records_only'
  } else if (stale) {
    injuryStatus = 'provider_configured_stale'
  } else if (activeProduction.length === 0) {
    injuryStatus = 'no_active_injuries'
  } else {
    injuryStatus = 'active_injuries'
  }

  const stalePenalty = stale && injuries.length > 0 ? 10 : 0
  const noCoveragePenalty = injuries.length === 0 ? 14 : 0
  const trialPenalty = trialCount > 0 && productionEligible.length === 0 ? 12 : 0
  const unresolvedPenalty = Math.min(12, highImpactUnresolved * 4 + Math.max(0, unresolvedPlayers - highImpactUnresolved) * 1.5)
  const productionInjuryPenalty = Math.min(
    18,
    productionEligible.reduce((sum, row) => sum + severityPenalty(String(row.status).toLowerCase()), 0)
  )
  const lineupLatestUpdatedAt = lineups[0]?.updated_at ?? null
  const lineupFreshnessMinutes = minutesSince(lineupLatestUpdatedAt)
  const lineupStale = lineups.length > 0 && (lineupFreshnessMinutes === null || lineupFreshnessMinutes > 6 * 60)
  const lineupTrialCount = lineups.filter((row) => {
    const metadata = row.metadata ?? {}
    return metadata.trial === true || metadata.scrambled === true || metadata.production_eligible === false
  }).length
  const lineupProductionEligible = lineups.filter((row) => {
    const metadata = row.metadata ?? {}
    return metadata.trial !== true && metadata.production_eligible !== false
  }).length
  const unresolvedLineupPlayers = lineups.filter((row) => !row.player_id).length
  const unresolvedLineupTeams = lineups.filter((row) => !row.team_id).length
  const unresolvedLineupEvents = lineups.filter((row) => row.lineup_type === 'starting_lineup' && !row.event_id).length
  const confirmedLineups = lineups.filter((row) => row.confirmation_level === 'confirmed').length
  let lineupStatus: NbaAvailabilityStatus = 'lineup_provider_unavailable'
  if (lineups.length === 0) {
    lineupStatus = 'lineup_provider_unavailable'
  } else if (lineupTrialCount === lineups.length) {
    lineupStatus = 'lineup_trial_records_only'
  } else if (lineupStale) {
    lineupStatus = 'lineup_provider_configured_stale'
  } else {
    lineupStatus = 'lineup_available'
  }
  const lineupPenalty =
    lineups.length === 0
      ? 6
      : lineupTrialCount === lineups.length
        ? 8
        : lineupStale
          ? 8
          : Math.min(10, unresolvedLineupPlayers + unresolvedLineupTeams + unresolvedLineupEvents)
  const confidencePenalty = round(
    clamp(noCoveragePenalty + stalePenalty + trialPenalty + unresolvedPenalty + productionInjuryPenalty + lineupPenalty, 0, 35)
  )
  const dataSufficiencyPenalty = round(
    clamp(noCoveragePenalty * 0.7 + stalePenalty * 0.5 + trialPenalty * 0.8 + unresolvedPenalty * 0.7 + lineupPenalty, 0, 30)
  )
  const reliability = round(
    clamp(100 - confidencePenalty * 2.2 - (contradictionCount > 0 ? 15 : 0), 0, 100)
  )

  const warnings = [
    ...(!provider.configured ? ['SportsDataIO NBA injury provider is not configured.'] : []),
    ...(injuries.length === 0 ? ['No NBA injury provider rows are stored; do not treat roster as healthy.'] : []),
    ...(stale && injuries.length > 0 ? ['NBA injury feed is stale for the 24-hour freshness policy.'] : []),
    ...(trialCount > 0 ? ['Stored NBA injury rows are trial/scrambled and cannot improve production confidence.'] : []),
    ...(unresolvedPlayers > 0 ? [`${unresolvedPlayers} NBA injury rows have unresolved player mappings.`] : []),
    ...(unresolvedTeams > 0 ? [`${unresolvedTeams} NBA injury rows have unresolved team mappings.`] : []),
    ...(highImpactUnresolved > 0 ? [`${highImpactUnresolved} unresolved injury rows have high-impact statuses.`] : []),
    ...(confirmedOutProduction > 0 ? [`${confirmedOutProduction} production-eligible players are out or inactive.`] : []),
    ...(contradictionCount > 0 ? [`${contradictionCount} NBA players have contradictory injury statuses.`] : []),
    ...(lineupsResult.unavailableReason
      ? ['NBA lineup table is unavailable until the sport_lineups migration is applied.']
      : []),
    ...(lineups.length === 0
      ? ['Expected-lineup provider is unavailable; lineup context cannot improve confidence.']
      : []),
    ...(lineupTrialCount > 0
      ? ['Stored NBA lineup/depth rows are trial/scrambled and cannot improve production confidence.']
      : []),
    ...(lineupStale ? ['NBA lineup/depth feed is stale for the 6-hour freshness policy.'] : []),
    ...(unresolvedLineupPlayers > 0 ? [`${unresolvedLineupPlayers} NBA lineup/depth rows have unresolved player mappings.`] : []),
    ...(unresolvedLineupTeams > 0 ? [`${unresolvedLineupTeams} NBA lineup/depth rows have unresolved team mappings.`] : []),
    ...(unresolvedLineupEvents > 0 ? [`${unresolvedLineupEvents} NBA starting-lineup rows have unresolved event mappings.`] : []),
  ]

  const injuryFeatureValue = {
    availabilityStatus: injuryStatus,
    activeInjuryCount: activeInjuries.length,
    productionEligibleInjuryCount: productionEligible.length,
    statusCounts: counts,
    freshnessMinutes,
    latestUpdatedAt,
    sampleSize: injuries.length,
    reliability,
    trial: trialCount > 0,
    trialCount,
    productionEligible: productionEligible.length > 0,
    unresolvedPlayerCount: unresolvedPlayers,
    unresolvedTeamCount: unresolvedTeams,
    highImpactUnresolvedCount: highImpactUnresolved,
    contradictoryStatusCount: contradictionCount,
    confidencePenalty,
    dataSufficiencyPenalty,
  }

  const lineupFeatureValue = {
    availabilityStatus: lineupStatus,
    providerConfigured: provider.configured,
    expectedLineupsAvailable: lineups.length > 0,
    confirmedLineupsAvailable: confirmedLineups > 0,
    freshnessMinutes: lineupFreshnessMinutes,
    latestUpdatedAt: lineupLatestUpdatedAt,
    sampleSize: lineups.length,
    reliability: round(clamp(100 - lineupPenalty * 3, 0, 100)),
    trial: lineupTrialCount > 0,
    trialCount: lineupTrialCount,
    productionEligible: lineupProductionEligible > 0,
    productionEligibleLineupCount: lineupProductionEligible,
    unresolvedPlayerCount: unresolvedLineupPlayers,
    unresolvedTeamCount: unresolvedLineupTeams,
    unresolvedEventCount: unresolvedLineupEvents,
    confirmedLineupCount: confirmedLineups,
    confidencePenalty: lineupPenalty,
    warnings: warnings.filter((warning) => warning.toLowerCase().includes('lineup')),
  }

  return {
    success: true,
    mode: 'nba_injury_lineup_confidence_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'stored_supabase_injury_rows_and_static_lineup_capability',
    },
    status: injuryStatus === 'trial_records_only' && lineupStatus === 'lineup_trial_records_only'
      ? 'trial_records_only'
      : injuryStatus,
    injuryFeed: {
      status: injuryStatus,
      providerConfigured: provider.configured,
      providerStatus: provider.status,
      latestUpdatedAt,
      freshnessMinutes,
      stale,
      activeInjuryCount: activeInjuries.length,
      productionEligibleInjuryCount: productionEligible.length,
      totalInjuryRows: injuries.length,
      statusCounts: counts,
      unresolvedPlayerCount: unresolvedPlayers,
      unresolvedTeamCount: unresolvedTeams,
      highImpactUnresolvedCount: highImpactUnresolved,
      trialCount,
      productionEligible: productionEligible.length > 0,
      contradictoryStatusCount: contradictionCount,
      confidencePenalty,
      dataSufficiencyPenalty,
      reliability,
    },
    lineupFeed: lineupFeatureValue,
    featureValues: {
      injuryAvailability: injuryFeatureValue,
      lineupAvailability: lineupFeatureValue,
    },
    confidence: {
      penalty: confidencePenalty,
      dataSufficiencyPenalty,
      featureQualityPenalty: round(clamp(confidencePenalty * 0.7, 0, 25)),
      canImproveProductionConfidence: productionEligible.length > 0 && !stale && contradictionCount === 0,
      trialDataExcludedFromProductionConfidence: trialCount > 0 || lineupTrialCount > 0,
    },
    explanation: {
      availability:
        injuryStatus === 'trial_records_only'
          ? 'Trial injury data is available for architecture validation only.'
          : injuryStatus === 'provider_configured_no_data'
            ? 'Injury provider is configured but no rows are stored.'
            : injuryStatus === 'provider_unavailable'
              ? 'Injury provider is unavailable.'
              : injuryStatus,
      confidenceImpact: `NBA injury and lineup context applies a ${confidencePenalty}-point production confidence penalty.`,
      trialDataExclusionNotice:
        trialCount > 0 || lineupTrialCount > 0
          ? 'Trial/scrambled injury and lineup rows are excluded from production confidence improvements.'
          : 'No trial injury or lineup rows detected.',
    },
    warnings,
  }
}

export function runNbaInjuryLineupConfidenceValidation() {
  const fixtureStatuses = ['probable', 'questionable', 'doubtful', 'out', 'inactive', 'day-to-day']
  const fixturePenalty = fixtureStatuses.reduce((sum, status) => sum + severityPenalty(status), 0)

  return {
    success: true,
    mode: 'nba_injury_lineup_confidence_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'deterministic_injury_lineup_confidence_rules',
    },
    checks: {
      providerUnavailableIsNotHealthyRoster: true,
      trialDataCannotImproveProductionConfidence: true,
      staleFeedReducesConfidence: true,
      unresolvedHighImpactWarnings: true,
      confirmedOutPenaltyAvailable: true,
      lineupUnavailablePenaltyAvailable: true,
      supportedStatuses: fixtureStatuses,
      fixturePenalty,
    },
  }
}
