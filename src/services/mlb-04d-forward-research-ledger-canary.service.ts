import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { semanticJsonReadbackEqual } from './mlb-04d-forward-opportunity-evidence.service'

type JsonRecord = Record<string, unknown>

export const MLB_04D_D3S_R3D_L1_CLASSIFICATION =
  'MLB_04D_D3S_R3D_L1_LEDGER_CANARY_GUARD_CERTIFIED'
export const MLB_04D_D3S_R3D_L1_PHASE =
  'MLB-04D-D3S-R3D-L1_ONE_ROW_FORWARD_RESEARCH_LEDGER_CANARY_GUARD_REPAIR'
export const MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZATION_ENV =
  'MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZED'
export const MLB_FORWARD_RESEARCH_LEDGER_CANARY_MAX_NEW_ROWS = 1

export type MlbForwardResearchLedgerCanaryStatus =
  | 'BLOCK_UNAUTHORIZED'
  | 'BLOCK_IDENTITY_MISMATCH'
  | 'BLOCK_INVALID_FOREIGN_KEY'
  | 'BLOCK_DUPLICATE_DEFECT'
  | 'INSERTED'
  | 'REUSE_NO_OP'
  | 'FAILED_READBACK'
  | 'FAILED_READBACK_PARITY'

export type MlbForwardResearchLedgerCanaryRow = {
  id?: string | null
  deterministic_identity: string
  sport_key: string
  observation_id: string
  event_id: string
  snapshot_id: string
  opportunity_evidence_id: string
  snapshot_type: 'MORNING' | 'FINAL_PREGAME'
  snapshot_timestamp: string
  methodology_version: string
  scorecard_version: string
  market: 'moneyline' | 'run_line' | 'total'
  selection: string
  line: number | null
  sportsbook: string
  odds: number
  odds_timestamp: string
  raw_probability: number
  calibrated_probability: number
  component_states: JsonRecord
  component_values: JsonRecord
  composite_score: number | null
  scorecard_completeness: number
  context_completeness: number
  result?: 'WIN' | 'LOSS' | 'PUSH' | null
  result_id?: string | null
  settled_at?: string | null
  profit?: number | null
  raw_brier?: number | null
  calibrated_brier?: number | null
  raw_log_loss?: number | null
  calibrated_log_loss?: number | null
  chat_directional_result?: 'CORRECT' | 'INCORRECT' | 'NEUTRAL' | 'NOT_INTERPRETABLE' | null
  created_at?: string | null
}

type MlbForwardResearchLedgerCanaryStore = {
  readByDeterministicIdentity(identity: string): Promise<MlbForwardResearchLedgerCanaryRow[]>
  validateForeignKeys(row: MlbForwardResearchLedgerCanaryRow): Promise<boolean>
  insert(row: MlbForwardResearchLedgerCanaryRow): Promise<{
    row?: MlbForwardResearchLedgerCanaryRow | null
    duplicate?: boolean
  }>
}

const IMMUTABLE_PREGAME_FIELDS = [
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
] as const

const MUTABLE_RESULT_FIELDS = [
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

function stablePart(value: unknown) {
  return String(value ?? 'null').trim().toLowerCase()
}

function lineIdentity(value: number | null) {
  return value === null ? 'null' : Number(value).toFixed(1)
}

function numericComparable(value: unknown) {
  return typeof value === 'number' ? Number(value.toFixed(6)) : value ?? null
}

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

export function buildMlbForwardResearchLedgerCanaryIdentity(input: {
  sportKey: string
  eventId: string
  snapshotId: string
  snapshotType: 'MORNING' | 'FINAL_PREGAME'
  market: 'moneyline' | 'run_line' | 'total'
  selection: string
  line: number | null
  sportsbook: string
  methodologyVersion: string
  scorecardVersion: string
}) {
  return [
    'mlb_forward_research_ledger_v1',
    input.sportKey,
    input.eventId,
    input.snapshotId,
    input.snapshotType,
    input.market,
    input.selection,
    lineIdentity(input.line),
    input.sportsbook,
    input.methodologyVersion,
    input.scorecardVersion,
  ].map(stablePart).join('|')
}

export function recomputeMlbForwardResearchLedgerCanaryIdentity(row: MlbForwardResearchLedgerCanaryRow) {
  return buildMlbForwardResearchLedgerCanaryIdentity({
    sportKey: row.sport_key,
    eventId: row.event_id,
    snapshotId: row.snapshot_id,
    snapshotType: row.snapshot_type,
    market: row.market,
    selection: row.selection,
    line: row.line,
    sportsbook: row.sportsbook,
    methodologyVersion: row.methodology_version,
    scorecardVersion: row.scorecard_version,
  })
}

export function evaluateMlbForwardResearchLedgerCanaryAuthorization(
  env: Record<string, string | undefined> = process.env
) {
  return env[MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZATION_ENV] === 'true'
}

export function getMlbForwardResearchLedgerCanaryContract() {
  return {
    classification: MLB_04D_D3S_R3D_L1_CLASSIFICATION,
    phase: MLB_04D_D3S_R3D_L1_PHASE,
    authorizationEnv: MLB_FORWARD_RESEARCH_LEDGER_CANARY_AUTHORIZATION_ENV,
    defaultAuthorized: false,
    maxNewRowsPerCanary: MLB_FORWARD_RESEARCH_LEDGER_CANARY_MAX_NEW_ROWS,
    acceptsArrayPayloads: false,
    invokesAutomationPlanner: false,
    invokesProviderCalls: false,
    authorizesSnapshotWrites: false,
    authorizesOpportunityEvidenceWrites: false,
    authorizesPredictionWrites: false,
    authorizesSettlementWrites: false,
    authorizesGeneralLedgerPersistence: false,
    immutablePregameFields: [...IMMUTABLE_PREGAME_FIELDS],
    mutableResultFields: [...MUTABLE_RESULT_FIELDS],
    accuracyClaimReady: false,
    chatMethodProbabilityCreated: false,
    chatMethodProbabilityReady: false,
    automationActivated: 'NO',
    activeCronAdded: 'NO',
  }
}

export function compareMlbForwardResearchLedgerCanaryReadback(
  expected: MlbForwardResearchLedgerCanaryRow,
  actual?: MlbForwardResearchLedgerCanaryRow | null,
) {
  const fields = [...IMMUTABLE_PREGAME_FIELDS, ...MUTABLE_RESULT_FIELDS] as const
  const mismatches = fields.filter((field) => {
    const left = numericComparable(expected[field])
    const right = numericComparable(actual?.[field])
    return !semanticJsonReadbackEqual(left, right)
  })
  return {
    status: actual && mismatches.length === 0 ? 'PASS' : 'FAIL',
    mismatches,
  }
}

function defaultLedgerCanaryStore(): MlbForwardResearchLedgerCanaryStore {
  return {
    async readByDeterministicIdentity(identity: string) {
      const { data, error } = await supabaseAdmin
        .from('mlb_forward_research_ledger')
        .select(ledgerReadbackColumns())
        .eq('deterministic_identity', identity)
        .limit(2)
      if (error) throw new Error(`MLB forward research ledger pre-read failed: ${error.message}`)
      return (data ?? []) as unknown as MlbForwardResearchLedgerCanaryRow[]
    },
    async validateForeignKeys(row: MlbForwardResearchLedgerCanaryRow) {
      const [event, snapshot, evidence] = await Promise.all([
        supabaseAdmin.from('sport_events').select('id').eq('id', row.event_id).limit(1),
        supabaseAdmin.from('mlb_context_snapshots').select('id').eq('id', row.snapshot_id).limit(1),
        supabaseAdmin.from('mlb_forward_opportunity_evidence').select('id').eq('id', row.opportunity_evidence_id).limit(1),
      ])
      if (event.error) throw new Error(`MLB ledger event FK validation failed: ${event.error.message}`)
      if (snapshot.error) throw new Error(`MLB ledger snapshot FK validation failed: ${snapshot.error.message}`)
      if (evidence.error) throw new Error(`MLB ledger opportunity evidence FK validation failed: ${evidence.error.message}`)
      return Boolean(event.data?.length && snapshot.data?.length && evidence.data?.length)
    },
    async insert(row: MlbForwardResearchLedgerCanaryRow) {
      const insertPayload = {
        deterministic_identity: row.deterministic_identity,
        sport_key: row.sport_key,
        observation_id: row.observation_id,
        event_id: row.event_id,
        snapshot_id: row.snapshot_id,
        opportunity_evidence_id: row.opportunity_evidence_id,
        snapshot_type: row.snapshot_type,
        snapshot_timestamp: row.snapshot_timestamp,
        methodology_version: row.methodology_version,
        scorecard_version: row.scorecard_version,
        market: row.market,
        selection: row.selection,
        line: row.line,
        sportsbook: row.sportsbook,
        odds: row.odds,
        odds_timestamp: row.odds_timestamp,
        raw_probability: row.raw_probability,
        calibrated_probability: row.calibrated_probability,
        component_states: row.component_states,
        component_values: row.component_values,
        composite_score: row.composite_score,
        scorecard_completeness: row.scorecard_completeness,
        context_completeness: row.context_completeness,
        result: row.result ?? null,
        result_id: row.result_id ?? null,
        settled_at: row.settled_at ?? null,
        profit: row.profit ?? null,
        raw_brier: row.raw_brier ?? null,
        calibrated_brier: row.calibrated_brier ?? null,
        raw_log_loss: row.raw_log_loss ?? null,
        calibrated_log_loss: row.calibrated_log_loss ?? null,
        chat_directional_result: row.chat_directional_result ?? null,
      }
      const { data, error } = await supabaseAdmin
        .from('mlb_forward_research_ledger')
        .insert(insertPayload)
        .select(ledgerReadbackColumns())
        .single()
      if (!error) return { row: data as unknown as MlbForwardResearchLedgerCanaryRow }
      if (error.code === '23505') return { duplicate: true }
      throw new Error(`MLB forward research ledger insert failed: ${error.message}`)
    },
  }
}

export async function persistSingleMlbForwardResearchLedgerCanary(
  row: MlbForwardResearchLedgerCanaryRow,
  options: {
    execute?: boolean
    canaryAuthorized?: boolean
    requestedDeterministicIdentity: string
    env?: Record<string, string | undefined>
    store?: MlbForwardResearchLedgerCanaryStore
  }
) {
  const recomputedIdentity = recomputeMlbForwardResearchLedgerCanaryIdentity(row)
  const requestedIdentity = options.requestedDeterministicIdentity
  if (!options.execute || !options.canaryAuthorized || !evaluateMlbForwardResearchLedgerCanaryAuthorization(options.env)) {
    return {
      status: 'BLOCK_UNAUTHORIZED' as MlbForwardResearchLedgerCanaryStatus,
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
  if (requestedIdentity !== recomputedIdentity || row.deterministic_identity !== recomputedIdentity) {
    return {
      status: 'BLOCK_IDENTITY_MISMATCH' as MlbForwardResearchLedgerCanaryStatus,
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
  const store = options.store ?? defaultLedgerCanaryStore()
  const preRead = await store.readByDeterministicIdentity(row.deterministic_identity)
  if (preRead.length > 1) {
    return {
      status: 'BLOCK_DUPLICATE_DEFECT' as MlbForwardResearchLedgerCanaryStatus,
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
    const parity = compareMlbForwardResearchLedgerCanaryReadback(row, preRead[0])
    return {
      status: 'REUSE_NO_OP' as MlbForwardResearchLedgerCanaryStatus,
      requestedDeterministicIdentity: requestedIdentity,
      recomputedDeterministicIdentity: recomputedIdentity,
      preReadExactMatches: 1,
      action: 'REUSE_NO_OP',
      inserted: 0,
      reused: 1,
      rowId: preRead[0].id ?? null,
      readbackStatus: 'READBACK_EXACT_ONE',
      writeReadbackParity: parity.status,
      readbackMismatches: parity.mismatches,
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
    }
  }
  if (!(await store.validateForeignKeys(row))) {
    return {
      status: 'BLOCK_INVALID_FOREIGN_KEY' as MlbForwardResearchLedgerCanaryStatus,
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
    const parity = compareMlbForwardResearchLedgerCanaryReadback(row, raceReadback[0])
    return {
      status: 'REUSE_NO_OP' as MlbForwardResearchLedgerCanaryStatus,
      requestedDeterministicIdentity: requestedIdentity,
      recomputedDeterministicIdentity: recomputedIdentity,
      preReadExactMatches: 0,
      action: 'REUSE_NO_OP',
      inserted: 0,
      reused: 1,
      rowId: raceReadback[0].id ?? null,
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
  const parity = compareMlbForwardResearchLedgerCanaryReadback(row, readback[0])
  return {
    status: parity.status === 'PASS' ? 'INSERTED' : 'FAILED_READBACK_PARITY',
    requestedDeterministicIdentity: requestedIdentity,
    recomputedDeterministicIdentity: recomputedIdentity,
    preReadExactMatches: 0,
    action: 'INSERT_ELIGIBLE',
    inserted: 1,
    reused: 0,
    rowId: readback[0].id ?? null,
    readbackStatus: 'READBACK_EXACT_ONE',
    writeReadbackParity: parity.status,
    readbackMismatches: parity.mismatches,
    providerCallsMade: 0,
    productionDatabaseMutations: 1,
  }
}
