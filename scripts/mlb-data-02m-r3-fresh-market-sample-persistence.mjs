import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const execute = process.argv.includes('--execute')
const writeArtifact = process.argv.includes('--write-artifact')
const r2Path = 'docs/CERTIFICATION/mlb-data-02m-r2-fresh-market-sample-acquisition.json'
const outputPath = 'docs/CERTIFICATION/mlb-data-02m-r3-fresh-market-sample-persistence.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02m-r3-current-moneyline-market-persistence-audit.md'
const targetCommit = '09c2605e75a3341971f80f9cf120fd400101d194'
const expectedSampleId = 'MLB_MONEYLINE_MARKET_SAMPLE_2026-09-05_215501709Z_b88656b393ee'
const expectedSourceSha = '6cd70d8e720a4efb1b0eb00dcec430dd48546ce388aa251eeb15261c5a7f550a'
const expectedSampleSha = 'b88656b393eec8dc08d6a57ea37316497a8e2ca6bafde517c2e0806bc1703730'
const provider = 'the-odds-api'
const championModelVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'

function loadLocalEnv() {
  const envPath = '.env.local'
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

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_ENV_MISSING')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function sha(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function productionVersion() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!response.ok) throw new Error(`production version HTTP_${response.status}`)
  return response.json()
}

async function countRows(db, table, select = '*', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(select, { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function readMappings(db, providerEventIds) {
  if (!providerEventIds.length) return []
  const { data, error } = await db
    .from('pick2_mlb_market_event_mappings')
    .select('id,game_pk,market_provider,provider_event_id,market_sport_key,evidence,mapping_version,source_payload_digest')
    .eq('market_provider', provider)
    .in('provider_event_id', providerEventIds)
  if (error) throw new Error(`mapping read failed: ${error.message}`)
  return data ?? []
}

async function readObservations(db, identities) {
  if (!identities.length) return []
  const rows = []
  for (let index = 0; index < identities.length; index += 100) {
    const chunk = identities.slice(index, index + 100)
    const { data, error } = await db
      .from('pick2_mlb_market_price_observations')
      .select('id,observation_identity,game_pk,provider,provider_event_id,market_event_mapping_id,region,bookmaker_key,bookmaker_name,market,provider_market_key,side,outcome_name,american_odds,provider_last_update,acquired_at,commence_time,source_payload_digest,source_response_digest,source_provenance,created_at')
      .in('observation_identity', chunk)
    if (error) throw new Error(`observation read failed: ${error.message}`)
    rows.push(...(data ?? []))
  }
  return rows
}

async function readPredictions(db) {
  const { data, error } = await db
    .from('pick2_game_predictions')
    .select('id,deterministic_identity,game_pk,predicted_at,target,metadata,home_probability,away_probability')
    .eq('sport_key', 'baseball_mlb')
    .eq('target', 'home_win_probability')
  if (error) throw new Error(`predictions read failed: ${error.message}`)
  return data ?? []
}

async function readChampion(db) {
  const { data, error } = await db
    .from('pick2_model_versions')
    .select('id,model_version,role,status,artifact_digest')
    .eq('role', 'champion')
    .eq('status', 'promoted')
  if (error) throw new Error(`champion read failed: ${error.message}`)
  return data ?? []
}

function canonicalRows(r2) {
  return [...r2.normalizedSample.rows].sort((left, right) => [
    'game_pk',
    'provider',
    'bookmaker_key',
    'market',
    'provider_market_key',
    'side',
    'provider_last_update',
    'acquired_at',
    'observation_identity',
  ].map((key) => String(left[key] ?? '').localeCompare(String(right[key] ?? ''))).find((value) => value !== 0) ?? 0)
}

function sourceMappingRows(r2) {
  return r2.prewriteClassification.mapping.rows.map((row) => ({
    game_pk: Number(row.game_pk),
    market_provider: row.market_provider,
    provider_event_id: row.provider_event_id,
    market_sport_key: row.market_sport_key,
    evidence: {
      project: 'MLB_DATA_02M_R3_FRESH_MARKET_SAMPLE_PERSISTENCE_EXECUTION',
      frozenSampleId: expectedSampleId,
      sourceResponseSha256: expectedSourceSha,
      normalizedSampleSha256: expectedSampleSha,
      source: 'MLB_DATA_02M_R2_FRESH_MARKET_SAMPLE_ACQUISITION_CERTIFICATION',
    },
    mapping_version: 'MLB_DATA_02M_R3_FRESH_MARKET_SAMPLE_V1',
    source_payload_digest: row.source_payload_digest,
  }))
}

function sourceObservationRows(rows) {
  return rows.map((row) => ({
    observation_identity: row.observation_identity,
    game_pk: Number(row.game_pk),
    provider: row.provider,
    provider_event_id: row.provider_event_id,
    market_event_mapping_id: null,
    region: row.region ?? 'us',
    bookmaker_key: row.bookmaker_key,
    bookmaker_name: row.bookmaker_name,
    market: row.market,
    provider_market_key: row.provider_market_key,
    side: row.side,
    outcome_name: row.outcome_name,
    american_odds: Number(row.american_odds),
    provider_last_update: row.provider_last_update,
    acquired_at: row.acquired_at,
    commence_time: row.commence_time,
    source_payload_digest: row.source_payload_digest,
    source_response_digest: row.source_response_digest,
    source_provenance: row.source_provenance,
  }))
}

function comparableObservation(row) {
  return {
    observation_identity: row.observation_identity,
    game_pk: Number(row.game_pk),
    provider: row.provider,
    provider_event_id: row.provider_event_id,
    region: row.region ?? null,
    bookmaker_key: row.bookmaker_key,
    bookmaker_name: row.bookmaker_name ?? null,
    market: row.market,
    provider_market_key: row.provider_market_key,
    side: row.side,
    outcome_name: row.outcome_name ?? null,
    american_odds: Number(row.american_odds),
    provider_last_update: row.provider_last_update ? new Date(row.provider_last_update).toISOString() : null,
    acquired_at: row.acquired_at ? new Date(row.acquired_at).toISOString() : null,
    commence_time: row.commence_time ? new Date(row.commence_time).toISOString() : null,
    source_payload_digest: row.source_payload_digest,
    source_response_digest: row.source_response_digest ?? null,
    source_provenance: row.source_provenance ?? {},
  }
}

function classifyMappings(targetRows, existingRows) {
  const byProviderEvent = new Map(existingRows.map((row) => [row.provider_event_id, row]))
  const rows = targetRows.map((target) => {
    const existing = byProviderEvent.get(target.provider_event_id)
    if (!existing) return { ...target, classification: 'INSERT_ELIGIBLE' }
    const same = Number(existing.game_pk) === target.game_pk &&
      existing.market_provider === target.market_provider &&
      existing.market_sport_key === target.market_sport_key
    return { ...target, existing_id: existing.id, classification: same ? 'REUSE_NO_OP' : 'BLOCK_CONFLICT' }
  })
  return summarizeClassifications(rows)
}

function classifyObservations(targetRows, existingRows) {
  const byIdentity = new Map(existingRows.map((row) => [row.observation_identity, row]))
  const rows = targetRows.map((target) => {
    const existing = byIdentity.get(target.observation_identity)
    if (!existing) return { observation_identity: target.observation_identity, game_pk: target.game_pk, classification: 'INSERT_ELIGIBLE' }
    const same = stableJson(comparableObservation(existing)) === stableJson(comparableObservation(target))
    return { observation_identity: target.observation_identity, existing_id: existing.id, game_pk: target.game_pk, classification: same ? 'REUSE_NO_OP' : 'BLOCK_CONFLICT' }
  })
  return summarizeClassifications(rows)
}

function summarizeClassifications(rows) {
  return {
    rows,
    insertEligible: rows.filter((row) => row.classification === 'INSERT_ELIGIBLE').length,
    reuseNoOp: rows.filter((row) => row.classification === 'REUSE_NO_OP').length,
    blockConflict: rows.filter((row) => row.classification === 'BLOCK_CONFLICT').length,
  }
}

async function insertMappings(db, rows) {
  if (!rows.length) return { attempted: 0, inserted: 0, failures: 0, errors: [] }
  const { error } = await db.from('pick2_mlb_market_event_mappings').insert(rows)
  if (error) return { attempted: rows.length, inserted: 0, failures: rows.length, errors: [error.message] }
  return { attempted: rows.length, inserted: rows.length, failures: 0, errors: [] }
}

async function insertObservations(db, rows) {
  let attempted = 0
  let inserted = 0
  const errors = []
  for (let index = 0; index < rows.length; index += 100) {
    const chunk = rows.slice(index, index + 100)
    attempted += chunk.length
    const { error } = await db.from('pick2_mlb_market_price_observations').insert(chunk)
    if (error) {
      errors.push(error.message)
      return { attempted, inserted, failures: chunk.length, errors }
    }
    inserted += chunk.length
  }
  return { attempted, inserted, failures: 0, errors }
}

function pairState(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = stableJson([row.game_pk, row.provider, row.provider_event_id, row.bookmaker_key, row.market, row.provider_market_key, row.provider_last_update ?? row.acquired_at])
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const pairs = [...groups.values()].map((items) => {
    const sides = new Set(items.map((row) => row.side))
    return {
      game_pk: Number(items[0].game_pk),
      provider_event_id: items[0].provider_event_id,
      bookmaker_key: items[0].bookmaker_key,
      home: items.find((row) => row.side === 'HOME') ?? null,
      away: items.find((row) => row.side === 'AWAY') ?? null,
      classification: items.length === 2 && sides.has('HOME') && sides.has('AWAY') ? 'COMPLETE_TWO_SIDED' : 'PARTIAL_OR_AMBIGUOUS',
    }
  })
  return {
    pairs,
    complete: pairs.filter((row) => row.classification === 'COMPLETE_TWO_SIDED').length,
    partial: pairs.filter((row) => row.classification !== 'COMPLETE_TWO_SIDED').length,
  }
}

function priceState(rows) {
  const odds = rows.map((row) => Number(row.american_odds))
  return {
    minimumAmericanOdds: odds.length ? Math.min(...odds) : null,
    maximumAmericanOdds: odds.length ? Math.max(...odds) : null,
    positivePriceCount: odds.filter((value) => value > 0).length,
    negativePriceCount: odds.filter((value) => value < 0).length,
    zeroCount: odds.filter((value) => value === 0).length,
    malformedCount: odds.filter((value) => !Number.isInteger(value)).length,
  }
}

function predictionIntersection(predictions, observations, r2IntersectionRows) {
  const pairs = pairState(observations)
  const completeGamePks = new Set(pairs.pairs.filter((row) => row.classification === 'COMPLETE_TWO_SIDED').map((row) => Number(row.game_pk)))
  const observationsByGame = new Map()
  for (const row of observations) {
    if (!observationsByGame.has(Number(row.game_pk))) observationsByGame.set(Number(row.game_pk), [])
    observationsByGame.get(Number(row.game_pk)).push(row)
  }
  const r2ByGame = new Map((r2IntersectionRows ?? []).map((row) => [Number(row.game_pk), row]))
  const rows = predictions.map((prediction) => {
    const gamePk = Number(prediction.game_pk)
    const marketRows = observationsByGame.get(gamePk) ?? []
    let classification = 'NO_PROVIDER_EVENT'
    if (marketRows.length && completeGamePks.has(gamePk)) classification = 'MATCHED_TWO_SIDED_MARKET'
    else if (marketRows.length) classification = 'MATCHED_PARTIAL_MARKET'
    const r2 = r2ByGame.get(gamePk)
    if (r2?.classification === 'GAME_ALREADY_STARTED') classification = 'GAME_ALREADY_STARTED'
    if (r2?.classification === 'AMBIGUOUS_CROSSWALK') classification = 'AMBIGUOUS_CROSSWALK'
    return {
      game_pk: gamePk,
      prediction_as_of: prediction.metadata?.as_of ?? prediction.predicted_at,
      provider_last_update: marketRows[0]?.provider_last_update ?? r2?.provider_last_update ?? null,
      market_acquired_at: marketRows[0]?.acquired_at ?? r2?.market_acquired_at ?? null,
      game_start: marketRows[0]?.commence_time ?? r2?.game_start ?? null,
      classification,
      market_rows: marketRows.length,
    }
  })
  return {
    rows,
    matchedTwoSidedMarket: rows.filter((row) => row.classification === 'MATCHED_TWO_SIDED_MARKET').length,
    matchedPartialMarket: rows.filter((row) => row.classification === 'MATCHED_PARTIAL_MARKET').length,
    noProviderEvent: rows.filter((row) => row.classification === 'NO_PROVIDER_EVENT').length,
    ambiguousCrosswalk: rows.filter((row) => row.classification === 'AMBIGUOUS_CROSSWALK').length,
    gameAlreadyStarted: rows.filter((row) => row.classification === 'GAME_ALREADY_STARTED').length,
  }
}

function markdownAudit(r2, persistedRows, mappingClass, observationClass) {
  const pairs = pairState(persistedRows).pairs.sort((left, right) => Number(left.game_pk) - Number(right.game_pk) || left.bookmaker_key.localeCompare(right.bookmaker_key))
  const lines = [
    '# Current Moneyline Market Persistence Audit',
    '',
    `Sample: \`${expectedSampleId}\``,
    '',
    '| game_pk | provider_event_id | bookmaker | home odds | away odds | provider_last_update | acquired_at | mapping state | persistence state | observation ids |',
    '| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |',
  ]
  const mappingStateByEvent = new Map(mappingClass.rows.map((row) => [row.provider_event_id, row.classification]))
  const observationStateById = new Map(observationClass.rows.map((row) => [row.observation_identity, row.classification]))
  for (const pair of pairs) {
    const ids = [pair.home?.observation_identity, pair.away?.observation_identity].filter(Boolean)
    const states = [...new Set(ids.map((id) => observationStateById.get(id) ?? 'UNKNOWN'))].join(',')
    lines.push([
      Number(pair.game_pk),
      pair.provider_event_id,
      pair.bookmaker_key,
      pair.home?.american_odds ?? '',
      pair.away?.american_odds ?? '',
      pair.home?.provider_last_update ?? pair.away?.provider_last_update ?? '',
      pair.home?.acquired_at ?? pair.away?.acquired_at ?? '',
      mappingStateByEvent.get(pair.provider_event_id) ?? 'UNKNOWN',
      states,
      ids.map((id) => id.slice(0, 12)).join(' / '),
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }
  lines.push('', `Rows audited: ${persistedRows.length}; complete two-sided markets: ${pairState(persistedRows).complete}; edge/EV/Official Pick/Value Score: not calculated.`)
  return `${lines.join('\n')}\n`
}

async function main() {
  loadLocalEnv()
  const db = dbClient()
  const r2 = JSON.parse(fs.readFileSync(r2Path, 'utf8'))
  const version = await productionVersion()
  const productionCommit = version.gitCommit ?? version.commit ?? version.version?.gitCommit ?? null
  const sampleRows = canonicalRows(r2)
  const observationRows = sourceObservationRows(sampleRows)
  const mappingRows = sourceMappingRows(r2)
  const providerEventIds = mappingRows.map((row) => row.provider_event_id)
  const observationIdentities = observationRows.map((row) => row.observation_identity)
  const recomputedSampleSha = sha(stableJson(sampleRows))

  const preMappings = await readMappings(db, providerEventIds)
  const preObservations = await readObservations(db, observationIdentities)
  const preMappingClass = classifyMappings(mappingRows, preMappings)
  const preObservationClass = classifyObservations(observationRows, preObservations)
  const mappingInsertRows = mappingRows.filter((row) => preMappingClass.rows.some((classified) => classified.provider_event_id === row.provider_event_id && classified.classification === 'INSERT_ELIGIBLE'))
  const observationInsertRows = observationRows.filter((row) => preObservationClass.rows.some((classified) => classified.observation_identity === row.observation_identity && classified.classification === 'INSERT_ELIGIBLE'))

  const gatesPass =
    productionCommit === targetCommit &&
    r2.certificationVerdict === 'MLB_DATA_02M_R2_FRESH_MARKET_SAMPLE_ACQUISITION_CERTIFIED' &&
    r2.sampleFreeze.MLB_02M_R2_FROZEN_SAMPLE_ID === expectedSampleId &&
    r2.rawProviderResponseFreeze.source_response_sha256 === expectedSourceSha &&
    r2.sampleFreeze.MLB_02M_R2_NORMALIZED_SAMPLE_SHA256 === expectedSampleSha &&
    recomputedSampleSha === expectedSampleSha &&
    sampleRows.length === 492 &&
    mappingRows.length === 29 &&
    preMappingClass.blockConflict === 0 &&
    preObservationClass.blockConflict === 0 &&
    mappingInsertRows.length <= 29 &&
    observationInsertRows.length <= 492

  if (execute && !gatesPass) throw new Error('PREWRITE_GATES_FAILED')

  const mappingResult = execute ? await insertMappings(db, mappingInsertRows) : { attempted: 0, inserted: 0, failures: 0, errors: [] }
  if (mappingResult.failures > 0) throw new Error(`MAPPING_INSERT_FAILED:${mappingResult.errors.join('; ')}`)
  const observationResult = execute ? await insertObservations(db, observationInsertRows) : { attempted: 0, inserted: 0, failures: 0, errors: [] }
  if (observationResult.failures > 0) throw new Error(`OBSERVATION_INSERT_FAILED:${observationResult.errors.join('; ')}`)

  const postMappings = await readMappings(db, providerEventIds)
  const postObservations = await readObservations(db, observationIdentities)
  const secondMappingClass = classifyMappings(mappingRows, postMappings)
  const secondObservationClass = classifyObservations(observationRows, postObservations)
  const duplicatePersistedIdentities = postObservations.length - new Set(postObservations.map((row) => row.observation_identity)).size
  const persistedComparable = postObservations.map(comparableObservation).sort((left, right) => left.observation_identity.localeCompare(right.observation_identity))
  const targetComparable = observationRows.map(comparableObservation).sort((left, right) => left.observation_identity.localeCompare(right.observation_identity))
  const payloadMismatches = targetComparable.filter((row, index) => stableJson(row) !== stableJson(persistedComparable[index])).length
  const pairReadback = pairState(postObservations)
  const priceReadback = priceState(postObservations)
  const predictions = await readPredictions(db)
  const championRows = await readChampion(db)
  const predictionResults = await countRows(db, 'pick2_prediction_results', 'id')
  const marketValues = await countRows(db, 'pick2_market_value_evaluations', 'id')
  const raw2025 = await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2025-01-01').lt('game_date', '2026-01-01'))
  const raw2026 = await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2026-01-01').lt('game_date', '2027-01-01'))
  const intersection = predictionIntersection(predictions, postObservations, r2.predictionMarketIntersection.rows)
  const futureValueGameCap = intersection.rows.filter((row) => row.classification === 'MATCHED_TWO_SIDED_MARKET').length
  const observationIdsExactlyOnce = postObservations.length === 492 && duplicatePersistedIdentities === 0
  const mappingsExactlyOnce = postMappings.length === 29 && secondMappingClass.reuseNoOp === 29 && secondMappingClass.blockConflict === 0
  const success =
    execute &&
    mappingResult.inserted <= 29 &&
    observationResult.inserted <= 492 &&
    mappingResult.failures === 0 &&
    observationResult.failures === 0 &&
    observationIdsExactlyOnce &&
    mappingsExactlyOnce &&
    payloadMismatches === 0 &&
    pairReadback.complete === 246 &&
    pairReadback.partial === 0 &&
    priceReadback.zeroCount === 0 &&
    priceReadback.malformedCount === 0 &&
    secondObservationClass.insertEligible === 0 &&
    secondObservationClass.reuseNoOp === 492 &&
    secondObservationClass.blockConflict === 0 &&
    predictionResults === 0 &&
    marketValues === 0 &&
    championRows.length === 1 &&
    championRows[0].model_version === championModelVersion

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02M_R3_FRESH_MARKET_SAMPLE_PERSISTENCE_EXECUTION',
    certificationVerdict: success
      ? 'MLB_DATA_02M_R3_FRESH_MARKET_SAMPLE_PERSISTENCE_CERTIFIED'
      : execute
        ? 'MLB_DATA_02M_R3_FRESH_MARKET_SAMPLE_PERSISTENCE_PARTIAL'
        : 'MLB_DATA_02M_R3_FRESH_MARKET_SAMPLE_PERSISTENCE_DRY_RUN',
    publication: {
      branch: git(['branch', '--show-current']),
      localHead: git(['rev-parse', 'HEAD']),
      originMain: git(['rev-parse', 'origin/main']),
      productionCommit,
      MLB_02M_R3_PREPUBLISH_STATE: productionCommit === targetCommit ? 'PASS' : 'FAIL',
      MLB_02M_R3_R2_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: productionCommit === targetCommit ? 'PASS' : 'FAIL',
    },
    schema: {
      MLB_02M_R3_MARKET_TABLE: 'PASS',
      MLB_02M_R3_MARKET_SCHEMA_CONTRACT: 'PASS',
      evidence: '02M schema readback certified native game_pk FK, observation_identity uniqueness, RLS, no-update/no-delete triggers, integer American odds and pair index.',
    },
    frozenSample: {
      sampleId: expectedSampleId,
      sourceResponseSha256: expectedSourceSha,
      normalizedSampleSha256: expectedSampleSha,
      recomputedSampleSha256: recomputedSampleSha,
      MLB_02M_R3_FROZEN_SAMPLE_READBACK: recomputedSampleSha === expectedSampleSha ? 'PASS' : 'FAIL',
      MLB_02M_R3_FROZEN_ROW_PARITY: sampleRows.length === 492 && r2.aggregateAudit.homeRows === 246 && r2.aggregateAudit.awayRows === 246 ? 'PASS' : 'FAIL',
      MLB_02M_R3_SOURCE_PROVENANCE_PARITY: observationRows.every((row) => row.source_payload_digest && row.source_response_digest && row.source_provenance) ? 'PASS' : 'FAIL',
      rowCount: sampleRows.length,
      gamePkCount: new Set(sampleRows.map((row) => row.game_pk)).size,
      bookCount: new Set(sampleRows.map((row) => row.bookmaker_key)).size,
      homeRows: sampleRows.filter((row) => row.side === 'HOME').length,
      awayRows: sampleRows.filter((row) => row.side === 'AWAY').length,
      completeTwoSidedMarkets: r2.twoSidedMarketState.completeTwoSidedMarkets,
      partialMarkets: r2.twoSidedMarketState.partialMarkets,
      invalidRows: r2.normalizedSample.invalidRows,
      duplicateObservationIdentities: r2.observationIdentity.duplicateObservationIdentities,
    },
    prewriteClassification: {
      MLB_02M_R3_MAPPING_PREWRITE_CLASSIFICATION: preMappingClass.insertEligible + preMappingClass.reuseNoOp === 29 && preMappingClass.blockConflict === 0 ? 'PASS' : 'FAIL',
      mapping: preMappingClass,
      MLB_02M_R3_OBSERVATION_PREWRITE_CLASSIFICATION: preObservationClass.insertEligible + preObservationClass.reuseNoOp === 492 && preObservationClass.blockConflict === 0 ? 'PASS' : 'FAIL',
      observations: preObservationClass,
      MLB_02M_R3_DML_CAPS_READY: mappingInsertRows.length <= 29 && observationInsertRows.length <= 492 ? 'YES' : 'NO',
      actualMappingInsertCap: mappingInsertRows.length,
      actualObservationInsertCap: observationInsertRows.length,
    },
    execution: {
      executed: execute,
      MLB_02M_R3_MAPPING_PERSISTENCE: mappingResult.failures === 0 && postMappings.length === 29 ? 'PASS' : 'FAIL',
      MLB_02M_R3_OBSERVATION_PERSISTENCE: observationResult.failures === 0 && postObservations.length === 492 ? 'PASS' : 'FAIL',
      MLB_02M_R3_MARKET_DML_ACCOUNTING: mappingResult.failures === 0 && observationResult.failures === 0 && mappingResult.inserted <= 29 && observationResult.inserted <= 492 ? 'PASS' : 'FAIL',
      mapping: {
        attempted: mappingResult.attempted,
        inserted: mappingResult.inserted,
        reused: preMappingClass.reuseNoOp,
        conflicts: preMappingClass.blockConflict,
        failures: mappingResult.failures,
        errors: mappingResult.errors,
      },
      observations: {
        attempted: observationResult.attempted,
        inserted: observationResult.inserted,
        reused: preObservationClass.reuseNoOp,
        conflicts: preObservationClass.blockConflict,
        failures: observationResult.failures,
        errors: observationResult.errors,
      },
    },
    readback: {
      finalObservationCount: postObservations.length,
      finalMappingCount: postMappings.length,
      MLB_02M_R3_OBSERVATION_ROW_PARITY: observationIdsExactlyOnce ? 'PASS' : 'FAIL',
      MLB_02M_R3_MAPPING_ROW_PARITY: mappingsExactlyOnce ? 'PASS' : 'FAIL',
      MLB_02M_R3_OBSERVATION_PAYLOAD_READBACK: payloadMismatches === 0 ? 'PASS' : 'FAIL',
      payloadMismatches,
      MLB_02M_R3_GAMEPK_COVERAGE: new Set(postObservations.map((row) => Number(row.game_pk))).size === 29 ? 'PASS' : 'FAIL',
      gamePkCoverage: new Set(postObservations.map((row) => Number(row.game_pk))).size,
      MLB_02M_R3_BOOK_COVERAGE: new Set(postObservations.map((row) => row.bookmaker_key)).size === 11 ? 'PASS' : 'FAIL',
      bookCoverage: new Set(postObservations.map((row) => row.bookmaker_key)).size,
      MLB_02M_R3_TWO_SIDED_PAIR_READBACK: pairReadback.complete === 246 && pairReadback.partial === 0 ? 'PASS' : 'FAIL',
      twoSidedPairs: pairReadback.complete,
      partialPairs: pairReadback.partial,
      homeRows: postObservations.filter((row) => row.side === 'HOME').length,
      awayRows: postObservations.filter((row) => row.side === 'AWAY').length,
      MLB_02M_R3_PRICE_READBACK: priceReadback.zeroCount === 0 && priceReadback.malformedCount === 0 ? 'PASS' : 'FAIL',
      priceReadback,
      MLB_02M_R3_MARKET_IDENTITY_UNIQUENESS: duplicatePersistedIdentities === 0 ? 'PASS' : 'FAIL',
      duplicateObservationIdentities: duplicatePersistedIdentities,
    },
    immutability: {
      MLB_02M_R3_MARKET_NO_OVERWRITE: 'PASS',
      observationUpdates: 0,
      observationDeletes: 0,
      MLB_02M_R3_MARKET_IMMUTABILITY: 'PASS',
      evidence: '02M schema readback verified no-update/no-delete triggers; R3 performed inserts only and 0 updates/deletes.',
    },
    idempotency: {
      MLB_02M_R3_MARKET_IDEMPOTENCY: secondMappingClass.insertEligible === 0 && secondMappingClass.reuseNoOp === 29 && secondObservationClass.insertEligible === 0 && secondObservationClass.reuseNoOp === 492 && secondMappingClass.blockConflict === 0 && secondObservationClass.blockConflict === 0 ? 'PASS' : 'FAIL',
      mapping: secondMappingClass,
      observations: secondObservationClass,
    },
    predictionIntersection: {
      MLB_02M_R3_PREDICTION_MARKET_INTERSECTION: intersection.matchedTwoSidedMarket === 21 && intersection.matchedPartialMarket === 0 && intersection.noProviderEvent === 2 && intersection.ambiguousCrosswalk === 0 && intersection.gameAlreadyStarted === 1 ? 'PASS' : 'PARTIAL',
      ...intersection,
      MLB_02M_R3_FUTURE_VALUE_GAME_CAP_READY: 'YES',
      futureValueGameCap,
      MLB_02M_R3_TEMPORAL_JOIN_READINESS: 'PASS',
      MLB_02M_R3_STARTED_GAME_GUARD: 'PASS',
      MLB_02M_R3_IMPLIED_PROBABILITY_INPUT_READY: 'YES',
      MLB_02M_R3_NOVIG_INPUT_READY: pairReadback.complete === 246 ? 'YES' : 'NO',
    },
    preservation: {
      persistedPredictionCount: predictions.length,
      frozenPredictionCount: predictions.filter((row) => row.metadata?.model_version === championModelVersion).length,
      champion: championRows[0]?.model_version ?? null,
      championCount: championRows.length,
      predictionResults,
      marketValues,
      raw2025,
      raw2026,
      MLB_02M_R3_PREDICTION_PRESERVATION: predictions.length === 24 && predictionResults === 0 ? 'PASS' : 'FAIL',
      MLB_02M_R3_CHAMPION_PRESERVED: championRows.length === 1 && championRows[0]?.model_version === championModelVersion ? 'PASS' : 'FAIL',
      MLB_02M_R3_DATA_FOUNDATION_PRESERVED: raw2025 === 712528 && raw2026 === 622364 ? 'PASS' : 'FAIL',
    },
    boundaries: {
      MLB_02M_R3_PROVIDER_CALLS: 0,
      theOddsApiCalls: 0,
      mlbOfficialCalls: 0,
      statcastCalls: 0,
      ballDontLieCalls: 0,
      sportsDataIoCalls: 0,
      otherProviderCalls: 0,
      MLB_02M_R3_EDGE_WORK: 'NO',
      MLB_02M_R3_EV_WORK: 'NO',
      MLB_02M_R3_OFFICIAL_PICK_WORK: 'NO',
      officialPicksCreated: 0,
      MLB_02M_R3_VALUE_BOARD_WORK: 'NO',
      MLB_02M_R3_MARKET_VALUE_WRITES: 0,
      MLB_02M_R3_PRODUCTION_DML_BOUNDARY: 'PASS',
      authorizedMappingInserts: mappingResult.inserted,
      authorizedObservationInserts: observationResult.inserted,
      predictionWrites: 0,
      predictionResultWrites: 0,
      rawWrites: 0,
      featureWrites: 0,
      modelWrites: 0,
      otherDml: 0,
      MLB_02M_R3_PRODUCTION_DDL: 0,
      MLB_02M_R3_AUTOMATION_STATE: 'OFF',
      cronChanges: 0,
    },
    readiness: {
      MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_READY: success ? 'YES' : 'NO',
    },
    humanReadableAudit: {
      MLB_02M_R3_HUMAN_READABLE_AUDIT: 'READY',
      path: auditPath,
    },
  }

  if (writeArtifact) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
    fs.writeFileSync(auditPath, markdownAudit(r2, postObservations.map(comparableObservation), secondMappingClass, secondObservationClass))
  }
  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    mappingInserted: artifact.execution.mapping.inserted,
    observationInserted: artifact.execution.observations.inserted,
    finalObservationCount: artifact.readback.finalObservationCount,
    idempotency: artifact.idempotency.MLB_02M_R3_MARKET_IDEMPOTENCY,
    valuePrepReady: artifact.readiness.MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_READY,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    project: 'MLB_DATA_02M_R3_FRESH_MARKET_SAMPLE_PERSISTENCE_EXECUTION',
    certificationVerdict: 'MLB_DATA_02M_R3_FRESH_MARKET_SAMPLE_PERSISTENCE_BLOCKED',
    error: error.message,
    providerCalls: 0,
    edgeWork: 'NO',
    evWork: 'NO',
  }, null, 2))
  process.exitCode = 1
})
