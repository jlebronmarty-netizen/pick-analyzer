import 'server-only'

import fs from 'node:fs'
import path from 'node:path'

import { getEventLifecycleState } from '@/services/event-lifecycle-state.service'
import { getEventRefreshPlan } from '@/services/event-refresh-planner.service'
import { getOperationsHealth } from '@/services/operations-health.service'
import { getProviderBudgetStatus } from '@/services/provider-budget.service'
import { getMultiSportDataReadiness } from '@/services/multi-sport-data-readiness.service'

const DOCUMENTATION_VERSION = 'mission_control_v1'
const PROGRAM_VERSION = 'pick_analyzer_v2_mission_control_v1'
const BASELINE_COMMIT = 'ddc79d7b4a5efa5068ff1e63bb68d95d84100e67'
const MC00_RUNTIME_COMMIT = '868eb0c4bc712b7c193b7a2001b37494517641e0'
const SPORT_KEY = 'baseball_mlb'
const PROVIDER = 'sportsdataio'

export type MissionCategory =
  | 'OPERATIONAL_READINESS'
  | 'MULTI_SPORT_DATA'
  | 'MULTI_SPORT_PREDICTION'
  | 'SETTLEMENT_AND_LEARNING'
  | 'PERFORMANCE_INTELLIGENCE'
  | 'DECISION_CORE_EVOLUTION'
  | 'MARKET_EXPANSION'
  | 'PRODUCT_EXPERIENCE'
  | 'AUTOMATION'
  | 'PROVIDER_INTEGRATION'
  | 'CERTIFICATION'
  | 'DOCUMENTATION'
  | 'TECHNICAL_DEBT'
  | 'EXTERNAL_DEPENDENCY'

export type MissionState =
  | 'PLANNED'
  | 'READY'
  | 'ACTIVE'
  | 'PAUSED'
  | 'BLOCKED'
  | 'CONDITIONAL_PASS'
  | 'LOCALLY_COMPLETE'
  | 'DEPLOYED'
  | 'PRODUCTION_CERTIFIED'
  | 'SUPERSEDED'
  | 'CANCELLED'
  | 'UNKNOWN'

export type MissionPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4'
export type MissionMode = 'MANUAL_ONLY' | 'AGENT_ASSISTED' | 'AUTONOMOUS_ELIGIBLE' | 'AUTONOMOUS_ACTIVE' | 'EXTERNAL_WAIT' | 'READ_ONLY'
export type ReadinessStatus = 'NOT_READY' | 'CONDITIONAL' | 'READY' | 'ACTIVE' | 'PAUSED' | 'BLOCKED' | 'COMPLETE'
export type StopConditionType = 'HARD_STOP' | 'MISSION_BLOCK' | 'SPORT_BLOCK' | 'PROVIDER_BLOCK' | 'EXTERNAL_WAIT' | 'HUMAN_APPROVAL'
export type SportMaturity =
  | 'NOT_CONFIGURED'
  | 'PLANNED'
  | 'DATA_FOUNDATION'
  | 'DATA_READY'
  | 'SHADOW'
  | 'LEARNING'
  | 'LIMITED'
  | 'ACTIVE'
  | 'PRODUCTION'
  | 'CERTIFIED'
  | 'BLOCKED'
  | 'UNKNOWN'

type SafeResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: string }

type Mission = {
  id: string
  title: string
  category: MissionCategory
  state: MissionState
  priority: MissionPriority
  mode: MissionMode
  readiness: ReadinessStatus
  owner: string
  scope: string
  nextAction: string
  dependencies: string[]
  blockers: string[]
  evidence: string[]
  stopConditions: string[]
  canStartAutomatically: boolean
}

type HealthDomain = {
  domain: string
  status: ReadinessStatus
  summary: string
  evidence: string[]
}

type SportReadiness = {
  sport: string
  maturity: SportMaturity
  readiness: ReadinessStatus
  currentStage: string
  nextStage: string
  blockers: string[]
  evidence: string[]
}

type ProviderReadiness = {
  provider: string
  sportKey: string
  readiness: ReadinessStatus
  activeScope: string
  reserveProtected: boolean
  providerCallsMadeByMissionControl: 0
  remoteMutationsMadeByMissionControl: 0
  evidence: string[]
}

type StopCondition = {
  id: string
  type: StopConditionType
  title: string
  action: string
  evidenceRequiredToResume: string
}

function runtimeCommit() {
  return process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? BASELINE_COMMIT
}

async function safe<T>(label: string, fn: () => Promise<T> | T): Promise<SafeResult<T>> {
  try {
    return { ok: true, data: await fn(), error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, data: null, error: `${label}: ${message}` }
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function arrayRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>) : []
}

function loadStatusArtifact(): Record<string, unknown> {
  const statusPath = path.join(process.cwd(), 'docs', 'MISSION_CONTROL', 'MISSION_CONTROL_STATUS.json')
  try {
    if (!fs.existsSync(statusPath)) return {}
    return record(JSON.parse(fs.readFileSync(statusPath, 'utf8')))
  } catch {
    return {}
  }
}

function missionFromStatus(value: unknown, fallback: Mission): Mission {
  const source = record(value)
  const id = typeof source.id === 'string' ? source.id : fallback.id
  const title = typeof source.title === 'string' ? source.title : fallback.title
  const state = typeof source.state === 'string' ? source.state as MissionState : fallback.state
  const priority = typeof source.priority === 'string' ? source.priority as MissionPriority : fallback.priority
  const mode = typeof source.mode === 'string' ? source.mode as MissionMode : fallback.mode
  const readiness = typeof source.readiness === 'string' ? source.readiness as ReadinessStatus : fallback.readiness
  return {
    ...fallback,
    id,
    title,
    category: id === 'MC-08H' ? 'CERTIFICATION' : fallback.category,
    state,
    priority,
    mode,
    readiness,
    owner: id === 'MC-08H' ? 'Product Certification' : fallback.owner,
    scope: id === 'MC-08H'
      ? 'Determine whether the daily betting product is ready for real-user production operation.'
      : fallback.scope,
    nextAction: id === 'MC-08H'
      ? 'Clear production operations blockers before opening Production Pilot Week.'
      : fallback.nextAction,
    blockers: id === 'MC-08H' ? ['production_readiness_blocked'] : fallback.blockers,
    evidence: id === 'MC-08H'
      ? ['docs/CERTIFICATION/mc-08h-production-readiness-certification.json', 'docs/MISSION_CONTROL/MC_08H_PRODUCTION_READINESS_CERTIFICATION.md']
      : fallback.evidence,
    canStartAutomatically: false,
  }
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value: unknown, fallback = 'unknown') {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function stateFromOperationalStatus(value: unknown): ReadinessStatus {
  const normalized = String(value ?? '').toLowerCase()
  if (['pass', 'healthy', 'success', 'fresh', 'current', 'ready'].some((term) => normalized.includes(term))) return 'READY'
  if (['late', 'critical', 'failed', 'blocked', 'error'].some((term) => normalized.includes(term))) return 'BLOCKED'
  if (['warning', 'partial', 'degraded', 'stale', 'limited'].some((term) => normalized.includes(term))) return 'CONDITIONAL'
  return 'CONDITIONAL'
}

const taxonomy = {
  categories: [
    'OPERATIONAL_READINESS',
    'MULTI_SPORT_DATA',
    'MULTI_SPORT_PREDICTION',
    'SETTLEMENT_AND_LEARNING',
    'PERFORMANCE_INTELLIGENCE',
    'DECISION_CORE_EVOLUTION',
    'MARKET_EXPANSION',
    'PRODUCT_EXPERIENCE',
    'AUTOMATION',
    'PROVIDER_INTEGRATION',
    'CERTIFICATION',
    'DOCUMENTATION',
    'TECHNICAL_DEBT',
    'EXTERNAL_DEPENDENCY',
  ] satisfies MissionCategory[],
  states: [
    'PLANNED',
    'READY',
    'ACTIVE',
    'PAUSED',
    'BLOCKED',
    'CONDITIONAL_PASS',
    'LOCALLY_COMPLETE',
    'DEPLOYED',
    'PRODUCTION_CERTIFIED',
    'SUPERSEDED',
    'CANCELLED',
    'UNKNOWN',
  ] satisfies MissionState[],
  priorities: ['P0', 'P1', 'P2', 'P3', 'P4'] satisfies MissionPriority[],
  modes: ['MANUAL_ONLY', 'AGENT_ASSISTED', 'AUTONOMOUS_ELIGIBLE', 'AUTONOMOUS_ACTIVE', 'EXTERNAL_WAIT', 'READ_ONLY'] satisfies MissionMode[],
}

const stopConditions: StopCondition[] = [
  {
    id: 'MC-STOP-001',
    type: 'HARD_STOP',
    title: 'Prediction, Official Pick, Kelly, settlement or learning behavior change requested outside an approved mission',
    action: 'Stop execution and require a new bounded mission charter.',
    evidenceRequiredToResume: 'Approved mission scope explicitly authorizing the behavior change.',
  },
  {
    id: 'MC-STOP-002',
    type: 'PROVIDER_BLOCK',
    title: 'Provider call or quota spend required without explicit authorization',
    action: 'Pause the mission and use stored evidence only.',
    evidenceRequiredToResume: 'Provider, sport, endpoint, call cap, reserve impact and business reason are documented.',
  },
  {
    id: 'MC-STOP-003',
    type: 'SPORT_BLOCK',
    title: 'Sport lacks canonical event, result, odds or settlement crosswalk',
    action: 'Block only that sport and keep other workstreams independent.',
    evidenceRequiredToResume: 'Canonical source and data ownership are proven for the affected sport.',
  },
  {
    id: 'MC-STOP-004',
    type: 'MISSION_BLOCK',
    title: 'Validator exposes a real runtime or policy regression',
    action: 'Repair the regression before advancing the queue.',
    evidenceRequiredToResume: 'Targeted validator and impacted release validators pass.',
  },
  {
    id: 'MC-STOP-005',
    type: 'EXTERNAL_WAIT',
    title: 'Production deployment, GitHub Actions or provider reset evidence is pending',
    action: 'Observe the external system read-only until the required evidence exists.',
    evidenceRequiredToResume: 'Timestamped external success evidence is recorded.',
  },
  {
    id: 'MC-STOP-006',
    type: 'HUMAN_APPROVAL',
    title: 'Mission would activate autonomous execution or promote a model change',
    action: 'Require explicit human approval.',
    evidenceRequiredToResume: 'Human approval plus before/after evidence and rollback plan.',
  },
]

const recentCompletions: Mission[] = [
  {
    id: 'OE-003A',
    title: 'Scheduler Health Semantics',
    category: 'OPERATIONAL_READINESS',
    state: 'PRODUCTION_CERTIFIED',
    priority: 'P0',
    mode: 'READ_ONLY',
    readiness: 'COMPLETE',
    owner: 'Operations',
    scope: 'Split scheduler execution health, market freshness, provider budget, settlement and product readiness.',
    nextAction: 'Use as an input to Mission Control health.',
    dependencies: [],
    blockers: [],
    evidence: ['docs/CERTIFICATION/oe-003a-scheduler-health-semantics.json'],
    stopConditions: [],
    canStartAutomatically: false,
  },
  {
    id: 'OE-003B',
    title: 'Provider Budget Ledger Normalization',
    category: 'PROVIDER_INTEGRATION',
    state: 'PRODUCTION_CERTIFIED',
    priority: 'P0',
    mode: 'READ_ONLY',
    readiness: 'COMPLETE',
    owner: 'Operations',
    scope: 'Normalize provider-specific budget pools and reserve evidence.',
    nextAction: 'Use provider budget intelligence before any acquisition mission.',
    dependencies: ['OE-003A'],
    blockers: [],
    evidence: ['docs/CERTIFICATION/oe-003b-provider-budget-ledger-normalization.json'],
    stopConditions: ['MC-STOP-002'],
    canStartAutomatically: false,
  },
  {
    id: 'OE-003C',
    title: 'Per-Event Lifecycle State',
    category: 'OPERATIONAL_READINESS',
    state: 'PRODUCTION_CERTIFIED',
    priority: 'P0',
    mode: 'READ_ONLY',
    readiness: 'COMPLETE',
    owner: 'Operations',
    scope: 'Derive canonical current-event lifecycle state without creating a second source of truth.',
    nextAction: 'Feed event-level refresh planning and Mission Control current-state summaries.',
    dependencies: ['OE-003A', 'OE-003B'],
    blockers: [],
    evidence: ['docs/CERTIFICATION/oe-003c-per-event-lifecycle-state.json'],
    stopConditions: ['MC-STOP-003'],
    canStartAutomatically: false,
  },
  {
    id: 'OE-003D',
    title: 'Event-Level Refresh Planner',
    category: 'AUTOMATION',
    state: 'PRODUCTION_CERTIFIED',
    priority: 'P0',
    mode: 'READ_ONLY',
    readiness: 'COMPLETE',
    owner: 'Operations',
    scope: 'Plan per-event refresh priority in shadow mode.',
    nextAction: 'Use planner output for readiness and queue gating.',
    dependencies: ['OE-003C'],
    blockers: [],
    evidence: ['docs/CERTIFICATION/oe-003d-event-level-refresh-planner.json'],
    stopConditions: ['MC-STOP-002', 'MC-STOP-006'],
    canStartAutomatically: false,
  },
  {
    id: 'OE-003E',
    title: 'Canonical Acquisition Active Execution',
    category: 'PROVIDER_INTEGRATION',
    state: 'PRODUCTION_CERTIFIED',
    priority: 'P0',
    mode: 'MANUAL_ONLY',
    readiness: 'COMPLETE',
    owner: 'Operations',
    scope: 'Activate bounded SportsDataIO MLB current-day odds acquisition through the protected scheduler.',
    nextAction: 'Keep acquisition bounded to certified scope.',
    dependencies: ['OE-003D'],
    blockers: ['The Odds API remains shadow-only until balance, reset and cost evidence are certified.'],
    evidence: ['docs/CERTIFICATION/oe-003e-canonical-acquisition-active-execution.json'],
    stopConditions: ['MC-STOP-002'],
    canStartAutomatically: false,
  },
  {
    id: 'OE-003F',
    title: 'Product Freshness SLA',
    category: 'PRODUCT_EXPERIENCE',
    state: 'PRODUCTION_CERTIFIED',
    priority: 'P0',
    mode: 'READ_ONLY',
    readiness: 'COMPLETE',
    owner: 'Product Operations',
    scope: 'Expose stale, blocked and downgraded market freshness on decision surfaces.',
    nextAction: 'Use freshness SLA as a Mission Control product-readiness domain.',
    dependencies: ['OE-003E'],
    blockers: [],
    evidence: ['docs/CERTIFICATION/oe-003f-product-freshness-sla.json'],
    stopConditions: ['MC-STOP-001'],
    canStartAutomatically: false,
  },
]

const queue: Mission[] = [
  {
    id: 'MC-00',
    title: 'Mission Control Foundation',
    category: 'AUTOMATION',
    state: 'PRODUCTION_CERTIFIED',
    priority: 'P0',
    mode: 'READ_ONLY',
    readiness: 'COMPLETE',
    owner: 'Mission Control',
    scope: 'Create a read-only command center, mission queue, stop conditions, resume guide and certification contract.',
    nextAction: 'Production-certify /api/mission-control and /mission-control after automatic deployment.',
    dependencies: ['OE-003A', 'OE-003B', 'OE-003C', 'OE-003D', 'OE-003E', 'OE-003F'],
    blockers: [],
    evidence: ['docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json', 'docs/CERTIFICATION/mission-control-v1.json'],
    stopConditions: ['MC-STOP-004', 'MC-STOP-005'],
    canStartAutomatically: false,
  },
  {
    id: 'MC-01',
    title: 'Operational Readiness Closure',
    category: 'OPERATIONAL_READINESS',
    state: 'PRODUCTION_CERTIFIED',
    priority: 'P1',
    mode: 'AGENT_ASSISTED',
    readiness: 'COMPLETE',
    owner: 'Operations',
    scope: 'Close remaining daily operating readiness evidence using stored operational proof and production read-only endpoints.',
    nextAction: 'Complete; use as the operational-readiness baseline before MC-02.',
    dependencies: ['MC-00'],
    blockers: [],
    evidence: ['docs/CERTIFICATION/mc-01-operational-readiness-closure.json', 'docs/PROJECT_STATUS.md'],
    stopConditions: [],
    canStartAutomatically: false,
  },
  {
    id: 'MC-02',
    title: 'Multi-Sport Data Readiness',
    category: 'MULTI_SPORT_DATA',
    state: 'PRODUCTION_CERTIFIED',
    priority: 'P1',
    mode: 'AGENT_ASSISTED',
    readiness: 'COMPLETE',
    owner: 'Data Foundation',
    scope: 'Determine sport-by-sport canonical event, result, odds and feature readiness before prediction activation.',
    nextAction: 'Complete; use sport-level readiness states before MC-03 or sport-specific data follow-ups.',
    dependencies: ['MC-01', 'OE-003B', 'OE-003C'],
    blockers: [],
    evidence: ['docs/CERTIFICATION/mc-02-multi-sport-data-readiness.json', 'docs/MISSION_CONTROL/MC_02_MULTI_SPORT_DATA_READINESS.md'],
    stopConditions: [],
    canStartAutomatically: false,
  },
  {
    id: 'MC-03',
    title: 'Multi-Sport Prediction Activation',
    category: 'MULTI_SPORT_PREDICTION',
    state: 'PLANNED',
    priority: 'P2',
    mode: 'MANUAL_ONLY',
    readiness: 'NOT_READY',
    owner: 'Decision Core',
    scope: 'Activate future-only sport predictions only after data, settlement and learning gates pass.',
    nextAction: 'Wait for MC-02 sport-level certification.',
    dependencies: ['MC-02'],
    blockers: ['No non-MLB sport may be activated from incomplete data evidence.'],
    evidence: ['START_HERE.md'],
    stopConditions: ['MC-STOP-001', 'MC-STOP-003', 'MC-STOP-006'],
    canStartAutomatically: false,
  },
  {
    id: 'MC-04',
    title: 'Multi-Sport Settlement And Learning',
    category: 'SETTLEMENT_AND_LEARNING',
    state: 'PLANNED',
    priority: 'P2',
    mode: 'AGENT_ASSISTED',
    readiness: 'CONDITIONAL',
    owner: 'Learning',
    scope: 'Extend settlement, labels and performance inclusion only where canonical results exist.',
    nextAction: 'Use sport-scoped settlement validators after MC-02.',
    dependencies: ['MC-02', 'MC-03'],
    blockers: ['Canonical result gaps by sport.'],
    evidence: ['docs/PROJECT_STATUS.md'],
    stopConditions: ['MC-STOP-001', 'MC-STOP-003'],
    canStartAutomatically: false,
  },
  {
    id: 'MC-05',
    title: 'Performance Intelligence',
    category: 'PERFORMANCE_INTELLIGENCE',
    state: 'PLANNED',
    priority: 'P2',
    mode: 'AGENT_ASSISTED',
    readiness: 'CONDITIONAL',
    owner: 'Performance',
    scope: 'Keep performance metrics aligned with settled, eligible rows and model intelligence evidence.',
    nextAction: 'Advance after settlement labels are complete for the target sport.',
    dependencies: ['MC-04'],
    blockers: ['Insufficient settled sample sizes outside MLB.'],
    evidence: ['docs/MODEL/MODEL_INTELLIGENCE_REPORT.md', 'docs/DATA/SEGMENT_ENGINE.md'],
    stopConditions: ['MC-STOP-004'],
    canStartAutomatically: false,
  },
  {
    id: 'MC-06',
    title: 'Decision Core Evolution',
    category: 'DECISION_CORE_EVOLUTION',
    state: 'PLANNED',
    priority: 'P3',
    mode: 'MANUAL_ONLY',
    readiness: 'NOT_READY',
    owner: 'Decision Core',
    scope: 'Evaluate model changes only through statistical evolution and controlled experimentation.',
    nextAction: 'Wait for sufficient evidence and human approval.',
    dependencies: ['MC-05'],
    blockers: ['No optimization by intuition.'],
    evidence: ['docs/MODEL/MODEL_EVOLUTION_WORKFLOW.md', 'docs/MODEL/EXPERIMENT_WORKFLOW.md'],
    stopConditions: ['MC-STOP-001', 'MC-STOP-006'],
    canStartAutomatically: false,
  },
  {
    id: 'MC-07',
    title: 'Market Expansion',
    category: 'MARKET_EXPANSION',
    state: 'PLANNED',
    priority: 'P3',
    mode: 'AGENT_ASSISTED',
    readiness: 'NOT_READY',
    owner: 'Markets',
    scope: 'Add unsupported markets only after ingestion, modeling, validation, settlement and dashboard support are complete.',
    nextAction: 'Keep unsupported markets labeled unavailable until all gates pass.',
    dependencies: ['MC-02', 'MC-04'],
    blockers: ['First Five, team totals, props and alternate lines are not official recommendations yet.'],
    evidence: ['AGENTS.md', 'docs/PROJECT_STATUS.md'],
    stopConditions: ['MC-STOP-001', 'MC-STOP-003'],
    canStartAutomatically: false,
  },
  {
    id: 'MC-08',
    title: 'Daily Betting Product Completion',
    category: 'PRODUCT_EXPERIENCE',
    state: 'READY',
    priority: 'P2',
    mode: 'AGENT_ASSISTED',
    readiness: 'READY',
    owner: 'Product',
    scope: 'Continue UX polish around betting plan, workspace, daily brief and personal ledger without changing model policy.',
    nextAction: 'Use Mission Control health before opening the next product phase.',
    dependencies: ['MC-00'],
    blockers: [],
    evidence: ['docs/PRODUCT/AI_DAILY_EXPERIENCE.md', 'docs/PRODUCT/PERSONAL_WAGER_LEDGER.md'],
    stopConditions: ['MC-STOP-001'],
    canStartAutomatically: false,
  },
  {
    id: 'MC-09',
    title: 'Autonomous Operations',
    category: 'AUTOMATION',
    state: 'PLANNED',
    priority: 'P2',
    mode: 'EXTERNAL_WAIT',
    readiness: 'CONDITIONAL',
    owner: 'Operations',
    scope: 'Increase autonomous execution only after scheduler, provider, settlement and stop-condition evidence remain healthy.',
    nextAction: 'Observe external scheduler proof and keep protected endpoints guarded.',
    dependencies: ['MC-01', 'OE-003E'],
    blockers: ['Autonomous active mode requires explicit human approval.'],
    evidence: ['docs/OPERATIONS/DAILY_OPERATIONS_SUMMARY.md', 'docs/OPERATIONAL_EXCELLENCE/OE_003E_CANONICAL_ACQUISITION_ACTIVE_EXECUTION.md'],
    stopConditions: ['MC-STOP-002', 'MC-STOP-005', 'MC-STOP-006'],
    canStartAutomatically: false,
  },
  {
    id: 'MC-10',
    title: 'Final Certification',
    category: 'CERTIFICATION',
    state: 'PLANNED',
    priority: 'P4',
    mode: 'MANUAL_ONLY',
    readiness: 'NOT_READY',
    owner: 'Certification',
    scope: 'Certify V2 only after queued missions are complete and production evidence aligns.',
    nextAction: 'Remain parked until prior missions close.',
    dependencies: ['MC-01', 'MC-02', 'MC-03', 'MC-04', 'MC-05', 'MC-06', 'MC-07', 'MC-08', 'MC-09'],
    blockers: ['Cannot certify ahead of incomplete mission queue.'],
    evidence: ['docs/MASTER_ROADMAP.md'],
    stopConditions: ['MC-STOP-004', 'MC-STOP-006'],
    canStartAutomatically: false,
  },
]

const sportReadiness: SportReadiness[] = [
  {
    sport: 'MLB',
    maturity: 'CERTIFIED',
    readiness: 'COMPLETE',
    currentStage: 'DATA -> PREDICTION -> PERSISTENCE -> RESULT -> SETTLEMENT -> LEARNING -> PERFORMANCE -> CERTIFICATION',
    nextStage: 'Maintain OE-003 provider-budget and freshness guardrails.',
    blockers: [],
    evidence: ['OE-003A through OE-003F production certifications'],
  },
  {
    sport: 'NBA',
    maturity: 'DATA_FOUNDATION',
    readiness: 'CONDITIONAL',
    currentStage: 'DATA foundation exists; production prediction activation is not certified.',
    nextStage: 'Canonical results, odds freshness and settlement-learning validation.',
    blockers: ['Non-production/trial isolation remains documented.'],
    evidence: ['docs/PROJECT_STATUS.md'],
  },
  {
    sport: 'NFL',
    maturity: 'PLANNED',
    readiness: 'NOT_READY',
    currentStage: 'Stored current coverage documented as empty in data foundation evidence.',
    nextStage: 'Schedule, results, stats, injuries, depth chart and odds acquisition gates.',
    blockers: ['Canonical data coverage missing.'],
    evidence: ['docs/PROJECT_STATUS.md'],
  },
  {
    sport: 'NHL',
    maturity: 'PLANNED',
    readiness: 'NOT_READY',
    currentStage: 'Stored current coverage documented as empty in data foundation evidence.',
    nextStage: 'Schedule, results, goalie/starter, injury and odds gates.',
    blockers: ['Canonical data coverage missing.'],
    evidence: ['docs/PROJECT_STATUS.md'],
  },
  {
    sport: 'Soccer',
    maturity: 'PLANNED',
    readiness: 'CONDITIONAL',
    currentStage: 'Competition-specific foundation only; no global coverage claim.',
    nextStage: 'Choose competition scope and canonical event/result sources.',
    blockers: ['Global soccer cannot be treated as one homogeneous league.'],
    evidence: ['docs/PROJECT_STATUS.md'],
  },
  {
    sport: 'Tennis',
    maturity: 'PLANNED',
    readiness: 'CONDITIONAL',
    currentStage: 'Event-driven readiness contract exists; no team-season forcing.',
    nextStage: 'Event source, result source and market coverage certification.',
    blockers: ['Event-driven canonical source still required before production picks.'],
    evidence: ['docs/PROJECT_STATUS.md'],
  },
  {
    sport: 'UFC',
    maturity: 'PLANNED',
    readiness: 'CONDITIONAL',
    currentStage: 'Event-driven readiness contract exists.',
    nextStage: 'Fight card, result, fighter context and market coverage certification.',
    blockers: ['Event-driven canonical source still required before production picks.'],
    evidence: ['docs/PROJECT_STATUS.md'],
  },
  {
    sport: 'BSN',
    maturity: 'DATA_FOUNDATION',
    readiness: 'CONDITIONAL',
    currentStage: 'Manual/CSV source contracts exist; provider path remains observational.',
    nextStage: 'Canonical source ownership, result import and settlement contract.',
    blockers: ['No fabricated stored coverage; manual source provenance required.'],
    evidence: ['docs/PROJECT_STATUS.md', 'docs/CERTIFICATION/oe-003e-canonical-acquisition-active-execution.json'],
  },
]

function buildHealthDomains({
  operationsHealth,
  lifecycle,
  refreshPlan,
  budget,
}: {
  operationsHealth: SafeResult<unknown>
  lifecycle: SafeResult<unknown>
  refreshPlan: SafeResult<unknown>
  budget: SafeResult<unknown>
}): HealthDomain[] {
  const health = record(operationsHealth.data)
  const healthDomains = record(health.healthDomains)
  const lifecycleSummary = record(record(lifecycle.data).summary)
  const refreshSummary = record(record(refreshPlan.data).summary)
  const budgetRecord = record(budget.data)
  const providerBudget = record(budgetRecord.providerBudget ?? budgetRecord.budget ?? budgetRecord)

  return [
    {
      domain: 'Scheduler Execution',
      status: operationsHealth.ok ? stateFromOperationalStatus(record(healthDomains.schedulerExecution).status ?? health.status) : 'CONDITIONAL',
      summary: operationsHealth.ok ? text(record(healthDomains.schedulerExecution).summary, 'Scheduler health evidence is available.') : operationsHealth.error,
      evidence: ['/api/operations/health', 'docs/CERTIFICATION/oe-003a-scheduler-health-semantics.json'],
    },
    {
      domain: 'Market Freshness',
      status: refreshPlan.ok ? stateFromOperationalStatus(refreshSummary.status ?? refreshSummary.plannerMode ?? 'READY') : 'CONDITIONAL',
      summary: refreshPlan.ok
        ? `Refresh planner returned ${num(refreshSummary.totalEvents)} current events and ${num(refreshSummary.eventsDueNow)} due-now events.`
        : refreshPlan.error,
      evidence: ['/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200', 'docs/CERTIFICATION/oe-003d-event-level-refresh-planner.json'],
    },
    {
      domain: 'Provider Budget',
      status: budget.ok ? stateFromOperationalStatus(providerBudget.status ?? providerBudget.health ?? 'READY') : 'CONDITIONAL',
      summary: budget.ok ? `SportsDataIO budget evidence is present; Mission Control made 0 provider calls.` : budget.error,
      evidence: ['/api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb', 'docs/CERTIFICATION/oe-003b-provider-budget-ledger-normalization.json'],
    },
    {
      domain: 'Settlement Closure',
      status: 'READY',
      summary: 'Mission Control is read-only and defers settlement truth to the settlement guarantee validators and operations endpoints.',
      evidence: ['/api/operations/settlement-guarantee?includeValidation=true'],
    },
    {
      domain: 'Product Readiness',
      status: 'READY',
      summary: 'OE-003F product freshness SLA is certified across betting decision surfaces.',
      evidence: ['docs/CERTIFICATION/oe-003f-product-freshness-sla.json'],
    },
    {
      domain: 'Event Lifecycle',
      status: lifecycle.ok ? stateFromOperationalStatus(lifecycleSummary.status ?? 'READY') : 'CONDITIONAL',
      summary: lifecycle.ok
        ? `Lifecycle state returned ${num(lifecycleSummary.totalEvents)} bounded current MLB events.`
        : lifecycle.error,
      evidence: ['/api/operations/event-lifecycle?sportKey=baseball_mlb&limit=200', 'docs/CERTIFICATION/oe-003c-per-event-lifecycle-state.json'],
    },
    {
      domain: 'Refresh Planner',
      status: refreshPlan.ok ? 'READY' : 'CONDITIONAL',
      summary: refreshPlan.ok ? 'Planner is available in read-only Mission Control context.' : refreshPlan.error,
      evidence: ['/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200'],
    },
    {
      domain: 'Canonical Acquisition',
      status: 'READY',
      summary: 'SportsDataIO MLB acquisition is certified only through the protected scheduler boundary; Mission Control does not execute it.',
      evidence: ['docs/CERTIFICATION/oe-003e-canonical-acquisition-active-execution.json'],
    },
    {
      domain: 'Product Freshness SLA',
      status: 'READY',
      summary: 'Decision surfaces use stored provider market timestamps and downgrade stale or blocked markets.',
      evidence: ['docs/OPERATIONAL_EXCELLENCE/OE_003F_PRODUCT_FRESHNESS_SLA.md'],
    },
    {
      domain: 'Prediction',
      status: 'READY',
      summary: 'Mission Control does not change prediction formulas, probabilities, confidence, EV or edge.',
      evidence: ['AGENTS.md', 'START_HERE.md'],
    },
    {
      domain: 'Learning',
      status: 'READY',
      summary: 'Mission Control reads learning status only and does not alter weights, labels or epochs.',
      evidence: ['docs/PROJECT_STATUS.md'],
    },
    {
      domain: 'Performance',
      status: 'READY',
      summary: 'Performance remains a read-only downstream consumer of settled eligible rows.',
      evidence: ['/api/performance'],
    },
    {
      domain: 'Current Board',
      status: 'READY',
      summary: 'Current Board remains a stored-data reader and product freshness consumer.',
      evidence: ['/api/current-board?mode=current&limit=200'],
    },
    {
      domain: 'Daily Brief',
      status: 'READY',
      summary: 'Daily Brief remains presentation-only over existing recommendations and model status.',
      evidence: ['/api/dashboard/today'],
    },
    {
      domain: 'Workspace',
      status: 'READY',
      summary: 'Betting workspace and personal ledger are product surfaces, not model-policy inputs.',
      evidence: ['/betting-workbench'],
    },
    {
      domain: 'Personal Ledger',
      status: 'READY',
      summary: 'Authenticated wager ledger is isolated from prediction, settlement and learning systems.',
      evidence: ['docs/PRODUCT/PERSONAL_WAGER_LEDGER.md'],
    },
    {
      domain: 'Documentation',
      status: 'READY',
      summary: 'Mission Control adds a source-of-truth boundary for current execution state and future queueing.',
      evidence: ['docs/MISSION_CONTROL/README.md'],
    },
    {
      domain: 'Release State',
      status: 'READY',
      summary: 'Sprint 0 through Release 13B and OE-003F are treated as completed evidence, not restarted.',
      evidence: ['docs/PROJECT_STATUS.md', 'docs/MASTER_ROADMAP.md'],
    },
    {
      domain: 'Mission Queue',
      status: 'READY',
      summary: 'Queue is deterministic, bounded and requires explicit approval before autonomous activation.',
      evidence: ['docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md'],
    },
  ]
}

function buildProviderReadiness(budget: SafeResult<unknown>): ProviderReadiness[] {
  return [
    {
      provider: 'SportsDataIO',
      sportKey: 'baseball_mlb',
      readiness: budget.ok ? 'READY' : 'CONDITIONAL',
      activeScope: 'Certified MLB current operating-day pregame odds acquisition only through protected scheduler execution.',
      reserveProtected: true,
      providerCallsMadeByMissionControl: 0,
      remoteMutationsMadeByMissionControl: 0,
      evidence: [
        '/api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb',
        'docs/CERTIFICATION/oe-003e-canonical-acquisition-active-execution.json',
      ],
    },
    {
      provider: 'The Odds API',
      sportKey: 'multi_sport',
      readiness: 'BLOCKED',
      activeScope: 'Shadow-only until balance, reset and per-market cost are certified.',
      reserveProtected: true,
      providerCallsMadeByMissionControl: 0,
      remoteMutationsMadeByMissionControl: 0,
      evidence: ['docs/CERTIFICATION/oe-003e-canonical-acquisition-active-execution.json'],
    },
    {
      provider: 'BSN Sources',
      sportKey: 'basketball_bsn',
      readiness: 'CONDITIONAL',
      activeScope: 'Observational/manual-source contract only; no active provider refresh.',
      reserveProtected: true,
      providerCallsMadeByMissionControl: 0,
      remoteMutationsMadeByMissionControl: 0,
      evidence: ['docs/PROJECT_STATUS.md'],
    },
  ]
}

export async function getMissionControl() {
  const generatedAt = new Date().toISOString()
  const [operationsHealth, lifecycle, refreshPlan, budget, dataReadiness] = await Promise.all([
    safe('Operations Health', () => getOperationsHealth()),
    safe('Event Lifecycle', () => getEventLifecycleState({ sportKey: SPORT_KEY, limit: 200 })),
    safe('Event Refresh Plan', () => getEventRefreshPlan({ sportKey: SPORT_KEY, limit: 200 })),
    safe('Provider Budget', () => getProviderBudgetStatus({ provider: PROVIDER, sportKey: SPORT_KEY })),
    safe('Multi-Sport Data Readiness', () => getMultiSportDataReadiness({ limit: 100 })),
  ])

  const healthDomains = buildHealthDomains({ operationsHealth, lifecycle, refreshPlan, budget })
  const blockers = [
    ...queue.flatMap((mission) => mission.blockers.map((blocker) => ({ missionId: mission.id, blocker }))),
    ...(operationsHealth.ok ? [] : [{ missionId: 'runtime-evidence', blocker: operationsHealth.error }]),
    ...(lifecycle.ok ? [] : [{ missionId: 'runtime-evidence', blocker: lifecycle.error }]),
    ...(refreshPlan.ok ? [] : [{ missionId: 'runtime-evidence', blocker: refreshPlan.error }]),
    ...(budget.ok ? [] : [{ missionId: 'runtime-evidence', blocker: budget.error }]),
    ...(dataReadiness.ok ? [] : [{ missionId: 'runtime-evidence', blocker: dataReadiness.error }]),
  ]

  const lifecycleEvents = arrayRecords(record(lifecycle.data).events)
  const refreshPlans = arrayRecords(record(refreshPlan.data).plans)
  const statusArtifact = loadStatusArtifact()
  const artifactCurrentMission = missionFromStatus(statusArtifact.currentMission, queue[2])
  const artifactNextMission = record(statusArtifact.mc08h).productionPilotWeekReady === false
    ? null
    : (queue.find((mission) => !['MC-00', 'MC-01', 'MC-02'].includes(mission.id) && mission.readiness === 'READY') ?? null)

  return {
    status: typeof statusArtifact.status === 'string' ? statusArtifact.status : 'UNKNOWN',
    program: {
      id: PROGRAM_VERSION,
      name: 'Pick Analyzer V2 Mission Control',
      documentationVersion: DOCUMENTATION_VERSION,
      baselineCommit: BASELINE_COMMIT,
      runtimeCommit: runtimeCommit(),
      sourceOfTruth: {
        masterProgram: 'docs/MASTER_PROGRAM/PICK_ANALYZER_MASTER_PROGRAM_V2.md',
        masterRoadmap: 'docs/MASTER_ROADMAP.md',
        missionControl: 'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
        projectStatus: 'docs/PROJECT_STATUS.md',
        certification: 'docs/CERTIFICATION/mission-control-v1.json',
        log: 'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
      },
    },
    taxonomy,
    currentMission: artifactCurrentMission,
    nextMission: artifactNextMission,
    missionControlStatus: statusArtifact,
    mc08h: record(statusArtifact.mc08h),
    readOnlyGuarantees: record(statusArtifact.readOnlyGuarantees),
    queue,
    autonomousReadiness: {
      status: 'READY' satisfies ReadinessStatus,
      maximumV1Mode: 'AUTONOMOUS_ELIGIBLE',
      autonomousActive: false,
      reason: 'Mission Control V1 may identify eligible work, but does not start autonomous execution or provider calls.',
      stopConditions: stopConditions.map((item) => item.id),
    },
    projectHealth: healthDomains,
    sportReadiness,
    dataReadiness: dataReadiness.ok ? dataReadiness.data : {
      success: false,
      error: dataReadiness.error,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
    },
    providerReadiness: buildProviderReadiness(budget),
    recentCompletions,
    blockers,
    stopConditions,
    operationalPipeline: {
      stages: ['EVENT_DISCOVERY', 'PREDICTION', 'PERSISTENCE', 'ODDS_REFRESH', 'RESULT', 'SETTLEMENT', 'LEARNING', 'PERFORMANCE', 'DAILY_REPORT'],
      currentEvidence: {
        lifecycleEventCount: lifecycleEvents.length,
        refreshPlanCount: refreshPlans.length,
        providerCallsMadeByMissionControl: 0,
        remoteMutationsMadeByMissionControl: 0,
      },
    },
    productionVersion: {
      expectedCommit: MC00_RUNTIME_COMMIT,
      observedRuntimeCommit: runtimeCommit(),
      source: 'VERCEL_GIT_COMMIT_SHA or local baseline fallback',
    },
    documentationVersion: DOCUMENTATION_VERSION,
    generatedAt,
    evidence: {
      runtimeEndpoints: [
        '/api/system/version',
        '/api/mission-control',
        '/api/mission-control/data-readiness',
        '/mission-control',
        '/api/operations/health',
        '/api/operations/event-lifecycle?sportKey=baseball_mlb&limit=200',
        '/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200',
        '/api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb',
        '/api/dashboard/today',
        '/api/current-board?mode=current&limit=200',
        '/api/performance',
        '/mlb-operations',
      ],
      certificationArtifacts: [
        'docs/CERTIFICATION/oe-003a-scheduler-health-semantics.json',
        'docs/CERTIFICATION/oe-003b-provider-budget-ledger-normalization.json',
        'docs/CERTIFICATION/oe-003c-per-event-lifecycle-state.json',
        'docs/CERTIFICATION/oe-003d-event-level-refresh-planner.json',
        'docs/CERTIFICATION/oe-003e-canonical-acquisition-active-execution.json',
        'docs/CERTIFICATION/oe-003f-product-freshness-sla.json',
        'docs/CERTIFICATION/mission-control-v1.json',
      ],
      partialEvidenceErrors: [operationsHealth, lifecycle, refreshPlan, budget].filter((result) => !result.ok).map((result) => result.error),
    },
    guarantees: {
      readOnly: true,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      predictionWrites: 0,
      resultWrites: 0,
      settlementWrites: 0,
      learningWrites: 0,
      deploymentTriggers: 0,
      codeExecutionStarted: false,
      localServerSmokeRun: false,
    },
  }
}
