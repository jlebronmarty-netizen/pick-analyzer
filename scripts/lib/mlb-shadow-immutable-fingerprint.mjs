import crypto from 'node:crypto'

export const MLB_SHADOW_IMMUTABLE_FINGERPRINT_VERSION =
  'mlb_current_era_shadow_canary_immutable_fingerprint_v1'

function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === '') return null
  const timestamp = new Date(String(value))
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Invalid MLB shadow fingerprint timestamp: ${value}`)
  }
  return timestamp.toISOString()
}

function normalizeLine(value) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : String(value)
}

function normalizeSportsbook(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_')
}

function normalizeSelection(value) {
  return String(value ?? '').trim().toUpperCase()
}

function normalizeMarket(value) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeInteger(value, label) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) throw new Error(`Invalid MLB shadow fingerprint ${label}: ${value}`)
  return Math.trunc(numeric)
}

function normalizeProbability(value, label) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) throw new Error(`Invalid MLB shadow fingerprint ${label}: ${value}`)
  return Number(numeric.toFixed(6))
}

function canonicalStringify(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`
  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(',')}}`
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : Number(value.toPrecision(15)).toString()
  }
  return JSON.stringify(value)
}

export function canonicalizeMlbShadowImmutableEvidence(input) {
  return {
    version: MLB_SHADOW_IMMUTABLE_FINGERPRINT_VERSION,
    sport_key: String(input.sport_key ?? 'baseball_mlb'),
    game_id: String(input.game_id ?? input.event_id ?? ''),
    market: normalizeMarket(input.market),
    selection: normalizeSelection(input.selection),
    line: normalizeLine(input.line),
    sportsbook: normalizeSportsbook(input.sportsbook),
    odds: normalizeInteger(input.odds, 'odds'),
    odds_timestamp: normalizeTimestamp(input.odds_timestamp),
    implied_probability: normalizeProbability(input.implied_probability, 'implied_probability'),
    raw_model_probability: normalizeProbability(input.raw_model_probability ?? input.raw_probability, 'raw_model_probability'),
    calibrated_probability: normalizeProbability(input.calibrated_probability, 'calibrated_probability'),
    model_version: String(input.model_version ?? ''),
    calibration_version: String(input.calibration_version ?? ''),
    candidate_key: String(input.candidate_key ?? ''),
    idempotency_key: String(input.idempotency_key ?? input.candidate_key ?? ''),
    source_prediction_id: String(input.source_prediction_id ?? ''),
    snapshot_type: String(input.snapshot_type ?? ''),
  }
}

export function serializeMlbShadowImmutableEvidence(input) {
  return canonicalStringify(canonicalizeMlbShadowImmutableEvidence(input))
}

export function fingerprintMlbShadowImmutableEvidence(input) {
  return crypto.createHash('sha256').update(serializeMlbShadowImmutableEvidence(input)).digest('hex')
}

export function immutableEvidenceFromMlbShadowRow(row) {
  const metadata = row?.certification_metadata ?? {}
  const priceEvidence = metadata.selectedPriceEvidence ?? {}
  return {
    sport_key: row?.sport_key,
    game_id: row?.game_id,
    market: row?.market,
    selection: row?.selection,
    line: row?.line ?? null,
    sportsbook: row?.sportsbook,
    odds: row?.odds,
    odds_timestamp: priceEvidence.oddsTimestamp ?? row?.odds_timestamp,
    implied_probability: priceEvidence.impliedProbability ?? Number(row?.implied_probability) / 100,
    raw_model_probability: metadata.rawModelProbability ?? row?.feature_snapshot?.mlb03CalibratedShadow?.rawModelProbability,
    calibrated_probability: metadata.calibratedProbability ?? Number(row?.model_probability) / 100,
    model_version: row?.model_version,
    calibration_version: metadata.calibrationVersion ?? row?.feature_snapshot?.mlb03CalibratedShadow?.calibrationVersion,
    candidate_key: metadata.candidateKey ?? row?.prediction_group_key,
    idempotency_key: row?.idempotency_key,
    source_prediction_id:
      metadata.sourcePredictionId ??
      row?.version_lineage?.sourcePredictionId ??
      row?.parent_prediction_id ??
      row?.challenger_of_prediction_id,
    snapshot_type: metadata.snapshotType ?? row?.feature_snapshot?.mlb03CalibratedShadow?.contextSnapshotType,
  }
}
