import type { SportKey } from '@/config/sports.config'
import type { BasketballPlatformLeagueKey } from '@/services/basketball/contracts/capabilities'

export type BasketballCanonicalEntityKind =
  | 'team'
  | 'player'
  | 'game'
  | 'venue'
  | 'official'
  | 'standing'
  | 'game_stat'
  | 'player_game_stat'
  | 'quarter_score'
  | 'possession'
  | 'advanced_metric'

export type BasketballProvenance = {
  sourceId: string
  connectorId: string
  providerId: string | null
  fetchedAt: string
  observedAt: string | null
  confidence: number
  rawHash: string | null
}

export type BasketballQualityEnvelope = {
  completenessScore: number
  confidenceScore: number
  consistencyScore: number
  validationStatus: 'valid' | 'partial' | 'conflict' | 'invalid'
  missingFields: string[]
  warnings: string[]
}

export type BasketballCanonicalBase = {
  id: string
  kind: BasketballCanonicalEntityKind
  sportKey: SportKey
  leagueKey: BasketballPlatformLeagueKey
  season: string | null
  version: string
  provenance: BasketballProvenance[]
  quality: BasketballQualityEnvelope
}

export type BasketballTeam = BasketballCanonicalBase & {
  kind: 'team'
  name: string
  abbreviation: string | null
  city: string | null
  country: string | null
}

export type BasketballPlayer = BasketballCanonicalBase & {
  kind: 'player'
  teamId: string | null
  fullName: string
  position: string | null
  jersey: string | null
}

export type BasketballGame = BasketballCanonicalBase & {
  kind: 'game'
  homeTeamId: string
  awayTeamId: string
  scheduledAt: string
  status: 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'canceled' | 'unknown'
  venueId: string | null
  neutralSite: boolean | null
  homeScore: number | null
  awayScore: number | null
}

export type BasketballQuarterScore = BasketballCanonicalBase & {
  kind: 'quarter_score'
  gameId: string
  period: number
  homeScore: number | null
  awayScore: number | null
}

export type BasketballAdvancedMetric = BasketballCanonicalBase & {
  kind: 'advanced_metric'
  entityId: string
  entityKind: 'team' | 'player' | 'game'
  metrics: Record<string, number | null>
}

export type BasketballCanonicalEntity =
  | BasketballTeam
  | BasketballPlayer
  | BasketballGame
  | BasketballQuarterScore
  | BasketballAdvancedMetric

export function basketballStableId({
  sportKey,
  leagueKey,
  kind,
  parts,
}: {
  sportKey: SportKey
  leagueKey: BasketballPlatformLeagueKey
  kind: BasketballCanonicalEntityKind
  parts: Array<string | number | null | undefined>
}) {
  const stable = parts
    .map((part) => String(part ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(':')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9:]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return `${sportKey}:${leagueKey}:${kind}:${stable || 'unknown'}`
}
