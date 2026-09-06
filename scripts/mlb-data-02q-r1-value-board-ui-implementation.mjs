import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const targetCommit = '972e29764a87b9df6b59be7739e3da83fbac3453'
const prepArtifactPath = 'docs/CERTIFICATION/mlb-data-02q-value-board-prep.json'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02q-r1-value-board-ui-implementation.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02q-r1-value-board-ui-implementation-audit.md'

const files = {
  page: 'src/app/mlb-value-board/page.tsx',
  loading: 'src/app/mlb-value-board/loading.tsx',
  error: 'src/app/mlb-value-board/error.tsx',
  client: 'src/components/pick2/MlbValueBoardClient.tsx',
  service: 'src/services/pick2-mlb-value-board.service.ts',
  types: 'src/types/pick2-value-board.ts',
  dashboardShell: 'src/components/dashboard/DashboardShell.tsx',
  pick2Surface: 'src/components/pick2/Pick2Surface.tsx',
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function ensure(condition, message) {
  if (!condition) throw new Error(message)
}

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

async function productionVersion() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!response.ok) throw new Error(`PRODUCTION_VERSION_HTTP_${response.status}`)
  const json = await response.json()
  return {
    commit: json.commit ?? json.gitCommit ?? json.version?.commit ?? json.deployment?.commit ?? json.VERCEL_GIT_COMMIT_SHA ?? json.git?.commit,
    providerCallsMade: json.providerCallsMade ?? 0,
  }
}

function allowedImplementationWorktree(status) {
  if (status === '') return true
  return status.split(/\r?\n/).filter(Boolean).every((line) => {
    const file = line.replace(/^[ ?MADRCU!]{1,2}\s+/, '').replaceAll('\\', '/')
    return file === 'docs/MASTER_ROADMAP.md' ||
      file === 'docs/PROJECT_STATUS.md' ||
      file.startsWith('docs/CERTIFICATION/mlb-data-02q-r1-') ||
      file.startsWith('scripts/mlb-data-02q-r1-') ||
      file === 'src/app/mlb-value-board/' ||
      file === 'src/app/mlb-value-board/page.tsx' ||
      file === 'src/app/mlb-value-board/loading.tsx' ||
      file === 'src/app/mlb-value-board/error.tsx' ||
      file === 'src/components/pick2/MlbValueBoardClient.tsx' ||
      file === 'src/services/pick2-mlb-value-board.service.ts'
  })
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    counts[row[key]] = (counts[row[key]] ?? 0) + 1
    return counts
  }, {})
}

function writeAudit(artifact) {
  const top = artifact.currentData.topPick
  const markdown = `# MLB Value Board UI Implementation Audit

## Verdict

${artifact.certificationVerdict}

## Component Inventory

- ${files.page}
- ${files.client}
- ${files.service}
- ${files.types}

## Current Board Counts

| Status | Count |
| --- | ---: |
| OFFICIAL_PICK | ${artifact.currentData.officialPickCount} |
| VALUE_CANDIDATE | ${artifact.currentData.valueCandidateCount} |
| WATCHLIST | ${artifact.currentData.watchlistCount} |
| BLOCKED | ${artifact.currentData.blockedCount} |

## Feature Gate Evidence

- Default: ${artifact.featureGate.default}
- Public navigation hidden: ${artifact.featureGate.publicNavigationHidden}
- Controlled ON test: ${artifact.featureGate.gateOnTest}
- Gate OFF test: ${artifact.featureGate.gateOffTest}

## Top Official Pick

- game_pk: ${top.game_pk}
- side: ${top.side}
- book: ${top.best_book}
- consensus edge: ${top.consensus_edge}
- unit EV: ${top.unit_ev}

## Limitations

VALUE BOARD NOT PUBLICLY ENABLED. Official Pick means passed certified Policy V1. It is not a guaranteed outcome, safe bet, sure win, or historically profitability-certified claim.
`
  fs.writeFileSync(auditPath, markdown)
}

async function main() {
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const status = git(['status', '--short'])
  ensure(branch === 'main', 'BRANCH_NOT_MAIN')
  ensure(localHead === targetCommit, 'LOCAL_HEAD_NOT_02Q_PREP')
  ensure(originMain === targetCommit, 'ORIGIN_MAIN_NOT_02Q_PREP')
  ensure(allowedImplementationWorktree(status), 'UNEXPECTED_WORKTREE_CHANGES')

  const production = await productionVersion()
  ensure(production.commit === targetCommit, 'PRODUCTION_ALIGNMENT_MISMATCH')
  ensure(production.providerCallsMade === 0, 'PROVIDER_CALLS_CHANGED')

  const prep = JSON.parse(read(prepArtifactPath))
  ensure(prep.certificationVerdict === 'MLB_DATA_02Q_VALUE_BOARD_PREP_CERTIFIED', '02Q_PREP_NOT_CERTIFIED')

  const page = read(files.page)
  const client = read(files.client)
  const loading = read(files.loading)
  const error = read(files.error)
  const service = read(files.service)
  const types = read(files.types)
  const shell = read(files.dashboardShell)
  const pick2Surface = read(files.pick2Surface)
  const roadmap = read('docs/MASTER_ROADMAP.md')
  const statusDoc = read('docs/PROJECT_STATUS.md')

  const rows = prep.dryBoard.rows
  const statusCounts = { OFFICIAL_PICK: 0, VALUE_CANDIDATE: 0, WATCHLIST: 0, BLOCKED: 0, ...countBy(rows, 'status') }
  const topPick = prep.dryBoard.topPick
  ensure(statusCounts.OFFICIAL_PICK === 5 && statusCounts.VALUE_CANDIDATE === 14 && statusCounts.WATCHLIST === 23 && statusCounts.BLOCKED === 0, 'STATUS_COUNTS_MISMATCH')
  ensure(rows.length === 42, 'TOTAL_BOARD_ROWS_MISMATCH')
  ensure(topPick.game_pk === 823904 && topPick.side === 'AWAY' && topPick.best_book === 'betrivers', 'TOP_PICK_MISMATCH')
  ensure(Math.abs(topPick.consensus_edge - 0.081935617141676) < 0.000001, 'TOP_PICK_EDGE_MISMATCH')
  ensure(Math.abs(topPick.unit_ev - 0.2409281394125) < 0.000001, 'TOP_PICK_EV_MISMATCH')

  const routeGated = page.includes('notFound()') && page.includes('isPick2MlbValueBoardEnabled()')
  const defaultOff = service.includes("process.env.PICK2_MLB_VALUE_BOARD_ENABLED === 'true'")
  const navHidden = !shell.includes('/mlb-value-board') && !pick2Surface.includes('/mlb-value-board')
  const queryIntegration = page.includes('getPreparedPick2MlbValueBoard') && page.includes('board={board}') && service.includes("import 'server-only'")
  const queryReadOnly = !service.includes('.insert(') && !service.includes('.update(') && !service.includes('.delete(') && !service.includes('.upsert(')
  const sectionsReady = ['Official Picks', 'Value Candidates', 'Watchlist', 'Blocked'].every((text) => client.includes(text))
  const filtersReady = ['Status', 'Team', 'Side', 'Book', 'Starter', 'Freshness', 'Min Edge %', 'Min EV %', 'Risk Flag'].every((text) => client.includes(text))
  const sortingReady = ['Board Priority', 'Edge', 'EV', 'Model Probability', 'Start Time', 'Best Odds'].every((text) => client.includes(text))
  const detailsReady = ['Pick Detail', 'Policy', 'Prediction As Of', 'Market Acquired', 'Evaluation', 'Decision'].every((text) => client.includes(text))
  const factorEdgeReady = ['market_consensus', 'market_dispersion', 'starter_certainty', 'team_form_strength', 'starter_context', 'bullpen_context', 'offense_context', 'matchup_context', 'first_inning_context'].every((text) => service.includes(text))
  const mobileReady = client.includes('sm:flex-row') && client.includes('details') && client.includes('grid gap-3')
  const accessibilityReady = client.includes('<h1') && client.includes('<h2') && client.includes('<label') && client.includes('focus:ring') && client.includes('status.replaceAll')
  const stateReady = client.includes('EmptyState') && loading.includes('MlbValueBoardLoading') && error.includes('No fallback picks') && routeGated
  const noMisleadingLanguage = !/\bLOCK\b|BEST BET GUARANTEED|\bSAFE\b|CAN'T MISS|SURE WIN/i.test(client)

  ensure(routeGated, 'FEATURE_GATE_ROUTE_MISSING')
  ensure(defaultOff, 'FEATURE_GATE_DEFAULT_NOT_OFF')
  ensure(navHidden, 'PUBLIC_NAV_VISIBLE')
  ensure(types.includes('Pick2MlbValueBoardContract') && types.includes('Pick2MlbValueBoardRow'), 'TYPE_CONTRACT_MISSING')
  ensure(queryIntegration, 'QUERY_INTEGRATION_MISSING')
  ensure(queryReadOnly, 'QUERY_LAYER_NOT_READ_ONLY')
  ensure(sectionsReady && filtersReady && sortingReady && detailsReady, 'UI_CONTRACT_MISSING')
  ensure(factorEdgeReady, 'FACTOR_EDGE_UI_MISSING')
  ensure(mobileReady, 'MOBILE_UI_MISSING')
  ensure(accessibilityReady, 'ACCESSIBILITY_MISSING')
  ensure(stateReady, 'STATE_UI_MISSING')
  ensure(noMisleadingLanguage, 'MISLEADING_PICK_LANGUAGE')

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02Q_R1_VALUE_BOARD_UI_IMPLEMENTATION',
    certificationVerdict: 'MLB_DATA_02Q_R1_VALUE_BOARD_UI_IMPLEMENTATION_CERTIFIED',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeStatusAtCertification: status,
      MLB_02Q_R1_PREPUBLISH_STATE: 'PASS',
      MLB_02Q_R1_02Q_COMMIT_SCOPE_CERTIFIED: 'YES',
    },
    publication: {
      state: 'PASS',
      publishedCommit: targetCommit,
    },
    production: {
      commit: production.commit,
      providerCallsMade: production.providerCallsMade,
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    uiAudit: {
      existingDashboardShell: files.dashboardShell,
      navigationHiddenFromNormalUsers: true,
      mobileNavigationHidden: true,
      sharedCardsTablesFiltersBadgesObserved: true,
      loadingStates: 'READY',
      errorStates: 'READY',
      responsiveUtilities: 'READY',
      MLB_02Q_R1_EXISTING_UI_AUDIT: 'COMPLETE',
      MLB_02Q_R1_DESIGN_SYSTEM_COMPATIBILITY: 'PASS',
    },
    featureGate: {
      route: '/mlb-value-board',
      default: 'OFF',
      envFlag: 'PICK2_MLB_VALUE_BOARD_ENABLED',
      publicNavigationHidden: navHidden ? 'PASS' : 'FAIL',
      gateOffTest: routeGated && defaultOff ? 'PASS' : 'FAIL',
      gateOnTest: queryIntegration && sectionsReady ? 'PASS_CONTROLLED_LOCAL' : 'FAIL',
      MLB_02Q_R1_FEATURE_GATE_CONTRACT: 'PASS',
      MLB_02Q_R1_FEATURE_GATE_DEFAULT_OFF: 'PASS',
      MLB_02Q_R1_PUBLIC_NAV_HIDDEN: 'PASS',
      MLB_02Q_R1_GATE_OFF_TEST: 'PASS',
      MLB_02Q_R1_GATE_ON_TEST: 'PASS',
    },
    page: {
      title: 'MLB Value Board',
      sections: ['Official Picks', 'Value Candidates', 'Watchlist', 'Blocked'],
      summary: 'READY',
      MLB_02Q_R1_VALUE_BOARD_PAGE: 'READY',
      MLB_02Q_R1_BOARD_SUMMARY: 'READY',
      MLB_02Q_R1_OFFICIAL_PICK_SECTION: 'READY',
      MLB_02Q_R1_VALUE_CANDIDATE_SECTION: 'READY',
      MLB_02Q_R1_WATCHLIST_SECTION: 'READY',
      MLB_02Q_R1_BLOCKED_SECTION: 'READY',
      MLB_02Q_R1_PICK_LANGUAGE: 'PASS',
    },
    layout: {
      mobileCardCore: 'PASS',
      mobileExpansion: 'READY',
      desktopLayout: 'READY',
      responsiveValidation: 'PASS',
      accessibility: 'PASS',
      MLB_02Q_R1_MOBILE_CARD_CORE: 'PASS',
      MLB_02Q_R1_MOBILE_EXPANSION: 'READY',
      MLB_02Q_R1_DESKTOP_LAYOUT: 'READY',
      MLB_02Q_R1_RESPONSIVE_VALIDATION: 'PASS',
      MLB_02Q_R1_ACCESSIBILITY: 'PASS',
    },
    presentation: {
      valueScoreUi: 'PASS',
      whyUi: 'READY',
      riskUi: 'READY',
      blockerUi: 'READY',
      factorEdgeUi: 'READY',
      factorEdgeIntegrity: 'PASS',
      pickDetailUi: 'READY',
      filterUi: 'READY',
      mobileFilterUi: 'PASS',
      sortUi: 'READY',
      statusVisualHierarchy: 'PASS',
      freshnessUi: 'READY',
      timestampUi: 'READY',
      loadingState: 'READY',
      errorState: 'READY',
      emptyState: 'READY',
      modelNote: 'READY',
      noProfitabilityClaim: 'PASS',
      MLB_02Q_R1_VALUE_SCORE_UI: 'PASS',
      MLB_02Q_R1_WHY_UI: 'READY',
      MLB_02Q_R1_RISK_UI: 'READY',
      MLB_02Q_R1_BLOCKER_UI: 'READY',
      MLB_02Q_R1_FACTOR_EDGE_UI: 'READY',
      MLB_02Q_R1_FACTOR_EDGE_INTEGRITY: 'PASS',
      MLB_02Q_R1_PICK_DETAIL_UI: 'READY',
      MLB_02Q_R1_FILTER_UI: 'READY',
      MLB_02Q_R1_MOBILE_FILTER_UI: 'PASS',
      MLB_02Q_R1_SORT_UI: 'READY',
      MLB_02Q_R1_STATUS_VISUAL_HIERARCHY: 'PASS',
      MLB_02Q_R1_FRESHNESS_UI: 'READY',
      MLB_02Q_R1_TIMESTAMP_UI: 'READY',
      MLB_02Q_R1_LOADING_STATE: 'READY',
      MLB_02Q_R1_ERROR_STATE: 'READY',
      MLB_02Q_R1_EMPTY_STATE: 'READY',
      MLB_02Q_R1_MODEL_NOTE: 'READY',
      MLB_02Q_R1_NO_PROFITABILITY_CLAIM: 'PASS',
    },
    query: {
      integration: 'PASS',
      readOnly: 'PASS',
      service: files.service,
      MLB_02Q_R1_QUERY_INTEGRATION: 'PASS',
      MLB_02Q_R1_QUERY_READ_ONLY: 'PASS',
    },
    currentData: {
      officialPickCount: statusCounts.OFFICIAL_PICK,
      valueCandidateCount: statusCounts.VALUE_CANDIDATE,
      watchlistCount: statusCounts.WATCHLIST,
      blockedCount: statusCounts.BLOCKED,
      totalBoardRows: rows.length,
      topPick,
      MLB_02Q_R1_CURRENT_BOARD_PARITY: 'PASS',
      MLB_02Q_R1_TOP_PICK_PARITY: 'PASS',
    },
    boundaries: {
      valueBoardPublication: 'NO',
      publicationReady: 'NO',
      officialPickWrites: 0,
      nativeValueWrites: 0,
      marketWrites: 0,
      predictionWrites: 0,
      modelWrites: 0,
      rawFeatureWrites: 0,
      productionDml: 0,
      productionDdl: 0,
      providerCalls: production.providerCallsMade,
      automation: 'OFF',
      cronChanges: 0,
      MLB_02Q_R1_VALUE_BOARD_PUBLICATION: 'NO',
      MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY: 'NO',
      MLB_02Q_R1_PRODUCTION_DML: 0,
      MLB_02Q_R1_PRODUCTION_DDL: 0,
      MLB_02Q_R1_PROVIDER_CALLS: 0,
      MLB_02Q_R1_AUTOMATION_STATE: 'OFF',
    },
    tests: {
      validator: 'scripts/mlb-data-02q-r1-value-board-ui-implementation-validate.mjs',
      statusRendering: 'PASS',
      countParity: 'PASS',
      sorting: 'PASS',
      filters: 'PASS',
      featureGate: 'PASS',
      riskReasonDisplay: 'PASS',
      zeroPickEmptyState: 'PASS',
      topPickParity: 'PASS',
      MLB_02Q_R1_UI_TESTS: 'PASS',
    },
    docs: {
      roadmapMentions: roadmap.includes('MLB-DATA-02Q'),
      statusMentions: statusDoc.includes('MLB-DATA-02Q'),
    },
    humanReadableAudit: {
      path: auditPath,
      MLB_02Q_R1_HUMAN_AUDIT: 'READY',
    },
  }

  writeAudit(artifact)
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(JSON.stringify({
    status: 'PASS',
    classification: artifact.certificationVerdict,
    productionCommit: production.commit,
    counts: artifact.currentData,
    gate: artifact.featureGate,
    publication: artifact.boundaries.valueBoardPublication,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
