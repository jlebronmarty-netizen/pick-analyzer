import { SportKey } from '@/config/sports.config'
import { getMarketsForSport } from '@/services/multi-sport-markets.service'
import {
  getLeaguesForSport,
  getSportsRegistry,
} from '@/services/multi-sport-registry.service'
import {
  getProvidersForSport,
  getSportsProviders,
} from '@/services/multi-sport-providers.service'
import { MultiSportStatus, SportsProvider } from '@/types/multi-sport'

export type ProviderDataType =
  | 'schedules'
  | 'scores'
  | 'standings'
  | 'team_stats'
  | 'game_stats'
  | 'players'
  | 'injuries'
  | 'lineups'
  | 'odds'
  | 'historical_odds'
  | 'player_props'
  | 'play_by_play'
  | 'live_data'

export type CostTier = 'internal' | 'low' | 'medium' | 'high' | 'unknown'

type CapabilitySupport = 'supported' | 'partial' | 'unsupported'

export type ProviderCapability = {
  providerId: string
  providerName: string
  sportKey: SportKey
  leagueKey: string | null
  dataType: ProviderDataType
  market: string | null
  support: CapabilitySupport
  requiresAuth: boolean
  health: MultiSportStatus
  costTier: CostTier
  freshnessScore: number
  coverageScore: number
  reliabilityScore: number
  latencyScore: number
  totalScore: number
  warnings: string[]
}

type RouteRequest = {
  sportKey?: string | null
  leagueKey?: string | null
  dataType?: string | null
  market?: string | null
  providerId?: string | null
  dryRun?: boolean
}

const DATA_TYPES: ProviderDataType[] = [
  'schedules',
  'scores',
  'standings',
  'team_stats',
  'game_stats',
  'players',
  'injuries',
  'lineups',
  'odds',
  'historical_odds',
  'player_props',
  'play_by_play',
  'live_data',
]

const FEATURE_TO_DATA_TYPES: Record<string, ProviderDataType[]> = {
  leagues: [],
  teams: ['team_stats'],
  participants: ['players'],
  schedule: ['schedules'],
  event: ['schedules'],
  standings: ['standings'],
  stats: ['team_stats', 'game_stats'],
  injuries: ['injuries'],
  lineups: ['lineups'],
  odds: ['odds'],
  results: ['scores'],
}

const PARTIAL_PROVIDER_SUPPORT: Record<string, Partial<Record<ProviderDataType, string>>> = {
  'the-odds-api': {
    historical_odds:
      'Historical score/odds windows are limited and must be reconciled incrementally.',
    player_props:
      'Player props require explicit market availability and are not wired into prediction modules yet.',
    live_data:
      'Live data is provider-supported in some markets but disabled for autonomous modules.',
  },
  'api-sports': {
    players:
      'Provider can supply some player data, but project adapters are not generally wired.',
    injuries:
      'Provider may support injuries for selected leagues, but no production ingestion contract is approved.',
    lineups:
      'Provider may support lineups for selected leagues, but no production ingestion contract is approved.',
  },
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function isDataType(value: string | null | undefined): value is ProviderDataType {
  return DATA_TYPES.includes(value as ProviderDataType)
}

function providerCostTier(provider: SportsProvider): CostTier {
  if (provider.id.startsWith('supabase')) return 'internal'
  if (provider.id === 'the-odds-api') return 'medium'
  if (provider.id === 'api-sports') return 'medium'
  return 'unknown'
}

function statusScore(status: MultiSportStatus) {
  if (status === 'healthy') return 100
  if (status === 'degraded') return 65
  return 0
}

function latencyScore(provider: SportsProvider) {
  const latency = provider.responseLatencyMs
  if (!latency) return provider.health === 'unavailable' ? 0 : 70
  if (latency <= 250) return 100
  if (latency <= 750) return 80
  if (latency <= 1500) return 60
  return 35
}

function featureDataTypes(provider: SportsProvider) {
  const dataTypes = new Set<ProviderDataType>()

  for (const feature of provider.features) {
    for (const dataType of FEATURE_TO_DATA_TYPES[feature] ?? []) {
      dataTypes.add(dataType)
    }
  }

  return dataTypes
}

function supportFor({
  provider,
  sportKey,
  dataType,
  market,
}: {
  provider: SportsProvider
  sportKey: SportKey
  dataType: ProviderDataType
  market?: string | null
}): {
  support: CapabilitySupport
  warnings: string[]
} {
  const warnings: string[] = []

  if (!provider.sportCoverage.includes(sportKey)) {
    return {
      support: 'unsupported',
      warnings: [`${provider.name} does not list ${sportKey} coverage.`],
    }
  }

  const providerDataTypes = featureDataTypes(provider)
  const partialReason = PARTIAL_PROVIDER_SUPPORT[provider.id]?.[dataType]

  if (partialReason) {
    warnings.push(partialReason)
  }

  if (market && !getMarketsForSport(sportKey).some((item) => item.key === market)) {
    return {
      support: 'unsupported',
      warnings: [`${market} is not a normalized market for ${sportKey}.`],
    }
  }

  if (dataType === 'player_props' && market !== 'player_props') {
    return {
      support: 'partial',
      warnings: [
        'Player props require the player_props market and real player/provider contracts.',
      ],
    }
  }

  if (dataType === 'historical_odds') {
    if (providerDataTypes.has('odds')) {
      return {
        support: 'partial',
        warnings: warnings.length
          ? warnings
          : ['Historical odds require stored snapshots or capped provider backfill.'],
      }
    }
  }

  if (dataType === 'live_data') {
    if (providerDataTypes.has('odds')) {
      return {
        support: 'partial',
        warnings: warnings.length
          ? warnings
          : ['Live data is not enabled for autonomous execution.'],
      }
    }
  }

  if (providerDataTypes.has(dataType)) {
    return {
      support: partialReason ? 'partial' : 'supported',
      warnings,
    }
  }

  return {
    support: 'unsupported',
    warnings:
      warnings.length > 0
        ? warnings
        : [`${provider.name} does not advertise ${dataType} support.`],
  }
}

function buildCapability({
  provider,
  sportKey,
  leagueKey,
  dataType,
  market = null,
}: {
  provider: SportsProvider
  sportKey: SportKey
  leagueKey: string | null
  dataType: ProviderDataType
  market?: string | null
}): ProviderCapability {
  const support = supportFor({ provider, sportKey, dataType, market })
  const supportedWeight =
    support.support === 'supported' ? 1 : support.support === 'partial' ? 0.55 : 0
  const authPenalty = provider.requiresAuth && provider.health === 'unavailable' ? 25 : 0
  const coverageScore = round(
    (provider.sportCoverage.includes(sportKey) ? 100 : 0) * supportedWeight
  )
  const freshnessScore = round(
    (dataType === 'live_data' ? 55 : dataType === 'historical_odds' ? 65 : 80) *
      supportedWeight
  )
  const reliabilityScore = Math.max(
    0,
    round(statusScore(provider.health) * supportedWeight - authPenalty)
  )
  const latency = round(latencyScore(provider) * supportedWeight)
  const costTier = providerCostTier(provider)
  const costPenalty =
    costTier === 'internal'
      ? 0
      : costTier === 'low'
        ? 5
        : costTier === 'medium'
          ? 12
          : costTier === 'high'
            ? 22
            : 10

  return {
    providerId: provider.id,
    providerName: provider.name,
    sportKey,
    leagueKey,
    dataType,
    market,
    support: support.support,
    requiresAuth: provider.requiresAuth,
    health: provider.health,
    costTier,
    freshnessScore,
    coverageScore,
    reliabilityScore,
    latencyScore: latency,
    totalScore:
      support.support === 'unsupported'
        ? 0
        : round(
            Math.max(
              0,
              coverageScore * 0.3 +
                freshnessScore * 0.2 +
                reliabilityScore * 0.35 +
                latency * 0.15 -
                costPenalty
            )
          ),
    warnings: [
      ...support.warnings,
      ...(provider.lastError ? [provider.lastError] : []),
    ],
  }
}

function allCapabilities({
  sportKey,
  leagueKey,
  dataType,
  market,
}: {
  sportKey?: SportKey | null
  leagueKey?: string | null
  dataType?: ProviderDataType | null
  market?: string | null
}) {
  const sports = sportKey
    ? getSportsRegistry().filter((sport) => sport.key === sportKey)
    : getSportsRegistry()
  const capabilities: ProviderCapability[] = []

  for (const sport of sports) {
    const leagues = leagueKey
      ? getLeaguesForSport(sport.key).filter((league) => league.key === leagueKey)
      : getLeaguesForSport(sport.key)
    const leagueKeys = leagues.length ? leagues.map((league) => league.key) : [null]
    const dataTypes = dataType ? [dataType] : DATA_TYPES
    const markets =
      market || dataType === 'odds' || dataType === 'historical_odds'
        ? [market]
        : [null]

    for (const provider of getProvidersForSport(sport.key)) {
      for (const resolvedLeagueKey of leagueKeys) {
        for (const resolvedDataType of dataTypes) {
          for (const resolvedMarket of markets) {
            capabilities.push(
              buildCapability({
                provider,
                sportKey: sport.key,
                leagueKey: resolvedLeagueKey,
                dataType: resolvedDataType,
                market: resolvedMarket ?? null,
              })
            )
          }
        }
      }
    }
  }

  return capabilities
}

function statusFromCapabilities(capabilities: ProviderCapability[]) {
  if (capabilities.some((item) => item.support === 'supported' && item.health === 'healthy')) {
    return 'healthy'
  }

  if (capabilities.some((item) => item.support !== 'unsupported' && item.health !== 'unavailable')) {
    return 'degraded'
  }

  return 'unavailable'
}

export function getProviderCapabilityRegistry(filters: {
  sportKey?: SportKey | null
  leagueKey?: string | null
  dataType?: ProviderDataType | null
  market?: string | null
} = {}) {
  const capabilities = allCapabilities(filters)
  const supported = capabilities.filter((item) => item.support === 'supported')
  const partial = capabilities.filter((item) => item.support === 'partial')

  return {
    success: true,
    mode: 'provider_capability_registry_v1',
    generatedAt: new Date().toISOString(),
    filters,
    dataTypes: DATA_TYPES,
    summary: {
      capabilities: capabilities.length,
      supported: supported.length,
      partial: partial.length,
      unsupported: capabilities.length - supported.length - partial.length,
      providers: new Set(capabilities.map((item) => item.providerId)).size,
      sports: new Set(capabilities.map((item) => item.sportKey)).size,
    },
    capabilities,
  }
}

export function getProviderIntelligence() {
  const providers = getSportsProviders()
  const sports = getSportsRegistry()
  const capabilities = allCapabilities({})
  const providerSummaries = providers.map((provider) => {
    const providerCapabilities = capabilities.filter(
      (item) => item.providerId === provider.id
    )
    const usable = providerCapabilities.filter(
      (item) => item.support !== 'unsupported'
    )

    return {
      id: provider.id,
      name: provider.name,
      health: provider.health,
      costTier: providerCostTier(provider),
      requiresAuth: provider.requiresAuth,
      sportCoverage: provider.sportCoverage,
      features: provider.features,
      rateLimit: provider.rateLimit,
      averageScore: usable.length
        ? round(
            usable.reduce((sum, item) => sum + item.totalScore, 0) /
              usable.length
          )
        : 0,
      supportedCapabilities: providerCapabilities.filter(
        (item) => item.support === 'supported'
      ).length,
      partialCapabilities: providerCapabilities.filter(
        (item) => item.support === 'partial'
      ).length,
      unavailableReason: provider.lastError ?? null,
    }
  })

  return {
    success: true,
    mode: 'provider_intelligence_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'static_registry_and_environment_configuration',
    },
    status: statusFromCapabilities(capabilities),
    summary: {
      providers: providers.length,
      sports: sports.length,
      dataTypes: DATA_TYPES.length,
      capabilities: capabilities.length,
      healthyProviders: providers.filter((item) => item.health === 'healthy').length,
      degradedProviders: providers.filter((item) => item.health === 'degraded').length,
      unavailableProviders: providers.filter((item) => item.health === 'unavailable').length,
    },
    providers: providerSummaries,
    capabilitySummaryByDataType: DATA_TYPES.map((dataType) => {
      const rows = capabilities.filter((item) => item.dataType === dataType)
      return {
        dataType,
        supported: rows.filter((item) => item.support === 'supported').length,
        partial: rows.filter((item) => item.support === 'partial').length,
        unsupported: rows.filter((item) => item.support === 'unsupported').length,
        bestProvider:
          [...rows].sort((a, b) => b.totalScore - a.totalScore)[0] ?? null,
      }
    }),
  }
}

export function planProviderRoute(request: RouteRequest = {}) {
  const sportKey = request.sportKey as SportKey | undefined
  const dataType = request.dataType
  const invalid: string[] = []

  if (!sportKey || !getSportsRegistry().some((sport) => sport.key === sportKey)) {
    invalid.push('A supported sportKey is required.')
  }

  if (!isDataType(dataType)) {
    invalid.push(`dataType must be one of: ${DATA_TYPES.join(', ')}.`)
  }

  if (invalid.length > 0 || !sportKey || !isDataType(dataType)) {
    return {
      success: false,
      mode: 'provider_route_plan_v1',
      dryRun: request.dryRun ?? true,
      generatedAt: new Date().toISOString(),
      providerUsage: {
        externalProviderCallsMade: 0,
      },
      errors: invalid,
      selectedProvider: null,
      fallbackProviders: [],
      explanation: invalid,
    }
  }

  const capabilities = allCapabilities({
    sportKey,
    leagueKey: request.leagueKey ?? null,
    dataType,
    market: request.market ?? null,
  })
    .filter((item) => item.support !== 'unsupported')
    .filter((item) =>
      request.providerId ? item.providerId === request.providerId : true
    )
    .sort((a, b) => b.totalScore - a.totalScore)
  const selected = capabilities[0] ?? null
  const fallbacks = capabilities.slice(1, 4)

  return {
    success: true,
    mode: 'provider_route_plan_v1',
    dryRun: request.dryRun ?? true,
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
    },
    request: {
      sportKey,
      leagueKey: request.leagueKey ?? null,
      dataType,
      market: request.market ?? null,
      providerId: request.providerId ?? null,
    },
    status: selected ? selected.health : 'unavailable',
    supported: Boolean(selected),
    selectedProvider: selected,
    fallbackProviders: fallbacks,
    explanation: selected
      ? [
          `${selected.providerName} selected with score ${selected.totalScore}.`,
          `${selected.support} support for ${dataType} on ${sportKey}.`,
          `Health=${selected.health}, cost=${selected.costTier}, dryRun=true.`,
          ...selected.warnings,
        ]
      : [
          `No configured provider supports ${dataType} for ${sportKey} with the requested constraints.`,
        ],
  }
}

export function assertProviderCapability(request: RouteRequest) {
  const plan = planProviderRoute({ ...request, dryRun: true })

  if (!plan.success || !plan.supported) {
    return {
      allowed: false,
      plan,
      reason:
        plan.explanation[0] ??
        'No configured provider capability supports this operation.',
    }
  }

  return {
    allowed: true,
    plan,
    reason: 'Provider capability is available.',
  }
}
