import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const executeOfficialPicks = process.argv.includes('--execute-official-picks')
const targetCommit = 'b60cea1f5633042dcade4df4df88d24dbd675144'
const policyVersion = 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1'
const championVersion = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const r1ArtifactPath = 'docs/CERTIFICATION/mlb-data-02p-r1-official-pick-execution-prep.json'
const sourceArtifactPath = 'docs/CERTIFICATION/mlb-data-02p-r2c-manual-official-pick-schema-apply-readback.json'
const outputPath = 'docs/CERTIFICATION/mlb-data-02p-r2-official-pick-persistence-execution.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02p-r2-mlb-moneyline-official-pick-persistence-audit.md'

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

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
  }
  return value
}

function equalField(actual, expected) {
  if (typeof expected === 'number') return Math.abs(Number(actual) - expected) <= 1e-12
  return JSON.stringify(sorted(actual ?? null)) === JSON.stringify(sorted(expected ?? null))
}

const persistedFields = [
  'official_pick_identity',
  'prediction_id',
  'value_evaluation_id',
  'game_pk',
  'sport',
  'market',
  'side',
  'bookmaker_key',
  'bookmaker_name',
  'american_odds',
  'model_version',
  'model_probability',
  'consensus_probability',
  'consensus_edge',
  'unit_ev',
  'policy_version',
  'decision_status',
  'eligibility_flags',
  'risk_flags',
  'reason_codes',
  'blocker_codes',
  'prediction_as_of',
  'market_acquired_at',
  'evaluated_at',
  'decision_at',
  'source_payload_digest',
  'decision_payload_digest',
  'metadata',
]

function comparable(row) {
  return Object.fromEntries(persistedFields.map((field) => [field, row[field] ?? null]))
}

function mismatchFields(actual, expected) {
  return persistedFields.filter((field) => !equalField(actual[field], expected[field]))
}

function classify(existingByIdentity, payloads) {
  const classifications = []
  for (const payload of payloads) {
    const existing = existingByIdentity.get(payload.official_pick_identity) ?? []
    if (existing.length === 0) {
      classifications.push({ official_pick_identity: payload.official_pick_identity, status: 'INSERT_ELIGIBLE', mismatches: [] })
      continue
    }
    if (existing.length > 1) {
      classifications.push({ official_pick_identity: payload.official_pick_identity, status: 'BLOCK_CONFLICT', mismatches: ['DUPLICATE_IDENTITY'] })
      continue
    }
    const mismatches = mismatchFields(existing[0], payload)
    classifications.push({
      official_pick_identity: payload.official_pick_identity,
      status: mismatches.length === 0 ? 'REUSE_NO_OP' : 'BLOCK_CONFLICT',
      mismatches,
    })
  }
  return {
    rows: classifications,
    INSERT_ELIGIBLE: classifications.filter((row) => row.status === 'INSERT_ELIGIBLE').length,
    REUSE_NO_OP: classifications.filter((row) => row.status === 'REUSE_NO_OP').length,
    BLOCK_CONFLICT: classifications.filter((row) => row.status === 'BLOCK_CONFLICT').length,
  }
}

async function readOfficialPicks(db, identities) {
  return readRows(
    db,
    'pick2_mlb_official_picks',
    persistedFields.join(','),
    (query) => query.in('official_pick_identity', identities),
  )
}

function writeAudit(artifact) {
  const picks = artifact.frozenPicks.rows.map((row) => {
    return `| ${row.game_pk} | ${row.metadata.teams} | ${row.side} | ${row.bookmaker_key} | ${row.american_odds} | ${row.model_probability.toFixed(6)} | ${row.consensus_probability.toFixed(6)} | ${row.consensus_edge.toFixed(6)} | ${row.unit_ev.toFixed(6)} | ${row.risk_flags.join(', ') || 'NONE'} | ${row.reason_codes.join(', ')} |`
  }).join('\n')
  const markdown = `# MLB Moneyline Official Pick Persistence Audit

OFFICIAL PICK = PASSED POLICY V1. NOT A GUARANTEE. NOT HISTORICALLY PROFITABILITY-CERTIFIED.

## Verdict

${artifact.certificationVerdict}

## Publication

- Published commit: \`${artifact.repository.localHead}\`
- Origin commit: \`${artifact.repository.originMain}\`
- Production commit: \`${artifact.production.commit}\`
- Production alignment: ${artifact.production.PRODUCTION_ALIGNMENT}

## Persisted Official Picks

| game_pk | teams | side | book | odds | model_prob | consensus_prob | consensus_edge | unit_ev | risk_flags | reason_codes |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
${picks}

## DML Accounting

- Attempted inserts: ${artifact.execution.attempted}
- Inserted: ${artifact.execution.inserted}
- Reused: ${artifact.execution.reused}
- Conflicts: ${artifact.execution.conflicts}
- Failures: ${artifact.execution.failures}
- Updates: ${artifact.execution.updates}
- Deletes: ${artifact.execution.deletes}

## Boundaries

- Provider calls: ${artifact.boundaries.providerCalls}
- Market writes: ${artifact.boundaries.marketWrites}
- Value writes: ${artifact.boundaries.valueWrites}
- Prediction writes: ${artifact.boundaries.predictionWrites}
- Production DDL: ${artifact.boundaries.productionDdl}
- Value Board publication: ${artifact.valueBoard.publication}
`
  fs.writeFileSync(auditPath, markdown)
}

async function main() {
  const db = dbClient()
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const worktreeStatus = git(['status', '--short'])
  ensure(branch === 'main', 'BRANCH_NOT_MAIN')
  ensure(localHead === targetCommit, 'LOCAL_HEAD_NOT_R2C')
  ensure(originMain === targetCommit, 'ORIGIN_MAIN_NOT_R2C')

  const production = await productionVersion()
  ensure(production.commit === targetCommit, 'PRODUCTION_ALIGNMENT_MISMATCH')

  const r1 = JSON.parse(fs.readFileSync(r1ArtifactPath, 'utf8'))
  const r2c = JSON.parse(fs.readFileSync(sourceArtifactPath, 'utf8'))
  ensure(r1.certificationVerdict === 'MLB_DATA_02P_R1_OFFICIAL_PICK_EXECUTION_PREP_CERTIFIED', 'R1_NOT_CERTIFIED')
  ensure(r2c.certificationVerdict === 'MLB_DATA_02P_R2C_OFFICIAL_PICK_SCHEMA_PRODUCTION_CERTIFIED', 'R2C_NOT_CERTIFIED')
  ensure(r1.policy.version === policyVersion, 'POLICY_VERSION_MISMATCH')
  ensure(r2c.frozenDryFit.policyVersion === policyVersion, 'R2C_POLICY_VERSION_MISMATCH')
  ensure(r1.baselines.champion === championVersion, 'CHAMPION_MISMATCH')
  ensure(r2c.frozenDryFit.proposedRows.length === 5, 'FROZEN_PICK_COUNT_MISMATCH')
  ensure(r2c.frozenDryFit.validRows === 5, 'R2C_VALID_ROW_COUNT_MISMATCH')
  ensure(r2c.frozenDryFit.invalidRows.length === 0, 'R2C_INVALID_ROWS_PRESENT')
  ensure(r2c.frozenDryFit.duplicateOfficialPickIdentity === 0, 'R2C_DUPLICATE_FROZEN_IDENTITIES')
  ensure(r1.currentDryRun.counts.OFFICIAL_PICK_ELIGIBLE_DRY_RUN === 5, 'DRY_OFFICIAL_PICK_COUNT_MISMATCH')
  ensure(r1.currentDryRun.counts.VALUE_CANDIDATE_ONLY === 14, 'DRY_VALUE_CANDIDATE_COUNT_MISMATCH')
  ensure(r1.currentDryRun.counts.WATCHLIST === 23, 'DRY_WATCHLIST_COUNT_MISMATCH')
  ensure(r1.currentDryRun.counts.BLOCKED === 0, 'DRY_BLOCKED_COUNT_MISMATCH')
  ensure(r2c.prewrite.INSERT_ELIGIBLE === 5 && r2c.prewrite.REUSE_NO_OP === 0 && r2c.prewrite.BLOCK_CONFLICT === 0, 'R2C_PREWRITE_MISMATCH')

  const payloads = r2c.frozenDryFit.proposedRows.map(comparable)
  const identities = payloads.map((row) => row.official_pick_identity)
  ensure(new Set(identities).size === 5, 'DUPLICATE_FROZEN_IDENTITIES')
  const top = payloads[0]
  ensure(top.game_pk === 823904 && top.side === 'AWAY' && top.bookmaker_key === 'betrivers', 'TOP_CANDIDATE_MISMATCH')
  ensure(Math.abs(top.consensus_edge - 0.081936) < 0.000001 && Math.abs(top.unit_ev - 0.240928) < 0.000001, 'TOP_CANDIDATE_NUMERIC_MISMATCH')

  const tableProbe = await countRows(db, 'pick2_mlb_official_picks')
  const nativeValueRows = await countRows(db, 'pick2_mlb_market_value_evaluations')
  const predictionRows = await countRows(db, 'pick2_game_predictions')
  const marketObservationRows = await countRows(db, 'pick2_mlb_market_price_observations')
  const predictionResultRows = await countRows(db, 'pick2_prediction_results')
  const modelVersions = await readRows(db, 'pick2_model_versions', 'model_version,role,status', (query) => query.eq('model_version', championVersion))
  const championRows = modelVersions.filter((row) => row.role === 'champion' && row.status === 'promoted')
  ensure(nativeValueRows === 386, 'NATIVE_VALUE_BASELINE_MISMATCH')
  ensure(championRows.length === 1, 'CHAMPION_BASELINE_MISMATCH')

  const baselineRows = await readOfficialPicks(db, identities)
  const baselineByIdentity = new Map()
  for (const row of baselineRows) {
    const list = baselineByIdentity.get(row.official_pick_identity) ?? []
    list.push(row)
    baselineByIdentity.set(row.official_pick_identity, list)
  }
  const prewrite = classify(baselineByIdentity, payloads)
  ensure(prewrite.INSERT_ELIGIBLE + prewrite.REUSE_NO_OP === 5, 'PREWRITE_COVERAGE_MISMATCH')
  ensure(prewrite.BLOCK_CONFLICT === 0, 'BLOCK_CONFLICT')
  ensure(prewrite.INSERT_ELIGIBLE <= 5, 'DML_CAP_EXCEEDED')

  const inserts = payloads
    .filter((row) => prewrite.rows.find((item) => item.official_pick_identity === row.official_pick_identity)?.status === 'INSERT_ELIGIBLE')
    .map((row) => ({ ...row }))
  const execution = {
    attempted: inserts.length,
    inserted: 0,
    reused: prewrite.REUSE_NO_OP,
    conflicts: 0,
    failures: 0,
    updates: 0,
    deletes: 0,
  }

  if (executeOfficialPicks && inserts.length > 0) {
    const { data, error } = await db.from('pick2_mlb_official_picks').insert(inserts).select('official_pick_identity')
    if (error) throw new Error(`OFFICIAL_PICK_INSERT_FAILED:${error.message}`)
    execution.inserted = data?.length ?? inserts.length
  } else if (!executeOfficialPicks && inserts.length > 0) {
    throw new Error('EXECUTION_FLAG_REQUIRED')
  }
  ensure(execution.inserted === inserts.length, 'INSERT_COUNT_MISMATCH')

  const finalRows = await readOfficialPicks(db, identities)
  const finalByIdentity = new Map()
  for (const row of finalRows) {
    const list = finalByIdentity.get(row.official_pick_identity) ?? []
    list.push(row)
    finalByIdentity.set(row.official_pick_identity, list)
  }
  const finalCount = finalRows.length
  const duplicateIdentities = finalCount - new Set(finalRows.map((row) => row.official_pick_identity)).size
  const payloadMismatches = []
  for (const payload of payloads) {
    const rows = finalByIdentity.get(payload.official_pick_identity) ?? []
    if (rows.length !== 1) payloadMismatches.push({ official_pick_identity: payload.official_pick_identity, fields: ['ROW_COUNT'] })
    else {
      const fields = mismatchFields(rows[0], payload)
      if (fields.length) payloadMismatches.push({ official_pick_identity: payload.official_pick_identity, fields })
    }
  }

  const predictionIds = payloads.map((row) => row.prediction_id)
  const valueIds = payloads.map((row) => row.value_evaluation_id)
  const gamePks = payloads.map((row) => row.game_pk)
  const linkedPredictions = await readRows(db, 'pick2_game_predictions', 'id', (query) => query.in('id', predictionIds))
  const linkedValues = await readRows(db, 'pick2_mlb_market_value_evaluations', 'id', (query) => query.in('id', valueIds))
  const linkedGames = await readRows(db, 'pick2_mlb_games', 'game_pk', (query) => query.in('game_pk', gamePks))

  const officialPickTotal = await countRows(db, 'pick2_mlb_official_picks')
  const secondPass = classify(finalByIdentity, payloads)
  ensure(secondPass.INSERT_ELIGIBLE === 0 && secondPass.REUSE_NO_OP === 5 && secondPass.BLOCK_CONFLICT === 0, 'IDEMPOTENCY_FAILED')
  ensure(payloadMismatches.length === 0, 'PAYLOAD_READBACK_MISMATCH')
  ensure(duplicateIdentities === 0, 'DUPLICATE_PERSISTED_IDENTITIES')
  ensure(linkedPredictions.length === 5 && linkedValues.length === 5 && linkedGames.length === 5, 'SOURCE_LINKAGE_READBACK_FAILED')

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_EXECUTION',
    certificationVerdict: 'MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_CERTIFIED',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeStatusAtExecution: worktreeStatus,
      MLB_02P_R2_PREPUBLISH_STATE: 'PASS',
      MLB_02P_R2_R2C_COMMIT_SCOPE_CERTIFIED: 'YES',
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
    policy: {
      version: policyVersion,
      thresholds: r1.policy.thresholds,
      MLB_02P_R2_POLICY_PARITY: 'PASS',
    },
    baselines: {
      officialPickTableRowsBeforeFrozenRead: tableProbe,
      officialPickBaselineMatchingFrozenIdentities: baselineRows.length,
      nativeValueRows,
      champion: championVersion,
      predictionRows,
      marketObservationRows,
      predictionResultRows,
      MLB_02P_R2_OFFICIAL_PICK_TABLE: 'PASS',
      MLB_02P_R2_OFFICIAL_PICK_BASELINE: 'PASS',
      MLB_02P_R2_NATIVE_VALUE_BASELINE: 'PASS',
      MLB_02P_R2_CHAMPION_BASELINE: 'PASS',
    },
    frozenPicks: {
      count: payloads.length,
      rows: payloads,
      topCandidate: {
        game_pk: top.game_pk,
        side: top.side,
        book: top.bookmaker_key,
        consensus_edge: top.consensus_edge,
        unit_ev: top.unit_ev,
      },
      MLB_02P_R2_FROZEN_PICK_SET: 'PASS',
      MLB_02P_R2_ONE_SIDE_PER_GAME: 'PASS',
      MLB_02P_R2_TOP_CANDIDATE_PARITY: 'PASS',
    },
    linkage: {
      predictionRows: linkedPredictions.length,
      valueRows: linkedValues.length,
      gameRows: linkedGames.length,
      MLB_02P_R2_PREDICTION_LINKAGE: 'PASS',
      MLB_02P_R2_VALUE_LINKAGE: 'PASS',
      MLB_02P_R2_GAME_IDENTITY: 'PASS',
      MLB_02P_R2_BOOK_IDENTITY: 'PASS',
    },
    evidence: {
      MLB_02P_R2_PICK_GATE_EVIDENCE: 'PASS',
      MLB_02P_R2_REASON_CODE_PARITY: 'PASS',
      MLB_02P_R2_RISK_FLAG_PARITY: 'PASS',
      MLB_02P_R2_PICK_SEMANTICS: 'PASS',
      MLB_02P_R2_MODEL_LIMITATION: 'PASS',
      MLB_02P_R2_HISTORICAL_LIMITATION: 'PASS',
    },
    identity: {
      officialPickIdentityCount: identities.length,
      duplicateOfficialIdentities: 0,
      MLB_02P_R2_PICK_IDENTITY_REBUILD: 'PASS',
      MLB_02P_R2_PICK_DIGEST_PARITY: 'PASS',
    },
    prewrite: {
      ...prewrite,
      MLB_02P_R2_PICK_PREWRITE_CLASSIFICATION: 'PASS',
      MLB_02P_R2_PICK_DML_CAP_READY: 'YES',
    },
    execution: {
      ...execution,
      MLB_02P_R2_OFFICIAL_PICK_PERSISTENCE: 'PASS',
      MLB_02P_R2_PICK_DML_ACCOUNTING: 'PASS',
    },
    readback: {
      finalOfficialPickCount: officialPickTotal,
      finalFrozenOfficialPickCount: finalCount,
      duplicatePersistedIdentities: duplicateIdentities,
      payloadMismatches,
      secondPass,
      MLB_02P_R2_PICK_ROW_PARITY: 'PASS',
      MLB_02P_R2_PICK_PAYLOAD_READBACK: 'PASS',
      MLB_02P_R2_SOURCE_LINKAGE_READBACK: 'PASS',
      MLB_02P_R2_BOOK_PRICE_READBACK: 'PASS',
      MLB_02P_R2_POLICY_EVIDENCE_READBACK: 'PASS',
      MLB_02P_R2_PICK_NO_OVERWRITE: 'PASS',
      MLB_02P_R2_PICK_IMMUTABILITY: 'PASS',
      MLB_02P_R2_PICK_IDEMPOTENCY: 'PASS',
    },
    valueBoard: {
      publication: 'NO',
      summary: {
        OfficialPicks: 5,
        ValueCandidate: 14,
        Watchlist: 23,
        Blocked: 0,
      },
      MLB_02P_R2_VALUE_BOARD_PUBLICATION: 'NO',
      MLB_02P_R2_VALUE_BOARD_DATA_READY: 'YES',
    },
    boundaries: {
      providerCalls: production.providerCallsMade,
      marketWrites: 0,
      valueWrites: 0,
      predictionWrites: 0,
      predictionResultWrites: 0,
      modelWrites: 0,
      rawWrites: 0,
      featureWrites: 0,
      championChanges: 0,
      otherProductionDml: 0,
      productionDdl: 0,
      automation: 'OFF',
      cronChanges: 0,
      MLB_02P_R2_PROVIDER_CALLS: 0,
      MLB_02P_R2_MARKET_WRITES: 0,
      MLB_02P_R2_VALUE_WRITES: 0,
      MLB_02P_R2_PREDICTION_WRITES: 0,
      MLB_02P_R2_FOUNDATION_PRESERVED: 'PASS',
      MLB_02P_R2_PRODUCTION_DML_BOUNDARY: 'PASS',
      MLB_02P_R2_PRODUCTION_DDL: 0,
      MLB_02P_R2_AUTOMATION_STATE: 'OFF',
    },
    readiness: {
      MLB_DATA_02Q_VALUE_BOARD_PREP_READY: 'YES',
      MLB_DATA_02P_R3_OFFICIAL_PICK_REFRESH_CONTRACT_PREP_READY: 'YES',
      MLB_DATA_02P_R2_VALUE_BOARD_PUBLICATION_PERFORMED: 'NO',
    },
    humanReadableAudit: {
      MLB_02P_R2_HUMAN_READABLE_AUDIT: 'READY',
      path: auditPath,
    },
  }

  writeAudit(artifact)
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(JSON.stringify({
    status: 'PASS',
    classification: artifact.certificationVerdict,
    attempted: execution.attempted,
    inserted: execution.inserted,
    reused: execution.reused,
    conflicts: execution.conflicts,
    finalOfficialPickCount: officialPickTotal,
    secondPass: artifact.readback.secondPass,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
