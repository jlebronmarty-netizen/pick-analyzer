import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-02q-value-board-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02q-value-board-prep-audit.md'
const servicePath = 'src/services/pick2-mlb-value-board.service.ts'
const typePath = 'src/types/pick2-value-board.ts'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const audit = fs.readFileSync(auditPath, 'utf8')
const service = fs.readFileSync(servicePath, 'utf8')
const types = fs.readFileSync(typePath, 'utf8')

assert(artifact.certificationVerdict === 'MLB_DATA_02Q_VALUE_BOARD_PREP_CERTIFIED', 'classification mismatch')
assert(artifact.publication.state === 'PASS', 'publication failed')
assert(artifact.production.PRODUCTION_ALIGNMENT === 'PASS', 'production alignment failed')
assert(artifact.sources.officialPickCount === 5, 'official pick source count mismatch')
assert(artifact.sources.nativeValueCount === 386, 'native value source count mismatch')
assert(artifact.sources.MLB_02Q_PREDICTION_SOURCE === 'PASS', 'prediction source failed')
assert(artifact.sources.MLB_02Q_MARKET_SOURCE === 'PASS', 'market source failed')
assert(JSON.stringify(artifact.statusModel.statuses) === JSON.stringify(['OFFICIAL_PICK', 'VALUE_CANDIDATE', 'WATCHLIST', 'BLOCKED']), 'status model mismatch')
assert(artifact.statusCounts.OFFICIAL_PICK === 5, 'official pick count mismatch')
assert(artifact.statusCounts.VALUE_CANDIDATE === 14, 'value candidate count mismatch')
assert(artifact.statusCounts.WATCHLIST === 23, 'watchlist count mismatch')
assert(artifact.statusCounts.BLOCKED === 0, 'blocked count mismatch')
assert(artifact.boardArchitecture.MLB_02Q_GAME_SIDE_COLLAPSE === 'PASS', 'collapse failed')
assert(artifact.boardArchitecture.MLB_02Q_SIDE_CONFLICT_POLICY === 'READY', 'side conflict policy missing')
assert(artifact.boardArchitecture.MLB_02Q_BOARD_ROW_CONTRACT === 'READY', 'row contract missing')
assert(artifact.boardArchitecture.MLB_02Q_STATUS_PRIORITY === 'PASS', 'status priority failed')
assert(artifact.boardArchitecture.MLB_02Q_WITHIN_STATUS_RANKING === 'READY', 'ranking missing')
assert(artifact.boardArchitecture.MLB_02Q_VALUE_SCORE_CONTRACT === 'READY', 'value score missing')
assert(artifact.explanationLayer.MLB_02Q_WHY_EXPLANATION === 'READY', 'why explanation missing')
assert(artifact.explanationLayer.MLB_02Q_RISK_EXPLANATION === 'READY', 'risk explanation missing')
assert(artifact.explanationLayer.MLB_02Q_BLOCKER_EXPLANATION === 'READY', 'blocker explanation missing')
assert(artifact.explanationLayer.MLB_02Q_FACTOR_EDGE_CONTRACT === 'READY', 'factor edge missing')
assert(artifact.explanationLayer.MLB_02Q_FACTOR_EDGE_SEMANTICS === 'PASS', 'factor semantics failed')
assert(artifact.presentation.MLB_02Q_PICK_DETAIL_CONTRACT === 'READY', 'detail contract missing')
assert(artifact.presentation.MLB_02Q_OFFICIAL_PICK_CARD === 'READY', 'official card missing')
assert(artifact.presentation.MLB_02Q_VALUE_CANDIDATE_CARD === 'READY', 'value card missing')
assert(artifact.presentation.MLB_02Q_WATCHLIST_CARD === 'READY', 'watchlist card missing')
assert(artifact.presentation.MLB_02Q_BLOCKED_CARD === 'READY', 'blocked card missing')
assert(artifact.presentation.MLB_02Q_NO_MISLEADING_PICK_LANGUAGE === 'PASS', 'misleading language guard failed')
assert(artifact.presentation.MLB_02Q_FILTER_CONTRACT === 'READY', 'filters missing')
assert(artifact.presentation.MLB_02Q_SORT_CONTRACT === 'READY', 'sorting missing')
assert(artifact.presentation.MLB_02Q_MOBILE_FIRST_CONTRACT === 'PASS', 'mobile contract failed')
assert(artifact.presentation.MLB_02Q_STALE_STATE_UI === 'READY', 'stale ui missing')
assert(artifact.presentation.MLB_02Q_TIMESTAMP_UI === 'READY', 'timestamp ui missing')
assert(artifact.presentation.MLB_02Q_MODEL_LIMITATION_PRESENTATION === 'READY', 'model note missing')
assert(artifact.presentation.MLB_02Q_NO_PROFITABILITY_CLAIM === 'PASS', 'profitability claim guard failed')
assert(artifact.queryLayer.MLB_02Q_VALUE_BOARD_QUERY_LAYER === 'READY', 'query layer missing')
assert(artifact.queryLayer.MLB_02Q_BOARD_QUERY_REPRODUCIBILITY === 'PASS', 'query reproducibility failed')
assert(artifact.dryBoard.rows.length === 42, 'dry board row count mismatch')
assert(artifact.dryBoard.MLB_02Q_CURRENT_BOARD_DRY_BUILD === 'PASS', 'dry build failed')
assert(artifact.dryBoard.topPick.game_pk === 823904, 'top pick game mismatch')
assert(artifact.dryBoard.topPick.side === 'AWAY', 'top pick side mismatch')
assert(artifact.dryBoard.topPick.best_book === 'betrivers', 'top pick book mismatch')
assert(Math.abs(artifact.dryBoard.topPick.consensus_edge - 0.081935617141676) < 0.000001, 'top pick edge mismatch')
assert(Math.abs(artifact.dryBoard.topPick.unit_ev - 0.2409281394125) < 0.000001, 'top pick ev mismatch')
assert(artifact.dryBoard.MLB_02Q_TOP_PICK_PARITY === 'PASS', 'top pick parity failed')
assert(artifact.boundaries.MLB_02Q_VALUE_BOARD_PUBLICATION === 'NO', 'value board published')
assert(artifact.boundaries.MLB_02Q_VALUE_BOARD_FEATURE_GATE === 'READY', 'feature gate missing')
assert(artifact.boundaries.productionDml === 0, 'production dml occurred')
assert(artifact.boundaries.productionDdl === 0, 'production ddl occurred')
assert(artifact.boundaries.providerCalls === 0, 'provider calls occurred')
assert(artifact.boundaries.automation === 'OFF', 'automation changed')
assert(artifact.boundaries.cronChanges === 0, 'cron changed')
assert(artifact.readiness.MLB_DATA_02Q_R1_VALUE_BOARD_UI_IMPLEMENTATION_READY === 'YES', 'ui implementation readiness missing')
assert(artifact.readiness.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY === 'NO', 'publication readiness should remain no')
assert(service.includes("import 'server-only'"), 'query layer must be server-only')
assert(!service.includes('.insert('), 'service must not insert')
assert(types.includes('Pick2MlbValueBoardStatus') && types.includes('Pick2MlbValueBoardRow'), 'type contract missing')
assert(audit.includes('not public') && audit.includes('OFFICIAL PICK = PASSED CERTIFIED POLICY V1'), 'audit semantics missing')
assert(!/(\bLOCK\b|\bGUARANTEED\b|\bSAFE BET\b|CAN'T MISS)/i.test(JSON.stringify(artifact.dryBoard.rows)), 'misleading pick language present')
assert(!/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\\s*=|THE_ODDS_API_KEY\\s*=|ODDS_API_KEY\\s*=|CRON_SECRET\\s*=|Bearer\\s+[A-Za-z0-9._-]{20,})/.test(JSON.stringify(artifact) + audit + service + types), 'possible secret exposed')

console.log(JSON.stringify({
  validator: 'mlb-data-02q-value-board-prep-validate',
  status: 'PASS',
  classification: artifact.certificationVerdict,
  counts: artifact.statusCounts,
  topPick: artifact.dryBoard.topPick,
  publicationReady: artifact.readiness.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY,
}, null, 2))
