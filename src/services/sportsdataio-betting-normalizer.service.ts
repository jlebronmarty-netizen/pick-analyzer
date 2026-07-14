import 'server-only'

import { idempotencyKey } from '@/services/sync-reliability.service'

export type SportsDataIoBettingClassificationStatus =
  | 'DISCOVERY_ONLY'
  | 'MARKET_INDEX_AVAILABLE'
  | 'PRICED_OUTCOMES_AVAILABLE'
  | 'ARCHIVE_REQUIRED'
  | 'ENTITLEMENT_BLOCKED'
  | 'EMPTY_VALID_RESPONSE'
  | 'UNSUPPORTED_SCHEMA'

export type SportsDataIoBettingRouteKind =
  | 'current_feed'
  | 'recent_historical_line_movement'
  | 'archive_required'
  | 'trial_scrambled'
  | 'production_feed'

export type SportsDataIoBettingCounters = {
  providerRecordsFetched: number
  eventsDiscovered: number
  marketsDiscovered: number
  outcomesDiscovered: number
  pricedOutcomes: number
  sportsbooksDiscovered: number
  normalizedSnapshots: number
  archiveRequired: boolean
}

export type SportsDataIoBettingDiscovery = {
  providerEventIds: string[]
  providerGameIds: string[]
  providerMarketIds: string[]
  providerOutcomeIds: string[]
  providerSportsbookIds: string[]
  marketLikePaths: string[]
  outcomeLikePaths: string[]
  sportsbookLikePaths: string[]
}

export type SportsDataIoBettingClassification = {
  status: SportsDataIoBettingClassificationStatus
  selectedProviderEventId: string | null
  requiresMarketDetail: boolean
  canPersistSnapshotsDirectly: boolean
  reason: string
  discovery: SportsDataIoBettingDiscovery
  counters: SportsDataIoBettingCounters
}

export type SportsDataIoBettingRoutingDecision = {
  routeKind: SportsDataIoBettingRouteKind
  archiveRequired: boolean
  canUseCurrentEndpoint: boolean
  reason: string
}

export type SportsDataIoNormalizedBettingOutcome = {
  id: string
  providerSport: string
  providerEventId: string | null
  providerGameId: string | null
  providerMarketId: string | null
  providerOutcomeId: string | null
  providerSportsbookId: string | null
  sportsbookName: string | null
  marketTypeId: string | null
  marketTypeName: string | null
  betTypeId: string | null
  betTypeName: string | null
  periodTypeId: string | null
  periodTypeName: string | null
  outcomeTypeId: string | null
  outcomeTypeName: string | null
  resultTypeId: string | null
  resultTypeName: string | null
  providerPlayerId: string | null
  providerTeamId: string | null
  selection: string | null
  line: number | null
  americanPrice: number | null
  decimalPrice: number | null
  impliedProbability: number | null
  consensus: boolean
  createdAt: string | null
  updatedAt: string | null
  listed: boolean | null
  live: boolean
  alternate: boolean
  trial: boolean
  scrambled: boolean
  productionEligible: boolean
  sourcePath: string
  metadata: Record<string, unknown>
}

const EVENT_ID_KEYS = ['BettingEventID', 'BettingEventId']
const GAME_ID_KEYS = ['GameID', 'GameId', 'ScoreID', 'ScoreId', 'GlobalGameID', 'GlobalGameId']
const MARKET_ID_KEYS = ['BettingMarketID', 'BettingMarketId', 'MarketID', 'MarketId']
const OUTCOME_ID_KEYS = ['BettingOutcomeID', 'BettingOutcomeId', 'OutcomeID', 'OutcomeId']
const SPORTSBOOK_ID_KEYS = ['SportsbookID', 'SportsBookID', 'SportsbookId', 'SportsBookId', 'BookID', 'BookId']
const SPORTSBOOK_NAME_KEYS = ['Sportsbook', 'SportsBook', 'SportsbookName', 'BookName']
const MARKET_TYPE_ID_KEYS = ['BettingMarketTypeID', 'BettingMarketTypeId', 'MarketTypeID', 'MarketTypeId']
const MARKET_TYPE_NAME_KEYS = ['BettingMarketType', 'MarketType', 'MarketName']
const BET_TYPE_ID_KEYS = ['BettingBetTypeID', 'BettingBetTypeId', 'BetTypeID', 'BetTypeId']
const BET_TYPE_NAME_KEYS = ['BettingBetType', 'BetType']
const PERIOD_TYPE_ID_KEYS = ['BettingPeriodTypeID', 'BettingPeriodTypeId', 'PeriodTypeID', 'PeriodTypeId']
const PERIOD_TYPE_NAME_KEYS = ['BettingPeriodType', 'PeriodType', 'Period']
const OUTCOME_TYPE_ID_KEYS = ['BettingOutcomeTypeID', 'BettingOutcomeTypeId', 'OutcomeTypeID', 'OutcomeTypeId']
const OUTCOME_TYPE_NAME_KEYS = ['BettingOutcomeType', 'OutcomeType', 'Outcome', 'Selection', 'Name']
const RESULT_TYPE_ID_KEYS = ['BettingResultTypeID', 'BettingResultTypeId', 'ResultTypeID', 'ResultTypeId']
const RESULT_TYPE_NAME_KEYS = ['BettingResultType', 'ResultType', 'Result']
const PLAYER_ID_KEYS = ['PlayerID', 'PlayerId']
const TEAM_ID_KEYS = ['TeamID', 'TeamId']
const LINE_KEYS = ['Line', 'Value', 'Point', 'Spread', 'Total', 'OverUnder']
const PRICE_KEYS = ['AmericanOdds', 'AmericanPrice', 'Price', 'PayoutAmerican', 'Payout', 'MoneyLine', 'Moneyline', 'Odds']
const CREATED_KEYS = ['Created', 'CreatedAt', 'CreatedDate']
const UPDATED_KEYS = ['Updated', 'UpdatedAt', 'UpdatedDate', 'LastUpdated']

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function directValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key]
    const normalized = normalizeKey(key)
    const match = Object.keys(row).find((candidate) => normalizeKey(candidate) === normalized)
    if (match && row[match] !== undefined && row[match] !== null && row[match] !== '') return row[match]
  }
  return null
}

function stringValue(row: Record<string, unknown>, keys: string[]) {
  const value = directValue(row, keys)
  if (value === null) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function numberValue(row: Record<string, unknown>, keys: string[]) {
  const value = directValue(row, keys)
  if (value === null) return null
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function americanToDecimal(american: number | null) {
  if (!american) return null
  return american > 0
    ? Number((1 + american / 100).toFixed(6))
    : Number((1 + 100 / Math.abs(american)).toFixed(6))
}

function impliedProbability(american: number | null) {
  if (!american) return null
  const probability = american > 0
    ? 100 / (american + 100)
    : Math.abs(american) / (Math.abs(american) + 100)
  return Number(probability.toFixed(6))
}

function addPath(paths: Set<string>, path: string) {
  paths.add(path.replace(/^\$\[\d+\]\./, '$[].'))
}

function includesAnyKey(key: string, keys: string[]) {
  const normalized = normalizeKey(key)
  return keys.some((candidate) => normalizeKey(candidate) === normalized)
}

export function inspectSportsDataIoBettingPayload(payload: unknown): SportsDataIoBettingDiscovery {
  const providerEventIds = new Set<string>()
  const providerGameIds = new Set<string>()
  const providerMarketIds = new Set<string>()
  const providerOutcomeIds = new Set<string>()
  const providerSportsbookIds = new Set<string>()
  const marketLikePaths = new Set<string>()
  const outcomeLikePaths = new Set<string>()
  const sportsbookLikePaths = new Set<string>()

  const visit = (value: unknown, path: string, depth: number) => {
    if (depth > 8) return
    if (Array.isArray(value)) {
      value.slice(0, 50).forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1))
      return
    }
    const row = asRecord(value)
    if (!row) return

    const eventId = stringValue(row, EVENT_ID_KEYS)
    const gameId = stringValue(row, GAME_ID_KEYS)
    const marketId = stringValue(row, MARKET_ID_KEYS)
    const outcomeId = stringValue(row, OUTCOME_ID_KEYS)
    const sportsbookId = stringValue(row, SPORTSBOOK_ID_KEYS)
    if (eventId) providerEventIds.add(eventId)
    if (gameId) providerGameIds.add(gameId)
    if (marketId) providerMarketIds.add(marketId)
    if (outcomeId) providerOutcomeIds.add(outcomeId)
    if (sportsbookId) providerSportsbookIds.add(sportsbookId)

    for (const [key, child] of Object.entries(row)) {
      const lower = key.toLowerCase()
      const childPath = `${path}.${key}`
      if (lower.includes('bettingmarkets') || includesAnyKey(key, MARKET_ID_KEYS.concat(MARKET_TYPE_ID_KEYS, MARKET_TYPE_NAME_KEYS))) {
        addPath(marketLikePaths, childPath)
      }
      if (lower.includes('bettingoutcomes') || lower.includes('consensusoutcomes') || includesAnyKey(key, OUTCOME_ID_KEYS.concat(PRICE_KEYS, LINE_KEYS))) {
        addPath(outcomeLikePaths, childPath)
      }
      if (lower.includes('sportsbook') || includesAnyKey(key, SPORTSBOOK_ID_KEYS.concat(SPORTSBOOK_NAME_KEYS))) {
        addPath(sportsbookLikePaths, childPath)
      }
      if (Array.isArray(child) || asRecord(child)) visit(child, childPath, depth + 1)
    }
  }

  visit(payload, '$', 0)

  return {
    providerEventIds: Array.from(providerEventIds).sort(),
    providerGameIds: Array.from(providerGameIds).sort(),
    providerMarketIds: Array.from(providerMarketIds).sort(),
    providerOutcomeIds: Array.from(providerOutcomeIds).sort(),
    providerSportsbookIds: Array.from(providerSportsbookIds).sort(),
    marketLikePaths: Array.from(marketLikePaths).sort().slice(0, 50),
    outcomeLikePaths: Array.from(outcomeLikePaths).sort().slice(0, 50),
    sportsbookLikePaths: Array.from(sportsbookLikePaths).sort().slice(0, 50),
  }
}

export function normalizeSportsDataIoBettingOutcomes({
  payload,
  providerSport,
  trial = true,
  scrambled = true,
  productionEligible = false,
}: {
  payload: unknown
  providerSport: string
  trial?: boolean
  scrambled?: boolean
  productionEligible?: boolean
}) {
  const rows: SportsDataIoNormalizedBettingOutcome[] = []
  const visit = (value: unknown, context: Partial<SportsDataIoNormalizedBettingOutcome>, path: string, depth: number) => {
    if (depth > 8) return
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, context, `${path}[${index}]`, depth + 1))
      return
    }
    const row = asRecord(value)
    if (!row) return
    const next = {
      ...context,
      providerEventId: stringValue(row, EVENT_ID_KEYS) ?? context.providerEventId ?? null,
      providerGameId: stringValue(row, GAME_ID_KEYS) ?? context.providerGameId ?? null,
      providerMarketId: stringValue(row, MARKET_ID_KEYS) ?? context.providerMarketId ?? null,
      providerSportsbookId: stringValue(row, SPORTSBOOK_ID_KEYS) ?? context.providerSportsbookId ?? null,
      sportsbookName: stringValue(row, SPORTSBOOK_NAME_KEYS) ?? context.sportsbookName ?? null,
      marketTypeId: stringValue(row, MARKET_TYPE_ID_KEYS) ?? context.marketTypeId ?? null,
      marketTypeName: stringValue(row, MARKET_TYPE_NAME_KEYS) ?? context.marketTypeName ?? null,
      betTypeId: stringValue(row, BET_TYPE_ID_KEYS) ?? context.betTypeId ?? null,
      betTypeName: stringValue(row, BET_TYPE_NAME_KEYS) ?? context.betTypeName ?? null,
      periodTypeId: stringValue(row, PERIOD_TYPE_ID_KEYS) ?? context.periodTypeId ?? null,
      periodTypeName: stringValue(row, PERIOD_TYPE_NAME_KEYS) ?? context.periodTypeName ?? null,
    }
    const providerOutcomeId = stringValue(row, OUTCOME_ID_KEYS)
    const americanPrice = numberValue(row, PRICE_KEYS)
    const selection = stringValue(row, OUTCOME_TYPE_NAME_KEYS)
    const sportsbook = stringValue(row, SPORTSBOOK_NAME_KEYS) ?? next.sportsbookName ?? null
    if (providerOutcomeId && americanPrice && (next.providerEventId || next.providerGameId) && next.providerMarketId && sportsbook) {
      const id = idempotencyKey([
        'sportsdataio',
        providerSport,
        next.providerEventId ?? '',
        next.providerGameId ?? '',
        next.providerMarketId,
        providerOutcomeId,
        next.providerSportsbookId ?? sportsbook,
        numberValue(row, LINE_KEYS) ?? '',
        stringValue(row, UPDATED_KEYS) ?? '',
      ])
      rows.push({
        id,
        providerSport,
        providerEventId: next.providerEventId ?? null,
        providerGameId: next.providerGameId ?? null,
        providerMarketId: next.providerMarketId ?? null,
        providerOutcomeId,
        providerSportsbookId: next.providerSportsbookId ?? null,
        sportsbookName: sportsbook,
        marketTypeId: next.marketTypeId ?? null,
        marketTypeName: next.marketTypeName ?? null,
        betTypeId: next.betTypeId ?? null,
        betTypeName: next.betTypeName ?? null,
        periodTypeId: next.periodTypeId ?? null,
        periodTypeName: next.periodTypeName ?? null,
        outcomeTypeId: stringValue(row, OUTCOME_TYPE_ID_KEYS),
        outcomeTypeName: stringValue(row, OUTCOME_TYPE_NAME_KEYS),
        resultTypeId: stringValue(row, RESULT_TYPE_ID_KEYS),
        resultTypeName: stringValue(row, RESULT_TYPE_NAME_KEYS),
        providerPlayerId: stringValue(row, PLAYER_ID_KEYS) ?? null,
        providerTeamId: stringValue(row, TEAM_ID_KEYS) ?? null,
        selection,
        line: numberValue(row, LINE_KEYS),
        americanPrice,
        decimalPrice: americanToDecimal(americanPrice),
        impliedProbability: impliedProbability(americanPrice),
        consensus: path.toLowerCase().includes('consensusoutcomes'),
        createdAt: stringValue(row, CREATED_KEYS),
        updatedAt: stringValue(row, UPDATED_KEYS),
        listed: row.IsAvailable === false || row.IsListed === false ? false : row.IsAvailable === true || row.IsListed === true ? true : null,
        live: row.IsLive === true,
        alternate: row.IsAlternate === true || String(next.marketTypeName ?? '').toLowerCase().includes('alternate'),
        trial,
        scrambled,
        productionEligible,
        sourcePath: path,
        metadata: {
          rawKeys: Object.keys(row).sort(),
          archiveLocation: stringValue(row, ['ArchiveLocation']),
        },
      })
    }
    for (const [key, child] of Object.entries(row)) {
      if (child === null || child === undefined) continue
      if (Array.isArray(child) || asRecord(child)) visit(child, next, `${path}.${key}`, depth + 1)
    }
  }

  visit(payload, {}, '$', 0)
  const seen = new Set<string>()
  return rows.filter((row) => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  })
}

export function classifySportsDataIoBettingPayload({
  payload,
  providerSport,
  httpStatus,
}: {
  payload: unknown
  providerSport: string
  httpStatus?: number | null
}): SportsDataIoBettingClassification {
  const topLevel = Array.isArray(payload) ? payload : asRecord(payload) ? [payload] : []
  const discovery = inspectSportsDataIoBettingPayload(payload)
  const outcomes = normalizeSportsDataIoBettingOutcomes({ payload, providerSport })
  const archiveRequired = topLevel.some((row) => {
    const record = asRecord(row)
    return record?.IsArchived === true || Boolean(stringValue(record ?? {}, ['ArchiveLocation']))
  })
  const counters = {
    providerRecordsFetched: topLevel.length,
    eventsDiscovered: discovery.providerEventIds.length,
    marketsDiscovered: discovery.providerMarketIds.length,
    outcomesDiscovered: discovery.providerOutcomeIds.length,
    pricedOutcomes: outcomes.length,
    sportsbooksDiscovered: discovery.providerSportsbookIds.length,
    normalizedSnapshots: outcomes.length,
    archiveRequired,
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return classification('ENTITLEMENT_BLOCKED', discovery, counters, null, false, false, 'Provider returned an entitlement/authentication status.')
  }
  if (topLevel.length === 0) {
    return classification('EMPTY_VALID_RESPONSE', discovery, counters, null, false, false, 'Provider returned a valid empty payload.')
  }
  if (archiveRequired) {
    return classification('ARCHIVE_REQUIRED', discovery, counters, discovery.providerEventIds[0] ?? null, false, false, 'Payload indicates archived betting-market data.')
  }
  if (outcomes.length > 0) {
    return classification('PRICED_OUTCOMES_AVAILABLE', discovery, counters, null, false, true, 'Payload includes sportsbook-priced outcomes.')
  }
  if (discovery.providerMarketIds.length > 0) {
    return classification('MARKET_INDEX_AVAILABLE', discovery, counters, discovery.providerEventIds[0] ?? null, Boolean(discovery.providerEventIds[0]), false, 'Payload includes market index metadata but no priced outcomes.')
  }
  if (discovery.providerEventIds.length > 0) {
    return classification('DISCOVERY_ONLY', discovery, counters, discovery.providerEventIds[0], true, false, 'Payload includes BettingEvent IDs but no market or priced outcome rows.')
  }
  return classification('UNSUPPORTED_SCHEMA', discovery, counters, null, false, false, 'Payload did not expose supported SportsDataIO betting identifiers.')
}

function classification(
  status: SportsDataIoBettingClassificationStatus,
  discovery: SportsDataIoBettingDiscovery,
  counters: SportsDataIoBettingCounters,
  selectedProviderEventId: string | null,
  requiresMarketDetail: boolean,
  canPersistSnapshotsDirectly: boolean,
  reason: string
): SportsDataIoBettingClassification {
  return {
    status,
    selectedProviderEventId,
    requiresMarketDetail,
    canPersistSnapshotsDirectly,
    reason,
    discovery,
    counters,
  }
}

export function routeSportsDataIoBettingRequest({
  eventDate,
  now = new Date('2026-07-14T00:00:00.000Z'),
  trial,
  scrambled,
  productionEligible,
  lineMovement,
}: {
  eventDate: string
  now?: Date
  trial: boolean
  scrambled: boolean
  productionEligible: boolean
  lineMovement?: boolean
}): SportsDataIoBettingRoutingDecision {
  const parsed = new Date(eventDate)
  if (!Number.isFinite(parsed.getTime())) {
    return {
      routeKind: 'archive_required',
      archiveRequired: true,
      canUseCurrentEndpoint: false,
      reason: 'Invalid or missing event date cannot be safely routed to current odds endpoints.',
    }
  }
  const ageDays = Math.floor((now.getTime() - parsed.getTime()) / 86_400_000)
  if (trial || scrambled || !productionEligible) {
    return {
      routeKind: 'trial_scrambled',
      archiveRequired: ageDays > 30,
      canUseCurrentEndpoint: ageDays <= 30,
      reason: 'Trial/scrambled data may validate import paths only and cannot drive production odds usage.',
    }
  }
  if (ageDays > 30) {
    return {
      routeKind: 'archive_required',
      archiveRequired: true,
      canUseCurrentEndpoint: false,
      reason: 'Event is older than the regular odds retention window; SportsDataIO Historical API routing is required.',
    }
  }
  if (lineMovement) {
    return {
      routeKind: 'recent_historical_line_movement',
      archiveRequired: false,
      canUseCurrentEndpoint: true,
      reason: 'Recent line movement can use regular odds line-movement endpoints when cataloged and entitled.',
    }
  }
  return {
    routeKind: 'production_feed',
    archiveRequired: false,
    canUseCurrentEndpoint: true,
    reason: 'Production-eligible recent event can use current odds endpoints when entitlement and normalizers pass.',
  }
}

export function runSportsDataIoBettingNormalizerValidation() {
  const eventEmptyMarkets = [{ BettingEventID: 100, GameID: 900, BettingMarkets: [] }]
  const eventMarketIdsOnly = [{ BettingEventID: 101, GameID: 901, BettingMarkets: [{ BettingMarketID: 501 }] }]
  const marketWithOutcomes = [{
    BettingEventID: 102,
    GameID: 902,
    BettingMarkets: [{
      BettingMarketID: 502,
      BettingMarketType: 'Game Lines',
      BettingOutcomes: [{
        BettingOutcomeID: 7001,
        SportsbookID: 10,
        Sportsbook: 'Fixture Book',
        Outcome: 'Home',
        AmericanOdds: -115,
      }],
    }],
  }]
  const consensusOnly = [{
    BettingEventID: 103,
    BettingMarkets: [{
      BettingMarketID: 503,
      ConsensusOutcomes: [{
        BettingOutcomeID: 7002,
        SportsbookID: 0,
        Sportsbook: 'Consensus',
        Outcome: 'Away',
        AmericanOdds: 105,
      }],
    }],
  }]
  const archivePayload = [{ BettingEventID: 104, IsArchived: true, ArchiveLocation: 'historical-api' }]
  const unlistedOutcome = [{
    BettingEventID: 105,
    BettingMarkets: [{
      BettingMarketID: 504,
      BettingOutcomes: [{
        BettingOutcomeID: 7003,
        SportsbookID: 10,
        Sportsbook: 'Fixture Book',
        Outcome: 'Under',
        AmericanOdds: -105,
        IsListed: false,
      }],
    }],
  }]
  const checks = {
    emptyMarketsDiscoveryOnly:
      classifySportsDataIoBettingPayload({ payload: eventEmptyMarkets, providerSport: 'nba' }).status === 'DISCOVERY_ONLY',
    marketIdsOnlyIndex:
      classifySportsDataIoBettingPayload({ payload: eventMarketIdsOnly, providerSport: 'nba' }).status === 'MARKET_INDEX_AVAILABLE',
    pricedOutcomesAvailable:
      classifySportsDataIoBettingPayload({ payload: marketWithOutcomes, providerSport: 'nba' }).status === 'PRICED_OUTCOMES_AVAILABLE',
    consensusOutcomeSeparated:
      normalizeSportsDataIoBettingOutcomes({ payload: consensusOnly, providerSport: 'nba' })[0]?.consensus === true,
    archiveRequired:
      classifySportsDataIoBettingPayload({ payload: archivePayload, providerSport: 'nba' }).status === 'ARCHIVE_REQUIRED',
    emptyValidResponse:
      classifySportsDataIoBettingPayload({ payload: [], providerSport: 'nba' }).status === 'EMPTY_VALID_RESPONSE',
    entitlementBlocked:
      classifySportsDataIoBettingPayload({ payload: [], providerSport: 'nba', httpStatus: 403 }).status === 'ENTITLEMENT_BLOCKED',
    unlistedOutcomesPreserved:
      normalizeSportsDataIoBettingOutcomes({ payload: unlistedOutcome, providerSport: 'nba' })[0]?.listed === false,
    bettingEventIdNotGameId:
      classifySportsDataIoBettingPayload({ payload: eventMarketIdsOnly, providerSport: 'nba' }).selectedProviderEventId === '101',
    oldEventRoutesToArchive:
      routeSportsDataIoBettingRequest({
        eventDate: '2025-12-26',
        now: new Date('2026-07-14T00:00:00.000Z'),
        trial: false,
        scrambled: false,
        productionEligible: true,
      }).archiveRequired === true,
    trialDoesNotBecomeProduction:
      routeSportsDataIoBettingRequest({
        eventDate: '2026-07-01',
        now: new Date('2026-07-14T00:00:00.000Z'),
        trial: true,
        scrambled: true,
        productionEligible: false,
      }).routeKind === 'trial_scrambled',
  }

  return {
    success: Object.values(checks).every(Boolean),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'local_sportsdataio_betting_normalizer_fixtures',
    },
    checks,
    counters: classifySportsDataIoBettingPayload({ payload: marketWithOutcomes, providerSport: 'nba' }).counters,
  }
}
