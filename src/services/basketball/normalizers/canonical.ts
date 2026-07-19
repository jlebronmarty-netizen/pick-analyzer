import type { SportKey } from '@/config/sports.config'
import type { BasketballPlatformLeagueKey } from '@/services/basketball/contracts/capabilities'
import {
  basketballStableId,
  type BasketballCanonicalEntity,
  type BasketballGame,
  type BasketballProvenance,
  type BasketballTeam,
} from '@/services/basketball/types/entities'
import { evaluateBasketballDataQuality } from '@/services/basketball/validators/data-quality'

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

function isoValue(row: Record<string, unknown>, keys: string[]) {
  const value = stringValue(row, keys)
  const parsed = value ? new Date(value) : null
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : ''
}

function provenance({
  sourceId,
  connectorId,
  fetchedAt,
  confidence,
  providerId,
}: {
  sourceId: string
  connectorId: string
  fetchedAt: string
  confidence: number
  providerId: string | null
}): BasketballProvenance[] {
  return [{ sourceId, connectorId, providerId, fetchedAt, observedAt: null, confidence, rawHash: null }]
}

export function normalizeBasketballCanonicalRows({
  sportKey = 'basketball_bsn',
  leagueKey = 'bsn_pr',
  season = null,
  sourceId,
  connectorId,
  fetchedAt = new Date().toISOString(),
  rows,
}: {
  sportKey?: SportKey
  leagueKey?: BasketballPlatformLeagueKey
  season?: string | null
  sourceId: string
  connectorId: string
  fetchedAt?: string
  rows: Array<Record<string, unknown>>
}) {
  const entities = rows.map((row, index): BasketballCanonicalEntity => {
    const explicitKind = stringValue(row, ['kind', 'type', 'recordType']).toLowerCase()
    const providerId = stringValue(row, ['providerId', 'provider_id', 'id']) || null
    const teamName = stringValue(row, ['teamName', 'team_name', 'team', 'name'])
    const homeTeam = stringValue(row, ['homeTeam', 'home_team', 'home'])
    const awayTeam = stringValue(row, ['awayTeam', 'away_team', 'away'])
    const scheduledAt = isoValue(row, ['scheduledAt', 'startTime', 'start_time', 'date', 'gameDate'])
    const kind = explicitKind === 'team' || (!homeTeam && !awayTeam && teamName) ? 'team' : 'game'
    const base = {
      sportKey,
      leagueKey,
      season,
      version: 'basketball_canonical_entity_v1',
      provenance: provenance({ sourceId, connectorId, fetchedAt, confidence: 75, providerId }),
      quality: {
        completenessScore: 100,
        confidenceScore: 75,
        consistencyScore: 100,
        validationStatus: 'valid' as const,
        missingFields: [] as string[],
        warnings: [] as string[],
      },
    }

    if (kind === 'team') {
      const entity: BasketballTeam = {
        ...base,
        id: basketballStableId({ sportKey, leagueKey, kind: 'team', parts: [providerId, teamName || index] }),
        kind: 'team',
        name: teamName,
        abbreviation: stringValue(row, ['abbreviation', 'abbr']) || null,
        city: stringValue(row, ['city']) || null,
        country: stringValue(row, ['country']) || null,
      }
      entity.quality.missingFields = [
        entity.name ? null : 'name',
        entity.abbreviation ? null : 'abbreviation',
      ].filter(Boolean) as string[]
      entity.quality = evaluateBasketballDataQuality(entity)
      return entity
    }

    const homeTeamId = basketballStableId({ sportKey, leagueKey, kind: 'team', parts: [homeTeam] })
    const awayTeamId = basketballStableId({ sportKey, leagueKey, kind: 'team', parts: [awayTeam] })
    const entity: BasketballGame = {
      ...base,
      id: basketballStableId({ sportKey, leagueKey, kind: 'game', parts: [providerId, homeTeam, awayTeam, scheduledAt || index] }),
      kind: 'game',
      homeTeamId,
      awayTeamId,
      scheduledAt,
      status: (stringValue(row, ['status']) || 'unknown') as BasketballGame['status'],
      venueId: stringValue(row, ['venueId', 'venue_id']) || null,
      neutralSite: null,
      homeScore: numberValue(row, ['homeScore', 'home_score']),
      awayScore: numberValue(row, ['awayScore', 'away_score']),
    }
    entity.quality.missingFields = [
      homeTeam ? null : 'homeTeam',
      awayTeam ? null : 'awayTeam',
      scheduledAt ? null : 'scheduledAt',
    ].filter(Boolean) as string[]
    entity.quality = evaluateBasketballDataQuality(entity)
    return entity
  })

  return {
    success: true,
    mode: 'basketball_canonical_normalization_v1',
    providerCallsMade: 0,
    rowsReceived: rows.length,
    entitiesNormalized: entities.length,
    entities,
  }
}
