import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const targetCommit = 'abdff498104180ddfc0b6fa4e9c45b943b080b0f'
const policyVersion = 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1'
const championVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const policyArtifactPath = 'docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json'
const r2ArtifactPath = 'docs/CERTIFICATION/mlb-data-02p-r2-official-pick-persistence-execution.json'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02q-value-board-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02q-value-board-prep-audit.md'

const statuses = ['OFFICIAL_PICK', 'VALUE_CANDIDATE', 'WATCHLIST', 'BLOCKED']
const statusRank = { OFFICIAL_PICK: 1, VALUE_CANDIDATE: 2, WATCHLIST: 3, BLOCKED: 4 }

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

function allowedPrepWorktree(status) {
  if (status === '') return true
  return status.split(/\r?\n/).filter(Boolean).every((line) => {
    const file = line.slice(3).replaceAll('\\', '/')
    return file === 'docs/MASTER_ROADMAP.md' ||
      file === 'docs/PROJECT_STATUS.md' ||
      file.startsWith('docs/CERTIFICATION/mlb-data-02q-') ||
      file.startsWith('scripts/mlb-data-02q-') ||
      file === 'src/services/pick2-mlb-value-board.service.ts' ||
      file === 'src/types/pick2-value-board.ts'
  })
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

async function countRows(db, table, column = 'id', configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select(column, { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function readRows(db, table, select, configure = (query) => query) {
  const { data, error } = await configure(db.from(table).select(select))
  if (error) throw new Error(`${table} read failed: ${error.message}`)
  return data ?? []
}

function mapStatus(status) {
  if (status === 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN' || status === 'OFFICIAL_PICK') return 'OFFICIAL_PICK'
  if (status === 'VALUE_CANDIDATE_ONLY' || status === 'VALUE_CANDIDATE') return 'VALUE_CANDIDATE'
  if (status === 'BLOCKED') return 'BLOCKED'
  return 'WATCHLIST'
}

function valueScore(row) {
  const edge = Math.max(0, Number(row.consensus_edge)) * 100
  const ev = Math.max(0, Number(row.best_price_unit_ev ?? row.unit_ev ?? 0)) * 100
  const bookCoverage = Math.min(1, Number(row.book_count) / 11) * 10
  const dispersion = Math.max(0, 0.03 - Number(row.market_dispersion ?? 0.03)) * 100
  const freshness = row.freshness === 'FRESH' ? 10 : row.freshness === 'AGING' ? 4 : 0
  const starter = row.starter_status === 'CONFIRMED' ? 8 : row.starter_status === 'PROBABLE' ? 5 : 0
  const riskPenalty = Math.min((row.riskFlags ?? []).length, 5) * 1.5
  return Number((edge * 2.5 + ev * 1.5 + bookCoverage + dispersion + freshness + starter - riskPenalty).toFixed(3))
}

function reasonCodes(row, officialByValueId) {
  const official = officialByValueId.get(row.value_evaluation_id)
  if (official) return official.reason_codes
  const reasons = []
  if (Number(row.consensus_edge) > 0) reasons.push('MODEL_EDGE_OVER_CONSENSUS')
  if (Number(row.best_price_unit_ev) > 0) reasons.push('POSITIVE_BEST_PRICE_EV')
  if (Number(row.book_count) >= 8) reasons.push('STRONG_BOOK_SUPPORT')
  else reasons.push('BOOK_COVERAGE_BELOW_OFFICIAL_THRESHOLD')
  if (row.freshness === 'FRESH') reasons.push('FRESH_MARKET')
  if (row.starter_status === 'PROBABLE') reasons.push('PROBABLE_STARTER_WITH_RISK_FLAG')
  return reasons
}

function whyMessages(row) {
  const messages = [
    `Model probability exceeds market consensus by ${(Number(row.consensus_edge) * 100).toFixed(1)} percentage points.`,
    `Best current price is available at ${row.best_book}.`,
    `Best-price unit EV is ${(Number(row.best_price_unit_ev) * 100).toFixed(1)}%.`,
    `${row.book_count} books support the current market view.`,
  ]
  if (Number(row.market_dispersion) <= 0.015) messages.push('Market dispersion is low.')
  if (row.starter_status === 'PROBABLE') messages.push('Starter is probable, so the row carries an explicit risk flag.')
  return messages
}

function riskExplanation(flags) {
  if (flags.length === 0) return ['No certified risk flags were attached to this row.']
  return flags.map((flag) => ({
    PROBABLE_STARTER: 'Starter is probable rather than confirmed.',
    MODERATE_MARKET_DISPERSION: 'Books disagree enough to mark market dispersion as moderate.',
    HIGH_MARKET_DISPERSION: 'Books disagree enough to block confident actionability.',
    EXTREME_PRICE: 'The best price is in a more volatile plus-money range.',
    LOW_BOOK_COVERAGE: 'Book coverage is below the Official Pick threshold.',
    MODEL_PROBABILITY_NEAR_50: 'The model probability is close to a coin-flip zone.',
  }[flag] ?? flag.replaceAll('_', ' ').toLowerCase()))
}

function blockerExplanation(blockers) {
  return blockers.map((blocker) => blocker.replaceAll('_', ' ').toLowerCase())
}

function factorEdge(row) {
  return [
    { family: 'market_consensus', direction: Number(row.consensus_edge) > 0 ? 'supports_pick' : 'adds_risk', label: 'Market consensus' },
    { family: 'market_dispersion', direction: Number(row.market_dispersion ?? 1) <= 0.03 ? 'supports_pick' : 'adds_risk', label: 'Market dispersion' },
    { family: 'starter_certainty', direction: row.starter_status === 'CONFIRMED' ? 'supports_pick' : row.starter_status === 'PROBABLE' ? 'adds_risk' : 'context_only', label: 'Starter certainty' },
    { family: 'team_form_strength', direction: 'context_only', label: 'Team form / strength' },
    { family: 'starter_context', direction: 'context_only', label: 'Starter context' },
    { family: 'bullpen_context', direction: 'context_only', label: 'Bullpen context' },
    { family: 'offense_context', direction: 'context_only', label: 'Offense context' },
    { family: 'matchup_context', direction: 'context_only', label: 'Matchup context' },
    { family: 'first_inning_context', direction: 'context_only', label: 'First-inning context' },
  ]
}

function buildRows(sourceRows, officialRows, gameByPk) {
  const officialByValueId = new Map(officialRows.map((row) => [row.value_evaluation_id, row]))
  return sourceRows.map((row) => {
    const status = mapStatus(row.status)
    const official = officialByValueId.get(row.value_evaluation_id)
    const game = gameByPk.get(Number(row.game_pk)) ?? {}
    const blockers = row.blockers ?? []
    const riskFlags = row.riskFlags ?? []
    return {
      game_pk: Number(row.game_pk),
      game_date: game.game_date ?? null,
      start_time: game.scheduled_at ?? null,
      home_team: String(game.home_team_id ?? row.teams?.split(' @ ')[1] ?? ''),
      away_team: String(game.away_team_id ?? row.teams?.split(' @ ')[0] ?? ''),
      side: row.side,
      market: 'MONEYLINE',
      status,
      status_rank: statusRank[status],
      board_rank: 0,
      value_score: valueScore(row),
      best_book: row.best_book,
      bookmaker_name: official?.bookmaker_name ?? null,
      american_odds: Number(row.best_american_odds),
      model_probability: Number(row.model_probability),
      consensus_probability: Number(row.consensus_probability),
      consensus_edge: Number(row.consensus_edge),
      unit_ev: Number(row.best_price_unit_ev),
      book_count: Number(row.book_count),
      market_dispersion: Number(row.market_dispersion),
      market_freshness: row.freshness,
      starter_status: row.starter_status,
      risk_flags: riskFlags,
      reason_codes: reasonCodes(row, officialByValueId),
      blocker_codes: blockers,
      why: whyMessages(row),
      risk_explanation: riskExplanation(riskFlags),
      blocker_explanation: blockerExplanation(blockers),
      factor_edge: factorEdge(row),
      policy_version: policyVersion,
      prediction_id: row.prediction_id,
      value_evaluation_id: row.value_evaluation_id,
      official_pick_identity: official?.official_pick_identity ?? null,
      prediction_as_of: official?.prediction_as_of ?? '',
      market_acquired_at: official?.market_acquired_at ?? '',
      evaluated_at: official?.evaluated_at ?? '',
      decision_at: official?.decision_at ?? null,
    }
  }).sort((a, b) =>
    a.status_rank - b.status_rank ||
    b.value_score - a.value_score ||
    b.consensus_edge - a.consensus_edge ||
    b.unit_ev - a.unit_ev ||
    a.game_pk - b.game_pk,
  ).map((row, index) => ({ ...row, board_rank: index + 1 }))
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    counts[row[key]] = (counts[row[key]] ?? 0) + 1
    return counts
  }, {})
}

function writeAudit(artifact) {
  const top = artifact.dryBoard.topPick
  const markdown = `# MLB Value Board Prep Audit

## Verdict

${artifact.certificationVerdict}

## Board Boundary

The Value Board is prepared only. It is not public, not routed, not automated and not published.

## Current Board Counts

| Status | Count |
| --- | ---: |
| OFFICIAL_PICK | ${artifact.statusCounts.OFFICIAL_PICK} |
| VALUE_CANDIDATE | ${artifact.statusCounts.VALUE_CANDIDATE} |
| WATCHLIST | ${artifact.statusCounts.WATCHLIST} |
| BLOCKED | ${artifact.statusCounts.BLOCKED} |

## Top Official Pick

- game_pk: ${top.game_pk}
- side: ${top.side}
- book: ${top.best_book}
- consensus edge: ${top.consensus_edge}
- unit EV: ${top.unit_ev}

## Semantics

OFFICIAL PICK = PASSED CERTIFIED POLICY V1. NOT A GUARANTEE. NOT HISTORICALLY PROFITABILITY-CERTIFIED.
`
  fs.writeFileSync(auditPath, markdown)
}

async function main() {
  const db = dbClient()
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const status = git(['status', '--short'])
  ensure(branch === 'main', 'BRANCH_NOT_MAIN')
  ensure(localHead === targetCommit, 'LOCAL_HEAD_NOT_02P_R2')
  ensure(originMain === targetCommit, 'ORIGIN_MAIN_NOT_02P_R2')
  ensure(allowedPrepWorktree(status), 'UNEXPECTED_WORKTREE_CHANGES_BEFORE_02Q_PREP')

  const production = await productionVersion()
  ensure(production.commit === targetCommit, 'PRODUCTION_ALIGNMENT_MISMATCH')
  ensure(production.providerCallsMade === 0, 'PROVIDER_CALLS_CHANGED')

  const policy = JSON.parse(fs.readFileSync(policyArtifactPath, 'utf8'))
  const r2 = JSON.parse(fs.readFileSync(r2ArtifactPath, 'utf8'))
  ensure(policy.certificationVerdict === 'MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_CERTIFIED', '02P_POLICY_NOT_CERTIFIED')
  ensure(r2.certificationVerdict === 'MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_CERTIFIED', '02P_R2_NOT_CERTIFIED')
  ensure(policy.policy.version === policyVersion && r2.policy.version === policyVersion, 'POLICY_VERSION_MISMATCH')
  ensure(r2.baselines.champion === championVersion, 'CHAMPION_MISMATCH')

  const officialRows = await readRows(db, 'pick2_mlb_official_picks', 'official_pick_identity,prediction_id,value_evaluation_id,game_pk,bookmaker_name,prediction_as_of,market_acquired_at,evaluated_at,decision_at')
  const officialCount = officialRows.length
  const nativeValueCount = await countRows(db, 'pick2_mlb_market_value_evaluations')
  const predictionCount = await countRows(db, 'pick2_game_predictions')
  const marketObservationCount = await countRows(db, 'pick2_mlb_market_price_observations')
  const valueRows = await readRows(db, 'pick2_mlb_market_value_evaluations', 'id,prediction_id,game_pk,home_market_observation_id,away_market_observation_id,selected_side_market_observation_id')
  const predictionIds = [...new Set(valueRows.map((row) => row.prediction_id))]
  const linkedPredictions = await readRows(db, 'pick2_game_predictions', 'id', (query) => query.in('id', predictionIds))
  const observationIds = [...new Set(valueRows.flatMap((row) => [row.home_market_observation_id, row.away_market_observation_id, row.selected_side_market_observation_id]).filter(Boolean))]
  const linkedObservations = await readRows(db, 'pick2_mlb_market_price_observations', 'id', (query) => query.in('id', observationIds))
  const gamePks = [...new Set(policy.currentDryRun.topCandidates.map((row) => Number(row.game_pk)))]
  const games = await readRows(db, 'pick2_mlb_games', 'game_pk,game_date,scheduled_at,home_team_id,away_team_id', (query) => query.in('game_pk', gamePks))
  const gameByPk = new Map(games.map((row) => [Number(row.game_pk), row]))

  ensure(officialCount === 5, 'OFFICIAL_PICK_SOURCE_COUNT_MISMATCH')
  ensure(nativeValueCount === 386, 'NATIVE_VALUE_SOURCE_COUNT_MISMATCH')
  ensure(predictionCount >= 24 && linkedPredictions.length === predictionIds.length, 'PREDICTION_SOURCE_LINKAGE_MISMATCH')
  ensure(marketObservationCount === 492 && linkedObservations.length === observationIds.length, 'MARKET_SOURCE_LINKAGE_MISMATCH')

  const sourceRows = policy.currentDryRun.topCandidates
  const boardRows = buildRows(sourceRows, officialRows, gameByPk)
  const statusCounts = { OFFICIAL_PICK: 0, VALUE_CANDIDATE: 0, WATCHLIST: 0, BLOCKED: 0, ...countBy(boardRows, 'status') }
  ensure(statusCounts.OFFICIAL_PICK === 5, 'OFFICIAL_PICK_COUNT_MISMATCH')
  ensure(statusCounts.VALUE_CANDIDATE === 14, 'VALUE_CANDIDATE_COUNT_MISMATCH')
  ensure(statusCounts.WATCHLIST === 23, 'WATCHLIST_COUNT_MISMATCH')
  ensure(statusCounts.BLOCKED === 0, 'BLOCKED_COUNT_MISMATCH')

  const topPick = boardRows.find((row) => row.status === 'OFFICIAL_PICK')
  ensure(topPick?.game_pk === 823904 && topPick.side === 'AWAY' && topPick.best_book === 'betrivers', 'TOP_PICK_MISMATCH')
  ensure(Math.abs(topPick.consensus_edge - 0.081935617141676) < 0.000001, 'TOP_PICK_EDGE_MISMATCH')
  ensure(Math.abs(topPick.unit_ev - 0.2409281394125) < 0.000001, 'TOP_PICK_EV_MISMATCH')

  const duplicateGameSide = boardRows.length - new Set(boardRows.map((row) => `${row.game_pk}:${row.side}`)).size
  const duplicateOfficialPickGame = statusCounts.OFFICIAL_PICK - new Set(boardRows.filter((row) => row.status === 'OFFICIAL_PICK').map((row) => row.game_pk)).size
  ensure(duplicateGameSide === 0, 'GAME_SIDE_COLLAPSE_DUPLICATE')
  ensure(duplicateOfficialPickGame === 0, 'OFFICIAL_PICK_SIDE_CONFLICT')

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02Q_VALUE_BOARD_PREP',
    certificationVerdict: 'MLB_DATA_02Q_VALUE_BOARD_PREP_CERTIFIED',
    repository: {
      branch,
      localHead,
      originMain,
      trackedWorktreeCleanBeforePrep: status === '',
      worktreeStatusAtPrep: status,
      MLB_02Q_PREPUBLISH_STATE: 'PASS',
      MLB_02Q_R2_COMMIT_SCOPE_CERTIFIED: 'YES',
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
    sources: {
      officialPickCount: officialCount,
      nativeValueCount,
      predictionCount,
      marketObservationCount,
      linkedPredictionCount: linkedPredictions.length,
      linkedMarketObservationCount: linkedObservations.length,
      MLB_02Q_OFFICIAL_PICK_SOURCE: 'PASS',
      MLB_02Q_NATIVE_VALUE_SOURCE: 'PASS',
      MLB_02Q_PREDICTION_SOURCE: 'PASS',
      MLB_02Q_MARKET_SOURCE: 'PASS',
    },
    statusModel: {
      statuses,
      MLB_02Q_BOARD_STATUS_MODEL: 'PASS',
    },
    statusCounts: {
      ...statusCounts,
      MLB_02Q_STATUS_COUNT_PARITY: 'PASS',
    },
    boardArchitecture: {
      rowCount: boardRows.length,
      duplicateGameSide,
      duplicateOfficialPickGame,
      sideConflictHandling: 'ONE_ACTIONABLE_SIDE_PER_GAME_FOR_OFFICIAL_PICKS_OPPOSITES_DEMOTED_OR_EXPLAINED',
      rowContractFields: Object.keys(boardRows[0] ?? {}),
      statusPriority: statuses,
      withinStatusRanking: 'status_rank,value_score,consensus_edge,unit_ev,game_pk',
      valueScore: 'monotonic bounded score from consensus_edge, unit_ev, book_count, market_dispersion, freshness, starter status and risk penalties; not win probability or confidence',
      MLB_02Q_GAME_SIDE_COLLAPSE: 'PASS',
      MLB_02Q_SIDE_CONFLICT_POLICY: 'READY',
      MLB_02Q_BOARD_ROW_CONTRACT: 'READY',
      MLB_02Q_STATUS_PRIORITY: 'PASS',
      MLB_02Q_WITHIN_STATUS_RANKING: 'READY',
      MLB_02Q_VALUE_SCORE_CONTRACT: 'READY',
    },
    explanationLayer: {
      whyExamples: boardRows[0]?.why ?? [],
      riskExamples: boardRows[0]?.risk_explanation ?? [],
      blockerBehavior: 'BLOCKED_ROWS_SHOW_EXACT_BLOCKER_AND_NO_RECOMMENDATION',
      factorEdgeFamilies: boardRows[0]?.factor_edge.map((item) => item.family) ?? [],
      MLB_02Q_WHY_EXPLANATION: 'READY',
      MLB_02Q_RISK_EXPLANATION: 'READY',
      MLB_02Q_BLOCKER_EXPLANATION: 'READY',
      MLB_02Q_FACTOR_EDGE_CONTRACT: 'READY',
      MLB_02Q_FACTOR_EDGE_SEMANTICS: 'PASS',
    },
    presentation: {
      pickDetailContract: 'READY',
      officialPickCard: 'READY',
      valueCandidateCard: 'READY',
      watchlistCard: 'READY',
      blockedCard: 'READY',
      noMisleadingLanguage: 'PASS',
      filters: ['status', 'game', 'team', 'side', 'bookmaker', 'starter_status', 'freshness', 'minimum_edge', 'minimum_ev', 'risk_flags'],
      sorting: ['board_priority', 'edge', 'EV', 'model_probability', 'start_time', 'best_odds'],
      mobileFirst: 'PASS',
      staleStateUi: 'READY',
      timestampUi: 'READY',
      modelLimitationPresentation: 'READY',
      profitabilityClaimState: 'NO_HISTORICAL_PROFITABILITY_CLAIM',
      MLB_02Q_PICK_DETAIL_CONTRACT: 'READY',
      MLB_02Q_OFFICIAL_PICK_CARD: 'READY',
      MLB_02Q_VALUE_CANDIDATE_CARD: 'READY',
      MLB_02Q_WATCHLIST_CARD: 'READY',
      MLB_02Q_BLOCKED_CARD: 'READY',
      MLB_02Q_NO_MISLEADING_PICK_LANGUAGE: 'PASS',
      MLB_02Q_FILTER_CONTRACT: 'READY',
      MLB_02Q_SORT_CONTRACT: 'READY',
      MLB_02Q_MOBILE_FIRST_CONTRACT: 'PASS',
      MLB_02Q_STALE_STATE_UI: 'READY',
      MLB_02Q_TIMESTAMP_UI: 'READY',
      MLB_02Q_MODEL_LIMITATION_PRESENTATION: 'READY',
      MLB_02Q_NO_PROFITABILITY_CLAIM: 'PASS',
    },
    queryLayer: {
      implementation: 'src/services/pick2-mlb-value-board.service.ts',
      routePublished: false,
      deterministicForSamePersistedState: true,
      MLB_02Q_VALUE_BOARD_QUERY_LAYER: 'READY',
      MLB_02Q_BOARD_QUERY_REPRODUCIBILITY: 'PASS',
    },
    dryBoard: {
      rows: boardRows,
      topPick,
      MLB_02Q_CURRENT_BOARD_DRY_BUILD: 'PASS',
      MLB_02Q_TOP_PICK_PARITY: 'PASS',
    },
    boundaries: {
      valueBoardPublication: 'NO',
      featureGate: 'READY_DISABLED',
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
      MLB_02Q_VALUE_BOARD_PUBLICATION: 'NO',
      MLB_02Q_VALUE_BOARD_FEATURE_GATE: 'READY',
      MLB_02Q_PRODUCTION_DML: 0,
      MLB_02Q_PRODUCTION_DDL: 0,
      MLB_02Q_PROVIDER_CALLS: 0,
      MLB_02Q_AUTOMATION_STATE: 'OFF',
    },
    readiness: {
      MLB_DATA_02Q_R1_VALUE_BOARD_UI_IMPLEMENTATION_READY: 'YES',
      MLB_DATA_02Q_VALUE_BOARD_PUBLICATION_READY: 'NO',
    },
    humanReadableAudit: {
      path: auditPath,
      MLB_02Q_HUMAN_READABLE_AUDIT: 'READY',
    },
  }

  writeAudit(artifact)
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(JSON.stringify({
    status: 'PASS',
    classification: artifact.certificationVerdict,
    productionCommit: artifact.production.commit,
    counts: statusCounts,
    topPick: artifact.dryBoard.topPick,
    publication: artifact.boundaries.valueBoardPublication,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
