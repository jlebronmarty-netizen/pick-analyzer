import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProviderIntelligence } from '@/services/provider-intelligence.service'
import { runSportsDataIoExecutionReadinessValidation } from '@/services/sportsdataio-historical-import-readiness.service'
import { getSportsDataIoNbaIntegrationReadiness } from '@/services/sportsdataio-nba-integration-readiness.service'
import { getSportsDataIoNbaOddsReadiness } from '@/services/sportsdataio-nba-odds-readiness.service'
import { getSportsDataIoNbaPlayerPropsReadiness } from '@/services/sportsdataio-nba-player-props-readiness.service'
import { getSportsDataIoNbaPlayerStatsReadiness } from '@/services/sportsdataio-nba-player-stats-readiness.service'
import { getSportsDataIoNbaTrialIsolationAudit } from '@/services/sportsdataio-nba-trial-isolation-audit.service'

type SyncJobRow = {
  id: string
  sport_key: string
  job_type: string
  provider: string
  status: string
  started_at: string | null
  completed_at: string | null
  records_fetched: number | null
  records_inserted: number | null
  records_updated: number | null
  records_skipped: number | null
  error_count: number | null
  last_error: string | null
  duration_ms: number | null
}

type PredictionRow = {
  id: string
  sport_key: string
  market: string | null
  result: string | null
  lifecycle_status: string | null
  validation_status: string | null
  created_at: string | null
  generated_at: string | null
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function avg(values: number[]) {
  const clean = values.filter((value) => Number.isFinite(value))
  if (!clean.length) return 0
  return round(clean.reduce((sum, value) => sum + value, 0) / clean.length)
}

function groupCount<T>(rows: T[], keyFn: (row: T) => string) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = keyFn(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
}

function isStaleRunning(job: SyncJobRow) {
  if (job.status !== 'running' || !job.started_at) return false
  const startedAt = new Date(job.started_at).getTime()
  if (!Number.isFinite(startedAt)) return false
  return Date.now() - startedAt > 1000 * 60 * 60
}

function callsFrom(result: { providerUsage?: { externalProviderCallsMade?: number } }) {
  return Number(result.providerUsage?.externalProviderCallsMade ?? 0)
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function loadSportsDataIoNbaAudit() {
  try {
    return {
      audit: await getSportsDataIoNbaTrialIsolationAudit(),
      unavailableReason: null,
    }
  } catch (error) {
    return {
      audit: null,
      unavailableReason: errorText(error),
    }
  }
}

async function loadRows() {
  const [jobs, predictions] = await Promise.all([
    supabaseAdmin
      .from('sports_sync_jobs')
      .select(
        'id, sport_key, job_type, provider, status, started_at, completed_at, records_fetched, records_inserted, records_updated, records_skipped, error_count, last_error, duration_ms'
      )
      .order('started_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('prediction_history')
      .select('id, sport_key, market, result, lifecycle_status, validation_status, created_at, generated_at')
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  if (jobs.error) throw jobs.error
  if (predictions.error) throw predictions.error

  return {
    jobs: (jobs.data ?? []) as SyncJobRow[],
    predictions: (predictions.data ?? []) as PredictionRow[],
  }
}

export async function getRuntimeObservability() {
  const [rows, sportsDataIoNbaAudit] = await Promise.all([
    loadRows(),
    loadSportsDataIoNbaAudit(),
  ])
  const providerIntel = getProviderIntelligence()
  const sportsDataIoNbaReadiness = getSportsDataIoNbaIntegrationReadiness()
  const sportsDataIoNbaOddsReadiness = getSportsDataIoNbaOddsReadiness()
  const sportsDataIoNbaPlayerPropsReadiness =
    getSportsDataIoNbaPlayerPropsReadiness()
  const sportsDataIoNbaPlayerStatsReadiness =
    getSportsDataIoNbaPlayerStatsReadiness()
  const sportsDataIoExecutionReadinessValidation =
    runSportsDataIoExecutionReadinessValidation()
  const failedJobs = rows.jobs.filter((job) => job.status === 'failed')
  const staleRunningJobs = rows.jobs.filter(isStaleRunning)
  const partialJobs = rows.jobs.filter((job) => job.status === 'partial')
  const pendingPredictions = rows.predictions.filter(
    (row) => row.result === 'pending' || row.lifecycle_status === 'active'
  )
  const failedValidations = rows.predictions.filter(
    (row) => row.validation_status === 'failed'
  )
  const unsettledClosed = rows.predictions.filter(
    (row) =>
      row.result === 'pending' &&
      row.lifecycle_status &&
      !['settled', 'void', 'skipped'].includes(row.lifecycle_status)
  )
  const sportsDataIoNbaAuditWarnings =
    sportsDataIoNbaAudit.audit?.warnings.length ?? (sportsDataIoNbaAudit.unavailableReason ? 1 : 0)
  const sportsDataIoNbaAuditErrors = sportsDataIoNbaAudit.audit?.errors.length ?? 0
  const sportsDataIoNbaReadinessBlockers = sportsDataIoNbaReadiness.blockers.length
  const sportsDataIoNbaExternalBlockerLedger =
    sportsDataIoNbaReadiness.externalBlockerLedger
  const sportsDataIoNbaEvidenceExport =
    sportsDataIoNbaReadiness.readinessEvidenceExport
  const sportsDataIoNbaProductionGateAudit =
    sportsDataIoNbaReadiness.productionGateAudit
  const sportsDataIoNbaNextPilotApprovalChecklist =
    sportsDataIoNbaReadiness.nextPilotApprovalChecklist
  const sportsDataIoNbaCompletionEvidenceMatrix =
    sportsDataIoNbaReadiness.completionEvidenceMatrix
  const sportsDataIoNbaResponseShapeAudit =
    sportsDataIoNbaReadiness.responseShapeAudit
  const sportsDataIoNbaSurfaceConsistencyAudit =
    sportsDataIoNbaReadiness.surfaceConsistencyAudit
  const sportsDataIoNbaExternalApprovalPacket =
    sportsDataIoNbaReadiness.externalApprovalPacket
  const sportsDataIoNbaBlockedStateAudit =
    sportsDataIoNbaReadiness.blockedStateAudit
  const sportsDataIoNbaDomainCompletionProofLedger =
    sportsDataIoNbaReadiness.domainCompletionProofLedger
  const sportsDataIoNbaProviderExecutionGate =
    sportsDataIoNbaReadiness.providerExecutionGate
  const sportsDataIoNbaResolutionChecklist =
    sportsDataIoNbaReadiness.externalBlockerResolutionChecklist
  const sportsDataIoNbaProductionUsageExclusionAudit =
    sportsDataIoNbaReadiness.productionUsageExclusionAudit
  const sportsDataIoExecutionReadinessErrors =
    sportsDataIoExecutionReadinessValidation.success ? 0 : 1
  const sportsDataIoNbaProductionGateErrors =
    sportsDataIoNbaProductionGateAudit.valid
      ? 0
      : Math.max(1, sportsDataIoNbaProductionGateAudit.errors.length)
  const sportsDataIoNbaNextPilotChecklistErrors =
    sportsDataIoNbaNextPilotApprovalChecklist.generatedWithoutProviderCalls &&
    sportsDataIoNbaNextPilotApprovalChecklist.summary.providerCallsAllowedBeforeApproval === 0
      ? 0
      : 1
  const sportsDataIoNbaResponseShapeErrors =
    sportsDataIoNbaResponseShapeAudit.valid
      ? 0
      : Math.max(1, sportsDataIoNbaResponseShapeAudit.errors.length)
  const sportsDataIoNbaResolutionChecklistErrors =
    sportsDataIoNbaResolutionChecklist.valid
      ? 0
      : Math.max(1, sportsDataIoNbaResolutionChecklist.errors.length)
  const sportsDataIoNbaProductionUsageExclusionErrors =
    sportsDataIoNbaProductionUsageExclusionAudit.valid
      ? 0
      : Math.max(1, sportsDataIoNbaProductionUsageExclusionAudit.errors.length)
  const warningCount =
    partialJobs.length +
    staleRunningJobs.length +
    pendingPredictions.length +
    providerIntel.summary.degradedProviders +
    sportsDataIoNbaAuditWarnings +
    sportsDataIoNbaReadinessBlockers
  const errorCount =
    failedJobs.length +
    failedValidations.length +
    providerIntel.summary.unavailableProviders +
    sportsDataIoNbaAuditErrors +
    sportsDataIoNbaProductionGateErrors +
    sportsDataIoNbaNextPilotChecklistErrors +
    sportsDataIoNbaResponseShapeErrors +
    sportsDataIoNbaResolutionChecklistErrors +
    sportsDataIoNbaProductionUsageExclusionErrors +
    sportsDataIoExecutionReadinessErrors
  const sportsDataIoNbaProviderCalls =
    callsFrom(sportsDataIoNbaReadiness) +
    callsFrom(sportsDataIoNbaAudit.audit ?? {}) +
    callsFrom(sportsDataIoExecutionReadinessValidation)

  return {
    success: true,
    mode: 'runtime_observability_v1',
    generatedAt: new Date().toISOString(),
    providerUsage: {
      externalProviderCallsMade: sportsDataIoNbaProviderCalls,
      source: 'stored_supabase_tables_static_provider_registry_and_zero_call_sportsdataio_nba_readiness',
    },
    status:
      errorCount > 0
        ? 'error'
        : warningCount > 0
          ? 'warning'
          : 'healthy',
    summary: {
      syncJobs: rows.jobs.length,
      failedJobs: failedJobs.length,
      partialJobs: partialJobs.length,
      staleRunningJobs: staleRunningJobs.length,
      predictions: rows.predictions.length,
      pendingPredictions: pendingPredictions.length,
      failedValidations: failedValidations.length,
      unsettledClosed: unsettledClosed.length,
      warningCount,
      errorCount,
      averageJobDurationMs: avg(
        rows.jobs.map((job) => Number(job.duration_ms ?? 0)).filter(Boolean)
      ),
      providers: providerIntel.summary.providers,
      unavailableProviders: providerIntel.summary.unavailableProviders,
    },
    syncJobs: {
      byStatus: groupCount(rows.jobs, (job) => job.status),
      byType: groupCount(rows.jobs, (job) => job.job_type),
      bySport: groupCount(rows.jobs, (job) => job.sport_key),
      recentFailures: failedJobs.slice(0, 10).map((job) => ({
        id: job.id,
        sportKey: job.sport_key,
        jobType: job.job_type,
        provider: job.provider,
        startedAt: job.started_at,
        lastError: job.last_error,
        errorCount: job.error_count ?? 0,
      })),
    },
    predictions: {
      bySport: groupCount(rows.predictions, (row) => row.sport_key),
      byResult: groupCount(rows.predictions, (row) => row.result ?? 'unknown'),
      byLifecycle: groupCount(
        rows.predictions,
        (row) => row.lifecycle_status ?? 'legacy'
      ),
      byValidation: groupCount(
        rows.predictions,
        (row) => row.validation_status ?? 'legacy'
      ),
    },
    providers: {
      status: providerIntel.status,
      summary: providerIntel.summary,
      unavailable: providerIntel.providers
        .filter((provider) => provider.health === 'unavailable')
        .map((provider) => ({
          id: provider.id,
          name: provider.name,
          reason: provider.unavailableReason,
        })),
    },
    sportsDataIoNba: {
      status:
        sportsDataIoNbaAuditErrors > 0
          ? 'trial_isolation_violation'
          : sportsDataIoNbaAudit.unavailableReason
            ? 'audit_unavailable'
            : sportsDataIoNbaReadiness.status,
      providerUsage: {
        externalProviderCallsMade: sportsDataIoNbaProviderCalls,
        readinessCallsMade: callsFrom(sportsDataIoNbaReadiness),
        trialIsolationAuditCallsMade: callsFrom(sportsDataIoNbaAudit.audit ?? {}),
        source: 'local_readiness_and_stored_supabase_audit_only',
      },
      readiness: {
        success: sportsDataIoNbaReadiness.success,
        status: sportsDataIoNbaReadiness.status,
        blockerCount: sportsDataIoNbaReadiness.blockers.length,
        blockers: sportsDataIoNbaReadiness.blockers.slice(0, 10),
        readinessAreas: sportsDataIoNbaReadiness.areas.map((area) => ({
          key: area.key,
          status: area.status,
          providerCallsMade: area.providerCallsMade,
          blockerCount: area.blockers.length,
        })),
        safetyInvariants: sportsDataIoNbaReadiness.safetyInvariants,
        readinessRoutes: sportsDataIoNbaReadiness.readinessRoutes,
        safeNextActions: {
          route: '/api/providers/sportsdataio/nba/safe-next-actions',
          status: sportsDataIoNbaReadiness.handoff.status,
          actions: sportsDataIoNbaReadiness.handoff.safeNextActions,
          productionGates: sportsDataIoNbaReadiness.handoff.productionGates,
          providerCallsAllowedNow:
            sportsDataIoNbaReadiness.providerExecutionGate
              .providerCallsAllowedNow,
          liveExecutionAllowed:
            sportsDataIoNbaReadiness.providerExecutionGate.liveExecutionAllowed,
        },
        oddsEndpointPreflight: {
          route: '/api/providers/sportsdataio/nba/odds/endpoint-preflight',
          status: sportsDataIoNbaOddsReadiness.status,
          providerCallsMade:
            sportsDataIoNbaOddsReadiness.providerUsage
              .externalProviderCallsMade,
          exactPathsConfirmed:
            sportsDataIoNbaOddsReadiness.endpointPreflight
              .exactPathsConfirmed,
          entitlementConfirmed:
            sportsDataIoNbaOddsReadiness.endpointPreflight
              .entitlementConfirmed,
          sportsbookCoverageConfirmed:
            sportsDataIoNbaOddsReadiness.endpointPreflight
              .sportsbookCoverageConfirmed,
          historicalWindowsApproved:
            sportsDataIoNbaOddsReadiness.endpointPreflight
              .historicalWindowsApproved,
          requiredConfirmations:
            sportsDataIoNbaOddsReadiness.endpointPreflight
              .requiredConfirmations.slice(0, 4),
          cappedPilotRequirements:
            sportsDataIoNbaOddsReadiness.endpointPreflight
              .cappedPilotRequirements,
          goNoGoGates:
            sportsDataIoNbaOddsReadiness.endpointPreflight.goNoGoGates.slice(0, 4),
        },
        playerPropsEndpointPreflight: {
          route: '/api/providers/sportsdataio/nba/player-props/endpoint-preflight',
          status: sportsDataIoNbaPlayerPropsReadiness.status,
          providerCallsMade:
            sportsDataIoNbaPlayerPropsReadiness.providerUsage
              .externalProviderCallsMade,
          exactPathsConfirmed:
            sportsDataIoNbaPlayerPropsReadiness.endpointPreflight
              .exactPathsConfirmed,
          entitlementConfirmed:
            sportsDataIoNbaPlayerPropsReadiness.endpointPreflight
              .entitlementConfirmed,
          sportsbookCoverageConfirmed:
            sportsDataIoNbaPlayerPropsReadiness.endpointPreflight
              .sportsbookCoverageConfirmed,
          settlementRulesImplemented:
            sportsDataIoNbaPlayerPropsReadiness.endpointPreflight
              .settlementRulesImplemented,
          requiredConfirmations:
            sportsDataIoNbaPlayerPropsReadiness.endpointPreflight
              .requiredConfirmations.slice(0, 4),
          cappedPilotRequirements:
            sportsDataIoNbaPlayerPropsReadiness.endpointPreflight
              .cappedPilotRequirements,
          goNoGoGates:
            sportsDataIoNbaPlayerPropsReadiness.endpointPreflight
              .goNoGoGates.slice(0, 4),
        },
        playerStatsMigrationPreflight: {
          route: '/api/providers/sportsdataio/nba/player-stats/migration-preflight',
          status: sportsDataIoNbaPlayerStatsReadiness.status,
          providerCallsMade:
            sportsDataIoNbaPlayerStatsReadiness.providerUsage
              .externalProviderCallsMade,
          migration: sportsDataIoNbaPlayerStatsReadiness.migration.created,
          destinationTable:
            sportsDataIoNbaPlayerStatsReadiness.migration.destinationTable,
          appliedAutomatically:
            sportsDataIoNbaPlayerStatsReadiness.migration.appliedAutomatically,
          destructiveChangeRequired:
            sportsDataIoNbaPlayerStatsReadiness.migration.preflight
              .destructiveChangeRequired,
          expectedColumns:
            sportsDataIoNbaPlayerStatsReadiness.migration.preflight
              .expectedColumns.length,
          expectedIndexes:
            sportsDataIoNbaPlayerStatsReadiness.migration.preflight
              .expectedIndexes.length,
          goNoGoGates:
            sportsDataIoNbaPlayerStatsReadiness.migration.preflight
              .goNoGoGates.slice(0, 4),
        },
        externalBlockerLedger: {
          status: sportsDataIoNbaExternalBlockerLedger.status,
          route: '/api/providers/sportsdataio/nba/external-blockers',
          summary: sportsDataIoNbaExternalBlockerLedger.summary,
          blockers: sportsDataIoNbaExternalBlockerLedger.blockers
            .slice(0, 5)
            .map((blocker) => ({
              id: blocker.id,
              domain: blocker.domain,
              category: blocker.category,
              owner: blocker.owner,
              nextSafeAction: blocker.nextSafeAction,
              providerCallsRequiredBeforeApproval:
                blocker.providerCallsRequiredBeforeApproval,
              productionGateClosed: blocker.productionGateClosed,
            })),
        },
        readinessEvidenceExport: {
          status: sportsDataIoNbaEvidenceExport.status,
          route: '/api/providers/sportsdataio/nba/evidence-export',
          summary: sportsDataIoNbaEvidenceExport.summary,
          validation: {
            valid: sportsDataIoNbaEvidenceExport.validation.valid,
            checks: sportsDataIoNbaEvidenceExport.validation.checks,
            errors: sportsDataIoNbaEvidenceExport.validation.errors,
            warnings: sportsDataIoNbaEvidenceExport.validation.warnings,
          },
        },
        productionGateAudit: {
          route: '/api/providers/sportsdataio/nba/production-gate',
          valid: sportsDataIoNbaProductionGateAudit.valid,
          status: sportsDataIoNbaProductionGateAudit.status,
          checks: sportsDataIoNbaProductionGateAudit.checks,
          errors: sportsDataIoNbaProductionGateAudit.errors,
          warnings: sportsDataIoNbaProductionGateAudit.warnings,
        },
        nextPilotApprovalChecklist: {
          status: sportsDataIoNbaNextPilotApprovalChecklist.status,
          route: '/api/providers/sportsdataio/nba/next-pilot-preflight',
          generatedWithoutProviderCalls:
            sportsDataIoNbaNextPilotApprovalChecklist.generatedWithoutProviderCalls,
          summary: sportsDataIoNbaNextPilotApprovalChecklist.summary,
          items: sportsDataIoNbaNextPilotApprovalChecklist.items
            .slice(0, 5)
            .map((item) => ({
              domain: item.domain,
              status: item.status,
              approvalOwner: item.approvalOwner,
              approvalsRequired: item.approvalsRequired.slice(0, 3),
              cappedExecutionRequirements:
                item.cappedExecutionRequirements.slice(0, 3),
              providerCallsAllowedBeforeApproval:
                item.providerCallsAllowedBeforeApproval,
            })),
        },
        objectiveAudit: {
          route: '/api/providers/sportsdataio/nba/objective-audit',
          status: sportsDataIoNbaReadiness.objectiveAudit.status,
          summary: sportsDataIoNbaReadiness.objectiveAudit.summary,
          items: sportsDataIoNbaReadiness.objectiveAudit.items
            .filter((item) => item.remainingWork.length > 0)
            .slice(0, 5)
            .map((item) => ({
              requirement: item.requirement,
              status: item.status,
              evidence: item.evidence.slice(0, 3),
              remainingWork: item.remainingWork.slice(0, 3),
            })),
        },
        completionEvidenceMatrix: {
          route: '/api/providers/sportsdataio/nba/completion-evidence',
          status: sportsDataIoNbaCompletionEvidenceMatrix.status,
          generatedWithoutProviderCalls:
            sportsDataIoNbaCompletionEvidenceMatrix.generatedWithoutProviderCalls,
          summary: sportsDataIoNbaCompletionEvidenceMatrix.summary,
          items: sportsDataIoNbaCompletionEvidenceMatrix.items
            .filter((item) => item.blocksGoalCompletion)
            .slice(0, 5)
            .map((item) => ({
              requirement: item.requirement,
              status: item.status,
              unresolvedEvidence: item.unresolvedEvidence.slice(0, 3),
              proofArtifacts: item.proofArtifacts.slice(0, 3),
              blocksGoalCompletion: item.blocksGoalCompletion,
            })),
        },
        responseShapeAudit: {
          valid: sportsDataIoNbaResponseShapeAudit.valid,
          route: '/api/providers/sportsdataio/nba/contract-audit',
          status: sportsDataIoNbaResponseShapeAudit.status,
          checks: sportsDataIoNbaResponseShapeAudit.checks,
          errors: sportsDataIoNbaResponseShapeAudit.errors,
          warnings: sportsDataIoNbaResponseShapeAudit.warnings,
        },
        surfaceConsistencyAudit: {
          valid: sportsDataIoNbaSurfaceConsistencyAudit.valid,
          route: '/api/providers/sportsdataio/nba/contract-audit',
          status: sportsDataIoNbaSurfaceConsistencyAudit.status,
          generatedWithoutProviderCalls:
            sportsDataIoNbaSurfaceConsistencyAudit.generatedWithoutProviderCalls,
          checks: sportsDataIoNbaSurfaceConsistencyAudit.checks,
          errors: sportsDataIoNbaSurfaceConsistencyAudit.errors,
          warnings: sportsDataIoNbaSurfaceConsistencyAudit.warnings,
          surfaces: sportsDataIoNbaSurfaceConsistencyAudit.surfaces.map((surface) => ({
            surface: surface.surface,
            artifact: surface.artifact,
            expectedSignals: surface.expectedSignals.slice(0, 3),
          })),
        },
        externalApprovalPacket: {
          status: sportsDataIoNbaExternalApprovalPacket.status,
          route: '/api/providers/sportsdataio/nba/approval-packet',
          generatedWithoutProviderCalls:
            sportsDataIoNbaExternalApprovalPacket.generatedWithoutProviderCalls,
          summary: sportsDataIoNbaExternalApprovalPacket.summary,
          requestedApprovals:
            sportsDataIoNbaExternalApprovalPacket.requestedApprovals
              .slice(0, 5)
              .map((approval) => ({
                domain: approval.domain,
                owner: approval.owner,
                evidenceRequired: approval.evidenceRequired.slice(0, 3),
                unblocks: approval.unblocks.slice(0, 3),
              })),
          executionConstraints:
            sportsDataIoNbaExternalApprovalPacket.executionConstraints.slice(0, 5),
          prohibitedActions:
            sportsDataIoNbaExternalApprovalPacket.prohibitedActions.slice(0, 5),
          evidenceArtifacts:
            sportsDataIoNbaExternalApprovalPacket.evidenceArtifacts.slice(0, 8),
        },
        blockedStateAudit: {
          valid: sportsDataIoNbaBlockedStateAudit.valid,
          status: sportsDataIoNbaBlockedStateAudit.status,
          route: '/api/providers/sportsdataio/nba/completion-audit',
          generatedWithoutProviderCalls:
            sportsDataIoNbaBlockedStateAudit.generatedWithoutProviderCalls,
          completionClaimAllowed:
            sportsDataIoNbaBlockedStateAudit.completionClaimAllowed,
          blockers: sportsDataIoNbaBlockedStateAudit.blockers
            .slice(0, 5)
            .map((blocker) => ({
              domain: blocker.domain,
              owner: blocker.owner,
              evidenceRequired: blocker.evidenceRequired.slice(0, 3),
            })),
          checks: sportsDataIoNbaBlockedStateAudit.checks,
          errors: sportsDataIoNbaBlockedStateAudit.errors,
          warnings: sportsDataIoNbaBlockedStateAudit.warnings,
        },
        domainCompletionProofLedger: {
          route: '/api/providers/sportsdataio/nba/domain-proof',
          valid: sportsDataIoNbaDomainCompletionProofLedger.valid,
          status: sportsDataIoNbaDomainCompletionProofLedger.status,
          generatedWithoutProviderCalls:
            sportsDataIoNbaDomainCompletionProofLedger.generatedWithoutProviderCalls,
          completionClaimAllowed:
            sportsDataIoNbaDomainCompletionProofLedger.completionClaimAllowed,
          summary: sportsDataIoNbaDomainCompletionProofLedger.summary,
          domains: sportsDataIoNbaDomainCompletionProofLedger.domains
            .slice(0, 6)
            .map((domain) => ({
              domain: domain.domain,
              handoffStatus: domain.handoffStatus,
              proofState: domain.proofState,
              productionUse: domain.productionUse,
              requiredNextEvidence: domain.requiredNextEvidence.slice(0, 3),
              linkedBlockerIds: domain.linkedBlockerIds,
              linkedRequirements: domain.linkedRequirements,
              blocksGoalCompletion: domain.blocksGoalCompletion,
              providerCallsAllowedBeforeApproval:
                domain.providerCallsAllowedBeforeApproval,
              productionGateClosed: domain.productionGateClosed,
            })),
          checks: sportsDataIoNbaDomainCompletionProofLedger.checks,
          errors: sportsDataIoNbaDomainCompletionProofLedger.errors,
          warnings: sportsDataIoNbaDomainCompletionProofLedger.warnings,
        },
        providerExecutionGate: {
          route: '/api/providers/sportsdataio/nba/provider-gate',
          valid: sportsDataIoNbaProviderExecutionGate.valid,
          status: sportsDataIoNbaProviderExecutionGate.status,
          generatedWithoutProviderCalls:
            sportsDataIoNbaProviderExecutionGate.generatedWithoutProviderCalls,
          liveExecutionAllowed:
            sportsDataIoNbaProviderExecutionGate.liveExecutionAllowed,
          providerCallsAllowedNow:
            sportsDataIoNbaProviderExecutionGate.providerCallsAllowedNow,
          allowedDomains:
            sportsDataIoNbaProviderExecutionGate.allowedDomains.slice(0, 6),
          blockedDomains: sportsDataIoNbaProviderExecutionGate.blockedDomains
            .slice(0, 6)
            .map((domain) => ({
              domain: domain.domain,
              owner: domain.owner,
              evidenceRequired: domain.evidenceRequired.slice(0, 3),
              nextSafeAction: domain.nextSafeAction,
              productionGateClosed: domain.productionGateClosed,
            })),
          constraints:
            sportsDataIoNbaProviderExecutionGate.constraints.slice(0, 5),
          checks: sportsDataIoNbaProviderExecutionGate.checks,
          errors: sportsDataIoNbaProviderExecutionGate.errors,
          warnings: sportsDataIoNbaProviderExecutionGate.warnings,
        },
        externalBlockerResolutionChecklist: {
          route: '/api/providers/sportsdataio/nba/blocker-resolution',
          valid: sportsDataIoNbaResolutionChecklist.valid,
          status: sportsDataIoNbaResolutionChecklist.status,
          generatedWithoutProviderCalls:
            sportsDataIoNbaResolutionChecklist.generatedWithoutProviderCalls,
          liveExecutionAllowedAfterResolution:
            sportsDataIoNbaResolutionChecklist.liveExecutionAllowedAfterResolution,
          summary: sportsDataIoNbaResolutionChecklist.summary,
          items: sportsDataIoNbaResolutionChecklist.items
            .slice(0, 6)
            .map((item) => ({
              domain: item.domain,
              blockerId: item.blockerId,
              owner: item.owner,
              category: item.category,
              requiredEvidence: item.requiredEvidence.slice(0, 3),
              resolutionSteps: item.resolutionSteps.slice(0, 3),
              preExecutionVerification:
                item.preExecutionVerification.slice(0, 3),
              providerCallsAllowedBeforeResolution:
                item.providerCallsAllowedBeforeResolution,
              productionGateMustRemainClosed:
                item.productionGateMustRemainClosed,
            })),
          checks: sportsDataIoNbaResolutionChecklist.checks,
          errors: sportsDataIoNbaResolutionChecklist.errors,
          warnings: sportsDataIoNbaResolutionChecklist.warnings,
        },
        executionReadinessValidation: {
          success: sportsDataIoExecutionReadinessValidation.success,
          mode: sportsDataIoExecutionReadinessValidation.mode,
          providerUsage:
            sportsDataIoExecutionReadinessValidation.providerUsage,
          summary: sportsDataIoExecutionReadinessValidation.summary,
          checks: sportsDataIoExecutionReadinessValidation.checks,
          deterministicFixtures:
            sportsDataIoExecutionReadinessValidation.deterministicFixtures,
          plans: sportsDataIoExecutionReadinessValidation.plans,
          warnings: sportsDataIoExecutionReadinessValidation.warnings,
          route:
            '/api/providers/sportsdataio/execution-readiness/validation',
        },
        productionUsageExclusionAudit: {
          route: '/api/providers/sportsdataio/nba/production-usage-exclusion',
          valid: sportsDataIoNbaProductionUsageExclusionAudit.valid,
          status: sportsDataIoNbaProductionUsageExclusionAudit.status,
          generatedWithoutProviderCalls:
            sportsDataIoNbaProductionUsageExclusionAudit.generatedWithoutProviderCalls,
          trialRowsProductionEligible:
            sportsDataIoNbaProductionUsageExclusionAudit.trialRowsProductionEligible,
          predictionPersistenceEnabled:
            sportsDataIoNbaProductionUsageExclusionAudit.predictionPersistenceEnabled,
          backtestingEnabled:
            sportsDataIoNbaProductionUsageExclusionAudit.backtestingEnabled,
          modelTrainingEnabled:
            sportsDataIoNbaProductionUsageExclusionAudit.modelTrainingEnabled,
          confidenceImprovementAllowed:
            sportsDataIoNbaProductionUsageExclusionAudit.confidenceImprovementAllowed,
          checkedSurfaces:
            sportsDataIoNbaProductionUsageExclusionAudit.checkedSurfaces,
          checks: sportsDataIoNbaProductionUsageExclusionAudit.checks,
          errors: sportsDataIoNbaProductionUsageExclusionAudit.errors,
          warnings: sportsDataIoNbaProductionUsageExclusionAudit.warnings,
        },
      },
      trialIsolation: sportsDataIoNbaAudit.audit
        ? {
            success: sportsDataIoNbaAudit.audit.success,
            status: sportsDataIoNbaAudit.audit.status,
            totals: sportsDataIoNbaAudit.audit.totals,
            predictionLeakage: sportsDataIoNbaAudit.audit.predictionLeakage,
            safetyInvariants: sportsDataIoNbaAudit.audit.safetyInvariants,
            tableCount: sportsDataIoNbaAudit.audit.tables.length,
            unavailableTables: sportsDataIoNbaAudit.audit.tables
              .filter((table) => table.status === 'unavailable')
              .map((table) => ({
                table: table.table,
                reason: table.unavailableReason,
              })),
            warnings: sportsDataIoNbaAudit.audit.warnings,
            errors: sportsDataIoNbaAudit.audit.errors,
          }
        : {
            success: false,
            status: 'audit_unavailable',
            unavailableReason: sportsDataIoNbaAudit.unavailableReason,
          },
      safetyInvariants: {
        noProviderCalls: sportsDataIoNbaProviderCalls === 0,
        trialIsolationAudited: Boolean(sportsDataIoNbaAudit.audit),
        productionReadinessBlocked: sportsDataIoNbaReadiness.status !== 'ready_for_next_capped_pilot',
        externalBlockerLedgerAvailable:
          sportsDataIoNbaExternalBlockerLedger.summary.total > 0,
        allExternalProductionGatesClosed:
          sportsDataIoNbaExternalBlockerLedger.summary.productionGatesClosed ===
          sportsDataIoNbaExternalBlockerLedger.summary.total,
        readinessEvidenceExportValid:
          sportsDataIoNbaEvidenceExport.validation.valid,
        productionGateAuditValid:
          sportsDataIoNbaProductionGateAudit.valid,
        nextPilotApprovalChecklistZeroPreapprovalCalls:
          sportsDataIoNbaNextPilotApprovalChecklist.generatedWithoutProviderCalls &&
          sportsDataIoNbaNextPilotApprovalChecklist.summary.providerCallsAllowedBeforeApproval === 0,
        completionEvidenceMatrixAvailable:
          sportsDataIoNbaCompletionEvidenceMatrix.generatedWithoutProviderCalls &&
          sportsDataIoNbaCompletionEvidenceMatrix.summary.requirements > 0,
        responseShapeAuditValid:
          sportsDataIoNbaResponseShapeAudit.valid,
        surfaceConsistencyAuditValid:
          sportsDataIoNbaSurfaceConsistencyAudit.valid,
        externalApprovalPacketZeroCall:
          sportsDataIoNbaExternalApprovalPacket.generatedWithoutProviderCalls &&
          sportsDataIoNbaExternalApprovalPacket.summary.providerCallsAllowedBeforeApproval === 0,
        blockedStateAuditValid:
          sportsDataIoNbaBlockedStateAudit.valid &&
          sportsDataIoNbaBlockedStateAudit.completionClaimAllowed === false,
        domainCompletionProofLedgerValid:
          sportsDataIoNbaDomainCompletionProofLedger.valid &&
          sportsDataIoNbaDomainCompletionProofLedger.completionClaimAllowed === false,
        providerExecutionGateClosed:
          sportsDataIoNbaProviderExecutionGate.valid &&
          sportsDataIoNbaProviderExecutionGate.liveExecutionAllowed === false &&
          sportsDataIoNbaProviderExecutionGate.providerCallsAllowedNow === 0,
        externalBlockerResolutionChecklistValid:
          sportsDataIoNbaResolutionChecklist.valid &&
          sportsDataIoNbaResolutionChecklist.generatedWithoutProviderCalls &&
          sportsDataIoNbaResolutionChecklist.summary
            .providerCallsAllowedBeforeResolution === 0,
        executionReadinessValidationValid:
          sportsDataIoExecutionReadinessValidation.success &&
          callsFrom(sportsDataIoExecutionReadinessValidation) === 0,
        productionUsageExclusionAuditValid:
          sportsDataIoNbaProductionUsageExclusionAudit.valid &&
          sportsDataIoNbaProductionUsageExclusionAudit.generatedWithoutProviderCalls &&
          sportsDataIoNbaProductionUsageExclusionAudit.predictionPersistenceEnabled === false &&
          sportsDataIoNbaProductionUsageExclusionAudit.backtestingEnabled === false &&
          sportsDataIoNbaProductionUsageExclusionAudit.modelTrainingEnabled === false &&
          sportsDataIoNbaProductionUsageExclusionAudit.confidenceImprovementAllowed === false,
      },
    },
    warnings: [
      ...(staleRunningJobs.length
        ? [`${staleRunningJobs.length} sync job(s) appear stale while running.`]
        : []),
      ...(pendingPredictions.length
        ? [`${pendingPredictions.length} prediction(s) are pending or active.`]
        : []),
      ...(providerIntel.summary.unavailableProviders
        ? [`${providerIntel.summary.unavailableProviders} provider(s) are unavailable by configuration.`]
        : []),
      ...(sportsDataIoNbaReadinessBlockers
        ? [`SportsDataIO NBA readiness has ${sportsDataIoNbaReadinessBlockers} external blocker(s).`]
        : []),
      ...(sportsDataIoNbaAudit.unavailableReason
        ? [`SportsDataIO NBA trial isolation audit unavailable: ${sportsDataIoNbaAudit.unavailableReason}`]
        : []),
      ...(!sportsDataIoNbaProductionGateAudit.valid
        ? sportsDataIoNbaProductionGateAudit.errors.map(
            (error) => `SportsDataIO NBA production gate audit invalid: ${error}`
          )
        : []),
      ...(sportsDataIoNbaNextPilotChecklistErrors
        ? ['SportsDataIO NBA next-pilot approval checklist is not zero-call safe.']
        : []),
      ...(!sportsDataIoNbaResponseShapeAudit.valid
        ? sportsDataIoNbaResponseShapeAudit.errors.map(
            (error) => `SportsDataIO NBA readiness response shape invalid: ${error}`
          )
        : []),
      ...(sportsDataIoNbaAudit.audit?.warnings ?? []),
      ...(sportsDataIoNbaAudit.audit?.errors ?? []),
    ],
  }
}
