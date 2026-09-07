import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02q-r2-gated-value-board-deployment-readback.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02q-r2-gated-value-board-deployment-readback-audit.md'
const targetCommit = '7d5e5321e3e60d1d4534874e86b5d78af658b8a2'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const audit = fs.readFileSync(auditPath, 'utf8')
const routeBehavior = artifact.route.MLB_02Q_R2_GATE_OFF_ROUTE_BEHAVIOR

assert(artifact.certificationVerdict === 'MLB_DATA_02Q_R2_GATED_VALUE_BOARD_DEPLOYMENT_CERTIFIED', 'classification mismatch')
assert(artifact.repository.branch === 'main', 'branch mismatch')
assert(artifact.repository.localHead === targetCommit, 'local head mismatch')
assert(artifact.repository.originMain === targetCommit, 'origin main mismatch')
assert(artifact.repository.MLB_02Q_R2_REPOSITORY_ALIGNMENT === 'PASS', 'repository alignment failed')
assert(artifact.production.commit === targetCommit, 'production commit mismatch')
assert(artifact.production.MLB_02Q_R2_PRODUCTION_ALIGNMENT === 'PASS', 'production alignment failed')
assert(artifact.deployedPackage.MLB_02Q_R2_UI_PACKAGE_DEPLOYED === 'PASS', 'ui package not deployed')
assert(artifact.gate.MLB_02Q_R2_FEATURE_GATE_PRESENT === 'PASS', 'feature gate missing')
assert(artifact.gate.MLB_02Q_R2_PRODUCTION_GATE_STATE === 'OFF', 'production gate not off')
assert(['NOT_FOUND', 'FEATURE_DISABLED', 'REDIRECTED', 'OTHER_FAIL_CLOSED'].includes(routeBehavior), 'route not fail-closed')
assert(artifact.route.MLB_02Q_R2_PUBLIC_BOARD_EXPOSURE === 'NO', 'public board exposed')
assert(artifact.route.MLB_02Q_R2_DIRECT_ROUTE_GATE === 'PASS', 'direct route gate failed')
assert(artifact.navigation.MLB_02Q_R2_PUBLIC_NAVIGATION_HIDDEN === 'PASS', 'navigation exposed')
assert(artifact.preservation.MLB_02Q_R2_OFFICIAL_PICK_PRESERVATION === 'PASS', 'official picks not preserved')
assert(artifact.preservation.MLB_02Q_R2_VALUE_PRESERVATION === 'PASS', 'native values not preserved')
assert(artifact.preservation.MLB_02Q_R2_FOUNDATION_PRESERVED === 'PASS', 'foundation not preserved')
assert(artifact.preservation.counts.officialPicks === 5, 'official pick count mismatch')
assert(artifact.preservation.counts.nativeValues === 386, 'native value count mismatch')
assert(artifact.board.officialPickCount === 5, 'board official count mismatch')
assert(artifact.board.nativeValueCount === 386, 'board native value count mismatch')
assert(artifact.board.valueCandidateCount === 14, 'value candidate count mismatch')
assert(artifact.board.watchlistCount === 23, 'watchlist count mismatch')
assert(artifact.board.blockedCount === 0, 'blocked count mismatch')
assert(artifact.board.totalBoardRows === 42, 'total board row count mismatch')
assert(artifact.board.MLB_02Q_R2_BOARD_DATA_PARITY === 'PASS', 'board parity failed')
assert(artifact.board.topPick.game_pk === 823904, 'top pick game mismatch')
assert(artifact.board.topPick.side === 'AWAY', 'top pick side mismatch')
assert(artifact.board.topPick.best_book === 'betrivers', 'top pick book mismatch')
assert(Math.abs(artifact.board.topPick.consensus_edge - 0.081935617141676) < 0.000001, 'top pick edge mismatch')
assert(Math.abs(artifact.board.topPick.unit_ev - 0.2409281394125) < 0.000001, 'top pick ev mismatch')
assert(artifact.board.MLB_02Q_R2_TOP_PICK_PARITY === 'PASS', 'top pick parity failed')
assert(artifact.query.MLB_02Q_R2_QUERY_LAYER_READ_ONLY === 'PASS', 'query layer not read-only')
assert(artifact.security.MLB_02Q_R2_SECRET_SAFETY === 'PASS', 'secret safety failed')
assert(artifact.boundaries.MLB_02Q_R2_PRODUCTION_DML === 0, 'production dml occurred')
assert(artifact.boundaries.MLB_02Q_R2_PRODUCTION_DDL === 0, 'production ddl occurred')
assert(artifact.boundaries.MLB_02Q_R2_PROVIDER_CALLS === 0, 'provider calls occurred')
assert(artifact.boundaries.MLB_02Q_R2_AUTOMATION_STATE === 'OFF', 'automation changed')
assert(artifact.boundaries.cronChanges === 0, 'cron changed')
assert(artifact.readiness.MLB_DATA_02Q_R3_VALUE_BOARD_ACTIVATION_PREP_READY === 'YES', 'r3 activation prep not ready')
assert(artifact.readiness.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY === 'NO', 'value board publication became ready')
assert(audit.includes('No Value Board publication') && audit.includes('Route behavior'), 'audit boundary missing')
assert(!/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(JSON.stringify(artifact) + audit), 'possible secret exposed')

console.log(JSON.stringify({
  validator: 'mlb-data-02q-r2-gated-value-board-deployment-readback-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  productionCommit: artifact.production.commit,
  routeBehavior,
  publicationReady: artifact.readiness.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY,
}, null, 2))
