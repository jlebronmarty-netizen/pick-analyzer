import 'server-only'

import { getSportsDataIoRuntimeCapabilities } from '@/services/sportsdataio-runtime-adapter.service'

const NBA_SPORT_KEY = 'basketball_nba'
const NBA_LEAGUE_KEY = 'nba'
const PROVIDER = 'sportsdataio'
const IMPORT_MODULE = 'sportsdataio_nba_odds_readiness_v1'

type OddsEndpointReadiness = {
  feed: string
  dataType: 'odds' | 'historical_odds'
  exactPath: string | null
  status: 'blocked_pending_entitlement_confirmation'
  requiredParameters: string[]
  providerCallsMade: 0
  warning: string
}

type OddsFixtureRow = {
  id: string
  sport_key: typeof NBA_SPORT_KEY
  league_key: typeof NBA_LEAGUE_KEY
  season: string
  event_id: string
  provider: typeof PROVIDER
  sportsbook: string
  market: string
  outcome: string
  price: number | null
  line: number | null
  snapshot_time: string
  is_opening: boolean
  is_closing: boolean
  metadata: Record<string, unknown>
}

const ENDPOINTS: OddsEndpointReadiness[] = [
  {
    feed: 'gameOddsByDate',
    dataType: 'odds',
    exactPath: null,
    status: 'blocked_pending_entitlement_confirmation',
    requiredParameters: ['date or event identifier', 'market keys', 'sportsbook coverage'],
    providerCallsMade: 0,
    warning:
      'Exact authenticated SportsDataIO NBA game odds endpoint path and subscription entitlement are not confirmed in repository metadata.',
  },
  {
    feed: 'historicalGameOdds',
    dataType: 'historical_odds',
    exactPath: null,
    status: 'blocked_pending_entitlement_confirmation',
    requiredParameters: ['historical date window', 'market keys', 'sportsbook coverage', 'request cap'],
    providerCallsMade: 0,
    warning:
      'Historical odds have high quota risk and must remain blocked until exact path, entitlement and capped window are approved.',
  },
]

const FIXTURE = {
  GameID: 7001,
  Season: 2026,
  SportsBook: 'Fixture Book',
  Updated: '2026-01-02T00:00:00.000Z',
  markets: [
    {
      key: 'moneyline',
      outcomes: [
        { name: 'BOS', price: -120 },
        { name: 'NYK', price: 105 },
      ],
    },
    {
      key: 'spread',
      outcomes: [
        { name: 'BOS', price: -110, point: -2.5 },
        { name: 'NYK', price: -110, point: 2.5 },
      ],
    },
    {
      key: 'total',
      outcomes: [
        { name: 'Over', price: -108, point: 224.5 },
        { name: 'Under', price: -112, point: 224.5 },
      ],
    },
  ],
}

function generatedAt() {
  return new Date().toISOString()
}

function providerString(value: unknown) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function metadata(extra: Record<string, unknown>) {
  return {
    source: PROVIDER,
    importModule: IMPORT_MODULE,
    trial: true,
    scrambled: true,
    production_eligible: false,
    dataUse: 'provider_import_path_validation_only',
    predictionPersistenceEnabled: false,
    backtestingEnabled: false,
    modelTrainingEnabled: false,
    ...extra,
  }
}

function normalizeOddsFixture(raw: typeof FIXTURE): OddsFixtureRow[] {
  const providerEventId = providerString(raw.GameID) ?? 'unknown_event'
  const eventId = `${NBA_SPORT_KEY}:${NBA_LEAGUE_KEY}:sportsdataio:event:${providerEventId}`
  const season = providerString(raw.Season) ?? '2026'
  const sportsbook = providerString(raw.SportsBook) ?? 'Unknown Sportsbook'
  const snapshotTime = providerString(raw.Updated) ?? generatedAt()

  return raw.markets.flatMap((market) =>
    market.outcomes.map((outcome) => {
      const outcomeName = providerString(outcome.name) ?? 'unknown'
      return {
        id: `${NBA_SPORT_KEY}:${NBA_LEAGUE_KEY}:${PROVIDER}:odds:${providerEventId}:${slug(sportsbook)}:${market.key}:${slug(outcomeName)}:${snapshotTime}`,
        sport_key: NBA_SPORT_KEY,
        league_key: NBA_LEAGUE_KEY,
        season,
        event_id: eventId,
        provider: PROVIDER,
        sportsbook,
        market: market.key,
        outcome: outcomeName,
        price: numberValue(outcome.price),
        line: numberValue('point' in outcome ? outcome.point : null),
        snapshot_time: snapshotTime,
        is_opening: false,
        is_closing: false,
        metadata: metadata({
          providerEventId,
          providerMarketKey: market.key,
          endpointConfirmed: false,
          normalizedAt: generatedAt(),
        }),
      }
    })
  )
}

export function getSportsDataIoNbaOddsReadiness() {
  const capabilities = getSportsDataIoRuntimeCapabilities()
  const oddsDomain = capabilities.domains.find((domain) => domain.domain === 'odds') ?? null
  const historicalOddsDomain = capabilities.domains.find((domain) => domain.domain === 'historical_odds') ?? null
  const rows = normalizeOddsFixture(FIXTURE)
  const errors: string[] = []
  const warnings = ENDPOINTS.map((endpoint) => endpoint.warning)
  const markets = new Set(rows.map((row) => row.market))

  if (!oddsDomain) errors.push('SportsDataIO runtime capabilities do not expose odds domain.')
  if (!historicalOddsDomain) errors.push('SportsDataIO runtime capabilities do not expose historical_odds domain.')
  if (new Set(rows.map((row) => row.id)).size !== rows.length) errors.push('Odds fixture IDs are not unique.')
  if (!['moneyline', 'spread', 'total'].every((market) => markets.has(market))) {
    errors.push('Odds fixture must cover moneyline, spread and total market shapes.')
  }
  if (rows.some((row) => row.metadata.production_eligible !== false)) {
    errors.push('Odds fixture rows must remain production_eligible=false.')
  }
  if (rows.some((row) => !row.event_id || !row.sportsbook || !row.market || !row.outcome || !row.snapshot_time)) {
    errors.push('Odds fixture rows must preserve event, sportsbook, market, outcome and timestamp fields.')
  }
  if (rows.some((row) => row.price === null || row.price === 0)) {
    errors.push('Odds fixture rows must preserve nonzero American prices.')
  }

  return {
    success: errors.length === 0,
    mode: 'sportsdataio_nba_odds_readiness_v1',
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_contract_and_fixture_validation_only',
    },
    status: 'blocked_pending_entitlement_confirmation',
    endpoints: ENDPOINTS,
    migration: {
      required: false,
      created: null,
      appliedAutomatically: false,
      destinationTable: 'sports_odds_snapshots',
      rationale: 'Existing NBA data sync migration already defines sports_odds_snapshots for odds outcome rows.',
    },
    endpointPreflight: {
      noProviderCallsRequired: true,
      exactPathsConfirmed: false,
      entitlementConfirmed: false,
      sportsbookCoverageConfirmed: false,
      historicalWindowsApproved: false,
      requiredConfirmations: [
        'Exact authenticated SportsDataIO NBA current odds endpoint path.',
        'Exact authenticated SportsDataIO NBA historical odds endpoint path, if separate.',
        'Supported market keys for moneyline, spread and total.',
        'Sportsbook/bookmaker identifiers and coverage expectations.',
        'Historical odds date-window limits and expected quota cost.',
        'Provider response timestamp semantics for snapshot_time, opening and closing flags.',
      ],
      cappedPilotRequirements: {
        maximumRequests: 2,
        concurrency: 1,
        automaticRetries: false,
        dryRunDefault: true,
        trial: true,
        scrambled: true,
        productionEligible: false,
        stopOnNon200: true,
      },
      goNoGoGates: [
        'Do not call SportsDataIO odds endpoints until exact paths and entitlement are confirmed.',
        'Do not request historical odds without a separately approved date window and request cap.',
        'Do not persist production-eligible odds from trial/scrambled responses.',
        'Do not enable CLV, backtesting, model training or production predictions from trial odds.',
        'Do not run parallel provider requests during the first capped odds pilot.',
      ],
    },
    persistence: {
      destinationTables: ['sports_odds_snapshots', 'sports_sync_jobs'],
      naturalKeys: ['sport_key', 'event_id', 'provider', 'sportsbook', 'market', 'outcome', 'snapshot_time'],
      conflictTargets: ['sports_odds_snapshots.id'],
      dependencyOrder: ['teams', 'events', 'odds', 'historical_odds only after capped approval'],
    },
    normalizedFixtures: {
      rows,
      counts: {
        providerRecordsFetched: 1,
        normalizedRowsProduced: rows.length,
        recordsSkipped: 0,
      },
    },
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
      checks: {
        exactEndpointPathsConfirmed: false,
        entitlementConfirmed: false,
        historicalOddsApproved: false,
        noProviderCalls: true,
        deterministicIds: rows.every((row) => Boolean(row.id)),
        coreMarketsCovered: ['moneyline', 'spread', 'total'].every((market) => markets.has(market)),
        trialIsolationPreserved: rows.every(
          (row) =>
            row.metadata.trial === true &&
            row.metadata.scrambled === true &&
            row.metadata.production_eligible === false
        ),
        productionPredictionUseEnabled: false,
      },
    },
    confidenceIntegration: {
      trialDataMayValidateArchitecture: true,
      canImproveProductionConfidence: false,
      predictionPersistenceEnabled: false,
      backtestingEnabled: false,
      modelTrainingEnabled: false,
      clvEnabled: false,
    },
    noSecretExposure: true,
  }
}
