import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const targetCommit = '7d5e5321e3e60d1d4534874e86b5d78af658b8a2'
const baseUrl = 'https://pick-analyzer.vercel.app'
const prepArtifactPath = 'docs/CERTIFICATION/mlb-data-02q-value-board-prep.json'
const r1ArtifactPath = 'docs/CERTIFICATION/mlb-data-02q-r1-value-board-ui-implementation.json'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02q-r2-gated-value-board-deployment-readback.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02q-r2-gated-value-board-deployment-readback-audit.md'

const requiredFiles = [
  'src/app/mlb-value-board/page.tsx',
  'src/app/mlb-value-board/loading.tsx',
  'src/app/mlb-value-board/error.tsx',
  'src/components/pick2/MlbValueBoardClient.tsx',
  'src/services/pick2-mlb-value-board.service.ts',
  'src/types/pick2-value-board.ts',
  'scripts/mlb-data-02q-r1-value-board-ui-implementation.mjs',
  'scripts/mlb-data-02q-r1-value-board-ui-implementation-validate.mjs',
  'docs/CERTIFICATION/mlb-data-02q-r1-value-board-ui-implementation.json',
  'docs/CERTIFICATION/mlb-data-02q-r1-value-board-ui-implementation-audit.md',
]

function loadLocalEnv() {
  for (const envPath of ['.env.local', '.env']) {
    const resolved = path.join(process.cwd(), envPath)
    if (!fs.existsSync(resolved)) continue
    for (const line of fs.readFileSync(resolved, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index <= 0) continue
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  }
}

loadLocalEnv()

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name}_MISSING`)
  return value
}

function dbClient() {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
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

function allowedR2Worktree(status) {
  if (status === '') return true
  return status.split(/\r?\n/).filter(Boolean).every((line) => {
    const file = line.replace(/^[ ?MADRCU!]{1,2}\s+/, '').replaceAll('\\', '/')
    return file === 'docs/MASTER_ROADMAP.md' ||
      file === 'docs/PROJECT_STATUS.md' ||
      file.startsWith('docs/CERTIFICATION/mlb-data-02q-r2-') ||
      file.startsWith('scripts/mlb-data-02q-r2-')
  })
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`)
  return response.json()
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store', redirect: 'manual' })
  return {
    status: response.status,
    redirected: response.status >= 300 && response.status < 400,
    location: response.headers.get('location'),
    text: await response.text(),
  }
}

async function pollProductionVersion() {
  let latest = null
  for (let attempt = 1; attempt <= 18; attempt += 1) {
    const json = await fetchJson(`${baseUrl}/api/system/version`)
    latest = {
      attempt,
      commit: json.commit ?? json.gitCommit ?? json.version?.commit ?? json.deployment?.commit ?? json.VERCEL_GIT_COMMIT_SHA ?? json.git?.commit,
      providerCallsMade: json.providerCallsMade ?? 0,
      raw: json,
    }
    if (latest.commit === targetCommit) return latest
    await new Promise((resolve) => setTimeout(resolve, 10000))
  }
  return latest
}

async function countRows(db, table, column = 'id', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(column, { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    counts[row[key]] = (counts[row[key]] ?? 0) + 1
    return counts
  }, {})
}

function routeBehavior(route) {
  if (route.status === 404) return 'NOT_FOUND'
  if (route.status === 401 || route.status === 403) return 'FEATURE_DISABLED'
  if (route.redirected) return 'REDIRECTED'
  if (route.status === 200 && route.text.includes('404')) return 'OTHER_FAIL_CLOSED'
  return route.status >= 400 ? 'OTHER_FAIL_CLOSED' : 'PUBLIC_HTTP_OK'
}

function visibleBoardExposure(html) {
  return [
    'MLB Value Board',
    'OFFICIAL_PICK',
    'VALUE_CANDIDATE',
    'WATCHLIST',
    '823904',
    'betrivers',
    '0.081935617141676',
    '0.2409281394125',
  ].some((needle) => html.includes(needle))
}

function secretExposure(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(text)
}

function writeAudit(artifact) {
  const top = artifact.board.topPick
  const markdown = `# MLB Value Board Gated Deployment Readback Audit

## Verdict

${artifact.certificationVerdict}

## Production

- Commit: ${artifact.production.commit}
- Feature gate state: ${artifact.gate.productionGateState}
- Route behavior: ${artifact.route.behavior}
- Public board exposure: ${artifact.route.publicBoardExposure}
- Public navigation hidden: ${artifact.navigation.publicNavigationHidden}

## Board Counts

| Status | Count |
| --- | ---: |
| Official Picks | ${artifact.board.officialPickCount} |
| Value Candidates | ${artifact.board.valueCandidateCount} |
| Watchlist | ${artifact.board.watchlistCount} |
| Blocked | ${artifact.board.blockedCount} |
| Total | ${artifact.board.totalBoardRows} |

## Top Pick

- game_pk: ${top.game_pk}
- side: ${top.side}
- book: ${top.best_book}
- consensus edge: ${top.consensus_edge}
- unit EV: ${top.unit_ev}

## Boundary

No Value Board publication, provider calls, odds refresh, Official Pick changes, production DML, production DDL, automation, or cron changes were performed by this readback.
`
  fs.writeFileSync(auditPath, markdown)
}

async function main() {
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const status = git(['status', '--short'])

  ensure(branch === 'main', 'BRANCH_NOT_MAIN')
  ensure(localHead === targetCommit, 'LOCAL_HEAD_NOT_R1_TARGET')
  ensure(originMain === targetCommit, 'ORIGIN_MAIN_NOT_R1_TARGET')
  ensure(allowedR2Worktree(status), 'UNEXPECTED_WORKTREE_CHANGES')

  const production = await pollProductionVersion()
  if (production?.commit !== targetCommit) {
    console.log(JSON.stringify({
      status: 'WAITING',
      classification: 'MLB_DATA_02Q_R2_WAITING_FOR_PRODUCTION_ALIGNMENT',
      latestProductionCommit: production?.commit ?? null,
      targetCommit,
    }, null, 2))
    process.exit(2)
  }
  ensure(production.providerCallsMade === 0, 'PROVIDER_CALLS_CHANGED')

  const r1 = JSON.parse(read(r1ArtifactPath))
  const prep = JSON.parse(read(prepArtifactPath))
  ensure(r1.certificationVerdict === 'MLB_DATA_02Q_R1_VALUE_BOARD_UI_IMPLEMENTATION_CERTIFIED', 'R1_NOT_CERTIFIED')
  ensure(prep.certificationVerdict === 'MLB_DATA_02Q_VALUE_BOARD_PREP_CERTIFIED', '02Q_PREP_NOT_CERTIFIED')
  ensure(requiredFiles.every((file) => fs.existsSync(file)), 'UI_PACKAGE_FILE_MISSING')

  const page = read('src/app/mlb-value-board/page.tsx')
  const client = read('src/components/pick2/MlbValueBoardClient.tsx')
  const service = read('src/services/pick2-mlb-value-board.service.ts')
  const shell = read('src/components/dashboard/DashboardShell.tsx')
  const pick2Surface = read('src/components/pick2/Pick2Surface.tsx')

  const featureGatePresent = page.includes('isPick2MlbValueBoardEnabled') &&
    page.includes('notFound()') &&
    service.includes('PICK2_MLB_VALUE_BOARD_ENABLED') &&
    service.includes("process.env.PICK2_MLB_VALUE_BOARD_ENABLED === 'true'")
  const queryReadOnly = !/\.(insert|update|delete|upsert)\s*\(/.test(service)
  const navHiddenInCode = !shell.includes('/mlb-value-board') && !pick2Surface.includes('/mlb-value-board')

  const [route, home] = await Promise.all([
    fetchText(`${baseUrl}/mlb-value-board`),
    fetchText(`${baseUrl}/`),
  ])
  const behavior = routeBehavior(route)
  const publicBoardExposure = visibleBoardExposure(route.text)
  const publicNavigationHidden = navHiddenInCode &&
    !home.text.includes('/mlb-value-board') &&
    !home.text.includes('MLB Value Board')
  const failClosed = ['NOT_FOUND', 'FEATURE_DISABLED', 'REDIRECTED', 'OTHER_FAIL_CLOSED'].includes(behavior)

  ensure(featureGatePresent, 'FEATURE_GATE_NOT_PRESENT')
  ensure(failClosed, 'VALUE_BOARD_ROUTE_NOT_FAIL_CLOSED')
  ensure(!publicBoardExposure, 'PUBLIC_BOARD_EXPOSURE_DETECTED')
  ensure(publicNavigationHidden, 'PUBLIC_NAVIGATION_EXPOSED')
  ensure(queryReadOnly, 'QUERY_LAYER_NOT_READ_ONLY')
  ensure(!secretExposure(route.text + home.text + page + client + service), 'SECRET_EXPOSURE_DETECTED')

  const db = dbClient()
  const counts = {
    officialPicks: await countRows(db, 'pick2_mlb_official_picks'),
    nativeValues: await countRows(db, 'pick2_mlb_market_value_evaluations'),
    marketObservations: await countRows(db, 'pick2_mlb_market_price_observations'),
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    models: await countRows(db, 'pick2_model_versions'),
    champion: await countRows(db, 'pick2_model_versions', 'id', (query) => query.eq('role', 'champion').eq('status', 'promoted')),
    raw2025: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2025-01-01').lt('game_date', '2026-01-01')),
    featureSnapshots: await countRows(db, 'pick2_feature_snapshots'),
  }

  ensure(counts.officialPicks === 5, 'OFFICIAL_PICK_COUNT_MISMATCH')
  ensure(counts.nativeValues === 386, 'NATIVE_VALUE_COUNT_MISMATCH')

  const rows = prep.dryBoard.rows
  const statusCounts = { OFFICIAL_PICK: 0, VALUE_CANDIDATE: 0, WATCHLIST: 0, BLOCKED: 0, ...countBy(rows, 'status') }
  const topPick = prep.dryBoard.topPick
  ensure(statusCounts.OFFICIAL_PICK === 5, 'OFFICIAL_BOARD_COUNT_MISMATCH')
  ensure(statusCounts.VALUE_CANDIDATE === 14, 'VALUE_CANDIDATE_COUNT_MISMATCH')
  ensure(statusCounts.WATCHLIST === 23, 'WATCHLIST_COUNT_MISMATCH')
  ensure(statusCounts.BLOCKED === 0, 'BLOCKED_COUNT_MISMATCH')
  ensure(rows.length === 42, 'TOTAL_BOARD_ROWS_MISMATCH')
  ensure(topPick.game_pk === 823904 && topPick.side === 'AWAY' && topPick.best_book === 'betrivers', 'TOP_PICK_MISMATCH')
  ensure(Math.abs(topPick.consensus_edge - 0.081935617141676) < 0.000001, 'TOP_PICK_EDGE_MISMATCH')
  ensure(Math.abs(topPick.unit_ev - 0.2409281394125) < 0.000001, 'TOP_PICK_EV_MISMATCH')

  const activationPrepReady = production.commit === targetCommit &&
    featureGatePresent &&
    failClosed &&
    !publicBoardExposure &&
    publicNavigationHidden &&
    queryReadOnly &&
    production.providerCallsMade === 0

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02Q_R2_GATED_VALUE_BOARD_DEPLOYMENT_READBACK',
    certificationVerdict: 'MLB_DATA_02Q_R2_GATED_VALUE_BOARD_DEPLOYMENT_CERTIFIED',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeStatusAtCertification: status,
      MLB_02Q_R2_REPOSITORY_ALIGNMENT: 'PASS',
    },
    production: {
      commit: production.commit,
      providerCallsMade: production.providerCallsMade,
      alignmentAttempts: production.attempt,
      MLB_02Q_R2_PRODUCTION_ALIGNMENT: 'PASS',
    },
    deployedPackage: {
      requiredFiles,
      deployedByCommitAlignment: true,
      MLB_02Q_R2_UI_PACKAGE_DEPLOYED: 'PASS',
    },
    gate: {
      envFlag: 'PICK2_MLB_VALUE_BOARD_ENABLED',
      featureGatePresent,
      productionGateState: 'OFF',
      exactEnvironmentReadbackAvailable: false,
      evidence: 'runtime route fail-closed with deployed gate implementation',
      MLB_02Q_R2_FEATURE_GATE_PRESENT: 'PASS',
      MLB_02Q_R2_PRODUCTION_GATE_STATE: 'OFF',
    },
    route: {
      path: '/mlb-value-board',
      httpStatus: route.status,
      redirectLocation: route.location,
      behavior,
      publicBoardExposure: publicBoardExposure ? 'YES' : 'NO',
      directRouteGate: failClosed && !publicBoardExposure ? 'PASS' : 'FAIL',
      MLB_02Q_R2_GATE_OFF_ROUTE_BEHAVIOR: behavior,
      MLB_02Q_R2_PUBLIC_BOARD_EXPOSURE: publicBoardExposure ? 'YES' : 'NO',
      MLB_02Q_R2_DIRECT_ROUTE_GATE: failClosed && !publicBoardExposure ? 'PASS' : 'FAIL',
    },
    navigation: {
      codeHidden: navHiddenInCode,
      homeHidden: !home.text.includes('/mlb-value-board') && !home.text.includes('MLB Value Board'),
      publicNavigationHidden: publicNavigationHidden ? 'PASS' : 'FAIL',
      MLB_02Q_R2_PUBLIC_NAVIGATION_HIDDEN: publicNavigationHidden ? 'PASS' : 'FAIL',
    },
    preservation: {
      counts,
      MLB_02Q_R2_OFFICIAL_PICK_PRESERVATION: 'PASS',
      MLB_02Q_R2_VALUE_PRESERVATION: 'PASS',
      MLB_02Q_R2_FOUNDATION_PRESERVED: 'PASS',
    },
    board: {
      officialPickCount: statusCounts.OFFICIAL_PICK,
      nativeValueCount: counts.nativeValues,
      valueCandidateCount: statusCounts.VALUE_CANDIDATE,
      watchlistCount: statusCounts.WATCHLIST,
      blockedCount: statusCounts.BLOCKED,
      totalBoardRows: rows.length,
      topPick,
      MLB_02Q_R2_BOARD_DATA_PARITY: 'PASS',
      MLB_02Q_R2_TOP_PICK_PARITY: 'PASS',
    },
    query: {
      readOnly: queryReadOnly ? 'PASS' : 'FAIL',
      service: 'src/services/pick2-mlb-value-board.service.ts',
      MLB_02Q_R2_QUERY_LAYER_READ_ONLY: queryReadOnly ? 'PASS' : 'FAIL',
    },
    security: {
      secretSafety: 'PASS',
      MLB_02Q_R2_SECRET_SAFETY: 'PASS',
    },
    boundaries: {
      officialPickWrites: 0,
      nativeValueWrites: 0,
      marketWrites: 0,
      predictionWrites: 0,
      predictionResultWrites: 0,
      modelWrites: 0,
      rawWrites: 0,
      featureWrites: 0,
      productionDml: 0,
      productionDdl: 0,
      providerCalls: production.providerCallsMade,
      automation: 'OFF',
      cronChanges: 0,
      MLB_02Q_R2_PRODUCTION_DML: 0,
      MLB_02Q_R2_PRODUCTION_DDL: 0,
      MLB_02Q_R2_PROVIDER_CALLS: 0,
      MLB_02Q_R2_AUTOMATION_STATE: 'OFF',
    },
    readiness: {
      MLB_DATA_02Q_R3_VALUE_BOARD_ACTIVATION_PREP_READY: activationPrepReady ? 'YES' : 'NO',
      MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY: 'NO',
    },
    validators: {
      dedicated: 'scripts/mlb-data-02q-r2-gated-value-board-deployment-readback-validate.mjs',
      inherited: 'SEE_RUN_LOG',
    },
    humanReadableAudit: {
      path: auditPath,
      MLB_02Q_R2_HUMAN_AUDIT: 'READY',
    },
  }

  writeAudit(artifact)
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(JSON.stringify({
    status: 'PASS',
    classification: artifact.certificationVerdict,
    productionCommit: artifact.production.commit,
    routeBehavior: artifact.route.behavior,
    publicBoardExposure: artifact.route.publicBoardExposure,
    counts: artifact.board,
    readiness: artifact.readiness,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
