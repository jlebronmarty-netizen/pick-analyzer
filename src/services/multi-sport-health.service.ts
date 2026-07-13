import { getProvidersForSport } from '@/services/multi-sport-providers.service'
import { createSportAdapter } from '@/services/multi-sport-adapters.service'
import { getSportsRegistry } from '@/services/multi-sport-registry.service'
import { MultiSportStatus } from '@/types/multi-sport'

function combineStatus(statuses: MultiSportStatus[]): MultiSportStatus {
  if (statuses.every((status) => status === 'healthy')) return 'healthy'
  if (statuses.some((status) => status === 'healthy' || status === 'degraded')) {
    return 'degraded'
  }
  return 'unavailable'
}

export async function getMultiSportHealth() {
  const sports = getSportsRegistry()

  const coverage = await Promise.all(
    sports.map(async (sport) => {
      const adapter = createSportAdapter(sport)
      const adapterHealth = await adapter.healthCheck()
      const providers = getProvidersForSport(sport.key)
      const providerStatuses = providers.map((provider) => provider.health)
      const status = combineStatus([
        adapterHealth.status,
        ...providerStatuses,
      ])

      return {
        sportKey: sport.key,
        displayName: sport.label,
        status,
        adapter: adapterHealth,
        providers,
        markets: sport.supportedMarkets,
        productionReady: sport.productionReady,
      }
    })
  )

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    status: combineStatus(coverage.map((item) => item.status)),
    coverage,
  }
}
