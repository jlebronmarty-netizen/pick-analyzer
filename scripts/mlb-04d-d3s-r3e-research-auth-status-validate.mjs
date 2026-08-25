import fs from 'node:fs'

const SERVICE_PATH = 'src/services/mlb-04d-research-auth-status.service.ts'
const ROUTE_PATH = 'src/app/api/mlb/research-auth-status/route.ts'

const {
  MLB_04D_D3S_R3E_CLASSIFICATION,
  MLB_RESEARCH_AUTH_STATUS_PROVENANCE,
  MLB_RESEARCH_AUTH_STATUS_ROUTE,
  buildMlbResearchAuthStatusPayload,
  normalizeMlbResearchAuthStatus,
} = await import('../src/services/mlb-04d-research-auth-status.service.ts')

const service = fs.readFileSync(SERVICE_PATH, 'utf8')
const route = fs.readFileSync(ROUTE_PATH, 'utf8')
const combined = `${service}\n${route}`

const checks = []
function check(name, passed, detail = null) {
  checks.push({ name, passed: Boolean(passed), detail })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
}

const canaryTrueContinuousFalse = buildMlbResearchAuthStatusPayload({
  CRON_SECRET: 'placeholder',
  VERCEL_GIT_COMMIT_SHA: 'fixture-commit',
  MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED: 'true',
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED: 'true',
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED: 'false',
})
const canaryFalseContinuousFalse = buildMlbResearchAuthStatusPayload({
  CRON_SECRET: 'placeholder',
  MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED: 'true',
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED: 'false',
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED: 'false',
})
const missing = buildMlbResearchAuthStatusPayload({})
const invalid = buildMlbResearchAuthStatusPayload({
  CRON_SECRET: 'placeholder',
  MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED: 'enabled',
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED: 'yes',
  MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED: '0',
})

check('classification', MLB_04D_D3S_R3E_CLASSIFICATION === 'MLB_04D_D3S_R3E_PRODUCTION_AUTH_STATUS_ENDPOINT_CERTIFIED')
check('route path', MLB_RESEARCH_AUTH_STATUS_ROUTE === '/api/mlb/research-auth-status' && route.includes('research authorization status'))
check('protected access', route.includes('process.env.CRON_SECRET') && route.includes("code: 'UNAUTHORIZED'") && route.includes('status: 401'))
check('runtime process.env provenance', service.includes('process.env') && service.includes('DEPLOYED_SERVER_RUNTIME') && MLB_RESEARCH_AUTH_STATUS_PROVENANCE === 'DEPLOYED_SERVER_RUNTIME')
check('status normalization true false missing invalid',
  normalizeMlbResearchAuthStatus('TRUE') === 'TRUE' &&
  normalizeMlbResearchAuthStatus(' false ') === 'FALSE' &&
  normalizeMlbResearchAuthStatus(undefined) === 'MISSING' &&
  normalizeMlbResearchAuthStatus('yes') === 'INVALID')
check('canary true continuous false fixture',
  canaryTrueContinuousFalse.snapshotAuthorized === 'TRUE' &&
  canaryTrueContinuousFalse.opportunityEvidenceCanaryAuthorized === 'TRUE' &&
  canaryTrueContinuousFalse.opportunityEvidenceContinuousAuthorized === 'FALSE')
check('canary false continuous false fixture',
  canaryFalseContinuousFalse.opportunityEvidenceCanaryAuthorized === 'FALSE' &&
  canaryFalseContinuousFalse.opportunityEvidenceContinuousAuthorized === 'FALSE')
check('missing fixture',
  missing.cronSecret === 'MISSING' &&
  missing.snapshotAuthorized === 'MISSING' &&
  missing.opportunityEvidenceCanaryAuthorized === 'MISSING' &&
  missing.opportunityEvidenceContinuousAuthorized === 'MISSING')
check('invalid fixture',
  invalid.snapshotAuthorized === 'INVALID' &&
  invalid.opportunityEvidenceCanaryAuthorized === 'INVALID' &&
  invalid.opportunityEvidenceContinuousAuthorized === 'INVALID')
check('safe response fields only',
  combined.includes('cronSecret') &&
  combined.includes('snapshotAuthorized') &&
  combined.includes('opportunityEvidenceCanaryAuthorized') &&
  combined.includes('opportunityEvidenceContinuousAuthorized') &&
  !combined.includes('rawEnv') &&
  !combined.includes('secretValue'))
check('canary and continuous separation',
  service.includes('MLB_FORWARD_OPPORTUNITY_EVIDENCE_CANARY_AUTHORIZED') &&
  service.includes('MLB_FORWARD_OPPORTUNITY_EVIDENCE_CONTINUOUS_AUTHORIZED') &&
  !service.includes('MLB_FORWARD_OPPORTUNITY_EVIDENCE_AUTHORIZED'))
check('snapshot guard visibility',
  service.includes('MLB_04B_CONTEXT_SNAPSHOT_AUTHORIZED') &&
  canaryTrueContinuousFalse.snapshotAuthorized === 'TRUE')
check('no provider calls',
  canaryTrueContinuousFalse.providerCallsMade === 0 &&
  !/fetch\s*\(|theOddsApi|SportsDataIO|mlbOfficial/i.test(combined))
check('no DB mutations',
  canaryTrueContinuousFalse.productionDatabaseMutations === 0 &&
  canaryTrueContinuousFalse.writes === 0 &&
  !/supabaseAdmin|\.from\s*\(|insert\s*\(|upsert\s*\(|update\s*\(|delete\s*\(/.test(combined))
check('no persistence path invocation',
  !combined.includes('persistSingleMlbForwardOpportunityEvidenceCanary') &&
  !combined.includes('writeSnapshotsAndPredictions') &&
  !combined.includes('executeMlb04bOneSnapshotPersistence') &&
  !combined.includes('ledger persistence'))
check('automation off', canaryTrueContinuousFalse.automationActivated === 'NO' && canaryTrueContinuousFalse.activeCronAdded === 'NO')
check('SportsDataIO exclusion', !/sportsdataio/i.test(combined))
check('NFL isolation', !/nfl/i.test(combined))
check('NBA isolation', !/nba/i.test(combined))
check('no secret leakage', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=)/.test(combined))

const failed = checks.filter((row) => !row.passed)
console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'mlb_04d_d3s_r3e_research_auth_status_validate',
  classification: MLB_04D_D3S_R3E_CLASSIFICATION,
  route: MLB_RESEARCH_AUTH_STATUS_ROUTE,
  checks: checks.length,
  failedChecks: failed.map((row) => row.name),
  fixtures: {
    canaryTrueContinuousFalse,
    canaryFalseContinuousFalse,
    missing,
    invalid,
  },
  providerCallsMade: 0,
  productionDatabaseMutations: 0,
}, null, 2))

if (failed.length) process.exit(1)
