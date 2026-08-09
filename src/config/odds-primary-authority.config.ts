export type OddsPrimaryAuthorityProvider = 'SPORTSDATAIO' | 'THE_ODDS_API'

export type OddsPrimaryAuthorityStage =
  | 'STAGE_0_SPORTSDATAIO_AUTHORITY'
  | 'STAGE_1_DUAL_READ'
  | 'STAGE_2_THE_ODDS_API_PRIMARY_INTERNAL'
  | 'STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT'
  | 'STAGE_4_SPORTSDATAIO_ODDS_DISABLED_ROLLBACK_AVAILABLE'

export type CertifiedBookKey = 'fanduel' | 'draftkings' | 'betmgm' | 'caesars'

export const CERTIFIED_BOOK_SET_V1: Array<{
  key: CertifiedBookKey
  displayName: string
  observedIn: string[]
}> = [
  { key: 'fanduel', displayName: 'FanDuel', observedIn: ['ODDS-02C', 'ODDS-02G'] },
  { key: 'draftkings', displayName: 'DraftKings', observedIn: ['ODDS-02C', 'ODDS-02G'] },
  { key: 'betmgm', displayName: 'BetMGM', observedIn: ['ODDS-02C', 'ODDS-02G'] },
  { key: 'caesars', displayName: 'Caesars', observedIn: ['ODDS-02C', 'ODDS-02G'] },
]

export const ODDS_PRIMARY_AUTHORITY_CONFIG = {
  version: 'odds_primary_authority_v1',
  defaultStage: 'STAGE_1_DUAL_READ' as OddsPrimaryAuthorityStage,
  defaultProductAuthority: 'SPORTSDATAIO' as OddsPrimaryAuthorityProvider,
  shadowProvider: 'THE_ODDS_API' as OddsPrimaryAuthorityProvider,
  rollbackAuthority: 'SPORTSDATAIO' as OddsPrimaryAuthorityProvider,
  credentialVariable: 'THE_ODDS_API_KEY',
  legacyCredentialVariable: 'ODDS_API_KEY',
  certifiedBookSetVersion: 'CERTIFIED_BOOK_SET_V1',
  certifiedBooks: CERTIFIED_BOOK_SET_V1,
  supportedMarkets: ['moneyline', 'spread', 'total'] as const,
  sourceTimestampPolicy: 'PROVIDER_SOURCE_TIMESTAMP_REQUIRED',
  captureTimestampPolicy: 'CONTEXT_ONLY_NOT_ACTIONABILITY_FRESHNESS',
  exactLineIdentity: ['eventId', 'market', 'selection', 'line'] as const,
  failClosedStatuses: [
    'NO_FRESH_PRICE',
    'NO_FRESH_EXACT_LINE_PRICE',
    'WAITING_FOR_CURRENT_LINE_PREDICTION',
    'WAIT_FOR_REFRESH',
  ] as const,
  promotionGate: 'HUMAN_APPROVAL_REQUIRED',
}

export function normalizeOddsAuthorityStage(value?: string | null): OddsPrimaryAuthorityStage {
  const stage = String(value ?? '').trim().toUpperCase()
  if (stage === 'STAGE_0_SPORTSDATAIO_AUTHORITY' || stage === 'SPORTSDATAIO') return 'STAGE_0_SPORTSDATAIO_AUTHORITY'
  if (stage === 'STAGE_2_THE_ODDS_API_PRIMARY_INTERNAL') return 'STAGE_2_THE_ODDS_API_PRIMARY_INTERNAL'
  if (stage === 'STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT' || stage === 'THE_ODDS_API_PRIMARY_PRODUCT') return 'STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT'
  if (stage === 'STAGE_4_SPORTSDATAIO_ODDS_DISABLED_ROLLBACK_AVAILABLE') return 'STAGE_4_SPORTSDATAIO_ODDS_DISABLED_ROLLBACK_AVAILABLE'
  return 'STAGE_1_DUAL_READ'
}

export function productAuthorityForStage(stage: OddsPrimaryAuthorityStage): OddsPrimaryAuthorityProvider {
  if (stage === 'STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT' || stage === 'STAGE_4_SPORTSDATAIO_ODDS_DISABLED_ROLLBACK_AVAILABLE') {
    return 'THE_ODDS_API'
  }
  return 'SPORTSDATAIO'
}

export function readOddsPrimaryAuthorityStage() {
  return normalizeOddsAuthorityStage(process.env.ODDS_PRIMARY_AUTHORITY_STAGE)
}
