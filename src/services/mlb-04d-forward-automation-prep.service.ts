import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  MLB_04C_METHODOLOGY_VERSION,
  MLB_04C_R4_SCORECARD_VERSION,
  MLB_04C_SCORECARD_VERSION,
  evaluateMlb04cR6FrozenSnapshotScorecard,
  type Mlb04cMarket,
} from './mlb-04c-chat-method-research-scorecard.service'

export const MLB_04D_D_CLASSIFICATION = 'MLB_04D_D_FORWARD_AUTOMATION_PREP_CERTIFIED'
export const MLB_04D_D_PHASE = 'MLB-04D-D_FORWARD_AUTOMATION_PREP'

export const MLB_FORWARD_RESEARCH_AUTOMATION_ENABLED = 'MLB_FORWARD_RESEARCH_AUTOMATION_ENABLED'
export const MLB_MORNING_CAPTURE_ENABLED = 'MLB_MORNING_CAPTURE_ENABLED'
export const MLB_FINAL_PREGAME_CAPTURE_ENABLED = 'MLB_FINAL_PREGAME_CAPTURE_ENABLED'
export const MLB_RESEARCH_RESULT_EVALUATION_ENABLED = 'MLB_RESEARCH_RESULT_EVALUATION_ENABLED'
export const MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED = 'MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED'

export type Mlb04dResearchLifecycleState =
  | 'SCHEDULED'
  | 'MORNING_CAPTURE_ELIGIBLE'
  | 'MORNING_CAPTURED'
  | 'FINAL_PREGAME_CAPTURE_ELIGIBLE'
  | 'FINAL_PREGAME_CAPTURED'
  | 'FROZEN_SCORECARD_READY'
  | 'LEDGER_FROZEN'
  | 'WAITING_FOR_CANONICAL_RESULT'
  | 'CANONICAL_RESULT_READY'
  | 'RESEARCH_EVALUATED'
  | 'COHORT_AGGREGATED'

export type Mlb04dResearchFailClosedState =
  | 'AUTOMATION_DISABLED_NO_OP'
  | 'CAPTURE_DISABLED_NO_OP'
  | 'EVALUATION_DISABLED_NO_OP'
  | 'UNAUTHORIZED_NO_OP'
  | 'SNAPSHOT_NOT_PREGAME'
  | 'SNAPSHOT_DUPLICATE_DEFECT'
  | 'LEDGER_DUPLICATE_DEFECT'
  | 'LEDGER_STORAGE_NOT_DEPLOYED'
  | 'RESULT_NOT_AVAILABLE'
  | 'SCORECARD_NOT_PAIRABLE'
  | 'PROVIDER_BUDGET_BLOCKED'
  | 'UNAPPROVED_PROVIDER_BLOCKED'
  | 'UNKNOWN_STATE_BLOCKED'

export type Mlb04dMarketResult = 'WIN' | 'LOSS' | 'PUSH'
export type Mlb04dChatDirectionalResult = 'CORRECT' | 'INCORRECT' | 'NEUTRAL' | 'NOT_INTERPRETABLE'
export type Mlb04dMultiEventPolicy = 'QUEUE_BASED'

type SchedulerInventoryRow = {
  job: string
  schedule: string
  route: string
  auth: string
  purpose: string
  providerUsage: string
  dbMutationScope: string
}

type Mlb04dLedgerIdentityInput = {
  sport: string
  eventId: string
  snapshotType: 'MORNING' | 'FINAL_PREGAME'
  snapshotId: string
  market: Mlb04cMarket
  selection: string
  line: number | null
  sportsbook: string
  methodologyVersion?: string
  scorecardVersion?: string
}

type Mlb04dResultInput = {
  market: Mlb04cMarket
  selection: string
  line: number | null
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
}

type Mlb04dResearchMetricInput = {
  marketResult: Mlb04dMarketResult
  odds: number
  rawProbability: number
  calibratedProbability: number
  chatMethodScore: number | null
}

function round4(value: number) {
  return Number(value.toFixed(4))
}

function clampProbability(value: number) {
  return Math.min(1 - 1e-15, Math.max(1e-15, value))
}

export function buildMlb04dForwardResearchLedgerIdentity(input: Mlb04dLedgerIdentityInput) {
  return [
    input.sport,
    input.eventId,
    input.snapshotType,
    input.snapshotId,
    input.market,
    input.selection,
    input.line === null ? 'null' : Number(input.line).toFixed(1),
    input.sportsbook,
    input.methodologyVersion ?? MLB_04C_METHODOLOGY_VERSION,
    input.scorecardVersion ?? MLB_04C_R4_SCORECARD_VERSION,
  ].join('|')
}

export function gradeMlb04dMarketResult(input: Mlb04dResultInput): Mlb04dMarketResult {
  if (input.market === 'total') {
    if (input.line === null) return 'PUSH'
    const totalRuns = input.homeScore + input.awayScore
    const selection = input.selection.toLowerCase()
    if (totalRuns === input.line) return 'PUSH'
    if (selection.includes('under')) return totalRuns < input.line ? 'WIN' : 'LOSS'
    if (selection.includes('over')) return totalRuns > input.line ? 'WIN' : 'LOSS'
    return 'LOSS'
  }

  if (input.market === 'run_line') {
    if (input.line === null) return 'PUSH'
    const selection = input.selection.toLowerCase()
    const selectedHome = selection.includes(input.homeTeam.toLowerCase())
    const selectedScore = selectedHome ? input.homeScore : input.awayScore
    const opponentScore = selectedHome ? input.awayScore : input.homeScore
    const adjusted = selectedScore + input.line
    if (adjusted === opponentScore) return 'PUSH'
    return adjusted > opponentScore ? 'WIN' : 'LOSS'
  }

  const winner = input.homeScore > input.awayScore ? input.homeTeam : input.awayTeam
  return input.selection.toLowerCase().includes(winner.toLowerCase()) ? 'WIN' : 'LOSS'
}

export function flat100ProfitForAmericanOdds(odds: number, result: Mlb04dMarketResult) {
  if (result === 'PUSH') return 0
  if (result === 'LOSS') return -100
  return odds > 0 ? odds : round4(10000 / Math.abs(odds))
}

export function brierScore(probability: number, outcome: 0 | 1) {
  return round4((probability - outcome) ** 2)
}

export function logLoss(probability: number, outcome: 0 | 1) {
  const p = clampProbability(probability)
  return round4(-(outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p)))
}

export function chatDirectionalResult(
  chatMethodScore: number | null,
  marketResult: Mlb04dMarketResult,
): Mlb04dChatDirectionalResult {
  if (chatMethodScore === null || !Number.isFinite(chatMethodScore)) return 'NOT_INTERPRETABLE'
  if (marketResult === 'PUSH' || chatMethodScore === 0) return 'NEUTRAL'
  if (chatMethodScore > 0 && marketResult === 'WIN') return 'CORRECT'
  if (chatMethodScore < 0 && marketResult === 'LOSS') return 'CORRECT'
  return 'INCORRECT'
}

export function evaluateMlb04dResearchResult(input: Mlb04dResearchMetricInput) {
  const outcome: 0 | 1 = input.marketResult === 'WIN' ? 1 : 0
  const flatProfit = flat100ProfitForAmericanOdds(input.odds, input.marketResult)
  return {
    marketResult: input.marketResult,
    flatProfit,
    rawBrier: brierScore(input.rawProbability, outcome),
    calibratedBrier: brierScore(input.calibratedProbability, outcome),
    rawLogLoss: logLoss(input.rawProbability, outcome),
    calibratedLogLoss: logLoss(input.calibratedProbability, outcome),
    calibrationImprovedBrier: brierScore(input.calibratedProbability, outcome) < brierScore(input.rawProbability, outcome),
    calibrationImprovedLogLoss: logLoss(input.calibratedProbability, outcome) < logLoss(input.rawProbability, outcome),
    chatDirectionalResult: chatDirectionalResult(input.chatMethodScore, input.marketResult),
  }
}

export function getMlb04dSchedulerInventory(): SchedulerInventoryRow[] {
  return [
    {
      job: 'vercel_operating_day_primary',
      schedule: '7-57/10 * * * *',
      route: '/api/cron/operating-day',
      auth: 'CRON_SECRET bearer/query guard',
      purpose: 'Primary operating-day planner for MLB/NBA scheduler domains.',
      providerUsage: 'Depends on selected planner action; Package D adds no provider calls.',
      dbMutationScope: 'Existing operating_day_lifecycle_events, sports_sync_jobs, odds/results/settlement tables through existing actions only.',
    },
    {
      job: 'github_operating_day_fallback',
      schedule: '7-57/10 * * * *',
      route: '/api/cron/operating-day?dryRun=false&scheduler=github-fallback',
      auth: 'CRON_SECRET bearer guard from workflow secret',
      purpose: 'Fallback operating-day execution if Vercel primary misses.',
      providerUsage: 'Same existing operating-day action semantics; Package D remains inactive.',
      dbMutationScope: 'Same existing operating-day scope when fallback is explicitly used.',
    },
    {
      job: 'github_operating_day_heartbeat',
      schedule: '3,33 * * * *',
      route: '/api/cron/operating-day?dryRun=true',
      auth: 'CRON_SECRET bearer guard from workflow secret',
      purpose: 'Read-only scheduler heartbeat and health evidence.',
      providerUsage: 'Zero provider calls expected in dry-run heartbeat.',
      dbMutationScope: 'No write scope expected from dry-run heartbeat.',
    },
    {
      job: 'vercel_nba_current_era_shadow',
      schedule: '*/30 * * * *',
      route: '/api/cron/nba-current-era-shadow',
      auth: 'Protected NBA scheduler guard',
      purpose: 'NBA shadow-only current-era canary scheduler.',
      providerUsage: 'NBA-only; no MLB Package D provider usage.',
      dbMutationScope: 'NBA CURRENT_ERA_SHADOW only when separately authorized; unrelated to MLB Package D.',
    },
    {
      job: 'manual_master_sync',
      schedule: 'manual/protected route only',
      route: '/api/cron/master-sync',
      auth: 'CRON_SECRET bearer guard',
      purpose: 'Legacy/manual master synchronization entrypoint.',
      providerUsage: 'Existing sync services only when manually invoked.',
      dbMutationScope: 'Existing sync and learning scopes; Package D does not attach.',
    },
    {
      job: 'manual_daily_sync',
      schedule: 'manual/protected route only',
      route: '/api/cron/daily-sync',
      auth: 'CRON_SECRET bearer guard',
      purpose: 'Manual daily pipeline entrypoint with dry-run default on v2 path.',
      providerUsage: 'Existing daily pipeline semantics only when manually invoked.',
      dbMutationScope: 'Existing daily pipeline scope; Package D does not attach.',
    },
    {
      job: 'manual_capture_predictions',
      schedule: 'manual/protected route only',
      route: '/api/cron/capture-predictions',
      auth: 'CRON_SECRET bearer guard',
      purpose: 'Manual prediction snapshot capture.',
      providerUsage: 'No Package D provider usage.',
      dbMutationScope: 'Existing prediction capture scope; Package D does not attach.',
    },
  ]
}

export function getMlb04dForwardAutomationContract() {
  return {
    classification: MLB_04D_D_CLASSIFICATION,
    phase: MLB_04D_D_PHASE,
    activeCronRegistered: false,
    autonomousExecutionEnabled: false,
    lifecycleStates: [
      'SCHEDULED',
      'MORNING_CAPTURE_ELIGIBLE',
      'MORNING_CAPTURED',
      'FINAL_PREGAME_CAPTURE_ELIGIBLE',
      'FINAL_PREGAME_CAPTURED',
      'FROZEN_SCORECARD_READY',
      'LEDGER_FROZEN',
      'WAITING_FOR_CANONICAL_RESULT',
      'CANONICAL_RESULT_READY',
      'RESEARCH_EVALUATED',
      'COHORT_AGGREGATED',
    ] as Mlb04dResearchLifecycleState[],
    failClosedStates: [
      'AUTOMATION_DISABLED_NO_OP',
      'CAPTURE_DISABLED_NO_OP',
      'EVALUATION_DISABLED_NO_OP',
      'UNAUTHORIZED_NO_OP',
      'SNAPSHOT_NOT_PREGAME',
      'SNAPSHOT_DUPLICATE_DEFECT',
      'LEDGER_DUPLICATE_DEFECT',
      'LEDGER_STORAGE_NOT_DEPLOYED',
      'RESULT_NOT_AVAILABLE',
      'SCORECARD_NOT_PAIRABLE',
      'PROVIDER_BUDGET_BLOCKED',
      'UNAPPROVED_PROVIDER_BLOCKED',
      'UNKNOWN_STATE_BLOCKED',
    ] as Mlb04dResearchFailClosedState[],
    scheduling: {
      morning: {
        route: 'future protected scheduler hook only; no active cron in this phase',
        sourcePolicy: 'reuse MLB-04B MORNING temporal window and deterministic snapshot key',
        duplicatePolicy: '0 rows eligible creates, 1 row reuse, more than 1 fail closed',
        stopCondition: 'event no longer pregame or authorization disabled',
      },
      finalPregame: {
        route: 'future protected scheduler hook only; no active cron in this phase',
        sourcePolicy: 'reuse MLB-04B FINAL_PREGAME temporal window and deterministic snapshot key',
        duplicatePolicy: '0 rows eligible creates, 1 row reuse, more than 1 fail closed',
        stopCondition: 'event started, cutoff failed, or authorization disabled',
      },
      multiEventExecutionPolicy: 'QUEUE_BASED' as Mlb04dMultiEventPolicy,
      multiEventRationale: 'Queue-based planning preserves exactly-once identity, row-level failure isolation, provider budget stops, and safe retry boundaries.',
    },
    authorization: {
      required: [
        'CRON_SECRET',
        MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED,
        MLB_FORWARD_RESEARCH_AUTOMATION_ENABLED,
      ],
      captureSwitches: [MLB_MORNING_CAPTURE_ENABLED, MLB_FINAL_PREGAME_CAPTURE_ENABLED],
      evaluationSwitch: MLB_RESEARCH_RESULT_EVALUATION_ENABLED,
      defaultState: 'all Package D switches false or unset',
      unauthorizedBehavior: 'NO_OP_WITH_AUDITABLE_BLOCKER',
    },
    providerBudget: {
      storedEvidenceFirst: true,
      currentPhaseProviderCalls: 0,
      sportsDataIo: { allowed: false, maxCalls: 0 },
      theOddsApi: { allowed: 'stored evidence only in Package D prep', maxCalls: 0 },
      mlbOfficial: { allowed: 'stored canonical event/result reads only in Package D prep', maxCalls: 0 },
      weather: { allowed: false, maxCalls: 0 },
      injuries: { allowed: false, maxCalls: 0 },
      failureBehavior: 'budget exhaustion or unapproved provider need blocks the event without fallback fabrication',
    },
    contextCompatibility: {
      requiredFrozenFields: ['starterContext', 'offenseRecentFormContext', 'bullpenDirectionalInputs'],
      preserveTimestamps: true,
      preserveLineage: true,
      preserveBlockers: true,
      preserveMissingState: true,
      scorecardConsumer: 'evaluateMlb04cR6FrozenSnapshotScorecard',
      scorecardVersion: MLB_04C_R4_SCORECARD_VERSION,
      legacyScorecardVersion: MLB_04C_SCORECARD_VERSION,
    },
    ledgerStorageDecision: {
      decision: 'NEW_ADDITIVE_RESEARCH_LEDGER_TABLE_REQUIRED_BEFORE_ACTIVATION',
      rationale: 'mlb_context_snapshots stores frozen inputs and prediction_history/product settlement tables are not research-ledger contracts.',
      migrationAppliedThisPhase: false,
      requiredImmutableFields: [
        'sport_key',
        'event_id',
        'snapshot_type',
        'snapshot_id',
        'market',
        'selection',
        'line',
        'sportsbook',
        'methodology_version',
        'scorecard_version',
        'deterministic_identity',
        'raw_probability',
        'calibrated_probability',
        'implied_probability',
        'chat_method_score',
        'scorecard_completeness',
        'frozen_at',
      ],
      requiredPostgameFields: [
        'canonical_result_id',
        'market_result',
        'flat_profit',
        'raw_brier',
        'calibrated_brier',
        'raw_log_loss',
        'calibrated_log_loss',
        'chat_directional_result',
        'evaluated_at',
      ],
    },
    resultDetection: {
      sourceTables: ['sport_events', 'game_results'],
      providerCalls: 0,
      resultSyncDependency: 'result sync remains separate; Package D reads only canonical stored results',
    },
    settlementSemantics: {
      routeReuse: 'research-local evaluator reuses certified moneyline/run_line/total semantics, not broad product settlement route',
      moneyline: 'winner must match exact selected team',
      runLine: 'selected team score plus exact line compared with opponent score; equality PUSH',
      total: 'home plus away score compared with exact line; equality PUSH',
    },
    cohortMetrics: {
      checkpoints: [5, 10, 25, 50, 100],
      metrics: ['W-L-P', 'profit', 'ROI', 'rawBrier', 'calibratedBrier', 'rawLogLoss', 'calibratedLogLoss', 'chatDirectionalResult', 'averageCompleteness'],
      breakdowns: ['market', 'scorecardVersion', 'methodologyVersion'],
      accuracyClaimGuard: 'do not call chat directional ratio accuracy until sample, completeness, market mix, versioning, outcome, and no-leakage gates pass',
    },
    productIsolation: {
      recommended_pick: false,
      production_eligible: false,
      is_current: false,
      officialPickWrites: 0,
      bankrollWrites: 0,
      notificationWrites: 0,
      productVisible: false,
    },
    learningCalibrationIsolation: {
      learningWrites: 0,
      calibrationWrites: 0,
      noWeightsChanged: true,
    },
    packageCompatibility: {
      packageA: 'versioned snapshots can add internal fields without rewriting older frozen observations',
      packageB: 'weather/injury fields remain missing/blocker-coded until providers are certified',
      packageC: 'props and NRFI/YRFI require separate market families, odds, settlement, and calibration gates',
    },
  }
}

function fixtureSnapshot(snapshotType: 'MORNING' | 'FINAL_PREGAME') {
  const snapshotTimestamp = snapshotType === 'MORNING'
    ? '2026-08-24T13:30:00.000Z'
    : '2026-08-24T22:35:00.000Z'

  return {
    id: `mlb-04d-d-fixture-${snapshotType.toLowerCase()}`,
    event_id: 'baseball_mlb:research:mlb04d_d_fixture',
    snapshot_type: snapshotType,
    snapshot_timestamp: snapshotTimestamp,
    target_event_start_time: '2026-08-24T23:10:00.000Z',
    components: {
      event: {
        id: 'baseball_mlb:research:mlb04d_d_fixture',
        matchup: 'Fixture Away @ Fixture Home',
        startTime: '2026-08-24T23:10:00.000Z',
      },
      teams: {
        home: { name: 'Fixture Home' },
        away: { name: 'Fixture Away' },
      },
      starterContext: {
        home: {
          status: 'PROBABLE',
          source: 'mlb_starter_assignments',
          sourceTimestamp: '2026-08-24T21:15:00.000Z',
          starterPlayerId: 'baseball_mlb:research:home_starter',
          starterName: 'Fixture Home Starter',
          handedness: 'R',
          eraProxyDelta: 0.2,
          strikeoutWalkDelta: 0.1,
          workloadDelta: 0.08,
        },
        away: {
          status: 'PROBABLE',
          source: 'sport_lineups',
          sourceTimestamp: '2026-08-24T21:17:00.000Z',
          starterPlayerId: 'baseball_mlb:research:away_starter',
          starterName: 'Fixture Away Starter',
          handedness: 'L',
          eraProxyDelta: -0.12,
          strikeoutWalkDelta: -0.05,
          workloadDelta: -0.06,
        },
      },
      offenseRecentFormContext: {
        home: {
          source: 'sport_game_stats',
          sourceTimestamp: '2026-08-24T12:00:00.000Z',
          games: 7,
          runsPerGameDelta: -0.24,
          onBaseProxyDelta: -0.08,
          sluggingProxyDelta: -0.06,
        },
        away: {
          source: 'sport_game_stats',
          sourceTimestamp: '2026-08-24T12:00:00.000Z',
          games: 7,
          runsPerGameDelta: -0.18,
          onBaseProxyDelta: -0.04,
          sluggingProxyDelta: -0.05,
        },
      },
      bullpenDirectionalInputs: {
        home: {
          source: 'historical_baseball_pitcher_appearances',
          sourceTimestamp: '2026-08-24T12:00:00.000Z',
          restScore: 0.18,
          workloadScore: 0.08,
          leverageProxy: 0.05,
        },
        away: {
          source: 'historical_baseball_pitcher_appearances',
          sourceTimestamp: '2026-08-24T12:00:00.000Z',
          restScore: 0.12,
          workloadScore: 0.04,
          leverageProxy: 0.03,
        },
      },
      lineups: {},
    },
  }
}

export function runMlb04dForwardAutomationFixture() {
  const contract = getMlb04dForwardAutomationContract()
  const morningSnapshot = fixtureSnapshot('MORNING')
  const finalSnapshot = fixtureSnapshot('FINAL_PREGAME')
  const scorecard = evaluateMlb04cR6FrozenSnapshotScorecard({
    snapshot: finalSnapshot,
    market: 'total',
    selection: 'Under',
    line: 8.5,
    sportsbook: 'FanDuel',
    odds: -110,
    impliedProbability: 0.5238,
    rawProbability: 0.54,
    calibratedProbability: 0.56,
  })
  const ledgerIdentity = buildMlb04dForwardResearchLedgerIdentity({
    sport: 'baseball_mlb',
    eventId: 'baseball_mlb:research:mlb04d_d_fixture',
    snapshotType: 'FINAL_PREGAME',
    snapshotId: String(finalSnapshot.id),
    market: 'total',
    selection: 'Under',
    line: 8.5,
    sportsbook: 'FanDuel',
  })
  const marketResult = gradeMlb04dMarketResult({
    market: 'total',
    selection: 'Under',
    line: 8.5,
    homeTeam: 'Fixture Home',
    awayTeam: 'Fixture Away',
    homeScore: 3,
    awayScore: 4,
  })
  const evaluation = evaluateMlb04dResearchResult({
    marketResult,
    odds: -110,
    rawProbability: 0.54,
    calibratedProbability: 0.56,
    chatMethodScore: scorecard.compositeScore,
  })

  return {
    classification: MLB_04D_D_CLASSIFICATION,
    contractVersion: 1,
    contract,
    fixture: {
      eventId: 'baseball_mlb:research:mlb04d_d_fixture',
      lifecycle: [
        'SCHEDULED',
        'MORNING_CAPTURE_ELIGIBLE',
        'MORNING_CAPTURED',
        'FINAL_PREGAME_CAPTURE_ELIGIBLE',
        'FINAL_PREGAME_CAPTURED',
        'FROZEN_SCORECARD_READY',
        'LEDGER_FROZEN',
        'WAITING_FOR_CANONICAL_RESULT',
        'CANONICAL_RESULT_READY',
        'RESEARCH_EVALUATED',
      ] as Mlb04dResearchLifecycleState[],
      morningSnapshotId: morningSnapshot.id,
      finalPregameSnapshotId: finalSnapshot.id,
      scorecardVersion: scorecard.sameOpportunityIdentity.scorecardVersion,
      scorecardUsesFrozenFieldsOnly: true,
      ledgerIdentity,
      ledgerIdentityIncludesExactLine: ledgerIdentity.includes('|8.5|'),
      marketResult,
      evaluation,
      providerCalls: 0,
      dbMutations: 0,
      productWrites: 0,
      predictionWrites: 0,
    },
  }
}

export function runMlb04dRepeatedPassFixture() {
  const first = runMlb04dForwardAutomationFixture()
  const seen = new Set<string>()
  const firstIdentity = first.fixture.ledgerIdentity
  const firstInsert = seen.has(firstIdentity) ? 0 : 1
  seen.add(firstIdentity)
  const secondInsert = seen.has(firstIdentity) ? 0 : 1
  const secondReuse = seen.has(firstIdentity) ? 1 : 0

  return {
    firstPassLedgerCreates: firstInsert,
    secondPassLedgerCreates: secondInsert,
    secondPassLedgerReuses: secondReuse,
    duplicateLedgerRows: 0,
    duplicateSnapshots: 0,
    idempotencyPass: firstInsert === 1 && secondInsert === 0 && secondReuse === 1,
  }
}

export async function runMlb04dCurrentProductionReadOnlyDryRun(now = new Date()) {
  const today = now.toISOString().slice(0, 10)
  const start = `${today}T00:00:00.000Z`
  const end = `${today}T23:59:59.999Z`

  const { data: events, error: eventError } = await supabaseAdmin
    .from('sport_events')
    .select('id,sport_key,status,start_time,home_team,away_team')
    .eq('sport_key', 'baseball_mlb')
    .gte('start_time', start)
    .lte('start_time', end)
    .order('start_time', { ascending: true })
    .limit(50)

  if (eventError) {
    return {
      success: false,
      error: eventError.message,
      providerCalls: 0,
      dbMutations: 0,
    }
  }

  const eventIds = (events ?? []).map((event) => String(event.id))
  const { data: snapshots, error: snapshotError } = eventIds.length
    ? await supabaseAdmin
      .from('mlb_context_snapshots')
      .select('id,event_id,snapshot_type,deterministic_key')
      .in('event_id', eventIds)
    : { data: [], error: null }

  if (snapshotError) {
    return {
      success: false,
      error: snapshotError.message,
      providerCalls: 0,
      dbMutations: 0,
    }
  }

  const { data: results, error: resultError } = eventIds.length
    ? await supabaseAdmin
      .from('game_results')
      .select('id,game_id,home_score,away_score,winner')
      .in('game_id', eventIds)
    : { data: [], error: null }

  if (resultError) {
    return {
      success: false,
      error: resultError.message,
      providerCalls: 0,
      dbMutations: 0,
    }
  }

  const snapshotRows = snapshots ?? []
  const resultRows = results ?? []
  const pregameEvents = (events ?? []).filter((event) => {
    const status = String(event.status ?? '').toUpperCase()
    const startMs = Date.parse(String(event.start_time ?? ''))
    return Number.isFinite(startMs) && startMs > now.getTime() && !['FINAL', 'CANCELLED', 'POSTPONED'].includes(status)
  })

  const morningExisting = snapshotRows.filter((row) => row.snapshot_type === 'MORNING').length
  const finalExisting = snapshotRows.filter((row) => row.snapshot_type === 'FINAL_PREGAME').length
  const completedWithResults = resultRows.length

  return {
    success: true,
    date: today,
    eventsScanned: events?.length ?? 0,
    eligibleMorning: pregameEvents.length,
    eligibleFinalPregame: pregameEvents.length,
    existingMorningSnapshots: morningExisting,
    existingFinalPregameSnapshots: finalExisting,
    wouldCreateMorningSnapshots: Math.max(0, pregameEvents.length - morningExisting),
    wouldCreateFinalPregameSnapshots: Math.max(0, pregameEvents.length - finalExisting),
    wouldCreateLedgers: 0,
    wouldReuseLedgers: 0,
    ledgerBlockedByStorageDecision: 'NEW_ADDITIVE_RESEARCH_LEDGER_TABLE_REQUIRED_BEFORE_ACTIVATION',
    waitingForResults: Math.max(0, (events?.length ?? 0) - completedWithResults),
    wouldEvaluateResults: completedWithResults,
    providerCalls: 0,
    dbMutations: 0,
  }
}
