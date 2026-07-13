import { SportKey } from '@/config/sports.config'
import {
  EventStatus,
  MarketKey,
  NormalizedEvent,
  NormalizedOddsSnapshot,
  NormalizedOutcome,
  NormalizedParticipant,
} from '@/types/multi-sport'

type ProviderGame = Record<string, unknown>
type ProviderBookmaker = Record<string, unknown>
type ProviderMarket = Record<string, unknown>
type ProviderOutcome = Record<string, unknown>

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined
}

export function normalizeEventStatus(value: unknown): EventStatus {
  const status = stringValue(value).toLowerCase()

  if (['live', 'in_progress'].includes(status)) return 'live'
  if (['completed', 'complete', 'final', 'finished'].includes(status)) {
    return 'completed'
  }
  if (['postponed', 'delayed'].includes(status)) return 'postponed'
  if (['cancelled', 'canceled'].includes(status)) return 'cancelled'

  return 'scheduled'
}

export function normalizeStartTime(value: unknown) {
  const parsed = new Date(stringValue(value))

  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }

  return parsed.toISOString()
}

function participant({
  id,
  sportKey,
  leagueKey,
  name,
  type,
  provider,
}: {
  id: string
  sportKey: SportKey
  leagueKey?: string
  name: string
  type: 'team' | 'individual'
  provider: string
}): NormalizedParticipant {
  return {
    id,
    sportKey,
    leagueKey,
    displayName: name,
    type,
    providerIds: { [provider]: id },
    metadata: {},
  }
}

export function normalizeProviderEvent({
  sportKey,
  leagueKey,
  provider,
  raw,
  participantType,
}: {
  sportKey: SportKey
  leagueKey?: string
  provider: string
  raw: ProviderGame
  participantType: 'team' | 'individual'
}): NormalizedEvent {
  const id = stringValue(raw.id, `${provider}_${Date.now()}`)
  const homeName = stringValue(raw.home_team)
  const awayName = stringValue(raw.away_team)
  const startTime = normalizeStartTime(raw.commence_time ?? raw.start_time)

  const homeParticipant = homeName
    ? participant({
        id: `${id}:home`,
        sportKey,
        leagueKey,
        name: homeName,
        type: participantType,
        provider,
      })
    : undefined

  const awayParticipant = awayName
    ? participant({
        id: `${id}:away`,
        sportKey,
        leagueKey,
        name: awayName,
        type: participantType,
        provider,
      })
    : undefined

  const participants = [homeParticipant, awayParticipant].filter(
    Boolean
  ) as NormalizedParticipant[]

  return {
    id,
    sportKey,
    leagueKey,
    displayName:
      homeName && awayName
        ? `${awayName} @ ${homeName}`
        : stringValue(raw.title, id),
    startTime,
    status: normalizeEventStatus(raw.status),
    homeParticipant,
    awayParticipant,
    participants,
    venue: {
      displayName: stringValue(raw.venue) || undefined,
      city: stringValue(raw.city) || undefined,
      country: stringValue(raw.country) || undefined,
      neutralSite: Boolean(raw.is_neutral_site),
      metadata: {},
    },
    tournamentRound: stringValue(raw.round) || undefined,
    providerIds: { [provider]: id },
    rawProvider: provider,
    metadata: {
      sportTitle: raw.sport_title,
      rawStatus: raw.status,
    },
  }
}

function normalizeMarketKey(providerKey: string): MarketKey {
  if (providerKey === 'h2h') return 'moneyline'
  if (providerKey === 'spreads') return 'spread'
  if (providerKey === 'totals') return 'total'
  if (providerKey.includes('team_total')) return 'team_total'
  if (providerKey.includes('_h1')) return 'first_half'
  if (providerKey.includes('_q1')) return 'first_quarter'
  return 'game_props'
}

function normalizeOutcome(
  outcome: ProviderOutcome,
  index: number
): NormalizedOutcome {
  const label = stringValue(outcome.name, `Outcome ${index + 1}`)

  return {
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    label,
    price: numberValue(outcome.price),
    point: numberValue(outcome.point),
    metadata: {},
  }
}

export function normalizeOddsSnapshots({
  sportKey,
  eventId,
  provider,
  bookmakers,
}: {
  sportKey: SportKey
  eventId: string
  provider: string
  bookmakers: unknown
}): NormalizedOddsSnapshot[] {
  if (!Array.isArray(bookmakers)) return []

  return bookmakers.flatMap((bookmakerValue) => {
    const bookmaker = bookmakerValue as ProviderBookmaker
    const markets = Array.isArray(bookmaker.markets)
      ? bookmaker.markets
      : []
    const sportsbook = stringValue(bookmaker.title, 'Unknown Sportsbook')

    return markets.map((marketValue) => {
      const market = marketValue as ProviderMarket
      const marketKey = normalizeMarketKey(stringValue(market.key))
      const outcomes = Array.isArray(market.outcomes)
        ? market.outcomes.map((outcome, index) =>
            normalizeOutcome(outcome as ProviderOutcome, index)
          )
        : []

      return {
        id: `${eventId}:${sportsbook}:${marketKey}`,
        eventId,
        sportKey,
        provider,
        sportsbook,
        marketKey,
        lastUpdated: normalizeStartTime(
          market.last_update ?? bookmaker.last_update
        ),
        outcomes,
        metadata: {
          providerMarketKey: market.key,
        },
      }
    })
  })
}
