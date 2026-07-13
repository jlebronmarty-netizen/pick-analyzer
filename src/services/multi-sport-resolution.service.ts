import { SportKey } from '@/config/sports.config'
import { createSportAdapter } from '@/services/multi-sport-adapters.service'
import { isMarketSupported } from '@/services/multi-sport-markets.service'
import { getProvidersForSport } from '@/services/multi-sport-providers.service'
import {
  requireSport,
  resolveLeague,
  resolveSport,
} from '@/services/multi-sport-registry.service'

export function resolveMultiSportContext({
  sportKey,
  leagueKey,
  marketKey,
  predictionType,
  providerId,
}: {
  sportKey: string
  leagueKey?: string | null
  marketKey?: string | null
  predictionType?: string | null
  providerId?: string | null
}) {
  const sport = requireSport(sportKey)
  const league = resolveLeague(sport.key, leagueKey)
  const providers = getProvidersForSport(sport.key)
  const provider = providerId
    ? providers.find((item) => item.id === providerId) ?? null
    : providers[0] ?? null
  const adapter = createSportAdapter(sport)

  return {
    sport,
    league,
    adapter,
    provider,
    providers,
    marketCompatible: marketKey
      ? isMarketSupported(sport.key, marketKey)
      : true,
    predictionCompatible: predictionType
      ? sport.supportedPredictionTypes.includes(predictionType)
      : true,
  }
}

export function isSportKey(value: string): value is SportKey {
  return Boolean(resolveSport(value))
}
