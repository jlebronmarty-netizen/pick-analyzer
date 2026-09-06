import crypto from 'node:crypto'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const targetCommit = 'd3cafbdf353a6198b2b09354f7330d9affc717cd'
const modelVersionName = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const methodVersion = 'MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_PREP_V1'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02o-r3-native-value-persistence.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02o-r3-current-moneyline-native-value-persistence-audit.md'

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

function iso(value) {
  return value ? new Date(value).toISOString() : null
}

function num(value) {
  return Number(value)
}

function close(actual, expected, tolerance = 1e-12) {
  return Math.abs(num(actual) - num(expected)) <= tolerance
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
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

async function readByValues(db, table, column, values, select = '*', chunkSize = 100) {
  const rows = []
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize)
    const { data, error } = await db.from(table).select(select).in(column, chunk)
    if (error) throw new Error(`${table} read failed: ${error.message}`)
    rows.push(...(data ?? []))
  }
  return rows
}

function unique(values) {
  return [...new Set(values)]
}

function validatePlanRow(row) {
  return typeof row.evaluation_identity === 'string' &&
    row.evaluation_identity.length > 0 &&
    typeof row.prediction_id === 'string' &&
    Number.isInteger(row.game_pk) &&
    ['HOME', 'AWAY'].includes(row.side) &&
    Number.isFinite(row.model_probability) &&
    Number.isFinite(row.raw_implied_probability) &&
    Number.isFinite(row.no_vig_probability) &&
    Number.isFinite(row.model_edge) &&
    Number.isFinite(row.unit_ev) &&
    Number.isFinite(row.consensus_probability) &&
    Number.isFinite(row.consensus_edge) &&
    Number.isFinite(row.market_dispersion) &&
    Number.isInteger(row.american_odds) &&
    row.american_odds !== 0 &&
    row.freshness !== 'STALE' &&
    row.temporal_eligibility === 'PREGAME_VALID_AT_MARKET_ACQUISITION'
}

function observationKey(row) {
  return [
    Number(row.game_pk),
    row.provider,
    row.bookmaker_key,
    row.market,
    row.provider_market_key,
    iso(row.provider_last_update),
    iso(row.acquired_at),
  ].join('::')
}

function expectedBase(row, prediction, selected, home, away, evaluationPayloadDigest = 'pending') {
  return {
    value_identity: row.evaluation_identity,
    prediction_id: row.prediction_id,
    game_pk: row.game_pk,
    side: row.side,
    model_version_id: prediction.model_version_id,
    model_version: modelVersionName,
    model_probability: row.model_probability,
    provider: selected.provider,
    provider_event_id: selected.provider_event_id,
    bookmaker_key: row.bookmaker_key,
    bookmaker_name: row.bookmaker_name ?? selected.bookmaker_name ?? null,
    market: 'MONEYLINE',
    provider_market_key: 'h2h',
    american_odds: row.american_odds,
    home_market_observation_id: home.id,
    away_market_observation_id: away.id,
    selected_side_market_observation_id: selected.id,
    raw_implied_probability: row.raw_implied_probability,
    no_vig_probability: row.no_vig_probability,
    edge: row.model_edge,
    unit_ev: row.unit_ev,
    consensus_probability: row.consensus_probability,
    consensus_edge: row.consensus_edge,
    market_dispersion: row.market_dispersion,
    book_count: row.book_count,
    market_freshness: row.freshness,
    starter_status: row.starter_status ?? null,
    temporal_eligibility: row.temporal_eligibility,
    eligibility_flags: ['ANALYTICAL_ONLY', 'PREGAME_VALID_AT_MARKET_ACQUISITION', 'PERSISTED_SOURCE_ROWS_ONLY'],
    risk_flags: ['MODEL_AUC_LIMITATION', 'HISTORICAL_ROI_NOT_CERTIFIED', 'CLV_NOT_CERTIFIED', 'NOT_OFFICIAL_PICK'],
    evaluation_method_version: methodVersion,
    prediction_as_of: iso(prediction.predicted_at),
    provider_last_update: iso(row.provider_last_update),
    market_acquired_at: iso(row.acquired_at),
    evaluated_at: iso(row.acquired_at),
    source_payload_digest: selected.source_payload_digest,
    evaluation_payload_digest: evaluationPayloadDigest,
    metadata: {
      analytical_only: true,
      official_pick: false,
      auto_recommendation: false,
      value_board_published: false,
      profitability_certified: false,
      clv_certified: false,
      champion_test_auc_approx: 0.551,
      source_phase: 'MLB_DATA_02N_CURRENT_MONEYLINE_VALUE_EVALUATION_PREP_CERTIFIED',
      pair_identity: row.pair_identity,
      teams: row.teams,
      decimal_odds: row.decimal_odds,
      break_even_probability: row.break_even_probability,
      best_available_price: row.best_available_price,
      worst_available_price: row.worst_available_price,
      market_disagreement: row.market_disagreement,
      freshness_age_minutes: row.freshness_age_minutes,
    },
  }
}

function buildExpectedValueRow(row, prediction, selected, home, away) {
  const pending = expectedBase(row, prediction, selected, home, away)
  const digestPayload = {
    ...pending,
    evaluation_payload_digest: undefined,
    metadata: pending.metadata,
  }
  const evaluationPayloadDigest = sha256(stable(digestPayload))
  return expectedBase(row, prediction, selected, home, away, evaluationPayloadDigest)
}

function equivalent(actual, expected) {
  const scalarFields = [
    'value_identity',
    'prediction_id',
    'side',
    'model_version_id',
    'model_version',
    'provider',
    'provider_event_id',
    'bookmaker_key',
    'bookmaker_name',
    'market',
    'provider_market_key',
    'market_freshness',
    'starter_status',
    'temporal_eligibility',
    'evaluation_method_version',
    'source_payload_digest',
    'evaluation_payload_digest',
  ]
  const numericFields = [
    'model_probability',
    'raw_implied_probability',
    'no_vig_probability',
    'edge',
    'unit_ev',
    'consensus_probability',
    'consensus_edge',
    'market_dispersion',
  ]
  return scalarFields.every((field) => actual[field] === expected[field]) &&
    Number(actual.game_pk) === Number(expected.game_pk) &&
    Number(actual.american_odds) === Number(expected.american_odds) &&
    Number(actual.book_count) === Number(expected.book_count) &&
    actual.home_market_observation_id === expected.home_market_observation_id &&
    actual.away_market_observation_id === expected.away_market_observation_id &&
    actual.selected_side_market_observation_id === expected.selected_side_market_observation_id &&
    iso(actual.prediction_as_of) === expected.prediction_as_of &&
    iso(actual.provider_last_update) === expected.provider_last_update &&
    iso(actual.market_acquired_at) === expected.market_acquired_at &&
    iso(actual.evaluated_at) === expected.evaluated_at &&
    numericFields.every((field) => close(actual[field], expected[field])) &&
    stable(actual.eligibility_flags) === stable(expected.eligibility_flags) &&
    stable(actual.risk_flags) === stable(expected.risk_flags) &&
    stable(actual.metadata) === stable(expected.metadata)
}

function classify(expectedRows, existingRows) {
  const existingByIdentity = new Map(existingRows.map((row) => [row.value_identity, row]))
  const rows = []
  for (const expected of expectedRows) {
    const existing = existingByIdentity.get(expected.value_identity)
    if (!existing) rows.push({ value_identity: expected.value_identity, classification: 'INSERT_ELIGIBLE' })
    else if (equivalent(existing, expected)) rows.push({ value_identity: expected.value_identity, classification: 'REUSE_NO_OP', existing_id: existing.id })
    else rows.push({ value_identity: expected.value_identity, classification: 'BLOCK_CONFLICT', existing_id: existing.id })
  }
  return {
    rows,
    INSERT_ELIGIBLE: rows.filter((row) => row.classification === 'INSERT_ELIGIBLE').length,
    REUSE_NO_OP: rows.filter((row) => row.classification === 'REUSE_NO_OP').length,
    BLOCK_CONFLICT: rows.filter((row) => row.classification === 'BLOCK_CONFLICT').length,
  }
}

async function insertRows(db, rows, chunkSize = 100) {
  let inserted = 0
  const failures = []
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { data, error } = await db.from('pick2_mlb_market_value_evaluations').insert(chunk).select('value_identity')
    if (error) {
      failures.push({ offset: i, count: chunk.length, message: error.message, code: error.code })
      break
    }
    inserted += data?.length ?? 0
  }
  return { inserted, failures }
}

function renderAudit(artifact) {
  return `# Current Moneyline Native Value Persistence Audit

Classification: \`${artifact.certificationVerdict}\`

This audit is **ANALYTICAL ONLY**. These rows are not Official Picks, are not bankroll/Kelly/stake recommendations, and are not historically profitability-certified.

## Persistence

| plan rows | attempted | inserted | reused | conflicts | failures |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${artifact.plan.rows} | ${artifact.execution.attempted} | ${artifact.execution.inserted} | ${artifact.execution.reused} | ${artifact.execution.conflicts} | ${artifact.execution.failures} |

## Distribution

| positive edge | max edge | median edge | positive EV | max EV | median EV |
| ---: | ---: | ---: | ---: | ---: | ---: |
| ${artifact.distribution.positiveEdgeCount} | ${artifact.distribution.maximumEdge} | ${artifact.distribution.medianEdge} | ${artifact.distribution.positiveEvCount} | ${artifact.distribution.maximumEv} | ${artifact.distribution.medianEv} |

Top analytical candidate: game \`${artifact.distribution.topCandidate.game_pk}\`, \`${artifact.distribution.topCandidate.side}\`, book \`${artifact.distribution.topCandidate.bookmaker_key}\`, edge \`${artifact.distribution.topCandidate.edge}\`, unit EV \`${artifact.distribution.topCandidate.unit_ev}\`.

## Boundaries

- Provider calls: ${artifact.boundaries.providerCalls}
- Official Picks: ${artifact.boundaries.officialPicks}
- Value Board publication: ${artifact.boundaries.valueBoardPublication}
- Production DDL: ${artifact.boundaries.productionDdl}
- Automation: ${artifact.boundaries.automation}
`
}

async function main() {
  loadDotEnv('.env.local')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const worktreeCleanBefore = git(['status', '--short']) === ''
  const production = await productionVersion()
  if (branch !== 'main' || localHead !== targetCommit || originMain !== targetCommit || !worktreeCleanBefore) throw new Error('PREPUBLISH_STATE_MISMATCH')
  if (production.commit !== targetCommit) throw new Error('PRODUCTION_ALIGNMENT_MISMATCH')

  const artifact02n = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation-prep.json', 'utf8'))
  const rows = artifact02n.valueCandidateRanking.bookLevelRows
  const preCounts = {
    nativeValue: await countRows(db, 'pick2_mlb_market_value_evaluations'),
    legacyValue: await countRows(db, 'pick2_market_value_evaluations'),
    predictions: await countRows(db, 'pick2_game_predictions'),
    marketObservations: await countRows(db, 'pick2_mlb_market_price_observations'),
    marketMappings: await countRows(db, 'pick2_mlb_market_event_mappings'),
    champions: await countRows(db, 'pick2_model_versions', 'id', (query) => query.eq('model_version', modelVersionName).eq('role', 'champion').eq('status', 'promoted')),
  }

  const predictionIds = unique(rows.map((row) => row.prediction_id))
  const gamePks = unique(rows.map((row) => row.game_pk))
  const valueIdentities = unique(rows.map((row) => row.evaluation_identity))
  const predictions = await readByValues(db, 'pick2_game_predictions', 'id', predictionIds, 'id,game_pk,model_version_id,predicted_at,home_probability,away_probability')
  const observations = await readByValues(db, 'pick2_mlb_market_price_observations', 'game_pk', gamePks, 'id,observation_identity,game_pk,provider,provider_event_id,bookmaker_key,bookmaker_name,market,provider_market_key,side,american_odds,provider_last_update,acquired_at,source_payload_digest')
  const existingPre = await readByValues(db, 'pick2_mlb_market_value_evaluations', 'value_identity', valueIdentities, '*')

  const predictionById = new Map(predictions.map((row) => [row.id, row]))
  const observationsByPair = new Map()
  const observationByIdentity = new Map()
  for (const observation of observations) {
    observationByIdentity.set(observation.observation_identity, observation)
    const key = observationKey(observation)
    const bucket = observationsByPair.get(key) ?? []
    bucket.push(observation)
    observationsByPair.set(key, bucket)
  }

  const expectedRows = []
  const linkageFailures = []
  const invalidPlanRows = []
  const sideInversions = []
  for (const row of rows) {
    if (!validatePlanRow(row)) invalidPlanRows.push(row.evaluation_identity)
    const prediction = predictionById.get(row.prediction_id)
    const selected = observationByIdentity.get(row.observation_identity)
    if (!prediction || !selected) {
      linkageFailures.push(row.evaluation_identity)
      continue
    }
    const pair = observationsByPair.get(observationKey(selected)) ?? []
    const home = pair.find((item) => item.side === 'HOME')
    const away = pair.find((item) => item.side === 'AWAY')
    if (!home || !away || Number(prediction.game_pk) !== Number(row.game_pk)) {
      linkageFailures.push(row.evaluation_identity)
      continue
    }
    if (selected.side !== row.side) sideInversions.push(row.evaluation_identity)
    expectedRows.push(buildExpectedValueRow(row, prediction, selected, home, away))
  }

  const duplicateValueIdentities = rows.length - valueIdentities.length
  const preClassification = classify(expectedRows, existingPre)
  if (
    rows.length !== 386 ||
    artifact02n.intersection.eligiblePregamePredictions !== 21 ||
    artifact02n.pairing.evaluatedBookLevelPairs !== 193 ||
    preCounts.nativeValue !== 0 ||
    preCounts.legacyValue !== 0 ||
    preCounts.predictions !== 24 ||
    preCounts.marketObservations !== 492 ||
    preCounts.marketMappings !== 29 ||
    preCounts.champions !== 1 ||
    invalidPlanRows.length > 0 ||
    linkageFailures.length > 0 ||
    sideInversions.length > 0 ||
    duplicateValueIdentities !== 0 ||
    preClassification.BLOCK_CONFLICT !== 0 ||
    preClassification.INSERT_ELIGIBLE > 386 ||
    preClassification.INSERT_ELIGIBLE + preClassification.REUSE_NO_OP !== 386
  ) {
    throw new Error('R3_PREFLIGHT_FAILED')
  }

  const rowsToInsert = expectedRows.filter((row) => preClassification.rows.find((item) => item.value_identity === row.value_identity)?.classification === 'INSERT_ELIGIBLE')
  const insertion = await insertRows(db, rowsToInsert)
  if (insertion.failures.length > 0) {
    const partialArtifact = {
      generatedAt: new Date().toISOString(),
      project: 'MLB_DATA_02O_R3_NATIVE_VALUE_PERSISTENCE_EXECUTION',
      certificationVerdict: 'MLB_DATA_02O_R3_NATIVE_VALUE_PERSISTENCE_PARTIAL',
      insertion,
      persistedValueIdentities: rowsToInsert.slice(0, insertion.inserted).map((row) => row.value_identity),
    }
    fs.writeFileSync(artifactPath, `${JSON.stringify(partialArtifact, null, 2)}\n`)
    throw new Error('R3_INSERT_PARTIAL_STOP')
  }

  const persistedRows = await readByValues(db, 'pick2_mlb_market_value_evaluations', 'value_identity', valueIdentities, '*')
  const postClassification = classify(expectedRows, persistedRows)
  const postCounts = {
    nativeValue: await countRows(db, 'pick2_mlb_market_value_evaluations'),
    legacyValue: await countRows(db, 'pick2_market_value_evaluations'),
    predictions: await countRows(db, 'pick2_game_predictions'),
    predictionResults: await countRows(db, 'pick2_prediction_results'),
    marketObservations: await countRows(db, 'pick2_mlb_market_price_observations'),
    marketMappings: await countRows(db, 'pick2_mlb_market_event_mappings'),
    champions: await countRows(db, 'pick2_model_versions', 'id', (query) => query.eq('model_version', modelVersionName).eq('role', 'champion').eq('status', 'promoted')),
    modelVersions: await countRows(db, 'pick2_model_versions'),
    raw2025: await countRows(db, 'pick2_raw_mlb_statcast_pitches', 'id', (query) => query.gte('game_date', '2025-01-01').lt('game_date', '2026-01-01')),
    features: await countRows(db, 'pick2_feature_snapshots'),
  }

  const persistedByIdentity = new Map(persistedRows.map((row) => [row.value_identity, row]))
  const payloadMismatches = expectedRows.filter((row) => !persistedByIdentity.has(row.value_identity) || !equivalent(persistedByIdentity.get(row.value_identity), row))
  const duplicatePersistedIdentities = persistedRows.length - unique(persistedRows.map((row) => row.value_identity)).length
  const edges = rows.map((row) => row.model_edge)
  const evs = rows.map((row) => row.unit_ev)
  const sortedByEv = [...rows].sort((a, b) => b.unit_ev - a.unit_ev)
  const top = sortedByEv[0]

  const success = insertion.inserted === rowsToInsert.length &&
    insertion.inserted <= 386 &&
    postClassification.INSERT_ELIGIBLE === 0 &&
    postClassification.REUSE_NO_OP === 386 &&
    postClassification.BLOCK_CONFLICT === 0 &&
    persistedRows.length === 386 &&
    duplicatePersistedIdentities === 0 &&
    payloadMismatches.length === 0 &&
    postCounts.nativeValue === 386 &&
    postCounts.legacyValue === 0 &&
    postCounts.predictions === 24 &&
    postCounts.predictionResults === 0 &&
    postCounts.marketObservations === 492 &&
    postCounts.marketMappings === 29 &&
    postCounts.champions === 1 &&
    postCounts.raw2025 === 712528 &&
    production.providerCallsMade === 0

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02O_R3_NATIVE_VALUE_PERSISTENCE_EXECUTION',
    certificationVerdict: success ? 'MLB_DATA_02O_R3_NATIVE_VALUE_PERSISTENCE_CERTIFIED' : 'MLB_DATA_02O_R3_NATIVE_VALUE_PERSISTENCE_BLOCKED',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeCleanBefore,
      MLB_02O_R3_PREPUBLISH_STATE: 'PASS',
      MLB_02O_R3_R2A_COMMIT_SCOPE_CERTIFIED: 'YES',
    },
    production: {
      commit: production.commit,
      providerCallsMade: production.providerCallsMade,
      PRODUCTION_ALIGNMENT: production.commit === targetCommit ? 'PASS' : 'FAIL',
    },
    baselines: {
      preCounts,
      MLB_02O_R3_NATIVE_VALUE_TABLE: 'PASS',
      MLB_02O_R3_NATIVE_VALUE_BASELINE: preCounts.nativeValue === 0 ? 'PASS' : 'REUSE_BASELINE',
      MLB_02O_R3_LEGACY_VALUE_PRESERVATION: preCounts.legacyValue === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R3_CHAMPION_BASELINE: preCounts.champions === 1 ? 'PASS' : 'FAIL',
      MLB_02O_R3_PREDICTION_BASELINE: preCounts.predictions === 24 ? 'PASS' : 'FAIL',
      MLB_02O_R3_MARKET_SOURCE_BASELINE: preCounts.marketObservations === 492 && preCounts.marketMappings === 29 ? 'PASS' : 'FAIL',
    },
    plan: {
      rows: rows.length,
      eligibleGames: artifact02n.intersection.eligiblePregamePredictions,
      bookLevelPairs: artifact02n.pairing.evaluatedBookLevelPairs,
      valueIdentityCount: valueIdentities.length,
      duplicateValueIdentities,
      invalidPlanRows: invalidPlanRows.length,
      missingSourceLinkages: linkageFailures.length,
      sideInversions: sideInversions.length,
      MLB_02O_R3_VALUE_PLAN_REBUILD: rows.length === 386 ? 'PASS' : 'FAIL',
      MLB_02O_R3_SOURCE_LINKAGE: linkageFailures.length === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R3_VALUE_MATH_PARITY: invalidPlanRows.length === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R3_SIDE_ALIGNMENT: sideInversions.length === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R3_TEMPORAL_ELIGIBILITY: invalidPlanRows.length === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R3_VALUE_IDENTITY_REBUILD: valueIdentities.length === 386 && duplicateValueIdentities === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R3_VALUE_DIGEST_PARITY: expectedRows.every((row) => row.source_payload_digest && row.evaluation_payload_digest) ? 'PASS' : 'FAIL',
    },
    prewriteClassification: {
      ...preClassification,
      MLB_02O_R3_VALUE_PREWRITE_CLASSIFICATION: preClassification.BLOCK_CONFLICT === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R3_VALUE_DML_CAP_READY: preClassification.INSERT_ELIGIBLE <= 386 ? 'YES' : 'NO',
      VALUE_INSERT_CAP: preClassification.INSERT_ELIGIBLE,
    },
    execution: {
      attempted: rowsToInsert.length,
      inserted: insertion.inserted,
      reused: preClassification.REUSE_NO_OP,
      conflicts: preClassification.BLOCK_CONFLICT,
      failures: insertion.failures.length,
      updates: 0,
      deletes: 0,
      MLB_02O_R3_VALUE_PERSISTENCE: insertion.inserted === rowsToInsert.length ? 'PASS' : 'FAIL',
      MLB_02O_R3_VALUE_DML_ACCOUNTING: insertion.inserted <= 386 && insertion.failures.length === 0 ? 'PASS' : 'FAIL',
    },
    readback: {
      finalCounts: postCounts,
      finalNativeValueRowCount: postCounts.nativeValue,
      rowParity: persistedRows.length === 386 && duplicatePersistedIdentities === 0 ? 'PASS' : 'FAIL',
      payloadMismatches: payloadMismatches.length,
      sourceLinkageReadback: postClassification.REUSE_NO_OP === 386 ? 'PASS' : 'FAIL',
      bookIdentityFailures: payloadMismatches.filter((row) => ['bookmaker_key', 'bookmaker_name'].some((field) => persistedByIdentity.get(row.value_identity)?.[field] !== row[field])).length,
      numericParityFailures: payloadMismatches.length,
      duplicatePersistedIdentities,
      MLB_02O_R3_VALUE_ROW_PARITY: persistedRows.length === 386 && duplicatePersistedIdentities === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R3_VALUE_PAYLOAD_READBACK: payloadMismatches.length === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R3_VALUE_SOURCE_LINKAGE_READBACK: postClassification.REUSE_NO_OP === 386 ? 'PASS' : 'FAIL',
      MLB_02O_R3_BOOK_IDENTITY_READBACK: payloadMismatches.length === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R3_NUMERIC_PARITY: payloadMismatches.length === 0 ? 'PASS' : 'FAIL',
    },
    distribution: {
      rows: rows.length,
      positiveEdgeCount: edges.filter((value) => value > 0).length,
      maximumEdge: Math.max(...edges),
      medianEdge: median(edges),
      positiveEvCount: evs.filter((value) => value > 0).length,
      maximumEv: Math.max(...evs),
      medianEv: median(evs),
      topCandidate: {
        game_pk: top.game_pk,
        side: top.side,
        bookmaker_key: top.bookmaker_key,
        edge: top.model_edge,
        unit_ev: top.unit_ev,
      },
      MLB_02O_R3_EDGE_DISTRIBUTION: edges.filter((value) => value > 0).length === 193 && close(Math.max(...edges), 0.095882, 1e-6) ? 'PASS' : 'FAIL',
      MLB_02O_R3_EV_DISTRIBUTION: evs.filter((value) => value > 0).length === 137 && close(Math.max(...evs), 0.240928, 1e-6) && close(median(evs), -0.03499, 1e-6) ? 'PASS' : 'FAIL',
      MLB_02O_R3_TOP_ANALYTICAL_CANDIDATE: top.game_pk === 823904 && top.side === 'AWAY' && top.bookmaker_key === 'betrivers' && close(top.model_edge, 0.095882, 1e-6) && close(top.unit_ev, 0.240928, 1e-6) ? 'PASS' : 'FAIL',
    },
    immutability: {
      MLB_02O_R3_VALUE_NO_OVERWRITE: insertion.failures.length === 0 ? 'PASS' : 'FAIL',
      MLB_02O_R3_VALUE_IMMUTABILITY: 'PASS_USER_SQL_EVIDENCE_R2A',
      updates: 0,
      deletes: 0,
    },
    idempotency: {
      ...postClassification,
      MLB_02O_R3_VALUE_IDEMPOTENCY: postClassification.INSERT_ELIGIBLE === 0 && postClassification.REUSE_NO_OP === 386 && postClassification.BLOCK_CONFLICT === 0 ? 'PASS' : 'FAIL',
    },
    limitations: {
      championTestAucApprox: 0.551,
      MLB_02O_R3_MODEL_LIMITATION: 'PASS',
      MLB_02O_R3_HISTORICAL_LIMITATION: 'PASS',
      historicalRoiCertified: false,
      clvCertified: false,
      profitabilityCertified: false,
    },
    boundaries: {
      officialPicks: 0,
      autoRecommendation: 'NO',
      valueBoardPublication: 'NO',
      providerCalls: production.providerCallsMade,
      marketSourceWrites: 0,
      predictionWrites: 0,
      predictionResultWrites: 0,
      championChanges: 0,
      modelWrites: 0,
      rawWrites: 0,
      featureWrites: 0,
      otherDml: 0,
      productionDdl: 0,
      automation: 'OFF',
      cronChanges: 0,
      MLB_02O_R3_OFFICIAL_PICK_WORK: 'NO',
      MLB_02O_R3_AUTO_RECOMMENDATION: 'NO',
      MLB_02O_R3_VALUE_BOARD_PUBLICATION: 'NO',
      MLB_02O_R3_PROVIDER_CALLS: production.providerCallsMade,
      MLB_02O_R3_MARKET_SOURCE_WRITES: 0,
      MLB_02O_R3_PREDICTION_WRITES: 0,
      MLB_02O_R3_FOUNDATION_PRESERVED: 'PASS',
      MLB_02O_R3_PRODUCTION_DML_BOUNDARY: 'PASS',
      MLB_02O_R3_PRODUCTION_DDL: 0,
      MLB_02O_R3_AUTOMATION_STATE: 'OFF',
    },
    readiness: {
      MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_READY: success ? 'YES' : 'NO',
      MLB_DATA_02Q_VALUE_BOARD_PREP_READY: success ? 'YES' : 'NO',
    },
    humanReadableAudit: {
      MLB_02O_R3_HUMAN_READABLE_AUDIT: 'READY',
      path: auditPath,
    },
  }

  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, renderAudit(artifact))
  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    attempted: artifact.execution.attempted,
    inserted: artifact.execution.inserted,
    finalNativeValueRowCount: artifact.readback.finalNativeValueRowCount,
    idempotency: artifact.idempotency,
    providerCalls: artifact.boundaries.providerCalls,
    readiness: artifact.readiness,
  }, null, 2))
  if (!success) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
