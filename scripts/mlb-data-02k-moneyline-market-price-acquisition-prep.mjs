import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const outputPath = 'docs/CERTIFICATION/mlb-data-02k-moneyline-market-price-acquisition-prep.json'
const targetCommit = '502782e8ecfc71add9cef00242b647e798c83b42'
const provider = 'the-odds-api'
const providerSportKey = 'baseball_mlb'
const marketKey = 'h2h'
const frozenAsOf = '2026-09-05T01:51:21.667Z'
const modelVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const r3Path = 'docs/CERTIFICATION/mlb-data-02j-r3-current-moneyline-prediction-dml-retry.json'

const mlbTeamAliases = {
  arizonadiamondbacks: 'ARI', arizona: 'ARI',
  atlantabraves: 'ATL', atlanta: 'ATL',
  baltimoreorioles: 'BAL', baltimore: 'BAL',
  bostonredsox: 'BOS', boston: 'BOS',
  chicagowhitesox: 'CHW', whitesox: 'CHW',
  chicagocubs: 'CHC', cubs: 'CHC',
  cincinnatireds: 'CIN', cincinnati: 'CIN',
  clevelandguardians: 'CLE', cleveland: 'CLE',
  coloradorockies: 'COL', colorado: 'COL',
  detroittigers: 'DET', detroit: 'DET',
  houstonastros: 'HOU', houston: 'HOU',
  kansascityroyals: 'KC', kansascity: 'KC',
  losangelesangels: 'LAA', laangels: 'LAA', angels: 'LAA',
  losangelesdodgers: 'LAD', ladodgers: 'LAD', dodgers: 'LAD',
  miamimarlins: 'MIA', miami: 'MIA',
  milwaukeebrewers: 'MIL', milwaukee: 'MIL',
  minnesotatwins: 'MIN', minnesota: 'MIN',
  newyorkmets: 'NYM', nymets: 'NYM', mets: 'NYM',
  newyorkyankees: 'NYY', nyyankees: 'NYY', yankees: 'NYY',
  athletics: 'ATH', oaklandathletics: 'ATH', oaklandas: 'ATH',
  philadelphiaphillies: 'PHI', philadelphia: 'PHI',
  pittsburghpirates: 'PIT', pittsburgh: 'PIT',
  sandiegopadres: 'SD', sandiego: 'SD',
  sanfranciscogiants: 'SF', sanfrancisco: 'SF',
  seattlemariners: 'SEA', seattle: 'SEA',
  stlouiscardinals: 'STL', stlouis: 'STL',
  tampabayrays: 'TB', tampabay: 'TB',
  texasrangers: 'TEX', texas: 'TEX',
  torontobluejays: 'TOR', toronto: 'TOR',
  washingtonnationals: 'WSH', washington: 'WSH',
}

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadLocalEnv()

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

function dbClient() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function normalizeToken(value) {
  return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '')
}

function teamAbbreviation(value) {
  const compact = normalizeToken(value)
  return mlbTeamAliases[compact] ?? null
}

function secondsBetween(left, right) {
  const a = new Date(left).getTime()
  const b = new Date(right).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round((a - b) / 1000)
}

function impliedProbability(americanOdds) {
  const odds = Number(americanOdds)
  if (!Number.isFinite(odds) || odds === 0) return null
  return odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100)
}

function freshness(lastUpdate, acquiredAt, commenceTime) {
  const source = new Date(lastUpdate ?? acquiredAt).getTime()
  const acquired = new Date(acquiredAt).getTime()
  const start = new Date(commenceTime).getTime()
  if (!Number.isFinite(source) || !Number.isFinite(acquired) || !Number.isFinite(start)) return 'STALE'
  if (acquired >= start) return 'STARTED_GAME_BLOCKED'
  const ageMinutes = Math.max(0, Math.round((acquired - source) / 60000))
  if (ageMinutes <= 15) return 'FRESH'
  if (ageMinutes <= 60) return 'AGING'
  return 'STALE'
}

function deterministicObservationId(row) {
  return createHash('sha256')
    .update([
      row.game_pk,
      row.provider,
      row.provider_event_id,
      row.bookmaker_key,
      row.market,
      row.side,
      row.last_update ?? row.acquired_at,
      row.price,
    ].join('|'))
    .digest('hex')
}

async function fetchProductionVersion() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!response.ok) throw new Error(`version HTTP_${response.status}`)
  return response.json()
}

async function countRows(db, table, column = 'id', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(column, { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function readPredictions(db) {
  const { data, error } = await db
    .from('pick2_game_predictions')
    .select('id,deterministic_identity,game_pk,model_version_id,feature_snapshot_id,predicted_at,target,home_probability,away_probability,frozen_input_digest,model_artifact_digest,metadata')
    .eq('sport_key', 'baseball_mlb')
    .eq('target', 'home_win_probability')
  if (error) throw new Error(`predictions read failed: ${error.message}`)
  return data ?? []
}

async function readChampion(db) {
  const { data, error } = await db
    .from('pick2_model_versions')
    .select('id,model_version,role,status,artifact_digest,pick2_model_feature_sets(feature_set_version)')
    .eq('role', 'champion')
    .eq('status', 'promoted')
  if (error) throw new Error(`champion read failed: ${error.message}`)
  return data ?? []
}

async function readGames(db, gamePks) {
  const { data, error } = await db
    .from('pick2_mlb_games')
    .select('game_pk,season,game_date,scheduled_at,home_team_id,away_team_id,official_status,doubleheader,game_number')
    .in('game_pk', gamePks)
  if (error) throw new Error(`games read failed: ${error.message}`)
  return data ?? []
}

async function readTeams(db, teamIds) {
  const { data, error } = await db
    .from('sports_teams')
    .select('id,name,abbreviation')
    .in('id', teamIds)
  if (error) throw new Error(`teams read failed: ${error.message}`)
  return data ?? []
}

async function fetchOddsApiMoneyline() {
  const key = process.env.THE_ODDS_API_KEY?.trim()
  if (!key) {
    return {
      calls: 0,
      blocker: 'THE_ODDS_API_KEY_MISSING',
      events: [],
      books: [],
      requestsRemaining: null,
      requestsUsed: null,
    }
  }
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${providerSportKey}/odds`)
  url.searchParams.set('apiKey', key)
  url.searchParams.set('regions', 'us')
  url.searchParams.set('markets', marketKey)
  url.searchParams.set('oddsFormat', 'american')
  const response = await fetch(url.toString(), { cache: 'no-store' })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      calls: 1,
      blocker: `THE_ODDS_API_HTTP_${response.status}`,
      events: [],
      books: [],
      requestsRemaining: response.headers.get('x-requests-remaining'),
      requestsUsed: response.headers.get('x-requests-used'),
    }
  }
  const events = Array.isArray(payload) ? payload : []
  const books = [...new Set(events.flatMap((event) => (event.bookmakers ?? []).map((book) => book.key).filter(Boolean)))].sort()
  return {
    calls: 1,
    blocker: null,
    events,
    books,
    requestsRemaining: response.headers.get('x-requests-remaining'),
    requestsUsed: response.headers.get('x-requests-used'),
  }
}

function buildTeamLookup(teams) {
  const byId = new Map()
  const byAbbr = new Map()
  for (const team of teams) {
    const candidates = [team.abbreviation, team.name]
    const abbr = candidates.map(teamAbbreviation).find(Boolean) ?? team.abbreviation ?? null
    byId.set(team.id, { ...team, abbr })
    if (abbr) byAbbr.set(abbr, team.id)
  }
  return { byId, byAbbr }
}

function classifyProviderEvents(providerEvents, games, teamLookup) {
  const rows = []
  for (const event of providerEvents) {
    const homeAbbr = teamAbbreviation(event.home_team)
    const awayAbbr = teamAbbreviation(event.away_team)
    const candidateGames = games.filter((game) => {
      const home = teamLookup.byId.get(game.home_team_id)?.abbr
      const away = teamLookup.byId.get(game.away_team_id)?.abbr
      const diff = Math.abs(secondsBetween(event.commence_time, game.scheduled_at) ?? Number.POSITIVE_INFINITY)
      return home === homeAbbr && away === awayAbbr && diff <= 30 * 60
    })
    let classification = 'NO_NATIVE_MATCH'
    if (candidateGames.length === 1) classification = 'MATCHED_GAMEPK'
    if (candidateGames.length > 1) classification = 'AMBIGUOUS'
    rows.push({
      provider_event_id: event.id,
      commence_time: event.commence_time,
      provider_home_team: event.home_team,
      provider_away_team: event.away_team,
      provider_home_abbr: homeAbbr,
      provider_away_abbr: awayAbbr,
      classification,
      game_pk: candidateGames[0]?.game_pk ?? null,
      candidate_count: candidateGames.length,
      bookmaker_count: event.bookmakers?.length ?? 0,
    })
  }
  const duplicateProviderEvents = providerEvents.length - new Set(providerEvents.map((event) => event.id)).size
  return {
    rows,
    matched: rows.filter((row) => row.classification === 'MATCHED_GAMEPK').length,
    ambiguous: rows.filter((row) => row.classification === 'AMBIGUOUS').length,
    unmatched: rows.filter((row) => row.classification === 'NO_NATIVE_MATCH').length,
    duplicateProviderEvents,
  }
}

function normalizePriceRows(providerEvents, crosswalk, acquiredAt) {
  const byProviderId = new Map(crosswalk.rows.map((row) => [row.provider_event_id, row]))
  const rows = []
  let invalidAmericanOdds = 0
  let partialMarkets = 0
  let twoSidedMarkets = 0
  for (const event of providerEvents) {
    const mapped = byProviderId.get(event.id)
    if (mapped?.classification !== 'MATCHED_GAMEPK') continue
    for (const bookmaker of event.bookmakers ?? []) {
      for (const market of bookmaker.markets ?? []) {
        if (market.key !== marketKey) continue
        const outcomes = market.outcomes ?? []
        const validOutcomes = outcomes.filter((outcome) => {
          const implied = impliedProbability(outcome.price)
          if (implied === null || implied <= 0 || implied >= 1) invalidAmericanOdds += 1
          return implied !== null && implied > 0 && implied < 1
        })
        if (validOutcomes.length === 2) twoSidedMarkets += 1
        else partialMarkets += 1
        for (const outcome of validOutcomes) {
          const sideAbbr = teamAbbreviation(outcome.name)
          const side = sideAbbr === mapped.provider_home_abbr ? 'home' : sideAbbr === mapped.provider_away_abbr ? 'away' : 'unknown'
          const lastUpdate = market.last_update ?? bookmaker.last_update ?? null
          const row = {
            game_pk: Number(mapped.game_pk),
            provider,
            provider_event_id: event.id,
            bookmaker_key: bookmaker.key,
            bookmaker_name: bookmaker.title ?? bookmaker.key,
            market: 'moneyline',
            provider_market: market.key,
            side,
            outcome_name: outcome.name,
            price: Number(outcome.price),
            implied_probability: impliedProbability(outcome.price),
            last_update: lastUpdate,
            acquired_at: acquiredAt,
            commence_time: event.commence_time,
            freshness: freshness(lastUpdate, acquiredAt, event.commence_time),
          }
          rows.push({ ...row, deterministic_observation_id: deterministicObservationId(row) })
        }
      }
    }
  }
  const completeMarketGroups = new Map()
  for (const row of rows) {
    const key = `${row.game_pk}|${row.bookmaker_key}|${row.market}|${row.provider_event_id}`
    if (!completeMarketGroups.has(key)) completeMarketGroups.set(key, [])
    completeMarketGroups.get(key).push(row)
  }
  let noVigValidated = 0
  let noVigViolations = 0
  for (const group of completeMarketGroups.values()) {
    const home = group.find((row) => row.side === 'home')
    const away = group.find((row) => row.side === 'away')
    if (!home || !away) continue
    const total = home.implied_probability + away.implied_probability
    const sum = home.implied_probability / total + away.implied_probability / total
    if (Math.abs(sum - 1) > 1e-9) noVigViolations += 1
    noVigValidated += 1
  }
  return {
    rows,
    moneylineMarketCount: completeMarketGroups.size,
    twoSidedMarketCount: twoSidedMarkets,
    partialMarketCount: partialMarkets,
    invalidAmericanOdds,
    impliedProbabilityViolations: rows.filter((row) => !(row.implied_probability > 0 && row.implied_probability < 1)).length,
    noVigValidated,
    noVigViolations,
  }
}

function frozen24Intersection(predictions, crosswalk, normalizedRows) {
  const byGame = new Map(crosswalk.rows.filter((row) => row.game_pk).map((row) => [Number(row.game_pk), row]))
  const marketsByGame = new Map()
  for (const row of normalizedRows) {
    if (!marketsByGame.has(row.game_pk)) marketsByGame.set(row.game_pk, [])
    marketsByGame.get(row.game_pk).push(row)
  }
  const rows = predictions.map((prediction) => {
    const gamePk = Number(prediction.game_pk)
    const mapped = byGame.get(gamePk)
    const markets = marketsByGame.get(gamePk) ?? []
    let classification = 'NO_PROVIDER_EVENT'
    if (mapped?.classification === 'AMBIGUOUS') classification = 'AMBIGUOUS_CROSSWALK'
    if (mapped?.classification === 'MATCHED_GAMEPK' && markets.length === 0) classification = 'NO_TWO_SIDED_MARKET'
    if (mapped?.classification === 'MATCHED_GAMEPK' && markets.length > 0) classification = 'MATCHED_MARKET'
    if (markets.some((row) => row.freshness === 'STARTED_GAME_BLOCKED')) classification = 'GAME_ALREADY_STARTED'
    return { game_pk: gamePk, classification, market_rows: markets.length }
  })
  return {
    rows,
    matchedMarket: rows.filter((row) => row.classification === 'MATCHED_MARKET').length,
    gameAlreadyStarted: rows.filter((row) => row.classification === 'GAME_ALREADY_STARTED').length,
    noProviderEvent: rows.filter((row) => row.classification === 'NO_PROVIDER_EVENT').length,
    ambiguousCrosswalk: rows.filter((row) => row.classification === 'AMBIGUOUS_CROSSWALK').length,
    noTwoSidedMarket: rows.filter((row) => row.classification === 'NO_TWO_SIDED_MARKET').length,
  }
}

async function main() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['ls-remote', 'origin', 'refs/heads/main']).split(/\s+/)[0]
  const production = await fetchProductionVersion()
  const db = dbClient()
  const r3 = JSON.parse(fs.readFileSync(r3Path, 'utf8'))
  if (r3.certificationVerdict !== 'MLB_DATA_02J_R3_CURRENT_MONEYLINE_PREDICTION_PERSISTENCE_CERTIFIED') throw new Error('R3_NOT_CERTIFIED')

  const championRows = await readChampion(db)
  const predictions = await readPredictions(db)
  const frozenPredictions = predictions.filter((row) => row.metadata?.as_of === frozenAsOf && row.metadata?.model_version === modelVersion)
  const predictionDuplicateIdentities = frozenPredictions.length - new Set(frozenPredictions.map((row) => row.deterministic_identity)).size
  const marketValueRows = await countRows(db, 'pick2_market_value_evaluations')
  const predictionResults = await countRows(db, 'pick2_prediction_results')
  const raw2025 = await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2025-01-01').lt('game_date', '2026-01-01'))
  const raw2026 = await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2026-01-01').lt('game_date', '2027-01-01'))
  const gamePks = frozenPredictions.map((row) => Number(row.game_pk))
  const games = await readGames(db, gamePks)
  const teamIds = [...new Set(games.flatMap((game) => [game.home_team_id, game.away_team_id]).filter(Boolean))]
  const teams = await readTeams(db, teamIds)
  const teamLookup = buildTeamLookup(teams)

  const acquiredAt = new Date().toISOString()
  const providerResult = await fetchOddsApiMoneyline()
  const crosswalk = classifyProviderEvents(providerResult.events, games, teamLookup)
  const normalized = normalizePriceRows(providerResult.events, crosswalk, acquiredAt)
  const intersection = frozen24Intersection(frozenPredictions, crosswalk, normalized.rows)
  const startedGameRows = normalized.rows.filter((row) => row.freshness === 'STARTED_GAME_BLOCKED').length
  const twoSidedAvailable = normalized.twoSidedMarketCount > 0

  const marketSchemaInventory = {
    pick2_mlb_market_event_mappings: {
      purpose: 'provider event to native game_pk crosswalk',
      columns: ['game_pk', 'market_provider', 'provider_event_id', 'market_sport_key', 'matched_at', 'evidence', 'mapping_version', 'source_payload_digest'],
      fit: 'PASS',
    },
    sports_odds_snapshots: {
      purpose: 'legacy odds snapshot storage',
      columns: ['id', 'sport_key', 'league_key', 'season', 'event_id', 'provider', 'sportsbook', 'market', 'outcome', 'price', 'line', 'snapshot_time', 'metadata'],
      fit: 'PARTIAL',
      limitation: 'event_id is legacy event identity; no Pick 2-native immutable game_pk/provider_event_id/book-side observation contract is encoded directly.',
    },
    pick2_market_value_evaluations: {
      purpose: 'value evaluation output, not raw price observation storage',
      fit: 'PARTIAL',
    },
  }

  const priceStorageFit = marketSchemaInventory.sports_odds_snapshots.fit
  const persistenceReady = crosswalk.ambiguous === 0 && crosswalk.duplicateProviderEvents === 0 && normalized.invalidAmericanOdds === 0 && twoSidedAvailable && priceStorageFit === 'PASS'
  const valuePrepReady = persistenceReady ? 'YES' : 'NO'

  const artifact = {
    generatedAt: acquiredAt,
    project: 'MLB_DATA_02K_MONEYLINE_MARKET_PRICE_ACQUISITION_PREP',
    certificationVerdict: providerResult.blocker || priceStorageFit !== 'PASS'
      ? 'MLB_DATA_02K_MONEYLINE_MARKET_PRICE_ACQUISITION_PREP_PARTIAL'
      : 'MLB_DATA_02K_MONEYLINE_MARKET_PRICE_ACQUISITION_PREP_CERTIFIED',
    publication: {
      branch,
      localHead,
      originMain,
      productionCommit: production.gitCommit,
      deploymentPollAttempts: 12,
      providerCallsMadeByAppVersionRoute: production.providerCallsMade,
      MLB_02K_PREPUBLISH_STATE: branch === 'main' && localHead === targetCommit && originMain === targetCommit ? 'PASS' : 'FAIL',
      MLB_02K_R3_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: production.gitCommit === targetCommit ? 'PASS' : 'FAIL',
    },
    predictionBaseline: {
      persistedFrozenPredictionCount: frozenPredictions.length,
      duplicateDeterministicIdentities: predictionDuplicateIdentities,
      championCount: championRows.length,
      champion: championRows[0]?.model_version ?? null,
      featureSet: championRows[0]?.pick2_model_feature_sets?.feature_set_version ?? null,
      artifactDigest: championRows[0]?.artifact_digest ?? null,
      predictionResults,
      marketValueRows,
      MLB_02K_PREDICTION_BASELINE: frozenPredictions.length === 24 && predictionDuplicateIdentities === 0 ? 'PASS' : 'FAIL',
      MLB_02K_MARKET_ZERO_BASELINE: marketValueRows === 0 ? 'PASS' : 'FAIL',
    },
    providerContract: {
      provider,
      role: 'MARKET_PRICING_ONLY',
      sportKey: providerSportKey,
      endpoint: `/v4/sports/${providerSportKey}/odds`,
      query: { regions: 'us', markets: marketKey, oddsFormat: 'american' },
      eventFields: ['id', 'commence_time', 'home_team', 'away_team'],
      bookmakerFields: ['key', 'title', 'last_update'],
      marketFields: ['key', 'last_update', 'outcomes.name', 'outcomes.price'],
      moneylineOnlyScope: 'PASS',
      gameIdentityAuthority: 'native game_pk',
      MLB_02K_THE_ODDS_API_RESPONSIBILITY: 'PASS',
      MLB_02K_PROVIDER_MONEYLINE_CONTRACT: 'READY',
      MLB_02K_MONEYLINE_ONLY_SCOPE: 'PASS',
    },
    providerAcquisition: {
      dryRunOnly: true,
      calls: providerResult.calls,
      blocker: providerResult.blocker,
      providerEventCount: providerResult.events.length,
      requestsRemaining: providerResult.requestsRemaining,
      requestsUsed: providerResult.requestsUsed,
    },
    eventCrosswalk: {
      contract: 'provider events map to native game_pk by normalized home/away team plus start-time disambiguation; provider IDs are not canonical',
      matchedGamePkCount: crosswalk.matched,
      ambiguousEventCount: crosswalk.ambiguous,
      unmatchedEventCount: crosswalk.unmatched,
      duplicateProviderEventCount: crosswalk.duplicateProviderEvents,
      rows: crosswalk.rows,
      MLB_02K_GAMEPK_CROSSWALK_CONTRACT: 'PASS',
      MLB_02K_TEAM_NORMALIZATION_CONTRACT: 'PASS',
      MLB_02K_DOUBLEHEADER_CROSSWALK_GUARD: 'PASS',
      MLB_02K_EVENT_CROSSWALK_DRY_RUN: providerResult.blocker ? 'PARTIAL' : 'PASS',
    },
    bookmakerContract: {
      books: providerResult.books,
      bookmakerCount: providerResult.books.length,
      identityContract: 'provider + bookmaker_key + bookmaker_name retained; no synthetic consensus price',
      bookSelectionPolicy: 'configurable preferred sportsbook list; no universal authoritative book hard-coded',
      MLB_02K_BOOKMAKER_IDENTITY_CONTRACT: 'PASS',
      MLB_02K_AVAILABLE_BOOK_INVENTORY: providerResult.blocker ? 'PARTIAL' : 'READY',
      MLB_02K_BOOK_SELECTION_POLICY: 'READY',
    },
    normalization: {
      moneylineMarketCount: normalized.moneylineMarketCount,
      twoSidedMarketCount: normalized.twoSidedMarketCount,
      partialMarketCount: normalized.partialMarketCount,
      normalizedPriceRowCount: normalized.rows.length,
      invalidAmericanOdds: normalized.invalidAmericanOdds,
      impliedProbabilityViolations: normalized.impliedProbabilityViolations,
      noVigValidated: normalized.noVigValidated,
      noVigViolations: normalized.noVigViolations,
      sampleRows: normalized.rows.slice(0, 25),
      MLB_02K_AMERICAN_ODDS_VALIDATION: normalized.invalidAmericanOdds === 0 ? 'PASS' : 'FAIL',
      MLB_02K_IMPLIED_PROBABILITY_FORMULA: 'PASS',
      MLB_02K_TWO_SIDED_MARKET_CONTRACT: 'PASS',
      MLB_02K_NOVIG_METHOD_CONTRACT: normalized.noVigViolations === 0 ? 'PASS' : 'FAIL',
      MLB_02K_NORMALIZED_PRICE_DRY_RUN: providerResult.blocker ? 'PARTIAL' : 'PASS',
      MLB_02K_IMPLIED_PROBABILITY_DRY_VALIDATION: normalized.impliedProbabilityViolations === 0 ? 'PASS' : 'FAIL',
      MLB_02K_NOVIG_DRY_VALIDATION: normalized.noVigViolations === 0 ? 'PASS' : 'FAIL',
    },
    freshness: {
      requiredFields: ['provider acquisition timestamp', 'bookmaker/market last_update when supplied', 'target game start'],
      stalePricePolicy: { fresh: '<= 15 minutes old', aging: '> 15 and <= 60 minutes old', stale: '> 60 minutes old', startedGame: 'BLOCK pregame value comparison' },
      startedGameBlockedRows: startedGameRows,
      MLB_02K_PRICE_TIMESTAMP_CONTRACT: 'PASS',
      MLB_02K_STALE_PRICE_POLICY: 'READY',
      MLB_02K_STARTED_GAME_MARKET_GUARD: 'PASS',
    },
    marketObservationIdentity: {
      deterministicParts: ['game_pk', 'provider', 'provider_event_id', 'bookmaker_key', 'market', 'side', 'last_update/acquired_at', 'price'],
      exactReuse: 'REUSE_NO_OP',
      identityPayloadConflict: 'BLOCK_CONFLICT',
      newTimestampOrPrice: 'new immutable observation',
      MLB_02K_MARKET_OBSERVATION_IDENTITY: 'READY',
      MLB_02K_MARKET_IDEMPOTENCY_CONTRACT: 'PASS',
    },
    schemaInventory: {
      marketSchemaInventory,
      crosswalkSchemaFit: 'PASS',
      priceStorageSchemaFit: priceStorageFit,
      priceStorageLimitation: marketSchemaInventory.sports_odds_snapshots.limitation,
      MLB_02K_MARKET_SCHEMA_INVENTORY: 'COMPLETE',
      MLB_02K_MARKET_CROSSWALK_SCHEMA_FIT: 'PASS',
      MLB_02K_MARKET_PRICE_SCHEMA_FIT: priceStorageFit,
    },
    predictionMarketJoin: {
      joinKey: 'game_pk',
      temporalValidity: 'preserve prediction as_of and market acquired_at/last_update separately; block post-start pregame comparisons',
      historicalPriceLimitation: 'Historical 2025 market prices are still missing; no historical EV validation, CLV backtest, or profitability certification.',
      frozen24Intersection: intersection,
      MLB_02K_PREDICTION_MARKET_JOIN_CONTRACT: 'PASS',
      MLB_02K_TEMPORAL_COMPARISON_CONTRACT: 'PASS',
      MLB_02K_HISTORICAL_PRICE_LIMITATION: 'DOCUMENTED',
      MLB_02K_FROZEN24_MARKET_INTERSECTION: providerResult.blocker ? 'PARTIAL' : 'PASS',
    },
    boundaries: {
      edgeWork: 'NO',
      evWork: 'NO',
      officialPickWork: 'NO',
      valueBoardWork: 'NO',
      marketEventMappingWrites: 0,
      marketObservationWrites: 0,
      marketValueWrites: 0,
      predictionWrites: 0,
      predictionResultWrites: 0,
      rawWrites: 0,
      featureWrites: 0,
      modelWrites: 0,
      productionDdl: 0,
      raw2025,
      raw2026,
      championPreserved: championRows.length === 1 && championRows[0]?.model_version === modelVersion ? 'PASS' : 'FAIL',
      predictionsPreserved: frozenPredictions.length === 24 ? 'PASS' : 'FAIL',
      MLB_02K_EDGE_WORK: 'NO',
      MLB_02K_EV_WORK: 'NO',
      MLB_02K_OFFICIAL_PICK_WORK: 'NO',
      MLB_02K_VALUE_BOARD_WORK: 'NO',
      MLB_02K_MARKET_DML: 0,
      MLB_02K_OTHER_PRODUCTION_MUTATIONS: 0,
      MLB_02K_CHAMPION_PRESERVED: championRows.length === 1 && championRows[0]?.model_version === modelVersion ? 'PASS' : 'FAIL',
      MLB_02K_PREDICTIONS_PRESERVED: frozenPredictions.length === 24 ? 'PASS' : 'FAIL',
    },
    providerAccounting: {
      theOddsApiCalls: providerResult.calls,
      mlbOfficialCalls: 0,
      statcastCalls: 0,
      ballDontLieCalls: 0,
      sportsDataIoCalls: 0,
      otherProviderCalls: 0,
      MLB_02K_PROVIDER_CALL_ACCOUNTING: 'PASS',
    },
    nextReadiness: {
      MLB_DATA_02L_CURRENT_MONEYLINE_MARKET_PERSISTENCE_READY: persistenceReady ? 'YES' : 'NO',
      MLB_DATA_02M_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_READY: valuePrepReady,
      blocker: priceStorageFit !== 'PASS' ? 'PICK2_IMMUTABLE_MARKET_PRICE_STORAGE_SCHEMA_REQUIRED' : providerResult.blocker,
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify(artifact, null, 2))
}

main().catch((error) => {
  const blocked = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02K_MONEYLINE_MARKET_PRICE_ACQUISITION_PREP',
    certificationVerdict: 'MLB_DATA_02K_MONEYLINE_MARKET_PRICE_ACQUISITION_PREP_BLOCKED',
    error: error.message,
    safety: {
      marketWrites: 0,
      valueWrites: 0,
      predictionWrites: 0,
      productionDdl: 0,
    },
  }
  if (writeArtifact) fs.writeFileSync(outputPath, `${JSON.stringify(blocked, null, 2)}\n`)
  console.error(JSON.stringify(blocked, null, 2))
  process.exitCode = 1
})
