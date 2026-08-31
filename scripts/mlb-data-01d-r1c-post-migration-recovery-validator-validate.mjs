import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-r1c-post-migration-recovery-validator.json', 'utf8'))
const persistenceScript = fs.readFileSync('scripts/mlb-data-01d-2025-feature-persistence.mjs', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('blocked verdict', artifact.certificationVerdict === 'MLB_DATA_01D_R1C_POST_MIGRATION_RECOVERY_VALIDATOR_BLOCKED')
check('baseline alignment', artifact.alignment.R1C_BASELINE_ALIGNMENT === 'PASS')
check('inherited evidence', artifact.inheritedEvidence.R1C_INHERITED_EVIDENCE_READY === 'YES')
check('partial state readback', artifact.partialProductionState.R1C_PARTIAL_STATE_READBACK === 'PASS')
check('plan-only alignment accepts R1B', persistenceScript.includes("const r1bPostMigrationProductionCommit = '61aeb84a58d0ae71ec02bbf044f70f3c60854d33'"))
check('manifest authority active', persistenceScript.includes("activeWriteAuthority: 'DIGEST_BOUND_DEPLOYMENT_CERTIFICATION_MANIFEST'"))
check('expected manifest digest gate active', persistenceScript.includes("const expectedManifestDigestEnvName = 'PICK2_MLB_R1F_EXPECTED_MANIFEST_SHA256'"))
check('explicit dml gate active', persistenceScript.includes("ensure(explicitDmlAuthorization, 'EXPLICIT_DML_AUTHORIZATION_REQUIRED')"))
check('stale gate repaired', artifact.staleAlignmentRepair.R1C_POST_R1B_ALIGNMENT_CONTRACT_REPAIRED === 'YES')
check('historical artifacts preserved', artifact.staleAlignmentRepair.R1C_HISTORICAL_ARTIFACT_IMMUTABILITY === 'PASS')
check('dry-run block captured', artifact.recoveryDryRun.blocker === 'BLOCK_CONFLICT:SNAPSHOT_REUSE_MISMATCH:23200')
check('feature DML remains unauthorized', artifact.dmlBoundary.MLB_DATA_01D_R1C_FEATURE_DML_RESUME_AUTHORIZED === 'NO')
check('no production DML', artifact.dmlBoundary.productionDmlMutationsInR1C === 0)
check('no production DDL', artifact.dmlBoundary.productionDdlMutationsInR1C === 0)
check('snapshot state pass', artifact.snapshotState.R1C_SNAPSHOT_STATE === 'PASS')
check('as-of/leakage pass', artifact.featureContract.R1C_ASOF_CONTRACT === 'PASS' && artifact.featureContract.R1C_LEAKAGE_AUDIT === 'PASS')
check('raw/native pass', artifact.rawIdentityProductSafety.R1C_RAW_NATIVE_STATE === 'PASS')
check('model/prediction pass', artifact.rawIdentityProductSafety.R1C_MODEL_PREDICTION_BOUNDARY === 'PASS')
check('provider calls zero', artifact.rawIdentityProductSafety.providerCalls === 0)
check('no provider endpoints in R1C validator', !/statsapi\.mlb\.com|api\.sportsdata\.io|api\.the-odds-api\.com|api\.balldontlie/i.test(persistenceScript))
check('no obvious secret material', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]{20,})/.test([JSON.stringify(artifact), persistenceScript].join('\n')))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1c-post-migration-recovery-validator-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01d-r1c-post-migration-recovery-validator-validate',
    status: 'PASS',
    verdict: artifact.certificationVerdict,
    blocker: artifact.recoveryDryRun.blocker,
  }, null, 2))
}
