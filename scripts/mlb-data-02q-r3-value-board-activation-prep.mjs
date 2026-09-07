import fs from 'node:fs'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const targetCommit = '01fc87a257b0b3386ddb09e41ba37029d83c4a05'
const baseUrl = 'https://pick-analyzer.vercel.app'
const r2ArtifactPath = 'docs/CERTIFICATION/mlb-data-02q-r2-gated-value-board-deployment-readback.json'
const prepArtifactPath = 'docs/CERTIFICATION/mlb-data-02q-value-board-prep.json'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02q-r3-value-board-activation-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02q-r3-value-board-activation-prep-audit.md'

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

function allowedR3Worktree(status) {
  if (status === '') return true
  return status.split(/\r?\n/).filter(Boolean).every((line) => {
    const file = line.replace(/^[ ?MADRCU!]{1,2}\s+/, '').replaceAll('\\', '/')
    return file === 'docs/MASTER_ROADMAP.md' ||
      file === 'docs/PROJECT_STATUS.md' ||
      file.startsWith('docs/CERTIFICATION/mlb-data-02q-r3-') ||
      file.startsWith('scripts/mlb-data-02q-r3-')
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
    location: response.headers.get('location'),
    text: await response.text(),
  }
}

async function productionVersion() {
  const json = await fetchJson(`${baseUrl}/api/system/version`)
  return {
    commit: json.commit ?? json.gitCommit ?? json.version?.commit ?? json.deployment?.commit ?? json.VERCEL_GIT_COMMIT_SHA ?? json.git?.commit,
    providerCallsMade: json.providerCallsMade ?? 0,
    raw: json,
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

function failClosed(route) {
  return route.status === 404 ||
    route.status === 401 ||
    route.status === 403 ||
    route.status >= 300 && route.status < 400 ||
    route.status >= 400 ||
    (route.status === 200 && route.text.includes('404') && !route.text.includes('MLB Value Board'))
}

function boardExposure(html) {
  return ['MLB Value Board', 'OFFICIAL_PICK', 'VALUE_CANDIDATE', '823904', 'betrivers'].some((needle) => html.includes(needle))
}

function secretExposure(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(text)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForLocalRoute(port, expectedStatus, timeoutMs = 90000) {
  const started = Date.now()
  let lastError = null
  while (Date.now() - started < timeoutMs) {
    try {
      const route = await fetchText(`http://127.0.0.1:${port}/mlb-value-board`)
      if (expectedStatus(route)) return route
      lastError = new Error(`unexpected local status ${route.status}`)
    } catch (error) {
      lastError = error
    }
    await wait(1500)
  }
  throw lastError ?? new Error('LOCAL_ROUTE_TIMEOUT')
}

async function withLocalServer({ enabled, port }, probe) {
  const env = { ...process.env, PICK2_MLB_VALUE_BOARD_ENABLED: enabled ? 'true' : 'false', PORT: String(port), NEXT_TELEMETRY_DISABLED: '1' }
  const child = spawn('cmd.exe', ['/c', 'npm.cmd', 'run', 'dev', '--', '--port', String(port), '--hostname', '127.0.0.1'], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  try {
    return await probe(output)
  } finally {
    try {
      execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      child.kill('SIGTERM')
    }
    await wait(1000)
    if (!child.killed) child.kill('SIGKILL')
  }
}

async function controlledGateOn() {
  const port = 3107
  return withLocalServer({ enabled: true, port }, async () => {
    const route = await waitForLocalRoute(port, (response) => response.status === 200 && response.text.includes('MLB Value Board'))
    const html = route.text
    return {
      httpStatus: route.status,
      titleVisible: html.includes('MLB Value Board'),
      summaryVisible: html.includes('Official Picks') && html.includes('Value Candidates') && html.includes('Watchlist') && html.includes('Blocked'),
      officialFirst: html.indexOf('Official Picks') >= 0 && html.indexOf('Value Candidates') > html.indexOf('Official Picks'),
      filtersVisible: ['Status', 'Team', 'Side', 'Book', 'Starter', 'Freshness', 'Risk Flag'].every((text) => html.includes(text)),
      sortingVisible: ['Board Priority', 'Edge', 'EV', 'Model Probability', 'Start Time', 'Best Odds'].every((text) => html.includes(text)),
      boardMarkers: {
        topGame: html.includes('823904'),
        book: html.includes('betrivers') || html.includes('BetRivers'),
        away: html.includes('AWAY'),
        edge: html.includes('8.2%') || html.includes('8.19'),
        ev: html.includes('24.1%') || html.includes('24.09'),
      },
      officialPickRenderParity: ['Model', 'Consensus', 'Edge', 'EV', 'Why', 'Risk'].every((text) => html.includes(text)),
      nonOfficialStatusRender: html.includes('Value Candidate') && html.includes('Watchlist'),
      zeroBlockedRender: html.includes('Blocked') && html.includes('No') && html.includes('prepared board state'),
      staleStateVisible: html.includes('Freshness') || html.includes('stale') || html.includes('Market'),
      secretSafety: !secretExposure(html),
      writeSurface: !/\b(save|submit|publish|refresh odds|insert|update|delete)\b/i.test(html),
    }
  })
}

async function controlledGateOffReversion() {
  const port = 3108
  return withLocalServer({ enabled: false, port }, async () => {
    const route = await waitForLocalRoute(port, (response) => failClosed(response) && !boardExposure(response.text))
    return {
      httpStatus: route.status,
      failClosed: failClosed(route),
      boardExposure: boardExposure(route.text) ? 'YES' : 'NO',
    }
  })
}

function writeAudit(artifact) {
  const top = artifact.board.topPick
  const markdown = `# MLB Value Board Activation Prep Audit

## Verdict

${artifact.certificationVerdict}

## Production Status

PRODUCTION GATE STILL OFF.

NO PUBLIC ACTIVATION PERFORMED.

Production commit: ${artifact.production.commit}

## Activation Contract

- Set \`PICK2_MLB_VALUE_BOARD_ENABLED=true\` in the production environment only during a separately authorized activation execution phase.
- Vercel production environment changes require a redeploy or configuration refresh for the Next server runtime to observe the new value.
- Missing, malformed or any value other than exact string \`true\` remains OFF.

## Controlled Gate-ON Evidence

- Local route render: ${artifact.controlledGateOn.routeRender}
- Board parity: ${artifact.controlledGateOn.boardParity}
- Top-pick parity: ${artifact.controlledGateOn.topPickParity}
- Secret safety: ${artifact.controlledGateOn.secretSafety}
- Write surface: ${artifact.security.writeSurface}

## Current Board Counts

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

No production environment configuration was changed. No production DML, DDL, provider calls, odds refresh, Official Pick changes, automation or cron changes were performed.
`
  fs.writeFileSync(auditPath, markdown)
}

async function main() {
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const status = git(['status', '--short'])
  ensure(branch === 'main', 'BRANCH_NOT_MAIN')
  ensure(localHead === targetCommit, 'LOCAL_HEAD_NOT_R2_TARGET')
  ensure(originMain === targetCommit, 'ORIGIN_MAIN_NOT_R2_TARGET')
  ensure(allowedR3Worktree(status), 'UNEXPECTED_WORKTREE_CHANGES')

  const r2 = JSON.parse(read(r2ArtifactPath))
  const prep = JSON.parse(read(prepArtifactPath))
  ensure(r2.certificationVerdict === 'MLB_DATA_02Q_R2_GATED_VALUE_BOARD_DEPLOYMENT_CERTIFIED', 'R2_NOT_CERTIFIED')
  ensure(prep.certificationVerdict === 'MLB_DATA_02Q_VALUE_BOARD_PREP_CERTIFIED', '02Q_NOT_CERTIFIED')

  const production = await productionVersion()
  ensure(production.commit === targetCommit, 'PRODUCTION_ALIGNMENT_MISMATCH')
  ensure(production.providerCallsMade === 0, 'PROVIDER_CALLS_CHANGED')

  const prodRoute = await fetchText(`${baseUrl}/mlb-value-board`)
  const prodHome = await fetchText(`${baseUrl}/`)
  ensure(failClosed(prodRoute), 'PRODUCTION_GATE_OFF_ROUTE_NOT_FAIL_CLOSED')
  ensure(!boardExposure(prodRoute.text), 'PRODUCTION_BOARD_EXPOSED')
  ensure(!prodHome.text.includes('/mlb-value-board') && !prodHome.text.includes('MLB Value Board'), 'PRODUCTION_NAV_EXPOSED')

  const service = read('src/services/pick2-mlb-value-board.service.ts')
  const page = read('src/app/mlb-value-board/page.tsx')
  const client = read('src/components/pick2/MlbValueBoardClient.tsx')
  ensure(service.includes("process.env.PICK2_MLB_VALUE_BOARD_ENABLED === 'true'"), 'GATE_STRICT_TRUE_MISSING')
  ensure(page.includes('notFound()') && page.includes('isPick2MlbValueBoardEnabled'), 'GATE_ROUTE_MISSING')
  ensure(!/\.(insert|update|delete|upsert)\s*\(/.test(service + page + client), 'WRITE_SURFACE_IN_BOARD_CODE')

  const db = dbClient()
  const counts = {
    officialPicks: await countRows(db, 'pick2_mlb_official_picks'),
    nativeValues: await countRows(db, 'pick2_mlb_market_value_evaluations'),
    marketObservations: await countRows(db, 'pick2_mlb_market_price_observations'),
    predictions: await countRows(db, 'pick2_game_predictions'),
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

  const gateOn = await controlledGateOn()
  ensure(gateOn.httpStatus === 200 && gateOn.titleVisible, 'CONTROLLED_GATE_ON_ROUTE_FAILED')
  ensure(gateOn.summaryVisible && gateOn.officialFirst && gateOn.filtersVisible && gateOn.sortingVisible, 'CONTROLLED_GATE_ON_UX_FAILED')
  ensure(Object.values(gateOn.boardMarkers).every(Boolean), 'CONTROLLED_GATE_ON_TOP_PICK_RENDER_FAILED')
  ensure(gateOn.officialPickRenderParity, 'OFFICIAL_PICK_RENDER_PARITY_FAILED')
  ensure(gateOn.nonOfficialStatusRender, 'NON_OFFICIAL_STATUS_RENDER_FAILED')
  ensure(gateOn.zeroBlockedRender, 'ZERO_BLOCKED_RENDER_FAILED')
  ensure(gateOn.secretSafety, 'GATE_ON_SECRET_SAFETY_FAILED')
  ensure(gateOn.writeSurface, 'GATE_ON_WRITE_SURFACE_FOUND')

  const gateOffReversion = await controlledGateOffReversion()
  ensure(gateOffReversion.failClosed && gateOffReversion.boardExposure === 'NO', 'GATE_OFF_REVERSION_FAILED')

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02Q_R3_VALUE_BOARD_ACTIVATION_PREP',
    certificationVerdict: 'MLB_DATA_02Q_R3_VALUE_BOARD_ACTIVATION_PREP_CERTIFIED',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeStatusAtCertification: status,
      MLB_02Q_R3_PREPUBLISH_STATE: 'PASS',
      MLB_02Q_R3_R2_COMMIT_SCOPE_CERTIFIED: 'YES',
    },
    publication: {
      pushedCommit: targetCommit,
      state: 'PASS',
    },
    production: {
      commit: production.commit,
      providerCallsMade: production.providerCallsMade,
      alignment: 'PASS',
    },
    baseline: {
      productionGate: 'OFF',
      routeFailClosed: 'PASS',
      navigationHidden: 'PASS',
      publicBoardExposure: 'NO',
      MLB_02Q_R3_PRODUCTION_GATE_BASELINE: 'OFF',
      MLB_02Q_R3_GATE_OFF_ROUTE_BASELINE: 'PASS',
      MLB_02Q_R3_GATE_OFF_NAV_BASELINE: 'PASS',
    },
    activationContract: {
      envName: 'PICK2_MLB_VALUE_BOARD_ENABLED',
      enabledValue: 'true',
      productionEnvMutations: 0,
      runtimeRefresh: 'VERCEL_PRODUCTION_ENV_CHANGE_REQUIRES_REDEPLOY_OR_CONFIGURATION_REFRESH',
      failClosedSemantics: 'ONLY_EXACT_STRING_TRUE_ENABLES_BOARD',
      rollback: 'SET_FALSE_OR_REMOVE_ENV_AND_REDEPLOY_OR_REFRESH_RUNTIME',
      MLB_02Q_R3_ACTIVATION_ENV_CONTRACT: 'READY',
      MLB_02Q_R3_RUNTIME_REFRESH_CONTRACT: 'READY',
      MLB_02Q_R3_GATE_FAIL_CLOSED_SEMANTICS: 'PASS',
      MLB_02Q_R3_ACTIVATION_ROLLBACK: 'READY',
    },
    controlledGateOn: {
      enabledInLocalProcessOnly: true,
      routeRender: 'PASS',
      boardParity: 'PASS',
      topPickParity: 'PASS',
      uxBaseline: 'PASS',
      officialPickRenderParity: 'PASS',
      nonOfficialStatusRender: 'PASS',
      zeroBlockedRender: 'PASS',
      staleStateVisible: gateOn.staleStateVisible ? 'PASS' : 'WARN',
      secretSafety: 'PASS',
      rawEvidence: gateOn,
      MLB_02Q_R3_CONTROLLED_GATE_ON: 'PASS',
      MLB_02Q_R3_GATE_ON_ROUTE_RENDER: 'PASS',
      MLB_02Q_R3_GATE_ON_BOARD_PARITY: 'PASS',
      MLB_02Q_R3_GATE_ON_TOP_PICK_PARITY: 'PASS',
      MLB_02Q_R3_ACTIVATED_UX_BASELINE: 'PASS',
      MLB_02Q_R3_OFFICIAL_PICK_RENDER_PARITY: 'PASS',
      MLB_02Q_R3_NON_OFFICIAL_STATUS_RENDER: 'PASS',
      MLB_02Q_R3_ZERO_BLOCKED_RENDER: 'PASS',
      MLB_02Q_R3_STALE_STATE_ON_ACTIVATION: gateOn.staleStateVisible ? 'PASS' : 'WARN',
      MLB_02Q_R3_GATE_ON_SECRET_SAFETY: 'PASS',
    },
    board: {
      officialPickCount: statusCounts.OFFICIAL_PICK,
      valueCandidateCount: statusCounts.VALUE_CANDIDATE,
      watchlistCount: statusCounts.WATCHLIST,
      blockedCount: statusCounts.BLOCKED,
      totalBoardRows: rows.length,
      nativeValueCount: counts.nativeValues,
      topPick,
    },
    navigationPlan: {
      recommendation: 'DIRECT_ROUTE_ONLY_FIRST_RELEASE',
      navigationEntry: 'SEPARATE_AUTHORIZATION_AND_CERTIFICATION_REQUIRED',
      MLB_02Q_R3_NAV_ACTIVATION_POLICY: 'READY',
      MLB_02Q_R3_MINIMAL_ACTIVATION_SCOPE: 'READY',
    },
    dataContract: {
      providerIndependence: 'PASS',
      readOnlyPersistedState: 'PASS',
      noOddsRefresh: true,
      noOfficialPickRecompute: true,
      MLB_02Q_R3_ACTIVATION_PROVIDER_INDEPENDENCE: 'PASS',
      MLB_02Q_R3_ACTIVATION_READ_ONLY_DATA_CONTRACT: 'PASS',
    },
    security: {
      secretSafety: 'PASS',
      writeSurface: 'NONE',
      MLB_02Q_R3_GATE_ON_SECRET_SAFETY: 'PASS',
      MLB_02Q_R3_GATE_ON_WRITE_SURFACE: 'NONE',
    },
    rollback: {
      reversionTest: gateOffReversion,
      MLB_02Q_R3_GATE_OFF_REVERSION_TEST: 'PASS',
    },
    readbackContract: {
      checklist: ['production commit', 'gate state', 'route HTTP/render state', 'board counts', 'top pick', 'navigation state', 'provider calls', 'DML/DDL', 'secret safety'],
      MLB_02Q_R3_ACTIVATION_READBACK_CONTRACT: 'READY',
    },
    boundaries: {
      officialPickWrites: 0,
      nativeValueWrites: 0,
      marketWrites: 0,
      predictionWrites: 0,
      modelWrites: 0,
      rawFeatureWrites: 0,
      productionDml: 0,
      productionDdl: 0,
      providerCalls: production.providerCallsMade,
      productionEnvMutations: 0,
      automation: 'OFF',
      cronChanges: 0,
      MLB_02Q_R3_PRODUCTION_DML: 0,
      MLB_02Q_R3_PRODUCTION_DDL: 0,
      MLB_02Q_R3_PROVIDER_CALLS: 0,
      MLB_02Q_R3_PRODUCTION_ENV_MUTATIONS: 0,
      MLB_02Q_R3_AUTOMATION_STATE: 'OFF',
    },
    readiness: {
      MLB_DATA_02Q_R4_VALUE_BOARD_ACTIVATION_EXECUTION_READY: 'YES',
      MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY: 'NO',
    },
    validators: {
      dedicated: 'scripts/mlb-data-02q-r3-value-board-activation-prep-validate.mjs',
      inherited: 'SEE_RUN_LOG',
    },
    humanReadableAudit: {
      path: auditPath,
      title: 'MLB VALUE BOARD ACTIVATION PREP AUDIT',
      productionGateStillOff: true,
      noPublicActivationPerformed: true,
    },
  }

  writeAudit(artifact)
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(JSON.stringify({
    status: 'PASS',
    classification: artifact.certificationVerdict,
    productionCommit: artifact.production.commit,
    productionGate: artifact.baseline.productionGate,
    controlledGateOn: artifact.controlledGateOn.routeRender,
    board: artifact.board,
    readiness: artifact.readiness,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
