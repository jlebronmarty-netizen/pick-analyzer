import { SportKey } from '@/config/sports.config'
import { resolveMultiSportContext } from '@/services/multi-sport-resolution.service'
import {
  getSportRegistryDetail,
  getSportsRegistry,
} from '@/services/multi-sport-registry.service'
import { getMarketsForSport } from '@/services/multi-sport-markets.service'
import { getProvidersForSport } from '@/services/multi-sport-providers.service'
import {
  EventStatus,
  MultiSportQuery,
  NormalizedEvent,
} from '@/types/multi-sport'

const EVENT_STATUSES: EventStatus[] = [
  'scheduled',
  'live',
  'completed',
  'postponed',
  'cancelled',
]

export function parseMultiSportQuery(
  sportKey: SportKey,
  searchParams: URLSearchParams
): MultiSportQuery {
  const limit = Number(searchParams.get('limit') ?? 25)
  const page = Number(searchParams.get('page') ?? 1)
  const requestedStatus = searchParams.get('status') as EventStatus | null
  const status =
    requestedStatus && EVENT_STATUSES.includes(requestedStatus)
      ? requestedStatus
      : undefined

  return {
    sportKey,
    leagueKey: searchParams.get('league') ?? undefined,
    providerId: searchParams.get('provider') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    status,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 25,
    page: Number.isFinite(page) ? Math.max(page, 1) : 1,
  }
}

export function getMultiSportRegistry() {
  return {
    success: true,
    sports: getSportsRegistry(),
  }
}

export function getMultiSportDetail(sportKey: SportKey) {
  return {
    success: true,
    sport: getSportRegistryDetail(sportKey),
  }
}

export async function getMultiSportLeagues(sportKey: SportKey) {
  const context = resolveMultiSportContext({ sportKey })
  const result = await context.adapter.fetchLeagues()

  return {
    success: result.success,
    sport: context.sport,
    leagues: result.data,
    warnings: result.warnings,
    error: result.error,
  }
}

export async function getMultiSportEvents(query: MultiSportQuery) {
  const context = resolveMultiSportContext({
    sportKey: query.sportKey,
    leagueKey: query.leagueKey,
    providerId: query.providerId,
  })
  const result = await context.adapter.fetchSchedule(query)

  return {
    success: result.success,
    sport: context.sport,
    league: context.league,
    provider: context.provider,
    pagination: {
      page: query.page,
      limit: query.limit,
      count: result.data.length,
    },
    events: result.data,
    warnings: result.warnings,
    error: result.error,
  }
}

export async function getMultiSportEvent(
  sportKey: SportKey,
  eventId: string
) {
  const context = resolveMultiSportContext({ sportKey })
  const result = await context.adapter.fetchEvent(eventId)

  return {
    success: result.success,
    sport: context.sport,
    event: result.data,
    warnings: result.warnings,
    error: result.error,
  }
}

export async function getMultiSportParticipants(query: MultiSportQuery) {
  const context = resolveMultiSportContext({
    sportKey: query.sportKey,
    leagueKey: query.leagueKey,
  })
  const result = await context.adapter.fetchTeamsOrParticipants(query)

  return {
    success: result.success,
    sport: context.sport,
    participants: result.data,
    warnings: result.warnings,
    error: result.error,
  }
}

export async function getMultiSportOdds(query: MultiSportQuery) {
  const context = resolveMultiSportContext({
    sportKey: query.sportKey,
    leagueKey: query.leagueKey,
    providerId: query.providerId,
  })
  const result = await context.adapter.fetchOdds(query)

  return {
    success: result.success,
    sport: context.sport,
    odds: result.data,
    warnings: result.warnings,
    error: result.error,
  }
}

export async function getMultiSportStandings(query: MultiSportQuery) {
  const context = resolveMultiSportContext({
    sportKey: query.sportKey,
    leagueKey: query.leagueKey,
    providerId: query.providerId,
  })
  const result = await context.adapter.fetchStandings(query)

  return {
    success: result.success,
    sport: context.sport,
    league: context.league,
    standings: result.data,
    warnings: result.warnings,
    error: result.error,
  }
}

export async function getMultiSportStats(query: MultiSportQuery) {
  const context = resolveMultiSportContext({
    sportKey: query.sportKey,
    leagueKey: query.leagueKey,
    providerId: query.providerId,
  })
  const result = await context.adapter.fetchStats(query)

  return {
    success: result.success,
    sport: context.sport,
    league: context.league,
    stats: result.data,
    warnings: result.warnings,
    error: result.error,
  }
}

export async function getMultiSportInjuries(query: MultiSportQuery) {
  const context = resolveMultiSportContext({
    sportKey: query.sportKey,
    leagueKey: query.leagueKey,
    providerId: query.providerId,
  })
  const result = await context.adapter.fetchInjuries(query)

  return {
    success: result.success,
    sport: context.sport,
    league: context.league,
    injuries: result.data,
    warnings: result.warnings,
    error: result.error,
  }
}

export async function getMultiSportLineups(query: MultiSportQuery) {
  const context = resolveMultiSportContext({
    sportKey: query.sportKey,
    leagueKey: query.leagueKey,
    providerId: query.providerId,
  })
  const result = await context.adapter.fetchLineups(query)

  return {
    success: result.success,
    sport: context.sport,
    league: context.league,
    lineups: result.data,
    warnings: result.warnings,
    error: result.error,
  }
}

export function getMultiSportMarkets(sportKey: SportKey) {
  return {
    success: true,
    sportKey,
    markets: getMarketsForSport(sportKey),
  }
}

export function getMultiSportProviders(sportKey: SportKey) {
  return {
    success: true,
    sportKey,
    providers: getProvidersForSport(sportKey),
  }
}

export function getEmptyEventMessage(events: NormalizedEvent[]) {
  return events.length === 0
    ? 'No normalized events found for the selected filters or provider coverage.'
    : undefined
}
