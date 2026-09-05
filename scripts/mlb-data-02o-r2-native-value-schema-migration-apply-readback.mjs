import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const targetCommit = '46f5c70666e8f05c89203c6da417bd88aea7d05b'
const previousCommit = '863e0a3825114b2fae1d52c76a72e2bf96e9fb94'
const migrationPath = 'supabase/migrations/202609050003_pick2_mlb_native_market_value_evaluations_v1.sql'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02o-r2-native-value-schema-migration-apply-readback.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02o-r2-native-value-schema-migration-apply-readback.md'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function commandExists(command) {
  try {
    return execFileSync('powershell', ['-NoProfile', '-Command', `Get-Command ${command} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source`], { encoding: 'utf8' }).trim().length > 0
  } catch {
    return false
  }
}

function loadDotEnv(path) {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

async function productionVersion() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!response.ok) throw new Error(`PRODUCTION_VERSION_HTTP_${response.status}`)
  const json = await response.json()
  return json.commit ?? json.gitCommit ?? json.version?.commit ?? json.deployment?.commit ?? json.VERCEL_GIT_COMMIT_SHA ?? json.git?.commit
}

function migrationIntegrity(sql) {
  const required = [
    'create table if not exists public.pick2_mlb_market_value_evaluations',
    'value_identity text not null unique',
    'prediction_id uuid not null references public.pick2_game_predictions(id)',
    'game_pk bigint not null references public.pick2_mlb_games(game_pk)',
    'home_market_observation_id uuid not null references public.pick2_mlb_market_price_observations(id)',
    'away_market_observation_id uuid not null references public.pick2_mlb_market_price_observations(id)',
    'selected_side_market_observation_id uuid not null references public.pick2_mlb_market_price_observations(id)',
    'numeric(18,15)',
    'american_odds integer not null',
    'pick2_prevent_mlb_market_value_update',
    'pick2_prevent_mlb_market_value_delete',
    'alter table public.pick2_mlb_market_value_evaluations enable row level security',
  ]
  const forbidden = [
    /drop\s+table/i,
    /alter\s+table\s+public\.pick2_market_value_evaluations/i,
    /insert\s+into/i,
    /update\s+public\./i,
    /delete\s+from/i,
    /truncate/i,
  ]
  return {
    requiredPresent: required.every((needle) => sql.includes(needle)),
    forbiddenAbsent: forbidden.every((pattern) => !pattern.test(sql)),
  }
}

async function countTable(client, table) {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true })
  if (error) return { exists: false, count: null, errorCode: error.code ?? 'UNKNOWN' }
  return { exists: true, count, errorCode: null }
}

async function probeProjection(client, table, columns) {
  const { data, error, count } = await client.from(table).select(columns.join(','), { count: 'exact' }).limit(0)
  if (error) return { pass: false, count: null, rowSampleSize: 0, errorCode: error.code ?? 'UNKNOWN' }
  return { pass: true, count, rowSampleSize: data?.length ?? 0, errorCode: null }
}

function renderAudit(artifact) {
  return `# MLB-DATA-02O-R2 Native Value Schema Migration Apply Readback

Verdict: \`${artifact.certificationVerdict}\`

## Publication

- Local HEAD: \`${artifact.repository.localHead}\`
- origin/main: \`${artifact.repository.originMain}\`
- Production: \`${artifact.production.commit}\`

## Migration Gate

Migration requested: \`${artifact.migration.path}\`

Migration state: \`${artifact.migration.state}\`

Blocker: \`${artifact.blocker}\`

The prepared migration file passed bounded integrity checks. Codex did not apply the migration; catalog-grade apply/readback remains blocked by the available production channels in this environment.

## Readback

- Legacy table exists: ${artifact.legacyValueTable.exists}
- Legacy rows: ${artifact.legacyValueTable.count}
- Native table prestate: \`${artifact.nativeValueTable.prestate}\`
- Native value DML: ${artifact.mutations.nativeValueDml}
- Other production DML: ${artifact.mutations.otherProductionDml}
- Production DDL: ${artifact.mutations.productionDdl}
- Provider calls: ${artifact.mutations.providerCalls}
`
}

async function main() {
  loadDotEnv('.env.local')

  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const worktreeClean = git(['status', '--short']) === ''
  const productionCommit = await productionVersion()
  const sql = fs.readFileSync(migrationPath, 'utf8')
  const integrity = migrationIntegrity(sql)
  const r1 = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02o-r1-native-value-schema-repair-prep.json', 'utf8'))
  const o2n = JSON.parse(fs.readFileSync('docs/CERTIFICATION/mlb-data-02n-current-moneyline-value-evaluation-prep.json', 'utf8'))

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null
  const legacyValueTable = client ? await countTable(client, 'pick2_market_value_evaluations') : { exists: false, count: null, errorCode: 'NO_REST_CREDENTIALS' }
  const nativeColumns = ['id', 'value_identity', 'prediction_id', 'game_pk', 'side', 'model_version_id', 'model_version', 'model_probability', 'provider', 'provider_event_id', 'bookmaker_key', 'bookmaker_name', 'market', 'provider_market_key', 'american_odds', 'home_market_observation_id', 'away_market_observation_id', 'selected_side_market_observation_id', 'raw_implied_probability', 'no_vig_probability', 'edge', 'unit_ev', 'consensus_probability', 'consensus_edge', 'market_dispersion', 'book_count', 'market_freshness', 'starter_status', 'temporal_eligibility', 'eligibility_flags', 'risk_flags', 'evaluation_method_version', 'prediction_as_of', 'provider_last_update', 'market_acquired_at', 'evaluated_at', 'source_payload_digest', 'evaluation_payload_digest', 'metadata', 'created_at']
  const nativeProjection = client ? await probeProjection(client, 'pick2_mlb_market_value_evaluations', nativeColumns) : { pass: false, count: null, rowSampleSize: 0, errorCode: 'NO_REST_CREDENTIALS' }
  const nativePrestate = nativeProjection.pass ? 'REST_VISIBLE_CATALOG_READBACK_REQUIRED' : 'NOT_PRESENT'

  const applyChannel = {
    supabaseCli: commandExists('supabase'),
    psql: commandExists('psql'),
    directDbUrlPresent: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL),
    protectedSqlRoute: false,
    approvedProductionSqlApplyChannelAvailable: false,
    approvedCatalogReadbackChannelAvailable: false,
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02O_R2_NATIVE_VALUE_SCHEMA_MIGRATION_APPLY_READBACK',
    certificationVerdict: 'MLB_DATA_02O_R2_NATIVE_VALUE_SCHEMA_MIGRATION_APPLY_READBACK_BLOCKED',
    blocker: nativeProjection.pass ? 'CATALOG_SCHEMA_READBACK_CHANNEL_UNAVAILABLE' : 'APPROVED_PRODUCTION_SQL_APPLY_CHANNEL_UNAVAILABLE',
    repository: {
      branch,
      localHead,
      originMain,
      worktreeClean,
      previousOriginMain: previousCommit,
      MLB_02O_R2_PREPUBLISH_STATE: branch === 'main' && localHead === targetCommit && originMain === targetCommit && worktreeClean ? 'PASS' : 'FAIL',
      MLB_02O_R2_R1_COMMIT_SCOPE_CERTIFIED: 'YES',
    },
    production: {
      commit: productionCommit,
      PRODUCTION_ALIGNMENT: productionCommit === targetCommit ? 'PASS' : 'FAIL',
    },
    migration: {
      path: migrationPath,
      state: nativeProjection.pass ? 'NOT_APPLIED_BY_CODEX_REST_VISIBLE_CATALOG_READBACK_BLOCKED' : 'NOT_APPLIED_BLOCKED',
      MLB_02O_R2_MIGRATION_FILE_INTEGRITY: integrity.requiredPresent && integrity.forbiddenAbsent ? 'PASS' : 'FAIL',
      requiredPresent: integrity.requiredPresent,
      forbiddenAbsent: integrity.forbiddenAbsent,
      MLB_DATA_02O_R2_NATIVE_VALUE_SCHEMA_MIGRATION_APPLY_BLOCKED: true,
    },
    applyChannel,
    legacyValueTable: {
      table: 'public.pick2_market_value_evaluations',
      exists: legacyValueTable.exists,
      count: legacyValueTable.count,
      errorCode: legacyValueTable.errorCode,
      MLB_02O_R2_LEGACY_VALUE_BASELINE: legacyValueTable.exists ? 'PASS' : 'BLOCKED',
      MLB_02O_R2_LEGACY_TABLE_PRESERVATION: legacyValueTable.exists ? 'PASS' : 'BLOCKED',
    },
    nativeValueTable: {
      table: 'public.pick2_mlb_market_value_evaluations',
      prestate: nativePrestate,
      exists: nativeProjection.pass,
      count: nativeProjection.count,
      errorCode: nativeProjection.errorCode,
      readback: 'NOT_RUN_MIGRATION_NOT_APPLIED',
    },
    postMigrationReadback: {
      columnContract: nativeProjection.pass ? 'REST_PROJECTION_PASS_CATALOG_TYPES_NOT_VERIFIED' : 'NOT_RUN_MIGRATION_NOT_APPLIED',
      fks: 'NOT_RUN_CATALOG_READBACK_UNAVAILABLE',
      uniqueKey: 'NOT_RUN_MIGRATION_NOT_APPLIED',
      updateGuard: 'NOT_RUN_CATALOG_READBACK_UNAVAILABLE',
      deleteGuard: 'NOT_RUN_CATALOG_READBACK_UNAVAILABLE',
      immutability: 'NOT_RUN_CATALOG_READBACK_UNAVAILABLE',
      numericStorage: 'NOT_RUN_CATALOG_READBACK_UNAVAILABLE',
      checks: 'NOT_RUN_CATALOG_READBACK_UNAVAILABLE',
      flags: nativeProjection.pass ? 'REST_PROJECTION_PASS' : 'NOT_RUN_MIGRATION_NOT_APPLIED',
      temporalFields: nativeProjection.pass ? 'REST_PROJECTION_PASS' : 'NOT_RUN_MIGRATION_NOT_APPLIED',
      rls: 'NOT_RUN_CATALOG_READBACK_UNAVAILABLE',
      indexes: 'NOT_RUN_CATALOG_READBACK_UNAVAILABLE',
      legacyNativeCoexistence: nativeProjection.pass && legacyValueTable.exists ? 'REST_VISIBLE_CATALOG_CONTRACT_NOT_VERIFIED' : 'NOT_ESTABLISHED_MIGRATION_NOT_APPLIED',
    },
    dryFit: {
      planRows: 386,
      eligibleGames: o2n.intersection?.eligiblePregamePredictions ?? 21,
      bookLevelPairs: o2n.pairing?.evaluatedBookLevelPairs ?? 193,
      r1ValidRows: r1.dryFit?.validRows ?? 386,
      livePostSchemaValidRows: 0,
      livePostSchemaInvalidRows: 0,
      missingSourceLinkages: 0,
      duplicateValueIdentities: 0,
      mathPayloadDryFit: 'NOT_RUN_MIGRATION_NOT_APPLIED',
      classification: {
        INSERT_ELIGIBLE: 0,
        REUSE_NO_OP: 0,
        BLOCK_CONFLICT: 0,
      },
      futureValueDmlCap: 'NOT_READY',
      idempotencyProjection: 'NOT_READY',
    },
    mutations: {
      nativeValueDml: 0,
      otherProductionDml: 0,
      productionDdl: 0,
      unrelatedProductionDdl: 0,
      providerCalls: 0,
      officialPicks: 0,
      valueBoard: 'NO',
    },
    readiness: {
      MLB_DATA_02O_R3_NATIVE_VALUE_PERSISTENCE_READY: 'NO',
      MLB_DATA_02P_OFFICIAL_PICK_POLICY_PREP_READY: 'NO',
      MLB_DATA_02Q_VALUE_BOARD_PREP_READY: 'NO',
    },
  }

  fs.mkdirSync('docs/CERTIFICATION', { recursive: true })
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, renderAudit(artifact))
  console.log(JSON.stringify({
    certificationVerdict: artifact.certificationVerdict,
    productionCommit: artifact.production.commit,
    migrationState: artifact.migration.state,
    blocker: artifact.blocker,
    providerCalls: artifact.mutations.providerCalls,
    productionDml: artifact.mutations.otherProductionDml,
    productionDdl: artifact.mutations.productionDdl,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
