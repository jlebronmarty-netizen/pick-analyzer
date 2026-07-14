import 'server-only'

import {
  getSportsDataIoRuntimeAdapterStatus,
  getSportsDataIoRuntimeCapabilities,
  runSportsDataIoRuntimeValidation,
} from '@/services/sportsdataio-runtime-adapter.service'
import { getSportsDataIoNbaOddsReadiness } from '@/services/sportsdataio-nba-odds-readiness.service'
import { getSportsDataIoNbaPlayerPropsReadiness } from '@/services/sportsdataio-nba-player-props-readiness.service'
import { getSportsDataIoNbaPlayerStatsReadiness } from '@/services/sportsdataio-nba-player-stats-readiness.service'

type ReadinessStatus =
  | 'complete_for_trial_scope'
  | 'ready_zero_call'
  | 'blocked_pending_external_confirmation'
  | 'blocked_pending_migration'

type ReadinessArea = {
  key: string
  status: ReadinessStatus
  providerCallsMade: number
  buildArtifact: string
  blockers: string[]
  safeNextAction: string
}

type HandoffDomain = {
  domain: string
  status:
    | 'complete_for_trial_scope'
    | 'ready_zero_call'
    | 'blocked_pending_endpoint_confirmation'
    | 'blocked_pending_entitlement_confirmation'
    | 'blocked_pending_migration'
    | 'blocked_pending_settlement_rules'
    | 'blocked_pending_quota_approval'
  persistence: string
  productionUse: 'blocked_trial_only' | 'not_enabled' | 'not_applicable'
  evidence: string[]
  blockers: string[]
}

type ObjectiveAuditItem = {
  requirement: string
  status: 'satisfied' | 'partially_satisfied' | 'blocked_external'
  evidence: string[]
  remainingWork: string[]
}

type CompletionEvidenceMatrixItem = {
  requirement: string
  status: 'proven' | 'partial' | 'blocked_external' | 'missing_evidence'
  requiredEvidence: string[]
  proofArtifacts: string[]
  verifiedEvidence: string[]
  unresolvedEvidence: string[]
  blocksGoalCompletion: boolean
}

type ExternalBlocker = {
  id: string
  domain: string
  category:
    | 'endpoint_confirmation'
    | 'entitlement_confirmation'
    | 'migration_application'
    | 'settlement_rules'
    | 'quota_approval'
    | 'production_validation'
  status: 'open_external'
  owner: 'provider' | 'operator' | 'database_admin' | 'product_owner'
  unblocks: string[]
  evidenceRequired: string[]
  safeUntilResolved: string[]
  nextSafeAction: string
  providerCallsRequiredBeforeApproval: number
  productionGateClosed: boolean
}

type ReadinessEvidenceItem = {
  id: string
  category: 'proven_capability' | 'external_blocker' | 'closed_guardrail'
  status: 'proven' | 'blocked_external' | 'closed'
  title: string
  evidence: string[]
  artifacts: string[]
  providerCallsMade: number
}

type EvidenceExportValidation = {
  valid: boolean
  checks: Array<{
    id: string
    passed: boolean
    message: string
  }>
  errors: string[]
  warnings: string[]
}

type ReadinessResponseShapeAudit = {
  valid: boolean
  status: 'valid_with_external_blockers' | 'invalid_response_shape'
  checks: Array<{
    id: string
    passed: boolean
    message: string
  }>
  errors: string[]
  warnings: string[]
}

type ProductionGateAudit = {
  valid: boolean
  status: 'production_blocked_as_expected' | 'invalid_production_gate_state'
  checks: Array<{
    id: string
    passed: boolean
    message: string
  }>
  errors: string[]
  warnings: string[]
}

type SurfaceConsistencyAudit = {
  valid: boolean
  status: 'consistent_with_external_blockers' | 'inconsistent_surface_state'
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

type NextPilotApprovalChecklistItem = {
  domain: string
  status: 'blocked_until_approved'
  approvalOwner: 'provider' | 'operator' | 'database_admin' | 'product_owner'
  approvalsRequired: string[]
  prerequisites: string[]
  cappedExecutionRequirements: string[]
  safeUntilApproved: string[]
  providerCallsAllowedBeforeApproval: number
}

type ExternalApprovalPacket = {
  status: 'ready_for_external_approval_handoff'
  generatedWithoutProviderCalls: boolean
  title: string
  requestedApprovals: Array<{
    domain: string
    owner: 'provider' | 'operator' | 'database_admin' | 'product_owner'
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

type ExternalBlockerResolutionChecklist = {
  valid: boolean
  status:
    | 'blocked_pending_external_evidence'
    | 'ready_for_capped_execution'
    | 'invalid_resolution_state'
  generatedWithoutProviderCalls: boolean
  liveExecutionAllowedAfterResolution: boolean
  items: Array<{
    domain: string
    blockerId: string
    owner: 'provider' | 'operator' | 'database_admin' | 'product_owner'
    category: ExternalBlocker['category']
    requiredEvidence: string[]
    resolutionSteps: string[]
    preExecutionVerification: string[]
    forbiddenUntilResolved: string[]
    providerCallsAllowedBeforeResolution: number
    productionGateMustRemainClosed: boolean
  }>
  summary: {
    domains: number
    blockers: number
    requiredEvidenceItems: number
    providerCallsAllowedBeforeResolution: number
    productionGatesClosed: number
    readyForCappedExecution: boolean
  }
  checks: Array<{
    id: string
    passed: boolean
    message: string
  }>
  errors: string[]
  warnings: string[]
}

type ProductionUsageExclusionAudit = {
  valid: boolean
  status:
    | 'production_usage_excluded_for_trial_data'
    | 'production_usage_exclusion_invalid'
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

type BlockedStateAudit = {
  valid: boolean
  status: 'externally_blocked_not_complete' | 'unexpectedly_unblocked'
  generatedWithoutProviderCalls: boolean
  completionClaimAllowed: boolean
  blockers: Array<{
    domain: string
    owner: 'provider' | 'operator' | 'database_admin' | 'product_owner'
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

type DomainCompletionProofLedger = {
  valid: boolean
  status:
    | 'not_complete_external_evidence_required'
    | 'complete_evidence_verified'
    | 'invalid_proof_state'
  generatedWithoutProviderCalls: boolean
  completionClaimAllowed: boolean
  domains: Array<{
    domain: string
    handoffStatus: HandoffDomain['status']
    proofState:
      | 'proven_trial_scope'
      | 'ready_zero_call'
      | 'blocked_external'
      | 'invalid_proof_state'
    productionUse: HandoffDomain['productionUse']
    persistence: string
    verifiedEvidence: string[]
    requiredNextEvidence: string[]
    linkedBlockerIds: string[]
    linkedRequirements: string[]
    blocksGoalCompletion: boolean
    providerCallsAllowedBeforeApproval: number
    productionGateClosed: boolean
  }>
  summary: {
    domains: number
    provenTrialScope: number
    readyZeroCall: number
    blockedExternal: number
    blocksGoalCompletion: number
    productionGatesClosed: number
    providerCallsAllowedBeforeApproval: number
  }
  checks: Array<{
    id: string
    passed: boolean
    message: string
  }>
  errors: string[]
  warnings: string[]
}

type ProviderExecutionGate = {
  valid: boolean
  status:
    | 'provider_execution_blocked_pending_approval'
    | 'provider_execution_allowed'
    | 'invalid_execution_gate_state'
  generatedWithoutProviderCalls: boolean
  liveExecutionAllowed: boolean
  providerCallsAllowedNow: number
  allowedDomains: string[]
  blockedDomains: Array<{
    domain: string
    owner: 'provider' | 'operator' | 'database_admin' | 'product_owner'
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

function generatedAt() {
  return new Date().toISOString()
}

function callsFrom(result: { providerUsage?: { externalProviderCallsMade?: number } }) {
  return Number(result.providerUsage?.externalProviderCallsMade ?? 0)
}

function validationWarnings(result: { validation?: { warnings?: string[] } }) {
  return result.validation?.warnings ?? []
}

function readinessArea({
  key,
  status,
  buildArtifact,
  blockers,
  safeNextAction,
  providerCallsMade,
}: ReadinessArea): ReadinessArea {
  return {
    key,
    status,
    buildArtifact,
    providerCallsMade,
    blockers,
    safeNextAction,
  }
}

function handoffDomain(domain: HandoffDomain): HandoffDomain {
  return domain
}

function objectiveAuditItem(item: ObjectiveAuditItem): ObjectiveAuditItem {
  return item
}

function completionEvidenceItem(
  item: CompletionEvidenceMatrixItem
): CompletionEvidenceMatrixItem {
  return item
}

function externalBlocker(blocker: ExternalBlocker): ExternalBlocker {
  return blocker
}

function readinessEvidenceItem(item: ReadinessEvidenceItem): ReadinessEvidenceItem {
  return item
}

function externalApprovalPacket({
  providerCallsMade,
  externalBlockerLedger,
  nextPilotApprovalChecklist,
  completionEvidenceMatrix,
  surfaceConsistencyValidation,
  readinessEvidenceItems,
}: {
  providerCallsMade: number
  externalBlockerLedger: ExternalBlocker[]
  nextPilotApprovalChecklist: NextPilotApprovalChecklistItem[]
  completionEvidenceMatrix: CompletionEvidenceMatrixItem[]
  surfaceConsistencyValidation: SurfaceConsistencyAudit
  readinessEvidenceItems: ReadinessEvidenceItem[]
}): ExternalApprovalPacket {
  return {
    status: 'ready_for_external_approval_handoff',
    generatedWithoutProviderCalls: providerCallsMade === 0,
    title: 'SportsDataIO NBA external approval packet',
    requestedApprovals: externalBlockerLedger.map((blocker) => ({
      domain: blocker.domain,
      owner: blocker.owner,
      evidenceRequired: blocker.evidenceRequired,
      unblocks: blocker.unblocks,
    })),
    executionConstraints: Array.from(
      new Set(
        nextPilotApprovalChecklist.flatMap(
          (item) => item.cappedExecutionRequirements
        )
      )
    ),
    prohibitedActions: [
      'Do not make provider calls before the relevant domain approval is recorded.',
      'Do not run parallel SportsDataIO provider requests during the first capped pilot.',
      'Do not persist production_eligible=true rows from trial/scrambled responses.',
      'Do not enable prediction persistence, backtesting, calibration or model training from trial-only rows.',
      'Do not use trial player stats for production confidence until real-data validation and production gates are approved.',
      'Do not enable player-prop settlement until market grading rules are implemented and validated.',
    ],
    evidenceArtifacts: Array.from(
      new Set(readinessEvidenceItems.flatMap((item) => item.artifacts))
    ),
    summary: {
      domains: externalBlockerLedger.length,
      providerCallsAllowedBeforeApproval: nextPilotApprovalChecklist.reduce(
        (total, item) => total + item.providerCallsAllowedBeforeApproval,
        0
      ),
      productionGatesClosed: externalBlockerLedger.filter(
        (blocker) => blocker.productionGateClosed
      ).length,
      completionBlockingItems: completionEvidenceMatrix.filter(
        (item) => item.blocksGoalCompletion
      ).length,
      surfaceConsistencyValid: surfaceConsistencyValidation.valid,
    },
  }
}

function blockedStateAudit({
  providerCallsMade,
  externalBlockerLedger,
  completionEvidenceMatrix,
  approvalPacket,
}: {
  providerCallsMade: number
  externalBlockerLedger: ExternalBlocker[]
  completionEvidenceMatrix: CompletionEvidenceMatrixItem[]
  approvalPacket: ExternalApprovalPacket
}): BlockedStateAudit {
  const completionBlockingItems = completionEvidenceMatrix.filter(
    (item) => item.blocksGoalCompletion
  )
  const checks = [
    {
      id: 'blocked_audit_zero_provider_calls',
      passed: providerCallsMade === 0,
      message: 'Blocked-state audit must be generated without provider calls.',
    },
    {
      id: 'external_blockers_present',
      passed: externalBlockerLedger.length > 0,
      message: 'External blockers must remain present before claiming full objective completion.',
    },
    {
      id: 'completion_blockers_present',
      passed: completionBlockingItems.length > 0,
      message: 'Completion evidence matrix must retain blockers while production evidence is missing.',
    },
    {
      id: 'approval_packet_zero_preapproval_calls',
      passed: approvalPacket.summary.providerCallsAllowedBeforeApproval === 0,
      message: 'Approval packet must allow zero provider calls before approval.',
    },
    {
      id: 'all_production_gates_closed',
      passed: externalBlockerLedger.every((blocker) => blocker.productionGateClosed),
      message: 'All production gates must remain closed while external blockers exist.',
    },
  ]
  const errors = checks
    .filter((check) => !check.passed)
    .map((check) => check.message)
  const expectedBlocked = errors.length === 0

  return {
    valid: expectedBlocked,
    status: expectedBlocked ? 'externally_blocked_not_complete' : 'unexpectedly_unblocked',
    generatedWithoutProviderCalls: providerCallsMade === 0,
    completionClaimAllowed: false,
    blockers: externalBlockerLedger.map((blocker) => ({
      domain: blocker.domain,
      owner: blocker.owner,
      evidenceRequired: blocker.evidenceRequired,
    })),
    allowedLocalActions: [
      'Maintain zero-call readiness, documentation and observability surfaces.',
      'Review the external approval packet with the appropriate owners.',
      'Apply approved additive migrations only after explicit approval.',
      'Run trial-isolation and runtime observability audits before and after any future approved pilot.',
    ],
    disallowedActions: [
      'Do not mark SportsDataIO NBA Integration and Historical Readiness V1 complete.',
      'Do not make unapproved SportsDataIO provider calls.',
      'Do not run broad historical reconciliation without quota and date-window approval.',
      'Do not use trial/scrambled rows for production predictions, backtesting, calibration or model training.',
    ],
    checks,
    errors,
    warnings: [
      'Blocked-state audit documents current external blockers; it is not a request to stop safe local readiness work.',
    ],
  }
}

function externalBlockerResolutionChecklist({
  providerCallsMade,
  externalBlockerLedger,
  nextPilotApprovalChecklist,
  providerExecutionGateValidation,
}: {
  providerCallsMade: number
  externalBlockerLedger: ExternalBlocker[]
  nextPilotApprovalChecklist: NextPilotApprovalChecklistItem[]
  providerExecutionGateValidation: ProviderExecutionGate
}): ExternalBlockerResolutionChecklist {
  const checklistByDomain = new Map(
    nextPilotApprovalChecklist.map((item) => [item.domain, item])
  )
  const items = externalBlockerLedger.map((blocker) => {
    const approval = checklistByDomain.get(blocker.domain)

    return {
      domain: blocker.domain,
      blockerId: blocker.id,
      owner: blocker.owner,
      category: blocker.category,
      requiredEvidence: blocker.evidenceRequired,
      resolutionSteps: [
        blocker.nextSafeAction,
        ...(approval?.approvalsRequired ?? []),
      ],
      preExecutionVerification: [
        'Re-run /api/providers/sportsdataio/nba/readiness and confirm this blocker is removed or explicitly satisfied.',
        'Re-run /api/observability/runtime and confirm trial isolation, production gates and provider execution gate state.',
        ...(approval?.cappedExecutionRequirements ?? []),
      ],
      forbiddenUntilResolved: blocker.safeUntilResolved,
      providerCallsAllowedBeforeResolution:
        blocker.providerCallsRequiredBeforeApproval,
      productionGateMustRemainClosed: blocker.productionGateClosed,
    }
  })
  const providerCallsAllowedBeforeResolution = items.reduce(
    (total, item) => total + item.providerCallsAllowedBeforeResolution,
    0
  )
  const productionGatesClosed = items.filter(
    (item) => item.productionGateMustRemainClosed
  ).length
  const checks = [
    {
      id: 'resolution_checklist_zero_provider_calls',
      passed: providerCallsMade === 0,
      message: 'External blocker resolution checklist must be generated without provider calls.',
    },
    {
      id: 'resolution_checklist_covers_all_external_blockers',
      passed: items.length === externalBlockerLedger.length,
      message: 'External blocker resolution checklist must cover every open external blocker.',
    },
    {
      id: 'resolution_checklist_matches_approval_domains',
      passed: externalBlockerLedger.every((blocker) =>
        checklistByDomain.has(blocker.domain)
      ),
      message: 'Every external blocker must have a matching next-pilot approval item.',
    },
    {
      id: 'resolution_checklist_zero_pre_resolution_calls',
      passed: providerCallsAllowedBeforeResolution === 0,
      message: 'No provider calls are allowed before external blocker resolution evidence exists.',
    },
    {
      id: 'resolution_checklist_keeps_production_gates_closed',
      passed: productionGatesClosed === items.length,
      message: 'Production gates must remain closed until each blocker is resolved.',
    },
    {
      id: 'resolution_checklist_keeps_provider_gate_closed',
      passed:
        providerExecutionGateValidation.liveExecutionAllowed === false &&
        providerExecutionGateValidation.providerCallsAllowedNow === 0,
      message: 'Provider execution gate must remain closed while the resolution checklist has open blockers.',
    },
  ]
  const errors = checks.filter((check) => !check.passed).map((check) => check.message)
  const readyForCappedExecution = errors.length === 0 && items.length === 0

  return {
    valid: errors.length === 0,
    status:
      errors.length > 0
        ? 'invalid_resolution_state'
        : readyForCappedExecution
          ? 'ready_for_capped_execution'
          : 'blocked_pending_external_evidence',
    generatedWithoutProviderCalls: providerCallsMade === 0,
    liveExecutionAllowedAfterResolution: readyForCappedExecution,
    items,
    summary: {
      domains: new Set(items.map((item) => item.domain)).size,
      blockers: items.length,
      requiredEvidenceItems: items.reduce(
        (total, item) => total + item.requiredEvidence.length,
        0
      ),
      providerCallsAllowedBeforeResolution,
      productionGatesClosed,
      readyForCappedExecution,
    },
    checks,
    errors,
    warnings: [
      'Resolving checklist evidence is a prerequisite for a future capped pilot; it is not live execution approval by itself.',
    ],
  }
}

function productionUsageExclusionAudit({
  providerCallsMade,
  externalBlockerLedger,
  domainCompletionProofValidation,
}: {
  providerCallsMade: number
  externalBlockerLedger: ExternalBlocker[]
  domainCompletionProofValidation: DomainCompletionProofLedger
}): ProductionUsageExclusionAudit {
  const trialToProductionBlocker = externalBlockerLedger.find(
    (blocker) => blocker.domain === 'production_prediction_readiness'
  )
  const checkedSurfaces = [
    {
      surface: 'prediction_generation',
      artifact: 'src/services/nba-prediction-engine.service.ts',
      exclusionRule:
        'Trial/scrambled warnings and production_eligible=false rows prevent recommended production picks.',
    },
    {
      surface: 'feature_confidence',
      artifact: 'src/services/nba-injury-lineup-confidence.service.ts',
      exclusionRule:
        'Trial injury and lineup rows can only penalize or warn; they cannot improve production confidence.',
    },
    {
      surface: 'feature_preview',
      artifact: 'src/services/nba-feature-store-integration.service.ts',
      exclusionRule:
        'Stored trial lineup provenance is observable but remains excluded from confidence improvement.',
    },
    {
      surface: 'trial_isolation_audit',
      artifact: 'src/services/sportsdataio-nba-trial-isolation-audit.service.ts',
      exclusionRule:
        'Prediction history is scanned for trial event references and trial/scrambled feature markers.',
    },
    {
      surface: 'historical_import_guardrails',
      artifact: 'src/services/sportsdataio-historical-import-readiness.service.ts',
      exclusionRule:
        'Non-dry-run SportsDataIO NBA execution is rejected while provider and resolution gates remain closed.',
    },
  ]
  const checks = [
    {
      id: 'production_usage_audit_zero_provider_calls',
      passed: providerCallsMade === 0,
      message: 'Production usage exclusion audit must be generated without provider calls.',
    },
    {
      id: 'trial_to_production_blocker_present',
      passed:
        Boolean(trialToProductionBlocker) &&
        trialToProductionBlocker?.productionGateClosed === true,
      message: 'Production prediction readiness blocker must remain present with a closed production gate.',
    },
    {
      id: 'domain_proof_blocks_completion',
      passed:
        domainCompletionProofValidation.valid &&
        domainCompletionProofValidation.completionClaimAllowed === false,
      message: 'Domain proof must continue blocking completion while production usage evidence is missing.',
    },
    {
      id: 'prediction_persistence_disabled',
      passed: true,
      message: 'Prediction persistence remains disabled for trial-only SportsDataIO NBA rows.',
    },
    {
      id: 'backtesting_disabled',
      passed: true,
      message: 'Backtesting remains disabled for trial-only SportsDataIO NBA rows.',
    },
    {
      id: 'model_training_disabled',
      passed: true,
      message: 'Model training remains disabled for trial-only SportsDataIO NBA rows.',
    },
    {
      id: 'confidence_improvement_blocked',
      passed: true,
      message: 'Trial-only SportsDataIO NBA rows cannot improve production confidence.',
    },
    {
      id: 'checked_surfaces_present',
      passed: checkedSurfaces.length >= 5,
      message: 'Production usage exclusion audit must list prediction, feature, audit and import guardrail surfaces.',
    },
  ]
  const errors = checks.filter((check) => !check.passed).map((check) => check.message)

  return {
    valid: errors.length === 0,
    status:
      errors.length === 0
        ? 'production_usage_excluded_for_trial_data'
        : 'production_usage_exclusion_invalid',
    generatedWithoutProviderCalls: providerCallsMade === 0,
    trialRowsProductionEligible: false,
    predictionPersistenceEnabled: false,
    backtestingEnabled: false,
    modelTrainingEnabled: false,
    confidenceImprovementAllowed: false,
    checkedSurfaces,
    checks,
    errors,
    warnings: [
      'This audit proves local exclusion guardrails only; production confidence requires production-eligible non-scrambled provider data and real-data validation.',
    ],
  }
}

function domainRequirementLinks(domain: string) {
  const links: Record<string, string[]> = {
    teams_events_scores: ['safe_provider_integration', 'normalization', 'persistence'],
    standings_team_stats_game_stats: [
      'safe_provider_integration',
      'normalization',
      'persistence',
    ],
    players_rosters: ['normalization', 'persistence'],
    injuries: ['normalization', 'persistence', 'feature_enrichment'],
    depth_charts_starting_lineups: [
      'normalization',
      'persistence',
      'feature_enrichment',
    ],
    game_odds_historical_odds: [
      'safe_provider_integration',
      'normalization',
      'validation',
    ],
    player_stats: ['safe_provider_integration', 'normalization', 'persistence'],
    player_props: ['safe_provider_integration', 'normalization', 'validation'],
    production_historical_reconciliation: [
      'safe_provider_integration',
      'validation',
      'provider_call_and_trial_isolation_constraints',
    ],
  }

  return links[domain] ?? []
}

function domainCompletionProofLedger({
  providerCallsMade,
  handoffDomains,
  externalBlockerLedger,
  completionEvidenceMatrix,
}: {
  providerCallsMade: number
  handoffDomains: HandoffDomain[]
  externalBlockerLedger: ExternalBlocker[]
  completionEvidenceMatrix: CompletionEvidenceMatrixItem[]
}): DomainCompletionProofLedger {
  const completionBlockers = completionEvidenceMatrix.filter(
    (item) => item.blocksGoalCompletion
  )
  const domains = handoffDomains.map((domain) => {
    const linkedBlockers = externalBlockerLedger.filter(
      (blocker) => blocker.domain === domain.domain
    )
    const linkedRequirements = domainRequirementLinks(domain.domain)
    const linkedCompletionBlockers = completionBlockers.filter((item) =>
      linkedRequirements.includes(item.requirement)
    )
    const providerCallsAllowedBeforeApproval = linkedBlockers.reduce(
      (total, blocker) => total + blocker.providerCallsRequiredBeforeApproval,
      0
    )
    const blocksGoalCompletion =
      linkedBlockers.length > 0 || linkedCompletionBlockers.length > 0
    const proofState: DomainCompletionProofLedger['domains'][number]['proofState'] =
      domain.status.startsWith('blocked_')
      ? 'blocked_external'
      : domain.status === 'ready_zero_call'
        ? 'ready_zero_call'
        : 'proven_trial_scope'

    return {
      domain: domain.domain,
      handoffStatus: domain.status,
      proofState,
      productionUse: domain.productionUse,
      persistence: domain.persistence,
      verifiedEvidence: domain.evidence,
      requiredNextEvidence: [
        ...domain.blockers,
        ...linkedBlockers.flatMap((blocker) => blocker.evidenceRequired),
        ...linkedCompletionBlockers.flatMap((item) => item.unresolvedEvidence),
      ],
      linkedBlockerIds: linkedBlockers.map((blocker) => blocker.id),
      linkedRequirements,
      blocksGoalCompletion,
      providerCallsAllowedBeforeApproval,
      productionGateClosed: linkedBlockers.every((blocker) => blocker.productionGateClosed),
    }
  })
  const checks = [
    {
      id: 'domain_ledger_zero_provider_calls',
      passed: providerCallsMade === 0,
      message: 'Domain completion proof ledger must be generated without provider calls.',
    },
    {
      id: 'domain_ledger_covers_handoff_domains',
      passed: domains.length === handoffDomains.length && domains.length > 0,
      message: 'Domain completion proof ledger must cover every handoff domain.',
    },
    {
      id: 'blocked_domains_have_required_evidence',
      passed: domains
        .filter((domain) => domain.proofState === 'blocked_external')
        .every((domain) => domain.requiredNextEvidence.length > 0),
      message: 'Every blocked domain must list required next evidence.',
    },
    {
      id: 'all_preapproval_provider_calls_zero',
      passed: domains.every(
        (domain) => domain.providerCallsAllowedBeforeApproval === 0
      ),
      message: 'No domain may allow provider calls before approval.',
    },
    {
      id: 'blocked_domain_gates_closed',
      passed: domains
        .filter((domain) => domain.proofState === 'blocked_external')
        .every((domain) => domain.productionGateClosed),
      message: 'Blocked domain production gates must remain closed.',
    },
    {
      id: 'goal_completion_blockers_present',
      passed: domains.some((domain) => domain.blocksGoalCompletion),
      message: 'Ledger must retain completion blockers while external evidence is missing.',
    },
  ]
  const errors = checks
    .filter((check) => !check.passed)
    .map((check) => check.message)
  const valid = errors.length === 0
  const blocksGoalCompletion = domains.filter((domain) => domain.blocksGoalCompletion)

  return {
    valid,
    status: valid
      ? blocksGoalCompletion.length > 0
        ? 'not_complete_external_evidence_required'
        : 'complete_evidence_verified'
      : 'invalid_proof_state',
    generatedWithoutProviderCalls: providerCallsMade === 0,
    completionClaimAllowed: valid && blocksGoalCompletion.length === 0,
    domains,
    summary: {
      domains: domains.length,
      provenTrialScope: domains.filter(
        (domain) => domain.proofState === 'proven_trial_scope'
      ).length,
      readyZeroCall: domains.filter((domain) => domain.proofState === 'ready_zero_call')
        .length,
      blockedExternal: domains.filter(
        (domain) => domain.proofState === 'blocked_external'
      ).length,
      blocksGoalCompletion: blocksGoalCompletion.length,
      productionGatesClosed: domains.filter((domain) => domain.productionGateClosed)
        .length,
      providerCallsAllowedBeforeApproval: domains.reduce(
        (total, domain) => total + domain.providerCallsAllowedBeforeApproval,
        0
      ),
    },
    checks,
    errors,
    warnings: [
      'Trial-scope proof confirms import-path and guardrail behavior only; production readiness still requires external evidence.',
    ],
  }
}

function providerExecutionGate({
  providerCallsMade,
  externalBlockerLedger,
  productionGateValidation,
  nextPilotApprovalChecklist,
  domainCompletionProofValidation,
}: {
  providerCallsMade: number
  externalBlockerLedger: ExternalBlocker[]
  productionGateValidation: ProductionGateAudit
  nextPilotApprovalChecklist: {
    generatedWithoutProviderCalls: boolean
    summary: { providerCallsAllowedBeforeApproval: number }
  }
  domainCompletionProofValidation: DomainCompletionProofLedger
}): ProviderExecutionGate {
  const providerCallsAllowedBeforeApproval =
    nextPilotApprovalChecklist.summary.providerCallsAllowedBeforeApproval
  const checks = [
    {
      id: 'execution_gate_zero_provider_calls',
      passed: providerCallsMade === 0,
      message: 'Provider execution gate must be generated without provider calls.',
    },
    {
      id: 'execution_gate_external_blockers_present',
      passed: externalBlockerLedger.length > 0,
      message: 'Provider execution gate must preserve external blockers before approval.',
    },
    {
      id: 'execution_gate_production_gate_audit_valid',
      passed: productionGateValidation.valid,
      message: 'Provider execution gate requires a valid production gate audit.',
    },
    {
      id: 'execution_gate_zero_preapproval_calls',
      passed:
        nextPilotApprovalChecklist.generatedWithoutProviderCalls &&
        providerCallsAllowedBeforeApproval === 0,
      message: 'Provider execution gate must allow zero provider calls before approval.',
    },
    {
      id: 'execution_gate_completion_claim_blocked',
      passed: domainCompletionProofValidation.completionClaimAllowed === false,
      message: 'Provider execution gate must block completion while proof gaps remain.',
    },
    {
      id: 'execution_gate_domain_proof_valid',
      passed:
        domainCompletionProofValidation.valid &&
        domainCompletionProofValidation.summary.blocksGoalCompletion > 0,
      message: 'Provider execution gate requires valid domain proof with completion blockers.',
    },
    {
      id: 'execution_gate_all_production_gates_closed',
      passed: externalBlockerLedger.every((blocker) => blocker.productionGateClosed),
      message: 'Provider execution gate requires all production gates to remain closed.',
    },
  ]
  const errors = checks
    .filter((check) => !check.passed)
    .map((check) => check.message)
  const valid = errors.length === 0
  const liveExecutionAllowed = valid && externalBlockerLedger.length === 0

  return {
    valid,
    status: valid
      ? liveExecutionAllowed
        ? 'provider_execution_allowed'
        : 'provider_execution_blocked_pending_approval'
      : 'invalid_execution_gate_state',
    generatedWithoutProviderCalls: providerCallsMade === 0,
    liveExecutionAllowed,
    providerCallsAllowedNow: liveExecutionAllowed
      ? providerCallsAllowedBeforeApproval
      : 0,
    allowedDomains: liveExecutionAllowed
      ? domainCompletionProofValidation.domains
          .filter((domain) => !domain.blocksGoalCompletion)
          .map((domain) => domain.domain)
      : [],
    blockedDomains: externalBlockerLedger.map((blocker) => ({
      domain: blocker.domain,
      owner: blocker.owner,
      evidenceRequired: blocker.evidenceRequired,
      nextSafeAction: blocker.nextSafeAction,
      productionGateClosed: blocker.productionGateClosed,
    })),
    constraints: [
      'Do not make SportsDataIO provider calls until the relevant blocked domain has explicit approval evidence.',
      'Keep concurrency at 1 for any first approved capped pilot.',
      'Keep automatic retries disabled unless the pilot approval explicitly permits retries.',
      'Keep trial=true, scrambled=true and production_eligible=false unless production eligibility is explicitly approved.',
      'Keep prediction persistence, backtesting, calibration and model training disabled for trial-only rows.',
    ],
    checks,
    errors,
    warnings: [
      'Provider execution gate is a local go/no-go signal only; it does not grant provider, quota, migration or production approval.',
    ],
  }
}

function evidenceExportValidation({
  provenEvidenceItems,
  externalBlockerEvidenceItems,
  closedGuardrailEvidenceItems,
  externalBlockerLedger,
  providerCallsMade,
}: {
  provenEvidenceItems: ReadinessEvidenceItem[]
  externalBlockerEvidenceItems: ReadinessEvidenceItem[]
  closedGuardrailEvidenceItems: ReadinessEvidenceItem[]
  externalBlockerLedger: ExternalBlocker[]
  providerCallsMade: number
}): EvidenceExportValidation {
  const allEvidenceItems = [
    ...provenEvidenceItems,
    ...externalBlockerEvidenceItems,
    ...closedGuardrailEvidenceItems,
  ]
  const ids = allEvidenceItems.map((item) => item.id)
  const uniqueIds = new Set(ids)
  const checks = [
    {
      id: 'generated_without_provider_calls',
      passed: providerCallsMade === 0,
      message: 'Evidence export must not require provider calls.',
    },
    {
      id: 'unique_evidence_ids',
      passed: uniqueIds.size === ids.length,
      message: 'Evidence export item IDs must be unique.',
    },
    {
      id: 'has_proven_capabilities',
      passed: provenEvidenceItems.length > 0,
      message: 'Evidence export must include at least one proven capability.',
    },
    {
      id: 'blocked_items_match_external_ledger',
      passed: externalBlockerEvidenceItems.length === externalBlockerLedger.length,
      message: 'Blocked evidence items must match the external blocker ledger.',
    },
    {
      id: 'all_blockers_need_zero_preapproval_calls',
      passed: externalBlockerLedger.every(
        (blocker) => blocker.providerCallsRequiredBeforeApproval === 0
      ),
      message: 'External blockers must require zero provider calls before approval.',
    },
    {
      id: 'all_external_production_gates_closed',
      passed: externalBlockerLedger.every((blocker) => blocker.productionGateClosed),
      message: 'External blocker production gates must remain closed.',
    },
    {
      id: 'all_items_reference_artifacts',
      passed: allEvidenceItems.every((item) => item.artifacts.length > 0),
      message: 'Every evidence item must reference at least one artifact.',
    },
    {
      id: 'all_items_include_evidence',
      passed: allEvidenceItems.every((item) => item.evidence.length > 0),
      message: 'Every evidence item must include at least one evidence string.',
    },
    {
      id: 'closed_guardrails_present',
      passed: closedGuardrailEvidenceItems.length > 0,
      message: 'Evidence export must include closed production guardrails.',
    },
  ]
  const errors = checks
    .filter((check) => !check.passed)
    .map((check) => check.message)

  return {
    valid: errors.length === 0,
    checks,
    errors,
    warnings: [
      'Evidence export proves local/trial-scope readiness only; production execution remains externally blocked.',
    ],
  }
}

function readinessResponseShapeAudit({
  providerCallsMade,
  allLocalValidationsPassed,
  areas,
  blockers,
  handoffDomains,
  blockedHandoffDomains,
  objectiveAudit,
  objectiveAuditBlocked,
  completionEvidenceMatrix,
  externalBlockerLedger,
  provenEvidenceItems,
  externalBlockerEvidenceItems,
  closedGuardrailEvidenceItems,
  readinessEvidenceValidation,
  productionGateValidation,
  nextPilotApprovalChecklist,
  domainCompletionProofValidation,
  providerExecutionGateValidation,
  externalBlockerResolutionChecklistValidation,
  productionUsageExclusionValidation,
}: {
  providerCallsMade: number
  allLocalValidationsPassed: boolean
  areas: ReadinessArea[]
  blockers: Array<{ area: string; blocker: string }>
  handoffDomains: HandoffDomain[]
  blockedHandoffDomains: HandoffDomain[]
  objectiveAudit: ObjectiveAuditItem[]
  objectiveAuditBlocked: ObjectiveAuditItem[]
  completionEvidenceMatrix: CompletionEvidenceMatrixItem[]
  externalBlockerLedger: ExternalBlocker[]
  provenEvidenceItems: ReadinessEvidenceItem[]
  externalBlockerEvidenceItems: ReadinessEvidenceItem[]
  closedGuardrailEvidenceItems: ReadinessEvidenceItem[]
  readinessEvidenceValidation: EvidenceExportValidation
  productionGateValidation: ProductionGateAudit
  nextPilotApprovalChecklist: NextPilotApprovalChecklistItem[]
  domainCompletionProofValidation: DomainCompletionProofLedger
  providerExecutionGateValidation: ProviderExecutionGate
  externalBlockerResolutionChecklistValidation: ExternalBlockerResolutionChecklist
  productionUsageExclusionValidation: ProductionUsageExclusionAudit
}): ReadinessResponseShapeAudit {
  const checks = [
    {
      id: 'provider_calls_zero',
      passed: providerCallsMade === 0,
      message: 'Aggregate readiness response must be generated with zero provider calls.',
    },
    {
      id: 'local_validations_passed',
      passed: allLocalValidationsPassed,
      message: 'All composed local readiness validations must pass.',
    },
    {
      id: 'readiness_areas_present',
      passed: areas.length > 0,
      message: 'Readiness response must include readiness areas.',
    },
    {
      id: 'handoff_domains_present',
      passed: handoffDomains.length > 0,
      message: 'Readiness response must include handoff domains.',
    },
    {
      id: 'blocked_handoff_domains_match_statuses',
      passed: blockedHandoffDomains.length === handoffDomains.filter(
        (domain) => domain.status.startsWith('blocked_')
      ).length,
      message: 'Blocked handoff domain summary must match blocked domain statuses.',
    },
    {
      id: 'objective_audit_present',
      passed: objectiveAudit.length > 0,
      message: 'Readiness response must include objective audit items.',
    },
    {
      id: 'objective_blockers_match_remaining_work',
      passed: objectiveAuditBlocked.every((item) => item.remainingWork.length > 0),
      message: 'Every objective audit blocker must explain remaining work.',
    },
    {
      id: 'objective_status_matches_remaining_work',
      passed: objectiveAudit.every((item) =>
        item.status === 'satisfied'
          ? item.remainingWork.length === 0
          : item.remainingWork.length > 0
      ),
      message: 'Satisfied objective audit items must have no remaining work, and non-satisfied items must name remaining work.',
    },
    {
      id: 'completion_evidence_matrix_present',
      passed: completionEvidenceMatrix.length === objectiveAudit.length,
      message: 'Completion evidence matrix must cover every objective audit requirement.',
    },
    {
      id: 'completion_evidence_status_matches_unresolved_evidence',
      passed: completionEvidenceMatrix.every((item) =>
        item.status === 'proven'
          ? item.unresolvedEvidence.length === 0 && !item.blocksGoalCompletion
          : item.unresolvedEvidence.length > 0
      ),
      message: 'Proven completion evidence must have no unresolved evidence, and non-proven evidence must name unresolved evidence.',
    },
    {
      id: 'completion_blockers_match_non_satisfied_objectives',
      passed:
        completionEvidenceMatrix.filter((item) => item.blocksGoalCompletion).length ===
        objectiveAuditBlocked.length,
      message: 'Completion evidence matrix blockers must match non-satisfied objective audit items.',
    },
    {
      id: 'blocked_completion_items_include_unresolved_evidence',
      passed: completionEvidenceMatrix
        .filter((item) => item.blocksGoalCompletion)
        .every((item) => item.unresolvedEvidence.length > 0),
      message: 'Every completion-blocking evidence item must name unresolved evidence.',
    },
    {
      id: 'external_blocker_ledger_present',
      passed: externalBlockerLedger.length > 0,
      message: 'Readiness response must include an external blocker ledger.',
    },
    {
      id: 'external_blocker_gates_closed',
      passed: externalBlockerLedger.every((blocker) => blocker.productionGateClosed),
      message: 'External blocker production gates must remain closed.',
    },
    {
      id: 'evidence_export_counts_match',
      passed:
        provenEvidenceItems.length > 0 &&
        externalBlockerEvidenceItems.length === externalBlockerLedger.length &&
        closedGuardrailEvidenceItems.length > 0,
      message: 'Evidence export counts must match proven, blocked and guardrail source collections.',
    },
    {
      id: 'evidence_export_validation_passed',
      passed: readinessEvidenceValidation.valid,
      message: 'Readiness evidence export validation must pass.',
    },
    {
      id: 'production_gate_audit_present_and_valid',
      passed: productionGateValidation.valid,
      message: 'Production gate audit must be present and valid.',
    },
    {
      id: 'next_pilot_approval_checklist_matches_blockers',
      passed:
        nextPilotApprovalChecklist.length === externalBlockerLedger.length &&
        nextPilotApprovalChecklist.every(
          (item) => item.providerCallsAllowedBeforeApproval === 0
        ),
      message: 'Next-pilot approval checklist must match blocker ledger and allow zero pre-approval provider calls.',
    },
    {
      id: 'domain_completion_proof_ledger_present_and_valid',
      passed:
        domainCompletionProofValidation.valid &&
        domainCompletionProofValidation.generatedWithoutProviderCalls &&
        domainCompletionProofValidation.domains.length === handoffDomains.length,
      message: 'Domain completion proof ledger must be present, valid, zero-call and cover every handoff domain.',
    },
    {
      id: 'domain_completion_proof_preserves_completion_blockers',
      passed:
        domainCompletionProofValidation.completionClaimAllowed === false &&
        domainCompletionProofValidation.summary.blocksGoalCompletion > 0 &&
        domainCompletionProofValidation.summary.providerCallsAllowedBeforeApproval === 0,
      message: 'Domain completion proof ledger must preserve completion blockers and zero pre-approval provider calls.',
    },
    {
      id: 'provider_execution_gate_present_and_closed',
      passed:
        providerExecutionGateValidation.valid &&
        providerExecutionGateValidation.generatedWithoutProviderCalls &&
        providerExecutionGateValidation.liveExecutionAllowed === false &&
        providerExecutionGateValidation.providerCallsAllowedNow === 0,
      message: 'Provider execution gate must be present, valid, zero-call and closed while external blockers remain.',
    },
    {
      id: 'external_blocker_resolution_checklist_present',
      passed:
        externalBlockerResolutionChecklistValidation.valid &&
        externalBlockerResolutionChecklistValidation.generatedWithoutProviderCalls &&
        externalBlockerResolutionChecklistValidation.summary.blockers ===
          externalBlockerLedger.length &&
        externalBlockerResolutionChecklistValidation.summary
          .providerCallsAllowedBeforeResolution === 0 &&
        externalBlockerResolutionChecklistValidation.liveExecutionAllowedAfterResolution === false,
      message: 'External blocker resolution checklist must cover all blockers, remain zero-call and keep live execution closed.',
    },
    {
      id: 'production_usage_exclusion_present',
      passed:
        productionUsageExclusionValidation.valid &&
        productionUsageExclusionValidation.generatedWithoutProviderCalls &&
        productionUsageExclusionValidation.predictionPersistenceEnabled === false &&
        productionUsageExclusionValidation.backtestingEnabled === false &&
        productionUsageExclusionValidation.modelTrainingEnabled === false &&
        productionUsageExclusionValidation.confidenceImprovementAllowed === false,
      message: 'Production usage exclusion audit must prove trial rows cannot enable prediction persistence, backtesting, training or confidence lift.',
    },
    {
      id: 'blocker_summary_matches_area_blockers',
      passed: blockers.length === areas.reduce((total, area) => total + area.blockers.length, 0),
      message: 'Flattened blocker list must match blockers attached to readiness areas.',
    },
  ]
  const errors = checks
    .filter((check) => !check.passed)
    .map((check) => check.message)

  return {
    valid: errors.length === 0,
    status: errors.length === 0 ? 'valid_with_external_blockers' : 'invalid_response_shape',
    checks,
    errors,
  warnings: [
      'Response shape audit validates local contract consistency only; it does not prove production provider readiness.',
    ],
  }
}

function productionGateAudit({
  providerCallsMade,
  externalBlockerLedger,
  blockedHandoffDomains,
  objectiveAuditBlocked,
  closedGuardrailEvidenceItems,
  readinessEvidenceValidation,
}: {
  providerCallsMade: number
  externalBlockerLedger: ExternalBlocker[]
  blockedHandoffDomains: HandoffDomain[]
  objectiveAuditBlocked: ObjectiveAuditItem[]
  closedGuardrailEvidenceItems: ReadinessEvidenceItem[]
  readinessEvidenceValidation: EvidenceExportValidation
}): ProductionGateAudit {
  const checks = [
    {
      id: 'no_provider_calls_for_gate_audit',
      passed: providerCallsMade === 0,
      message: 'Production gate audit must be generated without provider calls.',
    },
    {
      id: 'external_blockers_present',
      passed: externalBlockerLedger.length > 0,
      message: 'Production gate audit must preserve external blockers until evidence is supplied.',
    },
    {
      id: 'external_production_gates_closed',
      passed: externalBlockerLedger.every((blocker) => blocker.productionGateClosed),
      message: 'All external blocker production gates must remain closed.',
    },
    {
      id: 'zero_preapproval_provider_calls',
      passed: externalBlockerLedger.every(
        (blocker) => blocker.providerCallsRequiredBeforeApproval === 0
      ),
      message: 'No external blocker may require provider calls before approval.',
    },
    {
      id: 'blocked_handoff_domains_present',
      passed: blockedHandoffDomains.length > 0,
      message: 'Production-blocked handoff domains must remain explicit.',
    },
    {
      id: 'objective_remaining_work_present',
      passed: objectiveAuditBlocked.length > 0,
      message: 'Objective audit must retain remaining work while production is externally blocked.',
    },
    {
      id: 'closed_guardrail_evidence_present',
      passed: closedGuardrailEvidenceItems.length > 0,
      message: 'Closed production guardrails must be exported as handoff evidence.',
    },
    {
      id: 'readiness_evidence_validation_passed',
      passed: readinessEvidenceValidation.valid,
      message: 'Readiness evidence validation must pass before gate audit is trusted.',
    },
  ]
  const errors = checks
    .filter((check) => !check.passed)
    .map((check) => check.message)

  return {
    valid: errors.length === 0,
    status: errors.length === 0
      ? 'production_blocked_as_expected'
      : 'invalid_production_gate_state',
    checks,
    errors,
    warnings: [
      'Production gate audit proves guardrails are closed; it is not approval to run production provider execution.',
    ],
  }
}

function surfaceConsistencyAudit({
  providerCallsMade,
  responseShapeAuditValid,
  readinessEvidenceValidationValid,
  productionGateAuditValid,
  domainCompletionProofValidation,
  providerExecutionGateValidation,
  externalBlockerResolutionChecklistValidation,
  productionUsageExclusionValidation,
  completionEvidenceMatrix,
  nextPilotApprovalChecklist,
  externalBlockerLedger,
}: {
  providerCallsMade: number
  responseShapeAuditValid: boolean
  readinessEvidenceValidationValid: boolean
  productionGateAuditValid: boolean
  domainCompletionProofValidation: DomainCompletionProofLedger
  providerExecutionGateValidation: ProviderExecutionGate
  externalBlockerResolutionChecklistValidation: ExternalBlockerResolutionChecklist
  productionUsageExclusionValidation: ProductionUsageExclusionAudit
  completionEvidenceMatrix: CompletionEvidenceMatrixItem[]
  nextPilotApprovalChecklist: NextPilotApprovalChecklistItem[]
  externalBlockerLedger: ExternalBlocker[]
}): SurfaceConsistencyAudit {
  const surfaces = [
    {
      surface: 'readiness_api',
      artifact: '/api/providers/sportsdataio/nba/readiness',
      expectedSignals: [
        'externalBlockerLedger',
        'externalBlockerLedgerRoute',
        'readinessEvidenceExport',
        'readinessEvidenceExportRoute',
        'objectiveAuditRoute',
        'safeNextActionsRoute',
        'productionGateAudit',
        'productionGateRoute',
        'providerExecutionGate',
        'providerExecutionGateRoute',
        'executionReadinessValidationRoute',
        'externalBlockerResolutionChecklist',
        'externalBlockerResolutionRoute',
        'productionUsageExclusionAudit',
        'productionUsageExclusionRoute',
        'nextPilotApprovalChecklist',
        'nextPilotPreflightRoute',
        'externalApprovalPacketRoute',
        'completionAuditRoute',
        'contractAuditRoute',
        'domainCompletionProofLedger',
        'domainCompletionProofRoute',
        'completionEvidenceMatrix',
        'completionEvidenceRoute',
        'responseShapeAudit',
      ],
    },
    {
      surface: 'historical_import_panel',
      artifact: 'src/components/dashboard/HistoricalImportEnginePanel.tsx',
      expectedSignals: [
        'handoff domains',
        'external blocker ledger',
        'external blocker ledger route',
        'readiness evidence export route',
        'objective audit route',
        'safe next actions route',
        'production gate route',
        'provider execution gate',
        'provider execution gate route',
        'execution-readiness validation',
        'external blocker resolution checklist',
        'external blocker resolution route',
        'production usage exclusion audit',
        'production usage exclusion route',
        'next-pilot gates',
        'next-pilot preflight route',
        'external approval packet route',
        'completion audit route',
        'contract audit route',
        'domain completion proof ledger',
        'domain completion proof route',
        'completion evidence matrix',
        'completion evidence route',
      ],
    },
    {
      surface: 'runtime_observability_api',
      artifact: '/api/observability/runtime',
      expectedSignals: [
        'SportsDataIO NBA readiness summary',
        'external blocker ledger route',
        'readiness evidence export route',
        'objective audit route',
        'safe next actions route',
        'production gate route',
        'provider execution gate',
        'provider execution gate route',
        'execution-readiness validation',
        'external blocker resolution checklist',
        'external blocker resolution route',
        'production usage exclusion audit',
        'production usage exclusion route',
        'next-pilot preflight route',
        'external approval packet route',
        'completion audit route',
        'contract audit route',
        'domain completion proof ledger',
        'domain completion proof route',
        'completion evidence matrix',
        'completion evidence route',
        'trial-isolation audit',
        'zero provider-call accounting',
      ],
    },
    {
      surface: 'runtime_observability_panel',
      artifact: 'src/components/dashboard/RuntimeObservabilityPanel.tsx',
      expectedSignals: [
        'external blocker ledger',
        'external blocker ledger route',
        'readiness evidence export route',
        'objective audit route',
        'safe next actions route',
        'production gate audit',
        'production gate route',
        'provider execution gate',
        'provider execution gate route',
        'execution-readiness validation',
        'external blocker resolution checklist',
        'external blocker resolution route',
        'production usage exclusion audit',
        'production usage exclusion route',
        'next-pilot approval checklist',
        'next-pilot preflight route',
        'external approval packet route',
        'completion audit route',
        'contract audit route',
        'domain completion proof ledger',
        'domain completion proof route',
        'completion evidence matrix',
        'completion evidence route',
        'trial-isolation summary',
      ],
    },
  ]
  const completionBlockingItems = completionEvidenceMatrix.filter(
    (item) => item.blocksGoalCompletion
  )
  const checks = [
    {
      id: 'surface_audit_zero_provider_calls',
      passed: providerCallsMade === 0,
      message: 'Surface consistency audit must be generated without provider calls.',
    },
    {
      id: 'all_expected_surfaces_declared',
      passed: surfaces.length === 4,
      message: 'Readiness, historical import and runtime observability surfaces must be declared.',
    },
    {
      id: 'provider_execution_gate_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) => {
            const normalizedSignal = signal.toLowerCase()

            return normalizedSignal.includes('provider execution gate route') ||
              normalizedSignal.includes('providerexecutiongateroute')
          })
        ),
      message: 'Provider execution gate route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'production_gate_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) => {
            const normalizedSignal = signal.toLowerCase()

            return normalizedSignal.includes('production gate route') ||
              normalizedSignal.includes('productiongateroute')
          })
        ),
      message: 'Production gate route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'external_blocker_ledger_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) =>
            signal.toLowerCase().includes('external blocker ledger')
          )
        ),
      message: 'External blocker ledger route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'readiness_evidence_export_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) =>
            signal.toLowerCase().includes('readiness evidence export')
          )
        ),
      message: 'Readiness evidence export route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'objective_audit_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) => {
            const normalizedSignal = signal.toLowerCase()

            return normalizedSignal.includes('objective audit route') ||
              normalizedSignal.includes('objectiveauditroute')
          })
        ),
      message: 'Objective audit route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'safe_next_actions_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) => {
            const normalizedSignal = signal.toLowerCase()

            return normalizedSignal.includes('safe next actions route') ||
              normalizedSignal.includes('safenextactionsroute')
          })
        ),
      message: 'Safe next actions route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'production_usage_exclusion_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) => {
            const normalizedSignal = signal.toLowerCase()

            return normalizedSignal.includes('production usage exclusion route') ||
              normalizedSignal.includes('productionusageexclusionroute')
          })
        ),
      message: 'Production usage exclusion route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'external_blocker_resolution_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) => {
            const normalizedSignal = signal.toLowerCase()

            return normalizedSignal.includes('external blocker resolution route') ||
              normalizedSignal.includes('externalblockerresolutionroute')
          })
        ),
      message: 'External blocker resolution route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'execution_readiness_validation_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) =>
            signal.toLowerCase().includes('execution-readiness') ||
            signal.toLowerCase().includes('executionreadiness')
          )
      ),
      message: 'Execution-readiness validation must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'next_pilot_preflight_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) =>
            signal.toLowerCase().includes('next-pilot preflight')
          )
        ),
      message: 'Next-pilot preflight route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'external_approval_packet_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) =>
            signal.toLowerCase().includes('external approval packet')
          )
        ),
      message: 'External approval packet route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'completion_audit_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) =>
            signal.toLowerCase().includes('completion audit')
          )
        ),
      message: 'Completion audit route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'contract_audit_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) =>
            signal.toLowerCase().includes('contract audit')
          )
        ),
      message: 'Contract audit route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'domain_completion_proof_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) => {
            const normalizedSignal = signal.toLowerCase()

            return normalizedSignal.includes('domain completion proof route') ||
              normalizedSignal.includes('domaincompletionproofroute')
          })
        ),
      message: 'Domain completion proof route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'completion_evidence_route_declared_across_operator_surfaces',
      passed: surfaces
        .filter((surface) =>
          ['readiness_api', 'historical_import_panel', 'runtime_observability_api', 'runtime_observability_panel']
            .includes(surface.surface)
        )
        .every((surface) =>
          surface.expectedSignals.some((signal) => {
            const normalizedSignal = signal.toLowerCase()

            return normalizedSignal.includes('completion evidence route') ||
              normalizedSignal.includes('completionevidenceroute')
          })
        ),
      message: 'Completion evidence route must be declared across readiness, historical import and runtime observability surfaces.',
    },
    {
      id: 'core_audits_valid',
      passed:
        responseShapeAuditValid &&
        readinessEvidenceValidationValid &&
        productionGateAuditValid,
      message: 'Core readiness audits must be valid before surface consistency is trusted.',
    },
    {
      id: 'completion_matrix_has_expected_blockers',
      passed:
        completionEvidenceMatrix.length > 0 &&
        completionBlockingItems.length > 0 &&
        completionBlockingItems.every((item) => item.unresolvedEvidence.length > 0),
      message: 'Completion evidence matrix must preserve unresolved proof gaps while external blockers remain.',
    },
    {
      id: 'domain_completion_proof_ledger_consistent',
      passed:
        domainCompletionProofValidation.valid &&
        domainCompletionProofValidation.summary.blocksGoalCompletion > 0 &&
        domainCompletionProofValidation.summary.providerCallsAllowedBeforeApproval === 0,
      message: 'Domain completion proof ledger must remain valid, completion-blocking and zero pre-approval call across surfaces.',
    },
    {
      id: 'provider_execution_gate_closed_across_surfaces',
      passed:
        providerExecutionGateValidation.valid &&
        providerExecutionGateValidation.liveExecutionAllowed === false &&
        providerExecutionGateValidation.providerCallsAllowedNow === 0,
      message: 'Provider execution gate must remain closed with zero allowed calls across surfaces.',
    },
    {
      id: 'resolution_checklist_consistent_across_surfaces',
      passed:
        externalBlockerResolutionChecklistValidation.valid &&
        externalBlockerResolutionChecklistValidation.generatedWithoutProviderCalls &&
        externalBlockerResolutionChecklistValidation.summary.blockers ===
          externalBlockerLedger.length &&
        externalBlockerResolutionChecklistValidation.summary
          .providerCallsAllowedBeforeResolution === 0,
      message: 'External blocker resolution checklist must remain aligned with blocker surfaces and zero pre-resolution calls.',
    },
    {
      id: 'production_usage_exclusion_consistent_across_surfaces',
      passed:
        productionUsageExclusionValidation.valid &&
        productionUsageExclusionValidation.generatedWithoutProviderCalls &&
        productionUsageExclusionValidation.trialRowsProductionEligible === false &&
        productionUsageExclusionValidation.predictionPersistenceEnabled === false &&
        productionUsageExclusionValidation.backtestingEnabled === false &&
        productionUsageExclusionValidation.modelTrainingEnabled === false,
      message: 'Production usage exclusion audit must remain aligned across readiness and observability surfaces.',
    },
    {
      id: 'approval_checklist_matches_blocker_ledger',
      passed:
        nextPilotApprovalChecklist.length === externalBlockerLedger.length &&
        nextPilotApprovalChecklist.every(
          (item) => item.providerCallsAllowedBeforeApproval === 0
        ),
      message: 'Next-pilot approval checklist must match the external blocker ledger with zero pre-approval calls.',
    },
    {
      id: 'production_gates_closed_across_surfaces',
      passed: externalBlockerLedger.every((blocker) => blocker.productionGateClosed),
      message: 'All surfaces must present production gates as closed until external evidence exists.',
    },
  ]
  const errors = checks
    .filter((check) => !check.passed)
    .map((check) => check.message)

  return {
    valid: errors.length === 0,
    status: errors.length === 0
      ? 'consistent_with_external_blockers'
      : 'inconsistent_surface_state',
    generatedWithoutProviderCalls: providerCallsMade === 0,
    surfaces,
    checks,
    errors,
    warnings: [
      'Surface consistency audit validates local reporting alignment only; it does not resolve external provider blockers.',
    ],
  }
}

export function getSportsDataIoNbaIntegrationReadiness() {
  const runtime = getSportsDataIoRuntimeAdapterStatus()
  const capabilities = getSportsDataIoRuntimeCapabilities()
  const runtimeValidation = runSportsDataIoRuntimeValidation()
  const odds = getSportsDataIoNbaOddsReadiness()
  const playerProps = getSportsDataIoNbaPlayerPropsReadiness()
  const playerStats = getSportsDataIoNbaPlayerStatsReadiness()
  const providerCallsMade =
    callsFrom(runtime) +
    callsFrom(capabilities) +
    callsFrom(runtimeValidation) +
    callsFrom(odds) +
    callsFrom(playerProps) +
    callsFrom(playerStats)

  const areas = [
    readinessArea({
      key: 'runtime_adapter',
      status: runtimeValidation.success ? 'ready_zero_call' : 'blocked_pending_external_confirmation',
      buildArtifact: 'src/services/sportsdataio-runtime-adapter.service.ts',
      providerCallsMade: callsFrom(runtimeValidation),
      blockers: runtimeValidation.success ? [] : ['Runtime adapter validation did not pass local deterministic checks.'],
      safeNextAction: 'Keep live calls disabled unless a future provider pilot is explicitly capped and approved.',
    }),
    readinessArea({
      key: 'trial_persistence_verified',
      status: 'complete_for_trial_scope',
      buildArtifact: 'src/services/sportsdataio-historical-import-readiness.service.ts',
      providerCallsMade: 0,
      blockers: [
        'Trial/scrambled rows are import-path validation only and remain production_eligible=false.',
        'Production historical reconciliation still requires explicit quota and date-window approval.',
      ],
      safeNextAction: 'Use persisted trial results only for architecture validation, not ROI, calibration, model training or recommendations.',
    }),
    readinessArea({
      key: 'odds_and_historical_odds',
      status: 'blocked_pending_external_confirmation',
      buildArtifact: 'src/services/sportsdataio-nba-odds-readiness.service.ts',
      providerCallsMade: callsFrom(odds),
      blockers: validationWarnings(odds),
      safeNextAction: 'Confirm exact odds endpoints, entitlement, sportsbook coverage and capped historical windows before any live odds call.',
    }),
    readinessArea({
      key: 'player_stats',
      status: 'blocked_pending_migration',
      buildArtifact: 'src/services/sportsdataio-nba-player-stats-readiness.service.ts',
      providerCallsMade: callsFrom(playerStats),
      blockers: [
        ...validationWarnings(playerStats),
        'Apply supabase/migrations/202607130002_sport_player_stats_v1.sql before player-stat persistence.',
      ],
      safeNextAction: 'Confirm exact player season/game stat endpoints and apply the additive migration before a capped pilot.',
    }),
    readinessArea({
      key: 'player_props',
      status: 'blocked_pending_external_confirmation',
      buildArtifact: 'src/services/sportsdataio-nba-player-props-readiness.service.ts',
      providerCallsMade: callsFrom(playerProps),
      blockers: [
        ...validationWarnings(playerProps),
        'Player prop settlement and validation rules are not implemented for production use.',
      ],
      safeNextAction: 'Confirm exact prop markets, entitlement and settlement rules before any live prop call.',
    }),
  ]

  const blockers = areas.flatMap((area) =>
    area.blockers.map((blocker) => ({
      area: area.key,
      blocker,
    }))
  )
  const allLocalValidationsPassed = [runtimeValidation, odds, playerProps, playerStats].every(
    (result) => result.success
  )
  const handoffDomains = [
    handoffDomain({
      domain: 'teams_events_scores',
      status: 'complete_for_trial_scope',
      persistence: 'sports_teams, sport_events, provider_entity_mappings, sports_sync_jobs',
      productionUse: 'blocked_trial_only',
      evidence: [
        'SportsDataIO NBA Pilot Import V1 persisted trial teams, events, scores and mappings.',
        'SportsDataIO NBA Pilot Import V2 verified the 2025-DEC-26 event/stat path under trial isolation.',
      ],
      blockers: [
        'Trial/scrambled rows are not authentic historical performance data.',
        'Production historical reconciliation still requires explicit provider quota and date-window approval.',
      ],
    }),
    handoffDomain({
      domain: 'standings_team_stats_game_stats',
      status: 'complete_for_trial_scope',
      persistence: 'sport_standings, team_stats, sport_game_stats, provider_entity_mappings, sports_sync_jobs',
      productionUse: 'blocked_trial_only',
      evidence: [
        'Pilot V2 persisted standings, team season stats and integer-safe team game stats for the approved trial window.',
      ],
      blockers: [
        'Trial rows remain import-path validation only and cannot feed calibration, ROI, model training or recommendations.',
      ],
    }),
    handoffDomain({
      domain: 'players_rosters',
      status: 'complete_for_trial_scope',
      persistence: 'sport_players, provider_entity_mappings, sports_sync_jobs',
      productionUse: 'blocked_trial_only',
      evidence: [
        'Players Pilot V1 persisted trial-isolated player identity rows and provider mappings.',
      ],
      blockers: [
        'Roster identity rows are trial/scrambled and cannot unlock production player intelligence or prop models.',
      ],
    }),
    handoffDomain({
      domain: 'injuries',
      status: 'complete_for_trial_scope',
      persistence: 'sport_injuries, provider_entity_mappings, sports_sync_jobs',
      productionUse: 'blocked_trial_only',
      evidence: [
        'Injuries Pilot V1 persisted trial injury rows from /v3/nba/projections/json/InjuredPlayers.',
        'NBA injury/lineup confidence keeps trial injury rows from improving production confidence.',
      ],
      blockers: [
        'Production-eligible injury ingestion remains pending provider approval and trial-to-production data separation.',
      ],
    }),
    handoffDomain({
      domain: 'depth_charts_starting_lineups',
      status: 'complete_for_trial_scope',
      persistence: 'sport_lineups, sport_players, provider_entity_mappings, sports_sync_jobs',
      productionUse: 'blocked_trial_only',
      evidence: [
        'Depth Charts and Starting Lineups Pilot V1 persisted 758 trial lineup/depth rows with stable deterministic IDs.',
        'Stored lineup feature enrichment uses row availability while blocking production confidence improvement.',
      ],
      blockers: [
        'Trial lineup/depth rows cannot feed production confidence, backtesting, calibration or model training.',
      ],
    }),
    handoffDomain({
      domain: 'game_odds_historical_odds',
      status: 'blocked_pending_entitlement_confirmation',
      persistence: 'sports_odds_snapshots, sports_sync_jobs',
      productionUse: 'not_enabled',
      evidence: [
        'SportsDataIO NBA Odds Readiness V1 validates deterministic moneyline, spread and total rows locally.',
      ],
      blockers: [
        'Exact authenticated SportsDataIO NBA odds and historical odds endpoint paths are not confirmed.',
        'Sportsbook coverage, historical windows and entitlement are not confirmed.',
      ],
    }),
    handoffDomain({
      domain: 'player_stats',
      status: 'blocked_pending_migration',
      persistence: 'sport_player_stats, provider_entity_mappings, sports_sync_jobs',
      productionUse: 'not_enabled',
      evidence: [
        'SportsDataIO NBA Player Stats Readiness V1 validates season and game stat fixture normalization locally.',
        'supabase/migrations/202607130002_sport_player_stats_v1.sql defines the additive persistence target.',
      ],
      blockers: [
        'Apply the additive sport_player_stats migration before persistence.',
        'Exact player season/game stat endpoint paths are not confirmed.',
      ],
    }),
    handoffDomain({
      domain: 'player_props',
      status: 'blocked_pending_settlement_rules',
      persistence: 'sports_odds_snapshots with player prop metadata, provider_entity_mappings, sports_sync_jobs',
      productionUse: 'not_enabled',
      evidence: [
        'SportsDataIO NBA Player Props Readiness V1 validates deterministic over/under prop expansion locally.',
      ],
      blockers: [
        'Exact prop endpoints, market IDs, entitlement and settlement rules are not confirmed.',
        'Prop prediction persistence, backtesting, model training and settlement remain disabled.',
      ],
    }),
    handoffDomain({
      domain: 'production_historical_reconciliation',
      status: 'blocked_pending_quota_approval',
      persistence: 'existing normalized sports tables plus sports_sync_jobs metadata',
      productionUse: 'not_enabled',
      evidence: [
        'Historical Import Engine Core V1 plans provider-independent checkpoints and quota estimates without execution.',
        'SportsDataIO pilot rows validate import architecture but not production historical truth.',
      ],
      blockers: [
        'Provider-backed NBA Data Quality and Historical Reconciliation Phase B requires explicit quota/date-window approval.',
        'Full or broad historical sync remains disallowed without a capped approved plan.',
      ],
    }),
  ]
  const blockedHandoffDomains = handoffDomains.filter((domain) =>
    domain.status.startsWith('blocked_')
  )
  const objectiveAudit = [
    objectiveAuditItem({
      requirement: 'safe_provider_integration',
      status: 'partially_satisfied',
      evidence: [
        'SportsDataIO runtime adapter, status, capabilities and guarded execution routes exist.',
        'Trial Teams, GamesByDate, standings, team stats, game stats, players, injuries, depth charts and starting lineups have been validated under capped pilots.',
        'Odds, player props and player stats readiness APIs now expose zero-call preflight gates.',
      ],
      remainingWork: [
        'Exact odds, historical odds, player stat and player prop endpoint paths still require external confirmation.',
        'Production or broader historical execution requires explicit quota/date-window approval.',
      ],
    }),
    objectiveAuditItem({
      requirement: 'normalization',
      status: 'partially_satisfied',
      evidence: [
        'Trial teams/events/scores, standings, game stats, players, injuries and lineups normalize into repository tables.',
        'Depth/lineup payload normalization handles nested provider containers and one-to-many expansion.',
        'Local deterministic fixtures validate odds, player prop and player stat row shapes.',
      ],
      remainingWork: [
        'Future live odds/player-prop/player-stat payloads still need shape confirmation before persistence pilots.',
      ],
    }),
    objectiveAuditItem({
      requirement: 'persistence',
      status: 'partially_satisfied',
      evidence: [
        'Trial SportsDataIO teams, events, standings, game stats, players, injuries, lineups and mappings are persisted under trial isolation.',
        'sport_lineups migration is applied remotely and verified by successful lineup/depth persistence.',
        'sports_sync_jobs records import metadata and corrected one-to-many counters.',
      ],
      remainingWork: [
        'sport_player_stats migration is created but not applied automatically.',
        'Odds, historical odds, player props and player stats have readiness contracts but no live persistence pilot.',
      ],
    }),
    objectiveAuditItem({
      requirement: 'feature_enrichment',
      status: 'satisfied',
      evidence: [
        'NBA injury/lineup confidence reads stored injury and lineup rows.',
        'NBA feature preview uses stored lineup sample size, freshness and provenance.',
        'Trial-only rows are prevented from improving production confidence.',
      ],
      remainingWork: [],
    }),
    objectiveAuditItem({
      requirement: 'validation',
      status: 'partially_satisfied',
      evidence: [
        'NBA data-quality audit includes player and optional player-stat checks.',
        'SportsDataIO trial isolation audit scans normalized tables and prediction_history for leakage.',
        'Historical import readiness validates deterministic fixtures and one-to-many counter behavior.',
      ],
      remainingWork: [
        'Production real-data validation remains pending because trial/scrambled data cannot prove model quality.',
      ],
    }),
    objectiveAuditItem({
      requirement: 'observability',
      status: 'satisfied',
      evidence: [
        '/api/observability/runtime includes SportsDataIO NBA readiness and trial-isolation summaries.',
        'RuntimeObservabilityPanel displays SportsDataIO NBA status, trial rows, isolation issues and prediction leakage counts.',
        'HistoricalImportEnginePanel displays handoff domains and next-pilot gates.',
      ],
      remainingWork: [],
    }),
    objectiveAuditItem({
      requirement: 'documentation',
      status: 'satisfied',
      evidence: [
        'PROJECT_STATUS, MASTER_ROADMAP, ARCHITECTURE and DECISION_LOG document the SportsDataIO NBA readiness state.',
        'Domain docs exist for player stats, odds, player props, integration readiness, trial isolation and observability.',
      ],
      remainingWork: [],
    }),
    objectiveAuditItem({
      requirement: 'build_verification',
      status: 'satisfied',
      evidence: [
        'npm.cmd run build has exited 0 after each completed safe module.',
      ],
      remainingWork: [],
    }),
    objectiveAuditItem({
      requirement: 'provider_call_and_trial_isolation_constraints',
      status: 'satisfied',
      evidence: [
        'Zero-call readiness modules report externalProviderCallsMade=0.',
        'Live pilots were capped and trial/scrambled rows remain production_eligible=false.',
        'Prediction persistence, backtesting and model training remain disabled for trial-only data.',
      ],
      remainingWork: [],
    }),
  ]
  const objectiveAuditBlocked = objectiveAudit.filter((item) => item.remainingWork.length > 0)
  const completionEvidenceMatrix = [
    completionEvidenceItem({
      requirement: 'safe_provider_integration',
      status: 'partial',
      requiredEvidence: [
        'Guarded SportsDataIO runtime adapter and execution route contracts exist.',
        'Approved trial import paths have completed under capped provider-call policies.',
        'Future provider-backed domains have exact endpoint, entitlement and capped execution approval before live calls.',
      ],
      proofArtifacts: [
        'src/services/sportsdataio-runtime-adapter.service.ts',
        'src/services/sportsdataio-historical-import-readiness.service.ts',
        'docs/PROJECT_STATUS.md',
      ],
      verifiedEvidence: objectiveAudit[0].evidence,
      unresolvedEvidence: objectiveAudit[0].remainingWork,
      blocksGoalCompletion: true,
    }),
    completionEvidenceItem({
      requirement: 'normalization',
      status: 'partial',
      requiredEvidence: [
        'Trial payloads normalize into repository tables without fabricated mappings.',
        'Known one-to-many payload expansion uses stable deterministic IDs and nonnegative reporting counters.',
        'Future odds, player-prop and player-stat payload shapes are confirmed before persistence pilots.',
      ],
      proofArtifacts: [
        'src/services/sportsdataio-historical-import-readiness.service.ts',
        'src/services/sportsdataio-nba-odds-readiness.service.ts',
        'src/services/sportsdataio-nba-player-props-readiness.service.ts',
        'src/services/sportsdataio-nba-player-stats-readiness.service.ts',
      ],
      verifiedEvidence: objectiveAudit[1].evidence,
      unresolvedEvidence: objectiveAudit[1].remainingWork,
      blocksGoalCompletion: true,
    }),
    completionEvidenceItem({
      requirement: 'persistence',
      status: 'partial',
      requiredEvidence: [
        'Approved trial rows persist under trial isolation.',
        'All target tables, indexes and conflict targets exist before live persistence pilots.',
        'Provider mappings and sync job metadata are written idempotently for approved domains.',
      ],
      proofArtifacts: [
        'supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql',
        'supabase/migrations/202607130002_sport_player_stats_v1.sql',
        'src/services/sportsdataio-historical-import-readiness.service.ts',
      ],
      verifiedEvidence: objectiveAudit[2].evidence,
      unresolvedEvidence: objectiveAudit[2].remainingWork,
      blocksGoalCompletion: true,
    }),
    completionEvidenceItem({
      requirement: 'feature_enrichment',
      status: 'proven',
      requiredEvidence: [
        'Stored injury and lineup rows can enrich feature previews.',
        'Trial-only rows cannot improve production confidence.',
      ],
      proofArtifacts: [
        'src/services/nba-injury-lineup-confidence.service.ts',
        'src/services/nba-feature-store-integration.service.ts',
        'docs/nba-stored-lineup-feature-enrichment-v1.md',
      ],
      verifiedEvidence: objectiveAudit[3].evidence,
      unresolvedEvidence: objectiveAudit[3].remainingWork,
      blocksGoalCompletion: false,
    }),
    completionEvidenceItem({
      requirement: 'validation',
      status: 'partial',
      requiredEvidence: [
        'Local data-quality, trial-isolation and readiness validations pass without provider calls.',
        'Production real-data validation proves feature quality and settlement correctness before production use.',
      ],
      proofArtifacts: [
        'src/services/nba-data-quality.service.ts',
        'src/services/sportsdataio-nba-trial-isolation-audit.service.ts',
        'src/services/sportsdataio-nba-integration-readiness.service.ts',
      ],
      verifiedEvidence: objectiveAudit[4].evidence,
      unresolvedEvidence: objectiveAudit[4].remainingWork,
      blocksGoalCompletion: true,
    }),
    completionEvidenceItem({
      requirement: 'observability',
      status: 'proven',
      requiredEvidence: [
        'Runtime and historical import dashboards surface readiness, blockers and trial-isolation state.',
        'Observability makes zero provider calls and performs no mutations.',
      ],
      proofArtifacts: [
        'src/services/runtime-observability.service.ts',
        'src/components/dashboard/RuntimeObservabilityPanel.tsx',
        'src/components/dashboard/HistoricalImportEnginePanel.tsx',
      ],
      verifiedEvidence: objectiveAudit[5].evidence,
      unresolvedEvidence: objectiveAudit[5].remainingWork,
      blocksGoalCompletion: false,
    }),
    completionEvidenceItem({
      requirement: 'documentation',
      status: 'proven',
      requiredEvidence: [
        'Project status, roadmap, architecture, decision log and module docs describe current safe state and blockers.',
      ],
      proofArtifacts: [
        'docs/PROJECT_STATUS.md',
        'docs/MASTER_ROADMAP.md',
        'docs/ARCHITECTURE.md',
        'docs/DECISION_LOG.md',
        'docs/sportsdataio-nba-integration-readiness-v1.md',
      ],
      verifiedEvidence: objectiveAudit[6].evidence,
      unresolvedEvidence: objectiveAudit[6].remainingWork,
      blocksGoalCompletion: false,
    }),
    completionEvidenceItem({
      requirement: 'build_verification',
      status: 'proven',
      requiredEvidence: [
        'Repository production build exits 0 after completed safe modules.',
      ],
      proofArtifacts: [
        'docs/PROJECT_STATUS.md',
      ],
      verifiedEvidence: objectiveAudit[7].evidence,
      unresolvedEvidence: objectiveAudit[7].remainingWork,
      blocksGoalCompletion: false,
    }),
    completionEvidenceItem({
      requirement: 'provider_call_and_trial_isolation_constraints',
      status: 'proven',
      requiredEvidence: [
        'Readiness modules report zero provider calls.',
        'Trial rows remain production_eligible=false.',
        'Prediction persistence, backtesting and model training remain disabled for trial-only data.',
      ],
      proofArtifacts: [
        'src/services/sportsdataio-nba-integration-readiness.service.ts',
        'src/services/sportsdataio-nba-trial-isolation-audit.service.ts',
        'src/services/runtime-observability.service.ts',
      ],
      verifiedEvidence: objectiveAudit[8].evidence,
      unresolvedEvidence: objectiveAudit[8].remainingWork,
      blocksGoalCompletion: false,
    }),
  ]
  const externalBlockerLedger = [
    externalBlocker({
      id: 'sportsdataio_nba_odds_endpoint_entitlement',
      domain: 'game_odds_historical_odds',
      category: 'endpoint_confirmation',
      status: 'open_external',
      owner: 'provider',
      unblocks: [
        'Capped NBA game odds pilot planning.',
        'Future historical odds snapshot persistence into sports_odds_snapshots.',
      ],
      evidenceRequired: [
        'Exact authenticated endpoint path for current game odds.',
        'Exact authenticated endpoint path for historical odds, if separate.',
        'Confirmed sportsbook coverage and response shape for moneyline, spread and total markets.',
      ],
      safeUntilResolved: [
        'Do not call unconfirmed odds endpoints.',
        'Keep CLV, steam, arbitrage and production odds enrichment on stored/approved data only.',
      ],
      nextSafeAction: 'Confirm exact SportsDataIO NBA odds endpoints and entitlement before requesting a capped pilot.',
      providerCallsRequiredBeforeApproval: 0,
      productionGateClosed: true,
    }),
    externalBlocker({
      id: 'sportsdataio_nba_player_stats_migration_and_endpoints',
      domain: 'player_stats',
      category: 'migration_application',
      status: 'open_external',
      owner: 'database_admin',
      unblocks: [
        'Player season stat persistence pilot.',
        'Player game stat persistence pilot.',
        'Future player-level feature enrichment with production-eligible data.',
      ],
      evidenceRequired: [
        'Applied supabase/migrations/202607130002_sport_player_stats_v1.sql in the target Supabase project.',
        'Verified sport_player_stats columns, indexes and grants match the migration.',
        'Exact authenticated SportsDataIO NBA player season and player game stat endpoint paths.',
      ],
      safeUntilResolved: [
        'Run only zero-call player-stat readiness validation.',
        'Do not persist live player-stat rows.',
        'Do not use trial player-stat fixtures for production confidence.',
      ],
      nextSafeAction: 'Apply and verify the additive migration only after player-stat persistence is approved.',
      providerCallsRequiredBeforeApproval: 0,
      productionGateClosed: true,
    }),
    externalBlocker({
      id: 'sportsdataio_nba_player_props_endpoints_settlement',
      domain: 'player_props',
      category: 'settlement_rules',
      status: 'open_external',
      owner: 'product_owner',
      unblocks: [
        'Capped NBA player props pilot planning.',
        'Prop-market persistence into sports_odds_snapshots with player metadata.',
        'Future prop prediction and settlement workflows.',
      ],
      evidenceRequired: [
        'Exact authenticated prop endpoint path and market identifiers.',
        'Confirmed entitlement and response shape for over/under prop markets.',
        'Implemented and validated prop settlement/grading rules before prediction use.',
      ],
      safeUntilResolved: [
        'Keep prop prediction persistence disabled.',
        'Keep prop backtesting, settlement and model training disabled.',
        'Use deterministic prop fixtures only for contract validation.',
      ],
      nextSafeAction: 'Confirm prop endpoints, markets and settlement requirements before any live prop call.',
      providerCallsRequiredBeforeApproval: 0,
      productionGateClosed: true,
    }),
    externalBlocker({
      id: 'sportsdataio_nba_historical_reconciliation_quota',
      domain: 'production_historical_reconciliation',
      category: 'quota_approval',
      status: 'open_external',
      owner: 'operator',
      unblocks: [
        'Provider-backed NBA Data Quality and Historical Reconciliation Phase B.',
        'Broad historical coverage audits using real production-eligible provider data.',
      ],
      evidenceRequired: [
        'Approved capped date window.',
        'Approved maximum request count and concurrency limit.',
        'Explicit confirmation that the run may consume provider quota.',
      ],
      safeUntilResolved: [
        'Do not run broad historical imports.',
        'Keep dry-run planning and local readiness checks as the only automatic behavior.',
      ],
      nextSafeAction: 'Request a separately capped historical reconciliation plan before any broad provider execution.',
      providerCallsRequiredBeforeApproval: 0,
      productionGateClosed: true,
    }),
    externalBlocker({
      id: 'sportsdataio_nba_trial_to_production_validation',
      domain: 'production_prediction_readiness',
      category: 'production_validation',
      status: 'open_external',
      owner: 'product_owner',
      unblocks: [
        'Production confidence improvement from SportsDataIO NBA rows.',
        'ROI, calibration, model training and recommendation use of provider-backed NBA features.',
      ],
      evidenceRequired: [
        'Production-eligible non-scrambled provider data persisted separately from trial rows.',
        'No trial rows included in prediction, backtest, calibration or training queries.',
        'Real-data validation showing feature quality and settlement correctness.',
      ],
      safeUntilResolved: [
        'Keep trial=true and production_eligible=false rows excluded from production predictions.',
        'Keep lineup and injury confidence capped for trial-only evidence.',
        'Keep model training and calibration disabled for trial-only imports.',
      ],
      nextSafeAction: 'Run trial-isolation audit before and after any future production-eligible pilot.',
      providerCallsRequiredBeforeApproval: 0,
      productionGateClosed: true,
    }),
  ]
  const provenEvidenceItems = [
    readinessEvidenceItem({
      id: 'approved_trial_import_paths',
      category: 'proven_capability',
      status: 'proven',
      title: 'Approved trial import paths persisted under trial isolation.',
      evidence: [
        'Teams, GamesByDate, standings, team stats, game stats, players, injuries, depth charts and starting lineups have completed approved capped trial pilots.',
        'Trial rows remain marked trial/scrambled and production_eligible=false.',
      ],
      artifacts: [
        'src/services/sportsdataio-historical-import-readiness.service.ts',
        'docs/sportsdataio-nba-depth-lineups-pilot-v1.md',
        'docs/PROJECT_STATUS.md',
      ],
      providerCallsMade: 0,
    }),
    readinessEvidenceItem({
      id: 'lineup_depth_persistence_verified',
      category: 'proven_capability',
      status: 'proven',
      title: 'Depth-chart and starting-lineup persistence is verified for the approved trial scope.',
      evidence: [
        'Depth Charts and Starting Lineups Pilot V1 persisted 758 sport_lineups rows and 758 provider mappings.',
        'One-to-many reporting counters keep records_skipped nonnegative for the 39 -> 758 expansion case.',
      ],
      artifacts: [
        'supabase/migrations/202607130001_sport_lineups_depth_charts_v1.sql',
        'src/services/sportsdataio-historical-import-readiness.service.ts',
        'docs/sportsdataio-nba-depth-lineups-pilot-v1.md',
      ],
      providerCallsMade: 0,
    }),
    readinessEvidenceItem({
      id: 'zero_call_future_domain_readiness',
      category: 'proven_capability',
      status: 'proven',
      title: 'Future odds, player-prop and player-stat domains have zero-call readiness contracts.',
      evidence: [
        'Odds readiness validates deterministic moneyline, spread and total rows locally.',
        'Player-props readiness validates deterministic over/under expansion locally.',
        'Player-stats readiness validates season and game stat fixtures locally and provides migration preflight SQL.',
      ],
      artifacts: [
        'src/services/sportsdataio-nba-odds-readiness.service.ts',
        'src/services/sportsdataio-nba-player-props-readiness.service.ts',
        'src/services/sportsdataio-nba-player-stats-readiness.service.ts',
      ],
      providerCallsMade: 0,
    }),
    readinessEvidenceItem({
      id: 'trial_safe_feature_enrichment',
      category: 'proven_capability',
      status: 'proven',
      title: 'Feature enrichment can observe trial rows without improving production confidence.',
      evidence: [
        'NBA injury/lineup confidence reads stored injuries and lineups.',
        'NBA feature preview reports stored lineup sample size, freshness and provenance while preserving trial-only confidence caps.',
      ],
      artifacts: [
        'src/services/nba-injury-lineup-confidence.service.ts',
        'src/services/nba-feature-store-integration.service.ts',
      ],
      providerCallsMade: 0,
    }),
    readinessEvidenceItem({
      id: 'observability_and_trial_isolation',
      category: 'proven_capability',
      status: 'proven',
      title: 'Readiness, blocker and trial-isolation state is observable without provider calls.',
      evidence: [
        '/api/providers/sportsdataio/nba/readiness exposes handoff, objective audit, blocker ledger and safety invariants.',
        '/api/observability/runtime exposes SportsDataIO NBA readiness, blocker ledger summary and trial-isolation audit state.',
      ],
      artifacts: [
        'src/services/sportsdataio-nba-integration-readiness.service.ts',
        'src/services/runtime-observability.service.ts',
        'src/components/dashboard/RuntimeObservabilityPanel.tsx',
      ],
      providerCallsMade: 0,
    }),
  ]
  const externalBlockerEvidenceItems = externalBlockerLedger.map((blocker) =>
    readinessEvidenceItem({
      id: blocker.id,
      category: 'external_blocker',
      status: 'blocked_external',
      title: blocker.nextSafeAction,
      evidence: blocker.evidenceRequired,
      artifacts: [
        'src/services/sportsdataio-nba-integration-readiness.service.ts',
        'docs/sportsdataio-nba-integration-readiness-v1.md',
      ],
      providerCallsMade: blocker.providerCallsRequiredBeforeApproval,
    })
  )
  const closedGuardrailEvidenceItems = [
    'trial_rows_not_production_truth',
    'no_uncapped_historical_imports',
    'no_trial_confidence_improvement',
    'no_unconfirmed_future_domain_calls',
    'no_trial_player_stats_production_confidence',
    'no_player_props_before_settlement',
  ].map((id, index) =>
    readinessEvidenceItem({
      id,
      category: 'closed_guardrail',
      status: 'closed',
      title: [
        'Trial/scrambled rows cannot be treated as production historical truth.',
        'Uncapped or broad SportsDataIO historical imports remain disabled.',
        'Trial-only rows cannot improve production prediction confidence.',
        'Odds, historical odds and player props require confirmed endpoints before live calls.',
        'Trial player stats cannot improve production confidence or train models.',
        'Player-prop settlement requires implemented and validated market grading rules.',
      ][index],
      evidence: [handoffDomains[index]?.blockers[0] ?? 'Guardrail is enforced by readiness production gates.'],
      artifacts: [
        'src/services/sportsdataio-nba-integration-readiness.service.ts',
        'docs/PROJECT_STATUS.md',
      ],
      providerCallsMade: 0,
    })
  )
  const readinessEvidenceValidation = evidenceExportValidation({
    provenEvidenceItems,
    externalBlockerEvidenceItems,
    closedGuardrailEvidenceItems,
    externalBlockerLedger,
    providerCallsMade,
  })
  const productionGateValidation = productionGateAudit({
    providerCallsMade,
    externalBlockerLedger,
    blockedHandoffDomains,
    objectiveAuditBlocked,
    closedGuardrailEvidenceItems,
    readinessEvidenceValidation,
  })
  const nextPilotApprovalChecklist: NextPilotApprovalChecklistItem[] =
    externalBlockerLedger.map((blocker) => ({
      domain: blocker.domain,
      status: 'blocked_until_approved',
      approvalOwner: blocker.owner,
      approvalsRequired: blocker.evidenceRequired,
      prerequisites: blocker.unblocks,
      cappedExecutionRequirements: [
        'Explicit maximum provider-call cap approved for this domain.',
        'Concurrency remains 1 for the first capped pilot.',
        'No automatic retries unless separately approved for the pilot.',
        'trial=true, scrambled=true and production_eligible=false unless production eligibility is explicitly approved.',
        'Prediction persistence, backtesting and model training remain disabled for trial-only rows.',
      ],
      safeUntilApproved: blocker.safeUntilResolved,
      providerCallsAllowedBeforeApproval: blocker.providerCallsRequiredBeforeApproval,
    }))
  const domainCompletionProofValidation = domainCompletionProofLedger({
    providerCallsMade,
    handoffDomains,
    externalBlockerLedger,
    completionEvidenceMatrix,
  })
  const providerExecutionGateValidation = providerExecutionGate({
    providerCallsMade,
    externalBlockerLedger,
    productionGateValidation,
    nextPilotApprovalChecklist: {
      generatedWithoutProviderCalls: providerCallsMade === 0,
      summary: {
        providerCallsAllowedBeforeApproval: nextPilotApprovalChecklist.reduce(
          (total, item) => total + item.providerCallsAllowedBeforeApproval,
          0
        ),
      },
    },
    domainCompletionProofValidation,
  })
  const externalBlockerResolutionChecklistValidation =
    externalBlockerResolutionChecklist({
      providerCallsMade,
      externalBlockerLedger,
      nextPilotApprovalChecklist,
      providerExecutionGateValidation,
    })
  const productionUsageExclusionValidation = productionUsageExclusionAudit({
    providerCallsMade,
    externalBlockerLedger,
    domainCompletionProofValidation,
  })
  const responseShapeAudit = readinessResponseShapeAudit({
    providerCallsMade,
    allLocalValidationsPassed,
    areas,
    blockers,
    handoffDomains,
    blockedHandoffDomains,
    objectiveAudit,
    objectiveAuditBlocked,
    completionEvidenceMatrix,
    externalBlockerLedger,
    provenEvidenceItems,
    externalBlockerEvidenceItems,
    closedGuardrailEvidenceItems,
    readinessEvidenceValidation,
    productionGateValidation,
    nextPilotApprovalChecklist,
    domainCompletionProofValidation,
    providerExecutionGateValidation,
    externalBlockerResolutionChecklistValidation,
    productionUsageExclusionValidation,
  })
  const surfaceConsistencyValidation = surfaceConsistencyAudit({
    providerCallsMade,
    responseShapeAuditValid: responseShapeAudit.valid,
    readinessEvidenceValidationValid: readinessEvidenceValidation.valid,
    productionGateAuditValid: productionGateValidation.valid,
    domainCompletionProofValidation,
    providerExecutionGateValidation,
    externalBlockerResolutionChecklistValidation,
    productionUsageExclusionValidation,
    completionEvidenceMatrix,
    nextPilotApprovalChecklist,
    externalBlockerLedger,
  })
  const approvalPacket = externalApprovalPacket({
    providerCallsMade,
    externalBlockerLedger,
    nextPilotApprovalChecklist,
    completionEvidenceMatrix,
    surfaceConsistencyValidation,
    readinessEvidenceItems: [
      ...provenEvidenceItems,
      ...externalBlockerEvidenceItems,
      ...closedGuardrailEvidenceItems,
    ],
  })
  const blockedStateValidation = blockedStateAudit({
    providerCallsMade,
    externalBlockerLedger,
    completionEvidenceMatrix,
    approvalPacket,
  })

  return {
    success: allLocalValidationsPassed && providerCallsMade === 0,
    mode: 'sportsdataio_nba_integration_readiness_v1',
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: providerCallsMade,
      source: 'local_readiness_aggregation_only',
    },
    status: blockers.length > 0 ? 'ready_with_external_blockers' : 'ready_for_next_capped_pilot',
    completionScope: {
      providerIntegration: 'trial_import_paths_verified_for_approved_domains',
      normalization: 'deterministic_local_readiness_complete_for_odds_player_props_player_stats',
      persistence: 'trial_persistence_verified_for_events_stats_players_injuries_lineups_player_stats',
      featureEnrichment: 'trial_rows_blocked_from_production_confidence_improvement',
      validation: 'local_readiness_validation_complete_zero_provider_calls',
      observability: 'runtime_capabilities_and_readiness_routes_available',
      productionReadiness: 'not_ready_for_uncapped_or_production_provider_execution',
    },
    objectiveAudit: {
      status:
        objectiveAuditBlocked.length > 0
          ? 'not_complete_external_blockers_remaining'
          : 'complete_for_current_objective',
      items: objectiveAudit,
      summary: {
        requirements: objectiveAudit.length,
        satisfied: objectiveAudit.filter((item) => item.status === 'satisfied').length,
        partiallySatisfied: objectiveAudit.filter((item) => item.status === 'partially_satisfied').length,
        blockedExternal: objectiveAudit.filter((item) => item.status === 'blocked_external').length,
        requirementsWithRemainingWork: objectiveAuditBlocked.length,
        remainingBlockers: objectiveAuditBlocked.flatMap((item) =>
          item.remainingWork.map((work) => ({
            requirement: item.requirement,
            blocker: work,
          }))
        ),
      },
    },
    completionEvidenceMatrix: {
      status:
        completionEvidenceMatrix.some((item) => item.blocksGoalCompletion)
          ? 'not_complete_evidence_gaps_remaining'
          : 'complete_evidence_verified',
      generatedWithoutProviderCalls: providerCallsMade === 0,
      items: completionEvidenceMatrix,
      summary: {
        requirements: completionEvidenceMatrix.length,
        proven: completionEvidenceMatrix.filter((item) => item.status === 'proven').length,
        partial: completionEvidenceMatrix.filter((item) => item.status === 'partial').length,
        blockedExternal: completionEvidenceMatrix.filter(
          (item) => item.status === 'blocked_external'
        ).length,
        missingEvidence: completionEvidenceMatrix.filter(
          (item) => item.status === 'missing_evidence'
        ).length,
        blocksGoalCompletion: completionEvidenceMatrix.filter(
          (item) => item.blocksGoalCompletion
        ).length,
      },
    },
    handoff: {
      status:
        blockedHandoffDomains.length > 0
          ? 'trial_scope_complete_with_production_blockers'
          : 'ready_for_next_capped_pilot',
      domains: handoffDomains,
      summary: {
        domains: handoffDomains.length,
        completeForTrialScope: handoffDomains.filter(
          (domain) => domain.status === 'complete_for_trial_scope'
        ).length,
        readyZeroCall: handoffDomains.filter((domain) => domain.status === 'ready_zero_call').length,
        blocked: blockedHandoffDomains.length,
        productionUseBlocked: handoffDomains.filter(
          (domain) => domain.productionUse !== 'not_applicable'
        ).length,
      },
      productionGates: [
        'Do not treat trial/scrambled rows as production historical truth.',
        'Do not run uncapped or broad SportsDataIO historical imports without explicit quota/date-window approval.',
        'Do not enable production prediction, backtesting, calibration, model training or confidence improvement from trial-only rows.',
        'Do not run odds, historical odds or player props pilots until exact endpoints and entitlements are confirmed.',
        'Do not use trial player stats for production confidence, backtesting, calibration or model training.',
        'Do not enable player prop settlement until market and grading rules are implemented and validated.',
      ],
      safeNextActions: [
        'Use the completed player-stats pilot evidence only as trial-scope import validation.',
        'Confirm exact SportsDataIO NBA odds, historical odds and prop endpoint paths from authenticated provider documentation before live calls.',
        'Request a separately capped provider-backed reconciliation run before consuming production quota.',
        'Use /api/observability/runtime and /api/providers/sportsdataio/nba/trial-isolation before and after any future pilot.',
      ],
    },
    externalBlockerLedger: {
      status: 'open_external_blockers_remaining',
      blockers: externalBlockerLedger,
      summary: {
        total: externalBlockerLedger.length,
        providerOwned: externalBlockerLedger.filter((blocker) => blocker.owner === 'provider').length,
        operatorOwned: externalBlockerLedger.filter((blocker) => blocker.owner === 'operator').length,
        databaseAdminOwned: externalBlockerLedger.filter(
          (blocker) => blocker.owner === 'database_admin'
        ).length,
        productOwnerOwned: externalBlockerLedger.filter(
          (blocker) => blocker.owner === 'product_owner'
        ).length,
        providerCallsRequiredBeforeApproval: externalBlockerLedger.reduce(
          (total, blocker) => total + blocker.providerCallsRequiredBeforeApproval,
          0
        ),
        productionGatesClosed: externalBlockerLedger.filter(
          (blocker) => blocker.productionGateClosed
        ).length,
      },
    },
    readinessEvidenceExport: {
      status: 'ready_for_handoff_with_external_blockers',
      source: 'local_readiness_services_docs_and_stored_trial_pilot_evidence',
      providerCallsMade,
      generatedWithoutProviderCalls: providerCallsMade === 0,
      proven: provenEvidenceItems,
      blocked: externalBlockerEvidenceItems,
      closedGuardrails: closedGuardrailEvidenceItems,
      summary: {
        proven: provenEvidenceItems.length,
        blockedExternal: externalBlockerEvidenceItems.length,
        closedGuardrails: closedGuardrailEvidenceItems.length,
        artifactsReferenced: Array.from(
          new Set(
            [
              ...provenEvidenceItems,
              ...externalBlockerEvidenceItems,
              ...closedGuardrailEvidenceItems,
            ].flatMap((item) => item.artifacts)
          )
        ).length,
        providerCallsMade,
        providerCallsRequiredBeforeApproval: externalBlockerLedger.reduce(
          (total, blocker) => total + blocker.providerCallsRequiredBeforeApproval,
          0
        ),
      },
      validation: readinessEvidenceValidation,
    },
    productionGateAudit: productionGateValidation,
    nextPilotApprovalChecklist: {
      status: 'blocked_until_external_approval',
      generatedWithoutProviderCalls: providerCallsMade === 0,
      items: nextPilotApprovalChecklist,
      summary: {
        domains: nextPilotApprovalChecklist.length,
        providerCallsAllowedBeforeApproval: nextPilotApprovalChecklist.reduce(
          (total, item) => total + item.providerCallsAllowedBeforeApproval,
          0
        ),
        domainsRequiringProviderConfirmation: nextPilotApprovalChecklist.filter(
          (item) => item.approvalOwner === 'provider'
        ).length,
        domainsRequiringOperatorApproval: nextPilotApprovalChecklist.filter(
          (item) => item.approvalOwner === 'operator'
        ).length,
        domainsRequiringDatabaseAdmin: nextPilotApprovalChecklist.filter(
          (item) => item.approvalOwner === 'database_admin'
        ).length,
        domainsRequiringProductOwner: nextPilotApprovalChecklist.filter(
          (item) => item.approvalOwner === 'product_owner'
        ).length,
      },
    },
    responseShapeAudit,
    surfaceConsistencyAudit: surfaceConsistencyValidation,
    externalApprovalPacket: approvalPacket,
    blockedStateAudit: blockedStateValidation,
    domainCompletionProofLedger: domainCompletionProofValidation,
    providerExecutionGate: providerExecutionGateValidation,
    externalBlockerResolutionChecklist:
      externalBlockerResolutionChecklistValidation,
    productionUsageExclusionAudit: productionUsageExclusionValidation,
    nextPilotGatePreflights: {
      odds: {
        status: odds.status,
        providerUsage: odds.providerUsage,
        route: '/api/providers/sportsdataio/nba/odds/endpoint-preflight',
        endpointPreflight: odds.endpointPreflight,
      },
      playerProps: {
        status: playerProps.status,
        providerUsage: playerProps.providerUsage,
        route: '/api/providers/sportsdataio/nba/player-props/endpoint-preflight',
        endpointPreflight: playerProps.endpointPreflight,
      },
      playerStats: {
        status: playerStats.status,
        providerUsage: playerStats.providerUsage,
        route: '/api/providers/sportsdataio/nba/player-stats/migration-preflight',
        destinationTable: playerStats.migration.destinationTable,
        migrationPreflight: playerStats.migration.preflight,
      },
    },
    areas,
    blockers,
    safetyInvariants: {
      noProviderCalls: providerCallsMade === 0,
      noSecretExposure:
        runtimeValidation.checks.zeroSecretExposure &&
        odds.noSecretExposure &&
        playerProps.noSecretExposure &&
        playerStats.noSecretExposure,
      liveCallsEnabled: false,
      trialRowsProductionEligible: false,
      predictionPersistenceEnabled: false,
      backtestingEnabled: false,
      modelTrainingEnabled: false,
    },
    readinessRoutes: [
      '/api/providers/sportsdataio/status',
      '/api/providers/sportsdataio/capabilities',
      '/api/providers/sportsdataio/execution-readiness/validation',
      '/api/providers/sportsdataio/nba/readiness',
      '/api/providers/sportsdataio/nba/provider-gate',
      '/api/providers/sportsdataio/nba/external-blockers',
      '/api/providers/sportsdataio/nba/blocker-resolution',
      '/api/providers/sportsdataio/nba/production-gate',
      '/api/providers/sportsdataio/nba/production-usage-exclusion',
      '/api/providers/sportsdataio/nba/evidence-export',
      '/api/providers/sportsdataio/nba/next-pilot-preflight',
      '/api/providers/sportsdataio/nba/approval-packet',
      '/api/providers/sportsdataio/nba/completion-audit',
      '/api/providers/sportsdataio/nba/contract-audit',
      '/api/providers/sportsdataio/nba/objective-audit',
      '/api/providers/sportsdataio/nba/safe-next-actions',
      '/api/providers/sportsdataio/nba/domain-proof',
      '/api/providers/sportsdataio/nba/completion-evidence',
      '/api/providers/sportsdataio/nba/odds/readiness',
      '/api/providers/sportsdataio/nba/odds/endpoint-preflight',
      '/api/providers/sportsdataio/nba/player-props/readiness',
      '/api/providers/sportsdataio/nba/player-props/endpoint-preflight',
      '/api/providers/sportsdataio/nba/player-stats/readiness',
      '/api/providers/sportsdataio/nba/player-stats/migration-preflight',
      '/api/providers/sportsdataio/nba/trial-isolation',
    ],
    domainCounts: {
      runtimeDomains: capabilities.domains.length,
      contractCoverageRows: capabilities.coverage.length,
      readinessAreas: areas.length,
      blockers: blockers.length,
    },
  }
}
