'use client'

import { useEffect, useState } from 'react'

type HealthResponse = {
  success: boolean
  status: string
  summary: {
    recentJobs: number
    failedJobs: number
    runningJobs: number
    partialJobs: number
    providerMappings: number
    sportsWithMappings: number
    providersWithMappings: number
  }
  providerUsage: {
    externalProviderCallsMade: number
  }
  warnings: string[]
  error?: string
}

type PlanResponse = {
  success: boolean
  status: string
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
  job: {
    totalCheckpoints: number
    executableCheckpoints: number
    blockedCheckpoints: number
  }
  quotaEstimate: {
    estimatedProviderCalls: number
    costTier: string
    quotaImpact: string
    recommendedBatchSizeDays: number
    warning: string
  }
  checkpoints: Array<{
    id: string
    sequence: number
    dataType: string
    scope: string
    dateFrom: string | null
    dateTo: string | null
    status: string
    estimatedProviderCalls: number
  }>
  error?: string
}

type SportsDataIoStatusResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  environment: {
    configured: boolean
    status: string
    envVarName: string | null
  }
  runtime: {
    liveCallsEnabled: boolean
    serverOnly: boolean
    boundedConcurrency: boolean
    timeoutMs: number
  }
  summary: {
    contractEndpoints: number
    domainContracts: number
    fixtureValidationErrors: number
    fixtureValidationWarnings: number
    supportedRuntimeSports: number
  }
  validation: {
    success: boolean
    summary: {
      checks: number
      passed: number
      normalizedEvents: number
      normalizedOdds: number
    }
  }
}

type SportsDataIoPilotPlanResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  guardrails: {
    liveExecutionBlockedInThisModule: boolean
    hardCaps: {
      maximumRequests: number
      maximumRecords: number
      batchSizeDays: number
      concurrencyLimit: number
    }
  }
  job: {
    totalCheckpoints: number
    executableCheckpoints: number
    blockedCheckpoints: number
  }
  estimates: {
    estimatedProviderCalls: number
    estimatedRecords: number
    estimatedQuotaImpact: string
    recommendedBatchSizeDays: number
    recommendedConcurrency: number
  }
  pilot: {
    recommendedScope: string
    recommendedCap: number
    quotaRisk: string
    executionOrder: string[]
    stopConditions: string[]
  }
  checkpoints: Array<{
    id: string
    sequence: number
    domain: string
    status: string
    estimatedRequests: number
    destination: string
  }>
  warnings: string[]
}

type SportsDataIoNbaReadinessResponse = {
  success: boolean
  status: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  handoff: {
    status: string
    summary: {
      domains: number
      completeForTrialScope: number
      readyZeroCall: number
      blocked: number
      productionUseBlocked: number
    }
    domains: Array<{
      domain: string
      status: string
      persistence: string
      productionUse: string
      blockers: string[]
    }>
    productionGates: string[]
    safeNextActions: string[]
  }
  objectiveAudit: {
    status: string
    summary: {
      requirements: number
      satisfied: number
      partiallySatisfied: number
      blockedExternal: number
      requirementsWithRemainingWork: number
      remainingBlockers: Array<{
        requirement: string
        blocker: string
      }>
    }
  }
  completionEvidenceMatrix: {
    status: string
    generatedWithoutProviderCalls: boolean
    summary: {
      requirements: number
      proven: number
      partial: number
      blockedExternal: number
      missingEvidence: number
      blocksGoalCompletion: number
    }
    items: Array<{
      requirement: string
      status: string
      requiredEvidence: string[]
      proofArtifacts: string[]
      verifiedEvidence: string[]
      unresolvedEvidence: string[]
      blocksGoalCompletion: boolean
    }>
  }
  externalBlockerLedger: {
    status: string
    summary: {
      total: number
      providerOwned: number
      operatorOwned: number
      databaseAdminOwned: number
      productOwnerOwned: number
      providerCallsRequiredBeforeApproval: number
      productionGatesClosed: number
    }
    blockers: Array<{
      id: string
      domain: string
      category: string
      owner: string
      unblocks: string[]
      evidenceRequired: string[]
      safeUntilResolved: string[]
      nextSafeAction: string
      providerCallsRequiredBeforeApproval: number
      productionGateClosed: boolean
    }>
  }
  readinessEvidenceExport: {
    status: string
    providerCallsMade: number
    generatedWithoutProviderCalls: boolean
    summary: {
      proven: number
      blockedExternal: number
      closedGuardrails: number
      artifactsReferenced: number
      providerCallsMade: number
      providerCallsRequiredBeforeApproval: number
    }
    proven: Array<{
      id: string
      title: string
      evidence: string[]
      artifacts: string[]
    }>
    blocked: Array<{
      id: string
      title: string
      evidence: string[]
      artifacts: string[]
    }>
    closedGuardrails: Array<{
      id: string
      title: string
      evidence: string[]
      artifacts: string[]
    }>
    validation: {
      valid: boolean
      checks: Array<{
        id: string
        passed: boolean
        message: string
      }>
      errors: string[]
      warnings: string[]
    }
  }
  productionGateAudit: {
    valid: boolean
    status: string
    checks: Array<{
      id: string
      passed: boolean
      message: string
    }>
    errors: string[]
    warnings: string[]
  }
  nextPilotApprovalChecklist: {
    status: string
    generatedWithoutProviderCalls: boolean
    summary: {
      domains: number
      providerCallsAllowedBeforeApproval: number
      domainsRequiringProviderConfirmation: number
      domainsRequiringOperatorApproval: number
      domainsRequiringDatabaseAdmin: number
      domainsRequiringProductOwner: number
    }
    items: Array<{
      domain: string
      status: string
      approvalOwner: string
      approvalsRequired: string[]
      prerequisites: string[]
      cappedExecutionRequirements: string[]
      safeUntilApproved: string[]
      providerCallsAllowedBeforeApproval: number
    }>
  }
  responseShapeAudit: {
    valid: boolean
    status: string
    checks: Array<{
      id: string
      passed: boolean
      message: string
    }>
    errors: string[]
    warnings: string[]
  }
  surfaceConsistencyAudit: {
    valid: boolean
    status: string
    generatedWithoutProviderCalls: boolean
    surfaces: Array<{
      surface: string
      artifact: string
      expectedSignals: string[]
    }>
    checks: Array<{
      id: string
      passed: boolean
      message: string
    }>
    errors: string[]
    warnings: string[]
  }
  externalApprovalPacket: {
    status: string
    generatedWithoutProviderCalls: boolean
    title: string
    requestedApprovals: Array<{
      domain: string
      owner: string
      evidenceRequired: string[]
      unblocks: string[]
    }>
    executionConstraints: string[]
    prohibitedActions: string[]
    evidenceArtifacts: string[]
    summary: {
      domains: number
      providerCallsAllowedBeforeApproval: number
      productionGatesClosed: number
      completionBlockingItems: number
      surfaceConsistencyValid: boolean
    }
  }
  blockedStateAudit: {
    valid: boolean
    status: string
    generatedWithoutProviderCalls: boolean
    completionClaimAllowed: boolean
    blockers: Array<{
      domain: string
      owner: string
      evidenceRequired: string[]
    }>
    allowedLocalActions: string[]
    disallowedActions: string[]
    checks: Array<{
      id: string
      passed: boolean
      message: string
    }>
    errors: string[]
    warnings: string[]
  }
  domainCompletionProofLedger: {
    valid: boolean
    status: string
    generatedWithoutProviderCalls: boolean
    completionClaimAllowed: boolean
    summary: {
      domains: number
      provenTrialScope: number
      readyZeroCall: number
      blockedExternal: number
      blocksGoalCompletion: number
      productionGatesClosed: number
      providerCallsAllowedBeforeApproval: number
    }
    domains: Array<{
      domain: string
      handoffStatus: string
      proofState: string
      productionUse: string
      persistence: string
      verifiedEvidence: string[]
      requiredNextEvidence: string[]
      linkedBlockerIds: string[]
      linkedRequirements: string[]
      blocksGoalCompletion: boolean
      providerCallsAllowedBeforeApproval: number
      productionGateClosed: boolean
    }>
    checks: Array<{
      id: string
      passed: boolean
      message: string
    }>
    errors: string[]
    warnings: string[]
  }
  providerExecutionGate: {
    valid: boolean
    status: string
    generatedWithoutProviderCalls: boolean
    liveExecutionAllowed: boolean
    providerCallsAllowedNow: number
    allowedDomains: string[]
    blockedDomains: Array<{
      domain: string
      owner: string
      evidenceRequired: string[]
      nextSafeAction: string
      productionGateClosed: boolean
    }>
    constraints: string[]
    checks: Array<{
      id: string
      passed: boolean
      message: string
    }>
    errors: string[]
    warnings: string[]
  }
  externalBlockerResolutionChecklist: {
    valid: boolean
    status: string
    generatedWithoutProviderCalls: boolean
    liveExecutionAllowedAfterResolution: boolean
    summary: {
      domains: number
      blockers: number
      requiredEvidenceItems: number
      providerCallsAllowedBeforeResolution: number
      productionGatesClosed: number
      readyForCappedExecution: boolean
    }
    items: Array<{
      domain: string
      blockerId: string
      owner: string
      category: string
      requiredEvidence: string[]
      resolutionSteps: string[]
      preExecutionVerification: string[]
      forbiddenUntilResolved: string[]
      providerCallsAllowedBeforeResolution: number
      productionGateMustRemainClosed: boolean
    }>
    checks: Array<{
      id: string
      passed: boolean
      message: string
    }>
    errors: string[]
    warnings: string[]
  }
  productionUsageExclusionAudit: {
    valid: boolean
    status: string
    generatedWithoutProviderCalls: boolean
    trialRowsProductionEligible: boolean
    predictionPersistenceEnabled: boolean
    backtestingEnabled: boolean
    modelTrainingEnabled: boolean
    confidenceImprovementAllowed: boolean
    checkedSurfaces: Array<{
      surface: string
      artifact: string
      exclusionRule: string
    }>
    checks: Array<{
      id: string
      passed: boolean
      message: string
    }>
    errors: string[]
    warnings: string[]
  }
  nextPilotGatePreflights: {
    odds: {
      status: string
      providerUsage: {
        externalProviderCallsMade: number
      }
      route: string
      endpointPreflight: EndpointPreflight
    }
    playerProps: {
      status: string
      providerUsage: {
        externalProviderCallsMade: number
      }
      route: string
      endpointPreflight: EndpointPreflight
    }
    playerStats: {
      status: string
      providerUsage: {
        externalProviderCallsMade: number
      }
      route: string
      destinationTable: string
      migrationPreflight: PlayerStatsMigrationPreflight
    }
  }
}

type SportsDataIoExecutionReadinessValidationResponse = {
  success: boolean
  mode: string
  providerUsage: {
    externalProviderCallsMade: number
    source: string
  }
  summary: {
    checks: number
    passed: number
    dryRunCheckpoints: number
    pilotEstimatedCalls: number
    providerCallsMade: number
    oneToManyExpansionRecordsSkipped: number
    providerExecutionGateStatus: string
    externalBlockerResolutionChecklistStatus: string
    productionUsageExclusionAuditStatus: string
  }
  checks: Record<string, boolean>
  deterministicFixtures: {
    oneToManyExpansionCounters: {
      providerRecordsFetched: number
      normalizedRowsProduced: number
      recordsSkipped: number
      skippedProviderRecords: number
      skippedNormalizedRows: number
      oneToManyExpansion: boolean
      expansionRatio: number
    }
  }
  plans: {
    dryRunStatus: string
    rejectedLiveStatus: string
    gateRejectedLiveStatus: string
    gateRejectedLiveResolutionChecklistStatus: string
    pilotStatus: string
  }
  warnings: string[]
}

type CappedPilotRequirements = {
  maximumRequests: number
  concurrency: number
  automaticRetries: boolean
  dryRunDefault: boolean
  trial: boolean
  scrambled: boolean
  productionEligible: boolean
  stopOnNon200: boolean
}

type EndpointPreflight = {
  exactPathsConfirmed?: boolean
  entitlementConfirmed?: boolean
  sportsbookCoverageConfirmed?: boolean
  historicalWindowsApproved?: boolean
  settlementRulesImplemented?: boolean
  requiredConfirmations: string[]
  cappedPilotRequirements: CappedPilotRequirements
  goNoGoGates: string[]
}

type PlayerStatsMigrationPreflight = {
  noProviderCallsRequired: boolean
  destructiveChangeRequired: boolean
  sqlEditorSafeToRun: boolean
  verificationQueries: string[]
  expectedColumns: string[]
  expectedIndexes: string[]
  goNoGoGates: string[]
}

function statusClass(status: string) {
  if (
    status === 'ready' ||
    status === 'planned' ||
    status === 'proven' ||
    status === 'complete_evidence_verified' ||
    status === 'complete_for_trial_scope' ||
    status === 'ready_zero_call'
  ) return 'text-emerald-300'
  if (
    status === 'watch' ||
    status === 'partial' ||
    status === 'ready_with_historical_failures' ||
    status === 'dry_run_ready' ||
    status === 'configured_disabled' ||
    status === 'ready_with_external_blockers' ||
    status === 'ready_for_handoff_with_external_blockers' ||
    status === 'valid_with_external_blockers' ||
    status === 'production_blocked_as_expected' ||
    status === 'trial_scope_complete_with_production_blockers' ||
    status === 'blocked_until_external_approval' ||
    status === 'blocked_until_approved' ||
    status === 'not_complete_evidence_gaps_remaining' ||
    status === 'consistent_with_external_blockers' ||
    status === 'ready_for_external_approval_handoff' ||
    status === 'externally_blocked_not_complete' ||
    status === 'not_complete_external_evidence_required' ||
    status === 'provider_execution_blocked_pending_approval' ||
    status === 'production_usage_excluded_for_trial_data' ||
    status === 'open_external_blockers_remaining' ||
    status.startsWith('blocked_pending_')
  ) return 'text-amber-300'
  return 'text-red-300'
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ')
}

export default function HistoricalImportEnginePanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [sportsDataIoStatus, setSportsDataIoStatus] =
    useState<SportsDataIoStatusResponse | null>(null)
  const [sportsDataIoPilot, setSportsDataIoPilot] =
    useState<SportsDataIoPilotPlanResponse | null>(null)
  const [sportsDataIoNbaReadiness, setSportsDataIoNbaReadiness] =
    useState<SportsDataIoNbaReadinessResponse | null>(null)
  const [
    sportsDataIoExecutionReadinessValidation,
    setSportsDataIoExecutionReadinessValidation,
  ] = useState<SportsDataIoExecutionReadinessValidationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const [
        healthResponse,
        planResponse,
        sportsDataIoStatusResponse,
        sportsDataIoPilotResponse,
        sportsDataIoNbaReadinessResponse,
        sportsDataIoExecutionReadinessValidationResponse,
      ] = await Promise.all([
        fetch('/api/historical-import/health', { cache: 'no-store' }),
        fetch('/api/historical-import/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sportKey: 'basketball_nba',
            leagueKey: 'nba',
            dateFrom: '2026-01-01',
            dateTo: '2026-01-07',
            dataTypes: ['schedules', 'scores', 'odds'],
            batchSizeDays: 3,
            dryRun: true,
          }),
        }),
        fetch('/api/providers/sportsdataio/status', { cache: 'no-store' }),
        fetch('/api/historical-import/pilot-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sportKey: 'basketball_nba',
            leagueKey: 'nba',
            dateFrom: '2026-01-01',
            dateTo: '2026-01-03',
            domains: [
              'teams',
              'schedules',
              'completed_games',
              'scores',
              'standings',
              'game_stats',
            ],
          }),
        }),
        fetch('/api/providers/sportsdataio/nba/readiness', {
          cache: 'no-store',
        }),
        fetch('/api/providers/sportsdataio/execution-readiness/validation', {
          cache: 'no-store',
        }),
      ])
      const healthJson = await healthResponse.json()
      const planJson = await planResponse.json()
      const sportsDataIoStatusJson = await sportsDataIoStatusResponse.json()
      const sportsDataIoPilotJson = await sportsDataIoPilotResponse.json()
      const sportsDataIoNbaReadinessJson =
        await sportsDataIoNbaReadinessResponse.json()
      const sportsDataIoExecutionReadinessValidationJson =
        await sportsDataIoExecutionReadinessValidationResponse.json()

      if (!healthResponse.ok || !healthJson.success) {
        throw new Error(healthJson.error ?? 'Unable to load import health')
      }

      if (!planResponse.ok || !planJson.success) {
        throw new Error(planJson.error ?? 'Unable to plan historical import')
      }

      if (
        !sportsDataIoStatusResponse.ok ||
        !sportsDataIoStatusJson.success
      ) {
        throw new Error(
          sportsDataIoStatusJson.error ??
            'Unable to load SportsDataIO execution status'
        )
      }

      if (!sportsDataIoPilotResponse.ok || !sportsDataIoPilotJson.success) {
        throw new Error(
          sportsDataIoPilotJson.error ??
            'Unable to load SportsDataIO pilot plan'
        )
      }

      if (
        !sportsDataIoNbaReadinessResponse.ok ||
        !sportsDataIoNbaReadinessJson.success
      ) {
        throw new Error(
          sportsDataIoNbaReadinessJson.error ??
            'Unable to load SportsDataIO NBA readiness handoff'
        )
      }

      if (
        !sportsDataIoExecutionReadinessValidationResponse.ok ||
        !sportsDataIoExecutionReadinessValidationJson.success
      ) {
        throw new Error(
          sportsDataIoExecutionReadinessValidationJson.error ??
            'Unable to load SportsDataIO execution readiness validation'
        )
      }

      setHealth(healthJson)
      setPlan(planJson)
      setSportsDataIoStatus(sportsDataIoStatusJson)
      setSportsDataIoPilot(sportsDataIoPilotJson)
      setSportsDataIoNbaReadiness(sportsDataIoNbaReadinessJson)
      setSportsDataIoExecutionReadinessValidation(
        sportsDataIoExecutionReadinessValidationJson
      )
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load historical import engine'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !health) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading Historical Import Engine...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Historical Import
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Dry-Run Import Engine
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Plans normalized, resumable historical imports with checkpoints,
            idempotency and quota estimates. Provider execution is disabled in
            Core V1.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(health?.status ?? 'blocked')}`}>
            {health?.status ?? 'blocked'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-900/40"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Recent Jobs" value={health?.summary.recentJobs ?? 0} />
        <Stat label="Mappings" value={health?.summary.providerMappings ?? 0} />
        <Stat label="Checkpoints" value={plan?.job.totalCheckpoints ?? 0} />
        <Stat
          label="Est. Calls"
          value={plan?.quotaEstimate.estimatedProviderCalls ?? 0}
        />
        <Stat
          label="Provider Calls"
          value={health?.providerUsage.externalProviderCallsMade ?? 0}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              SportsDataIO Execution Readiness
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-indigo-100/80">
              Runtime adapter, pilot planning and execution guardrails are wired
              for future activation. This panel does not expose a live execution
              button in Readiness V1.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoStatus?.status ?? 'blocked')}`}>
            {sportsDataIoStatus?.status ?? 'blocked'}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Domains"
            value={sportsDataIoStatus?.summary.domainContracts ?? 0}
          />
          <Stat
            label="Runtime Checks"
            value={`${sportsDataIoStatus?.validation.summary.passed ?? 0}/${sportsDataIoStatus?.validation.summary.checks ?? 0}`}
          />
          <Stat
            label="Pilot Calls"
            value={sportsDataIoPilot?.estimates.estimatedProviderCalls ?? 0}
          />
          <Stat
            label="Pilot Records"
            value={sportsDataIoPilot?.estimates.estimatedRecords ?? 0}
          />
          <Stat
            label="Live Calls"
            value={
              sportsDataIoStatus?.runtime.liveCallsEnabled
                ? 'Enabled'
                : 'Disabled'
            }
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-sm font-black text-white">Guardrails</p>
            <div className="mt-4 grid gap-3">
              <MiniRow
                label="Environment"
                value={sportsDataIoStatus?.environment.status ?? 'unknown'}
              />
              <MiniRow
                label="Hard Request Cap"
                value={`${sportsDataIoPilot?.guardrails.hardCaps.maximumRequests ?? 0}`}
              />
              <MiniRow
                label="Concurrency Cap"
                value={`${sportsDataIoPilot?.guardrails.hardCaps.concurrencyLimit ?? 0}`}
              />
              <MiniRow
                label="Quota Risk"
                value={sportsDataIoPilot?.pilot.quotaRisk ?? 'unknown'}
              />
              <MiniRow
                label="Provider Calls Made"
                value={`${sportsDataIoPilot?.providerUsage.externalProviderCallsMade ?? 0}`}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-sm font-black text-white">
              Recommended Pilot Order
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(sportsDataIoPilot?.pilot.executionOrder ?? []).map((item, index) => (
                <div
                  key={item}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm"
                >
                  <span className="text-slate-500">{index + 1}. </span>
                  <span className="font-bold text-white">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 text-xs leading-5 text-amber-100">
              {sportsDataIoPilot?.warnings[0] ??
                'No live provider calls are made by this readiness panel.'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Execution Readiness Validation
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-cyan-100/80">
              Deterministic guardrail packet proving dry-run defaults, live-shape rejection, closed provider gates and one-to-many counter behavior before transport.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${sportsDataIoExecutionReadinessValidation?.success ? 'text-emerald-300' : 'text-red-300'}`}>
            {sportsDataIoExecutionReadinessValidation?.success ? 'valid' : 'blocked'}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Passed"
            value={sportsDataIoExecutionReadinessValidation?.summary.passed ?? 0}
          />
          <Stat
            label="Checks"
            value={sportsDataIoExecutionReadinessValidation?.summary.checks ?? 0}
          />
          <Stat
            label="Provider Calls"
            value={sportsDataIoExecutionReadinessValidation?.providerUsage.externalProviderCallsMade ?? 0}
          />
          <Stat
            label="Dry Runs"
            value={sportsDataIoExecutionReadinessValidation?.summary.dryRunCheckpoints ?? 0}
          />
          <Stat
            label="Skipped"
            value={sportsDataIoExecutionReadinessValidation?.summary.oneToManyExpansionRecordsSkipped ?? 0}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <MiniRow
            label="Provider Gate"
            value={formatStatus(
              sportsDataIoExecutionReadinessValidation?.summary.providerExecutionGateStatus ??
                'unknown'
            )}
          />
          <MiniRow
            label="Resolution"
            value={formatStatus(
              sportsDataIoExecutionReadinessValidation?.summary.externalBlockerResolutionChecklistStatus ??
                'unknown'
            )}
          />
          <MiniRow
            label="Usage Exclusion"
            value={formatStatus(
              sportsDataIoExecutionReadinessValidation?.summary.productionUsageExclusionAuditStatus ??
                'unknown'
            )}
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300">
            <span className="font-bold text-white">One-to-many fixture:</span>{' '}
            {sportsDataIoExecutionReadinessValidation?.deterministicFixtures.oneToManyExpansionCounters.providerRecordsFetched ?? 0}{' '}
            provider records to{' '}
            {sportsDataIoExecutionReadinessValidation?.deterministicFixtures.oneToManyExpansionCounters.normalizedRowsProduced ?? 0}{' '}
            normalized rows, records skipped{' '}
            {sportsDataIoExecutionReadinessValidation?.deterministicFixtures.oneToManyExpansionCounters.recordsSkipped ?? 0}.
          </p>
          <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300">
            <span className="font-bold text-white">Live-shaped plan:</span>{' '}
            {formatStatus(
              sportsDataIoExecutionReadinessValidation?.plans.gateRejectedLiveStatus ??
                'unknown'
            )}{' '}
            before provider transport.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-indigo-500/20 bg-indigo-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">Readiness Summary</p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-indigo-100/80">
              Canonical SportsDataIO NBA readiness from /api/providers/sportsdataio/nba/readiness.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Stat
            label="Provider Gate"
            value={formatStatus(sportsDataIoNbaReadiness?.providerExecutionGate.status ?? 'blocked')}
          />
          <Stat
            label="Domains"
            value={sportsDataIoNbaReadiness?.handoff.summary.domains ?? 0}
          />
          <Stat
            label="Migrations"
            value={sportsDataIoNbaReadiness?.externalBlockerLedger.summary.databaseAdminOwned ?? 0}
          />
          <Stat
            label="Endpoints"
            value={sportsDataIoNbaReadiness?.nextPilotApprovalChecklist.summary.domainsRequiringProviderConfirmation ?? 0}
          />
          <Stat
            label="Actions"
            value={sportsDataIoNbaReadiness?.handoff.safeNextActions.length ?? 0}
          />
          <Stat
            label="Blockers"
            value={sportsDataIoNbaReadiness?.externalBlockerLedger.summary.total ?? 0}
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <summary className="cursor-pointer text-xs font-black uppercase text-indigo-200">
              Provider Gate
            </summary>
            <p className="mt-3 text-xs leading-5 text-slate-300">
              {sportsDataIoNbaReadiness?.providerExecutionGate.liveExecutionAllowed
                ? 'Live execution is open.'
                : 'Live execution remains closed.'}{' '}
              Calls allowed now:{' '}
              {sportsDataIoNbaReadiness?.providerExecutionGate.providerCallsAllowedNow ?? 0}.
            </p>
          </details>
          <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <summary className="cursor-pointer text-xs font-black uppercase text-indigo-200">
              Domain Completion
            </summary>
            <p className="mt-3 text-xs leading-5 text-slate-300">
              {sportsDataIoNbaReadiness?.domainCompletionProofLedger.summary.provenTrialScope ?? 0}{' '}
              trial-scope domains proven;{' '}
              {sportsDataIoNbaReadiness?.domainCompletionProofLedger.summary.blocksGoalCompletion ?? 0}{' '}
              completion blockers remain.
            </p>
          </details>
          <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <summary className="cursor-pointer text-xs font-black uppercase text-indigo-200">
              Migrations
            </summary>
            <p className="mt-3 text-xs leading-5 text-slate-300">
              Player stats migration target:{' '}
              {sportsDataIoNbaReadiness?.nextPilotGatePreflights.playerStats.destinationTable ?? 'sport_player_stats'}.
            </p>
          </details>
          <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <summary className="cursor-pointer text-xs font-black uppercase text-indigo-200">
              Endpoint Confirmation
            </summary>
            <p className="mt-3 text-xs leading-5 text-slate-300">
              Odds, historical odds, player stats and player props remain blocked until exact authenticated endpoint paths and entitlements are confirmed.
            </p>
          </details>
          <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <summary className="cursor-pointer text-xs font-black uppercase text-indigo-200">
              Safe Next Actions
            </summary>
            <p className="mt-3 text-xs leading-5 text-slate-300">
              {sportsDataIoNbaReadiness?.handoff.safeNextActions[0] ??
                'No safe action is available from readiness.'}
            </p>
          </details>
          <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <summary className="cursor-pointer text-xs font-black uppercase text-indigo-200">
              External Blockers
            </summary>
            <p className="mt-3 text-xs leading-5 text-slate-300">
              {sportsDataIoNbaReadiness?.externalBlockerLedger.blockers[0]?.nextSafeAction ??
                'No external blockers reported.'}
            </p>
          </details>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              SportsDataIO NBA Handoff
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-100/80">
              Final zero-call domain matrix for trial-complete areas, production blockers and future pilot gates.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.handoff.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.handoff.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Domains"
            value={sportsDataIoNbaReadiness?.handoff.summary.domains ?? 0}
          />
          <Stat
            label="Trial Complete"
            value={sportsDataIoNbaReadiness?.handoff.summary.completeForTrialScope ?? 0}
          />
          <Stat
            label="Blocked"
            value={sportsDataIoNbaReadiness?.handoff.summary.blocked ?? 0}
          />
          <Stat
            label="Prod Blocked"
            value={sportsDataIoNbaReadiness?.handoff.summary.productionUseBlocked ?? 0}
          />
          <Stat
            label="Provider Calls"
            value={sportsDataIoNbaReadiness?.providerUsage.externalProviderCallsMade ?? 0}
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-sm font-black text-white">Domain Matrix</p>
            <div className="mt-4 grid gap-3">
              {(sportsDataIoNbaReadiness?.handoff.domains ?? []).map((domain) => (
                <div
                  key={domain.domain}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-black text-white">
                        {formatStatus(domain.domain)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {domain.persistence}
                      </p>
                    </div>
                    <p className={`text-xs font-black uppercase ${statusClass(domain.status)}`}>
                      {formatStatus(domain.status)}
                    </p>
                  </div>
                  {domain.blockers.length ? (
                    <p className="mt-3 text-xs leading-5 text-amber-100">
                      {domain.blockers[0]}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-sm font-black text-white">Production Gates</p>
            <div className="mt-4 grid gap-3">
              {(sportsDataIoNbaReadiness?.handoff.productionGates ?? [])
                .slice(0, 6)
                .map((gate) => (
                  <p
                    key={gate}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
                  >
                    {gate}
                  </p>
                ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-sm font-black text-white">Safe Next Actions</p>
            <div className="mt-4">
              <MiniRow
                label="Safe Next Actions Route"
                value="/api/providers/sportsdataio/nba/safe-next-actions"
              />
            </div>
            <div className="mt-4 grid gap-3">
              {(sportsDataIoNbaReadiness?.handoff.safeNextActions ?? [])
                .slice(0, 4)
                .map((action) => (
                  <p
                    key={action}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
                  >
                    {action}
                  </p>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Production Usage Exclusion
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-red-100/80">
              Zero-call proof that trial SportsDataIO NBA rows cannot enable prediction persistence, backtesting, model training or confidence lift.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.productionUsageExclusionAudit.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.productionUsageExclusionAudit.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Valid"
            value={sportsDataIoNbaReadiness?.productionUsageExclusionAudit.valid ? 1 : 0}
          />
          <Stat
            label="Pred Persist"
            value={sportsDataIoNbaReadiness?.productionUsageExclusionAudit.predictionPersistenceEnabled ? 1 : 0}
          />
          <Stat
            label="Backtesting"
            value={sportsDataIoNbaReadiness?.productionUsageExclusionAudit.backtestingEnabled ? 1 : 0}
          />
          <Stat
            label="Training"
            value={sportsDataIoNbaReadiness?.productionUsageExclusionAudit.modelTrainingEnabled ? 1 : 0}
          />
          <Stat
            label="Confidence Lift"
            value={sportsDataIoNbaReadiness?.productionUsageExclusionAudit.confidenceImprovementAllowed ? 1 : 0}
          />
        </div>

        <div className="mt-4">
          <MiniRow
            label="Exclusion Route"
            value="/api/providers/sportsdataio/nba/production-usage-exclusion"
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {(sportsDataIoNbaReadiness?.productionUsageExclusionAudit.checkedSurfaces ?? [])
            .slice(0, 4)
            .map((surface) => (
              <p
                key={surface.surface}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
              >
                <span className="font-bold text-white">
                  {formatStatus(surface.surface)}:
                </span>{' '}
                {surface.exclusionRule}
              </p>
            ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              External Blocker Resolution Checklist
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-100/80">
              Zero-call resolution steps that must be satisfied before any future capped SportsDataIO NBA pilot can reopen.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.externalBlockerResolutionChecklist.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.externalBlockerResolutionChecklist.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Valid"
            value={sportsDataIoNbaReadiness?.externalBlockerResolutionChecklist.valid ? 1 : 0}
          />
          <Stat
            label="Blockers"
            value={sportsDataIoNbaReadiness?.externalBlockerResolutionChecklist.summary.blockers ?? 0}
          />
          <Stat
            label="Evidence"
            value={sportsDataIoNbaReadiness?.externalBlockerResolutionChecklist.summary.requiredEvidenceItems ?? 0}
          />
          <Stat
            label="Pre-Calls"
            value={sportsDataIoNbaReadiness?.externalBlockerResolutionChecklist.summary.providerCallsAllowedBeforeResolution ?? 0}
          />
          <Stat
            label="Closed Gates"
            value={sportsDataIoNbaReadiness?.externalBlockerResolutionChecklist.summary.productionGatesClosed ?? 0}
          />
        </div>

        <div className="mt-4">
          <MiniRow
            label="Resolution Route"
            value="/api/providers/sportsdataio/nba/blocker-resolution"
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {(sportsDataIoNbaReadiness?.externalBlockerResolutionChecklist.items ?? [])
            .slice(0, 4)
            .map((item) => (
              <p
                key={item.blockerId}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
              >
                <span className="font-bold text-white">
                  {formatStatus(item.domain)}:
                </span>{' '}
                {item.resolutionSteps[0] ?? item.requiredEvidence[0] ?? 'Resolution evidence required.'}
              </p>
            ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Provider Execution Gate
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-100/80">
              Single go/no-go signal for whether any SportsDataIO NBA provider pilot may run now.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.providerExecutionGate.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.providerExecutionGate.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Valid"
            value={sportsDataIoNbaReadiness?.providerExecutionGate.valid ? 1 : 0}
          />
          <Stat
            label="Live Allowed"
            value={sportsDataIoNbaReadiness?.providerExecutionGate.liveExecutionAllowed ? 1 : 0}
          />
          <Stat
            label="Calls Now"
            value={sportsDataIoNbaReadiness?.providerExecutionGate.providerCallsAllowedNow ?? 0}
          />
          <Stat
            label="Blocked Domains"
            value={sportsDataIoNbaReadiness?.providerExecutionGate.blockedDomains.length ?? 0}
          />
          <Stat
            label="Checks"
            value={sportsDataIoNbaReadiness?.providerExecutionGate.checks.filter((check) => check.passed).length ?? 0}
          />
        </div>

        <div className="mt-4">
          <MiniRow
            label="Gate Route"
            value="/api/providers/sportsdataio/nba/provider-gate"
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {(sportsDataIoNbaReadiness?.providerExecutionGate.blockedDomains ?? [])
            .slice(0, 4)
            .map((domain) => (
              <p
                key={domain.domain}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
              >
                <span className="font-bold text-white">
                  {formatStatus(domain.domain)}:
                </span>{' '}
                {domain.evidenceRequired[0] ?? domain.nextSafeAction}
              </p>
            ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Production Gate Audit
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-100/80">
              Local verification that SportsDataIO NBA production execution remains blocked until external evidence is supplied.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.productionGateAudit.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.productionGateAudit.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <MiniRow
            label="Gate State Valid"
            value={sportsDataIoNbaReadiness?.productionGateAudit.valid ? 'Yes' : 'No'}
          />
          <MiniRow
            label="Checks Passed"
            value={`${sportsDataIoNbaReadiness?.productionGateAudit.checks.filter((check) => check.passed).length ?? 0}/${sportsDataIoNbaReadiness?.productionGateAudit.checks.length ?? 0}`}
          />
          <MiniRow
            label="Errors"
            value={`${sportsDataIoNbaReadiness?.productionGateAudit.errors.length ?? 0}`}
          />
        </div>

        <div className="mt-4">
          <MiniRow
            label="Production Gate Route"
            value="/api/providers/sportsdataio/nba/production-gate"
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Next Pilot Approval Checklist
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-100/80">
              Zero-call approval packet for future SportsDataIO NBA pilots. No provider requests are allowed before these gates are satisfied.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.nextPilotApprovalChecklist.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.nextPilotApprovalChecklist.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Domains"
            value={sportsDataIoNbaReadiness?.nextPilotApprovalChecklist.summary.domains ?? 0}
          />
          <Stat
            label="Pre-Approval Calls"
            value={sportsDataIoNbaReadiness?.nextPilotApprovalChecklist.summary.providerCallsAllowedBeforeApproval ?? 0}
          />
          <Stat
            label="Provider"
            value={sportsDataIoNbaReadiness?.nextPilotApprovalChecklist.summary.domainsRequiringProviderConfirmation ?? 0}
          />
          <Stat
            label="Operator"
            value={sportsDataIoNbaReadiness?.nextPilotApprovalChecklist.summary.domainsRequiringOperatorApproval ?? 0}
          />
          <Stat
            label="Product"
            value={sportsDataIoNbaReadiness?.nextPilotApprovalChecklist.summary.domainsRequiringProductOwner ?? 0}
          />
        </div>

        <MiniRow
          label="Preflight Route"
          value="/api/providers/sportsdataio/nba/next-pilot-preflight"
        />

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {(sportsDataIoNbaReadiness?.nextPilotApprovalChecklist.items ?? [])
            .slice(0, 3)
            .map((item) => (
              <p
                key={item.domain}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
              >
                <span className="font-bold text-white">
                  {formatStatus(item.domain)}:
                </span>{' '}
                {item.approvalsRequired[0] ?? 'Approval evidence unavailable.'}
              </p>
            ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              External Approval Packet
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-fuchsia-100/80">
              Operator-facing approval handoff for future capped SportsDataIO NBA pilots. This packet is not execution approval.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.externalApprovalPacket.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.externalApprovalPacket.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Domains"
            value={sportsDataIoNbaReadiness?.externalApprovalPacket.summary.domains ?? 0}
          />
          <Stat
            label="Pre-Approval Calls"
            value={sportsDataIoNbaReadiness?.externalApprovalPacket.summary.providerCallsAllowedBeforeApproval ?? 0}
          />
          <Stat
            label="Closed Gates"
            value={sportsDataIoNbaReadiness?.externalApprovalPacket.summary.productionGatesClosed ?? 0}
          />
          <Stat
            label="Blocking Items"
            value={sportsDataIoNbaReadiness?.externalApprovalPacket.summary.completionBlockingItems ?? 0}
          />
          <Stat
            label="Artifacts"
            value={sportsDataIoNbaReadiness?.externalApprovalPacket.evidenceArtifacts.length ?? 0}
          />
        </div>

        <div className="mt-4">
          <MiniRow
            label="Packet Route"
            value="/api/providers/sportsdataio/nba/approval-packet"
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {(sportsDataIoNbaReadiness?.externalApprovalPacket.requestedApprovals ?? [])
            .slice(0, 4)
            .map((approval) => (
              <p
                key={approval.domain}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
              >
                <span className="font-bold text-white">
                  {formatStatus(approval.domain)}:
                </span>{' '}
                {approval.evidenceRequired[0] ?? 'Approval evidence unavailable.'}
              </p>
            ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Blocked State Audit
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-red-100/80">
              Final local audit showing why the full SportsDataIO NBA objective cannot be marked complete yet.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.blockedStateAudit.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.blockedStateAudit.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Valid"
            value={sportsDataIoNbaReadiness?.blockedStateAudit.valid ? 1 : 0}
          />
          <Stat
            label="Completion OK"
            value={sportsDataIoNbaReadiness?.blockedStateAudit.completionClaimAllowed ? 1 : 0}
          />
          <Stat
            label="Blockers"
            value={sportsDataIoNbaReadiness?.blockedStateAudit.blockers.length ?? 0}
          />
          <Stat
            label="Checks"
            value={sportsDataIoNbaReadiness?.blockedStateAudit.checks.filter((check) => check.passed).length ?? 0}
          />
          <Stat
            label="Provider Calls"
            value={sportsDataIoNbaReadiness?.blockedStateAudit.generatedWithoutProviderCalls ? 0 : 1}
          />
        </div>

        <div className="mt-4">
          <MiniRow
            label="Audit Route"
            value="/api/providers/sportsdataio/nba/completion-audit"
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {(sportsDataIoNbaReadiness?.blockedStateAudit.blockers ?? [])
            .slice(0, 4)
            .map((blocker) => (
              <p
                key={blocker.domain}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
              >
                <span className="font-bold text-white">
                  {formatStatus(blocker.domain)}:
                </span>{' '}
                {blocker.evidenceRequired[0] ?? 'Required evidence unavailable.'}
              </p>
            ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Domain Completion Proof
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-100/80">
              Domain-by-domain evidence ledger for what is proven, trial-only, or still externally blocked.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.domainCompletionProofLedger.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.domainCompletionProofLedger.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Domains"
            value={sportsDataIoNbaReadiness?.domainCompletionProofLedger.summary.domains ?? 0}
          />
          <Stat
            label="Trial-Proven"
            value={sportsDataIoNbaReadiness?.domainCompletionProofLedger.summary.provenTrialScope ?? 0}
          />
          <Stat
            label="External Blocks"
            value={sportsDataIoNbaReadiness?.domainCompletionProofLedger.summary.blockedExternal ?? 0}
          />
          <Stat
            label="Goal Blocks"
            value={sportsDataIoNbaReadiness?.domainCompletionProofLedger.summary.blocksGoalCompletion ?? 0}
          />
          <Stat
            label="Pre-Approval Calls"
            value={sportsDataIoNbaReadiness?.domainCompletionProofLedger.summary.providerCallsAllowedBeforeApproval ?? 0}
          />
        </div>

        <div className="mt-4">
          <MiniRow
            label="Domain Proof Route"
            value="/api/providers/sportsdataio/nba/domain-proof"
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {(sportsDataIoNbaReadiness?.domainCompletionProofLedger.domains ?? [])
            .filter((domain) => domain.blocksGoalCompletion)
            .slice(0, 4)
            .map((domain) => (
              <p
                key={domain.domain}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
              >
                <span className="font-bold text-white">
                  {formatStatus(domain.domain)}:
                </span>{' '}
                {domain.requiredNextEvidence[0] ?? 'Required evidence unavailable.'}
              </p>
            ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Objective Audit
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
              Requirement-by-requirement status for the SportsDataIO NBA Integration and Historical Readiness objective.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.objectiveAudit.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.objectiveAudit.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Requirements"
            value={sportsDataIoNbaReadiness?.objectiveAudit.summary.requirements ?? 0}
          />
          <Stat
            label="Satisfied"
            value={sportsDataIoNbaReadiness?.objectiveAudit.summary.satisfied ?? 0}
          />
          <Stat
            label="Partial"
            value={sportsDataIoNbaReadiness?.objectiveAudit.summary.partiallySatisfied ?? 0}
          />
          <Stat
            label="External Blocks"
            value={sportsDataIoNbaReadiness?.objectiveAudit.summary.blockedExternal ?? 0}
          />
          <Stat
            label="Provider Calls"
            value={sportsDataIoNbaReadiness?.providerUsage.externalProviderCallsMade ?? 0}
          />
        </div>

        <div className="mt-4">
          <MiniRow
            label="Objective Audit Route"
            value="/api/providers/sportsdataio/nba/objective-audit"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(sportsDataIoNbaReadiness?.objectiveAudit.summary.remainingBlockers ?? [])
            .slice(0, 4)
            .map((item) => (
              <p
                key={`${item.requirement}:${item.blocker}`}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
              >
                <span className="font-bold text-white">
                  {formatStatus(item.requirement)}:
                </span>{' '}
                {item.blocker}
              </p>
            ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Completion Evidence Matrix
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-violet-100/80">
              Requirement evidence, unresolved proof gaps and goal-completion blockers for the full SportsDataIO NBA readiness objective.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.completionEvidenceMatrix.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.completionEvidenceMatrix.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Requirements"
            value={sportsDataIoNbaReadiness?.completionEvidenceMatrix.summary.requirements ?? 0}
          />
          <Stat
            label="Proven"
            value={sportsDataIoNbaReadiness?.completionEvidenceMatrix.summary.proven ?? 0}
          />
          <Stat
            label="Partial"
            value={sportsDataIoNbaReadiness?.completionEvidenceMatrix.summary.partial ?? 0}
          />
          <Stat
            label="Blocks"
            value={sportsDataIoNbaReadiness?.completionEvidenceMatrix.summary.blocksGoalCompletion ?? 0}
          />
          <Stat
            label="Provider Calls"
            value={sportsDataIoNbaReadiness?.completionEvidenceMatrix.generatedWithoutProviderCalls ? 0 : 1}
          />
        </div>

        <div className="mt-4">
          <MiniRow
            label="Completion Evidence Route"
            value="/api/providers/sportsdataio/nba/completion-evidence"
          />
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {(sportsDataIoNbaReadiness?.completionEvidenceMatrix.items ?? [])
            .filter((item) => item.blocksGoalCompletion)
            .slice(0, 4)
            .map((item) => (
              <div
                key={item.requirement}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <p className="font-black text-white">
                    {formatStatus(item.requirement)}
                  </p>
                  <p className={`text-xs font-black uppercase ${statusClass(item.status)}`}>
                    {formatStatus(item.status)}
                  </p>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-300">
                  {item.unresolvedEvidence[0] ?? 'No unresolved evidence recorded.'}
                </p>
                <p className="mt-3 text-xs leading-5 text-violet-100">
                  Artifact: {item.proofArtifacts[0] ?? 'Artifact unavailable.'}
                </p>
              </div>
            ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-sky-500/20 bg-sky-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Readiness Response Shape
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-sky-100/80">
              Local contract audit for the aggregate readiness endpoint response blocks and summary counts.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.responseShapeAudit.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.responseShapeAudit.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <MiniRow
            label="Contract Route"
            value="/api/providers/sportsdataio/nba/contract-audit"
          />
          <MiniRow
            label="Shape Valid"
            value={sportsDataIoNbaReadiness?.responseShapeAudit.valid ? 'Yes' : 'No'}
          />
          <MiniRow
            label="Checks Passed"
            value={`${sportsDataIoNbaReadiness?.responseShapeAudit.checks.filter((check) => check.passed).length ?? 0}/${sportsDataIoNbaReadiness?.responseShapeAudit.checks.length ?? 0}`}
          />
          <MiniRow
            label="Errors"
            value={`${sportsDataIoNbaReadiness?.responseShapeAudit.errors.length ?? 0}`}
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-teal-500/20 bg-teal-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Surface Consistency
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-teal-100/80">
              Zero-call alignment check across readiness, historical import and runtime observability surfaces.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.surfaceConsistencyAudit.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.surfaceConsistencyAudit.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Contract Route"
            value="/api/providers/sportsdataio/nba/contract-audit"
          />
          <Stat
            label="Surfaces"
            value={sportsDataIoNbaReadiness?.surfaceConsistencyAudit.surfaces.length ?? 0}
          />
          <Stat
            label="Checks"
            value={sportsDataIoNbaReadiness?.surfaceConsistencyAudit.checks.filter((check) => check.passed).length ?? 0}
          />
          <Stat
            label="Errors"
            value={sportsDataIoNbaReadiness?.surfaceConsistencyAudit.errors.length ?? 0}
          />
          <Stat
            label="Provider Calls"
            value={sportsDataIoNbaReadiness?.surfaceConsistencyAudit.generatedWithoutProviderCalls ? 0 : 1}
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {(sportsDataIoNbaReadiness?.surfaceConsistencyAudit.surfaces ?? [])
            .slice(0, 4)
            .map((surface) => (
              <p
                key={surface.surface}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
              >
                <span className="font-bold text-white">
                  {formatStatus(surface.surface)}:
                </span>{' '}
                {surface.expectedSignals[0] ?? 'Expected signal unavailable.'}
              </p>
            ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Readiness Evidence Export
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-emerald-100/80">
              Zero-call proof, blocker and guardrail summary for SportsDataIO NBA handoff verification.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.readinessEvidenceExport.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.readinessEvidenceExport.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Proven"
            value={sportsDataIoNbaReadiness?.readinessEvidenceExport.summary.proven ?? 0}
          />
          <Stat
            label="Blocked"
            value={sportsDataIoNbaReadiness?.readinessEvidenceExport.summary.blockedExternal ?? 0}
          />
          <Stat
            label="Guardrails"
            value={sportsDataIoNbaReadiness?.readinessEvidenceExport.summary.closedGuardrails ?? 0}
          />
          <Stat
            label="Artifacts"
            value={sportsDataIoNbaReadiness?.readinessEvidenceExport.summary.artifactsReferenced ?? 0}
          />
          <Stat
            label="Provider Calls"
            value={sportsDataIoNbaReadiness?.readinessEvidenceExport.summary.providerCallsMade ?? 0}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <MiniRow
            label="Evidence Route"
            value="/api/providers/sportsdataio/nba/evidence-export"
          />
          <MiniRow
            label="Export Valid"
            value={
              sportsDataIoNbaReadiness?.readinessEvidenceExport.validation.valid
                ? 'Yes'
                : 'No'
            }
          />
          <MiniRow
            label="Checks Passed"
            value={`${sportsDataIoNbaReadiness?.readinessEvidenceExport.validation.checks.filter((check) => check.passed).length ?? 0}/${sportsDataIoNbaReadiness?.readinessEvidenceExport.validation.checks.length ?? 0}`}
          />
          <MiniRow
            label="Errors"
            value={`${sportsDataIoNbaReadiness?.readinessEvidenceExport.validation.errors.length ?? 0}`}
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {(sportsDataIoNbaReadiness?.readinessEvidenceExport.proven ?? [])
            .slice(0, 3)
            .map((item) => (
              <p
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
              >
                <span className="font-bold text-white">{item.title}</span>
                <br />
                {item.evidence[0] ?? 'Evidence unavailable.'}
              </p>
            ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              External Blocker Ledger
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-100/80">
              Machine-readable blockers that must be resolved before production SportsDataIO NBA execution or confidence changes.
            </p>
          </div>
          <p className={`text-xs font-black uppercase ${statusClass(sportsDataIoNbaReadiness?.externalBlockerLedger.status ?? 'blocked')}`}>
            {formatStatus(sportsDataIoNbaReadiness?.externalBlockerLedger.status ?? 'blocked')}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Open Blocks"
            value={sportsDataIoNbaReadiness?.externalBlockerLedger.summary.total ?? 0}
          />
          <Stat
            label="Provider"
            value={sportsDataIoNbaReadiness?.externalBlockerLedger.summary.providerOwned ?? 0}
          />
          <Stat
            label="Operator"
            value={sportsDataIoNbaReadiness?.externalBlockerLedger.summary.operatorOwned ?? 0}
          />
          <Stat
            label="DB Admin"
            value={sportsDataIoNbaReadiness?.externalBlockerLedger.summary.databaseAdminOwned ?? 0}
          />
          <Stat
            label="Pre-Approval Calls"
            value={sportsDataIoNbaReadiness?.externalBlockerLedger.summary.providerCallsRequiredBeforeApproval ?? 0}
          />
        </div>

        <MiniRow
          label="Blocker Route"
          value="/api/providers/sportsdataio/nba/external-blockers"
        />

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {(sportsDataIoNbaReadiness?.externalBlockerLedger.blockers ?? [])
            .slice(0, 6)
            .map((blocker) => (
              <div
                key={blocker.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-black text-white">
                      {formatStatus(blocker.domain)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {formatStatus(blocker.category)} - {formatStatus(blocker.owner)}
                    </p>
                  </div>
                  <p className="text-xs font-black uppercase text-amber-300">
                    {blocker.productionGateClosed ? 'gate closed' : 'gate open'}
                  </p>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-300">
                  {blocker.nextSafeAction}
                </p>
                <p className="mt-3 text-xs leading-5 text-amber-100">
                  Evidence: {blocker.evidenceRequired[0] ?? 'Evidence requirement unavailable.'}
                </p>
              </div>
            ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black text-white">
              Next Pilot Gates
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-cyan-100/80">
              Zero-call preflight checks for blocked SportsDataIO NBA domains. These cards do not execute provider requests.
            </p>
          </div>
          <p className="text-xs font-black uppercase text-cyan-200">
            0 provider calls
          </p>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <EndpointGateCard
            title="Odds"
            status={sportsDataIoNbaReadiness?.nextPilotGatePreflights.odds.status ?? 'blocked'}
            providerCalls={sportsDataIoNbaReadiness?.nextPilotGatePreflights.odds.providerUsage.externalProviderCallsMade ?? 0}
            preflightRoute={sportsDataIoNbaReadiness?.nextPilotGatePreflights.odds.route ?? '/api/providers/sportsdataio/nba/odds/endpoint-preflight'}
            preflight={sportsDataIoNbaReadiness?.nextPilotGatePreflights.odds.endpointPreflight ?? null}
          />
          <EndpointGateCard
            title="Player Props"
            status={sportsDataIoNbaReadiness?.nextPilotGatePreflights.playerProps.status ?? 'blocked'}
            providerCalls={sportsDataIoNbaReadiness?.nextPilotGatePreflights.playerProps.providerUsage.externalProviderCallsMade ?? 0}
            preflightRoute={sportsDataIoNbaReadiness?.nextPilotGatePreflights.playerProps.route ?? '/api/providers/sportsdataio/nba/player-props/endpoint-preflight'}
            preflight={sportsDataIoNbaReadiness?.nextPilotGatePreflights.playerProps.endpointPreflight ?? null}
          />
          <MigrationGateCard
            status={sportsDataIoNbaReadiness?.nextPilotGatePreflights.playerStats.status ?? 'blocked'}
            providerCalls={sportsDataIoNbaReadiness?.nextPilotGatePreflights.playerStats.providerUsage.externalProviderCallsMade ?? 0}
            destinationTable={sportsDataIoNbaReadiness?.nextPilotGatePreflights.playerStats.destinationTable ?? 'sport_player_stats'}
            preflightRoute={sportsDataIoNbaReadiness?.nextPilotGatePreflights.playerStats.route ?? '/api/providers/sportsdataio/nba/player-stats/migration-preflight'}
            preflight={sportsDataIoNbaReadiness?.nextPilotGatePreflights.playerStats.migrationPreflight ?? null}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">NBA Sample Plan</p>
          <p className="mt-1 text-xs text-slate-500">
            basketball_nba · Jan 1-7, 2026 · 3-day batches
          </p>

          <div className="mt-4 grid gap-3">
            <MiniRow label="Status" value={plan?.status ?? 'unknown'} />
            <MiniRow
              label="Executable"
              value={String(plan?.job.executableCheckpoints ?? 0)}
            />
            <MiniRow
              label="Blocked"
              value={String(plan?.job.blockedCheckpoints ?? 0)}
            />
            <MiniRow
              label="Quota Impact"
              value={plan?.quotaEstimate.quotaImpact ?? 'none'}
            />
            <MiniRow
              label="Batch Size"
              value={`${plan?.quotaEstimate.recommendedBatchSizeDays ?? 0} days`}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 text-xs leading-5 text-amber-100">
            {plan?.quotaEstimate.warning ??
              'Dry-run only. No external provider execution is available.'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Planned Checkpoints</p>
          <div className="mt-4 grid gap-3">
            {(plan?.checkpoints ?? []).slice(0, 8).map((checkpoint) => (
              <div
                key={checkpoint.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black text-white">
                      {checkpoint.sequence}. {checkpoint.dataType}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {checkpoint.scope} · {checkpoint.dateFrom ?? 'season'} to{' '}
                      {checkpoint.dateTo ?? 'season'}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className={`text-xs font-black uppercase ${statusClass(checkpoint.status)}`}>
                      {checkpoint.status}
                    </p>
                    <p className="text-xs text-slate-500">
                      {checkpoint.estimatedProviderCalls} est. call
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {plan?.checkpoints.length === 0 ? (
              <p className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                No checkpoints planned.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm font-black text-white">Warnings</p>
        <div className="mt-3 grid gap-2 text-xs text-slate-400">
          {[...(health?.warnings ?? []), ...(plan?.validation.warnings ?? [])]
            .slice(0, 6)
            .map((warning) => (
              <p key={warning} className="leading-5">
                {warning}
              </p>
            ))}
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function EndpointGateCard({
  title,
  status,
  providerCalls,
  preflightRoute,
  preflight,
}: {
  title: string
  status: string
  providerCalls: number
  preflightRoute: string
  preflight: EndpointPreflight | null
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          <p className={`mt-1 text-xs font-black uppercase ${statusClass(status)}`}>
            {formatStatus(status)}
          </p>
        </div>
        <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1 text-xs font-bold text-slate-300">
          {providerCalls} calls
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        <MiniRow label="Preflight Route" value={preflightRoute} />
        <MiniRow
          label="Max Requests"
          value={`${preflight?.cappedPilotRequirements.maximumRequests ?? 0}`}
        />
        <MiniRow
          label="Concurrency"
          value={`${preflight?.cappedPilotRequirements.concurrency ?? 0}`}
        />
        <MiniRow
          label="Retries"
          value={preflight?.cappedPilotRequirements.automaticRetries ? 'Enabled' : 'Disabled'}
        />
      </div>

      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/20 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
          First Gate
        </p>
        <p className="mt-2 text-xs leading-5 text-amber-100">
          {preflight?.goNoGoGates[0] ?? 'Readiness gate unavailable.'}
        </p>
      </div>
    </div>
  )
}

function MigrationGateCard({
  status,
  providerCalls,
  destinationTable,
  preflightRoute,
  preflight,
}: {
  status: string
  providerCalls: number
  destinationTable: string
  preflightRoute: string
  preflight: PlayerStatsMigrationPreflight | null
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">Player Stats</p>
          <p className={`mt-1 text-xs font-black uppercase ${statusClass(status)}`}>
            {formatStatus(status)}
          </p>
        </div>
        <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1 text-xs font-bold text-slate-300">
          {providerCalls} calls
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        <MiniRow label="Table" value={destinationTable} />
        <MiniRow label="Preflight Route" value={preflightRoute} />
        <MiniRow
          label="Destructive"
          value={preflight?.destructiveChangeRequired ? 'Yes' : 'No'}
        />
        <MiniRow
          label="Indexes"
          value={`${preflight?.expectedIndexes.length ?? 0}`}
        />
      </div>

      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/20 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
          First Gate
        </p>
        <p className="mt-2 text-xs leading-5 text-amber-100">
          {preflight?.goNoGoGates[0] ?? 'Migration gate unavailable.'}
        </p>
      </div>
    </div>
  )
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  )
}
