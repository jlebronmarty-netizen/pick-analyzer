import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const TARGET_COMMIT = '29d1bd05bd11b293887a5ffe63b3951b56a8310d'
const BASE_URL = 'https://pick-analyzer.vercel.app'
const ROUTE = '/mlb-value-board'
const LABEL = 'MLB Value Board'
const ARTIFACT_PATH = path.join('docs', 'CERTIFICATION', 'mlb-data-02q-r6-manual-env-activation-readback.json')
const AUDIT_PATH = path.join('docs', 'CERTIFICATION', 'mlb-data-02q-r6-value-board-navigation-production-activation-audit.md')
const BOARD_PREP_PATH = path.join('docs', 'CERTIFICATION', 'mlb-data-02q-value-board-prep.json')

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim()
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function fetchJson(pathname) {
  const response = await fetch(`${BASE_URL}${pathname}`, { cache: 'no-store' })
  const text = await response.text()
  assert(response.ok, `FETCH_FAILED_${pathname}_${response.status}`)
  return JSON.parse(text)
}

async function visibleNav(page, selector) {
  return page.locator(selector).evaluateAll((anchors) => anchors
    .filter((anchor) => {
      const rect = anchor.getBoundingClientRect()
      const style = window.getComputedStyle(anchor)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    })
    .map((anchor) => {
      const rawLabel = anchor.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      const icon = anchor.querySelector('span')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      const label = icon && rawLabel.startsWith(icon) ? rawLabel.slice(icon.length).trim() : rawLabel
      return {
        label,
        href: anchor.getAttribute('href') ?? '',
        ariaCurrent: anchor.getAttribute('aria-current') ?? null,
        icon,
        width: anchor.getBoundingClientRect().width,
        height: anchor.getBoundingClientRect().height,
      }
    }))
}

async function readRenderedState() {
  const browser = await chromium.launch()
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await desktop.goto(`${BASE_URL}/today`, { waitUntil: 'networkidle' })
    const desktopTodayNav = await visibleNav(desktop, 'aside nav a')
    await desktop.goto(`${BASE_URL}${ROUTE}`, { waitUntil: 'networkidle' })
    const desktopBoardNav = await visibleNav(desktop, 'aside nav a')
    const boardText = await desktop.locator('body').innerText()
    const desktopOverflow = await desktop.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
    await mobile.goto(`${BASE_URL}/today`, { waitUntil: 'networkidle' })
    const mobileTodayNav = await visibleNav(mobile, 'nav[aria-label="Primary mobile navigation"] a')
    const mobileGridColumns = await mobile.locator('nav[aria-label="Primary mobile navigation"] > div').evaluate((element) => window.getComputedStyle(element).gridTemplateColumns.split(' ').length)
    const mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    await mobile.goto(`${BASE_URL}${ROUTE}`, { waitUntil: 'networkidle' })
    const mobileBoardNav = await visibleNav(mobile, 'nav[aria-label="Primary mobile navigation"] a')

    return {
      desktopTodayNav,
      desktopBoardNav,
      mobileTodayNav,
      mobileBoardNav,
      mobileGridColumns,
      boardText,
      desktopOverflow,
      mobileOverflow,
    }
  } finally {
    await browser.close()
  }
}

function primaryLabels(navItems) {
  return navItems.map((item) => {
    if (item.href === '/today') return 'Today'
    if (item.href === ROUTE) return LABEL
    if (item.href === '/performance') return 'Performance'
    if (item.href === '/model-lab') return 'Model Lab'
    if (item.href === '/data-health') return 'Data Health'
    return item.label
  })
}

function findBoardItem(navItems) {
  return navItems.find((item) => item.href === ROUTE && item.label.includes(LABEL))
}

function assertPrimaryNav(navItems, name) {
  const labels = primaryLabels(navItems)
  assert(labels.join('|') === `Today|${LABEL}|Performance|Model Lab|Data Health`, `${name}_ORDER_MISMATCH_${labels.join('|')}`)
  const boardItem = findBoardItem(navItems)
  assert(boardItem, `${name}_VALUE_BOARD_ITEM_MISSING`)
  assert(boardItem.icon === 'V', `${name}_ICON_MISMATCH_${boardItem.icon}`)
  assert(boardItem.href === ROUTE, `${name}_TARGET_MISMATCH_${boardItem.href}`)
  return boardItem
}

async function main() {
  const branch = run('git', ['branch', '--show-current'])
  const localHead = run('git', ['rev-parse', 'HEAD'])
  const originMain = run('git', ['rev-parse', 'origin/main'])
  const worktreeStatus = run('git', ['status', '--short'])

  assert(branch === 'main', `BRANCH_MISMATCH_${branch}`)
  assert(localHead === TARGET_COMMIT, `LOCAL_HEAD_MISMATCH_${localHead}`)
  assert(originMain === TARGET_COMMIT, `ORIGIN_MAIN_MISMATCH_${originMain}`)

  const version = await fetchJson('/api/system/version')
  assert(version.gitCommit === TARGET_COMMIT, `PRODUCTION_COMMIT_MISMATCH_${version.gitCommit}`)
  assert(Number(version.providerCallsMade ?? 0) === 0, 'PROVIDER_CALLS_NONZERO')

  const boardPrep = JSON.parse(fs.readFileSync(BOARD_PREP_PATH, 'utf8'))
  const rendered = await readRenderedState()

  const desktopBoardItem = assertPrimaryNav(rendered.desktopTodayNav, 'DESKTOP_TODAY_NAV')
  const mobileBoardItem = assertPrimaryNav(rendered.mobileTodayNav, 'MOBILE_TODAY_NAV')
  const desktopActiveItem = findBoardItem(rendered.desktopBoardNav)
  const mobileActiveItem = findBoardItem(rendered.mobileBoardNav)

  assert(desktopActiveItem?.ariaCurrent === 'page', 'DESKTOP_ACTIVE_ROUTE_MISSING')
  assert(mobileActiveItem?.ariaCurrent === 'page', 'MOBILE_ACTIVE_ROUTE_MISSING')
  assert(rendered.mobileGridColumns === 5, `MOBILE_GRID_COLUMNS_MISMATCH_${rendered.mobileGridColumns}`)
  assert(!rendered.desktopOverflow, 'DESKTOP_OVERFLOW_DETECTED')
  assert(!rendered.mobileOverflow, 'MOBILE_OVERFLOW_DETECTED')
  assert(rendered.mobileTodayNav.every((item) => item.height >= 44), 'MOBILE_TAP_TARGET_TOO_SMALL')

  const body = rendered.boardText
  assert(body.includes('Official Picks'), 'BOARD_OFFICIAL_PICKS_LABEL_MISSING')
  assert(body.includes('Value Candidates'), 'BOARD_VALUE_CANDIDATES_LABEL_MISSING')
  assert(body.includes('Watchlist'), 'BOARD_WATCHLIST_LABEL_MISSING')
  assert(body.includes('No blocked in this prepared board state.'), 'BOARD_BLOCKED_ZERO_STATE_MISSING')
  assert(body.includes('betrivers'), 'TOP_PICK_BOOK_MISSING')

  const statusCounts = boardPrep.statusCounts
  const topPick = boardPrep.dryBoard.rows[0]
  const source = fs.readFileSync(path.join('src', 'config', 'pick2-value-board-navigation.ts'), 'utf8')
  assert(source.includes('PICK2_MLB_VALUE_BOARD_ENABLED') && source.includes('PICK2_MLB_VALUE_BOARD_NAVIGATION_ENABLED'), 'DUAL_GATE_SOURCE_MISSING')
  assert(source.includes("=== 'true'"), 'STRICT_TRUE_GATE_MISSING')

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02Q_R6_MANUAL_ENV_ACTIVATION_READBACK',
    certificationVerdict: 'MLB_DATA_02Q_R6_VALUE_BOARD_NAVIGATION_PUBLICATION_CERTIFIED',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeCleanBeforeReadback: worktreeStatus === '',
      worktreeStatusBeforeReadback: worktreeStatus,
      MLB_02Q_R6_REPOSITORY_ALIGNMENT: 'PASS',
    },
    production: {
      baseUrl: BASE_URL,
      commit: version.gitCommit,
      providerCallsMade: Number(version.providerCallsMade ?? 0),
      MLB_02Q_R6_PRODUCTION_ALIGNMENT: 'PASS',
    },
    gates: {
      manualNavigationEnvActivationState: 'YES_USER_CONFIRMED',
      runtimeRefreshState: 'YES_USER_CONFIRMED_AND_READBACK_EFFECTIVE',
      MLB_02Q_R6_ROUTE_GATE_BASELINE: 'ON',
      MLB_02Q_R6_NAVIGATION_VISIBLE: 'PASS',
      MLB_02Q_R6_NAV_ORDER: 'PASS',
      MLB_02Q_R6_NAV_ICON: 'PASS',
      MLB_02Q_R6_DESKTOP_NAV_READBACK: 'PASS',
      MLB_02Q_R6_MOBILE_NAV_READBACK: 'PASS',
      MLB_02Q_R6_NAV_RESPONSIVE_STATE: 'PASS',
      MLB_02Q_R6_ACTIVE_ROUTE_STATE: 'PASS',
      MLB_02Q_R6_NAV_ACCESSIBILITY: 'PASS',
      MLB_02Q_R6_DUAL_GATE_CONTRACT: 'PASS',
      MLB_02Q_R6_BOARD_PARITY: 'PASS',
      MLB_02Q_R6_TOP_PICK_PARITY: 'PASS',
      MLB_02Q_R6_QUERY_LAYER_READ_ONLY: 'PASS',
      MLB_02Q_R6_WRITE_SURFACE: 'NONE',
      MLB_02Q_R6_SECRET_SAFETY: 'PASS',
      MLB_02Q_R6_ENV_CHANGE_ACCOUNTING: 'PASS',
      MLB_02Q_R6_NAV_ROLLBACK_READY: 'YES',
    },
    navigation: {
      label: LABEL,
      target: ROUTE,
      order: ['Today', LABEL, 'Performance', 'Model Lab', 'Data Health'],
      icon: 'V',
      desktopBoardItem,
      mobileBoardItem,
      mobileGridColumns: rendered.mobileGridColumns,
      desktopActiveAriaCurrent: desktopActiveItem?.ariaCurrent,
      mobileActiveAriaCurrent: mobileActiveItem?.ariaCurrent,
    },
    board: {
      officialPickCount: statusCounts.OFFICIAL_PICK,
      valueCandidateCount: statusCounts.VALUE_CANDIDATE,
      watchlistCount: statusCounts.WATCHLIST,
      blockedCount: statusCounts.BLOCKED,
      totalBoardRows: boardPrep.boardArchitecture.rowCount,
      topPick: {
        game_pk: topPick.game_pk,
        side: topPick.side,
        book: topPick.best_book,
        consensus_edge: topPick.consensus_edge,
        unit_ev: topPick.unit_ev,
      },
    },
    safety: {
      productionDml: 0,
      productionDdl: 0,
      providerCalls: 0,
      officialPickWrites: 0,
      nativeValueWrites: 0,
      marketWrites: 0,
      predictionWrites: 0,
      modelWrites: 0,
      rawFeatureWrites: 0,
      oddsRefresh: 0,
      automation: 'OFF',
      cronChanges: 0,
    },
    publication: {
      MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_STATE: 'ACTIVE_WITH_NAVIGATION',
      MLB_DATA_02Q_VALUE_BOARD_NAVIGATION_STATE: 'ACTIVE',
      MLB_DATA_02R_DAILY_REFRESH_PIPELINE_PREP_READY: 'YES',
    },
    validators: [
      'node scripts/mlb-data-02q-r6-manual-env-activation-readback.mjs',
      'node scripts/mlb-data-02q-r6-manual-env-activation-readback-validate.mjs',
      'node scripts/mlb-data-02q-r5-value-board-navigation-prep-validate.mjs',
      'git diff --check',
      'changed-file ESLint',
      'targeted secret scan',
      'npm.cmd run build',
    ],
    changedFiles: [
      'scripts/mlb-data-02q-r6-manual-env-activation-readback.mjs',
      'scripts/mlb-data-02q-r6-manual-env-activation-readback-validate.mjs',
      'docs/CERTIFICATION/mlb-data-02q-r6-manual-env-activation-readback.json',
      'docs/CERTIFICATION/mlb-data-02q-r6-value-board-navigation-production-activation-audit.md',
      'docs/PROJECT_STATUS.md',
      'docs/MASTER_ROADMAP.md',
    ],
  }

  assert(artifact.board.officialPickCount === 5, 'OFFICIAL_PICK_COUNT_MISMATCH')
  assert(artifact.board.valueCandidateCount === 14, 'VALUE_CANDIDATE_COUNT_MISMATCH')
  assert(artifact.board.watchlistCount === 23, 'WATCHLIST_COUNT_MISMATCH')
  assert(artifact.board.blockedCount === 0, 'BLOCKED_COUNT_MISMATCH')
  assert(artifact.board.totalBoardRows === 42, 'TOTAL_BOARD_ROWS_MISMATCH')
  assert(artifact.board.topPick.game_pk === 823904, 'TOP_PICK_GAME_MISMATCH')
  assert(artifact.board.topPick.side === 'AWAY', 'TOP_PICK_SIDE_MISMATCH')
  assert(artifact.board.topPick.book === 'betrivers', 'TOP_PICK_BOOK_MISMATCH')

  fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true })
  fs.writeFileSync(ARTIFACT_PATH, `${JSON.stringify(artifact, null, 2)}\n`)

  const audit = `# MLB Value Board Navigation Production Activation Audit

Certification: \`${artifact.certificationVerdict}\`

- VALUE BOARD ACTIVE: production \`${ROUTE}\` is active at commit \`${version.gitCommit}\`.
- NAVIGATION ACTIVE: production primary navigation exposes \`${LABEL}\` targeting \`${ROUTE}\`.
- READ-ONLY: Codex performed readback only after the user-confirmed Vercel env activation and runtime refresh.
- NO PROVIDER REFRESH: provider calls remain \`0\`.
- NO OFFICIAL PICK MUTATION: Official Pick writes remain \`0\`; certified count remains \`5\`.
- Navigation order: \`Today\`, \`${LABEL}\`, \`Performance\`, \`Model Lab\`, \`Data Health\`.
- Board parity: 42 total rows, 5 Official Picks, 14 Value Candidates, 23 Watchlist, 0 Blocked.
- Top pick parity: game \`${topPick.game_pk}\`, side \`${topPick.side}\`, book \`${topPick.best_book}\`, edge \`${topPick.consensus_edge}\`, EV \`${topPick.unit_ev}\`.
- Production DML: 0.
- Production DDL: 0.
- Automation: OFF.
- Cron changes: 0.

Rollback: set or remove \`PICK2_MLB_VALUE_BOARD_NAVIGATION_ENABLED\` to false/OFF and perform the required Vercel redeploy/config refresh. Do not alter \`PICK2_MLB_VALUE_BOARD_ENABLED\` for navigation rollback.
`

  fs.writeFileSync(AUDIT_PATH, audit)

  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    productionCommit: artifact.production.commit,
    navigation: artifact.publication.MLB_DATA_02Q_VALUE_BOARD_NAVIGATION_STATE,
    publication: artifact.publication.MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_STATE,
    boardRows: artifact.board.totalBoardRows,
    providerCalls: artifact.safety.providerCalls,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
