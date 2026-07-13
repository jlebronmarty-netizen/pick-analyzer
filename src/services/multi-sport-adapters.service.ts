import { SportDefinition, SportKey } from '@/config/sports.config'
import { getBsnGames, getBsnTeams } from '@/services/bsn.service'
import { getNbaAdapterStatus } from '@/services/nba-adapter.service'
import {
  normalizeOddsSnapshots,
  normalizeProviderEvent,
} from '@/services/multi-sport-normalizers.service'
import {
  AdapterHealth,
  AdapterResult,
  NormalizedEvent,
  NormalizedLeague,
  NormalizedOddsSnapshot,
  NormalizedParticipant,
  ProviderFeature,
} from '@/types/multi-sport'

export type MultiSportAdapterQuery = {
  leagueKey?: string
  dateFrom?: string
  dateTo?: string
  status?: string
  providerId?: string
  search?: string
  limit: number
  page: number
}

export interface SportAdapter {
  id: string
  sportKey: SportKey
  features: ProviderFeature[]
  fetchLeagues(): Promise<AdapterResult<NormalizedLeague[]>>
  fetchTeamsOrParticipants(
    query: MultiSportAdapterQuery
  ): Promise<AdapterResult<NormalizedParticipant[]>>
  fetchSchedule(
    query: MultiSportAdapterQuery
  ): Promise<AdapterResult<NormalizedEvent[]>>
  fetchEvent(eventId: string): Promise<AdapterResult<NormalizedEvent | null>>
  fetchStandings(
    query: MultiSportAdapterQuery
  ): Promise<AdapterResult<unknown[]>>
  fetchStats(query: MultiSportAdapterQuery): Promise<AdapterResult<unknown[]>>
  fetchInjuries(
    query: MultiSportAdapterQuery
  ): Promise<AdapterResult<unknown[]>>
  fetchLineups(
    query: MultiSportAdapterQuery
  ): Promise<AdapterResult<unknown[]>>
  fetchOdds(
    query: MultiSportAdapterQuery
  ): Promise<AdapterResult<NormalizedOddsSnapshot[]>>
  normalizeProviderData(data: unknown): AdapterResult<unknown>
  healthCheck(): Promise<AdapterHealth>
}

function elapsed(startedAt: number) {
  return Date.now() - startedAt
}

function ok<T>(source: string, startedAt: number, data: T): AdapterResult<T> {
  return {
    success: true,
    source,
    data,
    latencyMs: elapsed(startedAt),
    warnings: [],
  }
}

function unavailable<T>(
  source: string,
  startedAt: number,
  data: T,
  warning: string
): AdapterResult<T> {
  return {
    success: true,
    source,
    data,
    latencyMs: elapsed(startedAt),
    warnings: [warning],
  }
}

function failed<T>(
  source: string,
  startedAt: number,
  data: T,
  error: unknown
): AdapterResult<T> {
  return {
    success: false,
    source,
    data,
    latencyMs: elapsed(startedAt),
    warnings: [],
    error: error instanceof Error ? error.message : 'Unknown adapter error',
  }
}

async function fetchOddsApiGames(sportKey: SportKey) {
  const apiKey = process.env.ODDS_API_KEY

  if (!apiKey) {
    throw new Error('Missing ODDS_API_KEY')
  }

  const url = new URL(
    `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`
  )
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('regions', 'us')
  url.searchParams.set('markets', 'h2h,spreads,totals')
  url.searchParams.set('oddsFormat', 'american')

  const response = await fetch(url.toString(), {
    next: { revalidate: 60 },
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return (await response.json()) as Record<string, unknown>[]
}

function filterEvents(
  events: NormalizedEvent[],
  query: MultiSportAdapterQuery
) {
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null
  const dateTo = query.dateTo ? new Date(query.dateTo) : null
  const search = query.search?.trim().toLowerCase()

  return events.filter((event) => {
    const start = new Date(event.startTime)

    if (query.status && event.status !== query.status) return false
    if (dateFrom && start < dateFrom) return false
    if (dateTo && start > dateTo) return false
    if (
      search &&
      !event.displayName.toLowerCase().includes(search)
    ) {
      return false
    }

    return true
  })
}

function paginate<T>(items: T[], query: MultiSportAdapterQuery) {
  const page = Math.max(query.page, 1)
  const limit = Math.max(Math.min(query.limit, 100), 1)
  const start = (page - 1) * limit

  return items.slice(start, start + limit)
}

class OddsApiSportAdapter implements SportAdapter {
  id: string
  sportKey: SportKey
  features: ProviderFeature[] = ['schedule', 'event', 'odds', 'results']

  constructor(private sport: SportDefinition) {
    this.id = sport.adapterId
    this.sportKey = sport.key
  }

  async fetchLeagues() {
    const startedAt = Date.now()
    const { getLeaguesForSport } = await import(
      '@/services/multi-sport-registry.service'
    )

    return ok(this.id, startedAt, getLeaguesForSport(this.sportKey))
  }

  async fetchTeamsOrParticipants(query: MultiSportAdapterQuery) {
    const startedAt = Date.now()
    const schedule = await this.fetchSchedule(query)
    const unique = new Map<string, NormalizedParticipant>()

    for (const event of schedule.data) {
      for (const participant of event.participants) {
        unique.set(participant.displayName, participant)
      }
    }

    return ok(this.id, startedAt, Array.from(unique.values()))
  }

  async fetchSchedule(query: MultiSportAdapterQuery) {
    const startedAt = Date.now()

    try {
      const providerSportKey =
        typeof this.sport.metadata.providerSportKey === 'string'
          ? this.sport.metadata.providerSportKey
          : this.sport.key

      const games = await fetchOddsApiGames(providerSportKey as SportKey)
      const events = games.map((game) =>
        normalizeProviderEvent({
          sportKey: this.sportKey,
          leagueKey: query.leagueKey ?? this.sport.leagueKeys[0],
          provider: 'the-odds-api',
          raw: game,
          participantType: this.sport.format,
        })
      )

      return ok(this.id, startedAt, paginate(filterEvents(events, query), query))
    } catch (error) {
      return failed(this.id, startedAt, [], error)
    }
  }

  async fetchEvent(eventId: string) {
    const startedAt = Date.now()
    const schedule = await this.fetchSchedule({
      limit: 100,
      page: 1,
    })

    return ok(
      this.id,
      startedAt,
      schedule.data.find((event) => event.id === eventId) ?? null
    )
  }

  async fetchStandings() {
    const startedAt = Date.now()
    return unavailable(this.id, startedAt, [], 'Standings are not wired for this provider yet.')
  }

  async fetchStats() {
    const startedAt = Date.now()
    return unavailable(this.id, startedAt, [], 'Stats are handled by existing sport-specific services.')
  }

  async fetchInjuries() {
    const startedAt = Date.now()
    return unavailable(this.id, startedAt, [], 'Injuries are not supported by this adapter.')
  }

  async fetchLineups() {
    const startedAt = Date.now()
    return unavailable(this.id, startedAt, [], 'Lineups are not supported by this adapter.')
  }

  async fetchOdds(query: MultiSportAdapterQuery) {
    const startedAt = Date.now()

    try {
      const providerSportKey =
        typeof this.sport.metadata.providerSportKey === 'string'
          ? this.sport.metadata.providerSportKey
          : this.sport.key
      const games = await fetchOddsApiGames(providerSportKey as SportKey)
      const snapshots = games.flatMap((game) =>
        normalizeOddsSnapshots({
          sportKey: this.sportKey,
          eventId: String(game.id),
          provider: 'the-odds-api',
          bookmakers: game.bookmakers,
        })
      )

      return ok(this.id, startedAt, snapshots)
    } catch (error) {
      return failed(this.id, startedAt, [], error)
    }
  }

  normalizeProviderData(data: unknown) {
    return {
      success: true,
      source: this.id,
      data,
      latencyMs: 0,
      warnings: [],
    }
  }

  async healthCheck(): Promise<AdapterHealth> {
    const startedAt = Date.now()

    if (!process.env.ODDS_API_KEY) {
      return {
        adapterId: this.id,
        sportKey: this.sportKey,
        status: 'unavailable',
        latencyMs: elapsed(startedAt),
        lastFailure: new Date().toISOString(),
        errorMessage: 'Missing ODDS_API_KEY',
        coverage: this.features,
      }
    }

    return {
      adapterId: this.id,
      sportKey: this.sportKey,
      status: this.sport.productionReady ? 'healthy' : 'degraded',
      latencyMs: elapsed(startedAt),
      lastSuccess: new Date().toISOString(),
      coverage: this.features,
    }
  }
}

class BsnAdapter implements SportAdapter {
  id = 'bsn-adapter-wrapper'
  sportKey: SportKey = 'basketball_bsn'
  features: ProviderFeature[] = ['teams', 'schedule', 'event', 'results']

  async fetchLeagues() {
    const startedAt = Date.now()
    const { getLeaguesForSport } = await import(
      '@/services/multi-sport-registry.service'
    )
    return ok(this.id, startedAt, getLeaguesForSport(this.sportKey))
  }

  async fetchTeamsOrParticipants() {
    const startedAt = Date.now()

    try {
      const result = await getBsnTeams()
      const rows = Array.isArray(result.teams) ? result.teams : []

      return ok(
        this.id,
        startedAt,
        rows.map((row) => ({
          id: String(row.id ?? row.name),
          sportKey: this.sportKey,
          leagueKey: 'bsn_pr',
          displayName: String(row.name ?? row.team_name ?? 'Unknown Team'),
          type: 'team' as const,
          providerIds: { supabase: String(row.id ?? row.name) },
          metadata: row,
        }))
      )
    } catch (error) {
      return failed(this.id, startedAt, [], error)
    }
  }

  async fetchSchedule(query: MultiSportAdapterQuery) {
    const startedAt = Date.now()

    try {
      const result = await getBsnGames()
      const rows = Array.isArray(result.games) ? result.games : []
      const events = rows.map((row) =>
        normalizeProviderEvent({
          sportKey: this.sportKey,
          leagueKey: 'bsn_pr',
          provider: 'supabase-bsn',
          raw: row,
          participantType: 'team',
        })
      )

      return ok(this.id, startedAt, paginate(filterEvents(events, query), query))
    } catch (error) {
      return failed(this.id, startedAt, [], error)
    }
  }

  async fetchEvent(eventId: string) {
    const startedAt = Date.now()
    const schedule = await this.fetchSchedule({ limit: 100, page: 1 })

    return ok(
      this.id,
      startedAt,
      schedule.data.find((event) => event.id === eventId) ?? null
    )
  }

  async fetchStandings() {
    const startedAt = Date.now()
    return unavailable(this.id, startedAt, [], 'BSN standings are not stored in the current schema.')
  }

  async fetchStats() {
    const startedAt = Date.now()
    return unavailable(this.id, startedAt, [], 'BSN stats are consumed through prediction history today.')
  }

  async fetchInjuries() {
    const startedAt = Date.now()
    return unavailable(this.id, startedAt, [], 'BSN injuries are not available.')
  }

  async fetchLineups() {
    const startedAt = Date.now()
    return unavailable(this.id, startedAt, [], 'BSN lineups are not available.')
  }

  async fetchOdds() {
    const startedAt = Date.now()
    return unavailable(this.id, startedAt, [], 'BSN odds provider is not active.')
  }

  normalizeProviderData(data: unknown) {
    return ok(this.id, Date.now(), data)
  }

  async healthCheck(): Promise<AdapterHealth> {
    const startedAt = Date.now()

    try {
      await getBsnGames()

      return {
        adapterId: this.id,
        sportKey: this.sportKey,
        status: 'healthy',
        latencyMs: elapsed(startedAt),
        lastSuccess: new Date().toISOString(),
        coverage: this.features,
      }
    } catch (error) {
      return {
        adapterId: this.id,
        sportKey: this.sportKey,
        status: 'unavailable',
        latencyMs: elapsed(startedAt),
        lastFailure: new Date().toISOString(),
        errorMessage:
          error instanceof Error ? error.message : 'BSN adapter failed',
        coverage: this.features,
      }
    }
  }
}

class NbaAdapterWrapper extends OddsApiSportAdapter {
  id = 'nba-adapter-wrapper'

  async healthCheck(): Promise<AdapterHealth> {
    const startedAt = Date.now()

    try {
      const status = await getNbaAdapterStatus()
      const readiness = String(status.readiness.status)

      return {
        adapterId: this.id,
        sportKey: this.sportKey,
        status:
          readiness === 'PRODUCTION_READY'
            ? 'healthy'
            : readiness === 'NO_DATA'
              ? 'unavailable'
              : 'degraded',
        latencyMs: elapsed(startedAt),
        lastSuccess: new Date().toISOString(),
        coverage: this.features,
        errorMessage:
          readiness === 'PRODUCTION_READY'
            ? undefined
            : 'NBA adapter readiness is not production complete.',
      }
    } catch (error) {
      return {
        adapterId: this.id,
        sportKey: this.sportKey,
        status: 'unavailable',
        latencyMs: elapsed(startedAt),
        lastFailure: new Date().toISOString(),
        errorMessage:
          error instanceof Error ? error.message : 'NBA adapter failed',
        coverage: this.features,
      }
    }
  }
}

export function createSportAdapter(sport: SportDefinition): SportAdapter {
  if (sport.key === 'basketball_bsn') return new BsnAdapter()
  if (sport.key === 'basketball_nba') return new NbaAdapterWrapper(sport)

  return new OddsApiSportAdapter(sport)
}
