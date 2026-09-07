import fs from 'node:fs'
import path from 'node:path'

const TARGET_COMMIT = '2de22c11059b6a0574da9c4f1050f9d1a3d02c5f'
const ARTIFACT_PATH = path.join('docs', 'CERTIFICATION', 'mlb-data-02q-r5-value-board-navigation-prep.json')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

const artifact = JSON.parse(read(ARTIFACT_PATH))
const shell = read(path.join('src', 'components', 'dashboard', 'DashboardShell.tsx'))
const clientShell = read(path.join('src', 'components', 'dashboard', 'DashboardShellClient.tsx'))
const navConfig = read(path.join('src', 'config', 'pick2-value-board-navigation.ts'))

assert(artifact.certificationVerdict === 'MLB_DATA_02Q_R5_VALUE_BOARD_NAVIGATION_PUBLICATION_PREP_CERTIFIED', 'CERTIFICATION_VERDICT_MISMATCH')
assert(artifact.repository.branch === 'main', 'BRANCH_MISMATCH')
assert(artifact.repository.r4ActivationCommit === TARGET_COMMIT, 'R4_ACTIVATION_COMMIT_MISMATCH')
assert(artifact.repository.originMain === TARGET_COMMIT, 'ORIGIN_MAIN_MISMATCH')
assert(artifact.repository.localHead === TARGET_COMMIT || artifact.repository.localContainsR4ActivationCommit === true, 'LOCAL_HEAD_DOES_NOT_CONTAIN_R4_ACTIVATION_COMMIT')
assert(artifact.production.commit === TARGET_COMMIT, 'PRODUCTION_COMMIT_MISMATCH')
assert(artifact.production.PRODUCTION_ALIGNMENT === 'PASS', 'PRODUCTION_ALIGNMENT_NOT_PASS')
assert(artifact.production.providerCallsMade === 0, 'PROVIDER_CALLS_NONZERO')

assert(artifact.navigation.productionNavPublication === 'NO', 'PRODUCTION_NAV_PUBLICATION_CHANGED')
assert(artifact.navigation.activeRouteState === 'ACTIVE_DIRECT_ROUTE_ONLY', 'ACTIVE_ROUTE_STATE_MISMATCH')
assert(artifact.navigation.directRouteState === 'ACTIVE', 'DIRECT_ROUTE_NOT_ACTIVE')
assert(artifact.navigation.failClosedNavigation === 'PASS', 'FAIL_CLOSED_NAV_NOT_PASS')
assert(artifact.navigation.desktopNavPrep === 'PASS', 'DESKTOP_NAV_PREP_NOT_PASS')
assert(artifact.navigation.mobileNavPrep === 'PASS', 'MOBILE_NAV_PREP_NOT_PASS')
assert(artifact.navigation.directRouteIndependence === 'PASS', 'DIRECT_ROUTE_INDEPENDENCE_NOT_PASS')
assert(artifact.navigation.controlledNavOnTest === 'PASS', 'CONTROLLED_NAV_ON_NOT_PASS')
assert(artifact.navigation.controlledNavOffTest === 'PASS', 'CONTROLLED_NAV_OFF_NOT_PASS')
assert(artifact.navigation.label === 'MLB Value Board', 'NAV_LABEL_MISMATCH')
assert(artifact.navigation.icon === 'V', 'NAV_ICON_MISMATCH')
assert(artifact.navigation.order.join('|') === 'Today|MLB Value Board|Performance|Model Lab|Data Health', 'NAV_ORDER_MISMATCH')
assert(artifact.navigation.gateContract === 'PICK2_MLB_VALUE_BOARD_ENABLED=true AND PICK2_MLB_VALUE_BOARD_NAVIGATION_ENABLED=true', 'GATE_CONTRACT_MISMATCH')

assert(artifact.board.officialPickCount === 5, 'OFFICIAL_PICK_COUNT_MISMATCH')
assert(artifact.board.valueCandidateCount === 14, 'VALUE_CANDIDATE_COUNT_MISMATCH')
assert(artifact.board.watchlistCount === 23, 'WATCHLIST_COUNT_MISMATCH')
assert(artifact.board.blockedCount === 0, 'BLOCKED_COUNT_MISMATCH')
assert(artifact.board.totalBoardRows === 42, 'TOTAL_BOARD_ROWS_MISMATCH')
assert(artifact.board.boardParity === 'PASS', 'BOARD_PARITY_NOT_PASS')
assert(artifact.board.topPickParity === 'PASS', 'TOP_PICK_PARITY_NOT_PASS')
assert(artifact.board.topPick.game_pk === 823904, 'TOP_PICK_GAME_MISMATCH')
assert(artifact.board.topPick.side === 'AWAY', 'TOP_PICK_SIDE_MISMATCH')
assert(artifact.board.topPick.best_book === 'betrivers', 'TOP_PICK_BOOK_MISMATCH')

assert(artifact.safety.productionDml === 0, 'PRODUCTION_DML_NONZERO')
assert(artifact.safety.productionDdl === 0, 'PRODUCTION_DDL_NONZERO')
assert(artifact.safety.providerCalls === 0, 'SAFETY_PROVIDER_CALLS_NONZERO')
assert(artifact.safety.envChanges === 0, 'ENV_CHANGES_NONZERO')
assert(artifact.safety.valueBoardPublication === 'NO', 'VALUE_BOARD_PUBLICATION_CHANGED')
assert(artifact.safety.automation === 'OFF', 'AUTOMATION_CHANGED')
assert(artifact.safety.cronChanges === 0, 'CRON_CHANGED')
assert(artifact.readiness.R6_NAVIGATION_PUBLICATION_READINESS === 'YES', 'R6_READINESS_NOT_YES')

assert(shell.includes('isPick2MlbValueBoardNavigationEnabled'), 'SHELL_NAV_GATE_MISSING')
assert(shell.includes('baseProductNavItems[0]'), 'SHELL_PLACEMENT_AFTER_TODAY_MISSING')
assert(shell.includes('...baseProductNavItems.slice(1)'), 'SHELL_PLACEMENT_BEFORE_PERFORMANCE_MISSING')
assert(clientShell.includes('aria-label="Primary mobile navigation"'), 'MOBILE_NAV_A11Y_LABEL_MISSING')
assert(clientShell.includes("productNavItems.length > 4 ? 'grid-cols-5' : 'grid-cols-4'"), 'MOBILE_FIVE_COLUMN_PREP_MISSING')
assert(navConfig.includes('PICK2_MLB_VALUE_BOARD_NAVIGATION_ENABLED'), 'NAV_GATE_FLAG_MISSING')
assert(navConfig.includes('PICK2_MLB_VALUE_BOARD_ENABLED'), 'ROUTE_GATE_FLAG_MISSING')
assert(navConfig.includes("=== 'true'"), 'STRICT_TRUE_GATE_MISSING')

console.log(JSON.stringify({
  validation: 'PASS',
  certificationVerdict: artifact.certificationVerdict,
  productionCommit: artifact.production.commit,
  r6Readiness: artifact.readiness.R6_NAVIGATION_PUBLICATION_READINESS,
}, null, 2))
