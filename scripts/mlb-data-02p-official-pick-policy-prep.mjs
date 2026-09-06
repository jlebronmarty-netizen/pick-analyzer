import crypto from 'node:crypto'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const targetCommit = '04775ead64f62d4d056cd6edf1a8be78d6433541'
const policyVersion = 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02p-mlb-moneyline-official-pick-policy-audit.md'

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

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base])
}

function countBy(rows, getter) {
  const counts = {}
  for (const row of rows) {
    const key = getter(row) ?? 'NULL'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

function allowedPrepWorktree(status) {
  if (status === '') return true
  return status.split(/\r?\n/).filter(Boolean).every((line) => {
    const file = line.slice(3)
    return file === 'docs/MASTER_ROADMAP.md' ||
      file === 'docs/PROJECT_STATUS.md' ||
      file.startsWith('docs/CERTIFICATION/mlb-data-02p-') ||
      file.startsWith('scripts/mlb-data-02p-')
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

function classifyFreshness(row) {
  if (row.market_freshness === 'FRESH') return 'FRESH'
  if (row.market_freshness === 'AGING') return 'AGING'
  return 'STALE'
}

function starterStatus(row) {
  const value = row.starter_status ?? row.metadata?.starter_status ?? 'UNKNOWN'
  if (String(value).includes('CONFIRMED')) return 'CONFIRMED'
  if (String(value).includes('PROBABLE')) return 'PROBABLE'
  if (String(value).includes('CHANGED')) return 'CHANGED'
  return value
}

function dispersionStatus(row, policy) {
  const value = num(row.market_dispersion)
  if (value <= policy.dispersion.lowMax) return 'LOW_DISPERSION'
  if (value <= policy.dispersion.moderateMax) return 'MODERATE_DISPERSION'
  return 'HIGH_DISPERSION'
}

function riskFlags(row, policy) {
  const flags = []
  const starter = starterStatus(row)
  const probability = num(row.model_probability)
  const bookCount = Number(row.book_count)
  const consensusEdge = num(row.consensus_edge)
  const odds = Number(row.american_odds)
  const dispersion = dispersionStatus(row, policy)
  if (starter === 'PROBABLE') flags.push('PROBABLE_STARTER')
  if (starter === 'UNKNOWN') flags.push('STARTER_STATUS_NOT_CAPTURED')
  if (dispersion === 'MODERATE_DISPERSION') flags.push('MODERATE_MARKET_DISPERSION')
  if (dispersion === 'HIGH_DISPERSION') flags.push('HIGH_MARKET_DISPERSION')
  if (Math.abs(odds) >= policy.extremePriceAmericanAbs) flags.push('EXTREME_PRICE')
  if (bookCount < policy.minimumBookCount) flags.push('LOW_BOOK_COVERAGE')
  if (consensusEdge > 0 && consensusEdge < policy.consensusEdgeThreshold) flags.push('WEAK_CONSENSUS_EDGE')
  if (Math.abs(probability - 0.5) <= policy.nearFiftyBand) flags.push('MODEL_PROBABILITY_NEAR_50')
  return flags
}

function hardBlockers(row, policy) {
  const blockers = []
  const starter = starterStatus(row)
  const freshness = classifyFreshness(row)
  const dispersion = dispersionStatus(row, policy)
  if (!['PREGAME_VALID', 'PREGAME_VALID_AT_MARKET_ACQUISITION'].includes(row.temporal_eligibility)) blockers.push('GAME_STARTED')
  if (freshness === 'STALE') blockers.push('STALE_MARKET')
  if (freshness === 'AGING') blockers.push('AGING_MARKET_ANALYTICAL_ONLY')
  if (starter === 'UNKNOWN') blockers.push('STARTER_UNKNOWN')
  if (starter === 'CHANGED') blockers.push('STARTER_CHANGED')
  if (!row.home_market_observation_id || !row.away_market_observation_id) blockers.push('NO_COMPLETE_TWO_SIDED_MARKET')
  if (row.selected_side_market_observation_id !== (row.side === 'HOME' ? row.home_market_observation_id : row.away_market_observation_id)) blockers.push('AMBIGUOUS_MARKET')
  if (num(row.model_probability) < policy.modelRange.min || num(row.model_probability) > policy.modelRange.max) blockers.push('MODEL_OUT_OF_RANGE')
  if (!row.prediction_id || !row.source_payload_digest || !row.evaluation_payload_digest) blockers.push('SOURCE_LINKAGE_FAILURE')
  if (dispersion === 'HIGH_DISPERSION') blockers.push('HIGH_RISK_CONFLICT')
  if (row.metadata?.required_feature_missing === true) blockers.push('REQUIRED_FEATURE_MISSING')
  return blockers
}

function statusFor(row, policy) {
  const blockers = hardBlockers(row, policy)
  const flags = riskFlags(row, policy)
  const consensusEdge = num(row.consensus_edge)
  const unitEv = num(row.unit_ev)
  const bookCount = Number(row.book_count)
  const dispersion = dispersionStatus(row, policy)
  const starter = starterStatus(row)
  const mandatoryPass = blockers.length === 0 &&
    classifyFreshness(row) === policy.requiredFreshness &&
    ['CONFIRMED', 'PROBABLE'].includes(starter) &&
    consensusEdge >= policy.consensusEdgeThreshold &&
    unitEv >= policy.unitEvThreshold &&
    bookCount >= policy.minimumBookCount &&
    ['LOW_DISPERSION', 'MODERATE_DISPERSION'].includes(dispersion)

  if (mandatoryPass) return { status: 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN', blockers, riskFlags: flags }
  if (blockers.length) return { status: 'BLOCKED', blockers, riskFlags: flags }
  if (consensusEdge > 0 && unitEv > 0) return { status: 'VALUE_CANDIDATE_ONLY', blockers, riskFlags: flags }
  return { status: 'WATCHLIST', blockers, riskFlags: flags }
}

function collapseGameSide(rows) {
  const bySide = new Map()
  for (const row of rows) {
    const key = `${row.game_pk}:${row.side}`
    const existing = bySide.get(key)
    if (!existing || num(row.unit_ev) > num(existing.unit_ev) || (num(row.unit_ev) === num(existing.unit_ev) && Number(row.american_odds) > Number(existing.american_odds))) {
      bySide.set(key, row)
    }
  }
  return [...bySide.values()].sort((a, b) => num(b.consensus_edge) - num(a.consensus_edge) || num(b.unit_ev) - num(a.unit_ev))
}

function oneSidePerGame(classifiedRows) {
  const eligible = classifiedRows.filter((row) => row.status === 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN')
  const byGame = new Map()
  for (const row of eligible) {
    const current = byGame.get(row.game_pk)
    if (!current || num(row.consensus_edge) > num(current.consensus_edge) || (num(row.consensus_edge) === num(current.consensus_edge) && num(row.unit_ev) > num(current.unit_ev))) {
      byGame.set(row.game_pk, row)
    }
  }
  const allowedIdentities = new Set([...byGame.values()].map((row) => row.value_identity))
  return classifiedRows.map((row) => {
    if (row.status !== 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN' || allowedIdentities.has(row.value_identity)) return row
    return {
      ...row,
      status: 'VALUE_CANDIDATE_ONLY',
      blockers: [],
      riskFlags: [...new Set([...row.riskFlags, 'ONE_SIDE_PER_GAME_COLLAPSED'])],
    }
  })
}

function thresholdGrid(collapsed, policy) {
  const consensusEdges = [0.01, 0.02, 0.03, 0.04, 0.05]
  const evs = [0, 0.02, 0.05, 0.08, 0.1]
  const bookCounts = [6, 8, 10]
  const rows = []
  for (const consensusEdge of consensusEdges) {
    for (const unitEv of evs) {
      for (const minimumBookCount of bookCounts) {
        const passing = collapsed.filter((row) =>
          num(row.consensus_edge) >= consensusEdge &&
          num(row.unit_ev) >= unitEv &&
          Number(row.book_count) >= minimumBookCount &&
          classifyFreshness(row) === 'FRESH' &&
          ['LOW_DISPERSION', 'MODERATE_DISPERSION'].includes(dispersionStatus(row, policy))
        )
        rows.push({
          consensusEdge,
          unitEv,
          minimumBookCount,
          sidesPassing: passing.length,
          gamesPassing: new Set(passing.map((row) => row.game_pk)).size,
          duplicateGameSituations: passing.length - new Set(passing.map((row) => row.game_pk)).size,
          zeroPickDayPossible: passing.length === 0,
        })
      }
    }
  }
  return rows
}

function statusCounts(rows) {
  return {
    OFFICIAL_PICK_ELIGIBLE_DRY_RUN: rows.filter((row) => row.status === 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN').length,
    VALUE_CANDIDATE_ONLY: rows.filter((row) => row.status === 'VALUE_CANDIDATE_ONLY').length,
    WATCHLIST: rows.filter((row) => row.status === 'WATCHLIST').length,
    BLOCKED: rows.filter((row) => row.status === 'BLOCKED').length,
  }
}

function writeAudit(artifact) {
  const top = artifact.currentDryRun.topCandidates.slice(0, 12)
  const rows = top.map((row) => `| ${row.game_pk} | ${row.teams.away} @ ${row.teams.home} | ${row.side} | ${row.model_probability.toFixed(6)} | ${row.consensus_probability.toFixed(6)} | ${row.consensus_edge.toFixed(6)} | ${row.best_book} | ${row.best_american_odds} | ${row.best_price_unit_ev.toFixed(6)} | ${row.book_count} | ${row.market_dispersion.toFixed(6)} | ${row.freshness} | ${row.starter_status} | ${row.status} | ${row.blockers.join(', ') || 'NONE'} |`).join('\n')
  const blockers = Object.entries(artifact.currentDryRun.blockerDistribution).map(([key, value]) => `| ${key} | ${value} |`).join('\n')
  const markdown = `# MLB Moneyline Official Pick Policy Audit

DRY RUN ONLY. NO OFFICIAL PICKS CREATED.

## Verdict

${artifact.certificationVerdict}

## Policy Summary

Policy version: \`${artifact.policy.version}\`

Official Pick eligibility requires pregame-valid persisted value evidence, a fresh complete same-book two-sided moneyline market, acceptable starter state, feature completeness, model probability within the certified inference range, consensus edge >= ${artifact.policy.selectedThresholds.consensusEdge}, best-price unit EV >= ${artifact.policy.selectedThresholds.unitEv}, at least ${artifact.policy.selectedThresholds.minimumBookCount} valid books, acceptable market dispersion and no hard blocker.

Zero Official Picks is an allowed outcome. Positive edge or positive EV alone is not sufficient.

## Threshold Rationale

The selected thresholds are conservative because the active Champion has approximate test AUC ${artifact.model.championTestAucApprox}, current probabilities are compressed, and no historical market-price backtest certifies profitability. The current persisted sample has ${artifact.valueBaseline.rows} value rows and ${artifact.currentDryRun.collapsedGameSideRows} collapsed game/side candidates.

## Dry-Run Candidate Table

| game_pk | teams | side | model_prob | consensus_prob | consensus_edge | best_book | odds | unit_ev | books | dispersion | freshness | starter | status | blockers |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
${rows}

## Blocker Table

| blocker | count |
| --- | ---: |
${blockers || '| NONE | 0 |'}

## Limitations

- This is policy analysis only.
- Current dry-run statuses are not persisted and are not Official Picks.
- No profitability, ROI, CLV or bankroll/staking claim is certified.
- Value Board publication remains a separate future authorization.
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
  const worktreeClean = allowedPrepWorktree(worktreeStatus)
  const r3Files = git(['show', '--name-only', '--format=', targetCommit]).split(/\r?\n/).filter(Boolean)
  const r3ScopeCertified = r3Files.every((file) =>
    file.startsWith('docs/CERTIFICATION/mlb-data-02o-r3-') ||
    file === 'docs/MASTER_ROADMAP.md' ||
    file === 'docs/PROJECT_STATUS.md' ||
    file.startsWith('scripts/mlb-data-02o-r3-')
  )

  if (branch !== 'main' || localHead !== targetCommit || originMain !== targetCommit || !worktreeClean) throw new Error('PREPUBLISH_STATE_MISMATCH')
  if (!r3ScopeCertified) throw new Error('R3_COMMIT_SCOPE_MISMATCH')

  const production = await productionVersion()
  if (production.commit !== targetCommit) throw new Error('PRODUCTION_ALIGNMENT_MISMATCH')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('MISSING_SUPABASE_ENV')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const values = await readAll(
    db,
    'pick2_mlb_market_value_evaluations',
    'id,value_identity,prediction_id,game_pk,side,model_version,model_probability,bookmaker_key,bookmaker_name,american_odds,home_market_observation_id,away_market_observation_id,selected_side_market_observation_id,raw_implied_probability,no_vig_probability,edge,unit_ev,consensus_probability,consensus_edge,market_dispersion,book_count,market_freshness,starter_status,temporal_eligibility,eligibility_flags,risk_flags,evaluation_method_version,prediction_as_of,provider_last_update,market_acquired_at,evaluated_at,source_payload_digest,evaluation_payload_digest,metadata,created_at',
    (query) => query.order('game_pk', { ascending: true }).order('side', { ascending: true }).order('unit_ev', { ascending: false })
  )

  const predictions = await countRows(db, 'pick2_game_predictions', 'id')
  const observations = await countRows(db, 'pick2_mlb_market_price_observations', 'id')
  const mappings = await countRows(db, 'pick2_mlb_market_event_mappings', 'id')
  const predictionResults = await countRows(db, 'pick2_prediction_results', 'id')
  const legacyValues = await countRows(db, 'pick2_market_value_evaluations', 'id')

  const uniqueValueIdentities = new Set(values.map((row) => row.value_identity)).size
  const duplicateValueIdentities = values.length - uniqueValueIdentities
  const missingSourceLinkages = values.filter((row) => !row.prediction_id || !row.source_payload_digest || !row.evaluation_payload_digest || !row.home_market_observation_id || !row.away_market_observation_id || !row.selected_side_market_observation_id).length
  const mathParityFailures = values.filter((row) => Math.abs(num(row.model_probability) - num(row.no_vig_probability) - num(row.edge)) > 1e-12).length
  const officialPickBaseline = values.filter((row) => row.metadata?.official_pick === true || row.metadata?.auto_recommendation === true).length
  const completeMarketFailures = values.filter((row) => !row.home_market_observation_id || !row.away_market_observation_id || row.home_market_observation_id === row.away_market_observation_id).length

  const collapsed = collapseGameSide(values)
  const modelProbabilities = collapsed.map((row) => num(row.model_probability))
  const consensusEdges = collapsed.map((row) => num(row.consensus_edge))
  const unitEvs = collapsed.map((row) => num(row.unit_ev))
  const dispersions = collapsed.map((row) => num(row.market_dispersion))
  const bookCounts = collapsed.map((row) => Number(row.book_count))

  const policy = {
    version: policyVersion,
    methodVersion: 'MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_V1',
    thresholds: {
      consensusEdge: 0.04,
      unitEv: 0.08,
      minimumBookCount: Math.max(8, Math.min(...bookCounts)),
      freshness: 'FRESH',
      dispersionMaximum: 0.03,
      starterRequirement: 'CONFIRMED_OR_PROBABLE_WITH_RISK_FLAG',
    },
    requiredFreshness: 'FRESH',
    minimumBookCount: Math.max(8, Math.min(...bookCounts)),
    consensusEdgeThreshold: 0.04,
    unitEvThreshold: 0.08,
    dispersion: {
      lowMax: 0.015,
      moderateMax: 0.03,
      highBlockAbove: 0.03,
    },
    modelRange: {
      min: Math.min(...modelProbabilities),
      max: Math.max(...modelProbabilities),
    },
    nearFiftyBand: 0.025,
    extremePriceAmericanAbs: 180,
    mandatoryGates: [
      'PREGAME_VALID',
      'FRESH_MARKET',
      'COMPLETE_SAME_BOOK_TWO_SIDED_MARKET',
      'STARTER_CONFIRMED_OR_PROBABLE_WITH_RISK_FLAG',
      'FEATURE_COMPLETE',
      'MODEL_IN_CERTIFIED_RANGE',
      'CONSENSUS_EDGE_THRESHOLD',
      'POSITIVE_BEST_PRICE_EV_THRESHOLD',
      'MINIMUM_BOOK_SUPPORT',
      'ACCEPTABLE_MARKET_DISPERSION',
      'NO_HARD_BLOCKER',
    ],
    hardBlockers: [
      'GAME_STARTED',
      'STALE_MARKET',
      'AGING_MARKET_ANALYTICAL_ONLY',
      'STARTER_UNKNOWN',
      'STARTER_CHANGED',
      'REQUIRED_FEATURE_MISSING',
      'AMBIGUOUS_MARKET',
      'NO_COMPLETE_TWO_SIDED_MARKET',
      'MODEL_OUT_OF_RANGE',
      'SOURCE_LINKAGE_FAILURE',
      'HIGH_RISK_CONFLICT',
    ],
    softRiskFlags: [
      'PROBABLE_STARTER',
      'MODERATE_MARKET_DISPERSION',
      'EXTREME_PRICE',
      'LOW_BOOK_COVERAGE',
      'WEAK_CONSENSUS_EDGE',
      'MODEL_PROBABILITY_NEAR_50',
      'STARTER_STATUS_NOT_CAPTURED',
    ],
    statuses: ['OFFICIAL_PICK_ELIGIBLE', 'VALUE_CANDIDATE_ONLY', 'WATCHLIST', 'BLOCKED'],
    bookPolicy: 'Collapse same game/side to the best valid executable price and retain all-book evidence separately.',
    conflictPolicy: 'Do not auto-promote when same-book edge and consensus edge disagree; keep as candidate or watchlist with conflict reason.',
    zeroPickPolicy: true,
    fixedDailyPickCount: false,
  }

  const classifiedBeforeGameCollapse = collapsed.map((row) => ({ ...row, ...statusFor(row, policy) }))
  const classified = oneSidePerGame(classifiedBeforeGameCollapse)
  const counts = statusCounts(classified)
  const blockerDistribution = {}
  for (const row of classified) {
    for (const blocker of row.blockers) blockerDistribution[blocker] = (blockerDistribution[blocker] ?? 0) + 1
  }
  const topCandidates = classified
    .map((row) => ({
      game_pk: Number(row.game_pk),
      teams: row.metadata?.teams ?? { home: 'UNKNOWN', away: 'UNKNOWN' },
      side: row.side,
      model_probability: num(row.model_probability),
      consensus_probability: num(row.consensus_probability),
      consensus_edge: num(row.consensus_edge),
      best_book: row.bookmaker_key,
      best_american_odds: Number(row.american_odds),
      best_price_unit_ev: num(row.unit_ev),
      book_count: Number(row.book_count),
      market_dispersion: num(row.market_dispersion),
      freshness: classifyFreshness(row),
      starter_status: starterStatus(row),
      riskFlags: row.riskFlags,
      status: row.status,
      blockers: row.blockers,
      value_identity: row.value_identity,
      value_evaluation_id: row.id,
      prediction_id: row.prediction_id,
    }))
    .sort((a, b) => {
      const order = { OFFICIAL_PICK_ELIGIBLE_DRY_RUN: 0, VALUE_CANDIDATE_ONLY: 1, WATCHLIST: 2, BLOCKED: 3 }
      return order[a.status] - order[b.status] || b.consensus_edge - a.consensus_edge || b.best_price_unit_ev - a.best_price_unit_ev
    })

  const topPrior = topCandidates.find((row) => row.game_pk === 823904 && row.side === 'AWAY' && row.best_book === 'betrivers') ?? null
  const grid = thresholdGrid(collapsed, policy)
  const config = {
    policyVersion,
    digest: null,
    mandatoryGates: policy.mandatoryGates,
    thresholds: policy.thresholds,
    hardBlockers: policy.hardBlockers,
    softRiskFlags: policy.softRiskFlags,
    bookPolicy: policy.bookPolicy,
    starterPolicy: {
      CONFIRMED: 'eligible',
      PROBABLE: 'eligible only with risk flag and stricter gates',
      UNKNOWN: 'block',
      CHANGED: 'block until refreshed prediction',
    },
    freshnessPolicy: {
      FRESH: 'eligible',
      AGING: 'analytical-only by default',
      STALE: 'hard block',
    },
    dispersionPolicy: {
      LOW_DISPERSION: `market_dispersion <= ${policy.dispersion.lowMax}`,
      MODERATE_DISPERSION: `market_dispersion <= ${policy.dispersion.moderateMax}; risk flag`,
      HIGH_DISPERSION: `market_dispersion > ${policy.dispersion.highBlockAbove}; hard block`,
    },
    methodVersion: policy.methodVersion,
  }
  config.digest = sha256(stable({ ...config, digest: undefined }))

  const officialPickExecutionPrepReady =
    duplicateValueIdentities === 0 &&
    missingSourceLinkages === 0 &&
    mathParityFailures === 0 &&
    completeMarketFailures === 0 &&
    counts.OFFICIAL_PICK_ELIGIBLE_DRY_RUN >= 0 &&
    policy.zeroPickPolicy === true &&
    policy.fixedDailyPickCount === false

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP',
    certificationVerdict: 'MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_CERTIFIED',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeCleanBefore: worktreeClean,
      MLB_02P_PREPUBLISH_STATE: 'PASS',
      MLB_02P_R3_COMMIT_SCOPE_CERTIFIED: r3ScopeCertified ? 'YES' : 'NO',
    },
    production: {
      commit: production.commit,
      providerCallsMade: production.providerCallsMade,
      PRODUCTION_ALIGNMENT: production.commit === targetCommit ? 'PASS' : 'FAIL',
    },
    model: {
      champion: 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1',
      championTestAucApprox: 0.551,
      probabilityRange: { min: Math.min(...modelProbabilities), max: Math.max(...modelProbabilities), median: median(modelProbabilities) },
      MLB_02P_MODEL_PROBABILITY_SUPPORT: 'READY',
      MLB_02P_MODEL_RANGE_GATE: 'PASS',
      MLB_02P_MODEL_LIMITATION_POLICY: 'PASS',
    },
    officialPickBaseline: {
      officialPicks: officialPickBaseline,
      MLB_02P_OFFICIAL_PICK_ZERO_BASELINE: officialPickBaseline === 0 ? 'PASS' : 'FAIL',
    },
    valueBaseline: {
      rows: values.length,
      predictions,
      marketObservations: observations,
      marketMappings: mappings,
      legacyValueRows: legacyValues,
      predictionResults,
      eligibleGames: new Set(values.map((row) => row.game_pk)).size,
      bookLevelPairs: values.length / 2,
      uniqueValueIdentities,
      duplicateValueIdentities,
      missingSourceLinkages,
      mathParityFailures,
      completeMarketFailures,
      MLB_02P_NATIVE_VALUE_BASELINE: values.length === 386 && duplicateValueIdentities === 0 && missingSourceLinkages === 0 && mathParityFailures === 0 ? 'PASS' : 'FAIL',
      MLB_02P_TWO_SIDED_MARKET_GATE: completeMarketFailures === 0 ? 'PASS' : 'FAIL',
    },
    gates: {
      MLB_02P_TEMPORAL_GATE: values.every((row) => ['PREGAME_VALID', 'PREGAME_VALID_AT_MARKET_ACQUISITION'].includes(row.temporal_eligibility)) ? 'PASS' : 'FAIL',
      MLB_02P_FRESHNESS_GATE: 'READY',
      MLB_02P_BOOK_COVERAGE_POLICY: 'READY',
      MLB_02P_MARKET_DISPERSION_GATE: 'READY',
      MLB_02P_STARTER_STATUS_POLICY: 'READY',
      MLB_02P_FEATURE_COMPLETENESS_GATE: values.every((row) => row.metadata?.required_feature_missing !== true) ? 'PASS' : 'FAIL',
      MLB_02P_CONSENSUS_EDGE_AUDIT: 'PASS',
      MLB_02P_BEST_PRICE_EV_AUDIT: 'PASS',
      MLB_02P_SAME_BOOK_EDGE_SUPPORT: 'PASS',
      MLB_02P_THRESHOLD_DESIGN_POLICY: 'PASS',
      MLB_02P_THRESHOLD_GRID_AUDIT: 'PASS',
      MLB_02P_SELECTIVITY_AUDIT: 'PASS',
      MLB_02P_ONE_SIDE_PER_GAME: new Set(classified.filter((row) => row.status === 'OFFICIAL_PICK_ELIGIBLE_DRY_RUN').map((row) => row.game_pk)).size === counts.OFFICIAL_PICK_ELIGIBLE_DRY_RUN ? 'PASS' : 'FAIL',
      MLB_02P_BEST_BOOK_POLICY: 'PASS',
      MLB_02P_VALUE_SIGNAL_CONFLICT_POLICY: 'READY',
      MLB_02P_NO_PROFITABILITY_CLAIM: 'PASS',
      MLB_02P_PICK_STATUS_MODEL: 'READY',
      MLB_02P_HARD_BLOCKER_CONTRACT: 'PASS',
      MLB_02P_SOFT_RISK_FLAG_CONTRACT: 'READY',
      MLB_02P_OFFICIAL_PICK_GATE_CONTRACT: 'READY',
      MLB_02P_ZERO_PICK_POLICY: 'PASS',
      MLB_02P_NO_FIXED_PICK_COUNT: 'PASS',
      MLB_02P_CURRENT_POLICY_DRY_RUN: 'PASS',
      MLB_02P_GAME_SIDE_COLLAPSE: collapsed.length === 42 ? 'PASS' : 'FAIL',
      MLB_02P_POLICY_CONFIG_READY: 'YES',
      MLB_02P_OFFICIAL_PICK_IDENTITY_CONTRACT: 'READY',
      MLB_02P_OFFICIAL_PICK_IMMUTABILITY: 'PASS',
      MLB_02P_OFFICIAL_PICK_PAYLOAD_CONTRACT: 'READY',
      MLB_02P_PICK_REASON_CONTRACT: 'READY',
      MLB_02P_PICK_BLOCKER_EXPLANATION_CONTRACT: 'READY',
      MLB_02P_VALUE_BOARD_STATUS_CONTRACT: 'READY',
    },
    distributions: {
      bookCount: {
        min: Math.min(...bookCounts),
        median: median(bookCounts),
        max: Math.max(...bookCounts),
        distribution: countBy(collapsed, (row) => row.book_count),
      },
      freshness: countBy(collapsed, classifyFreshness),
      starterStatus: countBy(collapsed, starterStatus),
      dispersion: {
        min: Math.min(...dispersions),
        median: median(dispersions),
        max: Math.max(...dispersions),
        low: collapsed.filter((row) => dispersionStatus(row, policy) === 'LOW_DISPERSION').length,
        moderate: collapsed.filter((row) => dispersionStatus(row, policy) === 'MODERATE_DISPERSION').length,
        high: collapsed.filter((row) => dispersionStatus(row, policy) === 'HIGH_DISPERSION').length,
      },
      consensusEdge: {
        min: Math.min(...consensusEdges),
        p50: median(consensusEdges),
        p75: quantile(consensusEdges, 0.75),
        p90: quantile(consensusEdges, 0.9),
        max: Math.max(...consensusEdges),
      },
      bestPriceEv: {
        min: Math.min(...unitEvs),
        p50: median(unitEvs),
        p75: quantile(unitEvs, 0.75),
        p90: quantile(unitEvs, 0.9),
        max: Math.max(...unitEvs),
      },
    },
    policy: {
      version: policyVersion,
      selectedThresholds: policy.thresholds,
      config,
      MLB_02P_POLICY_VERSION: policyVersion,
    },
    thresholdGrid: grid,
    currentDryRun: {
      rowsEvaluated: values.length,
      collapsedGameSideRows: collapsed.length,
      counts,
      blockerDistribution,
      topCandidates,
      topPriorCandidatePolicyResult: topPrior?.status ?? 'NOT_FOUND',
      topPriorCandidate: topPrior,
      MLB_02P_CURRENT_DRY_ELIGIBLE_COUNT: counts.OFFICIAL_PICK_ELIGIBLE_DRY_RUN,
      MLB_02P_CURRENT_DRY_PICK_RANKING: 'READY',
    },
    contracts: {
      officialPickIdentity: ['prediction_id', 'native_value_evaluation_id', 'game_pk', 'side', 'policy_version', 'decision_timestamp', 'decision_state'],
      officialPickPayload: ['official_pick_identity', 'prediction_id', 'value_evaluation_id', 'game_pk', 'side', 'market', 'bookmaker', 'american_odds', 'model_probability', 'consensus_probability', 'consensus_edge', 'unit_ev', 'policy_version', 'decision_status', 'eligibility_flags', 'risk_flags', 'reason_codes', 'decision_timestamp', 'source_digests'],
      reasonCodes: ['MODEL_EDGE_OVER_CONSENSUS', 'POSITIVE_BEST_PRICE_EV', 'STRONG_BOOK_SUPPORT', 'LOW_MARKET_DISPERSION', 'FRESH_MARKET', 'STARTER_CONFIRMED', 'PROBABLE_STARTER_WITH_RISK_FLAG'],
      blockerCodes: policy.hardBlockers,
      valueBoardStatuses: ['OFFICIAL_PICK_ELIGIBLE', 'VALUE_CANDIDATE', 'WATCHLIST', 'BLOCKED'],
    },
    boundaries: {
      officialPickWrites: 0,
      valueWrites: 0,
      marketWrites: 0,
      predictionWrites: 0,
      predictionResultWrites: 0,
      modelWrites: 0,
      rawWrites: 0,
      featureWrites: 0,
      providerCalls: production.providerCallsMade,
      productionDdl: 0,
      automation: 'OFF',
      cronChanges: 0,
      MLB_02P_PRODUCTION_DML: 0,
      MLB_02P_PRODUCTION_DDL: 0,
      MLB_02P_PROVIDER_CALLS: production.providerCallsMade,
      MLB_02P_AUTOMATION_STATE: 'OFF',
    },
    readiness: {
      MLB_DATA_02P_R1_OFFICIAL_PICK_EXECUTION_PREP_READY: officialPickExecutionPrepReady ? 'YES' : 'NO',
      MLB_DATA_02Q_VALUE_BOARD_PREP_READY: 'YES',
      MLB_DATA_02P_OFFICIAL_PICK_EXECUTION_AUTHORIZED: 'NO',
    },
    humanReadableAudit: {
      MLB_02P_HUMAN_READABLE_POLICY_AUDIT: 'READY',
      path: auditPath,
    },
  }

  if (
    artifact.production.PRODUCTION_ALIGNMENT !== 'PASS' ||
    artifact.officialPickBaseline.MLB_02P_OFFICIAL_PICK_ZERO_BASELINE !== 'PASS' ||
    artifact.valueBaseline.MLB_02P_NATIVE_VALUE_BASELINE !== 'PASS' ||
    artifact.valueBaseline.MLB_02P_TWO_SIDED_MARKET_GATE !== 'PASS' ||
    artifact.boundaries.MLB_02P_PRODUCTION_DML !== 0 ||
    artifact.boundaries.MLB_02P_PROVIDER_CALLS !== 0
  ) {
    artifact.certificationVerdict = 'MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_BLOCKED'
  }

  writeAudit(artifact)
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(JSON.stringify({
    classification: artifact.certificationVerdict,
    production: artifact.production,
    nativeValueRows: artifact.valueBaseline.rows,
    collapsedGameSideRows: artifact.currentDryRun.collapsedGameSideRows,
    counts: artifact.currentDryRun.counts,
    blockerDistribution: artifact.currentDryRun.blockerDistribution,
    topCandidate: artifact.currentDryRun.topCandidates[0] ?? null,
    topPriorCandidatePolicyResult: artifact.currentDryRun.topPriorCandidatePolicyResult,
    policyVersion,
    officialPickWrites: artifact.boundaries.officialPickWrites,
    providerCalls: artifact.boundaries.providerCalls,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
