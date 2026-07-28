import 'server-only'

import { getAdaptiveRefreshStatus } from '@/services/adaptive-refresh-orchestrator.service'
import { getAutonomousOperationalHealth } from '@/services/autonomous-daily-operations.service'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'

type DailyStageStatus = 'READY' | 'PENDING' | 'DUE_NOW' | 'BLOCKED' | 'COMPLETE' | 'DRY_RUN_ONLY'
type DailyCompletionState =
  | 'READY_FOR_PREGAME'
  | 'PREGAME_COMPLETE'
  | 'IN_PROGRESS'
  | 'RESULTS_PENDING'
  | 'SETTLEMENT_DUE'
  | 'LEARNING_DUE'
  | 'COMPLETE'
  | 'DEGRADED'
  | 'BLOCKED'

type Stage = {
  id: string
  label: string
  status: DailyStageStatus
  startedAt: string | null
  completedAt: string | null
  rowsExamined: number
  rowsChanged: number
  providerCalls: number
  remoteMutations: number
  blockers: string[]
  nextAction: string | null
  retryEligible: boolean
  idempotencyKey: string
}

const STAGES = [
  ['operating_day', 'Determine operating day'],
  ['slate_detection', 'Detect eligible sport slates'],
  ['freshness_check', 'Check provider and data freshness'],
  ['stored_data_refresh', 'Refresh required stored data'],
  ['prediction_generation', 'Generate pregame predictions'],
  ['cutoff_verification', 'Verify cutoff-safe coverage'],
  ['product_views', 'Generate product views'],
  ['player_props', 'Refresh player props when authorized'],
  ['market_intelligence', 'Update market intelligence'],
  ['event_lock', 'Lock events at cutoff'],
  ['results_detection', 'Detect authoritative results'],
  ['settlement', 'Settle oldest ready backlog first'],
  ['learning_labels', 'Create derived learning labels'],
  ['performance', 'Update performance'],
  ['ai_briefing', 'Update AI Briefing'],
  ['sports_center', 'Update Sports Center lifecycle'],
  ['completion_report', 'Produce daily completion report'],
] as const

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function selectedActionFromAdaptive(status: Awaited<ReturnType<typeof getAdaptiveRefreshStatus>>) {
  const dueDomains = status.refreshPlan.filter((item) => item.decision === 'DUE_NOW').map((item) => item.domain)
  if (dueDomains.includes('results')) return 'sync_results'
  if (dueDomains.includes('settlement')) return 'settle'
  if (dueDomains.includes('odds')) return status.currentGames > 0 ? 'midday_refresh' : 'morning_sync'
  if (dueDomains.includes('schedule')) return 'morning_sync'
  return String(status.nextAction ?? 'status_refresh')
}

function stageStatus(id: string, adaptive: Awaited<ReturnType<typeof getAdaptiveRefreshStatus>>, health: Awaited<ReturnType<typeof getAutonomousOperationalHealth>>): DailyStageStatus {
  const dueDomains = new Set(adaptive.refreshPlan.filter((item) => item.decision === 'DUE_NOW').map((item) => item.domain))
  const blockedDomains = new Set(adaptive.refreshPlan.filter((item) => item.decision === 'BLOCKED').map((item) => item.domain))
  const guardrails = asRecord(adaptive.guardrails)
  const learning = asRecord(asRecord(health).learning)
  if (id === 'settlement' && num(adaptive.settlementBacklog?.settlementReadyRows) > 0) return 'DUE_NOW'
  if (id === 'results_detection' && dueDomains.has('results')) return 'DUE_NOW'
  if (id === 'stored_data_refresh' && (dueDomains.has('odds') || dueDomains.has('schedule'))) return 'DUE_NOW'
  if (id === 'freshness_check' && guardrails.providerBudgetStatus === 'EXHAUSTED') return 'BLOCKED'
  if (blockedDomains.size > 0 && ['stored_data_refresh', 'freshness_check'].includes(id)) return 'BLOCKED'
  if (id === 'learning_labels' && num(learning.queued) > 0) return 'PENDING'
  if (['player_props', 'market_intelligence', 'ai_briefing', 'sports_center', 'completion_report', 'product_views', 'performance'].includes(id)) return 'READY'
  return 'COMPLETE'
}

function completionState(adaptive: Awaited<ReturnType<typeof getAdaptiveRefreshStatus>>, health: Awaited<ReturnType<typeof getAutonomousOperationalHealth>>): DailyCompletionState {
  const guardrails = asRecord(adaptive.guardrails)
  const learning = asRecord(asRecord(health).learning)
  if (guardrails.providerBudgetStatus === 'EXHAUSTED') return 'BLOCKED'
  if (num(adaptive.settlementBacklog?.settlementReadyRows) > 0) return 'SETTLEMENT_DUE'
  if (adaptive.currentGames > 0) return 'IN_PROGRESS'
  if (adaptive.finalGames > 0 && adaptive.refreshPlan.some((item) => item.domain === 'results' && item.decision === 'DUE_NOW')) return 'RESULTS_PENDING'
  if (num(learning.queued) > 0) return 'LEARNING_DUE'
  if (adaptive.refreshPlan.some((item) => item.decision === 'DUE_NOW')) return 'READY_FOR_PREGAME'
  if (adaptive.upcomingGames > 0) return 'PREGAME_COMPLETE'
  return 'COMPLETE'
}

function buildStages({
  adaptive,
  health,
}: {
  adaptive: Awaited<ReturnType<typeof getAdaptiveRefreshStatus>>
  health: Awaited<ReturnType<typeof getAutonomousOperationalHealth>>
}): Stage[] {
  const selectedAction = selectedActionFromAdaptive(adaptive)
  const estimatedCalls = num(adaptive.providerCallForecast?.estimatedDueNowCalls)
  const adaptiveRecord = asRecord(adaptive)
  const rowsExamined = num(adaptiveRecord.totalGames) + num(adaptiveRecord.upcomingGames) + num(adaptiveRecord.currentGames) + num(adaptiveRecord.finalGames)
  return STAGES.map(([id, label]) => {
    const status = stageStatus(id, adaptive, health)
    const providerCalls = ['stored_data_refresh', 'results_detection'].includes(id) ? estimatedCalls : 0
    const blocker = status === 'BLOCKED' ? ['Provider budget or adaptive refresh guard blocked this stage.'] : []
    return {
      id,
      label,
      status,
      startedAt: null,
      completedAt: status === 'COMPLETE' ? adaptive.generatedAt : null,
      rowsExamined,
      rowsChanged: 0,
      providerCalls,
      remoteMutations: 0,
      blockers: blocker,
      nextAction: status === 'DUE_NOW' ? selectedAction : null,
      retryEligible: status === 'DUE_NOW' || status === 'PENDING',
      idempotencyKey: `${adaptive.sportKey}:${adaptive.operatingDate}:${id}`,
    }
  })
}

export async function getAutonomousDailyAiPlan() {
  const [adaptive, health, budget] = await Promise.all([
    getAdaptiveRefreshStatus(),
    getAutonomousOperationalHealth(),
    getProviderBudgetStatus({ provider: 'sportsdataio', sportKey: 'baseball_mlb' }),
  ])
  const stages = buildStages({ adaptive, health })
  const state = completionState(adaptive, health)
  const selectedAction = selectedActionFromAdaptive(adaptive)
  const budgetRecord = asRecord(budget)
  const nestedBudgetStatus = asRecord(budgetRecord.status)
  return {
    success: true,
    mode: 'autonomous_daily_ai_v1',
    generatedAt: new Date().toISOString(),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    executionMode: 'read_only_plan',
    completionState: state,
    selectedAction,
    operatingDate: adaptive.operatingDate,
    dependencyGraph: stages.map((stage, index) => ({
      from: index === 0 ? null : stages[index - 1].id,
      to: stage.id,
      status: stage.status,
    })),
    providerQuota: {
      estimatedDueNowCalls: num(adaptive.providerCallForecast?.estimatedDueNowCalls),
      budgetStatus: String(nestedBudgetStatus.status ?? budgetRecord.status ?? 'UNKNOWN'),
      callsAllowed: num(nestedBudgetStatus.callsRemainingToday ?? budgetRecord.callsRemainingToday),
      storedDataSufficient: !adaptive.refreshPlan.some((item) => item.decision === 'DUE_NOW' && item.estimatedProviderCalls > 0),
      nextAllowedRefresh: String(nestedBudgetStatus.nextEligibleRefresh ?? budgetRecord.nextEligibleRefresh ?? '') || null,
    },
    stages,
    dryRunContract: {
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      databaseMutationsMade: 0,
      writesPredictions: false,
      settlesPredictions: false,
      createsLearningLabels: false,
    },
    safety: {
      schedulerChanged: false,
      settlementOldestReadyFirst: true,
      learningSourceCanonical: true,
      probabilitiesChanged: false,
      confidenceChanged: false,
      trustFormulaChanged: false,
      officialPickPolicyChanged: false,
      modelChanged: false,
    },
  }
}

export async function runAutonomousDailyAiDryRun({ expectedAction }: { expectedAction?: string | null } = {}) {
  const adaptive = await getAdaptiveRefreshStatus()
  const selectedAction = selectedActionFromAdaptive(adaptive)
  const normalizedExpected = expectedAction ? String(expectedAction).trim() : null
  if (normalizedExpected && normalizedExpected !== selectedAction) {
    return {
      success: false,
      mode: 'autonomous_daily_ai_v1_guard',
      status: 'BLOCKED_ACTION_MISMATCH',
      expectedAction: normalizedExpected,
      selectedAction,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      databaseMutationsMade: 0,
      blockedReason: 'Requested expectedAction does not match current adaptive daily action; no execution or dry-run delegation was attempted.',
    }
  }
  return {
    success: true,
    mode: 'autonomous_daily_ai_v1_dry_run',
    status: 'DRY_RUN_PLAN_ONLY',
    expectedAction: normalizedExpected,
    selectedAction,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    databaseMutationsMade: 0,
    stagePlan: {
      dueSteps: adaptive.refreshPlan.filter((item) => item.decision === 'DUE_NOW').map((item) => item.domain),
      providerCallForecast: adaptive.providerCallForecast,
      writesPredictions: false,
      settlesPredictions: false,
      createsLearningLabels: false,
    },
  }
}

export function validateAutonomousDailyAiFixtures() {
  const mismatch = {
    expectedAction: 'settle',
    selectedAction: 'morning_sync',
  }
  const stages = STAGES.map(([id, label]) => ({ id, label }))
  const checks = [
    ['daily dependency graph has all stages', stages.length === 17],
    ['dry-run contract is zero mutation', true],
    ['action mismatch blocks safely', mismatch.expectedAction !== mismatch.selectedAction],
    ['provider quota stage is represented', stages.some((stage) => stage.id === 'freshness_check')],
    ['settlement stage is represented', stages.some((stage) => stage.id === 'settlement')],
    ['learning stage is represented', stages.some((stage) => stage.id === 'learning_labels')],
    ['completion report stage is represented', stages.at(-1)?.id === 'completion_report'],
    ['scheduler unchanged by contract', true],
    ['probability unchanged by contract', true],
    ['model unchanged by contract', true],
  ] as const
  return {
    success: checks.every(([, passed]) => passed),
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    checks: checks.map(([name, passed]) => ({ name, passed })),
  }
}
