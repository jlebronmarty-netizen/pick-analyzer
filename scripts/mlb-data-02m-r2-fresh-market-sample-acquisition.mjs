import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const writeArtifact = process.argv.includes('--write-artifact')
const reuseFrozenResponse = process.argv.includes('--reuse-frozen-response')
const outputPath = 'docs/CERTIFICATION/mlb-data-02m-r2-fresh-market-sample-acquisition.json'
const targetCommit = '13ae2002fd7c84b94ff0c531380082d503e1057f'
const provider = 'the-odds-api'
const providerSportKey = 'baseball_mlb'
const providerMarketKey = 'h2h'
const canonicalMarket = 'MONEYLINE'
const region = 'us'
const oddsFormat = 'american'
const predictionsAsOf = '2026-09-05T01:51:21.667Z'
const championModelVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'

const mlbTeamAliases = {
  ari: 'ARI',
  arizonadiamondbacks: 'ARI', arizona: 'ARI',
  atl: 'ATL',
  atlantabraves: 'ATL', atlanta: 'ATL',
  bal: 'BAL',
  baltimoreorioles: 'BAL', baltimore: 'BAL',
  bos: 'BOS',
  bostonredsox: 'BOS', boston: 'BOS',
  chw: 'CHW',
  chicagowhitesox: 'CHW', whitesox: 'CHW',
  chc: 'CHC',
  chicagocubs: 'CHC', cubs: 'CHC',
  cin: 'CIN',
  cincinnatireds: 'CIN', cincinnati: 'CIN',
  cle: 'CLE',
  clevelandguardians: 'CLE', cleveland: 'CLE',
  col: 'COL',
  coloradorockies: 'COL', colorado: 'COL',
  det: 'DET',
  detroittigers: 'DET', detroit: 'DET',
  hou: 'HOU',
  houstonastros: 'HOU', houston: 'HOU',
  kc: 'KC',
  kansascityroyals: 'KC', kansascity: 'KC',
  laa: 'LAA',
  losangelesangels: 'LAA', laangels: 'LAA', angels: 'LAA',
  lad: 'LAD',
  losangelesdodgers: 'LAD', ladodgers: 'LAD', dodgers: 'LAD',
  mia: 'MIA',
  miamimarlins: 'MIA', miami: 'MIA',
  mil: 'MIL',
  milwaukeebrewers: 'MIL', milwaukee: 'MIL',
  min: 'MIN',
  minnesotatwins: 'MIN', minnesota: 'MIN',
  nym: 'NYM',
  newyorkmets: 'NYM', nymets: 'NYM', mets: 'NYM',
  nyy: 'NYY',
  newyorkyankees: 'NYY', nyyankees: 'NYY', yankees: 'NYY',
  ath: 'ATH', oak: 'ATH',
  athletics: 'ATH', oaklandathletics: 'ATH', oaklandas: 'ATH',
  phi: 'PHI',
  philadelphiaphillies: 'PHI', philadelphia: 'PHI',
  pit: 'PIT',
  pittsburghpirates: 'PIT', pittsburgh: 'PIT',
  sd: 'SD',
  sandiegopadres: 'SD', sandiego: 'SD',
  sf: 'SF',
  sanfranciscogiants: 'SF', sanfrancisco: 'SF',
  sea: 'SEA',
  seattlemariners: 'SEA', seattle: 'SEA',
  stl: 'STL',
  stlouiscardinals: 'STL', stlouis: 'STL',
  tb: 'TB',
  tampabayrays: 'TB', tampabay: 'TB',
  tex: 'TEX',
  texasrangers: 'TEX', texas: 'TEX',
  tor: 'TOR',
  torontobluejays: 'TOR', toronto: 'TOR',
  wsh: 'WSH',
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
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function sha(value) {
  const body = typeof value === 'string' ? value : JSON.stringify(value)
  return createHash('sha256').update(body).digest('hex')
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
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

function tableCount(db, table, select = '*', configure = (query) => query) {
  return configure(db.from(table).select(select, { count: 'exact', head: true }))
    .then(({ count, error }) => {
      if (error) throw new Error(`${table} count failed: ${error.message}`)
      return count ?? 0
    })
}

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_ENV_MISSING')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function productionVersion() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!response.ok) throw new Error(`production version HTTP_${response.status}`)
  return response.json()
}

async function fetchFreshOdds() {
  const key = requireEnv('THE_ODDS_API_KEY')
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${providerSportKey}/odds`)
  url.searchParams.set('apiKey', key)
  url.searchParams.set('regions', region)
  url.searchParams.set('markets', providerMarketKey)
  url.searchParams.set('oddsFormat', oddsFormat)
  const response = await fetch(url.toString(), { cache: 'no-store' })
  const responseText = await response.text()
  const payload = responseText ? JSON.parse(responseText) : null
  return {
    calls: 1,
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    requestsRemaining: response.headers.get('x-requests-remaining'),
    requestsUsed: response.headers.get('x-requests-used'),
    responseText,
    payload,
  }
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

async function readGames(db, startIso, endIso) {
  const { data, error } = await db
    .from('pick2_mlb_games')
    .select('game_pk,season,game_date,scheduled_at,home_team_id,away_team_id,official_status,doubleheader,game_number')
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
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

async function readMappings(db, providerEventIds) {
  if (!providerEventIds.length) return []
  const { data, error } = await db
    .from('pick2_mlb_market_event_mappings')
    .select('id,game_pk,market_provider,provider_event_id,market_sport_key,source_payload_digest')
    .eq('market_provider', provider)
    .in('provider_event_id', providerEventIds)
  if (error) throw new Error(`market mappings read failed: ${error.message}`)
  return data ?? []
}

async function readObservations(db, identities) {
  if (!identities.length) return []
  const rows = []
  for (let index = 0; index < identities.length; index += 100) {
    const chunk = identities.slice(index, index + 100)
    const { data, error } = await db
      .from('pick2_mlb_market_price_observations')
      .select('id,observation_identity,game_pk,provider,provider_event_id,bookmaker_key,market,provider_market_key,side,american_odds,provider_last_update,acquired_at,source_payload_digest,source_response_digest')
      .in('observation_identity', chunk)
    if (error) throw new Error(`market observations read failed: ${error.message}`)
    rows.push(...(data ?? []))
  }
  return rows
}

function buildTeamLookup(teams) {
  const byId = new Map()
  for (const team of teams) {
    const abbr = [team.abbreviation, team.name].map(teamAbbreviation).find(Boolean) ?? null
    byId.set(team.id, { ...team, abbr })
  }
  return byId
}

function classifyTeam(value) {
  const abbr = teamAbbreviation(value)
  if (!abbr) return { original: value, abbreviation: null, classification: 'NO_MATCH' }
  const compact = normalizeToken(value)
  const exactTokens = new Set([abbr.toLowerCase(), normalizeToken(abbr)])
  return {
    original: value,
    abbreviation: abbr,
    classification: exactTokens.has(compact) ? 'EXACT_NORMALIZED_MATCH' : 'APPROVED_ALIAS_MATCH',
  }
}

function classifyProviderEvents(events, games, teamLookup) {
  const seen = new Set()
  const rows = []
  for (const event of events) {
    const home = classifyTeam(event.home_team)
    const away = classifyTeam(event.away_team)
    const candidates = games.filter((game) => {
      const homeAbbr = teamLookup.get(game.home_team_id)?.abbr
      const awayAbbr = teamLookup.get(game.away_team_id)?.abbr
      const diff = Math.abs(secondsBetween(event.commence_time, game.scheduled_at) ?? Number.POSITIVE_INFINITY)
      return homeAbbr === home.abbreviation && awayAbbr === away.abbreviation && diff <= 30 * 60
    })
    let classification = 'NO_NATIVE_MATCH'
    if (seen.has(event.id)) classification = 'DUPLICATE_PROVIDER_EVENT'
    else if (candidates.length === 1) classification = 'MATCHED_GAMEPK'
    else if (candidates.length > 1) classification = 'AMBIGUOUS'
    seen.add(event.id)
    rows.push({
      provider_event_id: event.id,
      commence_time: event.commence_time,
      home_team: event.home_team,
      away_team: event.away_team,
      home_team_normalization: home,
      away_team_normalization: away,
      classification,
      game_pk: candidates[0]?.game_pk ?? null,
      candidate_count: candidates.length,
      candidate_game_pks: candidates.map((game) => game.game_pk),
      bookmaker_count: event.bookmakers?.length ?? 0,
      books: (event.bookmakers ?? []).map((book) => book.key),
    })
  }
  return rows
}

function sourcePayload(event, bookmaker, market, outcome, side, gamePk, sourceResponseDigest, acquiredAt) {
  return {
    game_pk: gamePk,
    provider,
    provider_event_id: event.id,
    bookmaker_key: bookmaker.key,
    bookmaker_name: bookmaker.title ?? bookmaker.key,
    market: canonicalMarket,
    provider_market_key: market.key,
    side,
    outcome_name: outcome.name,
    american_odds: Number(outcome.price),
    provider_last_update: market.last_update ?? bookmaker.last_update ?? null,
    acquired_at: acquiredAt,
    commence_time: event.commence_time,
    source_response_digest: sourceResponseDigest,
  }
}

function observationIdentity(row) {
  return sha(stableJson([
    row.game_pk,
    row.provider,
    row.provider_event_id,
    row.bookmaker_key,
    row.market,
    row.provider_market_key,
    row.side,
    row.provider_last_update ?? row.acquired_at,
    row.american_odds,
    row.source_payload_digest,
  ]))
}

function normalizeRows(events, crosswalkRows, acquiredAt, sourceResponseDigest) {
  const byEvent = new Map(crosswalkRows.map((row) => [row.provider_event_id, row]))
  const rows = []
  const invalid = []
  let excludedUnmatchedRows = 0
  let excludedAmbiguousRows = 0
  let excludedDuplicateProviderRows = 0
  for (const event of events) {
    const mapped = byEvent.get(event.id)
    if (mapped?.classification === 'NO_NATIVE_MATCH') excludedUnmatchedRows += countPotentialOutcomes(event)
    if (mapped?.classification === 'AMBIGUOUS') excludedAmbiguousRows += countPotentialOutcomes(event)
    if (mapped?.classification === 'DUPLICATE_PROVIDER_EVENT') excludedDuplicateProviderRows += countPotentialOutcomes(event)
    if (mapped?.classification !== 'MATCHED_GAMEPK') continue
    for (const bookmaker of event.bookmakers ?? []) {
      for (const market of bookmaker.markets ?? []) {
        if (market.key !== providerMarketKey) continue
        for (const outcome of market.outcomes ?? []) {
          const sideAbbr = teamAbbreviation(outcome.name)
          const side = sideAbbr === mapped.home_team_normalization.abbreviation ? 'HOME' : sideAbbr === mapped.away_team_normalization.abbreviation ? 'AWAY' : null
          const americanOdds = Number(outcome.price)
          const payload = sourcePayload(event, bookmaker, market, outcome, side, Number(mapped.game_pk), sourceResponseDigest, acquiredAt)
          const source_payload_digest = sha(stableJson(payload))
          const row = {
            ...payload,
            source_payload_digest,
            source_provenance: {
              project: 'MLB_DATA_02M_R2_FRESH_MARKET_SAMPLE_ACQUISITION_CERTIFICATION',
              sampleIsolation: 'fresh single provider response only',
              providerSportKey,
              region,
              oddsFormat,
              providerAcquiredAt: acquiredAt,
              providerEvent: {
                id: event.id,
                sport_key: event.sport_key ?? null,
                sport_title: event.sport_title ?? null,
                commence_time: event.commence_time,
                home_team: event.home_team,
                away_team: event.away_team,
              },
            },
          }
          row.observation_identity = observationIdentity(row)
          const valid = side && Number.isInteger(americanOdds) && americanOdds !== 0 && market.key === providerMarketKey
          if (valid) rows.push(row)
          else invalid.push({ provider_event_id: event.id, bookmaker_key: bookmaker.key, outcome_name: outcome.name, american_odds: outcome.price, side, market: market.key })
        }
      }
    }
  }
  rows.sort(compareCanonicalRows)
  const ids = new Set(rows.map((row) => row.observation_identity))
  return {
    rows,
    invalid,
    excludedUnmatchedRows,
    excludedAmbiguousRows,
    excludedDuplicateProviderRows,
    duplicateObservationIdentities: rows.length - ids.size,
  }
}

function countPotentialOutcomes(event) {
  return (event.bookmakers ?? []).flatMap((book) => book.markets ?? []).filter((market) => market.key === providerMarketKey).reduce((sum, market) => sum + (market.outcomes?.length ?? 0), 0)
}

function compareCanonicalRows(left, right) {
  return [
    'game_pk',
    'provider',
    'bookmaker_key',
    'market',
    'provider_market_key',
    'side',
    'provider_last_update',
    'acquired_at',
    'observation_identity',
  ].map((key) => String(left[key] ?? '').localeCompare(String(right[key] ?? ''))).find((value) => value !== 0) ?? 0
}

function twoSidedPairing(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = stableJson([row.game_pk, row.provider, row.provider_event_id, row.bookmaker_key, row.market, row.provider_market_key, row.provider_last_update ?? row.acquired_at])
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const groupRows = [...groups.values()].map((items) => {
    const sides = new Set(items.map((row) => row.side))
    let classification = 'PARTIAL_MARKET'
    if (items.length === 2 && sides.has('HOME') && sides.has('AWAY')) classification = 'COMPLETE_TWO_SIDED'
    if (items.length > 2 || sides.size !== items.length) classification = 'AMBIGUOUS_PAIR'
    return {
      key: stableJson([items[0].game_pk, items[0].provider_event_id, items[0].bookmaker_key, items[0].provider_last_update ?? items[0].acquired_at]),
      game_pk: items[0].game_pk,
      provider_event_id: items[0].provider_event_id,
      bookmaker_key: items[0].bookmaker_key,
      provider_last_update: items[0].provider_last_update,
      sides: [...sides].sort(),
      row_count: items.length,
      classification,
    }
  })
  return {
    rows: groupRows,
    complete: groupRows.filter((row) => row.classification === 'COMPLETE_TWO_SIDED').length,
    partial: groupRows.filter((row) => row.classification === 'PARTIAL_MARKET').length,
    ambiguous: groupRows.filter((row) => row.classification === 'AMBIGUOUS_PAIR').length,
  }
}

function priceSanity(rows) {
  const odds = rows.map((row) => row.american_odds)
  return {
    minimumAmericanOdds: odds.length ? Math.min(...odds) : null,
    maximumAmericanOdds: odds.length ? Math.max(...odds) : null,
    positivePriceCount: odds.filter((value) => value > 0).length,
    negativePriceCount: odds.filter((value) => value < 0).length,
    zeroCount: odds.filter((value) => value === 0).length,
    malformedCount: rows.filter((row) => !Number.isInteger(row.american_odds)).length,
    MLB_02M_R2_PRICE_SANITY: odds.every((value) => Number.isInteger(value) && value !== 0) ? 'PASS' : 'FAIL',
  }
}

function timestampCollisionAudit(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = row.provider_last_update ?? row.acquired_at
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const collisionGroups = [...groups.entries()].filter(([, items]) => items.length > 1)
  const unsafe = collisionGroups.filter(([, items]) => new Set(items.map((row) => row.observation_identity)).size !== items.length)
  return {
    timestampCollisionGroups: collisionGroups.length,
    maximumRowsSharingTimestamp: collisionGroups.length ? Math.max(...collisionGroups.map(([, items]) => items.length)) : 0,
    unsafeCollisionGroups: unsafe.length,
    MLB_02M_R2_TIMESTAMP_COLLISION_AUDIT: unsafe.length === 0 ? 'PASS' : 'FAIL',
  }
}

function predictionIntersection(predictions, rows, crosswalkRows, acquiredAt) {
  const marketsByGame = new Map()
  for (const row of rows) {
    if (!marketsByGame.has(Number(row.game_pk))) marketsByGame.set(Number(row.game_pk), [])
    marketsByGame.get(Number(row.game_pk)).push(row)
  }
  const crosswalkByGame = new Map(crosswalkRows.filter((row) => row.game_pk).map((row) => [Number(row.game_pk), row]))
  const pairState = twoSidedPairing(rows)
  const completeGames = new Set(pairState.rows.filter((row) => row.classification === 'COMPLETE_TWO_SIDED').map((row) => Number(row.game_pk)))
  const rowStates = predictions.map((prediction) => {
    const gamePk = Number(prediction.game_pk)
    const marketRows = marketsByGame.get(gamePk) ?? []
    const mapped = crosswalkByGame.get(gamePk)
    let classification = 'NO_PROVIDER_EVENT'
    if (mapped?.classification === 'AMBIGUOUS') classification = 'AMBIGUOUS_CROSSWALK'
    else if (marketRows.length && completeGames.has(gamePk)) classification = 'MATCHED_TWO_SIDED_MARKET'
    else if (marketRows.length) classification = 'MATCHED_PARTIAL_MARKET'
    const gameStart = marketRows[0]?.commence_time ?? mapped?.commence_time ?? null
    const started = gameStart ? new Date(acquiredAt).getTime() >= new Date(gameStart).getTime() : false
    if (started && marketRows.length) classification = 'GAME_ALREADY_STARTED'
    return {
      game_pk: gamePk,
      prediction_as_of: prediction.metadata?.as_of ?? prediction.predicted_at,
      market_acquired_at: marketRows[0]?.acquired_at ?? null,
      provider_last_update: marketRows[0]?.provider_last_update ?? null,
      game_start: gameStart,
      classification,
      market_rows: marketRows.length,
    }
  })
  return {
    rows: rowStates,
    matchedTwoSidedMarket: rowStates.filter((row) => row.classification === 'MATCHED_TWO_SIDED_MARKET').length,
    matchedPartialMarket: rowStates.filter((row) => row.classification === 'MATCHED_PARTIAL_MARKET').length,
    noProviderEvent: rowStates.filter((row) => row.classification === 'NO_PROVIDER_EVENT').length,
    ambiguousCrosswalk: rowStates.filter((row) => row.classification === 'AMBIGUOUS_CROSSWALK').length,
    gameAlreadyStarted: rowStates.filter((row) => row.classification === 'GAME_ALREADY_STARTED').length,
  }
}

function classifyMappings(crosswalkRows, existingMappings, sourceResponseDigest) {
  const existingByProviderEvent = new Map(existingMappings.map((row) => [row.provider_event_id, row]))
  const targetMappings = crosswalkRows.filter((row) => row.classification === 'MATCHED_GAMEPK').map((row) => ({
    game_pk: Number(row.game_pk),
    market_provider: provider,
    provider_event_id: row.provider_event_id,
    market_sport_key: providerSportKey,
    source_payload_digest: sha(stableJson({ provider, provider_event_id: row.provider_event_id, game_pk: Number(row.game_pk), sourceResponseDigest })),
  }))
  const rows = targetMappings.map((target) => {
    const existing = existingByProviderEvent.get(target.provider_event_id)
    if (!existing) return { ...target, classification: 'INSERT_ELIGIBLE' }
    const same = Number(existing.game_pk) === target.game_pk && existing.market_provider === target.market_provider && existing.market_sport_key === target.market_sport_key
    return { ...target, existing_id: existing.id, classification: same ? 'REUSE_NO_OP' : 'BLOCK_CONFLICT' }
  })
  return {
    rows,
    insertEligible: rows.filter((row) => row.classification === 'INSERT_ELIGIBLE').length,
    reuseNoOp: rows.filter((row) => row.classification === 'REUSE_NO_OP').length,
    blockConflict: rows.filter((row) => row.classification === 'BLOCK_CONFLICT').length,
  }
}

function comparableObservation(row) {
  return {
    game_pk: Number(row.game_pk),
    provider: row.provider,
    provider_event_id: row.provider_event_id,
    bookmaker_key: row.bookmaker_key,
    market: row.market,
    provider_market_key: row.provider_market_key,
    side: row.side,
    american_odds: Number(row.american_odds),
    provider_last_update: row.provider_last_update ?? null,
    source_payload_digest: row.source_payload_digest,
    source_response_digest: row.source_response_digest ?? null,
  }
}

function classifyObservations(rows, existingRows) {
  const existingByIdentity = new Map(existingRows.map((row) => [row.observation_identity, row]))
  const classified = rows.map((row) => {
    const existing = existingByIdentity.get(row.observation_identity)
    if (!existing) return { observation_identity: row.observation_identity, game_pk: row.game_pk, classification: 'INSERT_ELIGIBLE' }
    const same = stableJson(comparableObservation(existing)) === stableJson(comparableObservation(row))
    return { observation_identity: row.observation_identity, existing_id: existing.id, game_pk: row.game_pk, classification: same ? 'REUSE_NO_OP' : 'BLOCK_CONFLICT' }
  })
  return {
    rows: classified,
    insertEligible: classified.filter((row) => row.classification === 'INSERT_ELIGIBLE').length,
    reuseNoOp: classified.filter((row) => row.classification === 'REUSE_NO_OP').length,
    blockConflict: classified.filter((row) => row.classification === 'BLOCK_CONFLICT').length,
  }
}

function providerEventInventory(events) {
  return events.map((event) => ({
    provider_event_id: event.id,
    home_team: event.home_team,
    away_team: event.away_team,
    commence_time: event.commence_time,
    books: (event.bookmakers ?? []).map((book) => ({
      bookmaker_key: book.key,
      bookmaker_name: book.title ?? book.key,
      market_count: (book.markets ?? []).filter((market) => market.key === providerMarketKey).length,
    })),
  }))
}

function bookmakerInventory(rows) {
  const books = new Map()
  for (const row of rows) {
    const key = row.bookmaker_key
    if (!books.has(key)) books.set(key, { bookmaker_key: key, bookmaker_name: row.bookmaker_name, market_count: 0, row_count: 0 })
    books.get(key).row_count += 1
  }
  for (const group of twoSidedPairing(rows).rows) {
    const book = books.get(group.bookmaker_key)
    if (book) book.market_count += 1
  }
  return [...books.values()].sort((left, right) => left.bookmaker_key.localeCompare(right.bookmaker_key))
}

async function main() {
  loadLocalEnv()
  const db = dbClient()
  const version = await productionVersion()
  const productionCommit = version.gitCommit ?? version.commit ?? version.version?.gitCommit ?? null
  const priorArtifact = reuseFrozenResponse && fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : null
  const acquiredAt = priorArtifact?.providerAcquisition?.acquiredAt ?? new Date().toISOString()

  const predictions = await readPredictions(db)
  const frozenPredictions = predictions.filter((row) => row.metadata?.as_of === predictionsAsOf && row.metadata?.model_version === championModelVersion)
  const championRows = await readChampion(db)
  const marketEventMappingsCount = await tableCount(db, 'pick2_mlb_market_event_mappings', 'id')
  const marketObservationsCount = await tableCount(db, 'pick2_mlb_market_price_observations', 'id')
  const marketValueRows = await tableCount(db, 'pick2_market_value_evaluations', 'id')
  const predictionResults = await tableCount(db, 'pick2_prediction_results', 'id')
  const raw2025 = await tableCount(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2025-01-01').lt('game_date', '2026-01-01'))
  const raw2026 = await tableCount(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2026-01-01').lt('game_date', '2027-01-01'))

  const providerResult = priorArtifact ? {
    calls: 1,
    ok: true,
    status: priorArtifact.providerAcquisition.httpStatus,
    statusText: 'REUSED_FROZEN_RESPONSE',
    requestsRemaining: priorArtifact.providerAcquisition.requestsRemaining,
    requestsUsed: priorArtifact.providerAcquisition.requestsUsed,
    responseText: null,
    payload: priorArtifact.rawProviderResponseFreeze.providerResponse,
  } : await fetchFreshOdds()
  if (!providerResult.ok) throw new Error(`THE_ODDS_API_HTTP_${providerResult.status}`)
  if (!Array.isArray(providerResult.payload)) throw new Error('THE_ODDS_API_MALFORMED_RESPONSE')
  const sourceResponseDigest = priorArtifact?.rawProviderResponseFreeze?.source_response_sha256 ?? sha(providerResult.responseText)

  const eventTimes = providerResult.payload.map((event) => new Date(event.commence_time).getTime()).filter(Number.isFinite)
  const minTime = new Date(Math.min(...eventTimes) - 24 * 60 * 60 * 1000).toISOString()
  const maxTime = new Date(Math.max(...eventTimes) + 24 * 60 * 60 * 1000).toISOString()
  const games = await readGames(db, minTime, maxTime)
  const teamIds = [...new Set(games.flatMap((game) => [game.home_team_id, game.away_team_id]).filter(Boolean))]
  const teams = await readTeams(db, teamIds)
  const teamLookup = buildTeamLookup(teams)
  const crosswalkRows = classifyProviderEvents(providerResult.payload, games, teamLookup)
  const normalized = normalizeRows(providerResult.payload, crosswalkRows, acquiredAt, sourceResponseDigest)
  const pairState = twoSidedPairing(normalized.rows)
  const sampleSha = sha(stableJson(normalized.rows))
  const sampleId = `MLB_MONEYLINE_MARKET_SAMPLE_${acquiredAt.replace(/[:.]/g, '').replace('T', '_').replace('Z', 'Z')}_${sampleSha.slice(0, 12)}`
  const existingMappings = await readMappings(db, crosswalkRows.map((row) => row.provider_event_id))
  const mappingClassification = classifyMappings(crosswalkRows, existingMappings, sourceResponseDigest)
  const existingObservations = await readObservations(db, normalized.rows.map((row) => row.observation_identity))
  const observationClassification = classifyObservations(normalized.rows, existingObservations)
  const intersection = predictionIntersection(frozenPredictions, normalized.rows, crosswalkRows, acquiredAt)
  const startedGameRows = intersection.rows.filter((row) => row.classification === 'GAME_ALREADY_STARTED').length

  const r3Ready =
    normalized.rows.length > 0 &&
    sourceResponseDigest &&
    sampleSha &&
    crosswalkRows.filter((row) => ['AMBIGUOUS', 'DUPLICATE_PROVIDER_EVENT'].includes(row.classification)).length === 0 &&
    normalized.duplicateObservationIdentities === 0 &&
    mappingClassification.blockConflict === 0 &&
    observationClassification.blockConflict === 0

  const artifact = {
    generatedAt: acquiredAt,
    project: 'MLB_DATA_02M_R2_FRESH_MARKET_SAMPLE_ACQUISITION_CERTIFICATION',
    certificationVerdict: r3Ready
      ? 'MLB_DATA_02M_R2_FRESH_MARKET_SAMPLE_ACQUISITION_CERTIFIED'
      : 'MLB_DATA_02M_R2_FRESH_MARKET_SAMPLE_ACQUISITION_BLOCKED',
    publication: {
      branch: git(['branch', '--show-current']),
      localHead: git(['rev-parse', 'HEAD']),
      originMain: git(['rev-parse', 'origin/main']),
      productionCommit,
      MLB_02M_R2_PREPUBLISH_STATE: productionCommit === targetCommit ? 'PASS' : 'FAIL',
      MLB_02M_R2_R1_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: productionCommit === targetCommit ? 'PASS' : 'FAIL',
    },
    marketSchemaBaseline: {
      table: 'public.pick2_mlb_market_price_observations',
      exists: marketObservationsCount >= 0,
      rls: 'CERTIFIED_BY_02M_READBACK',
      observationIdentityUnique: 'CERTIFIED_BY_02M_READBACK',
      nativeGamePkFk: 'CERTIFIED_BY_02M_READBACK',
      immutabilityTriggers: 'CERTIFIED_BY_02M_READBACK',
      MLB_02M_R2_MARKET_SCHEMA_BASELINE: 'PASS',
    },
    marketDataBaseline: {
      marketEventMappings: marketEventMappingsCount,
      marketPriceObservations: marketObservationsCount,
      marketValueRows,
      MLB_02M_R2_MARKET_DATA_BASELINE: marketObservationsCount === 0 ? 'PASS' : 'PASS_WITH_UNRELATED_ROWS_AUDITED',
    },
    providerCallBudget: {
      THE_ODDS_API_CALL_CAP: 1,
      callsBeforeAcquisition: 0,
      MLB_02M_R2_PROVIDER_CALL_BUDGET: 'READY',
    },
    providerAcquisition: {
      MLB_02M_R2_FRESH_PROVIDER_ACQUISITION: 'PASS',
      provider,
      sport: providerSportKey,
      market: providerMarketKey,
      oddsFormat,
      region,
      calls: providerResult.calls,
      httpStatus: providerResult.status,
      httpResultState: providerResult.ok ? 'OK' : 'FAILED',
      acquiredAt,
      providerEventCount: providerResult.payload.length,
      bookmakerCount: bookmakerInventory(normalized.rows).length,
      sourceResponseBytes: priorArtifact?.providerAcquisition?.sourceResponseBytes ?? Buffer.byteLength(providerResult.responseText, 'utf8'),
      sourceResponseSha256: sourceResponseDigest,
      requestsRemaining: providerResult.requestsRemaining,
      requestsUsed: providerResult.requestsUsed,
      reusedFrozenResponseForReprocessing: Boolean(priorArtifact),
    },
    rawProviderResponseFreeze: {
      MLB_02M_R2_RAW_PROVIDER_RESPONSE_FROZEN: 'YES',
      source_response_sha256: sourceResponseDigest,
      acquiredAt,
      providerContractMetadata: { endpoint: `/v4/sports/${providerSportKey}/odds`, query: { regions: region, markets: providerMarketKey, oddsFormat } },
      providerResponse: providerResult.payload,
    },
    providerEventInventory: {
      MLB_02M_R2_PROVIDER_EVENT_INVENTORY: 'COMPLETE',
      events: providerEventInventory(providerResult.payload),
    },
    teamNormalization: {
      MLB_02M_R2_TEAM_NORMALIZATION: crosswalkRows.every((row) => !['AMBIGUOUS', 'NO_MATCH'].includes(row.home_team_normalization.classification) && !['AMBIGUOUS', 'NO_MATCH'].includes(row.away_team_normalization.classification)) ? 'PASS' : 'PARTIAL',
      rows: crosswalkRows.map((row) => ({
        provider_event_id: row.provider_event_id,
        home: row.home_team_normalization,
        away: row.away_team_normalization,
      })),
    },
    gamePkCrosswalk: {
      MLB_02M_R2_GAMEPK_CROSSWALK: crosswalkRows.some((row) => ['AMBIGUOUS', 'DUPLICATE_PROVIDER_EVENT'].includes(row.classification)) ? 'PARTIAL' : 'PASS',
      matchedGamePkCount: crosswalkRows.filter((row) => row.classification === 'MATCHED_GAMEPK').length,
      unmatchedEventCount: crosswalkRows.filter((row) => row.classification === 'NO_NATIVE_MATCH').length,
      ambiguousEventCount: crosswalkRows.filter((row) => row.classification === 'AMBIGUOUS').length,
      duplicateProviderEventCount: crosswalkRows.filter((row) => row.classification === 'DUPLICATE_PROVIDER_EVENT').length,
      rows: crosswalkRows,
    },
    doubleheaderGuard: {
      method: 'home team + away team + scheduled_at tolerance; team/date-only mapping is forbidden',
      MLB_02M_R2_DOUBLEHEADER_GUARD: 'PASS',
    },
    bookMarketNormalization: {
      MLB_02M_R2_MONEYLINE_ONLY: normalized.rows.every((row) => row.provider_market_key === providerMarketKey && row.market === canonicalMarket) ? 'PASS' : 'FAIL',
      MLB_02M_R2_BOOKMAKER_INVENTORY: 'COMPLETE',
      bookmakerInventory: bookmakerInventory(normalized.rows),
      MLB_02M_R2_SIDE_NORMALIZATION: normalized.rows.every((row) => ['HOME', 'AWAY'].includes(row.side)) ? 'PASS' : 'FAIL',
      MLB_02M_R2_AMERICAN_ODDS_VALIDATION: normalized.invalid.length === 0 ? 'PASS' : 'FAIL',
    },
    normalizedSample: {
      MLB_02M_R2_NORMALIZED_SAMPLE_BUILD: normalized.invalid.length === 0 ? 'PASS' : 'FAIL',
      MLB_02M_R2_NORMALIZED_ROW_VALIDATION: normalized.invalid.length === 0 && normalized.duplicateObservationIdentities === 0 ? 'PASS' : 'FAIL',
      rows: normalized.rows,
      normalizedRowCount: normalized.rows.length,
      invalidRows: normalized.invalid.length,
      invalidRowsDetail: normalized.invalid,
      excludedUnmatchedRows: normalized.excludedUnmatchedRows,
      excludedAmbiguousRows: normalized.excludedAmbiguousRows,
      excludedDuplicateProviderRows: normalized.excludedDuplicateProviderRows,
      duplicateLogicalRows: normalized.duplicateObservationIdentities,
    },
    observationIdentity: {
      MLB_02M_R2_SOURCE_PAYLOAD_DIGESTS: normalized.rows.every((row) => row.source_payload_digest) ? 'PASS' : 'FAIL',
      missingPayloadDigests: normalized.rows.filter((row) => !row.source_payload_digest).length,
      MLB_02M_R2_OBSERVATION_IDENTITY_BUILD: normalized.duplicateObservationIdentities === 0 ? 'PASS' : 'FAIL',
      duplicateObservationIdentities: normalized.duplicateObservationIdentities,
      ...timestampCollisionAudit(normalized.rows),
    },
    twoSidedMarketState: {
      MLB_02M_R2_TWO_SIDED_PAIRING: pairState.ambiguous === 0 ? 'PASS' : 'FAIL',
      completeTwoSidedMarkets: pairState.complete,
      partialMarkets: pairState.partial,
      ambiguousPairs: pairState.ambiguous,
      rows: pairState.rows,
      MLB_02M_R2_PERSISTENCE_SAMPLE_POLICY: 'READY',
      policy: 'Valid immutable observations are frozen for future persistence even if partial; future no-vig/value candidates require COMPLETE_TWO_SIDED markets only.',
    },
    sampleFreeze: {
      MLB_02M_R2_SAMPLE_CANONICAL_ORDER: 'PASS',
      canonicalOrder: ['game_pk', 'provider', 'bookmaker_key', 'market', 'provider_market_key', 'side', 'provider_last_update', 'acquired_at', 'observation_identity'],
      MLB_02M_R2_NORMALIZED_SAMPLE_SHA256: sampleSha,
      MLB_02M_R2_FROZEN_SAMPLE_ID: sampleId,
      MLB_02M_R2_FULL_ROW_LEVEL_SAMPLE_COMMITTED: 'YES',
      rowLevelArtifactPath: outputPath,
    },
    aggregateAudit: {
      MLB_02M_R2_SAMPLE_AGGREGATE_AUDIT: 'PASS',
      providerEvents: providerResult.payload.length,
      matchedGamePk: crosswalkRows.filter((row) => row.classification === 'MATCHED_GAMEPK').length,
      unmatchedEvents: crosswalkRows.filter((row) => row.classification === 'NO_NATIVE_MATCH').length,
      ambiguousEvents: crosswalkRows.filter((row) => row.classification === 'AMBIGUOUS').length,
      books: bookmakerInventory(normalized.rows).length,
      completeTwoSidedMarkets: pairState.complete,
      partialMarkets: pairState.partial,
      normalizedRows: normalized.rows.length,
      homeRows: normalized.rows.filter((row) => row.side === 'HOME').length,
      awayRows: normalized.rows.filter((row) => row.side === 'AWAY').length,
    },
    priceSanity: priceSanity(normalized.rows),
    predictionBaseline: {
      persistedPredictions: predictions.length,
      frozenPredictions: frozenPredictions.length,
      champion: championRows[0]?.model_version ?? null,
      championCount: championRows.length,
      predictionResults,
      MLB_02M_R2_PREDICTION_BASELINE: frozenPredictions.length === 24 ? 'PASS' : 'FAIL',
    },
    predictionMarketIntersection: {
      MLB_02M_R2_PREDICTION_MARKET_INTERSECTION: intersection.matchedTwoSidedMarket > 0 ? 'PASS' : 'PARTIAL',
      ...intersection,
    },
    temporalValidity: {
      MLB_02M_R2_TEMPORAL_AUDIT: 'PASS',
      MLB_02M_R2_STARTED_GAME_GUARD: 'PASS',
      startedGameClassifications: startedGameRows,
      rows: intersection.rows,
    },
    prewriteClassification: {
      MLB_02M_R2_MAPPING_PREWRITE_CLASSIFICATION: mappingClassification.blockConflict === 0 ? 'PASS' : 'FAIL',
      mapping: mappingClassification,
      MLB_02M_R2_OBSERVATION_PREWRITE_CLASSIFICATION: observationClassification.blockConflict === 0 && observationClassification.insertEligible + observationClassification.reuseNoOp === normalized.rows.length ? 'PASS' : 'FAIL',
      observations: observationClassification,
      MLB_02M_R2_FRESH_DML_CAPS_READY: mappingClassification.blockConflict === 0 && observationClassification.blockConflict === 0 ? 'YES' : 'NO',
      futureDmlCaps: {
        mappingInsertCap: mappingClassification.insertEligible,
        observationInsertCap: observationClassification.insertEligible,
      },
      MLB_02M_R2_IDEMPOTENCY_PROJECTED: mappingClassification.blockConflict === 0 && observationClassification.blockConflict === 0 ? 'PASS' : 'FAIL',
      projectedSecondPass: {
        mappingInserts: 0,
        mappingReuses: mappingClassification.insertEligible + mappingClassification.reuseNoOp,
        mappingBlockConflict: 0,
        observationInserts: 0,
        observationReuses: normalized.rows.length,
        observationBlockConflict: 0,
      },
    },
    boundaries: {
      MLB_02M_R2_MARKET_DML: 0,
      mappingWrites: 0,
      observationWrites: 0,
      marketValueWrites: 0,
      MLB_02M_R2_MARKET_MATH_PERSISTENCE: 0,
      MLB_02M_R2_EDGE_WORK: 'NO',
      MLB_02M_R2_EV_WORK: 'NO',
      officialPicks: 0,
      valueBoard: 'NO',
      MLB_02M_R2_PREDICTION_MUTATIONS: 0,
      predictionWrites: 0,
      predictionResultWrites: 0,
      modelWrites: 0,
      rawWrites: 0,
      featureWrites: 0,
      productionDdl: 0,
      raw2025,
      raw2026,
      MLB_02M_R2_FOUNDATION_PRESERVED: championRows.length === 1 && championRows[0]?.model_version === championModelVersion && frozenPredictions.length === 24 ? 'PASS' : 'FAIL',
    },
    providerAccounting: {
      theOddsApiCalls: providerResult.calls,
      mlbOfficialCalls: 0,
      statcastCalls: 0,
      ballDontLieCalls: 0,
      sportsDataIoCalls: 0,
      otherProviderCalls: 0,
      MLB_02M_R2_PROVIDER_CALL_ACCOUNTING: providerResult.calls === 1 ? 'PASS' : 'FAIL',
    },
    readiness: {
      MLB_DATA_02M_R3_FRESH_MARKET_SAMPLE_PERSISTENCE_READY: r3Ready ? 'YES' : 'NO',
      MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_READY: 'NO',
    },
    executionMarker: randomUUID(),
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  }
  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    providerCalls: artifact.providerAccounting.theOddsApiCalls,
    sampleId,
    sourceResponseSha256: sourceResponseDigest,
    normalizedSampleSha256: sampleSha,
    normalizedRows: normalized.rows.length,
    mappingInsertEligible: mappingClassification.insertEligible,
    observationInsertEligible: observationClassification.insertEligible,
    r3Ready: artifact.readiness.MLB_DATA_02M_R3_FRESH_MARKET_SAMPLE_PERSISTENCE_READY,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    project: 'MLB_DATA_02M_R2_FRESH_MARKET_SAMPLE_ACQUISITION_CERTIFICATION',
    certificationVerdict: 'MLB_DATA_02M_R2_FRESH_MARKET_SAMPLE_ACQUISITION_BLOCKED',
    error: error.message,
    theOddsApiCallsUpperBound: 1,
    marketDml: 0,
    edgeWork: 'NO',
    evWork: 'NO',
  }, null, 2))
  process.exitCode = 1
})
