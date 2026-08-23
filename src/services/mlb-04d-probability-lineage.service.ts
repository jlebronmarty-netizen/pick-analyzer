export const MLB_04D_D3R_CLASSIFICATION =
  'MLB_04D_D3R_RAW_CALIBRATED_PROBABILITY_LINEAGE_REPAIR_CERTIFIED'
export const MLB_04D_D3R_PHASE = 'MLB-04D-D3R_RAW_CALIBRATED_PROBABILITY_LINEAGE_REPAIR'
export const MLB_04D_PROBABILITY_LINEAGE_CONTRACT_VERSION = 'MLB_04D_PROBABILITY_LINEAGE_V1'

export type Mlb04dProbabilityLineageStatus =
  | 'PAIR_READY'
  | 'RAW_MISSING'
  | 'CALIBRATED_MISSING'
  | 'PROBABILITY_AMBIGUOUS'
  | 'IDENTITY_MISMATCH'
  | 'LINE_MISMATCH'
  | 'SPORTSBOOK_MISMATCH'
  | 'TIMESTAMP_CUTOFF_VIOLATION'
  | 'FUTURE_DATED_EVIDENCE'

export type Mlb04dProbabilityLineageOpportunity = {
  eventId: string
  market: string
  selection: string
  line: number | null
  sportsbook: string
  oddsTimestamp: string
  snapshotTimestamp: string
  cutoffAt: string
}

export type Mlb04dProbabilityLineageResult = {
  status: Mlb04dProbabilityLineageStatus
  contractVersion: typeof MLB_04D_PROBABILITY_LINEAGE_CONTRACT_VERSION
  eventId: string | null
  market: string | null
  selection: string | null
  line: number | null
  sportsbook: string | null
  rawProbability: number | null
  calibratedProbability: number | null
  calibrationDelta: number | null
  rawSource: string | null
  calibratedSource: string | null
  modelProbabilitySemantics: 'RAW_ONLY' | 'CALIBRATED_ONLY' | 'AMBIGUOUS_SINGLE_VALUE' | 'NOT_USED'
  oldRowsFailClosed: boolean
  reason: string | null
}

type JsonRecord = Record<string, unknown>

type PredictionLike = {
  id?: unknown
  event_id?: unknown
  game_id?: unknown
  market?: unknown
  selection?: unknown
  team?: unknown
  line?: unknown
  sportsbook?: unknown
  odds_timestamp?: unknown
  model_probability?: unknown
  model_version?: unknown
  prediction_origin?: unknown
  model_role?: unknown
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

function normalizeProbability(value: unknown): number | null {
  const parsed = numeric(value)
  if (parsed === null) return null
  const normalized = parsed > 1 ? parsed / 100 : parsed
  if (normalized < 0 || normalized > 1) return null
  return Number(normalized.toFixed(6))
}

function normalizeLine(value: unknown): number | null {
  const parsed = numeric(value)
  return parsed === null ? null : Number(parsed.toFixed(3))
}

function norm(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function timestampMs(value: string | null): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function probabilityFromPaths(
  row: PredictionLike,
  paths: Array<{ source: string; value: unknown }>,
): { value: number | null; source: string | null } {
  for (const path of paths) {
    const normalized = normalizeProbability(path.value)
    if (normalized !== null) return { value: normalized, source: path.source }
  }
  return { value: null, source: null }
}

function isExplicitCalibratedShadowRow(row: PredictionLike) {
  return (
    text(row.model_version) === 'MLB_CALIBRATED_SHADOW_V1' ||
    text(row.prediction_origin) === 'CURRENT_ERA_SHADOW' ||
    text(row.model_role) === 'shadow'
  )
}

function selectedPriceEvidence(row: PredictionLike) {
  const metadata = asRecord(row.certification_metadata)
  return asRecord(metadata.selectedPriceEvidence)
}

function lineageFailure(
  status: Mlb04dProbabilityLineageStatus,
  row: PredictionLike,
  opportunity: Mlb04dProbabilityLineageOpportunity,
  reason: string,
): Mlb04dProbabilityLineageResult {
  return {
    status,
    contractVersion: MLB_04D_PROBABILITY_LINEAGE_CONTRACT_VERSION,
    eventId: text(row.game_id) ?? text(row.event_id),
    market: text(row.market),
    selection: text(row.selection) ?? text(row.team),
    line: normalizeLine(row.line),
    sportsbook: text(row.sportsbook),
    rawProbability: null,
    calibratedProbability: null,
    calibrationDelta: null,
    rawSource: null,
    calibratedSource: null,
    modelProbabilitySemantics: 'NOT_USED',
    oldRowsFailClosed: true,
    reason: `${reason}:${opportunity.eventId}`,
  }
}

export function extractMlb04dProbabilityLineage(
  row: PredictionLike,
  opportunity: Mlb04dProbabilityLineageOpportunity,
): Mlb04dProbabilityLineageResult {
  const metadata = asRecord(row.certification_metadata)
  const featureSnapshot = asRecord(row.feature_snapshot)
  const calibratedShadow = asRecord(featureSnapshot.mlb03CalibratedShadow)
  const priceEvidence = selectedPriceEvidence(row)
  const rowEventId = text(row.game_id) ?? text(row.event_id)
  const rowMarket = text(row.market)
  const rowSelection = text(row.selection) ?? text(row.team)
  const rowLine = normalizeLine(row.line)
  const rowSportsbook = text(row.sportsbook)
  const opportunityLine = normalizeLine(opportunity.line)

  if (rowEventId !== opportunity.eventId || norm(rowMarket) !== norm(opportunity.market) || norm(rowSelection) !== norm(opportunity.selection)) {
    return lineageFailure('IDENTITY_MISMATCH', row, opportunity, 'EVENT_MARKET_SELECTION_MISMATCH')
  }
  if (rowLine !== opportunityLine) {
    return lineageFailure('LINE_MISMATCH', row, opportunity, 'EXACT_LINE_MISMATCH')
  }
  if (norm(rowSportsbook) !== norm(opportunity.sportsbook)) {
    return lineageFailure('SPORTSBOOK_MISMATCH', row, opportunity, 'SPORTSBOOK_MISMATCH')
  }

  const oddsTimestamp = text(priceEvidence.oddsTimestamp) ?? text(row.odds_timestamp) ?? opportunity.oddsTimestamp
  const oddsMs = timestampMs(oddsTimestamp)
  const snapshotMs = timestampMs(opportunity.snapshotTimestamp)
  const cutoffMs = timestampMs(opportunity.cutoffAt)
  if (oddsMs === null || snapshotMs === null || cutoffMs === null || oddsMs > cutoffMs || snapshotMs > cutoffMs) {
    return lineageFailure('TIMESTAMP_CUTOFF_VIOLATION', row, opportunity, 'PREGAME_TIMESTAMP_CONTRACT_FAILED')
  }

  const nowMs = Date.now()
  if (oddsMs > nowMs + 60_000 || snapshotMs > nowMs + 60_000) {
    return lineageFailure('FUTURE_DATED_EVIDENCE', row, opportunity, 'SOURCE_TIMESTAMP_FUTURE_DATED')
  }

  const raw = probabilityFromPaths(row, [
    { source: 'prediction_history.certification_metadata.rawModelProbability', value: metadata.rawModelProbability },
    { source: 'prediction_history.certification_metadata.raw_model_probability', value: metadata.raw_model_probability },
    { source: 'prediction_history.feature_snapshot.mlb03CalibratedShadow.rawModelProbability', value: calibratedShadow.rawModelProbability },
    { source: 'prediction_history.feature_snapshot.rawModelProbability', value: featureSnapshot.rawModelProbability },
    { source: 'prediction_history.feature_snapshot.raw_probability', value: featureSnapshot.raw_probability },
  ])

  const calibratedMetadata = probabilityFromPaths(row, [
    { source: 'prediction_history.certification_metadata.calibratedProbability', value: metadata.calibratedProbability },
    { source: 'prediction_history.certification_metadata.calibrated_probability', value: metadata.calibrated_probability },
    { source: 'prediction_history.feature_snapshot.mlb03CalibratedShadow.calibratedProbability', value: calibratedShadow.calibratedProbability },
    { source: 'prediction_history.feature_snapshot.calibratedProbability', value: featureSnapshot.calibratedProbability },
    { source: 'prediction_history.feature_snapshot.calibrated_probability', value: featureSnapshot.calibrated_probability },
  ])

  let calibrated = calibratedMetadata
  let modelProbabilitySemantics: Mlb04dProbabilityLineageResult['modelProbabilitySemantics'] = 'NOT_USED'
  if (calibrated.value === null && raw.value !== null && isExplicitCalibratedShadowRow(row)) {
    calibrated = {
      value: normalizeProbability(row.model_probability),
      source: 'prediction_history.model_probability calibrated shadow value',
    }
    modelProbabilitySemantics = 'CALIBRATED_ONLY'
  } else if (calibrated.value !== null) {
    modelProbabilitySemantics = 'NOT_USED'
  } else if (normalizeProbability(row.model_probability) !== null) {
    modelProbabilitySemantics = 'AMBIGUOUS_SINGLE_VALUE'
  }

  if (raw.value === null) {
    return {
      ...lineageFailure('RAW_MISSING', row, opportunity, 'EXPLICIT_RAW_PROBABILITY_REQUIRED'),
      calibratedProbability: calibrated.value,
      calibratedSource: calibrated.source,
      modelProbabilitySemantics,
    }
  }
  if (calibrated.value === null) {
    return {
      ...lineageFailure('CALIBRATED_MISSING', row, opportunity, 'EXPLICIT_CALIBRATED_PROBABILITY_REQUIRED'),
      rawProbability: raw.value,
      rawSource: raw.source,
      modelProbabilitySemantics,
    }
  }
  if (modelProbabilitySemantics === 'AMBIGUOUS_SINGLE_VALUE') {
    return {
      ...lineageFailure('PROBABILITY_AMBIGUOUS', row, opportunity, 'SINGLE_MODEL_PROBABILITY_NOT_A_PAIR'),
      rawProbability: raw.value,
      rawSource: raw.source,
    }
  }

  return {
    status: 'PAIR_READY',
    contractVersion: MLB_04D_PROBABILITY_LINEAGE_CONTRACT_VERSION,
    eventId: rowEventId,
    market: rowMarket,
    selection: rowSelection,
    line: rowLine,
    sportsbook: rowSportsbook,
    rawProbability: raw.value,
    calibratedProbability: calibrated.value,
    calibrationDelta: Number((calibrated.value - raw.value).toFixed(6)),
    rawSource: raw.source,
    calibratedSource: calibrated.source,
    modelProbabilitySemantics,
    oldRowsFailClosed: true,
    reason: null,
  }
}

export function buildMlb04dForwardLedgerProbabilityPayload(
  lineage: Mlb04dProbabilityLineageResult,
) {
  if (lineage.status !== 'PAIR_READY' || lineage.rawProbability === null || lineage.calibratedProbability === null) {
    return {
      ready: false,
      blockedReason: lineage.status,
      raw_probability: null,
      calibrated_probability: null,
      calibration_delta: null,
    }
  }
  return {
    ready: true,
    blockedReason: null,
    raw_probability: lineage.rawProbability,
    calibrated_probability: lineage.calibratedProbability,
    calibration_delta: lineage.calibrationDelta,
  }
}

export function getMlb04dProbabilityLineageContract() {
  return {
    classification: MLB_04D_D3R_CLASSIFICATION,
    phase: MLB_04D_D3R_PHASE,
    contractVersion: MLB_04D_PROBABILITY_LINEAGE_CONTRACT_VERSION,
    storageLocationDecision: 'prediction_history.certification_metadata plus feature_snapshot.mlb03CalibratedShadow for forward calibrated-shadow rows',
    modelProbabilitySemantics: {
      mlbCalibratedShadowV1: 'model_probability is calibrated percent only when explicit raw lineage is also present',
      prospectivePreviewV1: 'single model_probability is ambiguous for D3 ledger and must fail closed',
      rawLedgerColumn: 'mlb_forward_research_ledger.raw_probability receives only explicit raw model probability',
      calibratedLedgerColumn: 'mlb_forward_research_ledger.calibrated_probability receives only explicit calibrated probability',
    },
    exactBinding: ['event', 'market', 'selection', 'line', 'sportsbook', 'odds timestamp', 'snapshot timestamp', 'cutoff'],
    oldRowsFailClosed: true,
    noRetrospectiveBackfill: true,
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
  }
}

export function runMlb04dD3rProbabilityLineageFixture() {
  const opportunity: Mlb04dProbabilityLineageOpportunity = {
    eventId: 'baseball_mlb:fixture:event:1',
    market: 'total',
    selection: 'Under',
    line: 8.5,
    sportsbook: 'FanDuel',
    oddsTimestamp: '2026-08-22T16:00:00.000Z',
    snapshotTimestamp: '2026-08-22T17:00:00.000Z',
    cutoffAt: '2026-08-22T23:10:00.000Z',
  }
  const explicitPair: PredictionLike = {
    game_id: opportunity.eventId,
    market: opportunity.market,
    selection: opportunity.selection,
    line: opportunity.line,
    sportsbook: opportunity.sportsbook,
    odds_timestamp: opportunity.oddsTimestamp,
    model_probability: 52.4,
    model_version: 'MLB_CALIBRATED_SHADOW_V1',
    prediction_origin: 'CURRENT_ERA_SHADOW',
    model_role: 'shadow',
    certification_metadata: {
      rawModelProbability: 0.3851,
      calibratedProbability: 0.524,
      selectedPriceEvidence: {
        oddsTimestamp: opportunity.oddsTimestamp,
      },
    },
    feature_snapshot: {
      mlb03CalibratedShadow: {
        rawModelProbability: 0.3851,
        calibratedProbability: 0.524,
      },
    },
  }
  const oldProspectiveRow: PredictionLike = {
    game_id: opportunity.eventId,
    market: opportunity.market,
    selection: opportunity.selection,
    line: opportunity.line,
    sportsbook: opportunity.sportsbook,
    odds_timestamp: opportunity.oddsTimestamp,
    model_probability: 41.89,
    model_version: 'baseball_mlb_prospective_preview_v1',
    certification_metadata: {},
    feature_snapshot: {},
  }
  const fixturePair = extractMlb04dProbabilityLineage(explicitPair, opportunity)
  return {
    classification: MLB_04D_D3R_CLASSIFICATION,
    explicitPair: fixturePair,
    payload: buildMlb04dForwardLedgerProbabilityPayload(fixturePair),
    rawMissing: extractMlb04dProbabilityLineage({ ...explicitPair, certification_metadata: { calibratedProbability: 0.524 }, feature_snapshot: {} }, opportunity),
    calibratedMissing: extractMlb04dProbabilityLineage({
      ...explicitPair,
      model_probability: null,
      model_version: 'MLB_BASELINE_FIXTURE_V1',
      prediction_origin: null,
      model_role: null,
      certification_metadata: { rawModelProbability: 0.3851 },
      feature_snapshot: {},
    }, opportunity),
    oldProspectiveFailClosed: extractMlb04dProbabilityLineage(oldProspectiveRow, opportunity),
    lineMismatch: extractMlb04dProbabilityLineage({ ...explicitPair, line: 9 }, opportunity),
    sportsbookMismatch: extractMlb04dProbabilityLineage({ ...explicitPair, sportsbook: 'DraftKings' }, opportunity),
    timestampViolation: extractMlb04dProbabilityLineage(
      explicitPair,
      { ...opportunity, cutoffAt: '2026-08-22T15:00:00.000Z' },
    ),
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
  }
}
