import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { semanticJsonReadbackEqual } from './mlb-04d-forward-opportunity-evidence.service'
import type { MlbForwardResearchLedgerCanaryRow } from './mlb-04d-forward-research-ledger-canary.service'

export const MLB_04D_D3S_R3D_L3_R1_CLASSIFICATION =
  'MLB_04D_D3S_R3D_L3_R1_RESULT_EVALUATION_GUARD_CERTIFIED'
export const MLB_04D_D3S_R3D_L3_R1_PHASE =
  'MLB-04D-D3S-R3D-L3-R1_ONE_ROW_LEDGER_RESULT_EVALUATION_GUARD_REPAIR'
export const MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_AUTHORIZATION_ENV =
  'MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_AUTHORIZED'
export const MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_MAX_UPDATED_ROWS = 1

export type MlbForwardResearchLedgerResultEvaluationStatus =
  | 'BLOCK_UNAUTHORIZED'
  | 'BLOCK_NOT_FOUND'
  | 'BLOCK_IDENTITY_MISMATCH'
  | 'BLOCK_DUPLICATE_DEFECT'
  | 'BLOCK_RESULT_CONFLICT'
  | 'UPDATED'
  | 'REUSE_NO_OP'
  | 'FAILED_READBACK'
  | 'FAILED_READBACK_PARITY'

export type MlbForwardResearchLedgerMarketResult = 'WIN' | 'LOSS' | 'PUSH'
export type MlbForwardResearchLedgerChatDirectionalResult =
  | 'CORRECT'
  | 'INCORRECT'
  | 'NEUTRAL'
  | 'NOT_INTERPRETABLE'

export type MlbForwardResearchLedgerResultEvaluation = {
  result: MlbForwardResearchLedgerMarketResult
  result_id: string
  settled_at: string
  profit: number
  raw_brier: number | null
  calibrated_brier: number | null
  raw_log_loss: number | null
  calibrated_log_loss: number | null
  chat_directional_result: MlbForwardResearchLedgerChatDirectionalResult
}

export type MlbForwardResearchLedgerResultEvaluationStore = {
  readByIdAndIdentity(
    id: string,
    deterministicIdentity: string
  ): Promise<MlbForwardResearchLedgerCanaryRow[]>
  updateResultFields(
    id: string,
    deterministicIdentity: string,
    evaluation: MlbForwardResearchLedgerResultEvaluation
  ): Promise<{ row?: MlbForwardResearchLedgerCanaryRow | null; updatedRows: number }>
}

export const LEDGER_RESULT_MUTABLE_FIELDS = [
  'result',
  'result_id',
  'settled_at',
  'profit',
  'raw_brier',
  'calibrated_brier',
  'raw_log_loss',
  'calibrated_log_loss',
  'chat_directional_result',
] as const

export const LEDGER_RESULT_PREGAME_DENYLIST_FIELDS = [
  'deterministic_identity',
  'sport_key',
  'observation_id',
  'event_id',
  'snapshot_id',
  'opportunity_evidence_id',
  'snapshot_type',
  'snapshot_timestamp',
  'methodology_version',
  'scorecard_version',
  'market',
  'selection',
  'line',
  'sportsbook',
  'odds',
  'odds_timestamp',
  'raw_probability',
  'calibrated_probability',
  'component_states',
  'component_values',
  'composite_score',
  'scorecard_completeness',
  'context_completeness',
  'created_at',
] as const

function ledgerReadbackColumns() {
  return [
    'id',
    'deterministic_identity',
    'sport_key',
    'observation_id',
    'event_id',
    'snapshot_id',
    'opportunity_evidence_id',
    'snapshot_type',
    'snapshot_timestamp',
    'methodology_version',
    'scorecard_version',
    'market',
    'selection',
    'line',
    'sportsbook',
    'odds',
    'odds_timestamp',
    'raw_probability',
    'calibrated_probability',
    'component_states',
    'component_values',
    'composite_score',
    'scorecard_completeness',
    'context_completeness',
    'result',
    'result_id',
    'settled_at',
    'profit',
    'raw_brier',
    'calibrated_brier',
    'raw_log_loss',
    'calibrated_log_loss',
    'chat_directional_result',
    'created_at',
  ].join(',')
}

function comparable(value: unknown) {
  return typeof value === 'number' ? Number(value.toFixed(10)) : value ?? null
}

function clampProbability(value: number) {
  return Math.min(1 - 1e-15, Math.max(1e-15, value))
}

function evaluationMatches(
  row: MlbForwardResearchLedgerCanaryRow,
  evaluation: MlbForwardResearchLedgerResultEvaluation
) {
  return LEDGER_RESULT_MUTABLE_FIELDS.every((field) =>
    semanticJsonReadbackEqual(comparable(row[field]), comparable(evaluation[field]))
  )
}

function hasAnyResultField(row: MlbForwardResearchLedgerCanaryRow) {
  return LEDGER_RESULT_MUTABLE_FIELDS.some((field) => row[field] !== null && row[field] !== undefined)
}

function defaultLedgerResultEvaluationStore(): MlbForwardResearchLedgerResultEvaluationStore {
  return {
    async readByIdAndIdentity(id: string, deterministicIdentity: string) {
      const { data, error } = await supabaseAdmin
        .from('mlb_forward_research_ledger')
        .select(ledgerReadbackColumns())
        .eq('id', id)
        .eq('deterministic_identity', deterministicIdentity)
        .limit(2)
      if (error) throw new Error(`MLB forward research ledger result pre-read failed: ${error.message}`)
      return (data ?? []) as unknown as MlbForwardResearchLedgerCanaryRow[]
    },
    async updateResultFields(
      id: string,
      deterministicIdentity: string,
      evaluation: MlbForwardResearchLedgerResultEvaluation
    ) {
      const { data, error } = await supabaseAdmin
        .from('mlb_forward_research_ledger')
        .update({
          result: evaluation.result,
          result_id: evaluation.result_id,
          settled_at: evaluation.settled_at,
          profit: evaluation.profit,
          raw_brier: evaluation.raw_brier,
          calibrated_brier: evaluation.calibrated_brier,
          raw_log_loss: evaluation.raw_log_loss,
          calibrated_log_loss: evaluation.calibrated_log_loss,
          chat_directional_result: evaluation.chat_directional_result,
        })
        .eq('id', id)
        .eq('deterministic_identity', deterministicIdentity)
        .select(ledgerReadbackColumns())
      if (error) throw new Error(`MLB forward research ledger result update failed: ${error.message}`)
      return {
        row: data?.[0] as unknown as MlbForwardResearchLedgerCanaryRow | undefined,
        updatedRows: data?.length ?? 0,
      }
    },
  }
}

export function evaluateMlbForwardResearchLedgerResultEvaluationAuthorization(
  env: Record<string, string | undefined> = process.env
) {
  return env[MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_AUTHORIZATION_ENV] === 'true'
}

export function getMlbForwardResearchLedgerResultEvaluationContract() {
  return {
    classification: MLB_04D_D3S_R3D_L3_R1_CLASSIFICATION,
    phase: MLB_04D_D3S_R3D_L3_R1_PHASE,
    authorizationEnv: MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_AUTHORIZATION_ENV,
    defaultAuthorized: false,
    maxUpdatedRowsPerEvaluation: MLB_FORWARD_RESEARCH_LEDGER_RESULT_EVALUATION_MAX_UPDATED_ROWS,
    acceptsArrayPayloads: false,
    authorizesLedgerInserts: false,
    authorizesSnapshotWrites: false,
    authorizesOpportunityEvidenceWrites: false,
    authorizesPredictionWrites: false,
    authorizesOfficialPickWrites: false,
    authorizesSettlementWrites: false,
    authorizesLearningWrites: false,
    authorizesCalibrationWrites: false,
    authorizesProductWrites: false,
    activatesAutomation: false,
    activeCronAdded: false,
    mutableResultFields: [...LEDGER_RESULT_MUTABLE_FIELDS],
    pregameDenylistFields: [...LEDGER_RESULT_PREGAME_DENYLIST_FIELDS],
    accuracyClaimReady: false,
    calibrationObservationOnly: true,
    chatMethodProbabilityCreated: false,
    providerCallsMade: 0,
    productionDatabaseMutationsDuringCertification: 0,
  }
}

export function classifyMlbForwardResearchLedgerResultPreRead(
  rows: MlbForwardResearchLedgerCanaryRow[],
  evaluation: MlbForwardResearchLedgerResultEvaluation
) {
  if (rows.length === 0) return 'BLOCK_NOT_FOUND'
  if (rows.length > 1) return 'BLOCK_DUPLICATE_DEFECT'
  const row = rows[0]
  if (evaluationMatches(row, evaluation)) return 'REUSE_NO_OP'
  if (hasAnyResultField(row)) return 'BLOCK_RESULT_CONFLICT'
  return 'EVALUATION_ELIGIBLE'
}

export function gradeMlbForwardResearchLedgerMarketResult(input: {
  market: 'moneyline' | 'run_line' | 'total'
  selection: string
  line: number | null
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
}): MlbForwardResearchLedgerMarketResult {
  if (input.market === 'total') {
    if (input.line === null) return 'PUSH'
    const total = input.homeScore + input.awayScore
    const selection = input.selection.toLowerCase()
    if (total === input.line) return 'PUSH'
    if (selection.includes('under')) return total < input.line ? 'WIN' : 'LOSS'
    if (selection.includes('over')) return total > input.line ? 'WIN' : 'LOSS'
    return 'LOSS'
  }
  if (input.market === 'run_line') {
    if (input.line === null) return 'PUSH'
    const selectedHome = input.selection.toLowerCase().includes(input.homeTeam.toLowerCase())
    const selectedScore = selectedHome ? input.homeScore : input.awayScore
    const opponentScore = selectedHome ? input.awayScore : input.homeScore
    const adjusted = selectedScore + input.line
    if (adjusted === opponentScore) return 'PUSH'
    return adjusted > opponentScore ? 'WIN' : 'LOSS'
  }
  const winner = input.homeScore > input.awayScore ? input.homeTeam : input.awayTeam
  return input.selection.toLowerCase().includes(winner.toLowerCase()) ? 'WIN' : 'LOSS'
}

export function flat100MlbForwardResearchProfit(odds: number, result: MlbForwardResearchLedgerMarketResult) {
  if (result === 'PUSH') return 0
  if (result === 'LOSS') return -100
  return odds > 0 ? odds : Number((10000 / Math.abs(odds)).toFixed(10))
}

export function buildMlbForwardResearchLedgerResultEvaluation(input: {
  resultId: string
  marketResult: MlbForwardResearchLedgerMarketResult
  odds: number
  rawProbability: number
  calibratedProbability: number
  compositeScore: number | null
  settledAt: string
}): MlbForwardResearchLedgerResultEvaluation {
  const binaryTarget = input.marketResult === 'PUSH' ? null : input.marketResult === 'WIN' ? 1 : 0
  const rawProbability = clampProbability(input.rawProbability)
  const calibratedProbability = clampProbability(input.calibratedProbability)
  const rawBrier = binaryTarget === null ? null : (input.rawProbability - binaryTarget) ** 2
  const calibratedBrier = binaryTarget === null ? null : (input.calibratedProbability - binaryTarget) ** 2
  const rawLogLoss = binaryTarget === null
    ? null
    : -(binaryTarget * Math.log(rawProbability) + (1 - binaryTarget) * Math.log(1 - rawProbability))
  const calibratedLogLoss = binaryTarget === null
    ? null
    : -(binaryTarget * Math.log(calibratedProbability) + (1 - binaryTarget) * Math.log(1 - calibratedProbability))

  return {
    result: input.marketResult,
    result_id: input.resultId,
    settled_at: input.settledAt,
    profit: flat100MlbForwardResearchProfit(input.odds, input.marketResult),
    raw_brier: rawBrier,
    calibrated_brier: calibratedBrier,
    raw_log_loss: rawLogLoss,
    calibrated_log_loss: calibratedLogLoss,
    chat_directional_result: chatDirectionalResult(input.compositeScore, input.marketResult),
  }
}

export function chatDirectionalResult(
  compositeScore: number | null,
  result: MlbForwardResearchLedgerMarketResult
): MlbForwardResearchLedgerChatDirectionalResult {
  if (compositeScore === null || !Number.isFinite(compositeScore)) return 'NOT_INTERPRETABLE'
  if (result === 'PUSH' || compositeScore === 0) return 'NEUTRAL'
  if (compositeScore > 0 && result === 'WIN') return 'CORRECT'
  if (compositeScore < 0 && result === 'LOSS') return 'CORRECT'
  return 'INCORRECT'
}

export function compareMlbForwardResearchLedgerPregameFields(
  before: MlbForwardResearchLedgerCanaryRow,
  after: MlbForwardResearchLedgerCanaryRow
) {
  const changedFields = LEDGER_RESULT_PREGAME_DENYLIST_FIELDS.filter(
    (field) => !semanticJsonReadbackEqual(comparable(before[field]), comparable(after[field]))
  )
  return {
    status: changedFields.length === 0 ? 'PASS' : 'FAIL',
    changedFields,
  }
}

export async function persistSingleMlbForwardResearchLedgerResultEvaluation(
  input: {
    ledgerRowId: string
    deterministicIdentity: string
    evaluation: MlbForwardResearchLedgerResultEvaluation
  },
  options: {
    execute?: boolean
    resultEvaluationAuthorized?: boolean
    env?: Record<string, string | undefined>
    store?: MlbForwardResearchLedgerResultEvaluationStore
  }
) {
  if (
    !options.execute ||
    !options.resultEvaluationAuthorized ||
    !evaluateMlbForwardResearchLedgerResultEvaluationAuthorization(options.env)
  ) {
    return {
      status: 'BLOCK_UNAUTHORIZED' as MlbForwardResearchLedgerResultEvaluationStatus,
      action: 'BLOCKED',
      preReadStatus: 'NOT_ATTEMPTED',
      updatedRows: 0,
      rowId: null,
      readbackStatus: 'NOT_ATTEMPTED',
      writeReadbackParity: 'NOT_ATTEMPTED',
      pregameImmutability: 'NOT_ATTEMPTED',
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }

  const store = options.store ?? defaultLedgerResultEvaluationStore()
  const preRead = await store.readByIdAndIdentity(input.ledgerRowId, input.deterministicIdentity)
  const preReadStatus = classifyMlbForwardResearchLedgerResultPreRead(preRead, input.evaluation)
  if (preReadStatus === 'BLOCK_NOT_FOUND' || preReadStatus === 'BLOCK_DUPLICATE_DEFECT') {
    return {
      status: preReadStatus as MlbForwardResearchLedgerResultEvaluationStatus,
      action: 'BLOCKED',
      preReadStatus,
      updatedRows: 0,
      rowId: null,
      readbackStatus: 'NOT_ATTEMPTED',
      writeReadbackParity: 'NOT_ATTEMPTED',
      pregameImmutability: 'NOT_ATTEMPTED',
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }

  const preRow = preRead[0]
  if (preRow.id !== input.ledgerRowId || preRow.deterministic_identity !== input.deterministicIdentity) {
    return {
      status: 'BLOCK_IDENTITY_MISMATCH' as MlbForwardResearchLedgerResultEvaluationStatus,
      action: 'BLOCKED',
      preReadStatus: 'BLOCK_IDENTITY_MISMATCH',
      updatedRows: 0,
      rowId: null,
      readbackStatus: 'NOT_ATTEMPTED',
      writeReadbackParity: 'NOT_ATTEMPTED',
      pregameImmutability: 'NOT_ATTEMPTED',
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }

  if (preReadStatus === 'REUSE_NO_OP') {
    return {
      status: 'REUSE_NO_OP' as MlbForwardResearchLedgerResultEvaluationStatus,
      action: 'REUSE_NO_OP',
      preReadStatus,
      updatedRows: 0,
      rowId: preRow.id ?? null,
      readbackStatus: 'READBACK_EXACT_ONE',
      writeReadbackParity: 'PASS',
      pregameImmutability: 'PASS',
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }

  if (preReadStatus === 'BLOCK_RESULT_CONFLICT') {
    return {
      status: 'BLOCK_RESULT_CONFLICT' as MlbForwardResearchLedgerResultEvaluationStatus,
      action: 'BLOCKED',
      preReadStatus,
      updatedRows: 0,
      rowId: preRow.id ?? null,
      readbackStatus: 'NOT_ATTEMPTED',
      writeReadbackParity: 'NOT_ATTEMPTED',
      pregameImmutability: 'NOT_ATTEMPTED',
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }

  const update = await store.updateResultFields(input.ledgerRowId, input.deterministicIdentity, input.evaluation)
  if (update.updatedRows !== 1 || !update.row) {
    return {
      status: 'FAILED_READBACK' as MlbForwardResearchLedgerResultEvaluationStatus,
      action: 'UPDATE_ELIGIBLE',
      preReadStatus,
      updatedRows: update.updatedRows,
      rowId: update.row?.id ?? null,
      readbackStatus: `READBACK_${update.updatedRows}`,
      writeReadbackParity: 'FAIL',
      pregameImmutability: 'NOT_ATTEMPTED',
      providerCallsMade: 0,
      productionDatabaseMutations: update.updatedRows,
    }
  }

  const parity = evaluationMatches(update.row, input.evaluation)
  const immutability = compareMlbForwardResearchLedgerPregameFields(preRow, update.row)
  const status = parity && immutability.status === 'PASS' ? 'UPDATED' : 'FAILED_READBACK_PARITY'
  return {
    status: status as MlbForwardResearchLedgerResultEvaluationStatus,
    action: 'UPDATE_ELIGIBLE',
    preReadStatus,
    updatedRows: 1,
    rowId: update.row.id ?? null,
    readbackStatus: 'READBACK_EXACT_ONE',
    writeReadbackParity: parity ? 'PASS' : 'FAIL',
    pregameImmutability: immutability.status,
    pregameChangedFields: immutability.changedFields,
    providerCallsMade: 0,
    productionDatabaseMutations: 1,
  }
}

export function runMlbForwardResearchLedgerResultEvaluationFixture() {
  const baseRow: MlbForwardResearchLedgerCanaryRow = {
    id: '4a355368-f1af-4ea1-8303-60eb28afd4d7',
    deterministic_identity:
      'mlb_forward_research_ledger_v1|baseball_mlb|baseball_mlb:mlb:sportsdataio:event:79263|55f27a6a-8580-4478-97ae-e4018e203294|final_pregame|total|under|7.0|lowvig|mlb_forward_opportunity_evidence_v1|mlb_chat_method_research_scorecard_v2',
    sport_key: 'baseball_mlb',
    observation_id: '55f27a6a-8580-4478-97ae-e4018e203294:de7e36a1-058e-5b9e-a711-9ad87ee15c69',
    event_id: 'baseball_mlb:mlb:sportsdataio:event:79263',
    snapshot_id: '55f27a6a-8580-4478-97ae-e4018e203294',
    opportunity_evidence_id: 'de7e36a1-058e-5b9e-a711-9ad87ee15c69',
    snapshot_type: 'FINAL_PREGAME',
    snapshot_timestamp: '2026-08-24T23:38:10.836+00:00',
    methodology_version: 'mlb_forward_opportunity_evidence_v1',
    scorecard_version: 'MLB_CHAT_METHOD_RESEARCH_SCORECARD_V2',
    market: 'total',
    selection: 'Under',
    line: 7,
    sportsbook: 'lowvig',
    odds: 106,
    odds_timestamp: '2026-08-24T23:17:07+00:00',
    raw_probability: 0.3695,
    calibrated_probability: 0.524,
    component_states: { MARKET_VALUE: 'AVAILABLE', OFFENSE_EDGE: 'AVAILABLE', BULLPEN_EDGE: 'AVAILABLE' },
    component_values: { MARKET_VALUE: 0.0386, OFFENSE_EDGE: 0.0277, BULLPEN_EDGE: 0.1825, STARTER_EDGE: null },
    composite_score: 0.0829,
    scorecard_completeness: 0.4286,
    context_completeness: 0.4286,
    result: null,
    result_id: null,
    settled_at: null,
    profit: null,
    raw_brier: null,
    calibrated_brier: null,
    raw_log_loss: null,
    calibrated_log_loss: null,
    chat_directional_result: null,
    created_at: '2026-08-25T18:48:45.950072+00:00',
  }
  const marketResult = gradeMlbForwardResearchLedgerMarketResult({
    market: 'total',
    selection: 'Under',
    line: 7,
    homeTeam: 'SF',
    awayTeam: 'CIN',
    homeScore: 5,
    awayScore: 0,
  })
  const evaluation = buildMlbForwardResearchLedgerResultEvaluation({
    resultId: 'c4b961fc-32a8-4309-906e-7acc307e932c',
    marketResult,
    odds: 106,
    rawProbability: 0.3695,
    calibratedProbability: 0.524,
    compositeScore: 0.0829,
    settledAt: '2026-08-25T18:50:00.000Z',
  })
  const pushEvaluation = buildMlbForwardResearchLedgerResultEvaluation({
    resultId: '00000000-0000-4000-8000-000000000000',
    marketResult: 'PUSH',
    odds: 106,
    rawProbability: 0.3695,
    calibratedProbability: 0.524,
    compositeScore: 0.0829,
    settledAt: '2026-08-25T18:50:00.000Z',
  })
  const updatedRow = { ...baseRow, ...evaluation }
  return {
    classification: MLB_04D_D3S_R3D_L3_R1_CLASSIFICATION,
    contract: getMlbForwardResearchLedgerResultEvaluationContract(),
    fixture: {
      baseRow,
      canonicalResult: {
        id: 'c4b961fc-32a8-4309-906e-7acc307e932c',
        eventId: 'baseball_mlb:mlb:sportsdataio:event:79263',
        homeTeam: 'SF',
        awayTeam: 'CIN',
        homeScore: 5,
        awayScore: 0,
        totalRuns: 5,
      },
      marketResult,
      evaluation,
      pushEvaluation,
      preReadEligible: classifyMlbForwardResearchLedgerResultPreRead([baseRow], evaluation),
      preReadReuse: classifyMlbForwardResearchLedgerResultPreRead([updatedRow], evaluation),
      preReadConflict: classifyMlbForwardResearchLedgerResultPreRead(
        [{ ...updatedRow, result_id: '11111111-1111-4111-8111-111111111111' }],
        evaluation
      ),
      pregameImmutability: compareMlbForwardResearchLedgerPregameFields(baseRow, updatedRow),
      calibrationImprovedBrier: Number(evaluation.calibrated_brier) < Number(evaluation.raw_brier),
      calibrationImprovedLogLoss: Number(evaluation.calibrated_log_loss) < Number(evaluation.raw_log_loss),
      providerCalls: 0,
      productionDatabaseMutations: 0,
      productWrites: 0,
      learningWrites: 0,
      calibrationWrites: 0,
      automationActivated: 'NO',
      activeCronAdded: 'NO',
    },
  }
}
