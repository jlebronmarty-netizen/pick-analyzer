'use client'

import { useEffect, useState } from 'react'

type RuntimeResponse = {
  success: boolean
  status: string
  requestId: string
  providerUsage: {
    externalProviderCallsMade: number
  }
  summary: {
    syncJobs: number
    failedJobs: number
    partialJobs: number
    staleRunningJobs: number
    predictions: number
    pendingPredictions: number
    failedValidations: number
    unsettledClosed: number
    warningCount: number
    errorCount: number
    averageJobDurationMs: number
    providers: number
    unavailableProviders: number
  }
  syncJobs: {
    byStatus: { key: string; count: number }[]
    byType: { key: string; count: number }[]
    recentFailures: {
      id: string
      sportKey: string
      jobType: string
      provider: string
      lastError: string | null
      errorCount: number
    }[]
  }
  providers: {
    unavailable: {
      id: string
      name: string
      reason: string | null
    }[]
  }
  sportsDataIoNba?: {
    status: string
    providerUsage: {
      externalProviderCallsMade: number
      readinessCallsMade: number
      trialIsolationAuditCallsMade: number
    }
    readiness: {
      success: boolean
      status: string
      blockerCount: number
      readinessAreas: {
        key: string
        status: string
        providerCallsMade: number
        blockerCount: number
      }[]
      safeNextActions?: {
        route: string
        status: string
        actions: string[]
        productionGates: string[]
        providerCallsAllowedNow: number
        liveExecutionAllowed: boolean
      }
      oddsEndpointPreflight?: {
        route: string
        status: string
        providerCallsMade: number
        exactPathsConfirmed: boolean
        entitlementConfirmed: boolean
        sportsbookCoverageConfirmed: boolean
        historicalWindowsApproved: boolean
        requiredConfirmations: string[]
        cappedPilotRequirements: {
          maximumRequests: number
          concurrency: number
          automaticRetries: boolean
          dryRunDefault: boolean
          trial: boolean
          scrambled: boolean
          productionEligible: boolean
          stopOnNon200: boolean
        }
        goNoGoGates: string[]
      }
      playerPropsEndpointPreflight?: {
        route: string
        status: string
        providerCallsMade: number
        exactPathsConfirmed: boolean
        entitlementConfirmed: boolean
        sportsbookCoverageConfirmed: boolean
        settlementRulesImplemented: boolean
        requiredConfirmations: string[]
        cappedPilotRequirements: {
          maximumRequests: number
          concurrency: number
          automaticRetries: boolean
          dryRunDefault: boolean
          trial: boolean
          scrambled: boolean
          productionEligible: boolean
          stopOnNon200: boolean
        }
        goNoGoGates: string[]
      }
      playerStatsMigrationPreflight?: {
        route: string
        status: string
        providerCallsMade: number
        migration: string
        destinationTable: string
        appliedAutomatically: boolean
        destructiveChangeRequired: boolean
        expectedColumns: number
        expectedIndexes: number
        goNoGoGates: string[]
      }
      externalBlockerLedger?: {
        status: string
        route: string
        summary: {
          total: number
          providerOwned: number
          operatorOwned: number
          databaseAdminOwned: number
          productOwnerOwned: number
          providerCallsRequiredBeforeApproval: number
          productionGatesClosed: number
        }
        blockers: {
          id: string
          domain: string
          category: string
          owner: string
          nextSafeAction: string
          providerCallsRequiredBeforeApproval: number
          productionGateClosed: boolean
        }[]
      }
      readinessEvidenceExport?: {
        status: string
        route: string
        summary: {
          proven: number
          blockedExternal: number
          closedGuardrails: number
          artifactsReferenced: number
          providerCallsMade: number
          providerCallsRequiredBeforeApproval: number
        }
        validation: {
          valid: boolean
          checks: {
            id: string
            passed: boolean
            message: string
          }[]
          errors: string[]
          warnings: string[]
        }
      }
      productionGateAudit?: {
        route: string
        valid: boolean
        status: string
        checks: {
          id: string
          passed: boolean
          message: string
        }[]
        errors: string[]
        warnings: string[]
      }
      nextPilotApprovalChecklist?: {
        status: string
        route: string
        generatedWithoutProviderCalls: boolean
        summary: {
          domains: number
          providerCallsAllowedBeforeApproval: number
          domainsRequiringProviderConfirmation: number
          domainsRequiringOperatorApproval: number
          domainsRequiringDatabaseAdmin: number
          domainsRequiringProductOwner: number
        }
        items: {
          domain: string
          status: string
          approvalOwner: string
          approvalsRequired: string[]
          cappedExecutionRequirements: string[]
          providerCallsAllowedBeforeApproval: number
        }[]
      }
      objectiveAudit?: {
        route: string
        status: string
        summary: {
          requirements: number
          satisfied: number
          partiallySatisfied: number
          blockedExternal: number
          requirementsWithRemainingWork: number
          remainingBlockers: {
            requirement: string
            blocker: string
          }[]
        }
        items: {
          requirement: string
          status: string
          evidence: string[]
          remainingWork: string[]
        }[]
      }
      completionEvidenceMatrix?: {
        route: string
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
        items: {
          requirement: string
          status: string
          unresolvedEvidence: string[]
          proofArtifacts: string[]
          blocksGoalCompletion: boolean
        }[]
      }
      responseShapeAudit?: {
        valid: boolean
        route: string
        status: string
        checks: {
          id: string
          passed: boolean
          message: string
        }[]
        errors: string[]
        warnings: string[]
      }
      surfaceConsistencyAudit?: {
        valid: boolean
        route: string
        status: string
        generatedWithoutProviderCalls: boolean
        checks: {
          id: string
          passed: boolean
          message: string
        }[]
        errors: string[]
        warnings: string[]
        surfaces: {
          surface: string
          artifact: string
          expectedSignals: string[]
        }[]
      }
      externalApprovalPacket?: {
        status: string
        route: string
        generatedWithoutProviderCalls: boolean
        summary: {
          domains: number
          providerCallsAllowedBeforeApproval: number
          productionGatesClosed: number
          completionBlockingItems: number
          surfaceConsistencyValid: boolean
        }
        requestedApprovals: {
          domain: string
          owner: string
          evidenceRequired: string[]
          unblocks: string[]
        }[]
        executionConstraints: string[]
        prohibitedActions: string[]
        evidenceArtifacts: string[]
      }
      blockedStateAudit?: {
        valid: boolean
        status: string
        route: string
        generatedWithoutProviderCalls: boolean
        completionClaimAllowed: boolean
        blockers: {
          domain: string
          owner: string
          evidenceRequired: string[]
        }[]
        checks: {
          id: string
          passed: boolean
          message: string
        }[]
        errors: string[]
        warnings: string[]
      }
      domainCompletionProofLedger?: {
        route: string
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
        domains: {
          domain: string
          handoffStatus: string
          proofState: string
          productionUse: string
          requiredNextEvidence: string[]
          linkedBlockerIds: string[]
          linkedRequirements: string[]
          blocksGoalCompletion: boolean
          providerCallsAllowedBeforeApproval: number
          productionGateClosed: boolean
        }[]
        checks: {
          id: string
          passed: boolean
          message: string
        }[]
        errors: string[]
        warnings: string[]
      }
      providerExecutionGate?: {
        route: string
        valid: boolean
        status: string
        generatedWithoutProviderCalls: boolean
        liveExecutionAllowed: boolean
        providerCallsAllowedNow: number
        allowedDomains: string[]
        blockedDomains: {
          domain: string
          owner: string
          evidenceRequired: string[]
          nextSafeAction: string
          productionGateClosed: boolean
        }[]
        constraints: string[]
        checks: {
          id: string
          passed: boolean
          message: string
        }[]
        errors: string[]
        warnings: string[]
      }
      externalBlockerResolutionChecklist?: {
        route: string
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
        items: {
          domain: string
          blockerId: string
          owner: string
          category: string
          requiredEvidence: string[]
          resolutionSteps: string[]
          preExecutionVerification: string[]
          providerCallsAllowedBeforeResolution: number
          productionGateMustRemainClosed: boolean
        }[]
        checks: {
          id: string
          passed: boolean
          message: string
        }[]
        errors: string[]
        warnings: string[]
      }
      executionReadinessValidation?: {
        success: boolean
        mode: string
        route: string
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
      productionUsageExclusionAudit?: {
        route: string
        valid: boolean
        status: string
        generatedWithoutProviderCalls: boolean
        trialRowsProductionEligible: boolean
        predictionPersistenceEnabled: boolean
        backtestingEnabled: boolean
        modelTrainingEnabled: boolean
        confidenceImprovementAllowed: boolean
        checkedSurfaces: {
          surface: string
          artifact: string
          exclusionRule: string
        }[]
        checks: {
          id: string
          passed: boolean
          message: string
        }[]
        errors: string[]
        warnings: string[]
      }
    }
    trialIsolation: {
      success: boolean
      status: string
      unavailableReason?: string | null
      totals?: {
        sportsDataIoRows: number
        trialRows: number
        isolationViolations: number
        productionEligibleViolations: number
      }
      predictionLeakage?: {
        predictionsReferencingTrialEvents: number
        predictionsWithTrialSnapshots: number
      }
      unavailableTables?: {
        table: string
        reason: string | null
      }[]
    }
    safetyInvariants: {
      noProviderCalls: boolean
      trialIsolationAudited: boolean
      productionReadinessBlocked: boolean
      externalBlockerLedgerAvailable?: boolean
      allExternalProductionGatesClosed?: boolean
      readinessEvidenceExportValid?: boolean
      productionGateAuditValid?: boolean
      nextPilotApprovalChecklistZeroPreapprovalCalls?: boolean
      completionEvidenceMatrixAvailable?: boolean
      responseShapeAuditValid?: boolean
      surfaceConsistencyAuditValid?: boolean
      externalApprovalPacketZeroCall?: boolean
      blockedStateAuditValid?: boolean
      domainCompletionProofLedgerValid?: boolean
      providerExecutionGateClosed?: boolean
      externalBlockerResolutionChecklistValid?: boolean
      executionReadinessValidationValid?: boolean
      productionUsageExclusionAuditValid?: boolean
    }
  }
  warnings: string[]
}

function statusClass(status: string) {
  if (['healthy', 'trial_isolation_preserved'].includes(status)) return 'text-emerald-300'
  if ([
    'warning',
    'ready_with_external_blockers',
    'ready_for_handoff_with_external_blockers',
    'valid_with_external_blockers',
    'production_blocked_as_expected',
    'blocked_until_external_approval',
    'blocked_until_approved',
    'not_complete_evidence_gaps_remaining',
    'consistent_with_external_blockers',
    'ready_for_external_approval_handoff',
    'externally_blocked_not_complete',
    'not_complete_external_evidence_required',
    'provider_execution_blocked_pending_approval',
    'blocked_pending_external_evidence',
    'production_usage_excluded_for_trial_data',
    'audit_unavailable',
    'open_external_blockers_remaining',
  ].includes(status)) return 'text-amber-300'
  return 'text-red-300'
}

function statusBorderClass(status: string) {
  if (['healthy', 'trial_isolation_preserved'].includes(status)) return 'border-emerald-500/30 bg-emerald-950/10'
  if ([
    'warning',
    'ready_with_external_blockers',
    'ready_for_handoff_with_external_blockers',
    'valid_with_external_blockers',
    'production_blocked_as_expected',
    'blocked_until_external_approval',
    'blocked_until_approved',
    'not_complete_evidence_gaps_remaining',
    'consistent_with_external_blockers',
    'ready_for_external_approval_handoff',
    'externally_blocked_not_complete',
    'not_complete_external_evidence_required',
    'provider_execution_blocked_pending_approval',
    'blocked_pending_external_evidence',
    'production_usage_excluded_for_trial_data',
    'audit_unavailable',
    'open_external_blockers_remaining',
  ].includes(status)) return 'border-amber-500/30 bg-amber-950/10'
  return 'border-red-500/30 bg-red-950/10'
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ')
}

export default function RuntimeObservabilityPanel() {
  const [data, setData] = useState<RuntimeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/observability/runtime', {
        cache: 'no-store',
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(
          json.error?.message ?? json.error ?? 'Unable to load runtime observability'
        )
      }

      setData(json)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load runtime observability'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading && !data) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
        Loading Runtime Observability...
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
            Runtime Observability
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Operational Health
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Aggregates sync jobs, prediction lifecycle, provider state and recent failures from stored operational data.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className={`text-sm font-black uppercase ${statusClass(data?.status ?? 'error')}`}>
            {data?.status ?? 'unknown'}
          </p>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 px-4 py-2 text-sm font-bold text-indigo-100 hover:bg-indigo-900/40"
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
        <Stat label="Sync Jobs" value={data?.summary.syncJobs ?? 0} />
        <Stat label="Failures" value={data?.summary.failedJobs ?? 0} />
        <Stat label="Predictions" value={data?.summary.predictions ?? 0} />
        <Stat label="Pending" value={data?.summary.pendingPredictions ?? 0} />
        <Stat label="Provider Calls" value={data?.providerUsage.externalProviderCallsMade ?? 0} />
      </div>

      {data?.sportsDataIoNba ? (
        <SportsDataIoNbaCard data={data.sportsDataIoNba} />
      ) : null}

      {data?.warnings.length ? (
        <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
            Warnings
          </p>
          <div className="mt-3 grid gap-2">
            {data.warnings.map((warning) => (
              <p key={warning} className="text-sm text-amber-100">
                {warning}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <List title="Sync Status" rows={data?.syncJobs.byStatus ?? []} />
        <List title="Sync Types" rows={data?.syncJobs.byType ?? []} />
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Unavailable Providers</p>
          <div className="mt-4 grid gap-3">
            {data?.providers.unavailable.length ? (
              data.providers.unavailable.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                >
                  <p className="text-sm font-bold text-white">{provider.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {provider.reason ?? 'No reason recorded'}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                No unavailable providers in the current registry state.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function SportsDataIoNbaCard({
  data,
}: {
  data: NonNullable<RuntimeResponse['sportsDataIoNba']>
}) {
  const totals = data.trialIsolation.totals
  const predictionLeakage = data.trialIsolation.predictionLeakage
  const unavailableTables = data.trialIsolation.unavailableTables ?? []
  const safeNextActions = data.readiness.safeNextActions
  const oddsEndpointPreflight = data.readiness.oddsEndpointPreflight
  const playerPropsEndpointPreflight =
    data.readiness.playerPropsEndpointPreflight
  const playerStatsMigrationPreflight =
    data.readiness.playerStatsMigrationPreflight
  const externalBlockerLedger = data.readiness.externalBlockerLedger
  const readinessEvidenceExport = data.readiness.readinessEvidenceExport
  const productionGateAudit = data.readiness.productionGateAudit
  const nextPilotApprovalChecklist = data.readiness.nextPilotApprovalChecklist
  const objectiveAudit = data.readiness.objectiveAudit
  const completionEvidenceMatrix = data.readiness.completionEvidenceMatrix
  const responseShapeAudit = data.readiness.responseShapeAudit
  const surfaceConsistencyAudit = data.readiness.surfaceConsistencyAudit
  const externalApprovalPacket = data.readiness.externalApprovalPacket
  const blockedStateAudit = data.readiness.blockedStateAudit
  const domainCompletionProofLedger = data.readiness.domainCompletionProofLedger
  const providerExecutionGate = data.readiness.providerExecutionGate
  const externalBlockerResolutionChecklist =
    data.readiness.externalBlockerResolutionChecklist
  const executionReadinessValidation =
    data.readiness.executionReadinessValidation
  const productionUsageExclusionAudit =
    data.readiness.productionUsageExclusionAudit
  const isolationViolations =
    (totals?.isolationViolations ?? 0) + (totals?.productionEligibleViolations ?? 0)
  const predictionLeaks =
    (predictionLeakage?.predictionsReferencingTrialEvents ?? 0) +
    (predictionLeakage?.predictionsWithTrialSnapshots ?? 0)

  return (
    <div className={`mt-5 rounded-2xl border p-4 ${statusBorderClass(data.status)}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">
            SportsDataIO NBA
          </p>
          <p className={`mt-2 text-lg font-black capitalize ${statusClass(data.status)}`}>
            {formatStatus(data.status)}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Runtime view of readiness blockers and stored trial-isolation checks. This panel does not execute provider calls.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Provider Calls
          </p>
          <p className="mt-1 text-2xl font-black text-white">
            {data.providerUsage.externalProviderCallsMade}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Readiness Blockers" value={data.readiness.blockerCount} />
        <Stat label="Trial Rows" value={totals?.trialRows ?? 0} />
        <Stat label="SportsDataIO Rows" value={totals?.sportsDataIoRows ?? 0} />
        <Stat label="Isolation Issues" value={isolationViolations} />
        <Stat label="Prediction Leaks" value={predictionLeaks} />
      </div>

      {safeNextActions ? (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Safe Next Actions</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(safeNextActions.status)}`}>
                {formatStatus(safeNextActions.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-slate-100">
              {safeNextActions.liveExecutionAllowed ? 'execution allowed' : 'execution closed'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Stat label="Actions" value={safeNextActions.actions.length} />
            <Stat label="Production Gates" value={safeNextActions.productionGates.length} />
            <Stat label="Calls Now" value={safeNextActions.providerCallsAllowedNow} />
          </div>

          <p className="mt-3 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-200">
            Safe next actions route: {safeNextActions.route}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {safeNextActions.actions.slice(0, 4).map((action) => (
              <p
                key={action}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300"
              >
                {action}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {oddsEndpointPreflight ? (
        <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Odds Endpoint Preflight</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(oddsEndpointPreflight.status)}`}>
                {formatStatus(oddsEndpointPreflight.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-cyan-100">
              {oddsEndpointPreflight.providerCallsMade} provider calls
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Stat label="Max Requests" value={oddsEndpointPreflight.cappedPilotRequirements.maximumRequests} />
            <Stat label="Concurrency" value={oddsEndpointPreflight.cappedPilotRequirements.concurrency} />
            <Stat label="Paths" value={oddsEndpointPreflight.exactPathsConfirmed ? 1 : 0} />
            <Stat label="Entitlement" value={oddsEndpointPreflight.entitlementConfirmed ? 1 : 0} />
            <Stat label="History Window" value={oddsEndpointPreflight.historicalWindowsApproved ? 1 : 0} />
          </div>

          <p className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-xs font-semibold text-cyan-100">
            Odds endpoint preflight route: {oddsEndpointPreflight.route}
          </p>

          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-200">
            {oddsEndpointPreflight.goNoGoGates[0] ?? 'Odds preflight gate unavailable.'}
          </p>
        </div>
      ) : null}

      {playerPropsEndpointPreflight ? (
        <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Player Props Endpoint Preflight</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(playerPropsEndpointPreflight.status)}`}>
                {formatStatus(playerPropsEndpointPreflight.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-cyan-100">
              {playerPropsEndpointPreflight.providerCallsMade} provider calls
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Stat label="Max Requests" value={playerPropsEndpointPreflight.cappedPilotRequirements.maximumRequests} />
            <Stat label="Concurrency" value={playerPropsEndpointPreflight.cappedPilotRequirements.concurrency} />
            <Stat label="Paths" value={playerPropsEndpointPreflight.exactPathsConfirmed ? 1 : 0} />
            <Stat label="Entitlement" value={playerPropsEndpointPreflight.entitlementConfirmed ? 1 : 0} />
            <Stat label="Settlement" value={playerPropsEndpointPreflight.settlementRulesImplemented ? 1 : 0} />
          </div>

          <p className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-xs font-semibold text-cyan-100">
            Player props endpoint preflight route: {playerPropsEndpointPreflight.route}
          </p>

          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-200">
            {playerPropsEndpointPreflight.goNoGoGates[0] ?? 'Player props preflight gate unavailable.'}
          </p>
        </div>
      ) : null}

      {playerStatsMigrationPreflight ? (
        <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Player Stats Migration Preflight</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(playerStatsMigrationPreflight.status)}`}>
                {formatStatus(playerStatsMigrationPreflight.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-cyan-100">
              {playerStatsMigrationPreflight.appliedAutomatically ? 'auto applied' : 'manual only'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Stat label="Provider Calls" value={playerStatsMigrationPreflight.providerCallsMade} />
            <Stat label="Columns" value={playerStatsMigrationPreflight.expectedColumns} />
            <Stat label="Indexes" value={playerStatsMigrationPreflight.expectedIndexes} />
            <Stat
              label="Destructive"
              value={playerStatsMigrationPreflight.destructiveChangeRequired ? 1 : 0}
            />
            <Stat label="Gates" value={playerStatsMigrationPreflight.goNoGoGates.length} />
          </div>

          <p className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-xs font-semibold text-cyan-100">
            Migration preflight route: {playerStatsMigrationPreflight.route}
          </p>

          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs font-semibold text-slate-200">
            {playerStatsMigrationPreflight.destinationTable} via {playerStatsMigrationPreflight.migration}
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Readiness Areas</p>
          <div className="mt-3 grid gap-2">
            {data.readiness.readinessAreas.slice(0, 5).map((area) => (
              <div
                key={area.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <div>
                  <p className="text-sm font-bold text-white">{formatStatus(area.key)}</p>
                  <p className={`mt-1 text-xs capitalize ${statusClass(area.status)}`}>
                    {formatStatus(area.status)}
                  </p>
                </div>
                <p className="text-sm font-bold text-slate-300">
                  {area.blockerCount} blocker{area.blockerCount === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-sm font-black text-white">Trial Isolation</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-300">
            <p>No provider calls: {data.safetyInvariants.noProviderCalls ? 'yes' : 'no'}</p>
            <p>Audit available: {data.safetyInvariants.trialIsolationAudited ? 'yes' : 'no'}</p>
            <p>Production readiness blocked: {data.safetyInvariants.productionReadinessBlocked ? 'yes' : 'no'}</p>
            {data.trialIsolation.unavailableReason ? (
              <p className="text-amber-200">{data.trialIsolation.unavailableReason}</p>
            ) : null}
            {unavailableTables.length ? (
              <p className="text-amber-200">
                {unavailableTables.length} optional audit table{unavailableTables.length === 1 ? '' : 's'} unavailable.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {externalBlockerLedger ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/20 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">External Blocker Ledger</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(externalBlockerLedger.status)}`}>
                {formatStatus(externalBlockerLedger.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-amber-100">
              {externalBlockerLedger.summary.providerCallsRequiredBeforeApproval} pre-approval calls
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="Open Blocks" value={externalBlockerLedger.summary.total} />
            <Stat label="Provider Owned" value={externalBlockerLedger.summary.providerOwned} />
            <Stat label="Product Owned" value={externalBlockerLedger.summary.productOwnerOwned} />
            <Stat label="Closed Gates" value={externalBlockerLedger.summary.productionGatesClosed} />
          </div>

          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs font-bold text-amber-100">
            Blocker route: {externalBlockerLedger.route}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {externalBlockerLedger.blockers.slice(0, 4).map((blocker) => (
              <div
                key={blocker.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {formatStatus(blocker.domain)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatStatus(blocker.category)} - {formatStatus(blocker.owner)}
                    </p>
                  </div>
                  <p className="text-xs font-black uppercase text-amber-300">
                    {blocker.productionGateClosed ? 'closed' : 'open'}
                  </p>
                </div>
                <p className="mt-3 text-xs leading-5 text-amber-100">
                  {blocker.nextSafeAction}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {readinessEvidenceExport ? (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Evidence Export</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(readinessEvidenceExport.status)}`}>
                {formatStatus(readinessEvidenceExport.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-emerald-100">
              {readinessEvidenceExport.validation.valid ? 'valid' : 'invalid'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="Proven" value={readinessEvidenceExport.summary.proven} />
            <Stat label="Blocked" value={readinessEvidenceExport.summary.blockedExternal} />
            <Stat label="Guardrails" value={readinessEvidenceExport.summary.closedGuardrails} />
            <Stat
              label="Checks"
              value={readinessEvidenceExport.validation.checks.filter((check) => check.passed).length}
            />
          </div>

          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs font-bold text-emerald-100">
            Evidence route: {readinessEvidenceExport.route}
          </p>
        </div>
      ) : null}

      {productionGateAudit ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Production Gate Audit</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(productionGateAudit.status)}`}>
                {formatStatus(productionGateAudit.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-amber-100">
              {productionGateAudit.valid ? 'valid' : 'invalid'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Stat
              label="Checks"
              value={productionGateAudit.checks.filter((check) => check.passed).length}
            />
            <Stat label="Errors" value={productionGateAudit.errors.length} />
            <Stat label="Warnings" value={productionGateAudit.warnings.length} />
          </div>

          <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs font-semibold text-amber-100">
            Production gate route: {productionGateAudit.route}
          </p>
        </div>
      ) : null}

      {providerExecutionGate ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Provider Execution Gate</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(providerExecutionGate.status)}`}>
                {formatStatus(providerExecutionGate.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-amber-100">
              {providerExecutionGate.liveExecutionAllowed ? 'execution allowed' : 'execution closed'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Stat label="Valid" value={providerExecutionGate.valid ? 1 : 0} />
            <Stat label="Calls Now" value={providerExecutionGate.providerCallsAllowedNow} />
            <Stat label="Blocked" value={providerExecutionGate.blockedDomains.length} />
            <Stat
              label="Checks"
              value={providerExecutionGate.checks.filter((check) => check.passed).length}
            />
            <Stat label="Errors" value={providerExecutionGate.errors.length} />
          </div>

          <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs font-semibold text-amber-100">
            Gate route: {providerExecutionGate.route}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {providerExecutionGate.blockedDomains.slice(0, 4).map((domain) => (
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
      ) : null}

      {externalBlockerResolutionChecklist ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Blocker Resolution Checklist</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(externalBlockerResolutionChecklist.status)}`}>
                {formatStatus(externalBlockerResolutionChecklist.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-amber-100">
              {externalBlockerResolutionChecklist.generatedWithoutProviderCalls ? 'zero-call generated' : 'call usage detected'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Stat label="Valid" value={externalBlockerResolutionChecklist.valid ? 1 : 0} />
            <Stat label="Blockers" value={externalBlockerResolutionChecklist.summary.blockers} />
            <Stat label="Evidence" value={externalBlockerResolutionChecklist.summary.requiredEvidenceItems} />
            <Stat
              label="Pre-Calls"
              value={externalBlockerResolutionChecklist.summary.providerCallsAllowedBeforeResolution}
            />
            <Stat label="Closed Gates" value={externalBlockerResolutionChecklist.summary.productionGatesClosed} />
          </div>

          <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs font-semibold text-amber-100">
            Resolution route: {externalBlockerResolutionChecklist.route}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {externalBlockerResolutionChecklist.items.slice(0, 4).map((item) => (
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
      ) : null}

      {executionReadinessValidation ? (
        <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Execution Readiness Validation</p>
              <p className={`mt-1 text-xs font-black uppercase ${executionReadinessValidation.success ? 'text-emerald-300' : 'text-red-300'}`}>
                {executionReadinessValidation.success ? 'valid' : 'invalid'}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-cyan-100">
              {executionReadinessValidation.route}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Stat label="Passed" value={executionReadinessValidation.summary.passed} />
            <Stat label="Provider Calls" value={executionReadinessValidation.providerUsage.externalProviderCallsMade} />
            <Stat label="Dry Runs" value={executionReadinessValidation.summary.dryRunCheckpoints} />
            <Stat label="Skipped" value={executionReadinessValidation.summary.oneToManyExpansionRecordsSkipped} />
            <Stat label="Pilot Calls" value={executionReadinessValidation.summary.pilotEstimatedCalls} />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300">
              <span className="font-bold text-white">Provider gate:</span>{' '}
              {formatStatus(executionReadinessValidation.summary.providerExecutionGateStatus)}
            </p>
            <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300">
              <span className="font-bold text-white">Resolution checklist:</span>{' '}
              {formatStatus(executionReadinessValidation.summary.externalBlockerResolutionChecklistStatus)}
            </p>
            <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-slate-300">
              <span className="font-bold text-white">Usage exclusion:</span>{' '}
              {formatStatus(executionReadinessValidation.summary.productionUsageExclusionAuditStatus)}
            </p>
          </div>
        </div>
      ) : null}

      {productionUsageExclusionAudit ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Production Usage Exclusion</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(productionUsageExclusionAudit.status)}`}>
                {formatStatus(productionUsageExclusionAudit.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-red-100">
              {productionUsageExclusionAudit.generatedWithoutProviderCalls ? 'zero-call generated' : 'call usage detected'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Stat label="Valid" value={productionUsageExclusionAudit.valid ? 1 : 0} />
            <Stat label="Pred Persist" value={productionUsageExclusionAudit.predictionPersistenceEnabled ? 1 : 0} />
            <Stat label="Backtesting" value={productionUsageExclusionAudit.backtestingEnabled ? 1 : 0} />
            <Stat label="Training" value={productionUsageExclusionAudit.modelTrainingEnabled ? 1 : 0} />
            <Stat label="Confidence Lift" value={productionUsageExclusionAudit.confidenceImprovementAllowed ? 1 : 0} />
          </div>

          <p className="mt-3 rounded-lg border border-red-500/20 bg-red-950/20 px-3 py-2 text-xs font-semibold text-red-100">
            Exclusion route: {productionUsageExclusionAudit.route}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {productionUsageExclusionAudit.checkedSurfaces.slice(0, 4).map((surface) => (
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
      ) : null}

      {nextPilotApprovalChecklist ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Next Pilot Approval</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(nextPilotApprovalChecklist.status)}`}>
                {formatStatus(nextPilotApprovalChecklist.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-amber-100">
              {nextPilotApprovalChecklist.generatedWithoutProviderCalls ? 'zero-call generated' : 'call usage detected'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="Domains" value={nextPilotApprovalChecklist.summary.domains} />
            <Stat
              label="Pre-Approval Calls"
              value={nextPilotApprovalChecklist.summary.providerCallsAllowedBeforeApproval}
            />
            <Stat
              label="Provider"
              value={nextPilotApprovalChecklist.summary.domainsRequiringProviderConfirmation}
            />
            <Stat
              label="Operator"
              value={nextPilotApprovalChecklist.summary.domainsRequiringOperatorApproval}
            />
          </div>

          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs font-bold text-amber-100">
            Preflight route: {nextPilotApprovalChecklist.route}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {nextPilotApprovalChecklist.items.slice(0, 4).map((item) => (
              <div
                key={item.domain}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {formatStatus(item.domain)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatStatus(item.approvalOwner)}
                    </p>
                  </div>
                  <p className="text-xs font-black uppercase text-amber-300">
                    {formatStatus(item.status)}
                  </p>
                </div>
                <p className="mt-3 text-xs leading-5 text-amber-100">
                  {item.approvalsRequired[0] ?? 'External approval required before live pilot execution.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {objectiveAudit ? (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Objective Audit</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(objectiveAudit.status)}`}>
                {formatStatus(objectiveAudit.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-slate-100">
              {objectiveAudit.summary.requirementsWithRemainingWork > 0 ? 'remaining work' : 'no remaining work'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Stat label="Requirements" value={objectiveAudit.summary.requirements} />
            <Stat label="Satisfied" value={objectiveAudit.summary.satisfied} />
            <Stat label="Partial" value={objectiveAudit.summary.partiallySatisfied} />
            <Stat label="External Blocks" value={objectiveAudit.summary.blockedExternal} />
            <Stat label="Remaining" value={objectiveAudit.summary.requirementsWithRemainingWork} />
          </div>

          <p className="mt-3 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-200">
            Objective audit route: {objectiveAudit.route}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {objectiveAudit.items.slice(0, 4).map((item) => (
              <div
                key={item.requirement}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-white">
                    {formatStatus(item.requirement)}
                  </p>
                  <p className={`text-xs font-black uppercase ${statusClass(item.status)}`}>
                    {formatStatus(item.status)}
                  </p>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-300">
                  {item.remainingWork[0] ?? 'No remaining work recorded.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {completionEvidenceMatrix ? (
        <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Completion Evidence</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(completionEvidenceMatrix.status)}`}>
                {formatStatus(completionEvidenceMatrix.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-violet-100">
              {completionEvidenceMatrix.generatedWithoutProviderCalls ? 'zero-call generated' : 'call usage detected'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="Requirements" value={completionEvidenceMatrix.summary.requirements} />
            <Stat label="Proven" value={completionEvidenceMatrix.summary.proven} />
            <Stat label="Partial" value={completionEvidenceMatrix.summary.partial} />
            <Stat label="Blocks" value={completionEvidenceMatrix.summary.blocksGoalCompletion} />
          </div>

          <p className="mt-3 rounded-lg border border-violet-500/20 bg-violet-950/20 px-3 py-2 text-xs font-semibold text-violet-100">
            Completion evidence route: {completionEvidenceMatrix.route}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {completionEvidenceMatrix.items.slice(0, 4).map((item) => (
              <div
                key={item.requirement}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-white">
                    {formatStatus(item.requirement)}
                  </p>
                  <p className={`text-xs font-black uppercase ${statusClass(item.status)}`}>
                    {formatStatus(item.status)}
                  </p>
                </div>
                <p className="mt-3 text-xs leading-5 text-violet-100">
                  {item.unresolvedEvidence[0] ?? 'No unresolved evidence recorded.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {responseShapeAudit ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Response Shape Audit</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(responseShapeAudit.status)}`}>
                {formatStatus(responseShapeAudit.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-amber-100">
              {responseShapeAudit.valid ? 'valid' : 'invalid'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Stat
              label="Checks"
              value={responseShapeAudit.checks.filter((check) => check.passed).length}
            />
            <Stat label="Errors" value={responseShapeAudit.errors.length} />
            <Stat label="Warnings" value={responseShapeAudit.warnings.length} />
          </div>

          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs font-bold text-amber-100">
            Contract route: {responseShapeAudit.route}
          </p>
        </div>
      ) : null}

      {surfaceConsistencyAudit ? (
        <div className="mt-4 rounded-xl border border-teal-500/20 bg-teal-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Surface Consistency</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(surfaceConsistencyAudit.status)}`}>
                {formatStatus(surfaceConsistencyAudit.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-teal-100">
              {surfaceConsistencyAudit.generatedWithoutProviderCalls ? 'zero-call generated' : 'call usage detected'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="Surfaces" value={surfaceConsistencyAudit.surfaces.length} />
            <Stat
              label="Checks"
              value={surfaceConsistencyAudit.checks.filter((check) => check.passed).length}
            />
            <Stat label="Errors" value={surfaceConsistencyAudit.errors.length} />
            <Stat label="Warnings" value={surfaceConsistencyAudit.warnings.length} />
          </div>

          <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs font-bold text-teal-100">
            Contract route: {surfaceConsistencyAudit.route}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {surfaceConsistencyAudit.surfaces.slice(0, 4).map((surface) => (
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
      ) : null}

      {externalApprovalPacket ? (
        <div className="mt-4 rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">External Approval Packet</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(externalApprovalPacket.status)}`}>
                {formatStatus(externalApprovalPacket.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-fuchsia-100">
              {externalApprovalPacket.generatedWithoutProviderCalls ? 'zero-call generated' : 'call usage detected'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="Domains" value={externalApprovalPacket.summary.domains} />
            <Stat
              label="Pre-Approval Calls"
              value={externalApprovalPacket.summary.providerCallsAllowedBeforeApproval}
            />
            <Stat
              label="Closed Gates"
              value={externalApprovalPacket.summary.productionGatesClosed}
            />
            <Stat
              label="Blocking Items"
              value={externalApprovalPacket.summary.completionBlockingItems}
            />
          </div>

          <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-fuchsia-100">
            {externalApprovalPacket.route}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {externalApprovalPacket.requestedApprovals.slice(0, 4).map((approval) => (
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
      ) : null}

      {blockedStateAudit ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Blocked State Audit</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(blockedStateAudit.status)}`}>
                {formatStatus(blockedStateAudit.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-red-100">
              {blockedStateAudit.completionClaimAllowed ? 'completion allowed' : 'completion blocked'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="Blockers" value={blockedStateAudit.blockers.length} />
            <Stat
              label="Checks"
              value={blockedStateAudit.checks.filter((check) => check.passed).length}
            />
            <Stat label="Errors" value={blockedStateAudit.errors.length} />
            <Stat
              label="Provider Calls"
              value={blockedStateAudit.generatedWithoutProviderCalls ? 0 : 1}
            />
          </div>

          <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs leading-5 text-red-100">
            {blockedStateAudit.route}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {blockedStateAudit.blockers.slice(0, 4).map((blocker) => (
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
      ) : null}

      {domainCompletionProofLedger ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black text-white">Domain Completion Proof</p>
              <p className={`mt-1 text-xs font-black uppercase ${statusClass(domainCompletionProofLedger.status)}`}>
                {formatStatus(domainCompletionProofLedger.status)}
              </p>
            </div>
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-bold text-amber-100">
              {domainCompletionProofLedger.completionClaimAllowed ? 'completion allowed' : 'evidence pending'}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Stat label="Domains" value={domainCompletionProofLedger.summary.domains} />
            <Stat
              label="Trial-Proven"
              value={domainCompletionProofLedger.summary.provenTrialScope}
            />
            <Stat
              label="External Blocks"
              value={domainCompletionProofLedger.summary.blockedExternal}
            />
            <Stat
              label="Goal Blocks"
              value={domainCompletionProofLedger.summary.blocksGoalCompletion}
            />
            <Stat
              label="Pre-Approval Calls"
              value={domainCompletionProofLedger.summary.providerCallsAllowedBeforeApproval}
            />
          </div>

          <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs font-semibold text-amber-100">
            Domain proof route: {domainCompletionProofLedger.route}
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {domainCompletionProofLedger.domains
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
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function List({
  title,
  rows,
}: {
  title: string
  rows: { key: string; count: number }[]
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-sm font-black text-white">{title}</p>
      <div className="mt-4 grid gap-3">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3"
            >
              <p className="text-sm font-bold text-white">{row.key}</p>
              <p className="text-sm text-slate-300">{row.count}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">No rows available.</p>
        )}
      </div>
    </div>
  )
}
