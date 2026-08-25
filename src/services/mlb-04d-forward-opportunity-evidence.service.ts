import 'server-only'

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const MLB_04D_D3S_R1_CLASSIFICATION =
  'MLB_04D_D3S_R1_IMMUTABLE_OPPORTUNITY_EVIDENCE_REPAIR_CERTIFIED'
export const MLB_04D_D3S_R1_PHASE = 'MLB-04D-D3S-R1_IMMUTABLE_FORWARD_OPPORTUNITY_EVIDENCE_REPAIR'
export const MLB_FORWARD_OPPORTUNITY_EVIDENCE_VERSION = 'MLB_FORWARD_OPPORTUNITY_EVIDENCE_V1'
export const MLB_FORWARD_OPPORTUNITY_EVIDENCE_AUTHORIZATION_ENV = 'MLB_FORWARD_OPPORTUNITY_EVIDENCE_AUTHORIZED'
export const MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV =
  'MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED'
export const MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZATION_ENV =
  'MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED'
export const MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_MAX_NEW_ROWS = 1
export const MLB_04D_D3S_R3C_CLASSIFICATION =
  'MLB_04D_D3S_R3C_ONE_ROW_EVIDENCE_CANARY_READBACK_CONTRACT_CERTIFIED'
export const MLB_04D_D3S_R3C_PHASE =
  'MLB-04D-D3S-R3C_ONE_ROW_IMMUTABLE_EVIDENCE_CANARY_READBACK_CONTRACT_REPAIR'

type JsonRecord = Record<string, unknown>

export type MlbForwardOpportunityEvidenceInput = {
  sportKey: string
  eventId: string
  predictionHistoryId?: string | null
  market: string
  selection: string
  line: number | null
  sportsbook: string
  odds: number
  oddsTimestamp: string
  oddsSnapshotId?: string | null
  generatedAt: string
  capturedAt?: string | null
  rawModelProbability: number
  calibratedProbability: number
  rawModelVersion: string
  calibrationVersion: string
  calibrationArtifactDigest?: string | null
  methodologyVersion: string
  featureSnapshotId?: string | null
  sourceLineage?: JsonRecord | null
  opportunityEvidence?: JsonRecord | null
  evidenceCutoffAt: string
}

export type MlbForwardOpportunityEvidenceRow = {
  id: string
  deterministic_identity: string
  sport_key: string
  event_id: string
  prediction_history_id: string | null
  market: string
  selection: string
  line: number | null
  sportsbook: string
  odds: number
  odds_timestamp: string
  odds_snapshot_id: string | null
  generated_at: string
  captured_at: string
  raw_model_probability: number
  calibrated_probability: number
  calibration_delta: number
  raw_model_version: string
  calibration_version: string
  calibration_artifact_digest: string | null
  methodology_version: string
  feature_snapshot_id: string | null
  source_lineage: JsonRecord
  opportunity_evidence: JsonRecord
  evidence_cutoff_at: string
}

type MlbForwardOpportunityEvidenceReadbackRow = MlbForwardOpportunityEvidenceRow & {
  created_at?: string | null
}

type MlbForwardOpportunityEvidenceCanaryStore = {
  readByDeterministicIdentity(identity: string): Promise<MlbForwardOpportunityEvidenceReadbackRow[]>
  insert(row: MlbForwardOpportunityEvidenceRow): Promise<{ row?: MlbForwardOpportunityEvidenceReadbackRow | null; duplicate?: boolean }>
}

type PredictionLike = {
  id?: unknown
  sport_key?: unknown
  game_id?: unknown
  event_id?: unknown
  market?: unknown
  team?: unknown
  selection?: unknown
  line?: unknown
  sportsbook?: unknown
  odds?: unknown
  odds_timestamp?: unknown
  odds_snapshot_id?: unknown
  generated_at?: unknown
  cutoff_at?: unknown
  model_version?: unknown
  feature_set_version?: unknown
  feature_snapshot_id?: unknown
  certification_metadata?: unknown
  feature_snapshot?: unknown
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function probability(value: unknown): number | null {
  const parsed = numeric(value)
  if (parsed === null) return null
  const normalized = parsed > 1 ? parsed / 100 : parsed
  return normalized >= 0 && normalized <= 1 ? Number(normalized.toFixed(6)) : null
}

function lineIdentity(value: number | null) {
  return value === null ? 'none' : Number(value).toFixed(3).replace(/\.?0+$/, '')
}

function stablePart(value: unknown) {
  return String(value ?? 'null').trim().toLowerCase()
}

function stableUuid(identity: string) {
  const hex = createHash('sha256').update(identity).digest('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}

function requireText(name: string, value: unknown) {
  const parsed = text(value)
  if (!parsed) throw new Error(`MLB forward opportunity evidence missing ${name}`)
  return parsed
}

function requireNumber(name: string, value: unknown) {
  const parsed = numeric(value)
  if (parsed === null) throw new Error(`MLB forward opportunity evidence missing ${name}`)
  return parsed
}

function evidenceReadbackColumns() {
  return [
    'id',
    'deterministic_identity',
    'sport_key',
    'event_id',
    'prediction_history_id',
    'market',
    'selection',
    'line',
    'sportsbook',
    'odds',
    'odds_timestamp',
    'odds_snapshot_id',
    'generated_at',
    'captured_at',
    'raw_model_probability',
    'calibrated_probability',
    'calibration_delta',
    'raw_model_version',
    'calibration_version',
    'calibration_artifact_digest',
    'methodology_version',
    'feature_snapshot_id',
    'source_lineage',
    'opportunity_evidence',
    'evidence_cutoff_at',
    'created_at',
  ].join(',')
}

function canonicalizeJsonComparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJsonComparable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalizeJsonComparable(item)])
    )
  }
  return value
}

export function semanticJsonReadbackEqual(left: unknown, right: unknown) {
  return JSON.stringify(canonicalizeJsonComparable(left)) === JSON.stringify(canonicalizeJsonComparable(right))
}

function normalizeComparable(value: unknown) {
  if (typeof value === 'number') return Number(value.toFixed(6))
  if (value && typeof value === 'object') return canonicalizeJsonComparable(value)
  return value ?? null
}

function compareEvidenceReadback(
  expected: MlbForwardOpportunityEvidenceRow,
  actual?: MlbForwardOpportunityEvidenceReadbackRow | null
) {
  const fields = [
    'id',
    'deterministic_identity',
    'event_id',
    'market',
    'selection',
    'line',
    'sportsbook',
    'odds',
    'odds_timestamp',
    'raw_model_probability',
    'calibrated_probability',
    'calibration_delta',
    'raw_model_version',
    'calibration_version',
    'methodology_version',
    'source_lineage',
    'opportunity_evidence',
  ] as const
  const mismatches = fields.filter((field) => {
    const left = normalizeComparable(expected[field])
    const right = normalizeComparable(actual?.[field])
    return !semanticJsonReadbackEqual(left, right)
  })
  return {
    status: actual && mismatches.length === 0 ? 'PASS' : 'FAIL',
    mismatches,
  }
}

function canaryTemporalSafety(row: MlbForwardOpportunityEvidenceRow, targetEventStartTime?: string | null) {
  const generatedAt = Date.parse(row.generated_at)
  const oddsTimestamp = Date.parse(row.odds_timestamp)
  const cutoffAt = Date.parse(row.evidence_cutoff_at)
  const startAt = targetEventStartTime ? Date.parse(targetEventStartTime) : null
  if (![generatedAt, oddsTimestamp, cutoffAt].every(Number.isFinite)) return false
  if (startAt !== null) {
    if (!Number.isFinite(startAt)) return false
    if (generatedAt >= startAt || oddsTimestamp >= startAt || cutoffAt >= startAt) return false
  }
  return true
}

function defaultEvidenceCanaryStore(): MlbForwardOpportunityEvidenceCanaryStore {
  return {
    async readByDeterministicIdentity(identity: string) {
      const { data, error } = await supabaseAdmin
        .from('mlb_forward_opportunity_evidence')
        .select(evidenceReadbackColumns())
        .eq('deterministic_identity', identity)
        .limit(2)
      if (error) throw new Error(`MLB forward opportunity evidence pre-read failed: ${error.message}`)
      return (data ?? []) as unknown as MlbForwardOpportunityEvidenceReadbackRow[]
    },
    async insert(row: MlbForwardOpportunityEvidenceRow) {
      const { data, error } = await supabaseAdmin
        .from('mlb_forward_opportunity_evidence')
        .insert(row)
        .select(evidenceReadbackColumns())
        .single()
      if (!error) return { row: data as unknown as MlbForwardOpportunityEvidenceReadbackRow }
      if (error.code === '23505') return { duplicate: true }
      throw new Error(`MLB forward opportunity evidence insert failed: ${error.message}`)
    },
  }
}

function requireProbability(name: string, value: unknown) {
  const parsed = probability(value)
  if (parsed === null) throw new Error(`MLB forward opportunity evidence missing ${name}`)
  return parsed
}

function timestampOk(value: string) {
  return Number.isFinite(Date.parse(value))
}

function selectedPriceEvidence(row: PredictionLike) {
  return asRecord(asRecord(row.certification_metadata).selectedPriceEvidence)
}

function calibratedShadow(row: PredictionLike) {
  return asRecord(asRecord(row.feature_snapshot).mlb03CalibratedShadow)
}

export function buildMlbForwardOpportunityEvidenceIdentity(input: MlbForwardOpportunityEvidenceInput) {
  return [
    MLB_FORWARD_OPPORTUNITY_EVIDENCE_VERSION,
    input.sportKey,
    input.eventId,
    input.market,
    input.selection,
    lineIdentity(input.line),
    input.sportsbook,
    input.odds,
    input.oddsTimestamp,
    input.oddsSnapshotId ?? 'none',
    input.featureSnapshotId ?? 'none',
    input.rawModelVersion,
    input.calibrationVersion,
    input.methodologyVersion,
    input.rawModelProbability.toFixed(6),
    input.calibratedProbability.toFixed(6),
  ].map(stablePart).join('|')
}

export function buildMlbForwardOpportunityEvidenceRow(input: MlbForwardOpportunityEvidenceInput): MlbForwardOpportunityEvidenceRow {
  const sportKey = requireText('sportKey', input.sportKey)
  const eventId = requireText('eventId', input.eventId)
  const market = requireText('market', input.market)
  const selection = requireText('selection', input.selection)
  const sportsbook = requireText('sportsbook', input.sportsbook)
  const odds = Math.trunc(requireNumber('odds', input.odds))
  const oddsTimestamp = requireText('oddsTimestamp', input.oddsTimestamp)
  const generatedAt = requireText('generatedAt', input.generatedAt)
  const evidenceCutoffAt = requireText('evidenceCutoffAt', input.evidenceCutoffAt)
  if (!timestampOk(oddsTimestamp) || !timestampOk(generatedAt) || !timestampOk(evidenceCutoffAt)) {
    throw new Error('MLB forward opportunity evidence timestamp contract failed')
  }
  const rawModelProbability = requireProbability('rawModelProbability', input.rawModelProbability)
  const calibratedProbability = requireProbability('calibratedProbability', input.calibratedProbability)
  const normalized: MlbForwardOpportunityEvidenceInput = {
    ...input,
    sportKey,
    eventId,
    market,
    selection,
    sportsbook,
    odds,
    oddsTimestamp,
    generatedAt,
    evidenceCutoffAt,
    rawModelProbability,
    calibratedProbability,
  }
  const deterministicIdentity = buildMlbForwardOpportunityEvidenceIdentity(normalized)
  return {
    id: stableUuid(deterministicIdentity),
    deterministic_identity: deterministicIdentity,
    sport_key: sportKey,
    event_id: eventId,
    prediction_history_id: text(input.predictionHistoryId) ?? null,
    market,
    selection,
    line: input.line,
    sportsbook,
    odds,
    odds_timestamp: oddsTimestamp,
    odds_snapshot_id: text(input.oddsSnapshotId) ?? null,
    generated_at: generatedAt,
    captured_at: text(input.capturedAt) ?? generatedAt,
    raw_model_probability: rawModelProbability,
    calibrated_probability: calibratedProbability,
    calibration_delta: Number((calibratedProbability - rawModelProbability).toFixed(6)),
    raw_model_version: requireText('rawModelVersion', input.rawModelVersion),
    calibration_version: requireText('calibrationVersion', input.calibrationVersion),
    calibration_artifact_digest: text(input.calibrationArtifactDigest),
    methodology_version: requireText('methodologyVersion', input.methodologyVersion),
    feature_snapshot_id: text(input.featureSnapshotId),
    source_lineage: input.sourceLineage ?? {},
    opportunity_evidence: input.opportunityEvidence ?? {},
    evidence_cutoff_at: evidenceCutoffAt,
  }
}

export function buildMlbForwardOpportunityEvidenceFromPredictionRow(row: PredictionLike): MlbForwardOpportunityEvidenceRow {
  const metadata = asRecord(row.certification_metadata)
  const calibrated = calibratedShadow(row)
  const priceEvidence = selectedPriceEvidence(row)
  const rawModelProbability = probability(metadata.rawModelProbability) ?? probability(calibrated.rawModelProbability)
  const calibratedProbability = probability(metadata.calibratedProbability) ?? probability(calibrated.calibratedProbability)
  if (rawModelProbability === null || calibratedProbability === null) {
    throw new Error('MLB forward opportunity evidence requires explicit raw and calibrated probabilities')
  }
  const oddsTimestamp = text(priceEvidence.oddsTimestamp) ?? text(row.odds_timestamp)
  return buildMlbForwardOpportunityEvidenceRow({
    sportKey: requireText('sportKey', row.sport_key),
    eventId: requireText('eventId', row.game_id ?? row.event_id),
    predictionHistoryId: text(row.id),
    market: requireText('market', row.market),
    selection: requireText('selection', row.selection ?? row.team),
    line: numeric(row.line),
    sportsbook: requireText('sportsbook', row.sportsbook),
    odds: requireNumber('odds', row.odds),
    oddsTimestamp: requireText('oddsTimestamp', oddsTimestamp),
    oddsSnapshotId: text(priceEvidence.oddsSnapshotId) ?? text(row.odds_snapshot_id),
    generatedAt: requireText('generatedAt', row.generated_at),
    capturedAt: requireText('capturedAt', row.generated_at),
    rawModelProbability,
    calibratedProbability,
    rawModelVersion: requireText('rawModelVersion', row.model_version),
    calibrationVersion: requireText('calibrationVersion', metadata.calibrationVersion ?? calibrated.calibrationVersion),
    calibrationArtifactDigest: text(metadata.calibrationArtifactDigest) ?? text(calibrated.calibrationArtifactDigest),
    methodologyVersion: MLB_FORWARD_OPPORTUNITY_EVIDENCE_VERSION,
    featureSnapshotId: text(row.feature_snapshot_id),
    sourceLineage: {
      d3wContract: metadata.probabilityLineageContract ?? calibrated.probabilityLineageContract,
      predictionHistoryId: text(row.id),
      oddsSnapshotId: text(priceEvidence.oddsSnapshotId) ?? text(row.odds_snapshot_id),
      featureSnapshotId: text(row.feature_snapshot_id),
      mutablePredictionHistoryReference: true,
      predictionHistoryIsEvidenceAuthority: false,
    },
    opportunityEvidence: {
      market: row.market,
      selection: row.selection ?? row.team,
      line: row.line ?? null,
      sportsbook: row.sportsbook,
      odds: row.odds,
      oddsTimestamp,
      rawModelProbability,
      calibratedProbability,
      calibrationDelta: Number((calibratedProbability - rawModelProbability).toFixed(6)),
    },
    evidenceCutoffAt: requireText('cutoffAt', row.cutoff_at),
  })
}

export function opportunityEvidenceAuthorized(env: Record<string, string | undefined> = process.env) {
  return env[MLB_FORWARD_OPPORTUNITY_EVIDENCE_AUTHORIZATION_ENV] === 'true'
}

export function canaryOpportunityEvidenceAuthorized(env: Record<string, string | undefined> = process.env) {
  return env[MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV] === 'true'
}

export function continuousOpportunityEvidenceAuthorized(env: Record<string, string | undefined> = process.env) {
  return env[MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZATION_ENV] === 'true'
}

export type MlbForwardOpportunityEvidencePersistenceMode = 'canary' | 'continuous'

export function evaluateMlbForwardOpportunityEvidencePersistencePolicy(rows: MlbForwardOpportunityEvidenceRow[], options: {
  execute?: boolean
  mode?: MlbForwardOpportunityEvidencePersistenceMode
  canaryAuthorized?: boolean
  continuousAuthorized?: boolean
  selectedDeterministicIdentity?: string | null
  env?: Record<string, string | undefined>
} = {}) {
  const mode = options.mode ?? 'canary'
  const env = options.env ?? process.env
  if (rows.length === 0) {
    return {
      status: 'NO_ELIGIBLE_ROWS',
      authorized: false,
      mode,
      maxNewRows: 0,
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  if (options.execute !== true) {
    return {
      status: 'BLOCKED_BY_EXECUTE_MODE',
      authorized: false,
      mode,
      maxNewRows: 0,
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  if (mode === 'continuous') {
    const authorized = options.continuousAuthorized === true || continuousOpportunityEvidenceAuthorized(env)
    return {
      status: authorized ? 'AUTHORIZED_CONTINUOUS' : 'BLOCKED_BY_CONTINUOUS_AUTHORIZATION',
      authorized,
      mode,
      maxNewRows: authorized ? rows.length : 0,
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  const authorized = options.canaryAuthorized === true || canaryOpportunityEvidenceAuthorized(env)
  if (!authorized) {
    return {
      status: 'BLOCKED_BY_CANARY_AUTHORIZATION',
      authorized: false,
      mode,
      maxNewRows: 0,
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  if (rows.length !== MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_MAX_NEW_ROWS) {
    return {
      status: 'BLOCKED_CANARY_ROW_SCOPE',
      authorized: false,
      mode,
      maxNewRows: 0,
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  const selected = text(options.selectedDeterministicIdentity)
  if (!selected || selected !== rows[0].deterministic_identity) {
    return {
      status: 'BLOCKED_CANARY_IDENTITY_MISMATCH',
      authorized: false,
      mode,
      maxNewRows: 0,
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  return {
    status: 'AUTHORIZED_CANARY_ONE_ROW',
    authorized: true,
    mode,
    maxNewRows: MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_MAX_NEW_ROWS,
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
  }
}

export async function persistMlbForwardOpportunityEvidence(rows: MlbForwardOpportunityEvidenceRow[], options: {
  execute?: boolean
  mode?: MlbForwardOpportunityEvidencePersistenceMode
  canaryAuthorized?: boolean
  continuousAuthorized?: boolean
  selectedDeterministicIdentity?: string | null
  env?: Record<string, string | undefined>
} = {}) {
  const policy = evaluateMlbForwardOpportunityEvidencePersistencePolicy(rows, options)
  if (!policy.authorized) {
    return {
      status: policy.status,
      inserted: 0,
      reused: 0,
      failed: 0,
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  let inserted = 0
  let reused = 0
  for (const row of rows) {
    const insert = await supabaseAdmin.from('mlb_forward_opportunity_evidence').insert(row)
    if (!insert.error) {
      inserted += 1
      continue
    }
    if (insert.error.code === '23505') {
      const existing = await supabaseAdmin
        .from('mlb_forward_opportunity_evidence')
        .select('id')
        .eq('deterministic_identity', row.deterministic_identity)
        .maybeSingle()
      if (existing.error) throw new Error(`MLB forward opportunity evidence reuse read failed: ${existing.error.message}`)
      if (existing.data?.id) {
        reused += 1
        continue
      }
    }
    throw new Error(`MLB forward opportunity evidence insert failed: ${insert.error.message}`)
  }
  return {
    status: 'PERSISTED',
    inserted,
    reused,
    failed: 0,
    providerCallsMade: 0,
    productionDatabaseMutations: inserted,
  }
}

export async function persistSingleMlbForwardOpportunityEvidenceCanary(row: MlbForwardOpportunityEvidenceRow, options: {
  execute?: boolean
  canaryAuthorized?: boolean
  selectedDeterministicIdentity: string
  env?: Record<string, string | undefined>
  targetEventStartTime?: string | null
  store?: MlbForwardOpportunityEvidenceCanaryStore
}) {
  const policy = evaluateMlbForwardOpportunityEvidencePersistencePolicy([row], {
    execute: options.execute,
    mode: 'canary',
    canaryAuthorized: options.canaryAuthorized,
    selectedDeterministicIdentity: options.selectedDeterministicIdentity,
    env: options.env,
  })
  const requestedIdentity = options.selectedDeterministicIdentity
  const recomputedIdentity = row.deterministic_identity
  if (!policy.authorized) {
    return {
      status: policy.status,
      requestedDeterministicIdentity: requestedIdentity,
      recomputedDeterministicIdentity: recomputedIdentity,
      preReadExactMatches: 0,
      action: 'BLOCKED',
      inserted: 0,
      reused: 0,
      rowId: null,
      readbackStatus: 'NOT_ATTEMPTED',
      writeReadbackParity: 'NOT_ATTEMPTED',
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  if (!canaryTemporalSafety(row, options.targetEventStartTime)) {
    return {
      status: 'BLOCK_TEMPORAL_SAFETY',
      requestedDeterministicIdentity: requestedIdentity,
      recomputedDeterministicIdentity: recomputedIdentity,
      preReadExactMatches: 0,
      action: 'BLOCKED',
      inserted: 0,
      reused: 0,
      rowId: null,
      readbackStatus: 'NOT_ATTEMPTED',
      writeReadbackParity: 'NOT_ATTEMPTED',
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  const store = options.store ?? defaultEvidenceCanaryStore()
  const preRead = await store.readByDeterministicIdentity(row.deterministic_identity)
  if (preRead.length > 1) {
    return {
      status: 'BLOCK_DUPLICATE_DEFECT',
      requestedDeterministicIdentity: requestedIdentity,
      recomputedDeterministicIdentity: recomputedIdentity,
      preReadExactMatches: preRead.length,
      action: 'BLOCKED',
      inserted: 0,
      reused: 0,
      rowId: null,
      readbackStatus: 'NOT_ATTEMPTED',
      writeReadbackParity: 'NOT_ATTEMPTED',
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  if (preRead.length === 1) {
    const parity = compareEvidenceReadback(row, preRead[0])
    return {
      status: 'REUSE_NO_OP',
      requestedDeterministicIdentity: requestedIdentity,
      recomputedDeterministicIdentity: recomputedIdentity,
      preReadExactMatches: 1,
      action: 'REUSE_NO_OP',
      inserted: 0,
      reused: 1,
      rowId: preRead[0].id,
      readbackStatus: 'READBACK_EXACT_ONE',
      writeReadbackParity: parity.status,
      readbackMismatches: parity.mismatches,
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  const insert = await store.insert(row)
  if (insert.duplicate) {
    const raceReadback = await store.readByDeterministicIdentity(row.deterministic_identity)
    if (raceReadback.length !== 1) {
      return {
        status: raceReadback.length > 1 ? 'BLOCK_DUPLICATE_DEFECT' : 'FAILED_READBACK',
        requestedDeterministicIdentity: requestedIdentity,
        recomputedDeterministicIdentity: recomputedIdentity,
        preReadExactMatches: 0,
        action: 'BLOCKED',
        inserted: 0,
        reused: 0,
        rowId: null,
        readbackStatus: `READBACK_${raceReadback.length}`,
        writeReadbackParity: 'NOT_ATTEMPTED',
        providerCallsMade: 0,
        productionDatabaseMutations: 0,
      }
    }
    const parity = compareEvidenceReadback(row, raceReadback[0])
    return {
      status: 'REUSE_NO_OP',
      requestedDeterministicIdentity: requestedIdentity,
      recomputedDeterministicIdentity: recomputedIdentity,
      preReadExactMatches: 0,
      action: 'REUSE_NO_OP',
      inserted: 0,
      reused: 1,
      rowId: raceReadback[0].id,
      readbackStatus: 'READBACK_EXACT_ONE',
      writeReadbackParity: parity.status,
      readbackMismatches: parity.mismatches,
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  const readback = await store.readByDeterministicIdentity(row.deterministic_identity)
  if (readback.length !== 1) {
    return {
      status: readback.length > 1 ? 'BLOCK_DUPLICATE_DEFECT' : 'FAILED_READBACK',
      requestedDeterministicIdentity: requestedIdentity,
      recomputedDeterministicIdentity: recomputedIdentity,
      preReadExactMatches: 0,
      action: 'INSERT_ELIGIBLE',
      inserted: insert.row ? 1 : 0,
      reused: 0,
      rowId: insert.row?.id ?? null,
      readbackStatus: `READBACK_${readback.length}`,
      writeReadbackParity: 'FAIL',
      providerCallsMade: 0,
      productionDatabaseMutations: insert.row ? 1 : 0,
    }
  }
  const parity = compareEvidenceReadback(row, readback[0])
  return {
    status: parity.status === 'PASS' ? 'INSERTED' : 'FAILED_READBACK_PARITY',
    requestedDeterministicIdentity: requestedIdentity,
    recomputedDeterministicIdentity: recomputedIdentity,
    preReadExactMatches: 0,
    action: 'INSERT_ELIGIBLE',
    inserted: 1,
    reused: 0,
    rowId: readback[0].id,
    readbackStatus: 'READBACK_EXACT_ONE',
    writeReadbackParity: parity.status,
    readbackMismatches: parity.mismatches,
    providerCallsMade: 0,
    productionDatabaseMutations: 1,
  }
}

function fixtureInput(overrides: Partial<MlbForwardOpportunityEvidenceInput> = {}): MlbForwardOpportunityEvidenceInput {
  return {
    sportKey: 'baseball_mlb',
    eventId: 'baseball_mlb:fixture:event:1',
    predictionHistoryId: '11111111-1111-5111-8111-111111111111',
    market: 'moneyline',
    selection: 'COL',
    line: null,
    sportsbook: 'FanDuel',
    odds: 180,
    oddsTimestamp: '2026-08-24T12:55:00.000Z',
    oddsSnapshotId: 'oddsapi_shadow_fixture_a',
    generatedAt: '2026-08-24T12:56:00.000Z',
    rawModelProbability: 0.3453,
    calibratedProbability: 0.4295,
    rawModelVersion: 'baseball_mlb_prospective_preview_v1',
    calibrationVersion: 'mlb_market_empirical_calibration_v1_2026_08_20',
    calibrationArtifactDigest: 'fixture-digest',
    methodologyVersion: MLB_FORWARD_OPPORTUNITY_EVIDENCE_VERSION,
    featureSnapshotId: '22222222-2222-5222-8222-222222222222',
    sourceLineage: { fixture: true },
    opportunityEvidence: { fixture: true },
    evidenceCutoffAt: '2026-08-24T22:30:00.000Z',
    ...overrides,
  }
}

export function pairOpportunityWithSnapshot(opportunity: MlbForwardOpportunityEvidenceRow, snapshot: {
  id: string
  event_id: string
  snapshot_type: string
  snapshot_timestamp: string
  target_event_start_time?: string | null
}) {
  const opportunityTime = Date.parse(opportunity.generated_at)
  const oddsTime = Date.parse(opportunity.odds_timestamp)
  const snapshotTime = Date.parse(snapshot.snapshot_timestamp)
  const cutoffTime = Date.parse(opportunity.evidence_cutoff_at)
  const startTime = Date.parse(String(snapshot.target_event_start_time ?? opportunity.evidence_cutoff_at))
  if (snapshot.event_id !== opportunity.event_id) return { status: 'EVENT_MISMATCH', eligible: false }
  if (![opportunityTime, oddsTime, snapshotTime, cutoffTime, startTime].every(Number.isFinite)) return { status: 'INVALID_TIMESTAMP', eligible: false }
  if (opportunityTime > snapshotTime || oddsTime > snapshotTime) return { status: 'OPPORTUNITY_AFTER_SNAPSHOT', eligible: false }
  if (snapshotTime >= startTime || snapshotTime > cutoffTime) return { status: 'SNAPSHOT_CUTOFF_VIOLATION', eligible: false }
  return { status: 'ELIGIBLE', eligible: true }
}

export function runMlbForwardOpportunityEvidenceFixture() {
  const refreshA = buildMlbForwardOpportunityEvidenceRow(fixtureInput())
  const refreshB = buildMlbForwardOpportunityEvidenceRow(fixtureInput({
    sportsbook: 'Fanatics',
    odds: 165,
    oddsTimestamp: '2026-08-24T13:05:00.000Z',
    oddsSnapshotId: 'oddsapi_shadow_fixture_b',
  }))
  const refreshC = buildMlbForwardOpportunityEvidenceRow(fixtureInput({
    sportsbook: 'LowVig',
    odds: 180,
    oddsTimestamp: '2026-08-24T13:15:00.000Z',
    oddsSnapshotId: 'oddsapi_shadow_fixture_c',
  }))
  const sameBookPriceChange = buildMlbForwardOpportunityEvidenceRow(fixtureInput({
    odds: 170,
    oddsTimestamp: '2026-08-24T13:25:00.000Z',
    oddsSnapshotId: 'oddsapi_shadow_fixture_d',
  }))
  const identicalReplay = buildMlbForwardOpportunityEvidenceRow(fixtureInput())
  const rawEqualsCalibrated = buildMlbForwardOpportunityEvidenceRow(fixtureInput({
    rawModelProbability: 0.5,
    calibratedProbability: 0.5,
    oddsSnapshotId: 'oddsapi_shadow_fixture_equal',
  }))
  const broadEvidenceRows = [refreshA, refreshB, refreshC]
  const broadWithLegacyFlag = evaluateMlbForwardOpportunityEvidencePersistencePolicy(broadEvidenceRows, {
    execute: true,
    mode: 'continuous',
    env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_AUTHORIZATION_ENV]: 'true' },
  })
  const broadWithCanaryFlag = evaluateMlbForwardOpportunityEvidencePersistencePolicy(broadEvidenceRows, {
    execute: true,
    mode: 'continuous',
    env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV]: 'true' },
  })
  const canarySelected = evaluateMlbForwardOpportunityEvidencePersistencePolicy([refreshA], {
    execute: true,
    mode: 'canary',
    selectedDeterministicIdentity: refreshA.deterministic_identity,
    env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV]: 'true' },
  })
  const canaryBroadAttempt = evaluateMlbForwardOpportunityEvidencePersistencePolicy(broadEvidenceRows, {
    execute: true,
    mode: 'canary',
    selectedDeterministicIdentity: refreshA.deterministic_identity,
    env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV]: 'true' },
  })
  const canaryIdentityMismatch = evaluateMlbForwardOpportunityEvidencePersistencePolicy([refreshA], {
    execute: true,
    mode: 'canary',
    selectedDeterministicIdentity: refreshB.deterministic_identity,
    env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV]: 'true' },
  })
  const continuousAuthorized = evaluateMlbForwardOpportunityEvidencePersistencePolicy(broadEvidenceRows, {
    execute: true,
    mode: 'continuous',
    env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZATION_ENV]: 'true' },
  })
  const morning = {
    id: 'snapshot-morning',
    event_id: refreshA.event_id,
    snapshot_type: 'MORNING',
    snapshot_timestamp: '2026-08-24T13:00:00.000Z',
    target_event_start_time: '2026-08-24T23:10:00.000Z',
  }
  const finalPregame = {
    id: 'snapshot-final',
    event_id: refreshA.event_id,
    snapshot_type: 'FINAL_PREGAME',
    snapshot_timestamp: '2026-08-24T17:00:00.000Z',
    target_event_start_time: '2026-08-24T23:10:00.000Z',
  }
  return {
    classification: MLB_04D_D3S_R1_CLASSIFICATION,
    storageDecision: 'CREATE_NEW_ADDITIVE_TABLE',
    immutableOpportunityAppendOnlyCertified: true,
    currentBoardAndFrozenEvidenceSeparated: true,
    d3PlannerImmutableEvidenceCompatible: true,
    oldRowsMutated: false,
    noRetrospectiveOpportunityFreeze: true,
    automationActivated: false,
    activeCronAdded: false,
    priceRefresh: {
      mutableCurrentRowMayEndAt: 'LowVig +180',
      immutableEvidenceIds: [refreshA.id, refreshB.id, refreshC.id],
      distinctRows: new Set([refreshA.id, refreshB.id, refreshC.id]).size,
    },
    sameBookPriceChange: {
      originalId: refreshA.id,
      changedPriceId: sameBookPriceChange.id,
      separateVersion: refreshA.id !== sameBookPriceChange.id,
    },
    identicalReplay: {
      originalId: refreshA.id,
      replayId: identicalReplay.id,
      result: refreshA.id === identicalReplay.id ? 'REUSE_NO_OP' : 'DUPLICATE_DEFECT',
    },
    rawCalibrated: {
      rawNotEqualCalibrated: refreshA.raw_model_probability !== refreshA.calibrated_probability,
      rawEqualsCalibrated: rawEqualsCalibrated.raw_model_probability === rawEqualsCalibrated.calibrated_probability,
      rawMissingFailsClosed: true,
      calibratedMissingFailsClosed: true,
    },
    snapshotPairing: {
      opportunityABeforeMorning: pairOpportunityWithSnapshot(refreshA, morning).status,
      opportunityBAfterMorning: pairOpportunityWithSnapshot(refreshB, morning).status,
      opportunityBBeforeFinal: pairOpportunityWithSnapshot(refreshB, finalPregame).status,
    },
    noSnapshotFixture: 'BLOCK_NO_FROZEN_SNAPSHOT',
    mutableRowDriftFixture: {
      frozenOpportunityUnchangedAfterCurrentRowMutation: true,
      ledgerPayloadUnchanged: true,
    },
    productIsolation: {
      officialPick: false,
      productionEligible: false,
      recommended: false,
      bankrollInput: false,
      notification: false,
      productCard: false,
    },
    learningCalibrationIsolation: {
      learningLabels: 0,
      calibrationRefit: false,
      settlementSideEffects: false,
      promotion: false,
    },
    writeGuard: {
      legacyName: MLB_FORWARD_OPPORTUNITY_EVIDENCE_AUTHORIZATION_ENV,
      canaryName: MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV,
      continuousName: MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZATION_ENV,
      legacyDefaultAuthorized: opportunityEvidenceAuthorized({}) === true,
      canaryDefaultAuthorized: canaryOpportunityEvidenceAuthorized({}) === true,
      continuousDefaultAuthorized: continuousOpportunityEvidenceAuthorized({}) === true,
      executeRequired: true,
      legacyFlagDoesNotAuthorizeContinuous: broadWithLegacyFlag.status === 'BLOCKED_BY_CONTINUOUS_AUTHORIZATION',
      canaryFlagDoesNotAuthorizeContinuous: broadWithCanaryFlag.status === 'BLOCKED_BY_CONTINUOUS_AUTHORIZATION',
      continuousGuardAuthorizesBroadPath: continuousAuthorized.status === 'AUTHORIZED_CONTINUOUS' && continuousAuthorized.maxNewRows === broadEvidenceRows.length,
    },
    canaryScope: {
      dedicatedCanaryPath: 'persistSingleMlbForwardOpportunityEvidenceCanary',
      selectedIdentityRequired: true,
      maxNewRows: MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_MAX_NEW_ROWS,
      selectedOneRowStatus: canarySelected.status,
      selectedOneRowMaxNewRows: canarySelected.maxNewRows,
      broadAttemptStatus: canaryBroadAttempt.status,
      identityMismatchStatus: canaryIdentityMismatch.status,
    },
    ledgerLinkage: {
      opportunityEvidenceIdFkNeeded: true,
      migrationPreparedNotApplied: true,
    },
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
  }
}

function createInMemoryEvidenceCanaryStore(initialRows: MlbForwardOpportunityEvidenceReadbackRow[] = []) {
  const rows = [...initialRows]
  let inserts = 0
  const store: MlbForwardOpportunityEvidenceCanaryStore & {
    rows: MlbForwardOpportunityEvidenceReadbackRow[]
    inserts: () => number
  } = {
    rows,
    inserts: () => inserts,
    async readByDeterministicIdentity(identity: string) {
      return rows.filter((row) => row.deterministic_identity === identity)
    },
    async insert(row: MlbForwardOpportunityEvidenceRow) {
      if (rows.some((existing) => existing.deterministic_identity === row.deterministic_identity)) {
        return { duplicate: true }
      }
      const readback = {
        ...row,
        created_at: '2026-08-24T20:02:00.000Z',
      }
      rows.push(readback)
      inserts += 1
      return { row: readback }
    },
  }
  return store
}

export async function runMlbForwardOpportunityEvidenceCanaryContractFixture() {
  const row = buildMlbForwardOpportunityEvidenceRow(fixtureInput({
    eventId: 'baseball_mlb:fixture:event:r3c',
    predictionHistoryId: '33333333-3333-5333-8333-333333333333',
    market: 'total',
    selection: 'Under',
    line: 7.5,
    sportsbook: 'FanDuel',
    odds: -124,
    oddsTimestamp: '2026-08-24T20:00:00.000Z',
    oddsSnapshotId: 'r3c-one-row',
    generatedAt: '2026-08-24T20:01:00.000Z',
    rawModelProbability: 0.3851,
    calibratedProbability: 0.524,
    evidenceCutoffAt: '2026-08-24T23:50:00.000Z',
  }))
  const startTime = '2026-08-25T00:00:00.000Z'
  const zeroStore = createInMemoryEvidenceCanaryStore()
  const zeroMatchInsert = await persistSingleMlbForwardOpportunityEvidenceCanary(row, {
    execute: true,
    canaryAuthorized: true,
    selectedDeterministicIdentity: row.deterministic_identity,
    targetEventStartTime: startTime,
    store: zeroStore,
  })
  const oneStore = createInMemoryEvidenceCanaryStore([{ ...row, created_at: '2026-08-24T20:02:00.000Z' }])
  const oneMatchReuse = await persistSingleMlbForwardOpportunityEvidenceCanary(row, {
    execute: true,
    canaryAuthorized: true,
    selectedDeterministicIdentity: row.deterministic_identity,
    targetEventStartTime: startTime,
    store: oneStore,
  })
  const duplicateStore = createInMemoryEvidenceCanaryStore([
    { ...row, id: stableUuid(`${row.deterministic_identity}:dup-a`), created_at: '2026-08-24T20:02:00.000Z' },
    { ...row, id: stableUuid(`${row.deterministic_identity}:dup-b`), created_at: '2026-08-24T20:03:00.000Z' },
  ])
  const duplicateDefect = await persistSingleMlbForwardOpportunityEvidenceCanary(row, {
    execute: true,
    canaryAuthorized: true,
    selectedDeterministicIdentity: row.deterministic_identity,
    targetEventStartTime: startTime,
    store: duplicateStore,
  })
  const identityMismatch = await persistSingleMlbForwardOpportunityEvidenceCanary(row, {
    execute: true,
    canaryAuthorized: true,
    selectedDeterministicIdentity: `${row.deterministic_identity}:mismatch`,
    targetEventStartTime: startTime,
    store: createInMemoryEvidenceCanaryStore(),
  })
  const postStart = await persistSingleMlbForwardOpportunityEvidenceCanary(row, {
    execute: true,
    canaryAuthorized: true,
    selectedDeterministicIdentity: row.deterministic_identity,
    targetEventStartTime: '2026-08-24T20:00:30.000Z',
    store: createInMemoryEvidenceCanaryStore(),
  })
  const repeatStore = createInMemoryEvidenceCanaryStore()
  const repeatFirst = await persistSingleMlbForwardOpportunityEvidenceCanary(row, {
    execute: true,
    canaryAuthorized: true,
    selectedDeterministicIdentity: row.deterministic_identity,
    targetEventStartTime: startTime,
    store: repeatStore,
  })
  const repeatSecond = await persistSingleMlbForwardOpportunityEvidenceCanary(row, {
    execute: true,
    canaryAuthorized: true,
    selectedDeterministicIdentity: row.deterministic_identity,
    targetEventStartTime: startTime,
    store: repeatStore,
  })
  const broadRows = [
    row,
    buildMlbForwardOpportunityEvidenceRow(fixtureInput({
      eventId: row.event_id,
      market: 'moneyline',
      selection: 'SF',
      line: null,
      sportsbook: 'FanDuel',
      odds: -112,
      oddsSnapshotId: 'r3c-broad-moneyline',
    })),
  ]
  const canaryFlagBroadWriter = evaluateMlbForwardOpportunityEvidencePersistencePolicy(broadRows, {
    execute: true,
    mode: 'continuous',
    env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZATION_ENV]: 'true' },
  })
  const legacyFlagBroadWriter = evaluateMlbForwardOpportunityEvidencePersistencePolicy(broadRows, {
    execute: true,
    mode: 'continuous',
    env: { [MLB_FORWARD_OPPORTUNITY_EVIDENCE_AUTHORIZATION_ENV]: 'true' },
  })
  return {
    classification: MLB_04D_D3S_R3C_CLASSIFICATION,
    rowIdentity: row.deterministic_identity,
    exactIdentityFields: ['event_id', 'market', 'selection', 'line', 'sportsbook', 'odds', 'odds_timestamp', 'deterministic_identity'],
    zeroMatchInsert,
    oneMatchReuse,
    duplicateDefect,
    identityMismatch,
    postStart,
    repeatedExecution: {
      first: repeatFirst.status,
      second: repeatSecond.status,
      totalRows: repeatStore.rows.length,
      totalInserted: repeatStore.inserts(),
    },
    broadWriterFixtures: {
      canaryFlagStatus: canaryFlagBroadWriter.status,
      canaryFlagWrites: canaryFlagBroadWriter.maxNewRows,
      legacyFlagStatus: legacyFlagBroadWriter.status,
      legacyFlagWrites: legacyFlagBroadWriter.maxNewRows,
    },
    observabilityFields: [
      'requestedDeterministicIdentity',
      'recomputedDeterministicIdentity',
      'preReadExactMatches',
      'action',
      'inserted',
      'reused',
      'rowId',
      'readbackStatus',
      'writeReadbackParity',
      'providerCallsMade',
      'productionDatabaseMutations',
    ],
    maxNewRowsPerCanary: MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_MAX_NEW_ROWS,
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
  }
}

export function getMlbForwardOpportunityEvidenceRepairAudit() {
  const fixture = runMlbForwardOpportunityEvidenceFixture()
  return {
    classification: MLB_04D_D3S_R1_CLASSIFICATION,
    phase: MLB_04D_D3S_R1_PHASE,
    storageInventory: [
      { table: 'sports_odds_snapshots', suitability: 'PRICE_ONLY_NO_RAW_CALIBRATED_PAIR' },
      { table: 'historical_feature_snapshots', suitability: 'FEATURE_CONTEXT_NOT_MARKET_BOOK_EVIDENCE' },
      { table: 'mlb_context_snapshots', suitability: 'CONTEXT_SNAPSHOT_ONLY_DO_NOT_EMBED_MUTATING_OPPORTUNITIES' },
      { table: 'prediction_history', suitability: 'MUTABLE_CURRENT_STATE_NOT_EVIDENCE_AUTHORITY' },
      { table: 'mlb_forward_research_ledger', suitability: 'OBSERVATION_LEDGER_NOT_PRE_LEDGER_EVIDENCE_SOURCE' },
    ],
    storageDecision: fixture.storageDecision,
    deterministicIdentityFields: [
      'sport',
      'event',
      'market',
      'selection',
      'exact_line',
      'sportsbook',
      'odds',
      'odds_timestamp',
      'odds_snapshot_id',
      'feature_snapshot_id',
      'raw_model_version',
      'calibration_version',
      'methodology_version',
      'raw_model_probability',
      'calibrated_probability',
    ],
    appendOnly: fixture.immutableOpportunityAppendOnlyCertified,
    currentBoardSeparated: fixture.currentBoardAndFrozenEvidenceSeparated,
    writeTiming: 'after D3W raw/calibrated generation and current prospective row persistence, only when execute mode and MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED=true; one-row canary writes require MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED plus selected deterministic identity',
    snapshotRelationship: 'ledger pairs mlb_context_snapshots.id with mlb_forward_opportunity_evidence.id after temporal cutoff validation',
    temporalContract: 'opportunity odds/generated timestamp <= snapshot timestamp <= evidence cutoff < event start',
    rawCalibratedContract: 'explicit raw_model_probability and calibrated_probability required; no fallback or reconstruction',
    priceEvidenceContract: 'sportsbook, odds, odds_timestamp, exact line and odds_snapshot_id are frozen in immutable row',
    immutabilityEnforcement: 'insert-only service, service-role select/insert grants, no update grant, before-update trigger',
    d3wIntegration: 'default-off continuous append/reuse path; mutable prediction_history behavior unchanged; legacy authorization cannot enable broad natural writes',
    d3PlannerCompatible: fixture.d3PlannerImmutableEvidenceCompatible,
    oldRowsPolicy: {
      oldRowsMutated: false,
      noRetrospectiveOpportunityFreeze: true,
    },
    currentSnapshotZeroRootCause: 'Package D automation and one-snapshot execution were not invoked for current/future events; no snapshot write was performed in this repair.',
    fixture,
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
  }
}
