import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02q-r3-value-board-activation-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02q-r3-value-board-activation-prep-audit.md'
const targetCommit = '01fc87a257b0b3386ddb09e41ba37029d83c4a05'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const audit = fs.readFileSync(auditPath, 'utf8')

assert(artifact.certificationVerdict === 'MLB_DATA_02Q_R3_VALUE_BOARD_ACTIVATION_PREP_CERTIFIED', 'classification mismatch')
assert(artifact.repository.branch === 'main', 'branch mismatch')
assert(artifact.repository.localHead === targetCommit, 'local head mismatch')
assert(artifact.repository.originMain === targetCommit, 'origin main mismatch')
assert(artifact.repository.MLB_02Q_R3_PREPUBLISH_STATE === 'PASS', 'prepublish failed')
assert(artifact.repository.MLB_02Q_R3_R2_COMMIT_SCOPE_CERTIFIED === 'YES', 'r2 scope not certified')
assert(artifact.publication.state === 'PASS', 'publication failed')
assert(artifact.production.commit === targetCommit, 'production commit mismatch')
assert(artifact.production.alignment === 'PASS', 'production alignment failed')
assert(artifact.baseline.MLB_02Q_R3_PRODUCTION_GATE_BASELINE === 'OFF', 'production gate not off')
assert(artifact.baseline.MLB_02Q_R3_GATE_OFF_ROUTE_BASELINE === 'PASS', 'gate off route failed')
assert(artifact.baseline.MLB_02Q_R3_GATE_OFF_NAV_BASELINE === 'PASS', 'gate off nav failed')
assert(artifact.baseline.publicBoardExposure === 'NO', 'public board exposure detected')
assert(artifact.activationContract.MLB_02Q_R3_ACTIVATION_ENV_CONTRACT === 'READY', 'activation env contract not ready')
assert(artifact.activationContract.enabledValue === 'true', 'enabled value mismatch')
assert(artifact.activationContract.MLB_02Q_R3_RUNTIME_REFRESH_CONTRACT === 'READY', 'runtime refresh contract not ready')
assert(artifact.activationContract.MLB_02Q_R3_GATE_FAIL_CLOSED_SEMANTICS === 'PASS', 'fail-closed semantics failed')
assert(artifact.controlledGateOn.MLB_02Q_R3_CONTROLLED_GATE_ON === 'PASS', 'controlled gate on failed')
assert(artifact.controlledGateOn.MLB_02Q_R3_GATE_ON_ROUTE_RENDER === 'PASS', 'gate on route render failed')
assert(artifact.controlledGateOn.MLB_02Q_R3_GATE_ON_BOARD_PARITY === 'PASS', 'gate on board parity failed')
assert(artifact.controlledGateOn.MLB_02Q_R3_GATE_ON_TOP_PICK_PARITY === 'PASS', 'gate on top pick parity failed')
assert(artifact.controlledGateOn.MLB_02Q_R3_ACTIVATED_UX_BASELINE === 'PASS', 'activated ux failed')
assert(artifact.controlledGateOn.MLB_02Q_R3_OFFICIAL_PICK_RENDER_PARITY === 'PASS', 'official render parity failed')
assert(artifact.controlledGateOn.MLB_02Q_R3_NON_OFFICIAL_STATUS_RENDER === 'PASS', 'non official render failed')
assert(artifact.controlledGateOn.MLB_02Q_R3_ZERO_BLOCKED_RENDER === 'PASS', 'zero blocked render failed')
assert(artifact.board.officialPickCount === 5, 'official count mismatch')
assert(artifact.board.valueCandidateCount === 14, 'value candidate count mismatch')
assert(artifact.board.watchlistCount === 23, 'watchlist count mismatch')
assert(artifact.board.blockedCount === 0, 'blocked count mismatch')
assert(artifact.board.totalBoardRows === 42, 'total board count mismatch')
assert(artifact.board.topPick.game_pk === 823904, 'top pick game mismatch')
assert(artifact.board.topPick.side === 'AWAY', 'top pick side mismatch')
assert(artifact.board.topPick.best_book === 'betrivers', 'top pick book mismatch')
assert(Math.abs(artifact.board.topPick.consensus_edge - 0.081935617141676) < 0.000001, 'top pick edge mismatch')
assert(Math.abs(artifact.board.topPick.unit_ev - 0.2409281394125) < 0.000001, 'top pick ev mismatch')
assert(artifact.navigationPlan.MLB_02Q_R3_NAV_ACTIVATION_POLICY === 'READY', 'nav activation policy not ready')
assert(artifact.navigationPlan.MLB_02Q_R3_MINIMAL_ACTIVATION_SCOPE === 'READY', 'minimal activation scope not ready')
assert(artifact.dataContract.MLB_02Q_R3_ACTIVATION_PROVIDER_INDEPENDENCE === 'PASS', 'provider independence failed')
assert(artifact.dataContract.MLB_02Q_R3_ACTIVATION_READ_ONLY_DATA_CONTRACT === 'PASS', 'read only data contract failed')
assert(artifact.security.MLB_02Q_R3_GATE_ON_SECRET_SAFETY === 'PASS', 'secret safety failed')
assert(artifact.security.MLB_02Q_R3_GATE_ON_WRITE_SURFACE === 'NONE', 'write surface exposed')
assert(artifact.activationContract.MLB_02Q_R3_ACTIVATION_ROLLBACK === 'READY', 'rollback not ready')
assert(artifact.rollback.MLB_02Q_R3_GATE_OFF_REVERSION_TEST === 'PASS', 'reversion failed')
assert(artifact.readbackContract.MLB_02Q_R3_ACTIVATION_READBACK_CONTRACT === 'READY', 'readback contract not ready')
assert(artifact.boundaries.MLB_02Q_R3_PRODUCTION_DML === 0, 'production dml occurred')
assert(artifact.boundaries.MLB_02Q_R3_PRODUCTION_DDL === 0, 'production ddl occurred')
assert(artifact.boundaries.MLB_02Q_R3_PROVIDER_CALLS === 0, 'provider calls occurred')
assert(artifact.boundaries.MLB_02Q_R3_PRODUCTION_ENV_MUTATIONS === 0, 'production env mutated')
assert(artifact.boundaries.MLB_02Q_R3_AUTOMATION_STATE === 'OFF', 'automation changed')
assert(artifact.boundaries.cronChanges === 0, 'cron changed')
assert(artifact.readiness.MLB_DATA_02Q_R4_VALUE_BOARD_ACTIVATION_EXECUTION_READY === 'YES', 'r4 activation execution not ready')
assert(artifact.readiness.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY === 'NO', 'publication readiness changed')
assert(audit.includes('PRODUCTION GATE STILL OFF') && audit.includes('NO PUBLIC ACTIVATION PERFORMED'), 'audit boundary missing')
assert(!/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(JSON.stringify(artifact) + audit), 'possible secret exposed')

console.log(JSON.stringify({
  validator: 'mlb-data-02q-r3-value-board-activation-prep-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  productionCommit: artifact.production.commit,
  r4Ready: artifact.readiness.MLB_DATA_02Q_R4_VALUE_BOARD_ACTIVATION_EXECUTION_READY,
  publicationReady: artifact.readiness.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY,
}, null, 2))
