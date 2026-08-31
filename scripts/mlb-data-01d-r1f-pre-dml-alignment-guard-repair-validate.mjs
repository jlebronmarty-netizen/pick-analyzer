import fs from 'node:fs'

const artifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-r1f-pre-dml-alignment-guard-repair.json', 'utf8'))
const persistence = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-01d-2025-feature-persistence.json', 'utf8'))
const script = fs.readFileSync('scripts/mlb-data-01d-2025-feature-persistence.mjs', 'utf8')
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

const target = '7d5cc1798e799b5048d5cccfd35db1822ea6ebc6'
const stale = '875b46d34553bc3618067fec202a2f780a39b2d8'
const logical = persistence.writeAccounting.logical
const snapshots = persistence.prewrite.snapshotPolicy

check('verdict', artifact.certificationVerdict === 'MLB_DATA_01D_R1F_PRE_DML_ALIGNMENT_GUARD_REPAIR_CERTIFIED')
check('baseline alignment', artifact.repositoryProductionAlignment.localHead === target && artifact.repositoryProductionAlignment.originMain === target && artifact.repositoryProductionAlignment.production === target)
check('current target', artifact.currentAlignmentContract.acceptedCommit === target)
check('no arbitrary future commits', artifact.currentAlignmentContract.acceptsArbitraryFutureCommits === 'NO')
check('historical preserved', artifact.flags.R1F_HISTORICAL_COMMIT_EVIDENCE_PRESERVED === 'YES')
check('stale classified', artifact.staleAlignmentReferences.some((entry) => entry.value === stale && entry.classification === 'STALE_RUNTIME_GUARD_REPAIRED'))
check('preflight repaired', artifact.flags.R1F_PREFLIGHT_ALIGNMENT_GUARD_REPAIRED === 'YES')
check('execute repaired', artifact.flags.R1F_EXECUTE_ALIGNMENT_GUARD_REPAIRED === 'YES')
check('parity', artifact.flags.R1F_PREFLIGHT_EXECUTE_ALIGNMENT_PARITY === 'PASS')
check('fail closed', artifact.flags.R1F_ALIGNMENT_GUARD_FAIL_CLOSED === 'PASS')
check('script current commit const', script.includes(`const r1fCertifiedProductionCommit = '${target}'`))
check('script execute parity guard', /if \(execute \|\| validateExecuteGuard\) return commit === r1fCertifiedProductionCommit/.test(script))
check('script preflight current only', /return commit === r1fCertifiedProductionCommit/.test(script))
check('script historical list', script.includes('historicalProductionCommitReferences'))
check('stale not active execute target', !/if \(execute\) return commit === targetProductionCommit/.test(script))
check('row plan team', logical.team.inserts === 4498 && logical.team.conflicts === 0)
check('row plan starter', logical.starter.inserts === 4498 && logical.starter.conflicts === 0)
check('row plan bullpen', logical.bullpen.inserts === 4498 && logical.bullpen.conflicts === 0)
check('row plan batter', logical.batter.inserts === 44943 && logical.batter.conflicts === 0)
check('row plan matchup', logical.matchup.inserts === 2249 && logical.matchup.conflicts === 0)
check('row plan first inning', logical.firstInning.inserts === 2249 && logical.firstInning.conflicts === 0)
check('snapshot reuse', snapshots.inserts === 0 && snapshots.reuses === 67433 && snapshots.conflicts === 0)
check('preflight pass', artifact.repairedPreflight.status === 'PASS')
check('execute guard dry', artifact.executePathDryValidation.status === 'PASS')
check('production unchanged', artifact.productionStateUnchanged.snapshots === 67433 && artifact.productionStateUnchanged.dailyFeatureRows === 0)
check('zero mutations', artifact.safety.productionDmlMutations === 0 && artifact.safety.productionDdlMutations === 0 && artifact.safety.providerCalls === 0)
check('no feature DML', artifact.safety.featureWrites === 0 && artifact.safety.snapshotWrites === 0 && artifact.safety.rawWrites === 0)

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1f-pre-dml-alignment-guard-repair-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01d-r1f-pre-dml-alignment-guard-repair-validate',
    status: 'PASS',
    verdict: artifact.certificationVerdict,
    acceptedCommit: artifact.currentAlignmentContract.acceptedCommit,
    preflight: artifact.repairedPreflight.status,
    executeGuardDryValidation: artifact.executePathDryValidation.status,
  }, null, 2))
}
