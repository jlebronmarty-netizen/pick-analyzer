import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-r1d-snapshot-reuse-digest-reconciliation.json', 'utf8'))
const persistenceScript = fs.readFileSync('scripts/mlb-data-01d-2025-feature-persistence.mjs', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const diagnostics = artifact.snapshotReuseDiagnostics
const flags = artifact.flags

check('certified verdict', artifact.certificationVerdict === 'MLB_DATA_01D_R1D_SNAPSHOT_REUSE_DIGEST_RECONCILIATION_CERTIFIED')
check('prior blocker recorded', artifact.blockerReconciliation.priorR1cBlocker === 'BLOCK_CONFLICT:SNAPSHOT_REUSE_MISMATCH:23200')
check('root cause recorded', artifact.blockerReconciliation.observedCause === 'UNORDERED_POSTGREST_RANGE_PAGINATION_FALSE_MISMATCH')
check('ordered readback exact matches', artifact.blockerReconciliation.freshOrderedReadback.exactDigestMatches === 67433)
check('ordered readback zero mismatches', artifact.blockerReconciliation.freshOrderedReadback.digestMismatches === 0)
check('ordered readback zero missing', artifact.blockerReconciliation.freshOrderedReadback.missingSnapshots === 0)
check('ordered readback zero duplicate identities', artifact.blockerReconciliation.freshOrderedReadback.duplicateDeterministicIdentities === 0)
check('existing snapshot count', diagnostics.totalExistingSnapshots === 67433)
check('planned snapshot count', diagnostics.totalPlannedSnapshots === 67433)
check('fresh exact digest matches', diagnostics.exactDigestMatches === 67433)
check('fresh digest mismatches zero', diagnostics.digestMismatches === 0)
check('missing snapshots zero', diagnostics.missingSnapshots === 0)
check('unexpected snapshots zero', diagnostics.unexpectedExtraSnapshots === 0)
check('conflicts zero', diagnostics.conflictCountFromRecovery === 0)
check('pagination is ordered', /\.order\('id', \{ ascending: true \}\)\.range\(from, to\)/.test(persistenceScript))
check('plan-only alignment repair preserved', persistenceScript.includes("const r1bPostMigrationProductionCommit = '61aeb84a58d0ae71ec02bbf044f70f3c60854d33'"))
check('manifest authority active', persistenceScript.includes("activeWriteAuthority: 'DIGEST_BOUND_DEPLOYMENT_CERTIFICATION_MANIFEST'"))
check('expected manifest digest gate active', persistenceScript.includes("const expectedManifestDigestEnvName = 'PICK2_MLB_R1F_EXPECTED_MANIFEST_SHA256'"))
check('explicit dml gate active', persistenceScript.includes("ensure(explicitDmlAuthorization, 'EXPLICIT_DML_AUTHORIZATION_REQUIRED')"))
check('stored digest contract', flags.R1D_STORED_DIGEST_CONTRACT_IDENTIFIED === 'YES')
check('current digest contract', flags.R1D_CURRENT_DIGEST_CONTRACT_IDENTIFIED === 'YES')
check('contract diff complete', flags.R1D_DIGEST_CONTRACT_DIFF_COMPLETE === 'YES')
check('sample comparison pass', flags.R1D_SAMPLE_FEATURE_OUTPUT_COMPARISON === 'PASS')
check('canonical digest ready', flags.R1D_CANONICAL_DIGEST_CONTRACT_READY === 'YES')
check('canonical reconciliation ready', flags.R1D_CANONICAL_DIGEST_RECONCILIATION_READY === 'YES')
check('output equivalence ready', flags.R1D_OUTPUT_EQUIVALENCE_CLASSIFICATION_READY === 'YES')
check('feature drift no', flags.R1D_FEATURE_DEFINITION_DRIFT_STATE === 'NO')
check('as-of leakage pass', flags.R1D_MISMATCH_ASOF_LEAKAGE_STATE === 'PASS')
check('reuse classification ready', flags.R1D_SNAPSHOT_REUSE_CLASSIFICATION_READY === 'YES')
check('digest guard preserved', flags.R1D_DIGEST_GUARD_PRESERVED === 'YES')
check('future idempotency ready', flags.R1D_FUTURE_IDEMPOTENCY_CONTRACT_READY === 'YES')
check('snapshots untouched', flags.R1D_PRODUCTION_SNAPSHOTS_UNTOUCHED === 'YES')
check('daily untouched', flags.R1D_DAILY_FEATURE_STATE_UNTOUCHED === 'YES')
check('raw native pass', flags.R1D_RAW_NATIVE_STATE === 'PASS')
check('feature DML not authorized', flags.MLB_DATA_01D_R1D_FEATURE_DML_RESUME_AUTHORIZED === 'NO')
check('zero DML', artifact.safety.productionDmlMutations === 0)
check('zero DDL', artifact.safety.productionDdlMutations === 0)
check('zero provider calls', artifact.safety.providerCalls === 0)
check('no provider endpoints added', !/statsapi\.mlb\.com|api\.sportsdata\.io|api\.the-odds-api\.com|api\.balldontlie/i.test(persistenceScript))
check('no obvious secret material', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]{20,})/.test([JSON.stringify(artifact), persistenceScript].join('\n')))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1d-snapshot-reuse-digest-reconciliation-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01d-r1d-snapshot-reuse-digest-reconciliation-validate',
    status: 'PASS',
    verdict: artifact.certificationVerdict,
    exactDigestMatches: diagnostics.exactDigestMatches,
    digestMismatches: diagnostics.digestMismatches,
    rootCause: artifact.blockerReconciliation.observedCause,
  }, null, 2))
}
