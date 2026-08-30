import fs from 'node:fs'

const r1e = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-r1e-daily-feature-recovery-readiness.json', 'utf8'))
const recovery = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-2025-feature-persistence.json', 'utf8'))
const r1d = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-r1d-snapshot-reuse-digest-reconciliation.json', 'utf8'))
const script = fs.readFileSync('scripts/mlb-data-01d-2025-feature-persistence.mjs', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const logical = recovery.writeAccounting.logical
const snapshots = recovery.prewrite.snapshotPolicy

check('certified verdict', r1e.certificationVerdict === 'MLB_DATA_01D_R1E_DAILY_FEATURE_RECOVERY_READINESS_CERTIFIED')
check('production alignment', r1e.publication.productionCommit === 'fcde1844e5de8fc38da18862ca675f76edee3551' && r1e.publication.productionAlignment === 'PASS')
check('provider calls zero', r1e.publication.providerCallsMade === 0 && r1e.safety.providerCalls === 0)
check('commit chain scope', r1e.commitChainScope.R1E_COMMIT_CHAIN_SCOPE_CERTIFIED === 'YES')
check('partial state snapshots', r1e.postDeployPartialState.pick2_feature_snapshots === 67433)
check('daily zero', [
  'pick2_mlb_team_daily_features',
  'pick2_mlb_pitcher_daily_features',
  'pick2_mlb_bullpen_daily_features',
  'pick2_mlb_batter_daily_features',
  'pick2_mlb_matchup_daily_features',
  'pick2_mlb_first_inning_daily_features',
].every((table) => r1e.postDeployPartialState[table] === 0))
check('raw native state', r1e.postDeployPartialState.rawRows === 712528 && r1e.postDeployPartialState.nativeGames === 2430 && r1e.postDeployPartialState.nativePlayers === 1469)
check('ordered snapshot exact matches', r1e.orderedSnapshotReadback.exactInputDigestMatches === 67433 && r1e.orderedSnapshotReadback.digestMismatches === 0)
check('r1d ordered proof', r1d.snapshotReuseDiagnostics.exactDigestMatches === 67433 && r1d.snapshotReuseDiagnostics.digestMismatches === 0)
check('snapshot reuse readiness', snapshots.inserts === 0 && snapshots.reuses === 67433 && snapshots.conflicts === 0)
check('team readiness', logical.team.inserts === 4498 && logical.team.reuses === 0 && logical.team.conflicts === 0)
check('starter readiness', logical.starter.inserts === 4498 && logical.starter.reuses === 0 && logical.starter.conflicts === 0)
check('bullpen readiness', logical.bullpen.inserts === 4498 && logical.bullpen.reuses === 0 && logical.bullpen.conflicts === 0)
check('batter readiness', logical.batter.inserts === 44943 && logical.batter.reuses === 0 && logical.batter.conflicts === 0)
check('offense readiness', logical.offense.inserts === 4498 && logical.offense.conflicts === 0)
check('matchup readiness', logical.matchup.inserts === 2249 && logical.matchup.reuses === 0 && logical.matchup.conflicts === 0)
check('first inning readiness', logical.firstInning.inserts === 2249 && logical.firstInning.reuses === 0 && logical.firstInning.conflicts === 0)
check('complete plan', r1e.flags.R1E_COMPLETE_RECOVERY_PLAN === 'PASS')
check('native key uniqueness', r1e.flags.R1E_NATIVE_KEY_UNIQUENESS === 'PASS')
check('sameday guard', r1e.flags.R1E_SAMEDAY_RECOVERY_GUARD === 'PASS')
check('asof leakage', r1e.flags.R1E_ASOF_LEAKAGE_STATE === 'PASS')
check('definitions unchanged', r1e.flags.R1E_FEATURE_DEFINITIONS_UNCHANGED === 'YES')
check('idempotency', r1e.flags.R1E_RECOVERY_IDEMPOTENCY_PROJECTED === 'PASS')
check('dml caps', r1e.flags.R1E_DML_CAPS_CERTIFIED === 'YES')
check('feature DML not authorized', r1e.flags.MLB_DATA_01D_R1E_FEATURE_DML_RESUME_AUTHORIZED === 'NO')
check('zero mutations', r1e.safety.featureDml === 0 && r1e.safety.schemaMutations === 0 && r1e.safety.snapshotWrites === 0 && r1e.safety.rawWrites === 0)
check('execute remains pinned', /if \(execute\) return commit === targetProductionCommit/.test(script))
check('r1e plan-only commit accepted', script.includes("const r1dVerificationProductionCommit = 'fcde1844e5de8fc38da18862ca675f76edee3551'"))
check('no obvious secret material', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]{20,})/.test([JSON.stringify(r1e), JSON.stringify(recovery), script].join('\n')))

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1e-daily-feature-recovery-readiness-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01d-r1e-daily-feature-recovery-readiness-validate',
    status: 'PASS',
    verdict: r1e.certificationVerdict,
    productionCommit: r1e.publication.productionCommit,
    snapshotsReuse: snapshots.reuses,
    totalBlockConflict: r1e.dailyRecoveryReadiness.totalBlockConflict,
  }, null, 2))
}
