export const NBA_SHADOW_SCHEDULER_VERSION = 'NBA_03A_SHADOW_SCHEDULER_PREPARATION_V1'
export const NBA_SHADOW_SCHEDULER_MODE = 'NBA_CURRENT_ERA_SHADOW'
export const NBA_SHADOW_SCHEDULER_POLICY_VERSION = 'NBA_03A_CROSS_EVENT_SHADOW_ACCUMULATION_POLICY_V1'
export const NBA_SHADOW_SCHEDULER_ENABLED_ENV = 'NBA_CURRENT_ERA_SHADOW_SCHEDULER_ENABLED'

export type NbaShadowSchedulerOutcome =
  | 'DISABLED_NO_OP'
  | 'LOCK_ACQUIRED_SIMULATED'
  | 'LOCK_CONFLICT_NO_OP'
  | 'PROVIDER_BUDGET_EXHAUSTED_NO_OP'
  | 'NO_CURRENT_EVENTS_NO_OP'
  | 'STALE_ODDS_NO_OP'
  | 'NO_MODEL_MATCH_NO_OP'
  | 'ALL_CANDIDATES_ALREADY_PERSISTED_NO_OP'
  | 'PROVIDER_FAILURE_FAIL_CLOSED'
  | 'SIMULATED_BATCH_READY'

export type NbaShadowSchedulerFixtureInput = {
  schedulerEnabled: boolean
  lockAvailable: boolean
  providerBudgetRemaining: number
  currentEvents: number
  priceCandidates: number
  freshPriceCandidates: number
  modelMatched: number
  alreadyPersisted: number
  providerFailure?: boolean
}

export type NbaShadowSchedulerSimulation = {
  outcome: NbaShadowSchedulerOutcome
  lockState: 'not_requested' | 'acquired' | 'conflict'
  providerCalls: number
  selectedCandidates: number
  simulatedInserts: number
  currentEraDelta: number
  skipReason: string | null
  isolation: {
    officialPickDelta: 0
    productVisibilityDelta: 0
    learningDelta: 0
    calibrationDelta: 0
    bankrollDelta: 0
    notificationDelta: 0
    historicalReplayDelta: 0
    mlbMutationDelta: 0
  }
}

const isolationZero = {
  officialPickDelta: 0,
  productVisibilityDelta: 0,
  learningDelta: 0,
  calibrationDelta: 0,
  bankrollDelta: 0,
  notificationDelta: 0,
  historicalReplayDelta: 0,
  mlbMutationDelta: 0,
} as const

export function nbaShadowSchedulerPreparationContract() {
  return {
    version: NBA_SHADOW_SCHEDULER_VERSION,
    mode: NBA_SHADOW_SCHEDULER_MODE,
    policyVersion: NBA_SHADOW_SCHEDULER_POLICY_VERSION,
    defaultEnabled: false,
    enabledEnv: NBA_SHADOW_SCHEDULER_ENABLED_ENV,
    schedulerAuthority: {
      futurePrimary: 'Vercel Cron',
      proposedCron: '*/30 * * * *',
      fallback: 'none until separately authorized',
      existingMlbAuthority: '/api/cron/operating-day remains MLB-only',
      activationState: 'DISABLED_PREPARATION_ONLY',
    },
    cadence: {
      recommendation: 'every 30 minutes only while future NBA events exist inside the monitored pregame window',
      reason: [
        'The certified refresh pattern uses about 2 The Odds API calls per run.',
        'The Safe Canary freshness threshold is 30 minutes, so a tighter cadence would duplicate no-op work.',
        'No-game windows must suppress provider calls.',
      ],
      projectedProviderCallsPerHour: 4,
      projectedProviderCallsPerDay: 48,
      maxRunsPerHour: 2,
      maxRunsPerDay: 24,
    },
    providerBudget: {
      provider: 'the-odds-api',
      sportKey: 'basketball_nba',
      maxProviderCallsPerRun: 2,
      maxProviderCallsPerHour: 4,
      maxProviderCallsPerDay: 48,
      sportsDataIoCalls: 0,
      historicalProviderCalls: 0,
      budgetExhaustedBehavior: 'PROVIDER_BUDGET_EXHAUSTED_NO_OP',
      noGameBehavior: 'NO_CURRENT_EVENTS_NO_OP_WITH_ZERO_PROVIDER_CALLS',
      providerFailureBehavior: 'PROVIDER_FAILURE_FAIL_CLOSED',
      backoff: 'do not retry inside the same scheduler run; wait for the next eligible cadence window',
    },
    caps: {
      initialPerRunWriteCap: 5,
      manualCertificationBatchCap: 10,
      maxPerEventPerSlate: 3,
      maxPerEventMarketPerSlate: 2,
      maxSlateRowsPerDay: 50,
      capRationale: 'Automation should start below the manual 10-row cap to limit sportsbook-variant accumulation before settlement.',
    },
    lock: {
      canonicalPrimitive: 'provider_action_lock / scheduler ledger pattern used by protected operating-day runtime',
      lockKey: 'nba_current_era_shadow_scheduler',
      conflictBehavior: 'LOCK_CONFLICT_NO_OP',
      predictionIdempotencyIsSecondary: true,
    },
    pipeline: [
      'scheduler trigger',
      'acquire lock',
      'verify scheduler enabled',
      'verify NBA_CURRENT_ERA_SHADOW mode',
      'provider budget check',
      'current NBA schedule/odds refresh',
      'Safe Canary dry-run',
      'exclude existing Current Era logical rows',
      'apply NBA_03A_CROSS_EVENT_SHADOW_ACCUMULATION_POLICY_V1',
      'apply strict per-run cap',
      'revalidate selected candidates',
      'deterministic Current Era persistence',
      'exact readback summary',
      'release lock',
      'emit runtime audit',
    ],
    failClosedStates: [
      'scheduler disabled',
      'lock conflict',
      'provider budget exhausted',
      'no current events',
      'stale odds',
      'no model match',
      'all candidates already persisted',
      'event cutoff passed',
      'provider unavailable',
      'provider auth error',
      'provider rate limit',
      'provider timeout',
      'malformed provider payload',
      'zero events',
      'zero odds',
    ],
    observability: [
      'runs attempted',
      'runs executed',
      'lock skips',
      'no-event skips',
      'no-price skips',
      'stale-price skips',
      'provider errors',
      'provider calls',
      'candidate count',
      'selected count',
      'inserted count',
      'already-exists count',
      'duration',
      'Current Era row delta',
      'isolation failures',
    ],
    activationGate: [
      'scheduler prep validator PASS',
      'lock/concurrency PASS',
      'provider budget PASS',
      'policy cap PASS',
      'fail-closed PASS',
      'idempotency PASS',
      'isolation PASS',
      'kill switch PASS',
      'production deployment aligned',
      'explicit user authorization',
    ],
    rollback: {
      killSwitch: `${NBA_SHADOW_SCHEDULER_ENABLED_ENV}=false or unset`,
      configOnlyDisable: true,
      noSchemaChangeRequired: true,
    },
    settlementSeparation: {
      generationScheduler: 'NBA_CURRENT_ERA_SHADOW only',
      settlementScheduler: 'future separate authoritative-result process',
      currentPerformanceReadiness: 'INSUFFICIENT_CURRENT_ERA_SETTLED_SAMPLE',
    },
  } as const
}

export function simulateNbaShadowSchedulerRun(input: NbaShadowSchedulerFixtureInput): NbaShadowSchedulerSimulation {
  const base = {
    isolation: isolationZero,
    currentEraDelta: 0,
    selectedCandidates: 0,
    simulatedInserts: 0,
  }

  if (!input.schedulerEnabled) {
    return { ...base, outcome: 'DISABLED_NO_OP', lockState: 'not_requested', providerCalls: 0, skipReason: 'SCHEDULER_DISABLED' }
  }
  if (!input.lockAvailable) {
    return { ...base, outcome: 'LOCK_CONFLICT_NO_OP', lockState: 'conflict', providerCalls: 0, skipReason: 'LOCK_CONFLICT' }
  }
  if (input.providerBudgetRemaining < 2) {
    return { ...base, outcome: 'PROVIDER_BUDGET_EXHAUSTED_NO_OP', lockState: 'acquired', providerCalls: 0, skipReason: 'PROVIDER_BUDGET_EXHAUSTED' }
  }
  if (input.currentEvents <= 0) {
    return { ...base, outcome: 'NO_CURRENT_EVENTS_NO_OP', lockState: 'acquired', providerCalls: 0, skipReason: 'NO_CURRENT_EVENTS' }
  }
  if (input.providerFailure) {
    return { ...base, outcome: 'PROVIDER_FAILURE_FAIL_CLOSED', lockState: 'acquired', providerCalls: 1, skipReason: 'PROVIDER_FAILURE' }
  }
  if (input.freshPriceCandidates <= 0) {
    return { ...base, outcome: 'STALE_ODDS_NO_OP', lockState: 'acquired', providerCalls: 2, skipReason: 'STALE_ODDS' }
  }
  if (input.modelMatched <= 0) {
    return { ...base, outcome: 'NO_MODEL_MATCH_NO_OP', lockState: 'acquired', providerCalls: 2, skipReason: 'NO_MODEL_MATCH' }
  }

  const newCandidates = Math.max(0, Math.min(input.freshPriceCandidates, input.modelMatched) - input.alreadyPersisted)
  if (newCandidates <= 0) {
    return {
      ...base,
      outcome: 'ALL_CANDIDATES_ALREADY_PERSISTED_NO_OP',
      lockState: 'acquired',
      providerCalls: 2,
      skipReason: 'ALL_CANDIDATES_ALREADY_PERSISTED',
    }
  }

  const selected = Math.min(newCandidates, nbaShadowSchedulerPreparationContract().caps.initialPerRunWriteCap)
  return {
    ...base,
    outcome: 'SIMULATED_BATCH_READY',
    lockState: 'acquired',
    providerCalls: 2,
    selectedCandidates: selected,
    simulatedInserts: selected,
    currentEraDelta: selected,
    skipReason: null,
  }
}

export function runNbaShadowSchedulerPreparationFixtures() {
  const fixtures = [
    ['scheduler disabled', { schedulerEnabled: false, lockAvailable: true, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, freshPriceCandidates: 80, modelMatched: 40, alreadyPersisted: 0 }],
    ['lock acquired', { schedulerEnabled: true, lockAvailable: true, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, freshPriceCandidates: 80, modelMatched: 40, alreadyPersisted: 0 }],
    ['lock conflict', { schedulerEnabled: true, lockAvailable: false, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, freshPriceCandidates: 80, modelMatched: 40, alreadyPersisted: 0 }],
    ['provider budget exhausted', { schedulerEnabled: true, lockAvailable: true, providerBudgetRemaining: 1, currentEvents: 10, priceCandidates: 100, freshPriceCandidates: 80, modelMatched: 40, alreadyPersisted: 0 }],
    ['no current events', { schedulerEnabled: true, lockAvailable: true, providerBudgetRemaining: 48, currentEvents: 0, priceCandidates: 0, freshPriceCandidates: 0, modelMatched: 0, alreadyPersisted: 0 }],
    ['current events but stale odds', { schedulerEnabled: true, lockAvailable: true, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, freshPriceCandidates: 0, modelMatched: 40, alreadyPersisted: 0 }],
    ['valid candidates', { schedulerEnabled: true, lockAvailable: true, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, freshPriceCandidates: 80, modelMatched: 40, alreadyPersisted: 0 }],
    ['all selected already persisted', { schedulerEnabled: true, lockAvailable: true, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, freshPriceCandidates: 40, modelMatched: 40, alreadyPersisted: 40 }],
    ['provider failure', { schedulerEnabled: true, lockAvailable: true, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, freshPriceCandidates: 80, modelMatched: 40, alreadyPersisted: 0, providerFailure: true }],
    ['batch write simulated', { schedulerEnabled: true, lockAvailable: true, providerBudgetRemaining: 48, currentEvents: 10, priceCandidates: 100, freshPriceCandidates: 80, modelMatched: 40, alreadyPersisted: 0 }],
  ] as const

  const results = fixtures.map(([name, input]) => ({ name, input, result: simulateNbaShadowSchedulerRun(input) }))
  const deterministicA = simulateNbaShadowSchedulerRun(fixtures[6][1])
  const deterministicB = simulateNbaShadowSchedulerRun(fixtures[6][1])
  return {
    contract: nbaShadowSchedulerPreparationContract(),
    results,
    deterministicRerun: JSON.stringify(deterministicA) === JSON.stringify(deterministicB),
    providerCallsFromFixtures: 0,
    productionDatabaseMutations: 0,
  }
}
