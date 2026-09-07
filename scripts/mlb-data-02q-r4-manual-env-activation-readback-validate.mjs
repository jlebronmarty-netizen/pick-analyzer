import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02q-r4-manual-env-activation-readback.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02q-r4-manual-env-activation-readback-audit.md'
const targetCommit = '7f3415b069c0950e4c57c72a9446ee62316672c9'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const audit = fs.readFileSync(auditPath, 'utf8')

assert(artifact.certificationVerdict === 'MLB_DATA_02Q_R4_VALUE_BOARD_ACTIVATION_CERTIFIED', 'classification mismatch')
assert(artifact.repository.localHead === targetCommit, 'local head mismatch')
assert(artifact.repository.originMain === targetCommit, 'origin main mismatch')
assert(artifact.repository.MLB_02Q_R4_REPOSITORY_ALIGNMENT === 'PASS', 'repository alignment failed')
assert(artifact.production.commit === targetCommit, 'production commit mismatch')
assert(artifact.production.MLB_02Q_R4_PRODUCTION_ALIGNMENT === 'PASS', 'production alignment failed')
assert(artifact.activation.manualEnvActivationState === 'USER_CONFIRMED_APPLIED', 'manual env activation missing')
assert(artifact.activation.runtimeRefreshState === 'USER_CONFIRMED_APPLIED', 'runtime refresh missing')
assert(artifact.activation.MLB_02Q_R4_PRODUCTION_GATE_STATE === 'ON', 'production gate not on')
assert(artifact.activation.MLB_02Q_R4_ROUTE_ACTIVATION === 'PASS', 'route activation failed')
assert(artifact.route.MLB_02Q_R4_BOARD_PUBLIC_EXPOSURE === 'YES_DIRECT_ROUTE_ONLY', 'board exposure scope mismatch')
assert(artifact.route.MLB_02Q_R4_ACTIVATION_SCOPE === 'PASS', 'activation scope failed')
assert(artifact.navigation.MLB_02Q_R4_PUBLIC_NAVIGATION_STATE === 'HIDDEN', 'navigation not hidden')
assert(artifact.navigation.MLB_02Q_R4_NAVIGATION_BOUNDARY === 'PASS', 'navigation boundary failed')
assert(artifact.board.officialPickCount === 5, 'official count mismatch')
assert(artifact.board.valueCandidateCount === 14, 'value candidate count mismatch')
assert(artifact.board.watchlistCount === 23, 'watchlist count mismatch')
assert(artifact.board.blockedCount === 0, 'blocked count mismatch')
assert(artifact.board.totalBoardRows === 42, 'total count mismatch')
assert(artifact.board.MLB_02Q_R4_BOARD_PARITY === 'PASS', 'board parity failed')
assert(artifact.board.topPick.game_pk === 823904, 'top pick game mismatch')
assert(artifact.board.topPick.side === 'AWAY', 'top pick side mismatch')
assert(artifact.board.topPick.best_book === 'betrivers', 'top pick book mismatch')
assert(Math.abs(artifact.board.topPick.consensus_edge - 0.081935617141676) < 0.000001, 'top pick edge mismatch')
assert(Math.abs(artifact.board.topPick.unit_ev - 0.2409281394125) < 0.000001, 'top pick ev mismatch')
assert(artifact.board.MLB_02Q_R4_TOP_PICK_PARITY === 'PASS', 'top pick parity failed')
assert(artifact.ui.MLB_02Q_R4_UI_READBACK === 'PASS', 'ui readback failed')
assert(Object.values(artifact.ui.checks).every(Boolean), 'ui check missing')
assert(artifact.safety.MLB_02Q_R4_QUERY_LAYER_READ_ONLY === 'PASS', 'query layer not read only')
assert(artifact.safety.MLB_02Q_R4_SECRET_SAFETY === 'PASS', 'secret safety failed')
assert(artifact.safety.MLB_02Q_R4_PRODUCTION_DML === 0, 'production dml occurred')
assert(artifact.safety.MLB_02Q_R4_PRODUCTION_DDL === 0, 'production ddl occurred')
assert(artifact.safety.MLB_02Q_R4_PROVIDER_CALLS === 0, 'provider calls occurred')
assert(artifact.safety.MLB_02Q_R4_ROLLBACK_READY === 'YES', 'rollback not ready')
assert(artifact.safety.MLB_02Q_R4_AUTOMATION_STATE === 'OFF', 'automation changed')
assert(artifact.safety.cronChanges === 0, 'cron changed')
assert(artifact.publication.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_STATE === 'ACTIVE_DIRECT_ROUTE_ONLY', 'publication state mismatch')
assert(artifact.publication.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY === 'YES', 'publication readiness mismatch')
assert(artifact.publication.MLB_DATA_02Q_R5_VALUE_BOARD_NAVIGATION_PUBLICATION_PREP_READY === 'YES', 'r5 readiness mismatch')
assert(audit.includes('VALUE BOARD ACTIVE') && audit.includes('DIRECT ROUTE ONLY') && audit.includes('NAVIGATION HIDDEN') && audit.includes('READ-ONLY') && audit.includes('NO PROVIDER REFRESH') && audit.includes('NO OFFICIAL PICK MUTATION'), 'audit boundary missing')
assert(!/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(JSON.stringify(artifact) + audit), 'possible secret exposed')

console.log(JSON.stringify({
  validator: 'mlb-data-02q-r4-manual-env-activation-readback-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  productionCommit: artifact.production.commit,
  publicationState: artifact.publication.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_STATE,
}, null, 2))
