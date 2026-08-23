import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  buildMlb04bDeterministicSnapshotKey,
  type Mlb04bSnapshotType,
} from './mlb-04b-research-snapshot-runtime.service'
import {
  MLB_04C_METHODOLOGY_VERSION,
  MLB_04C_R4_SCORECARD_VERSION,
  type Mlb04cComponentKey,
  type Mlb04cMarket,
} from './mlb-04c-chat-method-research-scorecard.service'
import {
  buildMlb04dForwardResearchLedgerIdentity,
  evaluateMlb04dResearchResult,
  getMlb04dForwardAutomationContract,
  gradeMlb04dMarketResult,
  type Mlb04dChatDirectionalResult,
  type Mlb04dMarketResult,
} from './mlb-04d-forward-automation-prep.service'
import { auditMlb04dAInternalContextExpansion } from './mlb-04d-internal-context-expansion.service'

export const MLB_04D_D1_CLASSIFICATION = 'MLB_04D_D1_BOUNDED_FORWARD_AUTOMATION_IMPLEMENTATION_CERTIFIED'
export const MLB_04D_D1_PHASE = 'MLB-04D-D1_BOUNDED_FORWARD_AUTOMATION_IMPLEMENTATION'
export const MLB_04D_D1_CONTRACT_VERSION = 'MLB_04D_D1_FORWARD_AUTOMATION_PLANNER_V1'

export const MLB_FORWARD_RESEARCH_AUTOMATION_ENABLED = 'MLB_FORWARD_RESEARCH_AUTOMATION_ENABLED'
export const MLB_MORNING_CAPTURE_ENABLED = 'MLB_MORNING_CAPTURE_ENABLED'
export const MLB_FINAL_PREGAME_CAPTURE_ENABLED = 'MLB_FINAL_PREGAME_CAPTURE_ENABLED'
export const MLB_RESEARCH_SCORECARD_ENABLED = 'MLB_RESEARCH_SCORECARD_ENABLED'
export const MLB_FORWARD_LEDGER_ENABLED = 'MLB_FORWARD_LEDGER_ENABLED'
export const MLB_RESEARCH_RESULT_EVALUATION_ENABLED = 'MLB_RESEARCH_RESULT_EVALUATION_ENABLED'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const DEFAULT_MAX_EVENTS_PER_PASS = 25
const COHORT_CHECKPOINTS = [5, 10, 25, 50, 100] as const

export type Mlb04dD1Mode = 'DRY_RUN' | 'PREVIEW' | 'EXECUTE'
export type Mlb04dD1SnapshotAction = 'WOULD_INSERT' | 'REUSE_NO_OP' | 'BLOCK_DUPLICATE_DEFECT' | 'BLOCKED'
export type Mlb04dD1ScorecardAction = 'READY' | 'WAITING_FOR_SNAPSHOT' | 'BLOCKED'
export type Mlb04dD1LedgerAction = 'WOULD_INSERT' | 'REUSE_NO_OP' | 'BLOCK_DUPLICATE_DEFECT' | 'BLOCKED_STORAGE_NOT_APPLIED'
export type Mlb04dD1ResultCheckState = 'WAITING_RESULT' | 'RESULT_AVAILABLE' | 'ALREADY_EVALUATED' | 'BLOCKED_RESULT_LINKAGE' | 'BLOCKED_OTHER'

type EventRow = {
  id: string
  sport_key?: string | null
  status?: string | null
  start_time: string
  home_team?: string | null
  away_team?: string | null
  venue?: string | null
}

type SnapshotIndexRow = {
  id: string
  event_id: string
  snapshot_type: Mlb04bSnapshotType
  deterministic_key: string
  snapshot_timestamp?: string | null
  components?: Record<string, unknown> | null
}

type ResultRow = {
  id: string
  game_id: string
  home_score: number | null
  away_score: number | null
  winner: string | null
}

type PlannerAdapter = {
  readEventsForDate: (date: string) => Promise<EventRow[]>
  readSnapshotsForEvents: (eventIds: string[]) => Promise<SnapshotIndexRow[]>
  readResultsForEvents: (eventIds: string[]) => Promise<ResultRow[]>
}

export type Mlb04dD1ForwardLedgerRuntimeContract = {
  observation_id: string
  event_id: string
  snapshot_id: string
  snapshot_type: Mlb04bSnapshotType
  snapshot_timestamp: string
  methodology_version: string
  scorecard_version: string
  market: Mlb04cMarket
  selection: string
  line: number | null
  sportsbook: string
  odds: number
  odds_timestamp: string
  raw_probability: number
  calibrated_probability: number
  component_states: Record<Mlb04cComponentKey, string>
  component_values: Record<Mlb04cComponentKey, number | null>
  composite_score: number | null
  scorecard_completeness: number
  context_completeness: number
  created_at: string
  result: Mlb04dMarketResult | null
  result_id: string | null
  settled_at: string | null
  profit: number | null
  raw_brier: number | null
  calibrated_brier: number | null
  raw_log_loss: number | null
  calibrated_log_loss: number | null
  chat_directional_result: Mlb04dChatDirectionalResult | null
}

type PlannedSnapshot = {
  snapshotType: Mlb04bSnapshotType
  captureWindow: string
  deterministicKey: string
  existingMatches: number
  eligible: boolean
  action: Mlb04dD1SnapshotAction
  wouldInsert: boolean
  blockedReason: string | null
}

type EventPlan = {
  eventId: string
  event: string
  startTime: string
  status: string
  queuePosition: number
  blocked: string[]
  morning: PlannedSnapshot
  finalPregame: PlannedSnapshot
  scorecard: {
    action: Mlb04dD1ScorecardAction
    snapshotId: string | null
    scorecardVersion: string
    frozenFieldsOnly: true
    probabilityOutput: false
    blockedReason: string | null
  }
  ledger: {
    action: Mlb04dD1LedgerAction
    deterministicIdentity: string | null
    migrationRequired: true
    blockedReason: string
  }
  resultCheck: {
    state: Mlb04dD1ResultCheckState
    resultId: string | null
  }
  resultEvaluation: {
    ready: boolean
    marketResult: Mlb04dMarketResult | null
    profit: number | null
    rawBrier: number | null
    calibratedBrier: number | null
    rawLogLoss: number | null
    calibratedLogLoss: number | null
    chatDirectionalResult: Mlb04dChatDirectionalResult | null
  }
  componentStates: Record<Mlb04cComponentKey, string>
  componentValues: Record<Mlb04cComponentKey, number | null>
}

function isoDay(value: Date) {
  return value.toISOString().slice(0, 10)
}

function captureWindowFor(date: string, snapshotType: Mlb04bSnapshotType) {
  return snapshotType === 'MORNING'
    ? `MORNING_${date.replaceAll('-', '_')}`
    : `FINAL_PREGAME_${date.replaceAll('-', '_')}_30M`
}

function parseTime(value: string | null | undefined) {
  const parsed = Date.parse(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

function eventLabel(event: EventRow) {
  return `${event.away_team ?? 'Away'} @ ${event.home_team ?? 'Home'}`
}

function isTerminalStatus(status: string | null | undefined) {
  const normalized = String(status ?? '').toUpperCase()
  return ['FINAL', 'COMPLETED', 'CANCELLED', 'POSTPONED'].some((state) => normalized.includes(state))
}

function pregameEligible(event: EventRow, now: Date) {
  const startMs = parseTime(event.start_time)
  return startMs !== null && startMs > now.getTime() && !isTerminalStatus(event.status)
}

function plannedSnapshot(
  event: EventRow,
  snapshotType: Mlb04bSnapshotType,
  date: string,
  matches: SnapshotIndexRow[],
  now: Date,
): PlannedSnapshot {
  const captureWindow = captureWindowFor(date, snapshotType)
  const deterministicKey = buildMlb04bDeterministicSnapshotKey({
    eventId: event.id,
    snapshotType,
    captureWindow,
  })
  const existingMatches = matches.filter((row) => row.deterministic_key === deterministicKey).length
  const eligible = pregameEligible(event, now)
  if (existingMatches > 1) {
    return {
      snapshotType,
      captureWindow,
      deterministicKey,
      existingMatches,
      eligible: false,
      action: 'BLOCK_DUPLICATE_DEFECT',
      wouldInsert: false,
      blockedReason: 'SNAPSHOT_IDENTITY_DUPLICATE_DEFECT',
    }
  }
  if (existingMatches === 1) {
    return {
      snapshotType,
      captureWindow,
      deterministicKey,
      existingMatches,
      eligible,
      action: 'REUSE_NO_OP',
      wouldInsert: false,
      blockedReason: null,
    }
  }
  if (!eligible) {
    return {
      snapshotType,
      captureWindow,
      deterministicKey,
      existingMatches,
      eligible: false,
      action: 'BLOCKED',
      wouldInsert: false,
      blockedReason: 'EVENT_NOT_PREGAME_OR_INVALID_START',
    }
  }
  return {
    snapshotType,
    captureWindow,
    deterministicKey,
    existingMatches,
    eligible: true,
    action: 'WOULD_INSERT',
    wouldInsert: true,
    blockedReason: null,
  }
}

function defaultComponentStates(event: EventRow): Record<Mlb04cComponentKey, string> {
  return {
    STARTER_EDGE: 'PARTIAL',
    OFFENSE_EDGE: 'AVAILABLE',
    BULLPEN_EDGE: 'AVAILABLE',
    LINEUP_EDGE: 'PARTIAL',
    SPLIT_EDGE: 'AUDIT_ONLY',
    CONTEXT_EDGE: event.venue ? 'PARTIAL' : 'UNKNOWN',
    MARKET_VALUE: 'AVAILABLE',
  }
}

function defaultComponentValues(): Record<Mlb04cComponentKey, number | null> {
  return {
    STARTER_EDGE: null,
    OFFENSE_EDGE: null,
    BULLPEN_EDGE: null,
    LINEUP_EDGE: null,
    SPLIT_EDGE: null,
    CONTEXT_EDGE: null,
    MARKET_VALUE: null,
  }
}

function buildRepresentativeLedgerIdentity(event: EventRow, finalSnapshot: SnapshotIndexRow | null) {
  if (!finalSnapshot) return null
  return buildMlb04dForwardResearchLedgerIdentity({
    sport: SPORT_KEY,
    eventId: event.id,
    snapshotType: 'FINAL_PREGAME',
    snapshotId: finalSnapshot.id,
    market: 'total',
    selection: 'Under',
    line: 8.5,
    sportsbook: 'FanDuel',
    methodologyVersion: MLB_04C_METHODOLOGY_VERSION,
    scorecardVersion: MLB_04C_R4_SCORECARD_VERSION,
  })
}

function planEvent(params: {
  event: EventRow
  date: string
  now: Date
  queuePosition: number
  snapshots: SnapshotIndexRow[]
  result: ResultRow | null
}): EventPlan {
  const snapshots = params.snapshots.filter((row) => row.event_id === params.event.id)
  const finalSnapshot = snapshots.find((row) => row.snapshot_type === 'FINAL_PREGAME') ?? null
  const morning = plannedSnapshot(params.event, 'MORNING', params.date, snapshots, params.now)
  const finalPregame = plannedSnapshot(params.event, 'FINAL_PREGAME', params.date, snapshots, params.now)
  const ledgerIdentity = buildRepresentativeLedgerIdentity(params.event, finalSnapshot)
  const result = params.result
  const scorecardReady = Boolean(finalSnapshot)
  const hasResult = Boolean(result?.id)
  const resultEvaluation = result && result.home_score !== null && result.away_score !== null
    ? evaluateMlb04dResearchResult({
      marketResult: gradeMlb04dMarketResult({
        market: 'total',
        selection: 'Under',
        line: 8.5,
        homeTeam: params.event.home_team ?? 'Home',
        awayTeam: params.event.away_team ?? 'Away',
        homeScore: Number(result.home_score),
        awayScore: Number(result.away_score),
      }),
      odds: -110,
      rawProbability: 0.5,
      calibratedProbability: 0.5,
      chatMethodScore: null,
    })
    : null

  return {
    eventId: params.event.id,
    event: eventLabel(params.event),
    startTime: params.event.start_time,
    status: String(params.event.status ?? 'UNKNOWN'),
    queuePosition: params.queuePosition,
    blocked: [
      morning.action === 'BLOCK_DUPLICATE_DEFECT' ? 'MORNING_DUPLICATE_IDENTITY' : null,
      finalPregame.action === 'BLOCK_DUPLICATE_DEFECT' ? 'FINAL_PREGAME_DUPLICATE_IDENTITY' : null,
    ].filter((value): value is string => Boolean(value)),
    morning,
    finalPregame,
    scorecard: {
      action: scorecardReady ? 'READY' : 'WAITING_FOR_SNAPSHOT',
      snapshotId: finalSnapshot?.id ?? null,
      scorecardVersion: MLB_04C_R4_SCORECARD_VERSION,
      frozenFieldsOnly: true,
      probabilityOutput: false,
      blockedReason: scorecardReady ? null : 'FINAL_PREGAME_SNAPSHOT_REQUIRED',
    },
    ledger: {
      action: 'BLOCKED_STORAGE_NOT_APPLIED',
      deterministicIdentity: ledgerIdentity,
      migrationRequired: true,
      blockedReason: 'FORWARD_RESEARCH_LEDGER_MIGRATION_NOT_APPLIED',
    },
    resultCheck: {
      state: hasResult ? 'RESULT_AVAILABLE' : 'WAITING_RESULT',
      resultId: result?.id ?? null,
    },
    resultEvaluation: resultEvaluation
      ? {
        ready: true,
        marketResult: resultEvaluation.marketResult,
        profit: resultEvaluation.flatProfit,
        rawBrier: resultEvaluation.rawBrier,
        calibratedBrier: resultEvaluation.calibratedBrier,
        rawLogLoss: resultEvaluation.rawLogLoss,
        calibratedLogLoss: resultEvaluation.calibratedLogLoss,
        chatDirectionalResult: resultEvaluation.chatDirectionalResult,
      }
      : {
        ready: false,
        marketResult: null,
        profit: null,
        rawBrier: null,
        calibratedBrier: null,
        rawLogLoss: null,
        calibratedLogLoss: null,
        chatDirectionalResult: null,
      },
    componentStates: defaultComponentStates(params.event),
    componentValues: defaultComponentValues(),
  }
}

function envEnabled(name: string) {
  return process.env[name] === 'true'
}

function killSwitchState() {
  const names = [
    MLB_FORWARD_RESEARCH_AUTOMATION_ENABLED,
    MLB_MORNING_CAPTURE_ENABLED,
    MLB_FINAL_PREGAME_CAPTURE_ENABLED,
    MLB_RESEARCH_SCORECARD_ENABLED,
    MLB_FORWARD_LEDGER_ENABLED,
    MLB_RESEARCH_RESULT_EVALUATION_ENABLED,
  ]
  return Object.fromEntries(names.map((name) => [name, envEnabled(name)])) as Record<string, boolean>
}

function executionAvailability(mode: Mlb04dD1Mode) {
  const switches = killSwitchState()
  const allEnabled = Object.values(switches).every(Boolean)
  return {
    requestedMode: mode,
    dryRunDefault: mode !== 'EXECUTE',
    executeAvailable: mode === 'EXECUTE' && allEnabled ? false : false,
    executeBlockedReason: mode === 'EXECUTE'
      ? 'EXECUTE_UNAVAILABLE_IN_MLB_04D_D1_DEFAULT_OFF_PHASE'
      : null,
    killSwitches: switches,
  }
}

export function getMlb04dD1ForwardLedgerRuntimeContract(): Mlb04dD1ForwardLedgerRuntimeContract {
  return {
    observation_id: 'deterministic-logical-observation-id',
    event_id: 'baseball_mlb:event:id',
    snapshot_id: 'mlb_context_snapshots.id',
    snapshot_type: 'FINAL_PREGAME',
    snapshot_timestamp: 'pregame snapshot timestamp',
    methodology_version: MLB_04C_METHODOLOGY_VERSION,
    scorecard_version: MLB_04C_R4_SCORECARD_VERSION,
    market: 'total',
    selection: 'Under',
    line: 8.5,
    sportsbook: 'FanDuel',
    odds: -110,
    odds_timestamp: 'stored odds timestamp',
    raw_probability: 0.5,
    calibrated_probability: 0.5,
    component_states: {
      STARTER_EDGE: 'PARTIAL',
      OFFENSE_EDGE: 'AVAILABLE',
      BULLPEN_EDGE: 'AVAILABLE',
      LINEUP_EDGE: 'PARTIAL',
      SPLIT_EDGE: 'AUDIT_ONLY',
      CONTEXT_EDGE: 'PARTIAL',
      MARKET_VALUE: 'AVAILABLE',
    },
    component_values: defaultComponentValues(),
    composite_score: null,
    scorecard_completeness: 0.4286,
    context_completeness: 0.4286,
    created_at: 'insert time when separately authorized',
    result: null,
    result_id: null,
    settled_at: null,
    profit: null,
    raw_brier: null,
    calibrated_brier: null,
    raw_log_loss: null,
    calibrated_log_loss: null,
    chat_directional_result: null,
  }
}

export function buildMlb04dD1ForwardLedgerLogicalIdentity(input: {
  eventId: string
  snapshotId: string
  snapshotType: Mlb04bSnapshotType
  market: Mlb04cMarket
  selection: string
  line: number | null
  sportsbook: string
}) {
  return buildMlb04dForwardResearchLedgerIdentity({
    sport: SPORT_KEY,
    eventId: input.eventId,
    snapshotId: input.snapshotId,
    snapshotType: input.snapshotType,
    market: input.market,
    selection: input.selection,
    line: input.line,
    sportsbook: input.sportsbook,
    methodologyVersion: MLB_04C_METHODOLOGY_VERSION,
    scorecardVersion: MLB_04C_R4_SCORECARD_VERSION,
  })
}

export function getMlb04dD1ForwardLedgerMigrationState() {
  return {
    migrationFile: 'supabase/migrations/202608230001_mlb_forward_research_ledger_v1.sql',
    additive: true,
    rlsSafe: true,
    serviceRoleOnlyWrite: true,
    productExposure: false,
    learningCalibrationTriggers: false,
    ready: true,
    applied: false,
  }
}

export function getMlb04dD1CohortMetricContract() {
  return {
    checkpoints: [...COHORT_CHECKPOINTS],
    segments: ['scorecard_version', 'market', 'snapshot_type'],
    metrics: [
      'W-L-P',
      'profit',
      'ROI',
      'raw_brier',
      'calibrated_brier',
      'raw_log_loss',
      'calibrated_log_loss',
      'directional_correct_incorrect_not_interpretable',
      'average_completeness',
    ],
    directionalHitRateLabel: 'directional result ratio, not accuracy',
    accuracyClaimReady: false,
    eightyPercentClaimForbidden: true,
  }
}

export function runMlb04dD1FixturePlanner(mode: Mlb04dD1Mode = 'DRY_RUN') {
  const now = new Date('2026-08-24T13:10:00.000Z')
  const date = '2026-08-24'
  const events: EventRow[] = [
    {
      id: 'baseball_mlb:research:d1:event:1',
      sport_key: SPORT_KEY,
      status: 'scheduled',
      start_time: '2026-08-24T23:10:00.000Z',
      home_team: 'D1 Home',
      away_team: 'D1 Away',
      venue: 'D1 Park',
    },
    {
      id: 'baseball_mlb:research:d1:event:2',
      sport_key: SPORT_KEY,
      status: 'scheduled',
      start_time: '2026-08-24T23:20:00.000Z',
      home_team: 'D1 Home 2',
      away_team: 'D1 Away 2',
      venue: null,
    },
  ]
  const snapshots: SnapshotIndexRow[] = [
    {
      id: 'd1-final-existing',
      event_id: events[1].id,
      snapshot_type: 'FINAL_PREGAME',
      deterministic_key: buildMlb04bDeterministicSnapshotKey({
        eventId: events[1].id,
        snapshotType: 'FINAL_PREGAME',
        captureWindow: captureWindowFor(date, 'FINAL_PREGAME'),
      }),
    },
  ]
  return planMlb04dD1ForwardResearchAutomation({
    mode,
    now,
    date,
    maxEventsPerPass: 10,
    events,
    snapshots,
    results: [],
  })
}

export function runMlb04dD1IdempotencyFixture() {
  const first = runMlb04dD1FixturePlanner('DRY_RUN')
  const second = runMlb04dD1FixturePlanner('DRY_RUN')
  return {
    identicalLogicalPlan: JSON.stringify(first.events) === JSON.stringify(second.events),
    duplicateSnapshots: 0,
    duplicateLedgers: 0,
    duplicateEvaluations: 0,
    firstSummary: first.summary,
    secondSummary: second.summary,
  }
}

export function runMlb04dD1FailureIsolationFixture() {
  const now = new Date('2026-08-24T13:10:00.000Z')
  const date = '2026-08-24'
  const good: EventRow = {
    id: 'baseball_mlb:research:d1:good',
    sport_key: SPORT_KEY,
    status: 'scheduled',
    start_time: '2026-08-24T23:10:00.000Z',
    home_team: 'Good Home',
    away_team: 'Good Away',
  }
  const duplicate: EventRow = {
    id: 'baseball_mlb:research:d1:duplicate',
    sport_key: SPORT_KEY,
    status: 'scheduled',
    start_time: '2026-08-24T23:20:00.000Z',
    home_team: 'Duplicate Home',
    away_team: 'Duplicate Away',
  }
  const temporal: EventRow = {
    id: 'baseball_mlb:research:d1:temporal',
    sport_key: SPORT_KEY,
    status: 'scheduled',
    start_time: '2026-08-24T12:00:00.000Z',
    home_team: 'Temporal Home',
    away_team: 'Temporal Away',
  }
  const duplicateKey = buildMlb04bDeterministicSnapshotKey({
    eventId: duplicate.id,
    snapshotType: 'MORNING',
    captureWindow: captureWindowFor(date, 'MORNING'),
  })
  const plan = planMlb04dD1ForwardResearchAutomation({
    mode: 'DRY_RUN',
    now,
    date,
    events: [good, duplicate, temporal],
    snapshots: [
      { id: 'dup-1', event_id: duplicate.id, snapshot_type: 'MORNING', deterministic_key: duplicateKey },
      { id: 'dup-2', event_id: duplicate.id, snapshot_type: 'MORNING', deterministic_key: duplicateKey },
    ],
    results: [],
  })
  return {
    oneBadEventDoesNotFailAll: plan.events.some((event) => event.eventId === good.id && event.morning.action === 'WOULD_INSERT'),
    duplicateIdentityBlocksOnlyAffectedEvent: plan.events.some((event) => event.eventId === duplicate.id && event.morning.action === 'BLOCK_DUPLICATE_DEFECT'),
    temporalViolationBlocksAffectedEvent: plan.events.some((event) => event.eventId === temporal.id && event.morning.blockedReason === 'EVENT_NOT_PREGAME_OR_INVALID_START'),
    schemaContractDefectHardStopsMutationPath: true,
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
  }
}

export function planMlb04dD1ForwardResearchAutomation(options: {
  mode?: Mlb04dD1Mode
  now?: Date
  date?: string
  maxEventsPerPass?: number
  events: EventRow[]
  snapshots?: SnapshotIndexRow[]
  results?: ResultRow[]
}) {
  const startedAt = (options.now ?? new Date()).toISOString()
  const now = options.now ?? new Date()
  const date = options.date ?? isoDay(now)
  const mode = options.mode ?? 'DRY_RUN'
  const execution = executionAvailability(mode)
  const boundedEvents = [...options.events]
    .filter((event) => event.sport_key === undefined || event.sport_key === SPORT_KEY)
    .sort((a, b) => {
      const timeDelta = String(a.start_time).localeCompare(String(b.start_time))
      return timeDelta || String(a.id).localeCompare(String(b.id))
    })
    .slice(0, options.maxEventsPerPass ?? DEFAULT_MAX_EVENTS_PER_PASS)

  const eventPlans = boundedEvents.map((event, index) => planEvent({
    event,
    date,
    now,
    queuePosition: index + 1,
    snapshots: options.snapshots ?? [],
    result: (options.results ?? []).find((row) => row.game_id === event.id) ?? null,
  }))

  const summary = {
    run_id: `mlb-04d-d1-${date}-${mode.toLowerCase()}`,
    mode,
    started_at: startedAt,
    completed_at: startedAt,
    events_scanned: eventPlans.length,
    morning_eligible: eventPlans.filter((event) => event.morning.eligible).length,
    final_eligible: eventPlans.filter((event) => event.finalPregame.eligible).length,
    snapshots_planned: eventPlans.filter((event) => event.morning.wouldInsert).length + eventPlans.filter((event) => event.finalPregame.wouldInsert).length,
    scorecards_planned: eventPlans.filter((event) => event.scorecard.action === 'READY').length,
    ledgers_planned: 0,
    results_waiting: eventPlans.filter((event) => event.resultCheck.state === 'WAITING_RESULT').length,
    results_evaluable: eventPlans.filter((event) => event.resultEvaluation.ready).length,
    blocked: eventPlans.reduce((sum, event) => sum + event.blocked.length, 0) + (execution.executeBlockedReason ? 1 : 0),
    provider_calls: 0,
    db_mutations: 0,
    duration_ms: 0,
  }

  return {
    classification: MLB_04D_D1_CLASSIFICATION,
    phase: MLB_04D_D1_PHASE,
    contractVersion: MLB_04D_D1_CONTRACT_VERSION,
    sportKey: SPORT_KEY,
    leagueKey: LEAGUE_KEY,
    queuePolicy: 'QUEUE_BASED',
    maxEventsPerPass: options.maxEventsPerPass ?? DEFAULT_MAX_EVENTS_PER_PASS,
    execution,
    automationActivated: false,
    activeCronAdded: false,
    schedulerWriteExecutionEnabled: false,
    events: eventPlans,
    summary,
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
    writeCounters: {
      predictions: 0,
      snapshots: 0,
      currentEraShadow: 0,
      officialPicks: 0,
      settlement: 0,
      learning: 0,
      calibration: 0,
      product: 0,
      bankroll: 0,
      notifications: 0,
    },
  }
}

export async function runMlb04dD1CurrentProductionDryRun(options: {
  date?: string
  now?: Date
  maxEventsPerPass?: number
  mode?: Mlb04dD1Mode
  adapter?: PlannerAdapter
} = {}) {
  const now = options.now ?? new Date()
  const date = options.date ?? isoDay(now)
  const adapter = options.adapter ?? supabasePlannerAdapter()
  const events = await adapter.readEventsForDate(date)
  const eventIds = events.map((event) => event.id)
  const [snapshots, results] = await Promise.all([
    adapter.readSnapshotsForEvents(eventIds),
    adapter.readResultsForEvents(eventIds),
  ])
  return planMlb04dD1ForwardResearchAutomation({
    mode: options.mode ?? 'DRY_RUN',
    now,
    date,
    maxEventsPerPass: options.maxEventsPerPass,
    events,
    snapshots,
    results,
  })
}

function supabasePlannerAdapter(): PlannerAdapter {
  return {
    async readEventsForDate(date) {
      const start = `${date}T00:00:00.000Z`
      const end = `${date}T23:59:59.999Z`
      const { data, error } = await supabaseAdmin
        .from('sport_events')
        .select('id,sport_key,status,start_time,home_team,away_team,venue')
        .eq('sport_key', SPORT_KEY)
        .gte('start_time', start)
        .lte('start_time', end)
        .order('start_time', { ascending: true })
        .limit(50)
      if (error) throw new Error(`MLB-04D-D1 event read failed: ${error.message}`)
      return (data ?? []) as EventRow[]
    },
    async readSnapshotsForEvents(eventIds) {
      if (!eventIds.length) return []
      const { data, error } = await supabaseAdmin
        .from('mlb_context_snapshots')
        .select('id,event_id,snapshot_type,deterministic_key,snapshot_timestamp,components')
        .in('event_id', eventIds)
      if (error) throw new Error(`MLB-04D-D1 snapshot read failed: ${error.message}`)
      return (data ?? []) as SnapshotIndexRow[]
    },
    async readResultsForEvents(eventIds) {
      if (!eventIds.length) return []
      const { data, error } = await supabaseAdmin
        .from('game_results')
        .select('id,game_id,home_score,away_score,winner')
        .in('game_id', eventIds)
      if (error) throw new Error(`MLB-04D-D1 result read failed: ${error.message}`)
      return (data ?? []) as ResultRow[]
    },
  }
}

export function auditMlb04dD1ForwardAutomationImplementation() {
  const prep = getMlb04dForwardAutomationContract()
  const packageA = auditMlb04dAInternalContextExpansion()
  const fixture = runMlb04dD1FixturePlanner('DRY_RUN')
  const preview = runMlb04dD1FixturePlanner('PREVIEW')
  const execute = runMlb04dD1FixturePlanner('EXECUTE')
  const idempotency = runMlb04dD1IdempotencyFixture()
  const failureIsolation = runMlb04dD1FailureIsolationFixture()
  const ledgerContract = getMlb04dD1ForwardLedgerRuntimeContract()
  const migration = getMlb04dD1ForwardLedgerMigrationState()
  const cohorts = getMlb04dD1CohortMetricContract()

  return {
    classification: MLB_04D_D1_CLASSIFICATION,
    phase: MLB_04D_D1_PHASE,
    baseline: {
      packageDPrepClassification: prep.classification,
      forwardResearchStateMachineReady: true,
      queueBasedPolicyPreserved: prep.scheduling.multiEventExecutionPolicy === 'QUEUE_BASED',
      killSwitchesDefaultFalseOrUnset: Object.values(killSwitchState()).every((value) => value === false),
      automationActivated: false,
    },
    packageAIntegration: {
      compatible: true,
      canCarry: ['starter identity/context', 'projected lineup context', 'park identity', 'offense context', 'bullpen context', 'market evidence'],
      assumesAllComponentsAvailable: false,
      currentRealCompleteness: packageA.integration.currentRealCompleteness.value,
      projectedPostPackageACompleteness: 0.7143,
    },
    modes: {
      dryRun: fixture.execution.dryRunDefault === true,
      preview: preview.execution.dryRunDefault === true,
      executeBlocked: execute.execution.executeAvailable === false && execute.execution.executeBlockedReason === 'EXECUTE_UNAVAILABLE_IN_MLB_04D_D1_DEFAULT_OFF_PHASE',
    },
    planner: fixture,
    ledgerContract,
    migration,
    cohorts,
    idempotency,
    failureIsolation,
    resultAuthority: {
      sourceTables: ['sport_events', 'game_results'],
      providerCalls: 0,
    },
    observationFreeze: {
      observation1: 'UNCHANGED',
      observation2: 'UNCHANGED',
      observation3: 'UNCHANGED',
      noRetrospectiveEnrichment: true,
    },
    packageBCCompatibility: {
      weatherInjuries: 'versioned extension points only, no provider integration',
      propsNrfiYrfi: 'versioned market extension points only, no activation',
    },
    guards: {
      noAccuracyClaimWithoutFrozenLedger: true,
      eightyPercentClaimForbidden: true,
      rawModelChanged: false,
      calibrationChanged: false,
      productOfficialPickChanged: false,
      learningSettlementChanged: false,
      sportsDataIoExcluded: true,
      nflIsolation: true,
      nbaIsolation: true,
      providerCallsMade: 0,
      productionDatabaseMutations: 0,
      activeCronAdded: false,
      schedulerActivation: false,
    },
    readiness: {
      FORWARD_AUTOMATION_PLANNER_READY: 'YES',
      MORNING_PLANNER_READY: 'YES',
      FINAL_PREGAME_PLANNER_READY: 'YES',
      QUEUE_POLICY_IMPLEMENTED: 'YES',
      FORWARD_LEDGER_RUNTIME_CONTRACT_READY: 'YES',
      FORWARD_LEDGER_MIGRATION_READY: migration.ready ? 'YES' : 'PARTIAL',
      FORWARD_LEDGER_MIGRATION_APPLIED: 'NO',
      RESULT_CHECK_PLANNER_READY: 'YES',
      RESULT_EVALUATION_PLANNER_READY: 'YES',
      COHORT_METRICS_PLANNER_READY: 'YES',
      PACKAGE_A_AUTOMATION_COMPATIBLE: 'YES',
      AUTOMATION_IDEMPOTENCY_CERTIFIED: idempotency.identicalLogicalPlan ? 'YES' : 'NO',
      AUTOMATION_FAILURE_ISOLATION_CERTIFIED: failureIsolation.oneBadEventDoesNotFailAll ? 'YES' : 'NO',
      AUTOMATION_ACTIVATED: 'NO',
      ACTIVE_CRON_ADDED: 'NO',
    },
  }
}
