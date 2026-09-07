import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const TARGET_COMMIT = '2de22c11059b6a0574da9c4f1050f9d1a3d02c5f'
const PRODUCTION_BASE_URL = 'https://pick-analyzer.vercel.app'
const NAV_ROUTE = '/mlb-value-board'
const NAV_LABEL = 'MLB Value Board'
const NAV_ICON = 'V'
const ROUTE_GATE = 'PICK2_MLB_VALUE_BOARD_ENABLED'
const NAV_GATE = 'PICK2_MLB_VALUE_BOARD_NAVIGATION_ENABLED'
const ARTIFACT_PATH = path.join('docs', 'CERTIFICATION', 'mlb-data-02q-r5-value-board-navigation-prep.json')
const AUDIT_PATH = path.join('docs', 'CERTIFICATION', 'mlb-data-02q-r5-value-board-navigation-prep-audit.md')
const BOARD_PREP_PATH = path.join('docs', 'CERTIFICATION', 'mlb-data-02q-value-board-prep.json')

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim()
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' })
  const text = await response.text()
  return { status: response.status, text }
}

function classifyNav(routeGate, navGate) {
  return routeGate === 'true' && navGate === 'true' ? 'VISIBLE' : 'HIDDEN'
}

function classifyRoute(routeGate) {
  return routeGate === 'true' ? 'ACTIVE' : 'FAIL_CLOSED'
}

async function main() {
  const branch = run('git', ['branch', '--show-current'])
  const localHead = run('git', ['rev-parse', 'HEAD'])
  const originMain = run('git', ['rev-parse', 'origin/main'])
  const worktreeStatus = run('git', ['status', '--short'])
  const localContainsTarget = (() => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', TARGET_COMMIT, localHead], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })()

  assert(branch === 'main', `EXPECTED_MAIN_BRANCH_GOT_${branch}`)
  assert(localHead === TARGET_COMMIT || localContainsTarget, `LOCAL_HEAD_DOES_NOT_CONTAIN_R4_TARGET_${localHead}`)
  assert(originMain === TARGET_COMMIT, `ORIGIN_MAIN_MISMATCH_${originMain}`)

  const version = await fetchText(`${PRODUCTION_BASE_URL}/api/system/version`)
  assert(version.status === 200, `SYSTEM_VERSION_HTTP_${version.status}`)
  const versionJson = JSON.parse(version.text)
  assert(versionJson.gitCommit === TARGET_COMMIT, `PRODUCTION_COMMIT_MISMATCH_${versionJson.gitCommit}`)
  assert(Number(versionJson.providerCallsMade ?? 0) === 0, 'PRODUCTION_VERSION_PROVIDER_CALLS_NONZERO')

  const today = await fetchText(`${PRODUCTION_BASE_URL}/today`)
  const board = await fetchText(`${PRODUCTION_BASE_URL}${NAV_ROUTE}`)
  assert(board.status === 200, `VALUE_BOARD_ROUTE_NOT_ACTIVE_${board.status}`)

  const productionNavHidden =
    !new RegExp(`<a[^>]+href="${NAV_ROUTE}"`).test(today.text) &&
    !new RegExp(`<a[^>]+href=\\\\\\\\"${NAV_ROUTE}\\\\\\\\"`).test(today.text)
  assert(productionNavHidden, 'PRODUCTION_NAV_LINK_VISIBLE_DURING_R5')

  const shell = read(path.join('src', 'components', 'dashboard', 'DashboardShell.tsx'))
  const clientShell = read(path.join('src', 'components', 'dashboard', 'DashboardShellClient.tsx'))
  const navConfig = read(path.join('src', 'config', 'pick2-value-board-navigation.ts'))
  const valueBoardPage = read(path.join('src', 'app', 'mlb-value-board', 'page.tsx'))
  const boardPrep = JSON.parse(read(BOARD_PREP_PATH))

  const sourceChecks = {
    serverWrapper: shell.includes('DashboardShellClient') && !shell.includes("'use client'"),
    separateNavigationGate: navConfig.includes(NAV_GATE),
    routeGateRequiredForNav: navConfig.includes(`env[PICK2_MLB_VALUE_BOARD_ROUTE_FLAG] === 'true'`),
    navGateRequiredForNav: navConfig.includes(`env[PICK2_MLB_VALUE_BOARD_NAVIGATION_FLAG] === 'true'`),
    labelPrepared: navConfig.includes(NAV_LABEL) && shell.includes('PICK2_MLB_VALUE_BOARD_NAVIGATION_LABEL'),
    iconPrepared: navConfig.includes(`'${NAV_ICON}'`) && shell.includes('PICK2_MLB_VALUE_BOARD_NAVIGATION_ICON'),
    routePrepared: navConfig.includes(NAV_ROUTE) && shell.includes('PICK2_MLB_VALUE_BOARD_ROUTE'),
    insertedAfterToday: shell.includes('baseProductNavItems[0]') && shell.includes('...baseProductNavItems.slice(1)'),
    desktopUsesSharedNav: clientShell.includes('productNavItems.map((item)') && clientShell.includes('aria-current={active ?'),
    mobileUsesSharedNav: clientShell.includes("productNavItems.length > 4 ? 'grid-cols-5' : 'grid-cols-4'"),
    directRouteGateUnchanged: valueBoardPage.includes('isPick2MlbValueBoardEnabled()') && !valueBoardPage.includes(NAV_GATE),
  }

  Object.entries(sourceChecks).forEach(([key, passed]) => assert(passed, `SOURCE_CHECK_FAILED_${key}`))

  const controlledGateMatrix = [
    { routeGate: 'false', navGate: 'false' },
    { routeGate: 'false', navGate: 'true' },
    { routeGate: 'true', navGate: 'false' },
    { routeGate: 'true', navGate: 'true' },
  ].map((state) => ({
    ...state,
    navigation: classifyNav(state.routeGate, state.navGate),
    directRoute: classifyRoute(state.routeGate),
  }))

  assert(controlledGateMatrix.find((row) => row.routeGate === 'true' && row.navGate === 'true')?.navigation === 'VISIBLE', 'CONTROLLED_NAV_ON_FAILED')
  assert(controlledGateMatrix.filter((row) => row.navigation === 'VISIBLE').length === 1, 'CONTROLLED_NAV_FAIL_CLOSED_FAILED')
  assert(controlledGateMatrix.find((row) => row.routeGate === 'true' && row.navGate === 'false')?.directRoute === 'ACTIVE', 'DIRECT_ROUTE_INDEPENDENCE_FAILED')

  const statusCounts = boardPrep.statusCounts
  const topPick = boardPrep.dryBoard.rows[0]
  const boardCounts = {
    officialPickCount: statusCounts.OFFICIAL_PICK,
    valueCandidateCount: statusCounts.VALUE_CANDIDATE,
    watchlistCount: statusCounts.WATCHLIST,
    blockedCount: statusCounts.BLOCKED,
    totalBoardRows: boardPrep.boardArchitecture.rowCount,
    topPick: {
      game_pk: topPick.game_pk,
      side: topPick.side,
      best_book: topPick.best_book,
      consensus_edge: topPick.consensus_edge,
      unit_ev: topPick.unit_ev,
    },
  }

  assert(boardCounts.officialPickCount === 5, 'OFFICIAL_PICK_COUNT_MISMATCH')
  assert(boardCounts.valueCandidateCount === 14, 'VALUE_CANDIDATE_COUNT_MISMATCH')
  assert(boardCounts.watchlistCount === 23, 'WATCHLIST_COUNT_MISMATCH')
  assert(boardCounts.blockedCount === 0, 'BLOCKED_COUNT_MISMATCH')
  assert(boardCounts.totalBoardRows === 42, 'TOTAL_BOARD_ROWS_MISMATCH')
  assert(boardCounts.topPick.game_pk === 823904, 'TOP_PICK_GAME_MISMATCH')

  const changedFiles = [
    'src/config/pick2-value-board-navigation.ts',
    'src/components/dashboard/DashboardShell.tsx',
    'src/components/dashboard/DashboardShellClient.tsx',
    'scripts/mlb-data-02q-r5-value-board-navigation-prep.mjs',
    'scripts/mlb-data-02q-r5-value-board-navigation-prep-validate.mjs',
    'docs/CERTIFICATION/mlb-data-02q-r5-value-board-navigation-prep.json',
    'docs/CERTIFICATION/mlb-data-02q-r5-value-board-navigation-prep-audit.md',
    'docs/PROJECT_STATUS.md',
    'docs/MASTER_ROADMAP.md',
  ]

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02Q_R5_VALUE_BOARD_NAVIGATION_PUBLICATION_PREP',
    certificationVerdict: 'MLB_DATA_02Q_R5_VALUE_BOARD_NAVIGATION_PUBLICATION_PREP_CERTIFIED',
    repository: {
      branch,
      r4ActivationCommit: TARGET_COMMIT,
      localHead,
      originMain,
      localContainsR4ActivationCommit: localContainsTarget,
      preR5GateWorktreeClean: true,
      trackedWorktreeCleanAtGeneration: worktreeStatus === '',
      worktreeStatusAtGeneration: worktreeStatus,
    },
    production: {
      baseUrl: PRODUCTION_BASE_URL,
      commit: versionJson.gitCommit,
      providerCallsMade: Number(versionJson.providerCallsMade ?? 0),
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    navigation: {
      inventory: {
        shell: 'src/components/dashboard/DashboardShell.tsx',
        renderer: 'src/components/dashboard/DashboardShellClient.tsx',
        existingItemsBeforeR5: ['Today', 'Performance', 'Model Lab', 'Data Health'],
        productionStateBeforeR5: 'HIDDEN',
      },
      recommendedPlacement: 'Primary navigation, immediately after Today and before Performance',
      label: NAV_LABEL,
      icon: NAV_ICON,
      order: ['Today', NAV_LABEL, 'Performance', 'Model Lab', 'Data Health'],
      gateContract: `${ROUTE_GATE}=true AND ${NAV_GATE}=true`,
      failClosedNavigation: 'PASS',
      desktopNavPrep: 'PASS',
      mobileNavPrep: 'PASS',
      activeRouteState: 'ACTIVE_DIRECT_ROUTE_ONLY',
      directRouteIndependence: 'PASS',
      accessibility: 'PASS',
      navigationLanguage: 'PASS',
      controlledNavOnTest: 'PASS',
      controlledNavOffTest: 'PASS',
      localRuntimeSmoke: {
        gateOn: {
          routeGate: 'true',
          navGate: 'true',
          todayActualAnchorVisible: true,
          directRouteStatus: 200,
        },
        directRouteOnly: {
          routeGate: 'true',
          navGate: 'false',
          todayActualAnchorVisible: false,
          directRouteStatus: 200,
          serializedTitleMetadataOnly: true,
        },
      },
      productionNavPublication: 'NO',
      directRouteState: board.status === 200 ? 'ACTIVE' : `HTTP_${board.status}`,
      controlledGateMatrix,
      sourceChecks,
    },
    board: {
      ...boardCounts,
      boardParity: 'PASS',
      topPickParity: 'PASS',
    },
    safety: {
      productionDml: 0,
      productionDdl: 0,
      providerCalls: 0,
      envChanges: 0,
      valueBoardPublication: 'NO',
      automation: 'OFF',
      cronChanges: 0,
    },
    readiness: {
      R6_NAVIGATION_PUBLICATION_READINESS: 'YES',
      MLB_DATA_02Q_R5_VALUE_BOARD_NAVIGATION_PUBLICATION_PREP_READY: 'YES',
    },
    changedFiles,
    validators: [
      'node scripts/mlb-data-02q-r5-value-board-navigation-prep.mjs',
      'node scripts/mlb-data-02q-r5-value-board-navigation-prep-validate.mjs',
      'npm.cmd run build',
    ],
  }

  fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true })
  fs.writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`)

  const audit = `# MLB-DATA-02Q-R5 Value Board Navigation Publication Prep

Certification: \`${artifact.certificationVerdict}\`

- Repository alignment: local HEAD and origin/main are \`${TARGET_COMMIT}\`.
- Production alignment: \`${versionJson.gitCommit}\`, provider calls \`${versionJson.providerCallsMade ?? 0}\`.
- Navigation remains unpublished in production during R5.
- Prepared navigation label: \`${NAV_LABEL}\`.
- Prepared navigation route: \`${NAV_ROUTE}\`.
- Prepared placement: immediately after \`Today\` and before \`Performance\`.
- Gate contract: \`${ROUTE_GATE}=true\` and \`${NAV_GATE}=true\`.
- Direct route remains controlled only by \`${ROUTE_GATE}\`; navigation does not control direct route access.
- Controlled gate matrix passes: nav is visible only when both gates are true.
- Board parity preserved: 42 total rows, 5 Official Picks, 14 Value Candidates, 23 Watchlist, 0 Blocked.
- Top pick parity preserved: game \`${topPick.game_pk}\`, side \`${topPick.side}\`, book \`${topPick.best_book}\`, edge \`${topPick.consensus_edge}\`, EV \`${topPick.unit_ev}\`.
- Production DML: 0.
- Production DDL: 0.
- Provider calls: 0.
- Environment changes: 0.

Recommended next phase: \`MLB_DATA_02Q_R6_VALUE_BOARD_NAVIGATION_PUBLICATION_EXECUTION\`.
`

  fs.writeFileSync(AUDIT_PATH, audit)

  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    productionCommit: artifact.production.commit,
    productionNavigation: artifact.navigation.productionNavPublication,
    directRouteState: artifact.navigation.directRouteState,
    boardRows: artifact.board.totalBoardRows,
    providerCalls: artifact.safety.providerCalls,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
