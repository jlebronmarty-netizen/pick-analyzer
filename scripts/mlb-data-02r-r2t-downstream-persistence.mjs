import fs from 'node:fs'
import { assertGameScope, classifyInsertReuseConflict, sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'
import { MODEL_VERSION, FEATURE_SET, FEATURE_VERSION, ARTIFACT_DIGEST, inferChampion, verifyChampionRegistry } from './mlb-data-02r-r2t-real-feature-champion.mjs'
import { assemblePregameVector } from './mlb-data-02r-r2t-r1-pregame-contract.mjs'
import { inputPayload } from './mlb-data-02i-current-moneyline-dry-inference-prep.mjs'

const schema = JSON.parse(fs.readFileSync('docs/CERTIFICATION/MLB_OPERATIONAL_DOWNSTREAM_SCHEMA_REVIEW.json', 'utf8')).schema
export const DOWNSTREAM_BINDINGS = Object.freeze({
  predictions: { table: 'pick2_game_predictions', identity: 'deterministic_identity', read: 'readPredictions', insert: 'insertPredictions' },
  marketMappings: { table: 'pick2_mlb_market_event_mappings', identity: 'provider_event_id', read: 'readMarketMappings', insert: 'insertMarketMappings' },
  marketObservations: { table: 'pick2_mlb_market_price_observations', identity: 'observation_identity', read: 'readMarketObservations', insert: 'insertMarketObservations' },
  values: { table: 'pick2_mlb_market_value_evaluations', identity: 'value_identity', read: 'readValues', insert: 'insertValues' },
  officialPicks: { table: 'pick2_mlb_official_picks', identity: 'official_pick_identity', read: 'readOfficialPicks', insert: 'insertOfficialPicks' },
})
const ensure = (value, reason) => { if (!value) throw new Error(`R2T_PERSISTENCE_BLOCK:${reason}`) }
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)

export function downstreamSchemaColumns(table) {
  return schema.find(s => s.table_name === table)?.columns.map(c => c.column) ?? null
}

// Match PostgreSQL's decimal rounding of JSON numeric input, including ties.
// This is physical storage coercion; the real model/vector math is untouched.
export function quantizePostgresNumber(value, scale) {
  if (value === null) return null
  ensure(Number.isFinite(value) && Number.isInteger(scale) && scale >= 0, 'NUMERIC_STORAGE_COERCION')
  const [mantissa, exponent = '0'] = Math.abs(value).toString().split('e')
  const fraction = mantissa.split('.')[1]?.length ?? 0
  const power = scale + Number(exponent) - fraction
  let digits = BigInt(mantissa.replace('.', ''))
  if (power >= 0) digits *= 10n ** BigInt(power)
  else { const divisor = 10n ** BigInt(-power); digits = (digits + divisor / 2n) / divisor }
  const text = digits.toString().padStart(scale + 1, '0')
  return Number(`${value < 0 ? '-' : ''}${scale ? `${text.slice(0, -scale)}.${text.slice(-scale)}` : text}`)
}

export function normalizeDownstreamPayload(domain, row) {
  assertDownstreamPayload(domain, row)
  const payload = { ...row }
  for (const column of schema.find(s => s.table_name === DOWNSTREAM_BINDINGS[domain].table).columns) {
    const match = column.physical_type?.match(/^numeric\(\d+,(\d+)\)$/)
    if (match && Object.hasOwn(payload, column.column)) payload[column.column] = quantizePostgresNumber(payload[column.column], Number(match[1]))
  }
  return payload
}

export function assertDownstreamPayload(domain, row) {
  const binding = DOWNSTREAM_BINDINGS[domain]
  ensure(binding, 'UNEXPECTED_WRITE_TARGET')
  const columns = schema.find(s => s.table_name === binding.table).columns
  const byName = new Map(columns.map(c => [c.column, c]))
  for (const [key, value] of Object.entries(row)) {
    const column = byName.get(key)
    ensure(column && !['id', 'created_at', 'updated_at'].includes(key), `UNEXPECTED_COLUMN:${domain}:${key}`)
    ensure(value !== undefined, `UNDEFINED:${key}`)
    if (value === null) { ensure(column.nullable === 'YES', `NULL:${key}`); continue }
    if (column.type === 'uuid') ensure(uuid(value), `UUID:${key}`)
    if (column.type === 'text') ensure(typeof value === 'string', `TEXT:${key}`)
    if (column.type.includes('timestamp')) ensure(typeof value === 'string' && Number.isFinite(Date.parse(value)), `TIMESTAMP:${key}`)
    if (['numeric', 'bigint', 'integer'].includes(column.type)) ensure(typeof value === 'number' && Number.isFinite(value), `NUMBER:${key}`)
  }
  for (const c of columns.filter(c => c.nullable === 'NO' && c.default === null)) ensure(row[c.column] !== null && row[c.column] !== undefined, `REQUIRED:${c.column}`)
  ensure(Number.isSafeInteger(row.game_pk) && row.game_pk > 0, 'GAME_PK')
  return row
}

function comparable(domain, stored, planned) {
  const columns = schema.find(s => s.table_name === DOWNSTREAM_BINDINGS[domain].table).columns
  const value = {}
  for (const key of Object.keys(planned)) {
    const c = columns.find(c => c.column === key)
    const raw = stored[key]
    value[key] = raw == null ? raw : c.type.includes('timestamp') ? new Date(raw).toISOString() : ['numeric', 'bigint', 'integer'].includes(c.type) ? Number(raw) : raw
  }
  return value
}

// Uses the existing INSERT_ELIGIBLE / REUSE_NO_OP classifier, with a digest of
// every planned physical value. A digest column alone cannot prove readback.
export async function persistDownstreamRows({ domain, rows, repository, eligibleGamePks, cap = rows.length, beforeWrite }) {
  const binding = DOWNSTREAM_BINDINGS[domain]
  ensure(binding && typeof beforeWrite === 'function', 'WRITE_GUARD_REQUIRED')
  ensure(Number.isInteger(cap) && cap >= 0, 'INVALID_CAP')
  rows = rows.map(row => normalizeDownstreamPayload(domain, row))
  assertGameScope(rows, eligibleGamePks)
  let identities = rows.map(row => row[binding.identity])
  ensure(new Set(identities).size === rows.length, 'DUPLICATE_PLAN_IDENTITY')
  const plannedById = new Map(rows.map(row => [row[binding.identity], row]))
  const classify = stored => {
    ensure(stored.length <= rows.length && new Set(stored.map(r => r[binding.identity])).size === stored.length, 'DUPLICATE_READBACK')
    for (const row of stored) ensure(plannedById.has(row[binding.identity]) && uuid(row.id), 'READBACK_IDENTITY')
    return classifyInsertReuseConflict({
      plannedRows: rows.map(row => ({ ...row, physical_digest: sha256(comparable(domain, row, row)) })),
      existingRows: stored.map(row => ({ ...row, physical_digest: sha256(comparable(domain, row, plannedById.get(row[binding.identity]))) })),
      identityFields: [binding.identity], digestField: 'physical_digest', eligibleGamePks, cap,
    })
  }
  let existing = rows.length ? await repository[binding.read](identities) : []
  let plan = classify(existing)
  const missing = new Set(plan.classifications.filter(c => c.classification === 'INSERT_ELIGIBLE').map(c => c.identity))
  let inserts = rows.filter(row => missing.has(String(row[binding.identity])))
  ensure(inserts.length === plan.insertEligible && inserts.length <= cap, 'INSERT_CAP_OR_LINKAGE')
  let actualInserted=0
  if (inserts.length) {
    const selection = await beforeWrite({ domain, rows: inserts, plannedRows: rows, cap, plan })
    if(selection?.eligibleGamePks) {
      ensure(Array.isArray(selection.eligibleGamePks) && new Set(selection.eligibleGamePks).size===selection.eligibleGamePks.length && selection.eligibleGamePks.every(pk=>rows.some(r=>r.game_pk===pk)),'VETO_SCOPE_ESCAPE')
      rows=rows.filter(r=>selection.eligibleGamePks.includes(r.game_pk))
      identities=rows.map(r=>r[binding.identity])
      existing=existing.filter(r=>identities.includes(r[binding.identity]))
      plan=classify(existing)
      inserts=inserts.filter(r=>identities.includes(r[binding.identity]))
      ensure(inserts.length===plan.insertEligible,'VETO_PLAN_LINKAGE')
    }
    if(inserts.length) {
    const write = await repository[binding.insert](inserts, cap)
    const raceReuse=['marketObservations','values','officialPicks'].includes(domain)?(write.reused??0):0
    ensure(Number.isSafeInteger(write.inserted) && write.inserted>=0 && Number.isSafeInteger(raceReuse) && raceReuse>=0 && write.inserted+raceReuse===inserts.length, 'INSERT_COUNT')
    actualInserted=write.inserted
    }
  }
  const stored = rows.length ? await repository[binding.read](identities) : []
  const readback = classify(stored)
  ensure(stored.length === rows.length && readback.insertEligible === 0 && readback.reuseNoOp === rows.length, 'INDEPENDENT_READBACK')
  return { rows: stored, plan, readback, inserted: actualInserted, cap }
}

export async function buildPersistedPredictions({ games, persistedFeatures, registryRepository, runAsOf }) {
  const registry = await verifyChampionRegistry(registryRepository)
  ensure(uuid(registry.model.id), 'CHAMPION_UUID')
  return games.map(({ target, starters, built, vector: plannedVector }) => {
    ensure(target.runAsOf === runAsOf && Date.parse(target.scheduledAt) > Date.parse(runAsOf), 'PREGAME_FREEZE')
    const rows = Object.fromEntries(Object.entries(persistedFeatures).filter(([domain]) => domain !== 'offense').map(([domain, list]) => [domain, list.filter(row => row.target_game_pk === target.gamePk)]))
    const vector = assemblePregameVector({ target, starters, built: { ...built, rows } })
    ensure(sha256(vector.values) === sha256(plannedVector.values), 'PERSISTED_VECTOR_PARITY')
    const inference = inferChampion({ vector }).artifact
    // Persist the certified 02I stored-input contract, not the shorter R2F
    // inference summary. All source/model/policy semantics remain unchanged.
    const inputStarterStatus = 'READY_PROBABLE_WITH_FLAG'
    const inputDigest = sha256(inputPayload({ game_pk: target.gamePk, as_of: runAsOf,
      home_team_id: target.homeTeamId, away_team_id: target.awayTeamId,
      starter_status: inputStarterStatus, data_completeness: 'COMPLETE', vector: vector.values }))
    const evidenceDigest = sha256({ dependencyDigest: built.provenance.dependencyDigest, starters, nativeDigest: target.sourceDigest })
    const snapshots = rows.snapshots.map(row => row.id).sort()
    ensure(snapshots.length === 10 && snapshots.every(uuid), 'SNAPSHOT_UUIDS')
    return assertDownstreamPayload('predictions', {
      deterministic_identity: `mlb:${target.gamePk}:${MODEL_VERSION}:${inputDigest}:${evidenceDigest}`,
      pick2_era: 'PICK_2_ERA_V1', sport_key: 'baseball_mlb', event_id: null, game_pk: target.gamePk,
      model_version_id: registry.model.id, feature_snapshot_id: rows.firstInning[0].feature_snapshot_id,
      predicted_at: runAsOf, target: 'home_win_probability', home_probability: inference.home_probability, away_probability: inference.away_probability,
      expected_home_score: null, expected_away_score: null, expected_total: null, expected_margin: null,
      frozen_input_digest: inputDigest, model_artifact_digest: ARTIFACT_DIGEST,
      metadata: { market: 'MONEYLINE', model_version: MODEL_VERSION, feature_set: FEATURE_SET, feature_version: FEATURE_VERSION,
        home_team_id: target.homeTeamId, away_team_id: target.awayTeamId, scheduled_at: target.scheduledAt,
        starter_status: [starters.home.status, starters.away.status].every(status => status === 'CONFIRMED') ? 'CONFIRMED' : 'PROBABLE',
        starters, input_starter_status: inputStarterStatus, inference_summary_digest: inference.input_digest,
        data_completeness: 'COMPLETE', recommendation: null, value: null, official_pick: false, as_of: runAsOf,
        feature_snapshot_ids: snapshots, vector_digest: sha256(vector.values), feature_ordering_digest: registry.featureSet.input_contract.feature_ordering_digest,
        dependency_digest: built.provenance.dependencyDigest, source_lineage_digest: vector.sourceDigest, evidence_digest: evidenceDigest },
    })
  })
}
