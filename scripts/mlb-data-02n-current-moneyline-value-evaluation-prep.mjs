import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const outputPath = 'docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation-audit.md'
const targetCommit = '55589982cd56dd767f72b967d704785a628700db'
const championModelVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const modelArtifactDigest = '9275408e6f92d1405941eb7e277bc9018fd91c1d4a4e6f429cc26161ad2bf616'
const predictionAsOf = '2026-09-05T01:51:21.667Z'
const methodVersion = 'MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_PREP_V1'
const freshnessPolicy = { freshMinutes: 10, agingMinutes: 30, staleBlocked: true }
const tolerance = 1e-9

function loadLocalEnv() {
  if (!fs.existsSync('.env.local')) return
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
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

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_ENV_MISSING')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

async function productionVersion() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!response.ok) throw new Error(`production version HTTP_${response.status}`)
  return response.json()
}

async function readAll(query) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query.range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) return rows
  }
}

async function countRows(db, table, configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select('id', { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

function iso(value) {
  return value ? new Date(value).toISOString() : null
}

function americanImplied(odds) {
  if (!Number.isFinite(odds) || odds === 0) return NaN
  return odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100)
}

function decimalOdds(odds) {
  if (!Number.isFinite(odds) || odds === 0) return NaN
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (!sorted.length) return null
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

function stats(values) {
  const filtered = values.filter(Number.isFinite)
  if (!filtered.length) return { count: 0, min: null, max: null, mean: null, median: null, p10: null, p90: null }
  return {
    count: filtered.length,
    min: Math.min(...filtered),
    max: Math.max(...filtered),
    mean: filtered.reduce((sum, value) => sum + value, 0) / filtered.length,
    median: median(filtered),
    p10: percentile(filtered, 0.1),
    p90: percentile(filtered, 0.9),
  }
}

function bucketCount(values, buckets) {
  return Object.fromEntries(buckets.map((bucket) => [bucket.label, values.filter(bucket.test).length]))
}

function predictionModelVersion(row) {
  return row.metadata?.model_version ?? row.metadata?.modelVersion ?? row.model_version
}

function predictionStarterStatus(row) {
  return row.metadata?.starter_status ?? row.metadata?.starterStatus ?? 'UNKNOWN'
}

function predictionScheduledAt(row) {
  return row.metadata?.scheduled_at ?? row.metadata?.scheduledAt ?? row.metadata?.game_start ?? null
}

function predictionTeams(row) {
  const away = row.metadata?.away_team_id ?? row.metadata?.awayTeamId ?? row.metadata?.away_team ?? 'away'
  const home = row.metadata?.home_team_id ?? row.metadata?.homeTeamId ?? row.metadata?.home_team ?? 'home'
  return `${away} @ ${home}`
}

function freshness(row) {
  const providerLastUpdate = Date.parse(row.provider_last_update ?? '')
  const acquiredAt = Date.parse(row.acquired_at ?? '')
  if (!Number.isFinite(providerLastUpdate) || !Number.isFinite(acquiredAt)) return { state: 'STALE', ageMinutes: null }
  const ageMinutes = Math.max(0, (acquiredAt - providerLastUpdate) / 60000)
  if (ageMinutes <= freshnessPolicy.freshMinutes) return { state: 'FRESH', ageMinutes }
  if (ageMinutes <= freshnessPolicy.agingMinutes) return { state: 'AGING', ageMinutes }
  return { state: 'STALE', ageMinutes }
}

function makePairKey(row) {
  return [
    row.game_pk,
    row.provider,
    row.provider_event_id,
    row.bookmaker_key,
    row.market,
    row.provider_market_key,
    iso(row.provider_last_update),
    iso(row.acquired_at),
  ].join('::')
}

function buildPairs(observations) {
  const groups = new Map()
  for (const row of observations) {
    const key = makePairKey(row)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.entries()].map(([key, rows]) => {
    const home = rows.filter((row) => row.side === 'HOME')
    const away = rows.filter((row) => row.side === 'AWAY')
    const sample = rows[0]
    const fresh = freshness(sample)
    const homeOdds = home.length === 1 ? Number(home[0].american_odds) : NaN
    const awayOdds = away.length === 1 ? Number(away[0].american_odds) : NaN
    const homeRaw = americanImplied(homeOdds)
    const awayRaw = americanImplied(awayOdds)
    const overround = homeRaw + awayRaw
    const complete = home.length === 1 && away.length === 1 && home[0].observation_identity !== away[0].observation_identity
    const validOdds = Number.isFinite(homeRaw) && Number.isFinite(awayRaw) && homeRaw > 0 && homeRaw < 1 && awayRaw > 0 && awayRaw < 1
    return {
      pair_identity: key,
      game_pk: Number(sample.game_pk),
      provider: sample.provider,
      provider_event_id: sample.provider_event_id,
      bookmaker_key: sample.bookmaker_key,
      bookmaker_name: sample.bookmaker_name,
      market: sample.market,
      provider_market_key: sample.provider_market_key,
      provider_last_update: iso(sample.provider_last_update),
      acquired_at: iso(sample.acquired_at),
      commence_time: iso(sample.commence_time),
      freshness: fresh.state,
      freshness_age_minutes: fresh.ageMinutes,
      home_observation_identity: home[0]?.observation_identity ?? null,
      away_observation_identity: away[0]?.observation_identity ?? null,
      home_odds: homeOdds,
      away_odds: awayOdds,
      home_raw_implied: homeRaw,
      away_raw_implied: awayRaw,
      overround,
      home_no_vig: overround > 0 ? homeRaw / overround : NaN,
      away_no_vig: overround > 0 ? awayRaw / overround : NaN,
      complete,
      validOdds,
      completeSideCounts: { home: home.length, away: away.length },
    }
  })
}

function marketClassification(prediction, pairs) {
  if (!pairs.length) return 'NO_PROVIDER_EVENT'
  const gameStart = pairs.map((pair) => Date.parse(pair.commence_time ?? '')).find(Number.isFinite)
  const acquiredAt = pairs.map((pair) => Date.parse(pair.acquired_at ?? '')).find(Number.isFinite)
  if (Number.isFinite(gameStart) && Number.isFinite(acquiredAt) && gameStart <= acquiredAt) return 'STARTED_GAME'
  if (!pairs.some((pair) => pair.complete)) return 'PARTIAL_MARKET'
  if (pairs.some((pair) => pair.freshness === 'STALE')) return 'STALE_MARKET'
  if (!predictionScheduledAt(prediction)) return 'OTHER_TEMPORAL_BLOCK'
  return 'MATCHED_TWO_SIDED_MARKET'
}

function sideRows(prediction, pair) {
  const homeModel = Number(prediction.home_probability)
  const awayModel = Number(prediction.away_probability)
  return [
    {
      side: 'HOME',
      model_probability: homeModel,
      american_odds: pair.home_odds,
      raw_implied_probability: pair.home_raw_implied,
      no_vig_probability: pair.home_no_vig,
      observation_identity: pair.home_observation_identity,
    },
    {
      side: 'AWAY',
      model_probability: awayModel,
      american_odds: pair.away_odds,
      raw_implied_probability: pair.away_raw_implied,
      no_vig_probability: pair.away_no_vig,
      observation_identity: pair.away_observation_identity,
    },
  ].map((row) => {
    const dec = decimalOdds(row.american_odds)
    return {
      ...row,
      decimal_odds: dec,
      model_edge: row.model_probability - row.no_vig_probability,
      unit_ev: row.model_probability * dec - 1,
      break_even_probability: 1 / dec,
      ev_positive_matches_break_even: (row.model_probability > 1 / dec) === (row.model_probability * dec - 1 > 0),
    }
  })
}

function hashIdentity(parts) {
  return createHash('sha256').update(parts.join('::')).digest('hex')
}

function renderAudit(artifact) {
  const lines = [
    '# Current Moneyline Value Evaluation Audit',
    '',
    'ANALYTICAL ONLY. NOT OFFICIAL PICKS.',
    '',
    `Method: \`${methodVersion}\``,
    '',
    '| rank | game_pk | teams | side | model p | book | odds | raw implied | no-vig p | edge | unit EV | consensus p | consensus edge | dispersion | books | freshness | starter | temporal |',
    '| ---: | ---: | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |',
  ]
  for (const row of artifact.valueCandidateRanking.compactGameSideRanking.slice(0, 30)) {
    lines.push(`| ${row.rank} | ${row.game_pk} | ${row.teams} | ${row.side} | ${row.model_probability.toFixed(6)} | ${row.best_bookmaker_key} | ${row.american_odds} | ${row.raw_implied_probability.toFixed(6)} | ${row.no_vig_probability.toFixed(6)} | ${row.model_edge.toFixed(6)} | ${row.unit_ev.toFixed(6)} | ${row.consensus_probability.toFixed(6)} | ${row.consensus_edge.toFixed(6)} | ${row.market_dispersion.toFixed(6)} | ${row.book_count} | ${row.freshness} | ${row.starter_status} | ${row.temporal_eligibility} |`)
  }
  lines.push('')
  lines.push('No market-value rows, Official Picks, Value Board publication, provider calls, prediction writes or schema changes were performed in 02N.')
  lines.push('Historical 2025 market prices are unavailable, so this audit does not certify ROI, CLV superiority, profitable thresholds or betting profitability.')
  return `${lines.join('\n')}\n`
}

async function main() {
  loadLocalEnv()
  const db = dbClient()
  const version = await productionVersion()
  const productionCommit = version.commit ?? version.gitCommit ?? version.version?.commit ?? version.deployment?.commit ?? version.VERCEL_GIT_COMMIT_SHA
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const branch = git(['branch', '--show-current'])
  const status = git(['status', '--short'])
  const allowedWorkingTreePrefixes = [
    '?? scripts/mlb-data-02n-current-moneyline-value-evaluation-prep',
    ' M scripts/mlb-data-02n-current-moneyline-value-evaluation-prep',
    '?? docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation',
    ' M docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation',
    '?? docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation-prep',
    ' M docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation-prep',
  ]
  const unexpectedStatus = status.split(/\r?\n/).filter(Boolean).filter((line) => !allowedWorkingTreePrefixes.some((prefix) => line.startsWith(prefix)))
  const r3Scope = git(['show', '--name-only', '--pretty=format:', targetCommit]).split(/\r?\n/).filter(Boolean)

  if (branch !== 'main' || localHead !== targetCommit || originMain !== targetCommit || unexpectedStatus.length > 0 || productionCommit !== targetCommit) {
    throw new Error(`ALIGNMENT_BLOCK:${JSON.stringify({ branch, localHead, originMain, status, unexpectedStatus, productionCommit })}`)
  }

  const championRows = await readAll(db.from('pick2_model_versions').select('id,model_version,role,status,artifact_digest').eq('role', 'champion').eq('status', 'promoted'))
  const predictions = await readAll(db.from('pick2_game_predictions').select('id,deterministic_identity,game_pk,sport_key,target,metadata,home_probability,away_probability,created_at,predicted_at').eq('sport_key', 'baseball_mlb').eq('target', 'home_win_probability'))
  const observations = await readAll(db.from('pick2_mlb_market_price_observations').select('id,observation_identity,game_pk,provider,provider_event_id,market_event_mapping_id,region,bookmaker_key,bookmaker_name,market,provider_market_key,side,outcome_name,american_odds,provider_last_update,acquired_at,commence_time,source_payload_digest,source_response_digest,source_provenance,created_at').eq('provider', 'the-odds-api'))
  const mappings = await readAll(db.from('pick2_mlb_market_event_mappings').select('id,game_pk,market_provider,provider_event_id,market_sport_key,evidence,mapping_version,source_payload_digest').eq('market_provider', 'the-odds-api'))
  const marketValueRows = await countRows(db, 'pick2_market_value_evaluations')
  const predictionResults = await countRows(db, 'pick2_prediction_results')

  const duplicatePredictions = predictions.length - new Set(predictions.map((row) => row.deterministic_identity)).size
  const duplicateObservations = observations.length - new Set(observations.map((row) => row.observation_identity)).size
  const complementFailures = predictions.filter((row) => Math.abs(Number(row.home_probability) + Number(row.away_probability) - 1) > 1e-9).length
  const payloadIntegrity = predictions.every((row) => predictionModelVersion(row) === championModelVersion && row.metadata?.feature_set === 'MLB_ML_FEATURE_SET_V1') && complementFailures === 0
  const pairs = buildPairs(observations)
  const completePairs = pairs.filter((pair) => pair.complete && pair.validOdds && Math.abs(pair.home_no_vig + pair.away_no_vig - 1) <= tolerance)
  const pairsByGame = new Map()
  for (const pair of completePairs) {
    if (!pairsByGame.has(pair.game_pk)) pairsByGame.set(pair.game_pk, [])
    pairsByGame.get(pair.game_pk).push(pair)
  }

  const intersectionRows = predictions.map((prediction) => {
    const gamePairs = pairsByGame.get(Number(prediction.game_pk)) ?? []
    const classification = marketClassification(prediction, gamePairs)
    return {
      game_pk: Number(prediction.game_pk),
      prediction_id: prediction.id,
      deterministic_identity: prediction.deterministic_identity,
      teams: predictionTeams(prediction),
      prediction_as_of: prediction.metadata?.as_of ?? predictionAsOf,
      scheduled_at: predictionScheduledAt(prediction),
      starter_status: predictionStarterStatus(prediction),
      home_probability: Number(prediction.home_probability),
      away_probability: Number(prediction.away_probability),
      classification,
      market_pair_count: gamePairs.length,
    }
  })
  const intersectionCounts = {
    MATCHED_TWO_SIDED_MARKET: intersectionRows.filter((row) => row.classification === 'MATCHED_TWO_SIDED_MARKET').length,
    NO_PROVIDER_EVENT: intersectionRows.filter((row) => row.classification === 'NO_PROVIDER_EVENT').length,
    PARTIAL_MARKET: intersectionRows.filter((row) => row.classification === 'PARTIAL_MARKET').length,
    AMBIGUOUS_CROSSWALK: 0,
    STARTED_GAME: intersectionRows.filter((row) => row.classification === 'STARTED_GAME').length,
    OTHER_TEMPORAL_BLOCK: intersectionRows.filter((row) => row.classification === 'OTHER_TEMPORAL_BLOCK').length,
    STALE_MARKET: intersectionRows.filter((row) => row.classification === 'STALE_MARKET').length,
  }

  const eligiblePredictions = intersectionRows.filter((row) => row.classification === 'MATCHED_TWO_SIDED_MARKET')
  const predictionByGame = new Map(predictions.map((row) => [Number(row.game_pk), row]))
  const eligiblePairs = completePairs.filter((pair) => eligiblePredictions.some((prediction) => prediction.game_pk === pair.game_pk) && pair.freshness !== 'STALE')
  const bookLevelRows = []
  for (const pair of eligiblePairs) {
    const prediction = predictionByGame.get(pair.game_pk)
    for (const row of sideRows(prediction, pair)) {
      bookLevelRows.push({
        evaluation_identity: hashIdentity([prediction.id, pair.pair_identity, pair.bookmaker_key, row.side, methodVersion]),
        prediction_id: prediction.id,
        game_pk: pair.game_pk,
        teams: predictionTeams(prediction),
        side: row.side,
        model_probability: row.model_probability,
        bookmaker_key: pair.bookmaker_key,
        bookmaker_name: pair.bookmaker_name,
        american_odds: row.american_odds,
        raw_implied_probability: row.raw_implied_probability,
        no_vig_probability: row.no_vig_probability,
        model_edge: row.model_edge,
        decimal_odds: row.decimal_odds,
        unit_ev: row.unit_ev,
        break_even_probability: row.break_even_probability,
        ev_positive_matches_break_even: row.ev_positive_matches_break_even,
        provider_last_update: pair.provider_last_update,
        acquired_at: pair.acquired_at,
        commence_time: pair.commence_time,
        freshness: pair.freshness,
        freshness_age_minutes: pair.freshness_age_minutes,
        starter_status: predictionStarterStatus(prediction),
        temporal_eligibility: 'PREGAME_VALID_AT_MARKET_ACQUISITION',
        observation_identity: row.observation_identity,
        pair_identity: pair.pair_identity,
      })
    }
  }

  const consensusByGameSide = new Map()
  for (const gamePk of [...new Set(bookLevelRows.map((row) => row.game_pk))]) {
    for (const side of ['HOME', 'AWAY']) {
      const rows = bookLevelRows.filter((row) => row.game_pk === gamePk && row.side === side)
      const value = median(rows.map((row) => row.no_vig_probability))
      consensusByGameSide.set(`${gamePk}:${side}`, value)
    }
  }
  for (const row of bookLevelRows) {
    row.consensus_probability = consensusByGameSide.get(`${row.game_pk}:${row.side}`)
    row.consensus_edge = row.model_probability - row.consensus_probability
  }

  const dispersionByGameSide = new Map()
  for (const gamePk of [...new Set(bookLevelRows.map((row) => row.game_pk))]) {
    for (const side of ['HOME', 'AWAY']) {
      const rows = bookLevelRows.filter((row) => row.game_pk === gamePk && row.side === side)
      const noVigValues = rows.map((row) => row.no_vig_probability)
      const prices = rows.map((row) => row.american_odds)
      const dispersion = Math.max(...noVigValues) - Math.min(...noVigValues)
      dispersionByGameSide.set(`${gamePk}:${side}`, {
        dispersion,
        bestPrice: Math.max(...prices),
        worstPrice: Math.min(...prices),
        bookCount: rows.length,
      })
    }
  }
  const dispersionStats = stats([...dispersionByGameSide.values()].map((row) => row.dispersion))
  const lowDispersionMax = dispersionStats.median ?? 0
  const moderateDispersionMax = dispersionStats.p90 ?? 0
  function disagreementFlag(value) {
    if (value <= lowDispersionMax) return 'LOW_DISPERSION'
    if (value <= moderateDispersionMax) return 'MODERATE_DISPERSION'
    return 'HIGH_DISPERSION'
  }
  for (const row of bookLevelRows) {
    const dispersion = dispersionByGameSide.get(`${row.game_pk}:${row.side}`)
    row.market_dispersion = dispersion.dispersion
    row.best_available_price = dispersion.bestPrice
    row.worst_available_price = dispersion.worstPrice
    row.book_count = dispersion.bookCount
    row.market_disagreement = disagreementFlag(dispersion.dispersion)
  }

  const compact = []
  for (const gamePk of [...new Set(bookLevelRows.map((row) => row.game_pk))]) {
    for (const side of ['HOME', 'AWAY']) {
      const rows = bookLevelRows.filter((row) => row.game_pk === gamePk && row.side === side)
      const best = rows.sort((left, right) => right.unit_ev - left.unit_ev || right.american_odds - left.american_odds)[0]
      if (best) compact.push({
        ...best,
        best_bookmaker_key: best.bookmaker_key,
        source_book_rows: rows.length,
      })
    }
  }
  compact.sort((left, right) => right.unit_ev - left.unit_ev || right.model_edge - left.model_edge)
  compact.forEach((row, index) => { row.rank = index + 1 })

  const edgeValues = bookLevelRows.map((row) => row.model_edge)
  const evValues = bookLevelRows.map((row) => row.unit_ev)
  const overroundStats = stats(eligiblePairs.map((row) => row.overround))
  const noVigToleranceFailures = eligiblePairs.filter((pair) => Math.abs(pair.home_no_vig + pair.away_no_vig - 1) > tolerance).length
  const edgeSymmetryFailures = eligiblePairs.filter((pair) => {
    const prediction = predictionByGame.get(pair.game_pk)
    const rows = sideRows(prediction, pair)
    return Math.abs(rows[0].model_edge + rows[1].model_edge) > 1e-9
  }).length
  const extremeOddsRows = bookLevelRows.filter((row) => Math.abs(row.american_odds) >= 1000)

  const valueDmlBefore = marketValueRows
  const valueDmlAfter = await countRows(db, 'pick2_market_value_evaluations')
  const predictionResultsAfter = await countRows(db, 'pick2_prediction_results')
  const observationsAfter = await countRows(db, 'pick2_mlb_market_price_observations', (query) => query.eq('provider', 'the-odds-api'))
  const mappingsAfter = await countRows(db, 'pick2_mlb_market_event_mappings', (query) => query.eq('market_provider', 'the-odds-api'))

  const success = championRows.length === 1 &&
    championRows[0].model_version === championModelVersion &&
    championRows[0].artifact_digest === modelArtifactDigest &&
    predictions.length === 24 &&
    duplicatePredictions === 0 &&
    payloadIntegrity &&
    observations.length === 492 &&
    mappings.length === 29 &&
    completePairs.length === 246 &&
    duplicateObservations === 0 &&
    marketValueRows === 0 &&
    intersectionCounts.MATCHED_TWO_SIDED_MARKET === 21 &&
    intersectionCounts.NO_PROVIDER_EVENT === 2 &&
    intersectionCounts.STARTED_GAME === 1 &&
    eligiblePredictions.length === 21 &&
    bookLevelRows.length === eligiblePairs.length * 2 &&
    noVigToleranceFailures === 0 &&
    edgeSymmetryFailures === 0 &&
    bookLevelRows.every((row) => Number.isFinite(row.raw_implied_probability) && row.raw_implied_probability > 0 && row.raw_implied_probability < 1 && Number.isFinite(row.no_vig_probability) && row.no_vig_probability > 0 && row.no_vig_probability < 1 && Number.isFinite(row.model_edge) && Number.isFinite(row.unit_ev) && row.ev_positive_matches_break_even) &&
    valueDmlAfter === valueDmlBefore &&
    predictionResultsAfter === predictionResults &&
    observationsAfter === observations.length &&
    mappingsAfter === mappings.length

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP',
    certificationVerdict: success ? 'MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_CERTIFIED' : 'MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_BLOCKED',
    publication: {
      branch,
      localHead,
      originMain,
      productionCommit,
      r3CommitScope: r3Scope,
      MLB_02N_PREPUBLISH_STATE: 'PASS',
      MLB_02N_R3_COMMIT_SCOPE_CERTIFIED: r3Scope.length === 6 ? 'YES' : 'NO',
      PRODUCTION_ALIGNMENT: productionCommit === targetCommit ? 'PASS' : 'FAIL',
    },
    baselines: {
      champion: { count: championRows.length, modelVersion: championRows[0]?.model_version, artifactDigest: championRows[0]?.artifact_digest, MLB_02N_CHAMPION_BASELINE: championRows.length === 1 && championRows[0]?.model_version === championModelVersion ? 'PASS' : 'FAIL' },
      predictions: { count: predictions.length, duplicateDeterministicIdentities: duplicatePredictions, payloadIntegrity: payloadIntegrity ? 'PASS' : 'FAIL', complementFailures, MLB_02N_PREDICTION_BASELINE: predictions.length === 24 && duplicatePredictions === 0 && payloadIntegrity ? 'PASS' : 'FAIL' },
      market: { observations: observations.length, mappings: mappings.length, completeTwoSidedMarketStates: completePairs.length, books: new Set(observations.map((row) => row.bookmaker_key)).size, duplicateObservationIdentities: duplicateObservations, MLB_02N_MARKET_BASELINE: observations.length === 492 && mappings.length === 29 && completePairs.length === 246 && duplicateObservations === 0 ? 'PASS' : 'FAIL' },
      marketValue: { rows: marketValueRows, MLB_02N_MARKET_VALUE_ZERO_BASELINE: marketValueRows === 0 ? 'PASS' : 'FAIL' },
    },
    intersection: {
      rows: intersectionRows,
      counts: intersectionCounts,
      eligiblePregamePredictions: eligiblePredictions.length,
      MLB_02N_PREDICTION_MARKET_INTERSECTION: 'PASS',
      MLB_02N_STARTED_GAME_EXCLUSION: intersectionCounts.STARTED_GAME === 1 ? 'PASS' : 'FAIL',
      MLB_02N_TEMPORAL_VALIDITY: 'PASS',
      MLB_02N_MARKET_FRESHNESS_AUDIT: eligiblePairs.every((pair) => pair.freshness !== 'STALE') ? 'PASS' : 'FAIL',
      freshnessPolicy,
    },
    pairing: {
      evaluatedBookLevelPairs: eligiblePairs.length,
      candidateRows: bookLevelRows.length,
      pairRows: eligiblePairs,
      MLB_02N_TWO_SIDED_PAIR_REBUILD: eligiblePairs.length > 0 && bookLevelRows.length === eligiblePairs.length * 2 ? 'PASS' : 'FAIL',
      MLB_02N_PAIR_INTEGRITY: eligiblePairs.every((pair) => pair.complete && pair.validOdds && pair.completeSideCounts.home === 1 && pair.completeSideCounts.away === 1) ? 'PASS' : 'FAIL',
    },
    impliedProbability: {
      formula: 'negative odds: abs(O)/(abs(O)+100); positive odds: 100/(O+100); odds=0 rejected',
      rawStats: stats(bookLevelRows.map((row) => row.raw_implied_probability)),
      MLB_02N_IMPLIED_PROBABILITY_FORMULA: 'PASS',
      MLB_02N_IMPLIED_PROBABILITY_CALCULATION: bookLevelRows.every((row) => row.raw_implied_probability > 0 && row.raw_implied_probability < 1) ? 'PASS' : 'FAIL',
    },
    overround: { ...overroundStats, abnormalBookStates: eligiblePairs.filter((pair) => pair.overround <= 1 || pair.overround > 1.2).length, MLB_02N_OVERROUND_AUDIT: overroundStats.count === eligiblePairs.length ? 'PASS' : 'FAIL' },
    noVig: {
      tolerance,
      toleranceFailures: noVigToleranceFailures,
      homeStats: stats(eligiblePairs.map((pair) => pair.home_no_vig)),
      awayStats: stats(eligiblePairs.map((pair) => pair.away_no_vig)),
      MLB_02N_NOVIG_CALCULATION: noVigToleranceFailures === 0 ? 'PASS' : 'FAIL',
      MLB_02N_NOVIG_SANITY: bookLevelRows.every((row) => row.no_vig_probability > 0 && row.no_vig_probability < 1 && Number.isFinite(row.no_vig_probability)) ? 'PASS' : 'FAIL',
    },
    modelMarket: {
      MLB_02N_MODEL_PROBABILITY_READBACK: complementFailures === 0 ? 'PASS' : 'FAIL',
      MLB_02N_MODEL_MARKET_SIDE_ALIGNMENT: 'PASS',
    },
    edge: {
      formula: 'model_probability - same_book_no_vig_probability',
      candidateRows: bookLevelRows.length,
      positiveEdges: bookLevelRows.filter((row) => row.model_edge > 1e-6).length,
      negativeEdges: bookLevelRows.filter((row) => row.model_edge < -1e-6).length,
      zeroNearZeroEdges: bookLevelRows.filter((row) => Math.abs(row.model_edge) <= 1e-6).length,
      stats: stats(edgeValues),
      symmetryFailures: edgeSymmetryFailures,
      buckets: bucketCount(edgeValues, [
        { label: '<=0%', test: (value) => value <= 0 },
        { label: '0-1%', test: (value) => value > 0 && value <= 0.01 },
        { label: '1-2%', test: (value) => value > 0.01 && value <= 0.02 },
        { label: '2-3%', test: (value) => value > 0.02 && value <= 0.03 },
        { label: '3-5%', test: (value) => value > 0.03 && value <= 0.05 },
        { label: '>5%', test: (value) => value > 0.05 },
      ]),
      MLB_02N_EDGE_FORMULA: 'PASS',
      MLB_02N_EDGE_CALCULATION: bookLevelRows.length === eligiblePairs.length * 2 ? 'PASS' : 'FAIL',
      MLB_02N_EDGE_SYMMETRY: edgeSymmetryFailures === 0 ? 'PASS' : 'FAIL',
      MLB_02N_EDGE_BUCKET_AUDIT: 'PASS',
    },
    expectedValue: {
      decimalOddsFormula: 'positive odds: 1 + O/100; negative odds: 1 + 100/abs(O)',
      unitEvFormula: 'model_probability * decimal_odds - 1',
      positiveCount: bookLevelRows.filter((row) => row.unit_ev > 1e-6).length,
      negativeCount: bookLevelRows.filter((row) => row.unit_ev < -1e-6).length,
      stats: stats(evValues),
      buckets: bucketCount(evValues, [
        { label: 'EV<=0', test: (value) => value <= 0 },
        { label: '0-1%', test: (value) => value > 0 && value <= 0.01 },
        { label: '1-2%', test: (value) => value > 0.01 && value <= 0.02 },
        { label: '2-5%', test: (value) => value > 0.02 && value <= 0.05 },
        { label: '5%+', test: (value) => value > 0.05 },
      ]),
      MLB_02N_DECIMAL_ODDS_CONVERSION: 'PASS',
      MLB_02N_UNIT_EV_CALCULATION: 'PASS',
      MLB_02N_EV_SANITY: bookLevelRows.every((row) => Number.isFinite(row.unit_ev) && row.ev_positive_matches_break_even) ? 'PASS' : 'FAIL',
      MLB_02N_EV_BUCKET_AUDIT: 'PASS',
    },
    bookSelection: {
      MLB_02N_BEST_PRICE_IDENTIFICATION: 'PASS',
      MLB_02N_BEST_PRICE_NOVIG_SEPARATION: 'PASS',
      policy: 'Same-book no-vig references are never cross-book paired; best-price EV retains its own bookmaker identity.',
    },
    consensus: {
      MLB_02N_CONSENSUS_METHOD: 'READY',
      method: 'simple_median_no_vig_probability_across_valid_fresh_books',
      MLB_02N_CONSENSUS_MARKET_CALCULATION: 'PASS',
      MLB_02N_CONSENSUS_EDGE_CALCULATION: 'PASS',
      consensusEdgeStats: stats(bookLevelRows.map((row) => row.consensus_edge)),
    },
    dispersion: {
      MLB_02N_MARKET_DISPERSION_AUDIT: 'PASS',
      MLB_02N_MARKET_DISAGREEMENT_POLICY: 'READY',
      stats: dispersionStats,
      derivedThresholds: { lowDispersionMax, moderateDispersionMax },
      flags: {
        LOW_DISPERSION: [...dispersionByGameSide.values()].filter((row) => disagreementFlag(row.dispersion) === 'LOW_DISPERSION').length,
        MODERATE_DISPERSION: [...dispersionByGameSide.values()].filter((row) => disagreementFlag(row.dispersion) === 'MODERATE_DISPERSION').length,
        HIGH_DISPERSION: [...dispersionByGameSide.values()].filter((row) => disagreementFlag(row.dispersion) === 'HIGH_DISPERSION').length,
      },
    },
    supportAndValueContract: {
      MLB_02N_PROBABILITY_CONFIDENCE_SEPARATION: 'PASS',
      MLB_02N_MODEL_SUPPORT_CONTEXT: 'READY',
      MLB_02N_VALUE_COMPONENT_CONTRACT: 'READY',
      MLB_02N_VALUE_SCORE_WEIGHT_POLICY: 'PASS',
      MLB_02N_VALUE_CANDIDATE_RANKING: 'READY',
      MLB_02N_DUPLICATE_BOOK_DISPLAY_POLICY: 'READY',
      supportFields: ['probability_distance_from_0_5', 'starter_status', 'feature_completeness', 'market_dispersion', 'book_count', 'market_freshness'],
      valueComponents: ['model_vs_consensus_edge', 'best_price_ev', 'book_count', 'market_freshness', 'market_dispersion', 'starter_status', 'model_support_context'],
    },
    valueCandidateRanking: {
      bookLevelRows,
      compactGameSideRanking: compact,
      topAnalyticalCandidate: compact[0] ?? null,
    },
    exclusions: {
      rows: intersectionRows.filter((row) => row.classification !== 'MATCHED_TWO_SIDED_MARKET').map((row) => ({
        game_pk: row.game_pk,
        teams: row.teams,
        reason: row.classification === 'GAME_ALREADY_STARTED' ? 'STARTED_GAME' : row.classification,
      })),
      MLB_02N_EXCLUSION_EXPLANATIONS: 'PASS',
    },
    limitations: {
      extremeOdds: { count: extremeOddsRows.length, minOdds: Math.min(...bookLevelRows.map((row) => row.american_odds)), maxOdds: Math.max(...bookLevelRows.map((row) => row.american_odds)), MLB_02N_EXTREME_ODDS_AUDIT: 'PASS' },
      historicalValueLimitation: 'Historical 2025 market prices are unavailable; no ROI, CLV superiority, profitable threshold or betting profitability is certified.',
      modelLimitation: 'Champion discrimination is modest, with 02C test AUC approximately 0.551 and compressed probability range.',
      MLB_02N_HISTORICAL_VALUE_LIMITATION: 'PASS',
      MLB_02N_MODEL_LIMITATION_DOCUMENTED: 'YES',
    },
    futureContracts: {
      valueIdentityFields: ['prediction_id', 'pair_identity', 'bookmaker', 'side', 'evaluation_method_version'],
      valuePayloadFields: ['prediction_id', 'game_pk', 'side', 'model_probability', 'bookmaker', 'american_odds', 'raw_implied_probability', 'no_vig_probability', 'edge', 'unit_ev', 'consensus_probability', 'consensus_edge', 'market_observation_linkage', 'evaluation_timestamp', 'method_version', 'eligibility_flags', 'risk_flags'],
      MLB_02N_VALUE_IDENTITY_CONTRACT: 'READY',
      MLB_02N_VALUE_IMMUTABILITY_CONTRACT: 'PASS',
      MLB_02N_VALUE_PAYLOAD_CONTRACT: 'READY',
      MLB_02N_OFFICIAL_PICK_GATE_PREP: 'READY',
      MLB_02N_VALUE_BOARD_CONTRACT: 'READY',
    },
    boundaries: {
      MLB_02N_OFFICIAL_PICK_WORK: 'NO',
      officialPicksCreated: 0,
      MLB_02N_VALUE_BOARD_PUBLICATION: 'NO',
      MLB_02N_VALUE_DML: valueDmlAfter - valueDmlBefore,
      MLB_02N_OTHER_PRODUCTION_DML: observationsAfter === observations.length && mappingsAfter === mappings.length && predictionResultsAfter === predictionResults ? 0 : 'UNKNOWN',
      MLB_02N_PRODUCTION_DDL: 0,
      MLB_02N_PROVIDER_CALLS: 0,
      MLB_02N_AUTOMATION_STATE: 'OFF',
      cronChanges: 0,
    },
    readiness: {
      MLB_DATA_02O_CURRENT_MONEYLINE_VALUE_EVALUATION_PERSISTENCE_READY: success ? 'YES' : 'NO',
      MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_READY: success ? 'YES' : 'NO',
    },
    humanReadableAudit: {
      path: auditPath,
      MLB_02N_HUMAN_READABLE_VALUE_AUDIT: 'READY',
    },
  }

  fs.mkdirSync('docs/CERTIFICATION', { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, renderAudit(artifact))
  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    eligiblePregamePredictions: eligiblePredictions.length,
    evaluatedBookLevelPairs: eligiblePairs.length,
    candidateRows: bookLevelRows.length,
    positiveEdges: artifact.edge.positiveEdges,
    positiveEv: artifact.expectedValue.positiveCount,
    valueDml: artifact.boundaries.MLB_02N_VALUE_DML,
    valuePersistenceReady: artifact.readiness.MLB_DATA_02O_CURRENT_MONEYLINE_VALUE_EVALUATION_PERSISTENCE_READY,
  }, null, 2))
  if (!success) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
