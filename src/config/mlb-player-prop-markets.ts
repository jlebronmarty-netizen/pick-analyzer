export type MlbPlayerPropFamily = 'pitcher' | 'batter'

export type MlbPlayerPropMarketKey =
  | 'pitcher_outs_recorded'
  | 'pitcher_strikeouts'
  | 'pitcher_walks'
  | 'pitcher_hits_allowed'
  | 'pitcher_earned_runs'
  | 'batter_hits'
  | 'batter_total_bases'
  | 'batter_home_runs'
  | 'batter_rbi'
  | 'batter_runs'
  | 'batter_walks'
  | 'batter_stolen_bases'

export type MlbPlayerPropMarketDefinition = {
  key: MlbPlayerPropMarketKey
  displayName: string
  shortLabel: string
  family: MlbPlayerPropFamily
  providerMarketKeys: string[]
  projectionKeys: string[]
  supportedLines: number[]
  projectionProbability: 'pitcher_outs_thresholds' | 'count_projection_thresholds'
  storageStatus: 'ACTIVE_STORED_MARKET' | 'SUPPORTED_EMPTY_STATE'
}

const COUNT_PROP_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5]
const LOW_COUNT_PROP_LINES = [0.5, 1.5, 2.5, 3.5]

export const MLB_PLAYER_PROP_MARKETS: MlbPlayerPropMarketDefinition[] = [
  {
    key: 'pitcher_outs_recorded',
    displayName: 'Pitcher Outs',
    shortLabel: 'Pitcher Outs',
    family: 'pitcher',
    providerMarketKeys: ['pitcher_outs', 'pitcher_pitching_outs'],
    projectionKeys: ['pitcher_outs_recorded'],
    supportedLines: [14.5, 15.5, 16.5, 17.5, 18.5],
    projectionProbability: 'pitcher_outs_thresholds',
    storageStatus: 'ACTIVE_STORED_MARKET',
  },
  {
    key: 'pitcher_strikeouts',
    displayName: 'Pitcher Strikeouts',
    shortLabel: 'Strikeouts',
    family: 'pitcher',
    providerMarketKeys: ['pitcher_strikeouts'],
    projectionKeys: ['pitcher_strikeouts'],
    supportedLines: COUNT_PROP_LINES,
    projectionProbability: 'count_projection_thresholds',
    storageStatus: 'SUPPORTED_EMPTY_STATE',
  },
  {
    key: 'pitcher_walks',
    displayName: 'Pitcher Walks',
    shortLabel: 'Pitcher Walks',
    family: 'pitcher',
    providerMarketKeys: ['pitcher_walks'],
    projectionKeys: ['pitcher_walks_allowed', 'pitcher_walks'],
    supportedLines: LOW_COUNT_PROP_LINES,
    projectionProbability: 'count_projection_thresholds',
    storageStatus: 'SUPPORTED_EMPTY_STATE',
  },
  {
    key: 'pitcher_hits_allowed',
    displayName: 'Pitcher Hits Allowed',
    shortLabel: 'Hits Allowed',
    family: 'pitcher',
    providerMarketKeys: ['pitcher_hits_allowed'],
    projectionKeys: ['pitcher_hits_allowed'],
    supportedLines: COUNT_PROP_LINES,
    projectionProbability: 'count_projection_thresholds',
    storageStatus: 'SUPPORTED_EMPTY_STATE',
  },
  {
    key: 'pitcher_earned_runs',
    displayName: 'Pitcher Earned Runs',
    shortLabel: 'Earned Runs',
    family: 'pitcher',
    providerMarketKeys: ['pitcher_earned_runs'],
    projectionKeys: ['pitcher_earned_runs'],
    supportedLines: LOW_COUNT_PROP_LINES,
    projectionProbability: 'count_projection_thresholds',
    storageStatus: 'SUPPORTED_EMPTY_STATE',
  },
  {
    key: 'batter_hits',
    displayName: 'Batter Hits',
    shortLabel: 'Hits',
    family: 'batter',
    providerMarketKeys: ['batter_hits'],
    projectionKeys: ['batter_hits'],
    supportedLines: LOW_COUNT_PROP_LINES,
    projectionProbability: 'count_projection_thresholds',
    storageStatus: 'SUPPORTED_EMPTY_STATE',
  },
  {
    key: 'batter_total_bases',
    displayName: 'Batter Total Bases',
    shortLabel: 'Total Bases',
    family: 'batter',
    providerMarketKeys: ['batter_total_bases'],
    projectionKeys: ['batter_total_bases'],
    supportedLines: COUNT_PROP_LINES,
    projectionProbability: 'count_projection_thresholds',
    storageStatus: 'SUPPORTED_EMPTY_STATE',
  },
  {
    key: 'batter_home_runs',
    displayName: 'Batter Home Runs',
    shortLabel: 'Home Runs',
    family: 'batter',
    providerMarketKeys: ['batter_home_runs'],
    projectionKeys: ['batter_home_runs'],
    supportedLines: [0.5, 1.5],
    projectionProbability: 'count_projection_thresholds',
    storageStatus: 'SUPPORTED_EMPTY_STATE',
  },
  {
    key: 'batter_rbi',
    displayName: 'Batter RBI',
    shortLabel: 'RBI',
    family: 'batter',
    providerMarketKeys: ['batter_rbis', 'batter_rbi'],
    projectionKeys: ['batter_rbi'],
    supportedLines: LOW_COUNT_PROP_LINES,
    projectionProbability: 'count_projection_thresholds',
    storageStatus: 'SUPPORTED_EMPTY_STATE',
  },
  {
    key: 'batter_runs',
    displayName: 'Batter Runs',
    shortLabel: 'Runs',
    family: 'batter',
    providerMarketKeys: ['batter_runs_scored', 'batter_runs'],
    projectionKeys: ['batter_runs'],
    supportedLines: LOW_COUNT_PROP_LINES,
    projectionProbability: 'count_projection_thresholds',
    storageStatus: 'SUPPORTED_EMPTY_STATE',
  },
  {
    key: 'batter_walks',
    displayName: 'Batter Walks',
    shortLabel: 'Walks',
    family: 'batter',
    providerMarketKeys: ['batter_walks'],
    projectionKeys: ['batter_walks'],
    supportedLines: LOW_COUNT_PROP_LINES,
    projectionProbability: 'count_projection_thresholds',
    storageStatus: 'SUPPORTED_EMPTY_STATE',
  },
  {
    key: 'batter_stolen_bases',
    displayName: 'Batter Stolen Bases',
    shortLabel: 'Stolen Bases',
    family: 'batter',
    providerMarketKeys: ['batter_stolen_bases'],
    projectionKeys: ['batter_stolen_bases'],
    supportedLines: [0.5, 1.5],
    projectionProbability: 'count_projection_thresholds',
    storageStatus: 'SUPPORTED_EMPTY_STATE',
  },
]

export const MLB_PLAYER_PROP_PROVIDER_MARKET_KEYS = Array.from(new Set(
  MLB_PLAYER_PROP_MARKETS.flatMap((market) => market.providerMarketKeys)
))

export function storageMarketForPlayerProp(marketKey: MlbPlayerPropMarketKey) {
  return `player_props:${marketKey}`
}

export function playerPropMarketFromStorage(value: unknown) {
  const raw = String(value ?? '').trim().toLowerCase()
  const key = raw.startsWith('player_props:') ? raw.slice('player_props:'.length) : raw
  return MLB_PLAYER_PROP_MARKETS.find((market) => market.key === key) ?? null
}

export function playerPropMarketFromProvider(value: unknown) {
  const raw = String(value ?? '').trim().toLowerCase()
  return MLB_PLAYER_PROP_MARKETS.find((market) => market.providerMarketKeys.includes(raw)) ?? null
}

export function playerPropMarketByKey(value: unknown) {
  const raw = String(value ?? '').trim().toLowerCase()
  return MLB_PLAYER_PROP_MARKETS.find((market) => market.key === raw) ?? null
}

export function playerPropSupportedLine(marketKey: MlbPlayerPropMarketKey, value: unknown) {
  const line = Number(value)
  if (!Number.isFinite(line)) return null
  const market = playerPropMarketByKey(marketKey)
  if (!market) return null
  return market.supportedLines.includes(line) ? line : null
}
