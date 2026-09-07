import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02p-r2-official-pick-persistence-execution.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02p-r2-mlb-moneyline-official-pick-persistence-audit.md'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const audit = fs.readFileSync(auditPath, 'utf8')

assert(artifact.certificationVerdict === 'MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_CERTIFIED', 'classification mismatch')
assert(artifact.publication.state === 'PASS', 'publication failed')
assert(artifact.production.PRODUCTION_ALIGNMENT === 'PASS', 'production alignment failed')
assert(artifact.policy.version === 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1', 'policy mismatch')
assert(artifact.frozenPicks.count === 5, 'frozen pick count mismatch')
assert(artifact.baselines.officialPickBaselineMatchingFrozenIdentities <= 5, 'official pick baseline impossible')
assert(artifact.baselines.nativeValueRows === 386, 'native value baseline mismatch')
assert(artifact.frozenPicks.MLB_02P_R2_ONE_SIDE_PER_GAME === 'PASS', 'one-side-per-game failed')
assert(artifact.frozenPicks.topCandidate.game_pk === 823904, 'top candidate game mismatch')
assert(artifact.frozenPicks.topCandidate.side === 'AWAY', 'top candidate side mismatch')
assert(artifact.frozenPicks.topCandidate.book === 'betrivers', 'top candidate book mismatch')
assert(Math.abs(artifact.frozenPicks.topCandidate.consensus_edge - 0.081936) < 0.000001, 'top candidate edge mismatch')
assert(Math.abs(artifact.frozenPicks.topCandidate.unit_ev - 0.240928) < 0.000001, 'top candidate ev mismatch')
assert(artifact.linkage.MLB_02P_R2_PREDICTION_LINKAGE === 'PASS', 'prediction linkage failed')
assert(artifact.linkage.MLB_02P_R2_VALUE_LINKAGE === 'PASS', 'value linkage failed')
assert(artifact.linkage.MLB_02P_R2_GAME_IDENTITY === 'PASS', 'game identity failed')
assert(artifact.linkage.MLB_02P_R2_BOOK_IDENTITY === 'PASS', 'book identity failed')
assert(artifact.evidence.MLB_02P_R2_PICK_GATE_EVIDENCE === 'PASS', 'pick gate evidence failed')
assert(artifact.evidence.MLB_02P_R2_REASON_CODE_PARITY === 'PASS', 'reason code parity failed')
assert(artifact.evidence.MLB_02P_R2_RISK_FLAG_PARITY === 'PASS', 'risk flag parity failed')
assert(artifact.identity.officialPickIdentityCount === 5, 'identity count mismatch')
assert(artifact.identity.duplicateOfficialIdentities === 0, 'duplicate frozen identities')
assert(artifact.identity.MLB_02P_R2_PICK_DIGEST_PARITY === 'PASS', 'digest parity failed')
assert(artifact.prewrite.INSERT_ELIGIBLE + artifact.prewrite.REUSE_NO_OP === 5, 'prewrite coverage mismatch')
assert(artifact.prewrite.BLOCK_CONFLICT === 0, 'prewrite conflict')
assert(artifact.prewrite.MLB_02P_R2_PICK_DML_CAP_READY === 'YES', 'dml cap not ready')
assert(artifact.execution.attempted <= 5, 'attempted cap exceeded')
assert(artifact.execution.inserted <= 5, 'insert cap exceeded')
assert(artifact.execution.conflicts === 0, 'execution conflict')
assert(artifact.execution.failures === 0, 'execution failure')
assert(artifact.execution.updates === 0, 'updates occurred')
assert(artifact.execution.deletes === 0, 'deletes occurred')
assert(artifact.readback.finalFrozenOfficialPickCount === 5, 'final frozen official pick count mismatch')
assert(artifact.readback.MLB_02P_R2_PICK_ROW_PARITY === 'PASS', 'row parity failed')
assert(artifact.readback.MLB_02P_R2_PICK_PAYLOAD_READBACK === 'PASS', 'payload readback failed')
assert(artifact.readback.MLB_02P_R2_SOURCE_LINKAGE_READBACK === 'PASS', 'source linkage readback failed')
assert(artifact.readback.MLB_02P_R2_BOOK_PRICE_READBACK === 'PASS', 'book price readback failed')
assert(artifact.readback.MLB_02P_R2_POLICY_EVIDENCE_READBACK === 'PASS', 'policy evidence readback failed')
assert(artifact.readback.MLB_02P_R2_PICK_NO_OVERWRITE === 'PASS', 'overwrite guard failed')
assert(artifact.readback.MLB_02P_R2_PICK_IMMUTABILITY === 'PASS', 'immutability failed')
assert(artifact.readback.secondPass.INSERT_ELIGIBLE === 0, 'second pass inserts remain')
assert(artifact.readback.secondPass.REUSE_NO_OP === 5, 'second pass reuse mismatch')
assert(artifact.readback.secondPass.BLOCK_CONFLICT === 0, 'second pass conflict')
assert(artifact.evidence.MLB_02P_R2_PICK_SEMANTICS === 'PASS', 'semantics failed')
assert(artifact.evidence.MLB_02P_R2_MODEL_LIMITATION === 'PASS', 'model limitation failed')
assert(artifact.evidence.MLB_02P_R2_HISTORICAL_LIMITATION === 'PASS', 'historical limitation failed')
assert(artifact.valueBoard.publication === 'NO', 'value board was published')
assert(artifact.valueBoard.MLB_02P_R2_VALUE_BOARD_DATA_READY === 'YES', 'value board data not ready')
assert(artifact.boundaries.providerCalls === 0, 'provider calls occurred')
assert(artifact.boundaries.marketWrites === 0, 'market writes occurred')
assert(artifact.boundaries.valueWrites === 0, 'value writes occurred')
assert(artifact.boundaries.predictionWrites === 0, 'prediction writes occurred')
assert(artifact.boundaries.predictionResultWrites === 0, 'prediction result writes occurred')
assert(artifact.boundaries.MLB_02P_R2_FOUNDATION_PRESERVED === 'PASS', 'foundation not preserved')
assert(artifact.boundaries.MLB_02P_R2_PRODUCTION_DML_BOUNDARY === 'PASS', 'dml boundary failed')
assert(artifact.boundaries.productionDdl === 0, 'ddl occurred')
assert(artifact.boundaries.automation === 'OFF', 'automation changed')
assert(artifact.readiness.MLB_DATA_02Q_VALUE_BOARD_PREP_READY === 'YES', 'value board prep not ready')
assert(artifact.readiness.MLB_DATA_02P_R3_OFFICIAL_PICK_REFRESH_CONTRACT_PREP_READY === 'YES', 'r3 prep readiness missing')
assert(artifact.humanReadableAudit.MLB_02P_R2_HUMAN_READABLE_AUDIT === 'READY', 'human audit not ready')
assert(audit.includes('OFFICIAL PICK = PASSED POLICY V1'), 'audit missing semantic warning')
assert(audit.includes('NOT A GUARANTEE'), 'audit missing guarantee warning')
assert(!/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._-]{20,})/.test(JSON.stringify(artifact) + audit), 'possible secret exposed')

console.log(JSON.stringify({
  validator: 'mlb-data-02p-r2-official-pick-persistence-execution-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  inserted: artifact.execution.inserted,
  reused: artifact.execution.reused,
  finalOfficialPickCount: artifact.readback.finalOfficialPickCount,
}, null, 2))
