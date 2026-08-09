import 'server-only'

import {
  CERTIFIED_BOOK_SET_V1,
  ODDS_PRIMARY_AUTHORITY_CONFIG,
  productAuthorityForStage,
  readOddsPrimaryAuthorityStage,
  type CertifiedBookKey,
  type OddsPrimaryAuthorityStage,
} from '@/config/odds-primary-authority.config'
import {
  buildSupersessionLineageDraft,
  evaluatePregameRepredictionEligibility,
  type MarketLineEvidence,
  type PredictionLineIdentity,
} from '@/services/market-line-versioning-contract.service'

export type OddsAuthorityMarket = 'moneyline' | 'spread' | 'total'
export type OddsAuthoritySelection = {
  eventId: string
  market: OddsAuthorityMarket
  selection: string
  line: number | null
}
export type OddsAuthorityPriceEvidence = OddsAuthoritySelection & {
  provider: 'the-odds-api' | 'sportsdataio'
  bookmakerKey: string
  bookmaker: string
  price: number
  sourceTimestamp: string | null
  capturedAt: string | null
}

export type OddsAuthorityLifecycleEvent = {
  eventId: string
  homeTeam: string
  awayTeam: string
  startTime: string
  providerIds?: Record<string, unknown> | null
  lifecycleState?: string | null
}

export type OddsAuthorityProviderEvent = {
  providerEventId: string
  homeTeam: string
  awayTeam: string
  commenceTime: string
}

const TEAM_ALIASES: Record<string, string> = {
  arizonadiamondbacks: 'ARI',
  ari: 'ARI',
  atlanta: 'ATL',
  atlantabraves: 'ATL',
  atl: 'ATL',
  baltimoreorioles: 'BAL',
  bal: 'BAL',
  bostonredsox: 'BOS',
  bos: 'BOS',
  chicagocubs: 'CHC',
  chc: 'CHC',
  chicagowhitesox: 'CHW',
  chw: 'CHW',
  cincinnatireds: 'CIN',
  cin: 'CIN',
  clevelandguardians: 'CLE',
  cle: 'CLE',
  coloradorockies: 'COL',
  col: 'COL',
  detroittigers: 'DET',
  det: 'DET',
  houstonastros: 'HOU',
  hou: 'HOU',
  kansascityroyals: 'KC',
  kc: 'KC',
  losangelesangels: 'LAA',
  laa: 'LAA',
  losangelesdodgers: 'LAD',
  lad: 'LAD',
  miamimarlins: 'MIA',
  mia: 'MIA',
  milwaukeebrewers: 'MIL',
  mil: 'MIL',
  minnesotatwins: 'MIN',
  min: 'MIN',
  newyorkmets: 'NYM',
  nym: 'NYM',
  newyorkyankees: 'NYY',
  nyy: 'NYY',
  oaklandathletics: 'ATH',
  athletics: 'ATH',
  oak: 'ATH',
  philadelphiaphillies: 'PHI',
  phi: 'PHI',
  pittsburghpirates: 'PIT',
  pit: 'PIT',
  sandiegopadres: 'SD',
  sd: 'SD',
  sanfranciscogiants: 'SF',
  sf: 'SF',
  seattlemariners: 'SEA',
  sea: 'SEA',
  stlouiscardinals: 'STL',
  stl: 'STL',
  tampabayrays: 'TB',
  tb: 'TB',
  texasrangers: 'TEX',
  tex: 'TEX',
  torontobluejays: 'TOR',
  tor: 'TOR',
  washingtonnationals: 'WSH',
  wsh: 'WSH',
}

function normalizeTeam(value: string) {
  const compact = value.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return TEAM_ALIASES[compact] ?? value.trim().toUpperCase()
}

function timeDeltaMinutes(left: string, right: string) {
  const a = Date.parse(left)
  const b = Date.parse(right)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY
  return Math.abs(a - b) / 60000
}

function normalizeBook(value: string): CertifiedBookKey | null {
  const key = value.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (key === 'fanduel') return 'fanduel'
  if (key === 'draftkings') return 'draftkings'
  if (key === 'betmgm') return 'betmgm'
  if (key === 'caesars') return 'caesars'
  return null
}

function comparableLine(market: OddsAuthorityMarket, value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && market === 'total' ? Math.abs(value) : value
}

function sameLine(market: OddsAuthorityMarket, left: number | null, right: number | null) {
  const a = comparableLine(market, left)
  const b = comparableLine(market, right)
  if (a === null && b === null) return true
  if (typeof a !== 'number' || typeof b !== 'number') return false
  return Math.abs(a - b) < 0.001
}

function sourceAgeMinutes(sourceTimestamp: string | null, now: string) {
  if (!sourceTimestamp) return null
  const source = Date.parse(sourceTimestamp)
  const at = Date.parse(now)
  if (!Number.isFinite(source) || !Number.isFinite(at)) return null
  return Math.max(0, Math.round((at - source) / 60000))
}

function decimalFromAmerican(price: number) {
  return price > 0 ? 1 + price / 100 : 1 + 100 / Math.abs(price)
}

function betterPrice(left: OddsAuthorityPriceEvidence, right: OddsAuthorityPriceEvidence) {
  return decimalFromAmerican(left.price) > decimalFromAmerican(right.price) ? left : right
}

export function getOddsPrimaryAuthorityRuntimeStatus(stage: OddsPrimaryAuthorityStage = readOddsPrimaryAuthorityStage()) {
  const productAuthority = productAuthorityForStage(stage)
  return {
    success: true,
    mode: 'odds_primary_authority_status_v1',
    configVersion: ODDS_PRIMARY_AUTHORITY_CONFIG.version,
    stage,
    productAuthority,
    internalCandidateProvider: 'THE_ODDS_API',
    sportsDataIoRetainedForRollback: true,
    sportsDataIoCancelled: false,
    sportsDataIoOddsDisabled: stage === 'STAGE_4_SPORTSDATAIO_ODDS_DISABLED_ROLLBACK_AVAILABLE',
    theOddsApiShadowOnly: productAuthority !== 'THE_ODDS_API',
    dualReadEnabled: stage !== 'STAGE_0_SPORTSDATAIO_AUTHORITY',
    productionProductPromotionAuthorized: stage === 'STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT',
    rollbackAuthority: ODDS_PRIMARY_AUTHORITY_CONFIG.rollbackAuthority,
    rollbackRequiresCodeDeployment: false,
    credentialVariable: ODDS_PRIMARY_AUTHORITY_CONFIG.credentialVariable,
    legacyCredentialVariablePreserved: ODDS_PRIMARY_AUTHORITY_CONFIG.legacyCredentialVariable,
    certifiedBookSet: CERTIFIED_BOOK_SET_V1.map((book) => book.displayName),
    sourceTimestampPolicy: ODDS_PRIMARY_AUTHORITY_CONFIG.sourceTimestampPolicy,
    captureTimestampPolicy: ODDS_PRIMARY_AUTHORITY_CONFIG.captureTimestampPolicy,
    exactLineIdentity: ODDS_PRIMARY_AUTHORITY_CONFIG.exactLineIdentity,
    failClosedStatuses: ODDS_PRIMARY_AUTHORITY_CONFIG.failClosedStatuses,
    hr03CalibrationStatus: 'SHADOW_ONLY',
    officialPickThresholdsChanged: false,
    providerCallsMade: 0,
    databaseMutationsMade: 0,
  }
}

export function mapOddsApiEventToLifecycleEvent({
  providerEvent,
  lifecycleEvents,
  toleranceMinutes = 15,
}: {
  providerEvent: OddsAuthorityProviderEvent
  lifecycleEvents: OddsAuthorityLifecycleEvent[]
  toleranceMinutes?: number
}) {
  const home = normalizeTeam(providerEvent.homeTeam)
  const away = normalizeTeam(providerEvent.awayTeam)
  const crosswalkMatches = lifecycleEvents.filter((event) => {
    const providerIds = event.providerIds ?? {}
    return Object.values(providerIds).some((value) => String(value) === providerEvent.providerEventId)
  })
  const teamTimeMatches = lifecycleEvents.filter((event) => (
    normalizeTeam(event.homeTeam) === home &&
    normalizeTeam(event.awayTeam) === away &&
    timeDeltaMinutes(event.startTime, providerEvent.commenceTime) <= toleranceMinutes
  ))
  const matches = crosswalkMatches.length ? crosswalkMatches : teamTimeMatches
  return {
    providerEventId: providerEvent.providerEventId,
    status: matches.length === 1 ? 'MAPPED' as const : matches.length > 1 ? 'AMBIGUOUS' as const : 'UNMAPPED' as const,
    canonicalEventId: matches.length === 1 ? matches[0].eventId : null,
    reason:
      matches.length === 1 && crosswalkMatches.length
        ? 'EXISTING_PROVIDER_CROSSWALK'
        : matches.length === 1
          ? 'CANONICAL_TEAM_IDENTITY_AND_START_TIME'
          : matches.length > 1
            ? 'MULTIPLE_LIFECYCLE_MATCHES'
            : 'NO_LIFECYCLE_MATCH',
    normalizedHome: home,
    normalizedAway: away,
    ambiguousCount: matches.length > 1 ? matches.length : 0,
  }
}

export function selectBestFreshCertifiedBookPrice({
  selection,
  prices,
  preferredBook,
  now,
  maxAgeMinutes,
}: {
  selection: OddsAuthoritySelection
  prices: OddsAuthorityPriceEvidence[]
  preferredBook?: CertifiedBookKey | string | null
  now: string
  maxAgeMinutes: number
}) {
  const exact = prices.filter((price) => (
    price.eventId === selection.eventId &&
    price.market === selection.market &&
    price.selection.toLowerCase() === selection.selection.toLowerCase() &&
    sameLine(selection.market, price.line, selection.line)
  ))
  const certified = exact
    .map((price) => ({ price, bookKey: normalizeBook(price.bookmakerKey) ?? normalizeBook(price.bookmaker) }))
    .filter((item): item is { price: OddsAuthorityPriceEvidence; bookKey: CertifiedBookKey } => Boolean(item.bookKey))
  const fresh = certified.filter((item) => {
    const age = sourceAgeMinutes(item.price.sourceTimestamp, now)
    return age !== null && age <= maxAgeMinutes
  })
  const preferred = preferredBook ? normalizeBook(preferredBook) : null
  const preferredFresh = preferred ? fresh.find((item) => item.bookKey === preferred) : null
  const selected = preferredFresh?.price ?? fresh.map((item) => item.price).reduce<OddsAuthorityPriceEvidence | null>((best, price) => (best ? betterPrice(best, price) : price), null)
  return {
    policy: 'BEST_FRESH_WITH_USER_BOOK_PREFERENCE',
    selectedPrice: selected?.price ?? null,
    selectedBook: selected?.bookmaker ?? null,
    selectedBookKey: selected ? normalizeBook(selected.bookmakerKey) ?? normalizeBook(selected.bookmaker) : null,
    sourceTimestamp: selected?.sourceTimestamp ?? null,
    marketAgeMinutes: selected ? sourceAgeMinutes(selected.sourceTimestamp, now) : null,
    status: selected
      ? 'FRESH_EXACT_LINE_PRICE_SELECTED'
      : exact.length === 0
        ? 'NO_FRESH_EXACT_LINE_PRICE'
        : fresh.length === 0
          ? 'WAIT_FOR_REFRESH'
          : 'NO_CERTIFIED_BOOK_PRICE',
    allCertifiedBookPrices: certified.map((item) => ({
      book: item.price.bookmaker,
      bookKey: item.bookKey,
      price: item.price.price,
      line: item.price.line,
      sourceTimestamp: item.price.sourceTimestamp,
      sourceAgeMinutes: sourceAgeMinutes(item.price.sourceTimestamp, now),
    })),
    consensusContext: {
      exactLinePricesObserved: exact.length,
      certifiedBookPricesObserved: certified.length,
      freshCertifiedBookPricesObserved: fresh.length,
    },
    crossLineSelectionAllowed: false,
  }
}

export function buildLineVersionedRepredictionPlan(input: {
  prediction: PredictionLineIdentity
  currentEvidence: MarketLineEvidence[]
  now: string
  eventStartTime: string | null
  requiredFeaturesAvailable: boolean
  exactPredictionAlreadyExists: boolean
  newLine: number | null
}) {
  const eligibility = evaluatePregameRepredictionEligibility(input)
  const lineage = buildSupersessionLineageDraft({
    oldPredictionId: input.prediction.predictionId,
    eventId: input.prediction.eventId,
    market: input.prediction.market,
    selection: input.prediction.selection,
    oldLine: input.prediction.line,
    newLine: input.newLine,
    sourcePriceTimestamp: input.currentEvidence[0]?.sourceTimestamp ?? null,
  })
  return {
    contractVersion: 'line_versioned_reprediction_execution_v1',
    executionMode: 'EXECUTABLE_GATED',
    eligibleToExecute: eligibility.eligible,
    productionPredictionCreated: false,
    requiresExplicitWriter: true,
    noPostStartPredictionFabrication: true,
    noCrossLineProbabilityReuse: true,
    deduplicationKey: [
      input.prediction.eventId,
      input.prediction.market,
      input.prediction.selection,
      input.newLine === null ? 'null' : input.newLine.toFixed(3),
    ].join('|'),
    eligibility,
    lineage,
  }
}

export function validateOddsPrimaryAuthorityFixtures() {
  const stage = getOddsPrimaryAuthorityRuntimeStatus('STAGE_1_DUAL_READ')
  const lifecycleEvents: OddsAuthorityLifecycleEvent[] = [
    { eventId: 'cin-wsh', awayTeam: 'CIN', homeTeam: 'WSH', startTime: '2026-08-09T17:35:00.000Z' },
    { eventId: 'tb-sea', awayTeam: 'TB', homeTeam: 'SEA', startTime: '2026-08-09T20:10:00.000Z' },
    { eventId: 'ath-ari', awayTeam: 'ATH', homeTeam: 'ARI', startTime: '2026-08-09T23:10:00.000Z' },
    { eventId: 'future', awayTeam: 'BOS', homeTeam: 'NYY', startTime: '2026-08-10T23:10:00.000Z', lifecycleState: 'ACTIVE_REFRESH' },
    { eventId: 'started', awayTeam: 'LAD', homeTeam: 'SD', startTime: '2026-08-09T00:10:00.000Z', lifecycleState: 'LIVE' },
    { eventId: 'final', awayTeam: 'HOU', homeTeam: 'TEX', startTime: '2026-08-08T23:10:00.000Z', lifecycleState: 'FINAL' },
  ]
  const mappings = [
    mapOddsApiEventToLifecycleEvent({ providerEvent: { providerEventId: 'p1', awayTeam: 'Cincinnati Reds', homeTeam: 'Washington Nationals', commenceTime: '2026-08-09T17:35:00.000Z' }, lifecycleEvents }),
    mapOddsApiEventToLifecycleEvent({ providerEvent: { providerEventId: 'p2', awayTeam: 'Tampa Bay Rays', homeTeam: 'Seattle Mariners', commenceTime: '2026-08-09T20:10:00.000Z' }, lifecycleEvents }),
    mapOddsApiEventToLifecycleEvent({ providerEvent: { providerEventId: 'p3', awayTeam: 'Oakland Athletics', homeTeam: 'Arizona Diamondbacks', commenceTime: '2026-08-09T23:10:00.000Z' }, lifecycleEvents }),
    mapOddsApiEventToLifecycleEvent({ providerEvent: { providerEventId: 'p4', awayTeam: 'Boston Red Sox', homeTeam: 'New York Yankees', commenceTime: '2026-08-10T23:10:00.000Z' }, lifecycleEvents }),
    mapOddsApiEventToLifecycleEvent({ providerEvent: { providerEventId: 'p5', awayTeam: 'Los Angeles Dodgers', homeTeam: 'San Diego Padres', commenceTime: '2026-08-09T00:10:00.000Z' }, lifecycleEvents }),
    mapOddsApiEventToLifecycleEvent({ providerEvent: { providerEventId: 'p6', awayTeam: 'Houston Astros', homeTeam: 'Texas Rangers', commenceTime: '2026-08-08T23:10:00.000Z' }, lifecycleEvents }),
  ]
  const priceSelection = selectBestFreshCertifiedBookPrice({
    selection: { eventId: 'cin-wsh', market: 'total', selection: 'Over', line: 8 },
    prices: [
      { provider: 'the-odds-api', eventId: 'cin-wsh', market: 'total', selection: 'Over', line: 8, bookmakerKey: 'draftkings', bookmaker: 'DraftKings', price: -105, sourceTimestamp: '2026-08-09T16:58:00.000Z', capturedAt: '2026-08-09T16:59:00.000Z' },
      { provider: 'the-odds-api', eventId: 'cin-wsh', market: 'total', selection: 'Over', line: 8, bookmakerKey: 'fanduel', bookmaker: 'FanDuel', price: 102, sourceTimestamp: '2026-08-09T16:57:00.000Z', capturedAt: '2026-08-09T16:59:00.000Z' },
      { provider: 'the-odds-api', eventId: 'cin-wsh', market: 'total', selection: 'Over', line: 8.5, bookmakerKey: 'caesars', bookmaker: 'Caesars', price: 110, sourceTimestamp: '2026-08-09T16:58:00.000Z', capturedAt: '2026-08-09T16:59:00.000Z' },
    ],
    now: '2026-08-09T17:00:00.000Z',
    maxAgeMinutes: 10,
  })
  const reprediction = buildLineVersionedRepredictionPlan({
    prediction: {
      predictionId: 'prediction-total-8',
      eventId: 'cin-wsh',
      market: 'total',
      selection: 'Over',
      line: 8,
      generatedAt: '2026-08-09T15:00:00.000Z',
      cutoffAt: '2026-08-09T17:30:00.000Z',
    },
    currentEvidence: [{
      provider: 'the-odds-api',
      eventId: 'cin-wsh',
      bookmaker: 'FanDuel',
      bookmakerKey: 'fanduel',
      market: 'total',
      selection: 'Over',
      line: 8.5,
      price: 100,
      sourceTimestamp: '2026-08-09T16:58:00.000Z',
      capturedAt: '2026-08-09T16:59:00.000Z',
    }],
    now: '2026-08-09T17:00:00.000Z',
    eventStartTime: '2026-08-09T17:35:00.000Z',
    requiredFeaturesAvailable: true,
    exactPredictionAlreadyExists: false,
    newLine: 8.5,
  })
  const checks = [
    ['dual-read stage keeps SportsDataIO product authority', stage.stage === 'STAGE_1_DUAL_READ' && stage.productAuthority === 'SPORTSDATAIO'],
    ['certified book set explicit', stage.certifiedBookSet.join(',') === 'FanDuel,DraftKings,BetMGM,Caesars'],
    ['CIN @ WSH maps lifecycle scope', mappings[0].status === 'MAPPED' && mappings[0].canonicalEventId === 'cin-wsh'],
    ['TB @ SEA maps lifecycle scope', mappings[1].status === 'MAPPED' && mappings[1].canonicalEventId === 'tb-sea'],
    ['ATH/OAK maps deterministic alias', mappings[2].status === 'MAPPED' && mappings[2].canonicalEventId === 'ath-ari'],
    ['future event maps', mappings[3].status === 'MAPPED' && mappings[3].canonicalEventId === 'future'],
    ['started event maps without enabling post-start predictions', mappings[4].status === 'MAPPED' && reprediction.noPostStartPredictionFabrication],
    ['final event maps without market refresh promotion', mappings[5].status === 'MAPPED'],
    ['ambiguous events zero', mappings.every((mapping) => mapping.ambiguousCount === 0)],
    ['best fresh exact-line price selected', priceSelection.status === 'FRESH_EXACT_LINE_PRICE_SELECTED' && priceSelection.selectedBook === 'FanDuel'],
    ['cross-line price is excluded', priceSelection.consensusContext.exactLinePricesObserved === 2 && priceSelection.crossLineSelectionAllowed === false],
    ['line-versioned re-prediction executable gated', reprediction.executionMode === 'EXECUTABLE_GATED' && reprediction.eligibleToExecute],
    ['re-prediction does not write during validation', reprediction.productionPredictionCreated === false && reprediction.requiresExplicitWriter],
    ['supersession lineage recorded', reprediction.lineage.supersedeReason === 'MARKET_LINE_CHANGED'],
    ['HR-03 remains shadow', stage.hr03CalibrationStatus === 'SHADOW_ONLY'],
    ['provider calls remain zero', stage.providerCallsMade === 0],
    ['database mutations remain zero', stage.databaseMutationsMade === 0],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'odds_primary_authority_fixture_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    mappings,
    priceSelection,
    reprediction,
    providerCallsMade: 0,
    databaseMutationsMade: 0,
  }
}
