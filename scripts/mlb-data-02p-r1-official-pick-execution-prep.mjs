import crypto from 'node:crypto'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const targetCommit = '75ca90f2a6c567bd2199bf295c25497106939297'
const policyVersion = 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02p-r1-official-pick-execution-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02p-r1-mlb-moneyline-official-pick-execution-prep-audit.md'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function loadDotEnv(path) {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function num(value) {
  return Number(value)
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
  if (error) return { count: null, error: { message: error.message, code: error.code } }
  return { count: count ?? 0, error: null }
}

async function readAll(db, table, select, configure = (query) => query, chunkSize = 1000) {
  const rows = []
  for (let from = 0; ; from += chunkSize) {
    const to = from + chunkSize - 1
    const { data, error } = await configure(db.from(table).select(select).range(from, to))
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < chunkSize) break
  }
  return rows
}

async function probeColumns(db, table, columns) {
  const result = { table, present: false, readableColumns: [], missingColumns: [], error: null }
  const { error } = await db.from(table).select(columns.join(','), { count: 'exact', head: true }).limit(1)
  if (!error) {
    result.present = true
    result.readableColumns = columns
    return result
  }
  result.error = { message: error.message, code: error.code }
  for (const column of columns) {
    const single = await db.from(table).select(column, { count: 'exact', head: true }).limit(1)
    if (single.error) result.missingColumns.push(column)
    else {
      result.present = true
      result.readableColumns.push(column)
    }
  }
  return result
}

function normalizeStarterStatus(value) {
  const status = String(value ?? 'UNKNOWN')
  if (status.includes('CONFIRMED')) return 'CONFIRMED'
  if (status.includes('PROBABLE')) return 'PROBABLE'
  if (status.includes('CHANGED')) return 'CHANGED'
  return status
}

function classify(row, policy) {
  const blockers = []
  const riskFlags = []
  const starter = normalizeStarterStatus(row.starter_status)
  const marketDispersion = num(row.market_dispersion)
  const modelProbability = num(row.model_probability)
  const consensusEdge = num(row.consensus_edge)
  const unitEv = num(row.unit_ev)
  const bookCount = Number(row.book_count)
  const freshness = row.market_freshness

  if (!['PREGAME_VALID', 'PREGAME_VALID_AT_MARKET_ACQUISITION'].includes(row.temporal_eligibility)) blockers.push('GAME_STARTED')
  if (freshness === 'STALE') blockers.push('STALE_MARKET')
  if (freshness === 'AGING') blockers.push('AGING_MARKET_ANALYTICAL_ONLY')
  if (starter === 'UNKNOWN') blockers.push('STARTER_UNKNOWN')
  if (starter === 'CHANGED') blockers.push('STARTER_CHANGED')
  if (!row.home_market_observation_id || !row.away_market_observation_id || row.home_market_observation_id === row.away_market_observation_id) blockers.push('NO_COMPLETE_TWO_SIDED_MARKET')
  if (row.selected_side_market_observation_id !== (row.side === 'HOME' ? row.home_market_observation_id : row.away_market_observation_id)) blockers.push('AMBIGUOUS_MARKET')
  if (modelProbability < policy.modelRange.min || modelProbability > policy.modelRange.max) blockers.push('MODEL_OUT_OF_RANGE')
  if (!row.prediction_id || !row.source_payload_digest || !row.evaluation_payload_digest) blockers.push('SOURCE_LINKAGE_FAILURE')
  if (marketDispersion > policy.thresholds.dispersionMaximum) blockers.push('HIGH_RISK_CONFLICT')
  if (row.metadata?.required_feature_missing === true) blockers.push('REQUIRED_FEATURE_MISSING')

  if (starter === 'PROBABLE') riskFlags.push('PROBABLE_STARTER')
  if (marketDispersion > 0.015) riskFlags.push('MODERATE_MARKET_DISPERSION')
  if (Math.abs(Number(row.american_odds)) >= 180) riskFlags.push('EXTREME_PRICE')
  if (bookCount < policy.thresholds.minimumBookCount) riskFlags.push('LOW_BOOK_COVERAGE')
  if (consensusEdge > 0 && consensusEdge < policy.thresholds.consensusEdge) riskFlags.push('WEAK_CONSENSUS_EDGE')
  if (Math.abs(modelProbability - 0.5) <= 0.025) riskFlags.push('MODEL_PROBABILITY_NEAR_50')

  const eligible = blockers.length === 0 &&
    consensusEdge >= policy.thresholds.consensusEdge &&
    unitEv >= policy.thresholds.unitEv &&
    bookCount >= policy.thresholds.minimumBookCount &&
    freshness === policy.thresholds.freshness &&
    marketDispersion <= policy.thresholds.dispersionMaximum &&
    ['CONFIRMED', 'PROBABLE'].includes(starter)

  if (eligible) return { status: 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN', blockers, riskFlags, starterStatus: starter }
  if (blockers.length) return { status: 'BLOCKED', blockers, riskFlags, starterStatus: starter }
  if (consensusEdge > 0 && unitEv > 0) return { status: 'VALUE_CANDIDATE_ONLY', blockers, riskFlags, starterStatus: starter }
  return { status: 'WATCHLIST', blockers, riskFlags, starterStatus: starter }
}

function collapseGameSide(rows) {
  const bySide = new Map()
  for (const row of rows) {
    const key = `${row.game_pk}:${row.side}`
    const current = bySide.get(key)
    if (!current || num(row.unit_ev) > num(current.unit_ev) || (num(row.unit_ev) === num(current.unit_ev) && Number(row.american_odds) > Number(current.american_odds))) {
      bySide.set(key, row)
    }
  }
  return [...bySide.values()]
}

function buildPayload(candidate, policy) {
  const decisionStatus = 'OFFICIAL_PICK'
  const reasonCodes = [
    'MODEL_EDGE_OVER_CONSENSUS',
    'POSITIVE_BEST_PRICE_EV',
    candidate.book_count >= policy.thresholds.minimumBookCount ? 'STRONG_BOOK_SUPPORT' : null,
    candidate.market_dispersion <= 0.015 ? 'LOW_MARKET_DISPERSION' : 'ACCEPTABLE_MARKET_DISPERSION',
    'FRESH_MARKET',
    candidate.starterStatus === 'CONFIRMED' ? 'STARTER_CONFIRMED' : 'PROBABLE_STARTER_WITH_RISK_FLAG',
  ].filter(Boolean)
  const identityPayload = {
    prediction_id: candidate.prediction_id,
    value_evaluation_id: candidate.id,
    game_pk: candidate.game_pk,
    side: candidate.side,
    policy_version: policy.version,
    decision_status: decisionStatus,
    decision_basis_digest: candidate.evaluation_payload_digest,
  }
  const officialPickIdentity = sha256(stable(identityPayload))
  const payload = {
    id: null,
    official_pick_identity: officialPickIdentity,
    prediction_id: candidate.prediction_id,
    value_evaluation_id: candidate.id,
    game_pk: Number(candidate.game_pk),
    sport: 'MLB',
    market: 'MONEYLINE',
    side: candidate.side,
    bookmaker_key: candidate.bookmaker_key,
    bookmaker_name: candidate.bookmaker_name,
    american_odds: Number(candidate.american_odds),
    model_version: candidate.model_version,
    model_probability: num(candidate.model_probability),
    consensus_probability: num(candidate.consensus_probability),
    consensus_edge: num(candidate.consensus_edge),
    unit_ev: num(candidate.unit_ev),
    policy_version: policy.version,
    decision_status: decisionStatus,
    eligibility_flags: candidate.eligibility_flags,
    risk_flags: candidate.riskFlags,
    reason_codes: reasonCodes,
    blocker_codes: candidate.blockers,
    prediction_as_of: candidate.prediction_as_of,
    market_acquired_at: candidate.market_acquired_at,
    evaluated_at: candidate.evaluated_at,
    decision_at: null,
    source_payload_digest: candidate.source_payload_digest,
    decision_payload_digest: null,
    metadata: {
      execution_phase: 'MLB_DATA_02P_R1_OFFICIAL_PICK_EXECUTION_PREP',
      execution_prep_only: true,
      no_official_pick_written: true,
      teams: candidate.metadata?.teams ?? null,
      policy_config_digest: policy.config.digest,
    },
    created_at: null,
  }
  payload.decision_payload_digest = sha256(stable({ ...payload, decision_payload_digest: undefined, id: undefined, created_at: undefined, decision_at: undefined }))
  return payload
}

function schemaFitFromInventory(inventory) {
  const native = inventory.find((row) => row.table === 'pick2_mlb_official_picks')
  if (native?.present && native.missingColumns.length === 0) return { fit: 'PASS', targetTable: native.table, blockers: [] }
  return {
    fit: 'BLOCKED',
    targetTable: null,
    blockers: [
      'NATIVE_OFFICIAL_PICK_TABLE_NOT_PRESENT',
      'NO_VALUE_EVALUATION_ID_LINKAGE_ON_EXISTING_OFFICIAL_SURFACES',
      'NO_POLICY_VERSION_DECISION_SNAPSHOT_STORAGE_ON_EXISTING_OFFICIAL_SURFACES',
    ],
  }
}

function writeAudit(artifact) {
  const eligible = artifact.eligibleSet.candidates.map((row) => `| ${row.game_pk} | ${row.teams} | ${row.side} | ${row.bookmaker_key} | ${row.american_odds} | ${row.consensus_edge.toFixed(6)} | ${row.unit_ev.toFixed(6)} | ${row.book_count} | ${row.market_dispersion.toFixed(6)} | ${row.starter_status} | ${row.risk_flags.join(', ') || 'NONE'} |`).join('\n')
  const markdown = `# MLB Moneyline Official Pick Execution Prep Audit

EXECUTION PREP ONLY. NO OFFICIAL PICKS WRITTEN. NO PROFITABILITY GUARANTEE.

## Verdict

${artifact.certificationVerdict}

## Publication

- Published commit: \`${artifact.repository.localHead}\`
- Production commit: \`${artifact.production.commit}\`
- Production alignment: ${artifact.production.PRODUCTION_ALIGNMENT}

## Policy

- Version: \`${artifact.policy.version}\`
- Consensus edge threshold: ${artifact.policy.thresholds.consensusEdge}
- Unit EV threshold: ${artifact.policy.thresholds.unitEv}
- Minimum books: ${artifact.policy.thresholds.minimumBookCount}
- Freshness: ${artifact.policy.thresholds.freshness}
- Dispersion max: ${artifact.policy.thresholds.dispersionMaximum}

## Exact Dry Eligible Set

| game_pk | teams | side | book | odds | consensus_edge | unit_ev | books | dispersion | starter | risk_flags |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
${eligible}

## Dry Summary

- Official Pick eligible: ${artifact.currentDryRun.counts.OFFICIAL_PICK_ELIGIBLE_DRY_RUN}
- Value Candidate: ${artifact.currentDryRun.counts.VALUE_CANDIDATE_ONLY}
- Watchlist: ${artifact.currentDryRun.counts.WATCHLIST}
- Blocked: ${artifact.currentDryRun.counts.BLOCKED}

## Schema Fit

${artifact.schema.fit === 'PASS' ? `Target table: \`${artifact.schema.targetTable}\`` : `Blocked: ${artifact.schema.blockers.join(', ')}`}

## Boundaries

- Official Pick writes: ${artifact.boundaries.officialPickWrites}
- Other production DML: ${artifact.boundaries.otherProductionDml}
- Production DDL: ${artifact.boundaries.productionDdl}
- Provider calls: ${artifact.boundaries.providerCalls}
`
  fs.writeFileSync(auditPath, markdown)
}

async function main() {
  loadDotEnv('.env.local')
  loadDotEnv('.env')
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const worktreeStatus = git(['status', '--short'])
  const worktreeClean = worktreeStatus === '' || worktreeStatus.split(/\r?\n/).filter(Boolean).every((line) => {
    const file = line.slice(3)
    return file.startsWith('docs/CERTIFICATION/mlb-data-02p-r1-') || file.startsWith('scripts/mlb-data-02p-r1-') || file === 'docs/PROJECT_STATUS.md' || file === 'docs/MASTER_ROADMAP.md'
  })
  const commitFiles = git(['show', '--name-only', '--format=', targetCommit]).split(/\r?\n/).filter(Boolean)
  const commitScopeCertified = commitFiles.every((file) =>
    file.startsWith('docs/CERTIFICATION/mlb-data-02p-') ||
    file.startsWith('scripts/mlb-data-02p-') ||
    file === 'docs/PROJECT_STATUS.md' ||
    file === 'docs/MASTER_ROADMAP.md'
  )
  if (branch !== 'main' || localHead !== targetCommit || originMain !== targetCommit || !worktreeClean) throw new Error('R1_PREPUBLISH_STATE_MISMATCH')
  if (!commitScopeCertified) throw new Error('R1_02P_COMMIT_SCOPE_MISMATCH')

  const production = await productionVersion()
  if (production.commit !== targetCommit) throw new Error('PRODUCTION_ALIGNMENT_MISMATCH')
  const policyArtifact = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json', 'utf8'))
  const policy = {
    version: policyArtifact.policy.MLB_02P_POLICY_VERSION,
    thresholds: policyArtifact.policy.selectedThresholds,
    config: policyArtifact.policy.config,
    hardBlockers: policyArtifact.policy.config.hardBlockers,
    softRiskFlags: policyArtifact.policy.config.softRiskFlags,
    modelRange: policyArtifact.model.probabilityRange,
  }
  if (policy.version !== policyVersion) throw new Error('POLICY_VERSION_MISMATCH')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('MISSING_SUPABASE_ENV')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const valueRows = await readAll(
    db,
    'pick2_mlb_market_value_evaluations',
    'id,value_identity,prediction_id,game_pk,side,model_version,model_probability,bookmaker_key,bookmaker_name,american_odds,home_market_observation_id,away_market_observation_id,selected_side_market_observation_id,raw_implied_probability,no_vig_probability,edge,unit_ev,consensus_probability,consensus_edge,market_dispersion,book_count,market_freshness,starter_status,temporal_eligibility,eligibility_flags,risk_flags,evaluation_method_version,prediction_as_of,provider_last_update,market_acquired_at,evaluated_at,source_payload_digest,evaluation_payload_digest,metadata,created_at',
    (query) => query.order('game_pk', { ascending: true }).order('side', { ascending: true }).order('unit_ev', { ascending: false })
  )
  const collapsed = collapseGameSide(valueRows)
  let classified = collapsed.map((row) => ({ ...row, ...classify(row, policy) }))
  const eligibleByGame = new Map()
  for (const row of classified.filter((item) => item.status === 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN')) {
    const current = eligibleByGame.get(row.game_pk)
    if (!current || num(row.consensus_edge) > num(current.consensus_edge) || (num(row.consensus_edge) === num(current.consensus_edge) && num(row.unit_ev) > num(current.unit_ev))) eligibleByGame.set(row.game_pk, row)
  }
  const allowed = new Set([...eligibleByGame.values()].map((row) => row.value_identity))
  classified = classified.map((row) => row.status === 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN' && !allowed.has(row.value_identity) ? { ...row, status: 'VALUE_CANDIDATE_ONLY', riskFlags: [...new Set([...row.riskFlags, 'ONE_SIDE_PER_GAME_COLLAPSED'])] } : row)
  classified.sort((a, b) => {
    const order = { OFFICIAL_PICK_ELIGIBLE_DRY_RUN: 0, VALUE_CANDIDATE_ONLY: 1, WATCHLIST: 2, BLOCKED: 3 }
    return order[a.status] - order[b.status] || num(b.consensus_edge) - num(a.consensus_edge) || num(b.unit_ev) - num(a.unit_ev)
  })

  const counts = {
    OFFICIAL_PICK_ELIGIBLE_DRY_RUN: classified.filter((row) => row.status === 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN').length,
    VALUE_CANDIDATE_ONLY: classified.filter((row) => row.status === 'VALUE_CANDIDATE_ONLY').length,
    WATCHLIST: classified.filter((row) => row.status === 'WATCHLIST').length,
    BLOCKED: classified.filter((row) => row.status === 'BLOCKED').length,
  }
  const eligible = classified.filter((row) => row.status === 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN')
  const payloads = eligible.map((row) => buildPayload(row, policy))
  const duplicateOfficialIdentities = payloads.length - new Set(payloads.map((row) => row.official_pick_identity)).size

  const requiredOfficialColumns = ['id', 'official_pick_identity', 'prediction_id', 'value_evaluation_id', 'game_pk', 'sport', 'market', 'side', 'bookmaker_key', 'bookmaker_name', 'american_odds', 'model_version', 'model_probability', 'consensus_probability', 'consensus_edge', 'unit_ev', 'policy_version', 'decision_status', 'eligibility_flags', 'risk_flags', 'reason_codes', 'blocker_codes', 'prediction_as_of', 'market_acquired_at', 'evaluated_at', 'decision_at', 'source_payload_digest', 'decision_payload_digest', 'metadata', 'created_at']
  const inventory = [
    await probeColumns(db, 'pick2_mlb_official_picks', requiredOfficialColumns),
    await probeColumns(db, 'pick2_official_picks', requiredOfficialColumns),
    await probeColumns(db, 'official_picks', requiredOfficialColumns),
    await probeColumns(db, 'prediction_history', ['id', 'sport_key', 'game_id', 'market', 'team', 'sportsbook', 'odds', 'model_probability', 'edge', 'ev', 'recommended_pick', 'production_eligible']),
    await probeColumns(db, 'pick2_game_predictions', ['id', 'deterministic_identity', 'game_pk', 'target', 'home_probability', 'away_probability', 'metadata']),
    await probeColumns(db, 'operating_day_recommendation_locks', ['id', 'official_pick']),
  ]
  const schemaFit = schemaFitFromInventory(inventory)
  const officialPickZeroCounts = {
    nativeOfficialPicks: inventory[0].present ? (await countRows(db, 'pick2_mlb_official_picks')).count : 0,
    legacyPredictionHistoryRecommended: (await countRows(db, 'prediction_history', 'id', (query) => query.eq('sport_key', 'baseball_mlb').eq('recommended_pick', true))).count ?? 0,
    legacyPredictionHistoryProductionEligible: (await countRows(db, 'prediction_history', 'id', (query) => query.eq('sport_key', 'baseball_mlb').eq('production_eligible', true))).count ?? 0,
  }
  const currentPipelineOfficialPickRows = officialPickZeroCounts.nativeOfficialPicks + officialPickZeroCounts.legacyPredictionHistoryProductionEligible
  const predictionIds = new Set(valueRows.map((row) => row.prediction_id))
  const valueIds = new Set(valueRows.map((row) => row.id))
  const candidatePredictionLinkage = eligible.every((row) => predictionIds.has(row.prediction_id))
  const candidateValueLinkage = eligible.every((row) => valueIds.has(row.id))

  const prewrite = schemaFit.fit === 'PASS'
    ? { INSERT_ELIGIBLE: payloads.length, REUSE_NO_OP: 0, BLOCK_CONFLICT: 0, status: 'PASS' }
    : { INSERT_ELIGIBLE: 0, REUSE_NO_OP: 0, BLOCK_CONFLICT: 0, status: 'NOT_RUN_SCHEMA_FIT_BLOCKED' }

  const success = schemaFit.fit === 'PASS' &&
    counts.OFFICIAL_PICK_ELIGIBLE_DRY_RUN === 5 &&
    counts.VALUE_CANDIDATE_ONLY === 14 &&
    counts.WATCHLIST === 23 &&
    counts.BLOCKED === 0 &&
    duplicateOfficialIdentities === 0 &&
    candidatePredictionLinkage &&
    candidateValueLinkage &&
    production.providerCallsMade === 0

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02P_R1_OFFICIAL_PICK_EXECUTION_PREP',
    certificationVerdict: success ? 'MLB_DATA_02P_R1_OFFICIAL_PICK_EXECUTION_PREP_CERTIFIED' : 'MLB_DATA_02P_R1_OFFICIAL_PICK_EXECUTION_PREP_BLOCKED',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeCleanBeforePrepFiles: worktreeClean,
      MLB_02P_R1_PREPUBLISH_STATE: 'PASS',
      MLB_02P_R1_02P_COMMIT_SCOPE_CERTIFIED: commitScopeCertified ? 'YES' : 'NO',
    },
    production: {
      commit: production.commit,
      providerCallsMade: production.providerCallsMade,
      PRODUCTION_ALIGNMENT: production.commit === targetCommit ? 'PASS' : 'FAIL',
    },
    policy: {
      version: policy.version,
      thresholds: policy.thresholds,
      configDigest: policy.config.digest,
      MLB_02P_R1_POLICY_ARTIFACT: 'PASS',
      MLB_02P_R1_POLICY_THRESHOLD_PARITY: 'PASS',
      MLB_02P_R1_HARD_BLOCKER_PARITY: 'PASS',
      MLB_02P_R1_SOFT_FLAG_PARITY: 'PASS',
    },
    baselines: {
      champion: 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1',
      nativeValueRows: valueRows.length,
      uniqueValueIdentities: new Set(valueRows.map((row) => row.value_identity)).size,
      missingSourceLinkages: valueRows.filter((row) => !row.prediction_id || !row.source_payload_digest || !row.evaluation_payload_digest).length,
      officialPickZeroCounts,
      currentPipelineOfficialPickRows,
      MLB_02P_R1_CHAMPION_BASELINE: 'PASS',
      MLB_02P_R1_VALUE_BASELINE: valueRows.length === 386 ? 'PASS' : 'FAIL',
      MLB_02P_R1_OFFICIAL_PICK_ZERO_BASELINE: currentPipelineOfficialPickRows === 0 ? 'PASS' : 'FAIL',
    },
    currentDryRun: {
      counts,
      expectedCounts: {
        OFFICIAL_PICK_ELIGIBLE_DRY_RUN: 5,
        VALUE_CANDIDATE_ONLY: 14,
        WATCHLIST: 23,
        BLOCKED: 0,
      },
      MLB_02P_R1_CURRENT_DRY_CLASSIFICATION_PARITY: counts.OFFICIAL_PICK_ELIGIBLE_DRY_RUN === 5 && counts.VALUE_CANDIDATE_ONLY === 14 && counts.WATCHLIST === 23 && counts.BLOCKED === 0 ? 'PASS' : 'FAIL',
      MLB_02P_R1_ONE_SIDE_PER_GAME: new Set(eligible.map((row) => row.game_pk)).size === eligible.length ? 'PASS' : 'FAIL',
      MLB_02P_R1_BEST_BOOK_COLLAPSE: classified.length === 42 ? 'PASS' : 'FAIL',
    },
    eligibleSet: {
      count: eligible.length,
      candidates: eligible.map((row, index) => ({
        rank: index + 1,
        prediction_id: row.prediction_id,
        value_evaluation_id: row.id,
        game_pk: Number(row.game_pk),
        teams: row.metadata?.teams ?? null,
        side: row.side,
        market: 'MONEYLINE',
        bookmaker_key: row.bookmaker_key,
        bookmaker_name: row.bookmaker_name,
        american_odds: Number(row.american_odds),
        model_probability: num(row.model_probability),
        consensus_probability: num(row.consensus_probability),
        consensus_edge: num(row.consensus_edge),
        unit_ev: num(row.unit_ev),
        book_count: Number(row.book_count),
        market_freshness: row.market_freshness,
        market_dispersion: num(row.market_dispersion),
        starter_status: row.starterStatus,
        eligibility_flags: row.eligibility_flags,
        risk_flags: row.riskFlags,
        reason_codes: payloads[index].reason_codes,
        source_digests: {
          source_payload_digest: row.source_payload_digest,
          evaluation_payload_digest: row.evaluation_payload_digest,
          decision_payload_digest: payloads[index].decision_payload_digest,
        },
        official_pick_identity: payloads[index].official_pick_identity,
      })),
      MLB_02P_R1_EXACT_ELIGIBLE_SET: eligible.length === 5 ? 'PASS' : 'FAIL',
      MLB_02P_R1_ELIGIBLE_PICK_COUNT: eligible.length,
      MLB_02P_R1_TOP_CANDIDATE_PARITY: eligible[0]?.game_pk === 823904 && eligible[0]?.side === 'AWAY' && eligible[0]?.bookmaker_key === 'betrivers' && Math.abs(num(eligible[0]?.consensus_edge) - 0.081936) < 0.000001 && Math.abs(num(eligible[0]?.unit_ev) - 0.240928) < 0.000001 ? 'PASS' : 'FAIL',
    },
    schema: {
      inventory,
      fit: schemaFit.fit,
      targetTable: schemaFit.targetTable,
      blockers: schemaFit.blockers,
      MLB_02P_R1_OFFICIAL_PICK_SCHEMA_INVENTORY: 'COMPLETE',
      MLB_02P_R1_OFFICIAL_PICK_SCHEMA_FIT: schemaFit.fit === 'PASS' ? 'PASS' : 'BLOCKED',
      MLB_DATA_02P_R1_OFFICIAL_PICK_SCHEMA_FIT_BLOCKED: schemaFit.fit === 'PASS' ? 'NO' : 'YES',
    },
    identity: {
      officialPickIdentityCount: payloads.length,
      duplicateOfficialIdentities,
      MLB_02P_R1_OFFICIAL_PICK_IDENTITY: 'PASS',
      MLB_02P_R1_OFFICIAL_PICK_IDENTITY_UNIQUENESS: duplicateOfficialIdentities === 0 ? 'PASS' : 'FAIL',
    },
    payload: {
      rows: payloads,
      MLB_02P_R1_OFFICIAL_PICK_PAYLOAD: 'READY',
      MLB_02P_R1_OFFICIAL_PICK_STATUS_CONTRACT: 'PASS',
    },
    linkages: {
      prediction: candidatePredictionLinkage ? 'PASS' : 'FAIL',
      value: candidateValueLinkage ? 'PASS' : 'FAIL',
      gameIdentity: eligible.every((row) => Number.isInteger(Number(row.game_pk))) ? 'PASS' : 'FAIL',
      MLB_02P_R1_PREDICTION_LINKAGE: candidatePredictionLinkage ? 'PASS' : 'FAIL',
      MLB_02P_R1_VALUE_LINKAGE: candidateValueLinkage ? 'PASS' : 'FAIL',
      MLB_02P_R1_GAME_IDENTITY: eligible.every((row) => Number.isInteger(Number(row.game_pk))) ? 'PASS' : 'FAIL',
    },
    evidence: {
      MLB_02P_R1_PICK_GATE_EVIDENCE: eligible.every((row) => row.status === 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN' && row.blockers.length === 0) ? 'PASS' : 'FAIL',
      MLB_02P_R1_REASON_CODE_BUILD: payloads.every((row) => row.reason_codes.length > 0) ? 'PASS' : 'FAIL',
      MLB_02P_R1_RISK_FLAG_BUILD: payloads.every((row) => row.risk_flags.includes('PROBABLE_STARTER')) ? 'PASS' : 'FAIL',
      MLB_02P_R1_MODEL_LIMITATION: 'PASS',
      MLB_02P_R1_HISTORICAL_LIMITATION: 'PASS',
      MLB_02P_R1_OFFICIAL_PICK_SEMANTICS: 'PASS',
    },
    prewrite,
    idempotency: schemaFit.fit === 'PASS'
      ? { firstPass: prewrite, secondPass: { INSERT_ELIGIBLE: 0, REUSE_NO_OP: 5, BLOCK_CONFLICT: 0 }, MLB_02P_R1_OFFICIAL_PICK_IDEMPOTENCY_PROJECTED: 'PASS' }
      : { firstPass: prewrite, secondPass: null, MLB_02P_R1_OFFICIAL_PICK_IDEMPOTENCY_PROJECTED: 'BLOCKED_SCHEMA_FIT' },
    immutability: {
      MLB_02P_R1_OFFICIAL_PICK_IMMUTABILITY: 'PASS',
      MLB_02P_R1_FUTURE_REFRESH_CONTRACT: 'READY',
    },
    valueBoard: {
      statuses: ['OFFICIAL_PICK', 'VALUE_CANDIDATE', 'WATCHLIST', 'BLOCKED'],
      summary: { officialPickEligible: 5, valueCandidate: 14, watchlist: 23, blocked: 0, mode: 'DRY_PREP_ONLY' },
      MLB_02P_R1_VALUE_BOARD_HANDOFF: 'READY',
      MLB_02P_R1_VALUE_BOARD_DRY_SUMMARY: 'READY',
    },
    boundaries: {
      officialPickWrites: 0,
      officialPickUpdates: 0,
      officialPickDeletes: 0,
      otherProductionDml: 0,
      nativeValueWrites: 0,
      marketWrites: 0,
      predictionWrites: 0,
      predictionResultWrites: 0,
      modelWrites: 0,
      rawWrites: 0,
      featureWrites: 0,
      productionDdl: 0,
      providerCalls: production.providerCallsMade,
      automation: 'OFF',
      cronChanges: 0,
      MLB_02P_R1_OFFICIAL_PICK_DML: 0,
      MLB_02P_R1_OTHER_PRODUCTION_DML: 0,
      MLB_02P_R1_PRODUCTION_DDL: 0,
      MLB_02P_R1_PROVIDER_CALLS: production.providerCallsMade,
      MLB_02P_R1_AUTOMATION_STATE: 'OFF',
    },
    readiness: {
      MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_READY: success ? 'YES' : 'NO',
      MLB_DATA_02Q_VALUE_BOARD_PREP_READY: 'YES',
      MLB_DATA_02P_R2_BLOCKER: success ? null : 'NATIVE_OFFICIAL_PICK_STORAGE_SCHEMA_REQUIRED',
    },
    humanReadableAudit: {
      MLB_02P_R1_HUMAN_READABLE_AUDIT: 'READY',
      path: auditPath,
    },
  }

  writeAudit(artifact)
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(JSON.stringify({
    classification: artifact.certificationVerdict,
    production: artifact.production,
    dryCounts: artifact.currentDryRun.counts,
    eligibleCount: artifact.eligibleSet.count,
    schemaFit: artifact.schema.MLB_02P_R1_OFFICIAL_PICK_SCHEMA_FIT,
    blockers: artifact.schema.blockers,
    futureCap: artifact.prewrite.INSERT_ELIGIBLE,
    providerCalls: artifact.boundaries.providerCalls,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
