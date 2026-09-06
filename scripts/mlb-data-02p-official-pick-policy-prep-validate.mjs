import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02p-mlb-moneyline-official-pick-policy-audit.md'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const audit = fs.readFileSync(auditPath, 'utf8')

assert(artifact.certificationVerdict === 'MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_CERTIFIED', 'classification mismatch')
assert(artifact.repository.MLB_02P_PREPUBLISH_STATE === 'PASS', 'prepublish state failed')
assert(artifact.repository.MLB_02P_R3_COMMIT_SCOPE_CERTIFIED === 'YES', 'r3 scope failed')
assert(artifact.production.PRODUCTION_ALIGNMENT === 'PASS', 'production alignment failed')
assert(artifact.production.providerCallsMade === 0, 'provider calls changed')
assert(artifact.officialPickBaseline.MLB_02P_OFFICIAL_PICK_ZERO_BASELINE === 'PASS', 'official pick baseline failed')
assert(artifact.valueBaseline.rows === 386, 'native value row count mismatch')
assert(artifact.valueBaseline.MLB_02P_NATIVE_VALUE_BASELINE === 'PASS', 'native value baseline failed')
assert(artifact.valueBaseline.MLB_02P_TWO_SIDED_MARKET_GATE === 'PASS', 'two-sided market gate failed')
assert(artifact.gates.MLB_02P_TEMPORAL_GATE === 'PASS', 'temporal gate failed')
assert(artifact.gates.MLB_02P_FRESHNESS_GATE === 'READY', 'freshness policy not ready')
assert(artifact.gates.MLB_02P_BOOK_COVERAGE_POLICY === 'READY', 'book coverage policy not ready')
assert(artifact.gates.MLB_02P_MARKET_DISPERSION_GATE === 'READY', 'dispersion policy not ready')
assert(artifact.gates.MLB_02P_STARTER_STATUS_POLICY === 'READY', 'starter policy not ready')
assert(artifact.gates.MLB_02P_FEATURE_COMPLETENESS_GATE === 'PASS', 'feature completeness failed')
assert(artifact.gates.MLB_02P_CONSENSUS_EDGE_AUDIT === 'PASS', 'consensus edge audit failed')
assert(artifact.gates.MLB_02P_BEST_PRICE_EV_AUDIT === 'PASS', 'best-price EV audit failed')
assert(artifact.gates.MLB_02P_SAME_BOOK_EDGE_SUPPORT === 'PASS', 'same-book support failed')
assert(artifact.gates.MLB_02P_THRESHOLD_DESIGN_POLICY === 'PASS', 'threshold design failed')
assert(artifact.gates.MLB_02P_THRESHOLD_GRID_AUDIT === 'PASS', 'threshold grid failed')
assert(artifact.gates.MLB_02P_SELECTIVITY_AUDIT === 'PASS', 'selectivity audit failed')
assert(artifact.gates.MLB_02P_ONE_SIDE_PER_GAME === 'PASS', 'one-side-per-game failed')
assert(artifact.gates.MLB_02P_BEST_BOOK_POLICY === 'PASS', 'best-book policy failed')
assert(artifact.gates.MLB_02P_VALUE_SIGNAL_CONFLICT_POLICY === 'READY', 'conflict policy not ready')
assert(artifact.model.MLB_02P_MODEL_LIMITATION_POLICY === 'PASS', 'model limitation policy failed')
assert(artifact.gates.MLB_02P_NO_PROFITABILITY_CLAIM === 'PASS', 'profitability claim guard failed')
assert(artifact.gates.MLB_02P_PICK_STATUS_MODEL === 'READY', 'status model not ready')
assert(artifact.gates.MLB_02P_HARD_BLOCKER_CONTRACT === 'PASS', 'hard blocker contract failed')
assert(artifact.gates.MLB_02P_SOFT_RISK_FLAG_CONTRACT === 'READY', 'soft risk flags not ready')
assert(artifact.gates.MLB_02P_OFFICIAL_PICK_GATE_CONTRACT === 'READY', 'gate contract not ready')
assert(artifact.gates.MLB_02P_ZERO_PICK_POLICY === 'PASS', 'zero-pick policy failed')
assert(artifact.gates.MLB_02P_NO_FIXED_PICK_COUNT === 'PASS', 'fixed pick count guard failed')
assert(artifact.gates.MLB_02P_CURRENT_POLICY_DRY_RUN === 'PASS', 'dry run failed')
assert(artifact.gates.MLB_02P_GAME_SIDE_COLLAPSE === 'PASS', 'game-side collapse failed')
assert(artifact.policy.MLB_02P_POLICY_VERSION === 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1', 'policy version mismatch')
assert(artifact.gates.MLB_02P_POLICY_CONFIG_READY === 'YES', 'policy config not ready')
assert(artifact.gates.MLB_02P_OFFICIAL_PICK_IDENTITY_CONTRACT === 'READY', 'identity contract not ready')
assert(artifact.gates.MLB_02P_OFFICIAL_PICK_IMMUTABILITY === 'PASS', 'immutability contract failed')
assert(artifact.gates.MLB_02P_OFFICIAL_PICK_PAYLOAD_CONTRACT === 'READY', 'payload contract not ready')
assert(artifact.gates.MLB_02P_PICK_REASON_CONTRACT === 'READY', 'reason contract not ready')
assert(artifact.gates.MLB_02P_PICK_BLOCKER_EXPLANATION_CONTRACT === 'READY', 'blocker contract not ready')
assert(artifact.gates.MLB_02P_VALUE_BOARD_STATUS_CONTRACT === 'READY', 'value board status not ready')
assert(artifact.boundaries.MLB_02P_PRODUCTION_DML === 0, 'production dml changed')
assert(artifact.boundaries.MLB_02P_PRODUCTION_DDL === 0, 'production ddl changed')
assert(artifact.boundaries.MLB_02P_PROVIDER_CALLS === 0, 'provider calls nonzero')
assert(artifact.boundaries.MLB_02P_AUTOMATION_STATE === 'OFF', 'automation changed')
assert(artifact.readiness.MLB_DATA_02P_R1_OFFICIAL_PICK_EXECUTION_PREP_READY === 'YES', 'execution prep not ready')
assert(artifact.readiness.MLB_DATA_02Q_VALUE_BOARD_PREP_READY === 'YES', 'value board prep not ready')
assert(artifact.currentDryRun.counts.OFFICIAL_PICK_ELIGIBLE_DRY_RUN >= 0, 'dry eligible count missing')
assert(artifact.currentDryRun.topCandidates.length === 42, 'collapsed candidate count mismatch')
assert(audit.includes('DRY RUN ONLY. NO OFFICIAL PICKS CREATED.'), 'audit missing dry-run warning')
const secretPattern = new RegExp([
  'eyJ' + '[A-Za-z0-9_-]{20,}',
  'sk-' + '[A-Za-z0-9_-]{16,}',
  'pat_' + '[A-Za-z0-9_]{16,}',
  'THE_ODDS_API' + '_KEY=',
].join('|'))
assert(!secretPattern.test(JSON.stringify(artifact) + audit), 'possible secret found')

console.log(JSON.stringify({
  validator: 'mlb-data-02p-official-pick-policy-prep-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  policyVersion: artifact.policy.MLB_02P_POLICY_VERSION,
  counts: artifact.currentDryRun.counts,
  topCandidateStatus: artifact.currentDryRun.topCandidates[0]?.status,
  officialPickWrites: artifact.boundaries.officialPickWrites,
}, null, 2))
