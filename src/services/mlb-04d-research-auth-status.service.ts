import 'server-only'

export const MLB_04D_D3S_R3E_CLASSIFICATION =
  'MLB_04D_D3S_R3E_PRODUCTION_AUTH_STATUS_ENDPOINT_CERTIFIED'
export const MLB_04D_D3S_R3E_PHASE =
  'MLB-04D-D3S-R3E_READ_ONLY_PRODUCTION_AUTHORIZATION_STATUS_ENDPOINT'

export const MLB_RESEARCH_AUTH_STATUS_PROVENANCE = 'DEPLOYED_SERVER_RUNTIME'
export const MLB_RESEARCH_AUTH_STATUS_ROUTE = '/api/mlb/research-auth-status'

export type MlbResearchAuthStatus = 'TRUE' | 'FALSE' | 'MISSING' | 'INVALID'

export type MlbResearchAuthStatusPayload = {
  mode: 'mlb_04d_d3s_r3e_research_auth_status_v1'
  classification: typeof MLB_04D_D3S_R3E_CLASSIFICATION
  phase: typeof MLB_04D_D3S_R3E_PHASE
  provenance: typeof MLB_RESEARCH_AUTH_STATUS_PROVENANCE
  productionCommit: string
  cronSecret: 'PRESENT' | 'MISSING'
  snapshotAuthorized: MlbResearchAuthStatus
  opportunityEvidenceCanaryAuthorized: MlbResearchAuthStatus
  opportunityEvidenceContinuousAuthorized: MlbResearchAuthStatus
  automationActivated: 'NO'
  activeCronAdded: 'NO'
  providerCallsMade: 0
  productionDatabaseMutations: 0
  writes: 0
}

export function normalizeMlbResearchAuthStatus(value: string | undefined): MlbResearchAuthStatus {
  if (value === undefined) return 'MISSING'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return 'TRUE'
  if (normalized === 'false') return 'FALSE'
  return 'INVALID'
}

export function buildMlbResearchAuthStatusPayload(
  env: Record<string, string | undefined> = process.env
): MlbResearchAuthStatusPayload {
  return {
    mode: 'mlb_04d_d3s_r3e_research_auth_status_v1',
    classification: MLB_04D_D3S_R3E_CLASSIFICATION,
    phase: MLB_04D_D3S_R3E_PHASE,
    provenance: MLB_RESEARCH_AUTH_STATUS_PROVENANCE,
    productionCommit: env.VERCEL_GIT_COMMIT_SHA ?? env.GIT_COMMIT_SHA ?? 'unknown',
    cronSecret: env.CRON_SECRET ? 'PRESENT' : 'MISSING',
    snapshotAuthorized: normalizeMlbResearchAuthStatus(env.MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED),
    opportunityEvidenceCanaryAuthorized: normalizeMlbResearchAuthStatus(
      env.MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED
    ),
    opportunityEvidenceContinuousAuthorized: normalizeMlbResearchAuthStatus(
      env.MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED
    ),
    automationActivated: 'NO',
    activeCronAdded: 'NO',
    providerCallsMade: 0,
    productionDatabaseMutations: 0,
    writes: 0,
  }
}
