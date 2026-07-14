import { SportKey } from '@/config/sports.config'
import { MarketKey } from '@/types/multi-sport'

export type FeatureValueType = 'number' | 'string' | 'boolean' | 'json'
export type FeatureSeverity = 'info' | 'warning' | 'error'

export type FeatureDefinition = {
  key: string
  displayName: string
  version: string
  sportKeys: SportKey[]
  markets: MarketKey[]
  valueType: FeatureValueType
  maxAgeMinutes: number
  required: boolean
  sourceTables: string[]
  description: string
  noLeakageRule: string
}

export type FeatureProvenance = {
  provider: string
  sourceTable: string
  sourceId: string
  observedAt: string
}

export type FeatureSnapshotValue = {
  key: string
  value: number | string | boolean | Record<string, unknown> | null
  definitionVersion: string
  computedAt: string
  freshnessMinutes: number
  qualityScore: number
  sampleSize: number
  provenance: FeatureProvenance[]
  warnings: string[]
}

export type FeatureSnapshot = {
  id: string
  sportKey: SportKey
  leagueKey: string | null
  eventId: string
  market: MarketKey
  generatedAt: string
  cutoffAt: string
  eventStartTime: string
  storeVersion: 'feature_store_core_v1'
  featureQualityScore: number
  dataSufficiencyScore: number
  noLeakage: boolean
  values: FeatureSnapshotValue[]
  invalidationKeys: string[]
  warnings: string[]
}

export type FeatureValidationIssue = {
  id: string
  severity: FeatureSeverity
  message: string
  recommendation: string
}

const STORE_VERSION = 'feature_store_core_v1' as const

const DEFINITIONS: FeatureDefinition[] = [
  {
    key: 'event_context',
    displayName: 'Event Context',
    version: '1.0.0',
    sportKeys: ['basketball_nba', 'baseball_mlb', 'americanfootball_nfl', 'icehockey_nhl', 'soccer', 'tennis', 'mma_ufc'],
    markets: ['moneyline', 'spread', 'total'],
    valueType: 'json',
    maxAgeMinutes: 24 * 60,
    required: true,
    sourceTables: ['sport_events'],
    description: 'Scheduled event identity, participants, venue and start time.',
    noLeakageRule: 'Event context must be captured before event start.',
  },
  {
    key: 'team_form',
    displayName: 'Team Form',
    version: '1.0.0',
    sportKeys: ['basketball_nba', 'baseball_mlb', 'americanfootball_nfl', 'icehockey_nhl', 'soccer'],
    markets: ['moneyline', 'spread', 'total'],
    valueType: 'json',
    maxAgeMinutes: 7 * 24 * 60,
    required: true,
    sourceTables: ['team_stats', 'sport_game_stats', 'sport_standings'],
    description: 'Recent performance, season performance and opponent-adjusted context.',
    noLeakageRule: 'Team-form rows must be observed before cutoff_at and before event start.',
  },
  {
    key: 'market_odds',
    displayName: 'Market Odds',
    version: '1.0.0',
    sportKeys: ['basketball_nba', 'baseball_mlb', 'americanfootball_nfl', 'icehockey_nhl', 'soccer', 'tennis', 'mma_ufc'],
    markets: ['moneyline', 'spread', 'total'],
    valueType: 'json',
    maxAgeMinutes: 120,
    required: true,
    sourceTables: ['sports_odds_snapshots'],
    description: 'Latest pre-event prices, lines and sportsbook provenance.',
    noLeakageRule: 'Odds snapshots must be timestamped at or before generated_at and before event start.',
  },
  {
    key: 'injury_context',
    displayName: 'Injury Context',
    version: '1.0.0',
    sportKeys: ['basketball_nba', 'americanfootball_nfl', 'baseball_mlb', 'icehockey_nhl'],
    markets: ['moneyline', 'spread', 'total'],
    valueType: 'json',
    maxAgeMinutes: 24 * 60,
    required: false,
    sourceTables: ['sport_injuries'],
    description: 'Provider-backed injury impact and freshness when available.',
    noLeakageRule: 'Injury reports must be observed before cutoff_at and before event start.',
  },
  {
    key: 'lineup_context',
    displayName: 'Lineup Context',
    version: '1.0.0',
    sportKeys: ['basketball_nba', 'baseball_mlb', 'americanfootball_nfl', 'icehockey_nhl', 'soccer'],
    markets: ['moneyline', 'spread', 'total'],
    valueType: 'json',
    maxAgeMinutes: 6 * 60,
    required: false,
    sourceTables: ['sport_players'],
    description: 'Expected or confirmed lineup state when a provider supplies it.',
    noLeakageRule: 'Lineups must be timestamped before cutoff_at; unavailable lineups return warnings.',
  },
  {
    key: 'player_stats_context',
    displayName: 'Player Stats Context',
    version: '1.0.0',
    sportKeys: ['basketball_nba', 'baseball_mlb', 'americanfootball_nfl', 'icehockey_nhl', 'soccer'],
    markets: ['moneyline', 'spread', 'total'],
    valueType: 'json',
    maxAgeMinutes: 24 * 60,
    required: false,
    sourceTables: ['sport_player_stats'],
    description: 'Player season and game stat coverage, mapping quality and production eligibility.',
    noLeakageRule: 'Player stat rows must be observed before cutoff_at; trial rows cannot improve production confidence.',
  },
]

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function dateMs(value: string) {
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function minutesBetween(a: string, b: string) {
  const first = dateMs(a)
  const second = dateMs(b)
  if (first === null || second === null) return 0
  return Math.max(0, round((second - first) / 60000))
}

function scoreAverage(values: number[]) {
  if (!values.length) return 0
  return round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function getFeatureDefinitions(filters: {
  sportKey?: SportKey | null
  market?: MarketKey | null
} = {}) {
  const definitions = DEFINITIONS.filter((definition) => {
    if (filters.sportKey && !definition.sportKeys.includes(filters.sportKey)) {
      return false
    }

    if (filters.market && !definition.markets.includes(filters.market)) {
      return false
    }

    return true
  })

  return {
    success: true,
    mode: 'feature_store_definitions_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'static_feature_definitions',
    },
    storeVersion: STORE_VERSION,
    summary: {
      definitions: definitions.length,
      required: definitions.filter((definition) => definition.required).length,
      optional: definitions.filter((definition) => !definition.required).length,
      sourceTables: new Set(definitions.flatMap((definition) => definition.sourceTables)).size,
    },
    definitions,
  }
}

export function createFeatureSnapshot({
  sportKey = 'basketball_nba',
  leagueKey = 'nba',
  eventId = 'feature_fixture_event',
  market = 'moneyline',
  generatedAt = '2026-01-01T12:00:00.000Z',
  cutoffAt = '2026-01-01T12:00:00.000Z',
  eventStartTime = '2026-01-01T20:00:00.000Z',
}: {
  sportKey?: SportKey
  leagueKey?: string | null
  eventId?: string
  market?: MarketKey
  generatedAt?: string
  cutoffAt?: string
  eventStartTime?: string
} = {}): FeatureSnapshot {
  const definitions = getFeatureDefinitions({ sportKey, market }).definitions
  const values = definitions.map((definition): FeatureSnapshotValue => {
    const observedAt =
      definition.key === 'market_odds'
        ? '2026-01-01T11:45:00.000Z'
        : '2026-01-01T10:00:00.000Z'
    const freshnessMinutes = minutesBetween(observedAt, generatedAt)
    const stale = freshnessMinutes > definition.maxAgeMinutes
    const unavailableOptional =
      !definition.required &&
      ['injury_context', 'lineup_context', 'player_stats_context'].includes(definition.key)

    return {
      key: definition.key,
      value: unavailableOptional
        ? null
        : {
            fixture: true,
            sportKey,
            eventId,
            market,
          },
      definitionVersion: definition.version,
      computedAt: generatedAt,
      freshnessMinutes,
      qualityScore: stale ? 40 : unavailableOptional ? 65 : 90,
      sampleSize: unavailableOptional ? 0 : 12,
      provenance: [
        {
          provider: unavailableOptional ? 'unavailable' : 'fixture-store',
          sourceTable: definition.sourceTables[0],
          sourceId: `${eventId}:${definition.key}`,
          observedAt,
        },
      ],
      warnings: [
        ...(stale ? [`${definition.key} is stale for its maxAge policy.`] : []),
        ...(unavailableOptional
          ? [`${definition.key} is optional and unavailable in fixture validation.`]
          : []),
      ],
    }
  })
  const required = values.filter((value) =>
    definitions.find((definition) => definition.key === value.key)?.required
  )
  const noLeakage = validateFeatureSnapshotLeakage({
    generatedAt,
    cutoffAt,
    eventStartTime,
    values,
  }).issues.every((issue) => issue.severity !== 'error')

  return {
    id: `${STORE_VERSION}:${sportKey}:${eventId}:${market}:${cutoffAt}`,
    sportKey,
    leagueKey,
    eventId,
    market,
    generatedAt,
    cutoffAt,
    eventStartTime,
    storeVersion: STORE_VERSION,
    featureQualityScore: scoreAverage(values.map((value) => value.qualityScore)),
    dataSufficiencyScore: scoreAverage(
      required.map((value) => (value.sampleSize > 0 ? value.qualityScore : 0))
    ),
    noLeakage,
    values,
    invalidationKeys: [
      `event:${eventId}`,
      `sport:${sportKey}`,
      `market:${market}`,
      ...definitions.flatMap((definition) =>
        definition.sourceTables.map((table) => `table:${table}`)
      ),
    ],
    warnings: values.flatMap((value) => value.warnings),
  }
}

export function validateFeatureSnapshotLeakage({
  generatedAt,
  cutoffAt,
  eventStartTime,
  values,
}: {
  generatedAt: string
  cutoffAt: string
  eventStartTime: string
  values: FeatureSnapshotValue[]
}) {
  const issues: FeatureValidationIssue[] = []
  const generated = dateMs(generatedAt)
  const cutoff = dateMs(cutoffAt)
  const eventStart = dateMs(eventStartTime)

  if (generated === null || cutoff === null || eventStart === null) {
    issues.push({
      id: 'invalid-timestamps',
      severity: 'error',
      message: 'Feature snapshot timestamps must be valid ISO dates.',
      recommendation: 'Use generated_at, cutoff_at and event start timestamps from normalized event context.',
    })
  }

  if (cutoff !== null && eventStart !== null && cutoff >= eventStart) {
    issues.push({
      id: 'cutoff-after-start',
      severity: 'error',
      message: 'cutoffAt must be before eventStartTime.',
      recommendation: 'Compute features from pre-event data only.',
    })
  }

  if (generated !== null && eventStart !== null && generated >= eventStart) {
    issues.push({
      id: 'generated-after-start',
      severity: 'error',
      message: 'generatedAt must be before eventStartTime.',
      recommendation: 'Do not generate pregame features after the event starts.',
    })
  }

  for (const value of values) {
    for (const provenance of value.provenance) {
      const observed = dateMs(provenance.observedAt)
      if (observed !== null && cutoff !== null && observed > cutoff) {
        issues.push({
          id: `future-provenance-${value.key}`,
          severity: 'error',
          message: `${value.key} provenance is after cutoffAt.`,
          recommendation: 'Exclude feature rows observed after cutoff_at.',
        })
      }
    }
  }

  return {
    valid: issues.every((issue) => issue.severity !== 'error'),
    issues,
  }
}

export function runFeatureStoreValidation() {
  const validSnapshot = createFeatureSnapshot()
  const leakageSnapshot = createFeatureSnapshot({
    eventId: 'feature_leakage_fixture',
    cutoffAt: '2026-01-01T21:00:00.000Z',
    eventStartTime: '2026-01-01T20:00:00.000Z',
  })
  const validCheck = validateFeatureSnapshotLeakage(validSnapshot)
  const leakageCheck = validateFeatureSnapshotLeakage(leakageSnapshot)

  return {
    success: validCheck.valid && !leakageCheck.valid,
    mode: 'feature_store_core_validation_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_feature_fixtures_only',
    },
    summary: {
      definitions: DEFINITIONS.length,
      snapshots: 2,
      validSnapshotIssues: validCheck.issues.length,
      leakageSnapshotIssues: leakageCheck.issues.length,
      detectedLeakage: !leakageCheck.valid,
    },
    validSnapshot,
    leakageSnapshot: {
      id: leakageSnapshot.id,
      noLeakage: leakageSnapshot.noLeakage,
      issues: leakageCheck.issues,
    },
  }
}

export function getFeatureStoreStatus() {
  const definitions = getFeatureDefinitions()
  const validation = runFeatureStoreValidation()
  const fixtureSnapshot = createFeatureSnapshot()

  return {
    success: true,
    mode: 'feature_store_core_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'definitions_and_local_feature_fixtures',
    },
    status: validation.success ? 'ready' : 'degraded',
    storeVersion: STORE_VERSION,
    summary: {
      definitions: definitions.summary.definitions,
      requiredDefinitions: definitions.summary.required,
      optionalDefinitions: definitions.summary.optional,
      featureQualityScore: fixtureSnapshot.featureQualityScore,
      dataSufficiencyScore: fixtureSnapshot.dataSufficiencyScore,
      noLeakage: fixtureSnapshot.noLeakage,
      validationPassed: validation.success,
    },
    capabilities: {
      preEventSnapshots: true,
      versionedDefinitions: true,
      freshnessPolicy: true,
      provenance: true,
      sampleSize: true,
      dataQuality: true,
      cutoffTimestamps: true,
      recomputationPlanning: true,
      invalidationKeys: true,
      durablePersistence: false,
    },
    definitions: definitions.definitions,
    sampleSnapshot: fixtureSnapshot,
    validation,
    warnings: [
      'Feature Store Core V1 is computed/contract-only and does not persist feature snapshots.',
      'Durable feature snapshot persistence requires a future additive migration and explicit approval.',
    ],
  }
}
