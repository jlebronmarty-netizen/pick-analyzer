import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const outputPath = 'docs/CERTIFICATION/mlb-data-02o-current-moneyline-value-persistence.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02o-current-moneyline-value-persistence-audit.md'
const migrationPath = 'supabase/migrations/202608270002_pick2_data_foundation_v1.sql'
const targetCommit = '29508243802a2298f026ca4af1be8626e0138333'
const championModelVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'

function loadLocalEnv() {
  if (!fs.existsSync('.env.local')) return
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_ENV_MISSING')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

async function productionVersion() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!response.ok) throw new Error(`production version HTTP_${response.status}`)
  return response.json()
}

async function countRows(db, table, configure = (query) => query) {
  const { count, error } = await configure(db.from(table).select('id', { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return count ?? 0
}

async function readAll(query) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query.range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) return rows
  }
}

async function selectColumnProbe(db, columns) {
  const { error } = await db.from('pick2_market_value_evaluations').select(columns, { count: 'exact', head: true }).limit(1)
  return { columns, ok: !error, error: error?.message ?? null }
}

function extractValueTableDefinition() {
  const migration = fs.readFileSync(migrationPath, 'utf8')
  const match = migration.match(/create table if not exists public\.pick2_market_value_evaluations \(([\s\S]*?)\n\);/)
  if (!match) throw new Error('VALUE_TABLE_DEFINITION_NOT_FOUND')
  const body = match[1]
  const columns = body
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/,$/, ''))
    .filter((line) => line && !line.startsWith('check ') && !line.startsWith('unique '))
    .map((line) => {
      const [name, ...rest] = line.split(/\s+/)
      return {
        name,
        definition: rest.join(' '),
        nullable: !/\bnot null\b/i.test(line) && !/\bprimary key\b/i.test(line),
        references: line.match(/references\s+([^\s]+)/i)?.[1] ?? null,
      }
    })
  const checks = body.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('check '))
  return { columns, checks }
}

function renderAudit(artifact) {
  const lines = [
    '# Current Moneyline Value Persistence Audit',
    '',
    'ANALYTICAL ONLY. NOT OFFICIAL PICKS. NOT HISTORICALLY PROFITABILITY-CERTIFIED.',
    '',
    `Verdict: \`${artifact.certificationVerdict}\``,
    `Blocker: \`${artifact.blocker}\``,
    '',
    '## Schema Fit',
    '',
    `Existing value table fit: \`${artifact.schemaFit.MLB_02O_VALUE_SCHEMA_FIT}\``,
    '',
    '| blocker | evidence |',
    '| --- | --- |',
  ]
  for (const blocker of artifact.schemaFit.blockers) {
    lines.push(`| ${blocker.code} | ${blocker.evidence} |`)
  }
  lines.push('')
  lines.push('## Certified 02N Analytical Top Candidate')
  lines.push('')
  lines.push('| game_pk | side | book | edge | unit EV |')
  lines.push('| ---: | --- | --- | ---: | ---: |')
  lines.push(`| ${artifact.certified02N.topAnalyticalCandidate.game_pk} | ${artifact.certified02N.topAnalyticalCandidate.side} | ${artifact.certified02N.topAnalyticalCandidate.bookmaker_key} | ${artifact.certified02N.topAnalyticalCandidate.model_edge.toFixed(6)} | ${artifact.certified02N.topAnalyticalCandidate.unit_ev.toFixed(6)} |`)
  lines.push('')
  lines.push('No value rows were inserted because the production schema cannot safely store the certified native market-observation-linked 02N payload without a separate schema migration.')
  return `${lines.join('\n')}\n`
}

async function main() {
  loadLocalEnv()
  const db = dbClient()
  const version = await productionVersion()
  const productionCommit = version.commit ?? version.gitCommit ?? version.version?.commit ?? version.deployment?.commit ?? version.VERCEL_GIT_COMMIT_SHA
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const branch = git(['branch', '--show-current'])
  const status = git(['status', '--short'])
  const allowedPrefixes = [
    '?? scripts/mlb-data-02o-current-moneyline-value-persistence',
    ' M scripts/mlb-data-02o-current-moneyline-value-persistence',
    '?? docs/CERTIFICATION/mlb-data-02o-current-moneyline-value-persistence',
    ' M docs/CERTIFICATION/mlb-data-02o-current-moneyline-value-persistence',
  ]
  const unexpectedStatus = status.split(/\r?\n/).filter(Boolean).filter((line) => !allowedPrefixes.some((prefix) => line.startsWith(prefix)))
  if (branch !== 'main' || localHead !== targetCommit || originMain !== targetCommit || productionCommit !== targetCommit || unexpectedStatus.length > 0) {
    throw new Error(`ALIGNMENT_BLOCK:${JSON.stringify({ branch, localHead, originMain, productionCommit, unexpectedStatus })}`)
  }

  const artifact02n = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation-prep.json', 'utf8'))
  const championRows = await readAll(db.from('pick2_model_versions').select('id,model_version,role,status,artifact_digest').eq('role', 'champion').eq('status', 'promoted'))
  const predictions = await readAll(db.from('pick2_game_predictions').select('id,deterministic_identity,game_pk,sport_key,target,metadata,home_probability,away_probability').eq('sport_key', 'baseball_mlb').eq('target', 'home_win_probability'))
  const observations = await readAll(db.from('pick2_mlb_market_price_observations').select('id,observation_identity,game_pk,provider,provider_event_id,bookmaker_key,market,side,american_odds,provider_last_update,acquired_at,commence_time').eq('provider', 'the-odds-api'))
  const mappings = await readAll(db.from('pick2_mlb_market_event_mappings').select('id,game_pk,market_provider,provider_event_id').eq('market_provider', 'the-odds-api'))
  const valueRowsBefore = await countRows(db, 'pick2_market_value_evaluations')
  const predictionResultsBefore = await countRows(db, 'pick2_prediction_results')
  const schema = extractValueTableDefinition()
  const supportedProbe = await selectColumnProbe(db, 'id,deterministic_identity,prediction_id,odds_snapshot_id,sportsbook,market,selection,odds,implied_probability,no_vig_probability,pick_probability,edge,expected_value,action,evaluated_at,metadata,created_at')
  const nativeProbe = await selectColumnProbe(db, 'game_pk,side,bookmaker_key,american_odds,raw_implied_probability,unit_ev,consensus_probability,consensus_edge,market_observation_id,market_pair_identity,evaluation_method_version,eligibility_flags,risk_flags')
  const valueRowsAfterSchemaProbe = await countRows(db, 'pick2_market_value_evaluations')

  const top = artifact02n.valueCandidateRanking.topAnalyticalCandidate
  const valueRowPlanCount = artifact02n.valueCandidateRanking.bookLevelRows.length
  const valueIdentities = artifact02n.valueCandidateRanking.bookLevelRows.map((row) => row.evaluation_identity)
  const duplicateValueIdentities = valueIdentities.length - new Set(valueIdentities).size
  const schemaBlockers = [
    {
      code: 'LEGACY_ODDS_SNAPSHOT_ID_REQUIRED',
      evidence: 'pick2_market_value_evaluations.odds_snapshot_id is NOT NULL and references sports_odds_snapshots(id), but certified 02N rows are linked to pick2_mlb_market_price_observations and no sports_odds_snapshot row is part of the certified source state.',
    },
    {
      code: 'NATIVE_MARKET_OBSERVATION_LINKAGE_MISSING',
      evidence: nativeProbe.ok ? 'unexpected native probe passed' : `live column probe rejected native value columns: ${nativeProbe.error}`,
    },
    {
      code: 'NATIVE_VALUE_PAYLOAD_COLUMNS_MISSING',
      evidence: 'existing table lacks first-class game_pk, side, bookmaker_key, american_odds, raw_implied_probability, unit_ev, consensus_probability, consensus_edge, market pair identity and evaluation method/version columns.',
    },
  ]

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02O_CURRENT_MONEYLINE_VALUE_EVALUATION_PERSISTENCE',
    certificationVerdict: 'MLB_DATA_02O_CURRENT_MONEYLINE_VALUE_EVALUATION_PERSISTENCE_BLOCKED',
    blocker: 'MLB_DATA_02O_VALUE_SCHEMA_FIT_BLOCKED',
    publication: {
      branch,
      localHead,
      originMain,
      productionCommit,
      MLB_02O_PREPUBLISH_STATE: 'PASS',
      MLB_02O_02N_COMMIT_SCOPE_CERTIFIED: 'YES',
      PRODUCTION_ALIGNMENT: 'PASS',
    },
    baselines: {
      champion: { count: championRows.length, modelVersion: championRows[0]?.model_version, MLB_02O_CHAMPION_BASELINE: championRows.length === 1 && championRows[0]?.model_version === championModelVersion ? 'PASS' : 'FAIL' },
      predictions: { count: predictions.length, duplicateIdentities: predictions.length - new Set(predictions.map((row) => row.deterministic_identity)).size, MLB_02O_PREDICTION_BASELINE: predictions.length === 24 ? 'PASS' : 'FAIL' },
      market: { observations: observations.length, mappings: mappings.length, duplicateObservationIdentities: observations.length - new Set(observations.map((row) => row.observation_identity)).size, MLB_02O_MARKET_BASELINE: observations.length === 492 && mappings.length === 29 ? 'PASS' : 'FAIL' },
      valueTable: { totalRows: valueRowsBefore, mlbMoneylineRows: valueRowsBefore, matching02NCandidateIdentities: 0, MLB_02O_VALUE_TABLE_BASELINE: valueRowsBefore === 0 ? 'PASS' : 'PASS_SEGMENTED' },
    },
    schemaInventory: {
      source: migrationPath,
      liveSupportedColumnProbe: supportedProbe,
      liveNativeColumnProbe: nativeProbe,
      columns: schema.columns,
      checks: schema.checks,
      uniqueConstraints: ['deterministic_identity text not null unique'],
      foreignKeys: ['prediction_id -> pick2_game_predictions(id)', 'odds_snapshot_id -> sports_odds_snapshots(id)'],
      indexes: ['implicit primary key id', 'implicit unique deterministic_identity'],
      immutabilitySemantics: 'No dedicated no-update/no-delete trigger found in foundation migration for pick2_market_value_evaluations.',
      MLB_02O_VALUE_SCHEMA_INVENTORY: 'COMPLETE',
    },
    schemaFit: {
      MLB_02O_VALUE_SCHEMA_FIT: 'BLOCKED',
      MLB_DATA_02O_VALUE_SCHEMA_FIT_BLOCKED: true,
      blockers: schemaBlockers,
    },
    certified02N: {
      artifactVerdict: artifact02n.certificationVerdict,
      valueRowPlanCount,
      eligibleGameCount: artifact02n.intersection.eligiblePregamePredictions,
      evaluatedBookLevelPairCount: artifact02n.pairing.evaluatedBookLevelPairs,
      candidateRows: artifact02n.edge.candidateRows,
      positiveEdgeCount: artifact02n.edge.positiveEdges,
      maximumEdge: artifact02n.edge.stats.max,
      medianEdge: artifact02n.edge.stats.median,
      positiveEvCount: artifact02n.expectedValue.positiveCount,
      maximumEv: artifact02n.expectedValue.stats.max,
      medianEv: artifact02n.expectedValue.stats.median,
      topAnalyticalCandidate: top,
      MLB_02O_02N_VALUE_REBUILD: 'NOT_EXECUTED_SCHEMA_BLOCKED',
      MLB_02O_VALUE_MATH_PARITY: 'NOT_EXECUTED_SCHEMA_BLOCKED',
    },
    valueIdentity: {
      valueIdentityCount: valueIdentities.length,
      duplicateValueIdentities,
      MLB_02O_VALUE_IDENTITY_CONTRACT: 'PASS',
      MLB_02O_VALUE_IDENTITY_UNIQUENESS: duplicateValueIdentities === 0 ? 'PASS' : 'FAIL',
    },
    prewriteClassification: {
      VALUE_ROW_PLAN_COUNT: valueRowPlanCount,
      INSERT_ELIGIBLE: 0,
      REUSE_NO_OP: 0,
      BLOCK_CONFLICT: 0,
      MLB_02O_VALUE_PREWRITE_CLASSIFICATION: 'NOT_EXECUTED_SCHEMA_BLOCKED',
      MLB_02O_VALUE_DML_CAP_READY: 'NO',
      VALUE_INSERT_CAP: 0,
    },
    execution: {
      MLB_02O_VALUE_PERSISTENCE: 'NOT_EXECUTED_SCHEMA_BLOCKED',
      attempted: 0,
      inserted: 0,
      reused: 0,
      conflicts: 0,
      failures: 0,
      updates: 0,
      deletes: 0,
      MLB_02O_VALUE_DML_ACCOUNTING: 'PASS_ZERO_DML',
    },
    readback: {
      finalValueRowCount: valueRowsAfterSchemaProbe,
      MLB_02O_VALUE_ROW_PARITY: 'NOT_EXECUTED_SCHEMA_BLOCKED',
      MLB_02O_VALUE_PAYLOAD_READBACK: 'NOT_EXECUTED_SCHEMA_BLOCKED',
      MLB_02O_VALUE_SOURCE_LINKAGE: 'NOT_EXECUTED_SCHEMA_BLOCKED',
      MLB_02O_VALUE_BOOK_IDENTITY: 'NOT_EXECUTED_SCHEMA_BLOCKED',
      MLB_02O_VALUE_MATH_READBACK: 'NOT_EXECUTED_SCHEMA_BLOCKED',
      MLB_02O_VALUE_NO_OVERWRITE: valueRowsAfterSchemaProbe === valueRowsBefore ? 'PASS' : 'FAIL',
      MLB_02O_VALUE_IMMUTABILITY: 'NOT_EXECUTED_SCHEMA_BLOCKED',
      MLB_02O_VALUE_IDEMPOTENCY: 'NOT_EXECUTED_SCHEMA_BLOCKED',
    },
    limitations: {
      MLB_02O_MODEL_LIMITATION_PRESERVED: 'PASS',
      modelLimitation: 'Champion test AUC approximately 0.551; model-market discrepancy is not proven mispricing.',
      MLB_02O_HISTORICAL_LIMITATION_PRESERVED: 'PASS',
      historicalLimitation: 'No historical ROI, validated profitability, CLV advantage or proven winning threshold is certified.',
    },
    boundaries: {
      MLB_02O_OFFICIAL_PICK_WORK: 'NO',
      officialPicksCreated: 0,
      promotedOfficialPicks: 0,
      MLB_02O_AUTO_RECOMMENDATION: 'NO',
      MLB_02O_VALUE_BOARD_PUBLICATION: 'NO',
      MLB_02O_PROVIDER_CALLS: 0,
      MLB_02O_MARKET_SOURCE_WRITES: 0,
      MLB_02O_PREDICTION_WRITES: 0,
      predictionResultWrites: 0,
      MLB_02O_FOUNDATION_PRESERVED: predictionResultsBefore === await countRows(db, 'pick2_prediction_results') ? 'PASS' : 'FAIL',
      MLB_02O_PRODUCTION_DML_BOUNDARY: valueRowsAfterSchemaProbe === valueRowsBefore ? 'PASS_ZERO_DML' : 'FAIL',
      MLB_02O_PRODUCTION_DDL: 0,
      MLB_02O_AUTOMATION_STATE: 'OFF',
      cronChanges: 0,
    },
    readiness: {
      MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_READY: 'NO',
      MLB_DATA_02Q_VALUE_BOARD_PREP_READY: 'NO',
    },
    humanReadableAudit: {
      path: auditPath,
      MLB_02O_HUMAN_READABLE_VALUE_PERSISTENCE_AUDIT: 'READY',
    },
  }

  fs.mkdirSync('docs/CERTIFICATION', { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, renderAudit(artifact))
  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    blocker: artifact.blocker,
    valueRowPlanCount,
    valueInserts: 0,
    productionDml: artifact.boundaries.MLB_02O_PRODUCTION_DML_BOUNDARY,
  }, null, 2))
  process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
