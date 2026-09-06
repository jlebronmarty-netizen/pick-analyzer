import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const targetCommit = '728ed2a1771f522ffab1b29363f40ab31b4bfb29'
const artifactPath = 'docs/CERTIFICATION/mlb-data-02p-r2a-official-pick-table-schema-readback.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02p-r2a-official-pick-table-schema-readback-audit.md'
const r1Path = 'docs/CERTIFICATION/mlb-data-02p-r1-official-pick-execution-prep.json'

const requiredColumns = [
  'id',
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
  'created_at',
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

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
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

function scanRepo() {
  const output = execFileSync('rg', ['pick2_mlb_official_picks|pick2_official_picks|pick2_mlb_official_pick|official_pick_identity', '-n', '.'], { encoding: 'utf8' })
  const lines = output.split(/\r?\n/).filter(Boolean)
  const migrationLines = lines.filter((line) => line.includes('supabase') || line.includes('migrations'))
  return {
    matchCount: lines.length,
    migrationLines,
    migrationState: migrationLines.length ? 'MIGRATION_REFERENCES_FOUND' : 'NO_NATIVE_OFFICIAL_PICK_TABLE_MIGRATION_FOUND',
    repoTableDefinition: migrationLines.some((line) => /create\s+table/i.test(line)) ? 'FOUND' : 'NOT_FOUND',
    intendedTableName: 'public.pick2_mlb_official_picks',
    alternateNamesObserved: [...new Set(lines.flatMap((line) => ['pick2_official_picks', 'official_picks', 'pick2_mlb_official_pick'].filter((name) => line.includes(name))))],
  }
}

function classifyHelperState() {
  const helperPaths = [
    'scripts/mlb-data-02p-r2-official-pick-persistence-execution.mjs',
    'scripts/mlb-data-02p-r2-official-pick-persistence-execution-validate.mjs',
  ]
  const states = helperPaths.map((file) => ({
    file,
    exists: fs.existsSync(file),
    tracked: false,
  }))
  return {
    classification: states.every((row) => row.exists) ? 'USEFUL_FOR_FUTURE_R2' : 'PARTIAL',
    files: states,
  }
}

async function restProbe(db, table, select = 'id') {
  const { count, error } = await db.from(table).select(select, { count: 'exact', head: true }).limit(1)
  if (!error) return { table, state: 'REST_VISIBLE', count: count ?? 0, error: null }
  const state = error.code === 'PGRST205' ? 'PGRST205_SCHEMA_CACHE_MISS' : 'OTHER_REST_FAILURE'
  return { table, state, count: null, error: { code: error.code, message: error.message } }
}

async function schemaProbe(db, schema, table, select = '*') {
  const { data, error, count } = await db.schema(schema).from(table).select(select, { count: 'exact' }).limit(1)
  if (!error) return { schema, table, state: 'READABLE', count: count ?? data?.length ?? 0, error: null }
  return { schema, table, state: 'NOT_AVAILABLE', count: null, error: { code: error.code, message: error.message } }
}

async function main() {
  const db = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const repository = {
    branch: git(['branch', '--show-current']),
    localHead: git(['rev-parse', 'HEAD']),
    originMain: git(['rev-parse', 'origin/main']),
    statusShort: git(['status', '--short']),
  }
  const production = await productionVersion()
  const r1 = JSON.parse(fs.readFileSync(r1Path, 'utf8'))
  const repo = scanRepo()
  const helpers = classifyHelperState()

  const rest = {
    intended: await restProbe(db, 'pick2_mlb_official_picks', requiredColumns.join(',')),
    alternatePick2: await restProbe(db, 'pick2_official_picks', requiredColumns.join(',')),
    alternateLegacy: await restProbe(db, 'official_picks', requiredColumns.join(',')),
    singular: await restProbe(db, 'pick2_mlb_official_pick', 'id'),
  }
  const catalog = {
    informationSchemaTables: await schemaProbe(db, 'information_schema', 'tables', 'table_schema,table_name'),
    informationSchemaColumns: await schemaProbe(db, 'information_schema', 'columns', 'table_schema,table_name,column_name,data_type,is_nullable'),
    informationSchemaConstraints: await schemaProbe(db, 'information_schema', 'table_constraints', 'table_schema,table_name,constraint_name,constraint_type'),
    informationSchemaTriggers: await schemaProbe(db, 'information_schema', 'triggers', 'event_object_schema,event_object_table,trigger_name'),
    pgClass: await schemaProbe(db, 'pg_catalog', 'pg_class', 'relname,relkind'),
    pgIndexes: await schemaProbe(db, 'pg_catalog', 'pg_indexes', 'schemaname,tablename,indexname,indexdef'),
    pgTables: await schemaProbe(db, 'pg_catalog', 'pg_tables', 'schemaname,tablename,rowsecurity'),
  }

  const catalogAvailable = Object.values(catalog).some((row) => row.state === 'READABLE')
  const informationSchemaTableCount = catalogAvailable ? null : 'NOT_AVAILABLE'
  const pgClassTableCount = catalogAvailable ? null : 'NOT_AVAILABLE'
  const restVisibilityRestored = rest.intended.state === 'REST_VISIBLE'
  const rootCause = catalogAvailable
    ? 'OTHER_READONLY_SCHEMA_VISIBILITY_DEFECT'
    : restVisibilityRestored
      ? 'PRIOR_PGRST205_SCHEMA_CACHE_MISS_NOW_REST_VISIBLE_CATALOG_READBACK_NOT_AVAILABLE'
      : 'CATALOG_READBACK_NOT_AVAILABLE_REST_SCHEMA_CACHE_MISS'
  const verdict = 'MLB_DATA_02P_R2A_OFFICIAL_PICK_SCHEMA_DIAGNOSIS_BLOCKED'

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02P_R2A_OFFICIAL_PICK_TABLE_SCHEMA_READBACK_REPAIR',
    certificationVerdict: verdict,
    repository: {
      ...repository,
      MLB_02P_R2A_ALIGNMENT: repository.branch === 'main' && repository.localHead === targetCommit && repository.originMain === targetCommit && production.commit === targetCommit ? 'PASS' : 'FAIL',
    },
    production: {
      commit: production.commit,
      providerCallsMade: production.providerCallsMade,
      PRODUCTION_ALIGNMENT: production.commit === targetCommit ? 'PASS' : 'FAIL',
    },
    repoSchema: {
      ...repo,
      MLB_02P_R2A_REPO_TABLE_DEFINITION: repo.repoTableDefinition,
      MLB_02P_R2A_TABLE_NAME_CONTRACT: repo.intendedTableName === 'public.pick2_mlb_official_picks' ? 'PASS' : 'BLOCKED',
    },
    catalog: {
      informationSchemaTableCount,
      pgClassTableCount,
      columnReadback: 'NOT_AVAILABLE',
      constraintReadback: 'NOT_AVAILABLE',
      indexReadback: 'NOT_AVAILABLE',
      rlsReadback: 'NOT_AVAILABLE',
      triggerReadback: 'NOT_AVAILABLE',
      probes: catalog,
      MLB_02P_R2A_INFORMATION_SCHEMA_TABLE_COUNT: informationSchemaTableCount,
      MLB_02P_R2A_PG_CLASS_TABLE_COUNT: pgClassTableCount,
      MLB_02P_R2A_COLUMN_READBACK: 'NOT_AVAILABLE',
      MLB_02P_R2A_CONSTRAINT_READBACK: 'NOT_AVAILABLE',
      MLB_02P_R2A_INDEX_READBACK: 'NOT_AVAILABLE',
      MLB_02P_R2A_RLS_READBACK: 'NOT_AVAILABLE',
      MLB_02P_R2A_TRIGGER_READBACK: 'NOT_AVAILABLE',
    },
    rest: {
      ...rest,
      MLB_02P_R2A_REST_VISIBILITY: rest.intended.state,
    },
    diagnosis: {
      MLB_02P_R2A_ROOT_CAUSE: rootCause,
      MLB_02P_R2A_OFFICIAL_PICK_MIGRATION_STATE: repo.migrationState,
      MLB_02P_R2A_EXISTING_MIGRATION_SAFETY: 'N/A',
      MLB_02P_R2A_SCHEMA_PREP_REQUIRED: restVisibilityRestored ? 'NO_REST_SCHEMA_PRESENT_PENDING_CATALOG_PROOF' : 'UNKNOWN_PENDING_CATALOG_READBACK',
      MLB_02P_R2A_SCHEMA_CACHE_REPAIR_REQUIRED: restVisibilityRestored ? 'NO_CURRENT_REST_CACHE_MISS' : 'UNKNOWN_PENDING_CATALOG_READBACK',
      MLB_02P_R2A_TABLE_NAME_REPAIR_REQUIRED: rest.alternatePick2.state === 'REST_VISIBLE' || rest.alternateLegacy.state === 'REST_VISIBLE' ? 'POSSIBLE_PENDING_SEMANTIC_AUDIT' : 'NO_EVIDENCE',
    },
    contracts: {
      requiredColumns,
      sourceFks: [
        'prediction_id -> public.pick2_game_predictions(id)',
        'value_evaluation_id -> public.pick2_mlb_market_value_evaluations(id)',
        'game_pk -> public.pick2_mlb_games(game_pk)',
      ],
      identity: 'UNIQUE(official_pick_identity)',
      immutability: 'immutable snapshot semantics with no-update/no-delete guards',
      MLB_02P_R2A_REQUIRED_SCHEMA_CONTRACT: 'READY',
      MLB_02P_R2A_REQUIRED_FK_CONTRACT: 'READY',
      MLB_02P_R2A_REQUIRED_IMMUTABILITY_CONTRACT: 'READY',
    },
    frozenSet: {
      count: r1.payload.rows.length,
      policyVersion: r1.policy.version,
      topCandidate: r1.eligibleSet.candidates[0],
      MLB_02P_R2A_FROZEN_PICK_SET_PRESERVED: r1.payload.rows.length === 5 ? 'PASS' : 'FAIL',
      MLB_02P_R2A_POLICY_PRESERVED: r1.policy.version === 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1' ? 'PASS' : 'FAIL',
    },
    boundaries: {
      officialPickInserts: 0,
      officialPickUpdates: 0,
      officialPickDeletes: 0,
      otherProductionDml: 0,
      productionDdl: 0,
      providerCalls: production.providerCallsMade,
      MLB_02P_R2A_OFFICIAL_PICK_DML: 0,
      MLB_02P_R2A_PRODUCTION_MUTATIONS: 0,
      MLB_02P_R2A_PROVIDER_CALLS: production.providerCallsMade,
    },
    untrackedHelpers: {
      ...helpers,
      MLB_02P_R2A_UNTRACKED_HELPER_STATE: helpers.classification,
    },
    futureRepairPlan: {
      recommendedNextPhase: catalogAvailable
        ? 'MLB_DATA_02P_R2B_OFFICIAL_PICK_TABLE_SCHEMA_PREP'
        : restVisibilityRestored
          ? 'MLB_DATA_02P_R2_RETRY_OFFICIAL_PICK_PERSISTENCE_EXECUTION'
          : 'MLB_DATA_02P_R2A_SQL_CATALOG_READBACK_REQUIRED',
      notes: [
        'Do not insert Official Picks until public.pick2_mlb_official_picks is REST-visible with the required schema.',
        'If catalog proves absence, prepare an additive table migration only.',
        'If catalog proves presence, diagnose PostgREST exposure/cache without creating a duplicate table.',
      ],
    },
  }

  const audit = `# MLB Data 02P R2A Official Pick Table Schema Readback

## Verdict

${artifact.certificationVerdict}

## Root Cause

${artifact.diagnosis.MLB_02P_R2A_ROOT_CAUSE}

## Findings

- Production commit: \`${artifact.production.commit}\`
- Intended table: \`${artifact.repoSchema.intendedTableName}\`
- Repo table definition: ${artifact.repoSchema.MLB_02P_R2A_REPO_TABLE_DEFINITION}
- Migration state: ${artifact.diagnosis.MLB_02P_R2A_OFFICIAL_PICK_MIGRATION_STATE}
- REST visibility: ${artifact.rest.MLB_02P_R2A_REST_VISIBILITY}
- information_schema table count: ${artifact.catalog.MLB_02P_R2A_INFORMATION_SCHEMA_TABLE_COUNT}
- pg_class table count: ${artifact.catalog.MLB_02P_R2A_PG_CLASS_TABLE_COUNT}

## Boundaries

- Official Pick DML: 0
- Other production DML: 0
- Production DDL: 0
- Provider calls: ${artifact.boundaries.providerCalls}
- Value Board publication: NO

## Future Path

${artifact.futureRepairPlan.notes.map((note) => `- ${note}`).join('\n')}
`

  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, audit)
  console.log(JSON.stringify({
    status: artifact.certificationVerdict.endsWith('_BLOCKED') ? 'BLOCKED' : 'PASS',
    classification: artifact.certificationVerdict,
    productionCommit: artifact.production.commit,
    restVisibility: artifact.rest.MLB_02P_R2A_REST_VISIBILITY,
    rootCause: artifact.diagnosis.MLB_02P_R2A_ROOT_CAUSE,
    migrationState: artifact.diagnosis.MLB_02P_R2A_OFFICIAL_PICK_MIGRATION_STATE,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
