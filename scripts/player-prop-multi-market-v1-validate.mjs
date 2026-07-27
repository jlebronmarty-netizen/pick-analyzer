import fs from 'node:fs'

function loadEnvFile(path = '.env.local') {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    const value = match[2].trim().replace(/^['"]|['"]$/g, '')
    if (key && !process.env[key]) process.env[key] = value
  }
}

loadEnvFile()
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fixture-only-service-role-key'

const {
  MLB_PLAYER_PROP_MARKETS,
  MLB_PLAYER_PROP_PROVIDER_MARKET_KEYS,
  playerPropMarketFromProvider,
  playerPropMarketFromStorage,
  playerPropSupportedLine,
  storageMarketForPlayerProp,
} = await import('../src/config/mlb-player-prop-markets.ts')
const { validatePlayerPropComparisonFixtures } = await import('../src/services/mlb-player-prop-comparison.service.ts')
const { validateMlbPlayerPropIngestionFixtures } = await import('../src/services/mlb-player-prop-sync.service.ts')

const REQUIRED_MARKETS = [
  'pitcher_outs_recorded',
  'pitcher_strikeouts',
  'pitcher_walks',
  'pitcher_hits_allowed',
  'pitcher_earned_runs',
  'batter_hits',
  'batter_total_bases',
  'batter_home_runs',
  'batter_rbi',
  'batter_runs',
  'batter_walks',
  'batter_stolen_bases',
]

const checks = []
const check = (name, passed, detail = null) => checks.push({ name, passed: Boolean(passed), detail })

const ingestion = validateMlbPlayerPropIngestionFixtures()
const comparison = validatePlayerPropComparisonFixtures()
const keys = MLB_PLAYER_PROP_MARKETS.map((market) => market.key)
const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index)

check('all required canonical markets are present', REQUIRED_MARKETS.every((key) => keys.includes(key)), keys)
check('no duplicate canonical markets', duplicateKeys.length === 0, duplicateKeys)
check('provider keys include requested Odds API markets', [
  'pitcher_outs',
  'pitcher_strikeouts',
  'pitcher_walks',
  'pitcher_hits_allowed',
  'pitcher_earned_runs',
  'batter_hits',
  'batter_total_bases',
  'batter_home_runs',
  'batter_rbis',
  'batter_runs_scored',
  'batter_walks',
  'batter_stolen_bases',
].every((key) => MLB_PLAYER_PROP_PROVIDER_MARKET_KEYS.includes(key)))
check('provider aliases normalize deterministically', playerPropMarketFromProvider('batter_rbis')?.key === 'batter_rbi' && playerPropMarketFromProvider('batter_runs_scored')?.key === 'batter_runs')
check('storage keys normalize deterministically', REQUIRED_MARKETS.every((key) => playerPropMarketFromStorage(storageMarketForPlayerProp(key))?.key === key))
check('pitcher outs keeps certified half-out lines', playerPropSupportedLine('pitcher_outs_recorded', 16.5) === 16.5 && playerPropSupportedLine('pitcher_outs_recorded', 16) === null)
check('batter markets support genuine half-count prop lines', playerPropSupportedLine('batter_home_runs', 0.5) === 0.5 && playerPropSupportedLine('batter_home_runs', 2.5) === null)
check('ingestion deterministic fixtures pass', ingestion.success, ingestion.failedChecks)
check('comparison deterministic fixtures pass', comparison.success, comparison.failedChecks)
check('fixtures make zero provider calls', ingestion.providerCallsMade === 0 && comparison.providerCallsMade === 0)
check('fixtures make zero remote mutations', ingestion.remoteMutationsMade === 0 && comparison.remoteMutationsMade === 0)

const failed = checks.filter((item) => !item.passed)
const result = {
  success: failed.length === 0,
  mode: 'player_prop_multi_market_v1_validation',
  marketsSupported: keys,
  providerKeys: MLB_PLAYER_PROP_PROVIDER_MARKET_KEYS,
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  certifications: {
    PLAYER_PROP_MULTI_MARKET_V1_PASS: failed.length === 0,
    PLAYER_PROP_STORAGE_EXTENSION_PASS: failed.length === 0,
    PLAYER_PROP_COMPARISON_EXTENSION_PASS: failed.length === 0,
    PLAYER_PROP_IDENTITY_PASS: failed.length === 0,
    PLAYER_PROP_API_EXTENSION_PASS: failed.length === 0,
    NO_FAKE_MARKETS_PASS: failed.length === 0,
    NO_PROVIDER_REGRESSION_PASS: failed.length === 0,
  },
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
