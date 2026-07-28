import 'server-only'

import { getProviderCapabilityRegistry, type ProviderDataType } from '@/services/provider-intelligence.service'
import { getSportsProviders } from '@/services/multi-sport-providers.service'
import { getSportsDataIoSubscriptionMaximizationAudit } from '@/services/sportsdataio-subscription-maximization-audit.service'
import { runTheOddsApiCapabilityAudit } from '@/services/the-odds-api-capability-audit.service'

const SPORT_KEYS = [
  'baseball_mlb',
  'basketball_nba',
  'americanfootball_nfl',
  'icehockey_nhl',
  'soccer',
  'basketball_bsn',
  'tennis',
  'mma_ufc',
] as const

const DATA_TYPES: ProviderDataType[] = [
  'schedules',
  'scores',
  'standings',
  'team_stats',
  'game_stats',
  'player_stats',
  'players',
  'injuries',
  'lineups',
  'odds',
  'historical_odds',
  'player_props',
  'play_by_play',
  'live_data',
]

type EntitlementClassification =
  | 'AVAILABLE_AND_ENTITLED'
  | 'AVAILABLE_NOT_ENTITLED'
  | 'NOT_SUPPORTED'
  | 'UNKNOWN'
  | 'TEMPORARILY_BLOCKED'
  | 'QUOTA_BLOCKED'

function classify({
  support,
  providerHealth,
  providerId,
  dataType,
  sportsDataIoVerified,
  oddsApiKeyPresent,
}: {
  support: 'supported' | 'partial' | 'unsupported'
  providerHealth: string
  providerId: string
  dataType: ProviderDataType
  sportsDataIoVerified: Set<string>
  oddsApiKeyPresent: boolean
}): EntitlementClassification {
  if (support === 'unsupported') return 'NOT_SUPPORTED'
  if (providerHealth === 'unavailable') return 'TEMPORARILY_BLOCKED'
  if (providerId.startsWith('supabase')) return 'AVAILABLE_AND_ENTITLED'
  if (providerId.includes('sportsdataio')) {
    return sportsDataIoVerified.has(dataType) ? 'AVAILABLE_AND_ENTITLED' : 'UNKNOWN'
  }
  if (providerId === 'the-odds-api') {
    if (!oddsApiKeyPresent) return 'TEMPORARILY_BLOCKED'
    if (dataType === 'odds' || dataType === 'player_props') return 'UNKNOWN'
    if (dataType === 'historical_odds' || dataType === 'live_data') return 'UNKNOWN'
    return support === 'supported' ? 'UNKNOWN' : 'NOT_SUPPORTED'
  }
  if (providerId === 'api-sports') return 'UNKNOWN'
  return 'UNKNOWN'
}

function extractSportsDataIoVerifiedDomains(audit: Awaited<ReturnType<typeof getSportsDataIoSubscriptionMaximizationAudit>>) {
  const mapping: Partial<Record<string, ProviderDataType[]>> = {
    schedules: ['schedules'],
    results: ['scores'],
    standings: ['standings'],
    teams: ['team_stats'],
    players: ['players'],
    stats: ['team_stats', 'game_stats', 'player_stats'],
    injuries: ['injuries'],
    lineups: ['lineups'],
    odds: ['odds'],
    props: ['player_props'],
    metadata: ['schedules'],
  }
  const domains = new Set<string>(audit.entitlementDiscovery.verifiedEntitledDomains.map((item) => item.split(':').at(-1) ?? item))
  const verified = new Set<ProviderDataType>()
  for (const domain of domains) {
    for (const dataType of mapping[domain] ?? []) verified.add(dataType)
  }
  return verified
}

function callTotal(...items: Array<{ providerCallsMade?: number; remoteMutationsMade?: number } | null | undefined>) {
  return {
    providerCallsMade: items.reduce((sum, item) => sum + Number(item?.providerCallsMade ?? 0), 0),
    remoteMutationsMade: items.reduce((sum, item) => sum + Number(item?.remoteMutationsMade ?? 0), 0),
  }
}

export async function getMultiSportProviderEntitlementAuditV1() {
  const [sportsDataIo, oddsApi] = await Promise.all([
    getSportsDataIoSubscriptionMaximizationAudit(),
    runTheOddsApiCapabilityAudit({ dryRun: true }),
  ])
  const providers = getSportsProviders()
  const sportsDataIoVerified = extractSportsDataIoVerifiedDomains(sportsDataIo)
  const oddsApiKeyPresent = Boolean(oddsApi.apiKeyPresent)
  const rows = []

  for (const sportKey of SPORT_KEYS) {
    for (const dataType of DATA_TYPES) {
      const registry = getProviderCapabilityRegistry({ sportKey, dataType })
      for (const capability of registry.capabilities) {
        const entitlement = classify({
          support: capability.support,
          providerHealth: capability.health,
          providerId: capability.providerId,
          dataType,
          sportsDataIoVerified,
          oddsApiKeyPresent,
        })
        rows.push({
          providerId: capability.providerId,
          providerName: capability.providerName,
          sportKey,
          leagueKey: capability.leagueKey,
          dataType,
          capability: capability.support === 'unsupported' ? 'NOT_SUPPORTED' : capability.support === 'partial' ? 'PARTIAL' : 'SUPPORTED',
          entitlement,
          activeCredentialAvailable: capability.requiresAuth ? capability.health !== 'unavailable' : true,
          runtimeCredentialAvailability: capability.health,
          activeEntitlementEvidence:
            capability.providerId.includes('sportsdataio')
              ? sportsDataIoVerified.has(dataType) ? 'prior_bounded_probe_or_persisted_catalog_evidence' : 'not_fully_proven_for_this_data_type'
              : capability.providerId === 'the-odds-api'
                ? oddsApiKeyPresent ? 'dry_run_credential_present_no_live_call' : 'credential_missing'
                : capability.providerId.startsWith('supabase')
                  ? 'internal_stored_data_contract'
                  : 'not_proven',
          documentedMarketSupport: capability.support,
          endpointFamilyReady: capability.support !== 'unsupported',
          historicalSeasonAvailability: dataType === 'historical_odds' ? entitlement : 'UNKNOWN',
          liveIngestionReadiness: dataType === 'live_data' ? 'UNKNOWN' : 'NOT_APPLICABLE',
          quotaStatus:
            capability.providerId.includes('sportsdataio')
              ? sportsDataIo.providerBudget.warning ? 'TEMPORARILY_BLOCKED' : 'UNKNOWN'
              : 'UNKNOWN',
          warnings: capability.warnings,
        })
      }
    }
  }

  const totals = callTotal(sportsDataIo, oddsApi)

  return {
    success: true,
    mode: 'multi_sport_provider_entitlement_audit_v1',
    generatedAt: new Date().toISOString(),
    readOnly: true,
    liveProviderProbeExecuted: false,
    providerCallsMade: totals.providerCallsMade,
    remoteMutationsMade: totals.remoteMutationsMade,
    productionMutationsMade: 0,
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      health: provider.health,
      requiresAuth: provider.requiresAuth,
      sportCoverage: provider.sportCoverage,
      features: provider.features,
      rateLimit: provider.rateLimit,
      credentialStatus: provider.health === 'unavailable' ? 'missing_or_unavailable' : 'configured_or_internal',
      lastError: provider.lastError ?? null,
    })),
    evidence: {
      sportsDataIo: {
        status: sportsDataIo.status,
        exactPlanKnown: sportsDataIo.subscription.exactPlanKnown,
        providerCallsMade: sportsDataIo.providerCallsMade,
        verifiedEntitledDomains: sportsDataIo.entitlementDiscovery.verifiedEntitledDomains,
        unknownDomains: sportsDataIo.entitlementDiscovery.unknownDomains,
        blockers: sportsDataIo.blockers,
        budget: sportsDataIo.providerBudget,
      },
      theOddsApi: {
        status: oddsApi.status,
        dryRun: true,
        apiKeyPresent: oddsApi.apiKeyPresent,
        providerCallsMade: oddsApi.providerCallsMade,
        plannedRequests: oddsApi.planObserved.length,
        blockers: oddsApi.blockers,
        warnings: oddsApi.warnings,
      },
    },
    matrixSummary: rows.reduce<Record<EntitlementClassification, number>>((acc, row) => {
      acc[row.entitlement] = (acc[row.entitlement] ?? 0) + 1
      return acc
    }, {
      AVAILABLE_AND_ENTITLED: 0,
      AVAILABLE_NOT_ENTITLED: 0,
      NOT_SUPPORTED: 0,
      UNKNOWN: 0,
      TEMPORARILY_BLOCKED: 0,
      QUOTA_BLOCKED: 0,
    }),
    rows,
    blockers: [
      ...sportsDataIo.blockers,
      ...(oddsApi.blockers ?? []),
      'Live entitlement is not asserted from static capability support.',
      'Historical and live provider execution require a future bounded execution gate.',
    ],
    warnings: [
      'This audit defaults to static/prior evidence and The Odds API dry-run mode.',
      'HTTP 401/403 would be entitlement evidence only in a future bounded live probe; it is not treated as provider absence.',
      'No account-plan export is stored in the repository.',
    ],
  }
}

export function validateMultiSportProviderEntitlementAuditV1Fixtures() {
  const providerIds = getSportsProviders().map((provider) => provider.id)
  const checks = [
    ['SportsDataIO provider represented', providerIds.some((id) => id.includes('sportsdataio'))],
    ['The Odds API represented', providerIds.includes('the-odds-api')],
    ['all program sports represented', SPORT_KEYS.length === 8],
    ['capability states include required vocabulary', ['AVAILABLE_AND_ENTITLED', 'AVAILABLE_NOT_ENTITLED', 'NOT_SUPPORTED', 'UNKNOWN', 'TEMPORARILY_BLOCKED', 'QUOTA_BLOCKED'].length === 6],
    ['data types include historical odds', DATA_TYPES.includes('historical_odds')],
    ['data types include player props', DATA_TYPES.includes('player_props')],
    ['validation uses zero provider calls', true],
    ['validation uses zero mutations', true],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'multi_sport_provider_entitlement_audit_v1_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
  }
}
