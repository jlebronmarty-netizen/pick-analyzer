import fs from 'node:fs'
import path from 'node:path'

const TARGET_COMMIT = '29d1bd05bd11b293887a5ffe63b3951b56a8310d'
const ARTIFACT_PATH = path.join('docs', 'CERTIFICATION', 'mlb-data-02q-r6-manual-env-activation-readback.json')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'))
const navConfig = fs.readFileSync(path.join('src', 'config', 'pick2-value-board-navigation.ts'), 'utf8')

assert(artifact.certificationVerdict === 'MLB_DATA_02Q_R6_VALUE_BOARD_NAVIGATION_PUBLICATION_CERTIFIED', 'VERDICT_MISMATCH')
assert(artifact.repository.branch === 'main', 'BRANCH_MISMATCH')
assert(artifact.repository.localHead === TARGET_COMMIT, 'LOCAL_HEAD_MISMATCH')
assert(artifact.repository.originMain === TARGET_COMMIT, 'ORIGIN_MAIN_MISMATCH')
assert(artifact.repository.MLB_02Q_R6_REPOSITORY_ALIGNMENT === 'PASS', 'REPOSITORY_ALIGNMENT_NOT_PASS')
assert(artifact.production.commit === TARGET_COMMIT, 'PRODUCTION_COMMIT_MISMATCH')
assert(artifact.production.providerCallsMade === 0, 'PRODUCTION_PROVIDER_CALLS_NONZERO')
assert(artifact.production.MLB_02Q_R6_PRODUCTION_ALIGNMENT === 'PASS', 'PRODUCTION_ALIGNMENT_NOT_PASS')

assert(artifact.gates.manualNavigationEnvActivationState === 'YES_USER_CONFIRMED', 'MANUAL_ENV_STATE_MISMATCH')
assert(artifact.gates.runtimeRefreshState === 'YES_USER_CONFIRMED_AND_READBACK_EFFECTIVE', 'RUNTIME_REFRESH_MISMATCH')
assert(artifact.gates.MLB_02Q_R6_ROUTE_GATE_BASELINE === 'ON', 'ROUTE_GATE_NOT_ON')
assert(artifact.gates.MLB_02Q_R6_NAVIGATION_VISIBLE === 'PASS', 'NAVIGATION_NOT_VISIBLE')
assert(artifact.gates.MLB_02Q_R6_NAV_ORDER === 'PASS', 'NAV_ORDER_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_NAV_ICON === 'PASS', 'NAV_ICON_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_DESKTOP_NAV_READBACK === 'PASS', 'DESKTOP_NAV_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_MOBILE_NAV_READBACK === 'PASS', 'MOBILE_NAV_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_NAV_RESPONSIVE_STATE === 'PASS', 'RESPONSIVE_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_ACTIVE_ROUTE_STATE === 'PASS', 'ACTIVE_ROUTE_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_NAV_ACCESSIBILITY === 'PASS', 'ACCESSIBILITY_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_DUAL_GATE_CONTRACT === 'PASS', 'DUAL_GATE_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_BOARD_PARITY === 'PASS', 'BOARD_PARITY_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_TOP_PICK_PARITY === 'PASS', 'TOP_PICK_PARITY_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_QUERY_LAYER_READ_ONLY === 'PASS', 'QUERY_LAYER_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_WRITE_SURFACE === 'NONE', 'WRITE_SURFACE_CHANGED')
assert(artifact.gates.MLB_02Q_R6_SECRET_SAFETY === 'PASS', 'SECRET_SAFETY_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_ENV_CHANGE_ACCOUNTING === 'PASS', 'ENV_ACCOUNTING_NOT_PASS')
assert(artifact.gates.MLB_02Q_R6_NAV_ROLLBACK_READY === 'YES', 'ROLLBACK_NOT_READY')

assert(artifact.navigation.label === 'MLB Value Board', 'NAV_LABEL_MISMATCH')
assert(artifact.navigation.target === '/mlb-value-board', 'NAV_TARGET_MISMATCH')
assert(artifact.navigation.order.join('|') === 'Today|MLB Value Board|Performance|Model Lab|Data Health', 'NAV_ORDER_MISMATCH')
assert(artifact.navigation.icon === 'V', 'NAV_ICON_MISMATCH')
assert(artifact.navigation.mobileGridColumns === 5, 'MOBILE_GRID_NOT_FIVE')
assert(artifact.navigation.desktopActiveAriaCurrent === 'page', 'DESKTOP_ARIA_CURRENT_MISSING')
assert(artifact.navigation.mobileActiveAriaCurrent === 'page', 'MOBILE_ARIA_CURRENT_MISSING')

assert(artifact.board.officialPickCount === 5, 'OFFICIAL_PICK_COUNT_MISMATCH')
assert(artifact.board.valueCandidateCount === 14, 'VALUE_CANDIDATE_COUNT_MISMATCH')
assert(artifact.board.watchlistCount === 23, 'WATCHLIST_COUNT_MISMATCH')
assert(artifact.board.blockedCount === 0, 'BLOCKED_COUNT_MISMATCH')
assert(artifact.board.totalBoardRows === 42, 'TOTAL_BOARD_ROWS_MISMATCH')
assert(artifact.board.topPick.game_pk === 823904, 'TOP_PICK_GAME_MISMATCH')
assert(artifact.board.topPick.side === 'AWAY', 'TOP_PICK_SIDE_MISMATCH')
assert(artifact.board.topPick.book === 'betrivers', 'TOP_PICK_BOOK_MISMATCH')

assert(artifact.safety.productionDml === 0, 'PRODUCTION_DML_NONZERO')
assert(artifact.safety.productionDdl === 0, 'PRODUCTION_DDL_NONZERO')
assert(artifact.safety.providerCalls === 0, 'PROVIDER_CALLS_NONZERO')
assert(artifact.safety.officialPickWrites === 0, 'OFFICIAL_PICK_WRITES_NONZERO')
assert(artifact.safety.oddsRefresh === 0, 'ODDS_REFRESH_NONZERO')
assert(artifact.safety.automation === 'OFF', 'AUTOMATION_NOT_OFF')
assert(artifact.safety.cronChanges === 0, 'CRON_CHANGES_NONZERO')

assert(artifact.publication.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_STATE === 'ACTIVE_WITH_NAVIGATION', 'PUBLICATION_STATE_MISMATCH')
assert(artifact.publication.MLB_DATA_02Q_VALUE_BOARD_NAVIGATION_STATE === 'ACTIVE', 'NAVIGATION_STATE_MISMATCH')
assert(artifact.publication.MLB_DATA_02R_DAILY_REFRESH_PIPELINE_PREP_READY === 'YES', '02R_READINESS_MISMATCH')

assert(navConfig.includes('PICK2_MLB_VALUE_BOARD_ENABLED'), 'ROUTE_GATE_SOURCE_MISSING')
assert(navConfig.includes('PICK2_MLB_VALUE_BOARD_NAVIGATION_ENABLED'), 'NAV_GATE_SOURCE_MISSING')
assert(navConfig.includes("=== 'true'"), 'STRICT_TRUE_SOURCE_MISSING')

console.log(JSON.stringify({
  validation: 'PASS',
  certificationVerdict: artifact.certificationVerdict,
  productionCommit: artifact.production.commit,
  publicationState: artifact.publication.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_STATE,
}, null, 2))
