import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02p-r1-official-pick-execution-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02p-r1-mlb-moneyline-official-pick-execution-prep-audit.md'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const audit = fs.readFileSync(auditPath, 'utf8')

assert(['MLB_DATA_02P_R1_OFFICIAL_PICK_EXECUTION_PREP_CERTIFIED', 'MLB_DATA_02P_R1_OFFICIAL_PICK_EXECUTION_PREP_BLOCKED'].includes(artifact.certificationVerdict), 'classification mismatch')
assert(artifact.repository.MLB_02P_R1_PREPUBLISH_STATE === 'PASS', 'prepublish failed')
assert(artifact.repository.MLB_02P_R1_02P_COMMIT_SCOPE_CERTIFIED === 'YES', 'commit scope failed')
assert(artifact.production.PRODUCTION_ALIGNMENT === 'PASS', 'production alignment failed')
assert(artifact.policy.MLB_02P_R1_POLICY_ARTIFACT === 'PASS', 'policy artifact failed')
assert(artifact.policy.MLB_02P_R1_POLICY_THRESHOLD_PARITY === 'PASS', 'threshold parity failed')
assert(artifact.policy.MLB_02P_R1_HARD_BLOCKER_PARITY === 'PASS', 'hard blocker parity failed')
assert(artifact.policy.MLB_02P_R1_SOFT_FLAG_PARITY === 'PASS', 'soft flag parity failed')
assert(artifact.baselines.MLB_02P_R1_CHAMPION_BASELINE === 'PASS', 'champion baseline failed')
assert(artifact.baselines.MLB_02P_R1_VALUE_BASELINE === 'PASS', 'value baseline failed')
assert(artifact.baselines.MLB_02P_R1_OFFICIAL_PICK_ZERO_BASELINE === 'PASS', 'official zero baseline failed')
assert(artifact.baselines.currentPipelineOfficialPickRows === 0, 'current pipeline official pick baseline failed')
assert(artifact.currentDryRun.MLB_02P_R1_CURRENT_DRY_CLASSIFICATION_PARITY === 'PASS', 'dry classification parity failed')
assert(artifact.currentDryRun.MLB_02P_R1_ONE_SIDE_PER_GAME === 'PASS', 'one-side-per-game failed')
assert(artifact.currentDryRun.MLB_02P_R1_BEST_BOOK_COLLAPSE === 'PASS', 'best book collapse failed')
assert(artifact.eligibleSet.MLB_02P_R1_EXACT_ELIGIBLE_SET === 'PASS', 'eligible set failed')
assert(artifact.eligibleSet.MLB_02P_R1_ELIGIBLE_PICK_COUNT === 5, 'eligible count mismatch')
assert(artifact.eligibleSet.MLB_02P_R1_TOP_CANDIDATE_PARITY === 'PASS', 'top candidate parity failed')
assert(artifact.schema.MLB_02P_R1_OFFICIAL_PICK_SCHEMA_INVENTORY === 'COMPLETE', 'schema inventory incomplete')
assert(['PASS', 'BLOCKED'].includes(artifact.schema.MLB_02P_R1_OFFICIAL_PICK_SCHEMA_FIT), 'schema fit invalid')
assert(artifact.identity.MLB_02P_R1_OFFICIAL_PICK_IDENTITY === 'PASS', 'identity failed')
assert(artifact.identity.MLB_02P_R1_OFFICIAL_PICK_IDENTITY_UNIQUENESS === 'PASS', 'identity uniqueness failed')
assert(artifact.payload.MLB_02P_R1_OFFICIAL_PICK_PAYLOAD === 'READY', 'payload not ready')
assert(artifact.payload.MLB_02P_R1_OFFICIAL_PICK_STATUS_CONTRACT === 'PASS', 'status contract failed')
assert(artifact.linkages.MLB_02P_R1_PREDICTION_LINKAGE === 'PASS', 'prediction linkage failed')
assert(artifact.linkages.MLB_02P_R1_VALUE_LINKAGE === 'PASS', 'value linkage failed')
assert(artifact.linkages.MLB_02P_R1_GAME_IDENTITY === 'PASS', 'game identity failed')
assert(artifact.evidence.MLB_02P_R1_PICK_GATE_EVIDENCE === 'PASS', 'gate evidence failed')
assert(artifact.evidence.MLB_02P_R1_REASON_CODE_BUILD === 'PASS', 'reason code failed')
assert(artifact.evidence.MLB_02P_R1_RISK_FLAG_BUILD === 'PASS', 'risk flag failed')
assert(artifact.evidence.MLB_02P_R1_MODEL_LIMITATION === 'PASS', 'model limitation failed')
assert(artifact.evidence.MLB_02P_R1_HISTORICAL_LIMITATION === 'PASS', 'historical limitation failed')
assert(artifact.evidence.MLB_02P_R1_OFFICIAL_PICK_SEMANTICS === 'PASS', 'semantics failed')
assert(['PASS', 'NOT_RUN_SCHEMA_FIT_BLOCKED'].includes(artifact.prewrite.status), 'prewrite status invalid')
assert(['PASS', 'BLOCKED_SCHEMA_FIT'].includes(artifact.idempotency.MLB_02P_R1_OFFICIAL_PICK_IDEMPOTENCY_PROJECTED), 'idempotency invalid')
assert(artifact.immutability.MLB_02P_R1_OFFICIAL_PICK_IMMUTABILITY === 'PASS', 'immutability failed')
assert(artifact.immutability.MLB_02P_R1_FUTURE_REFRESH_CONTRACT === 'READY', 'future refresh contract failed')
assert(artifact.valueBoard.MLB_02P_R1_VALUE_BOARD_HANDOFF === 'READY', 'value board handoff failed')
assert(artifact.valueBoard.MLB_02P_R1_VALUE_BOARD_DRY_SUMMARY === 'READY', 'value board dry summary failed')
assert(artifact.boundaries.MLB_02P_R1_OFFICIAL_PICK_DML === 0, 'official pick dml occurred')
assert(artifact.boundaries.MLB_02P_R1_OTHER_PRODUCTION_DML === 0, 'other dml occurred')
assert(artifact.boundaries.MLB_02P_R1_PRODUCTION_DDL === 0, 'ddl occurred')
assert(artifact.boundaries.MLB_02P_R1_PROVIDER_CALLS === 0, 'provider calls occurred')
assert(artifact.boundaries.MLB_02P_R1_AUTOMATION_STATE === 'OFF', 'automation changed')
assert(audit.includes('EXECUTION PREP ONLY. NO OFFICIAL PICKS WRITTEN.'), 'audit missing execution-prep warning')

const secretPattern = new RegExp([
  'eyJ' + '[A-Za-z0-9_-]{20,}',
  'sk-' + '[A-Za-z0-9_-]{16,}',
  'pat_' + '[A-Za-z0-9_]{16,}',
  'THE_ODDS_API' + '_KEY=',
].join('|'))
assert(!secretPattern.test(JSON.stringify(artifact) + audit), 'possible secret found')

console.log(JSON.stringify({
  validator: 'mlb-data-02p-r1-official-pick-execution-prep-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  schemaFit: artifact.schema.MLB_02P_R1_OFFICIAL_PICK_SCHEMA_FIT,
  eligibleCount: artifact.eligibleSet.count,
  officialPickWrites: artifact.boundaries.officialPickWrites,
  readiness: artifact.readiness.MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_READY,
}, null, 2))
