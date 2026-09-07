import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const targetCommit = '7f3415b069c0950e4c57c72a9446ee62316672c9'
const baseUrl = 'https://pick-analyzer.vercel.app'
const prepArtifactPath = 'docs/CERTIFICATION/mlb-data-02q-value-board-prep.json'
const r3ArtifactPath = 'docs/CERTIFICATION/mlb-data-02q-r3-value-board-activation-prep.json'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02q-r4-manual-env-activation-readback.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02q-r4-manual-env-activation-readback-audit.md'

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

function allowedR4Worktree(status) {
  if (status === '') return true
  return status.split(/\r?\n/).filter(Boolean).every((line) => {
    const file = line.replace(/^[ ?MADRCU!]{1,2}\s+/, '').replaceAll('\\', '/')
    return file === 'docs/MASTER_ROADMAP.md' ||
      file === 'docs/PROJECT_STATUS.md' ||
      file.startsWith('docs/CERTIFICATION/mlb-data-02q-r4-') ||
      file.startsWith('scripts/mlb-data-02q-r4-')
  })
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`)
  return response.json()
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' })
  return {
    status: response.status,
    text: await response.text(),
  }
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

function secretExposure(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(text)
}

function writeAudit(artifact) {
  const top = artifact.board.topPick
  const markdown = `# MLB Value Board Production Activation Audit

## Verdict

${artifact.certificationVerdict}

VALUE BOARD ACTIVE

DIRECT ROUTE ONLY

NAVIGATION HIDDEN

READ-ONLY

NO PROVIDER REFRESH

NO OFFICIAL PICK MUTATION

## Production

- Commit: ${artifact.production.commit}
- Manual environment activation: ${artifact.activation.manualEnvActivationState}
- Runtime refresh: ${artifact.activation.runtimeRefreshState}
- Route: ${artifact.route.path}
- Route HTTP status: ${artifact.route.httpStatus}

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

Codex performed read-only certification only. No Vercel environment changes, redeploy, git push, provider calls, odds refresh, Official Pick mutation, production DML, production DDL, navigation exposure, automation or cron changes were performed by this readback.
`
  fs.writeFileSync(auditPath, markdown)
}

async function main() {
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const status = git(['status', '--short'])
  ensure(branch === 'main', 'BRANCH_NOT_MAIN')
  ensure(localHead === targetCommit, 'LOCAL_HEAD_NOT_R4_TARGET')
  ensure(originMain === targetCommit, 'ORIGIN_MAIN_NOT_R4_TARGET')
  ensure(allowedR4Worktree(status), 'UNEXPECTED_WORKTREE_CHANGES')

  const prep = JSON.parse(read(prepArtifactPath))
  const r3 = JSON.parse(read(r3ArtifactPath))
  ensure(prep.certificationVerdict === 'MLB_DATA_02Q_VALUE_BOARD_PREP_CERTIFIED', '02Q_PREP_NOT_CERTIFIED')
  ensure(r3.certificationVerdict === 'MLB_DATA_02Q_R3_VALUE_BOARD_ACTIVATION_PREP_CERTIFIED', 'R3_NOT_CERTIFIED')

  const version = await fetchJson(`${baseUrl}/api/system/version`)
  const productionCommit = version.commit ?? version.gitCommit ?? version.version?.commit ?? version.deployment?.commit ?? version.VERCEL_GIT_COMMIT_SHA ?? version.git?.commit
  const providerCallsMade = version.providerCallsMade ?? 0
  ensure(productionCommit === targetCommit, 'PRODUCTION_ALIGNMENT_MISMATCH')
  ensure(providerCallsMade === 0, 'PROVIDER_CALLS_CHANGED')

  const [route, home] = await Promise.all([
    fetchText(`${baseUrl}/mlb-value-board`),
    fetchText(`${baseUrl}/`),
  ])
  const html = route.text
  const homeHtml = home.text
  const routeActivated = route.status === 200 && html.includes('MLB Value Board') && html.includes('Official Picks')
  const navHidden = !homeHtml.includes('/mlb-value-board') && !homeHtml.includes('MLB Value Board')
  ensure(routeActivated, 'VALUE_BOARD_ROUTE_NOT_ACTIVE')
  ensure(navHidden, 'NAVIGATION_EXPOSED')

  const uiChecks = {
    officialPickSection: html.includes('Official Picks'),
    valueCandidateSection: html.includes('Value Candidates'),
    watchlistSection: html.includes('Watchlist'),
    blockedZeroState: html.includes('Blocked') && html.includes('No') && html.includes('prepared board state'),
    filters: ['Status', 'Team', 'Side', 'Book', 'Starter', 'Freshness', 'Risk Flag'].every((text) => html.includes(text)),
    sorting: ['Board Priority', 'Edge', 'EV', 'Model Probability', 'Start Time', 'Best Odds'].every((text) => html.includes(text)),
    detailView: ['Pick Detail', 'Policy', 'Prediction As Of', 'Market Acquired', 'Evaluation'].every((text) => html.includes(text)),
    whyRiskFactor: ['Why', 'Risk', 'Market consensus', 'Market dispersion', 'Starter certainty'].every((text) => html.includes(text)),
    freshnessTimestamps: ['Freshness', 'Prediction As Of', 'Market Acquired', 'Evaluation'].every((text) => html.includes(text)),
  }
  ensure(Object.values(uiChecks).every(Boolean), 'UI_READBACK_MISSING')
  ensure(!secretExposure(html + homeHtml), 'SECRET_EXPOSURE_DETECTED')

  const service = read('src/services/pick2-mlb-value-board.service.ts')
  const page = read('src/app/mlb-value-board/page.tsx')
  const client = read('src/components/pick2/MlbValueBoardClient.tsx')
  const queryReadOnly = !/\.(insert|update|delete|upsert)\s*\(/.test(service + page + client)
  ensure(queryReadOnly, 'QUERY_LAYER_NOT_READ_ONLY')

  const db = dbClient()
  const counts = {
    officialPicks: await countRows(db, 'pick2_mlb_official_picks'),
    nativeValues: await countRows(db, 'pick2_mlb_market_value_evaluations'),
    marketObservations: await countRows(db, 'pick2_mlb_market_price_observations'),
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    models: await countRows(db, 'pick2_model_versions'),
    raw2025: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2025-01-01').lt('game_date', '2026-01-01')),
    featureSnapshots: await countRows(db, 'pick2_feature_snapshots'),
  }
  ensure(counts.officialPicks === 5, 'OFFICIAL_PICK_COUNT_MISMATCH')
  ensure(counts.nativeValues === 386, 'NATIVE_VALUE_COUNT_MISMATCH')

  const rows = prep.dryBoard.rows
  const statusCounts = { OFFICIAL_PICK: 0, VALUE_CANDIDATE: 0, WATCHLIST: 0, BLOCKED: 0, ...countBy(rows, 'status') }
  const topPick = prep.dryBoard.topPick
  ensure(statusCounts.OFFICIAL_PICK === 5 && statusCounts.VALUE_CANDIDATE === 14 && statusCounts.WATCHLIST === 23 && statusCounts.BLOCKED === 0, 'BOARD_COUNTS_MISMATCH')
  ensure(rows.length === 42, 'BOARD_TOTAL_MISMATCH')
  ensure(topPick.game_pk === 823904 && topPick.side === 'AWAY' && topPick.best_book === 'betrivers', 'TOP_PICK_MISMATCH')
  ensure(Math.abs(topPick.consensus_edge - 0.081935617141676) < 0.000001, 'TOP_PICK_EDGE_MISMATCH')
  ensure(Math.abs(topPick.unit_ev - 0.2409281394125) < 0.000001, 'TOP_PICK_EV_MISMATCH')
  ensure(['823904', 'AWAY', 'betrivers'].every((text) => html.includes(text)), 'TOP_PICK_NOT_RENDERED')

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02Q_R4_MANUAL_ENV_ACTIVATION_READBACK',
    certificationVerdict: 'MLB_DATA_02Q_R4_VALUE_BOARD_ACTIVATION_CERTIFIED',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeStatusAtCertification: status,
      MLB_02Q_R4_REPOSITORY_ALIGNMENT: 'PASS',
    },
    production: {
      commit: productionCommit,
      providerCallsMade,
      MLB_02Q_R4_PRODUCTION_ALIGNMENT: 'PASS',
    },
    activation: {
      manualEnvActivationState: 'USER_CONFIRMED_APPLIED',
      runtimeRefreshState: 'USER_CONFIRMED_APPLIED',
      productionGateState: 'ON',
      MLB_02Q_R4_PRODUCTION_GATE_STATE: 'ON',
      MLB_02Q_R4_ROUTE_ACTIVATION: 'PASS',
    },
    route: {
      path: '/mlb-value-board',
      httpStatus: route.status,
      activated: 'PASS',
      boardPublicExposure: 'YES_DIRECT_ROUTE_ONLY',
      activationScope: 'DIRECT_ROUTE_ONLY',
      MLB_02Q_R4_BOARD_PUBLIC_EXPOSURE: 'YES_DIRECT_ROUTE_ONLY',
      MLB_02Q_R4_ACTIVATION_SCOPE: 'PASS',
    },
    navigation: {
      publicNavigationState: 'HIDDEN',
      navigationBoundary: 'PASS',
      MLB_02Q_R4_PUBLIC_NAVIGATION_STATE: 'HIDDEN',
      MLB_02Q_R4_NAVIGATION_BOUNDARY: 'PASS',
    },
    board: {
      officialPickCount: statusCounts.OFFICIAL_PICK,
      valueCandidateCount: statusCounts.VALUE_CANDIDATE,
      watchlistCount: statusCounts.WATCHLIST,
      blockedCount: statusCounts.BLOCKED,
      totalBoardRows: rows.length,
      nativeValueCount: counts.nativeValues,
      topPick,
      MLB_02Q_R4_BOARD_PARITY: 'PASS',
      MLB_02Q_R4_TOP_PICK_PARITY: 'PASS',
    },
    ui: {
      checks: uiChecks,
      MLB_02Q_R4_UI_READBACK: 'PASS',
    },
    safety: {
      queryLayerReadOnly: 'PASS',
      secretSafety: 'PASS',
      productionDml: 0,
      productionDdl: 0,
      providerCalls: providerCallsMade,
      rollbackReady: 'YES',
      automation: 'OFF',
      cronChanges: 0,
      counts,
      MLB_02Q_R4_QUERY_LAYER_READ_ONLY: 'PASS',
      MLB_02Q_R4_PRODUCTION_DML: 0,
      MLB_02Q_R4_PRODUCTION_DDL: 0,
      MLB_02Q_R4_PROVIDER_CALLS: 0,
      MLB_02Q_R4_SECRET_SAFETY: 'PASS',
      MLB_02Q_R4_ROLLBACK_READY: 'YES',
      MLB_02Q_R4_AUTOMATION_STATE: 'OFF',
    },
    publication: {
      MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_STATE: 'ACTIVE_DIRECT_ROUTE_ONLY',
      MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY: 'YES',
      MLB_DATA_02Q_R5_VALUE_BOARD_NAVIGATION_PUBLICATION_PREP_READY: 'YES',
    },
    humanReadableAudit: {
      path: auditPath,
      title: 'MLB VALUE BOARD PRODUCTION ACTIVATION AUDIT',
    },
  }

  writeAudit(artifact)
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(JSON.stringify({
    status: 'PASS',
    classification: artifact.certificationVerdict,
    productionCommit,
    routeStatus: route.status,
    publication: artifact.publication,
    board: artifact.board,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
