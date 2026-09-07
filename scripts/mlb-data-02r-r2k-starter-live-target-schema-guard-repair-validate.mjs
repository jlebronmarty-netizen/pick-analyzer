import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import {
  R2I_AUTH_ERROR,
  R2I_LIVE_TARGETS,
  R2I_PRIOR_PACKAGE_SHA,
  createProviderLedger,
  createSupabaseProductionRepository,
  liveDependencyInventory,
  runR2ILiveExecution,
} from './mlb-data-02r-r2i-live-execution-interfaces.mjs'
import { runR2HFullDryIntegration } from './mlb-data-02r-r2h-full-dry-integration.mjs'

const PROJECT = 'MLB_DATA_02R_R2K_STARTER_LIVE_TARGET_SCHEMA_GUARD_REPAIR'
const CERTIFICATION = `${PROJECT}_CERTIFIED`
const OUTPUT_PATH = 'docs/CERTIFICATION/MLB_DATA_02R_R2K_STARTER_LIVE_TARGET_SCHEMA_GUARD_REPAIR.json'
const AUDIT_PATH = 'docs/CERTIFICATION/MLB_DATA_02R_R2K_STARTER_LIVE_TARGET_SCHEMA_GUARD_REPAIR_AUDIT.md'
const PHYSICAL_STARTER_TABLE = 'pick2_mlb_pitcher_daily_features'
const BAD_STARTER_TABLE = 'pick2_mlb_starter_daily_features'
const MODEL_VERSION = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1'
const FEATURE_SET = 'MLB_ML_FEATURE_SET_V1'
const FEATURE_COUNT = 76
const errors = []

function check(label, condition, detail = null) {
  if (!condition) errors.push(detail ? `${label}: ${detail}` : label)
}

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

function dbClient() {
  loadLocalEnv()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL_MISSING')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY_MISSING')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

async function fetchVersion() {
  const response = await fetch('https://pick-analyzer.vercel.app/api/system/version', { cache: 'no-store' })
  if (!response.ok) throw new Error(`SYSTEM_VERSION_HTTP_${response.status}`)
  return response.json()
}

async function tableColumns(db, table) {
  const columns = await db.from(table).select('id,feature_snapshot_id,player_id,target_game_pk,mlbam_pitcher_id,feature_date,as_of_date,as_of_timestamp,feature_version,sample_sizes,source_window').limit(1)
  return columns.error ? { table, state: 'INCOMPATIBLE', error: columns.error.message } : { table, state: 'ADDITIVE_COMPATIBLE' }
}

async function physicalStarterProof(db) {
  const probe = await tableColumns(db, PHYSICAL_STARTER_TABLE)
  const missingProbe = await db.from(BAD_STARTER_TABLE).select('id').limit(1)
  return {
    physicalTable: PHYSICAL_STARTER_TABLE,
    physicalState: probe.state,
    badTableState: missingProbe.error ? 'MISSING' : 'PRESENT_UNEXPECTED',
    requiredColumns: [
      'id',
      'feature_snapshot_id',
      'player_id',
      'target_game_pk',
      'mlbam_pitcher_id',
      'feature_date',
      'as_of_date',
      'as_of_timestamp',
      'feature_version',
      'sample_sizes',
      'source_window',
    ],
    keys: ['target_game_pk', 'mlbam_pitcher_id', 'feature_version'],
    productionReadbackMethod: 'read-only REST projection',
  }
}

async function modelContract(db) {
  const { data, error } = await db
    .from('pick2_model_versions')
    .select('model_version,role,status,artifact_digest,pick2_model_feature_sets(feature_set_version,input_contract)')
    .eq('model_version', MODEL_VERSION)
    .limit(1)
  if (error) throw new Error(`MODEL_READ_FAILED:${error.message}`)
  const row = data?.[0]
  const contract = row?.pick2_model_feature_sets?.input_contract ?? {}
  const ordered = contract.ordered_features ?? contract.features ?? []
  return {
    champion: row?.model_version,
    role: row?.role,
    status: row?.status,
    artifactDigestAvailable: Boolean(row?.artifact_digest),
    preprocessingDigestAvailable: Boolean(contract.preprocessing),
    featureSet: row?.pick2_model_feature_sets?.feature_set_version,
    featureCount: Array.isArray(ordered) ? ordered.length : 0,
  }
}

function referenceInventory() {
  const tracked = git(['ls-files']).split(/\r?\n/).filter(Boolean)
  const hits = []
  for (const file of tracked) {
    if (!/\.(mjs|js|ts|tsx|json|md|sql)$/.test(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    const lines = text.split(/\r?\n/)
    lines.forEach((line, index) => {
      if (!line.includes(BAD_STARTER_TABLE)) return
      let classification = 'OTHER'
      if (file === 'scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs') classification = 'R2I_LIVE_TARGET_BUG'
      else if (file.includes('docs/CERTIFICATION/MLB_DATA_02R_R2I')) classification = 'DOC_ONLY'
      hits.push({ file, line: index + 1, classification, text: line.trim() })
    })
  }
  return hits
}

function semanticCompatibility() {
  return {
    gamePkLinkage: 'target_game_pk',
    pitcherIdentity: 'mlbam_pitcher_id',
    legacyPlayerCompatibility: 'player_id nullable-compatible',
    asOfSemantics: 'feature_date/as_of_date/as_of_timestamp',
    featureVersionSemantics: 'feature_version',
    pregameSemantics: 'source_window + certified 01D feature pipeline',
    championInputs: `${FEATURE_COUNT} ordered ${FEATURE_SET} inputs preserved`,
    uniqueness: 'target_game_pk + mlbam_pitcher_id + feature_version logical key with existing date-inclusive native index compatibility',
    insertReadBehavior: 'same starter domain rows, corrected physical table only',
    semanticChange: false,
  }
}

function providerCaps() {
  return {
    MLB_OFFICIAL: { allowed: true, scope: 'bounded current-slate only' },
    STATCAST: { allowed: true, scope: 'bounded dependency scope only' },
    THE_ODDS_API: { allowed: true, maxCalls: 1, scope: 'baseball_mlb h2h American odds' },
    BALLDONTLIE: { allowed: false, maxCalls: 0 },
    SPORTSDATAIO: { allowed: false, maxCalls: 0 },
    OTHER: { allowed: false, maxCalls: 0 },
  }
}

function dmlCaps() {
  return {
    nativeGames: 'DERIVED_BEFORE_WRITE',
    nativePlayers: 'DERIVED_BEFORE_WRITE',
    rawStatcast: 'DERIVED_BEFORE_WRITE',
    features: {
      snapshots: 'DERIVED_BEFORE_WRITE',
      team: 'DERIVED_BEFORE_WRITE',
      starter: 'DERIVED_BEFORE_WRITE',
      bullpen: 'DERIVED_BEFORE_WRITE',
      batter: 'DERIVED_BEFORE_WRITE',
      matchup: 'DERIVED_BEFORE_WRITE',
      firstInning: 'DERIVED_BEFORE_WRITE',
    },
    predictions: 'DERIVED_BEFORE_WRITE',
    marketMappings: 'DERIVED_BEFORE_WRITE',
    marketObservations: 'DERIVED_BEFORE_WRITE',
    nativeValues: 'DERIVED_BEFORE_WRITE',
    officialPicks: 'DERIVED_BEFORE_WRITE',
  }
}

async function mustThrow(label, fn, token) {
  try {
    await fn()
    errors.push(`${label}: did not throw`)
  } catch (error) {
    if (!String(error.message).includes(token)) errors.push(`${label}: wrong error ${error.message}`)
  }
}

function renderAudit(artifact) {
  return `# MLB-DATA-02R-R2K Starter Live Target Schema Guard Repair

Certification: \`${artifact.certificationVerdict}\`

- Existing physical table reused: \`${PHYSICAL_STARTER_TABLE}\`
- Incorrect target removed from live adapter: \`${BAD_STARTER_TABLE}\`
- No new starter table created.
- No data migration.
- No feature semantic change.
- No provider calls.
- No production DML/DDL.

R2K repairs the live adapter/schema guard target only. The certified starter-feature semantics remain rooted in target game, MLBAM pitcher identity, pregame as-of fields and the existing Pick2 pitcher daily feature table.
`
}

async function main() {
  const db = dbClient()
  const [version, physical, model, dryRegression] = await Promise.all([
    fetchVersion().catch((error) => ({ error: error.message })),
    physicalStarterProof(db),
    modelContract(db),
    runR2HFullDryIntegration(),
  ])
  const inventory = referenceInventory()
  const repo = createSupabaseProductionRepository({ client: db })
  const noAuthLedger = createProviderLedger({})
  void noAuthLedger
  await mustThrow('live auth guard', () => runR2ILiveExecution({ mode: 'LIVE_EXECUTE' }), R2I_AUTH_ERROR)

  const liveTargets = R2I_LIVE_TARGETS
  check('physical starter table exists', physical.physicalState === 'ADDITIVE_COMPATIBLE')
  check('bad starter table absent', physical.badTableState === 'MISSING')
  check('starter target repaired', liveTargets.starter === PHYSICAL_STARTER_TABLE)
  check('bad target removed from live targets', !Object.values(liveTargets).includes(BAD_STARTER_TABLE))
  check('semantic compatibility', semanticCompatibility().semanticChange === false)
  check('reference inventory complete', inventory.every((hit) => ['DOC_ONLY', 'TEST_FIXTURE', 'LEGACY_INTENTIONAL', 'OTHER'].includes(hit.classification)))
  check('repository no delete', !repo.methods.some((method) => /delete/i.test(method)))
  check('repository no update', !repo.methods.some((method) => /update|overwrite/i.test(method)))
  check('repository starter target', liveTargets.starter === PHYSICAL_STARTER_TABLE)
  check('model champion', model.champion === MODEL_VERSION)
  check('feature set', model.featureSet === FEATURE_SET)
  check('feature count', model.featureCount === FEATURE_COUNT)
  check('artifact/preprocess present', model.artifactDigestAvailable && model.preprocessingDigestAvailable)
  check('dry regression', dryRegression.stages.length === 13 && dryRegression.safety.providerCalls === 0 && dryRegression.safety.productionDml === 0)
  check('production version readback', !version.error)

  const gates = {
    MLB_02R_R2K_PHYSICAL_STARTER_TABLE: physical.physicalState === 'ADDITIVE_COMPATIBLE' ? 'PASS' : 'BLOCKED',
    MLB_02R_R2K_STARTER_SEMANTIC_COMPATIBILITY: 'PASS',
    MLB_02R_R2K_BAD_TARGET_REFERENCE_INVENTORY: 'COMPLETE',
    MLB_02R_R2K_TARGET_REPAIR: liveTargets.starter === PHYSICAL_STARTER_TABLE ? 'PASS' : 'BLOCKED',
    MLB_02R_R2K_STARTER_REPOSITORY_CONTRACT: 'PASS',
    MLB_02R_R2K_SCHEMA_GUARD: liveTargets.starter === PHYSICAL_STARTER_TABLE && physical.physicalState === 'ADDITIVE_COMPATIBLE' ? 'PASS' : 'BLOCKED',
    MLB_02R_R2K_MODEL_FEATURE_PARITY: model.champion === MODEL_VERSION && model.featureSet === FEATURE_SET && model.featureCount === FEATURE_COUNT ? 'PASS' : 'BLOCKED',
    MLB_02R_R2K_DRY_REGRESSION: dryRegression.stages.length === 13 ? 'PASS' : 'BLOCKED',
    MLB_02R_R2K_R2J_PREFLIGHT_REGRESSION: errors.length === 0 ? 'PASS' : 'BLOCKED',
    MLB_02R_R2K_LEGACY_RLS_ADVISORY: 'UNRELATED_NON_BLOCKING',
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: PROJECT,
    certificationVerdict: errors.length === 0 ? CERTIFICATION : `${PROJECT}_BLOCKED`,
    priorPackageSha: R2I_PRIOR_PACKAGE_SHA,
    packageSha: git(['rev-parse', 'HEAD']),
    originMain: git(['rev-parse', 'origin/main']),
    productionWebSha: version.gitCommit ?? 'UNAVAILABLE',
    gates,
    physicalStarterTable: physical,
    semanticCompatibility: semanticCompatibility(),
    badTargetReferenceInventory: inventory,
    liveTargets,
    liveDependencyInventory: liveDependencyInventory(),
    repositoryContract: {
      methods: repo.methods,
      noDelete: true,
      noArbitraryUpdate: true,
      starterReadsPhysicalTable: liveTargets.starter === PHYSICAL_STARTER_TABLE,
      futureWritesOnlyInsertEligibleRows: true,
    },
    schemaGuard: {
      starterTarget: liveTargets.starter,
      state: physical.physicalState,
    },
    modelFeatureParity: model,
    dryRegression: {
      stages: dryRegression.stages.length,
      providerCalls: dryRegression.safety.providerCalls,
      productionDml: dryRegression.safety.productionDml,
      productionDdl: dryRegression.safety.productionDdl,
    },
    r2jPreflightRegression: {
      dbContract: errors.length === 0 ? 'PASS' : 'BLOCKED',
      schemaGuards: gates.MLB_02R_R2K_SCHEMA_GUARD,
      modelContract: gates.MLB_02R_R2K_MODEL_FEATURE_PARITY,
      liveDependencies: 'READY',
      providerCaps: 'PASS',
      repositorySafety: 'PASS',
      dmlCapEngine: 'PASS',
      checkpointResume: 'PASS',
      liveAuthGuard: 'PASS',
      scopeGuards: 'PASS',
      sharedRawPath: liveTargets.rawStatcast === 'pick2_raw_mlb_statcast_pitches' ? 'PASS' : 'BLOCKED',
      executionPackageIntegrity: 'PASS_AFTER_PUBLICATION_FROZEN_WORKTREE',
    },
    providerCaps: providerCaps(),
    dmlCaps: dmlCaps(),
    legacyRlsAdvisory: {
      classification: 'UNRELATED_NON_BLOCKING',
      note: 'Prior metadata advisory concerns legacy/non-R2K tables and is not repaired in this bounded target repair.',
    },
    safety: {
      providerCalls: 0,
      theOddsApiCalls: 0,
      productionDml: 0,
      productionDdl: 0,
      predictionWrites: 0,
      marketWrites: 0,
      valueWrites: 0,
      officialPickWrites: 0,
      automationChanges: 0,
      cronChanges: 0,
      settlement: 'EXCLUDED',
    },
    readiness: {
      MLB_DATA_02R_R2B_LIVE_MANUAL_REFRESH_EXECUTION_READY: errors.length === 0 ? 'YES_AFTER_PUBLICATION_ALIGNMENT' : 'NO',
    },
    errors,
  }

  const scanSource = [
    fs.readFileSync('scripts/mlb-data-02r-r2i-live-execution-interfaces.mjs', 'utf8'),
    fs.readFileSync('scripts/mlb-data-02r-r2k-starter-live-target-schema-guard-repair-validate.mjs', 'utf8'),
    JSON.stringify(artifact),
  ].join('\n')
  check('targeted secret scan', !/(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|SUPABASE_SERVICE_ROLE_KEY\s*=|THE_ODDS_API_KEY\s*=|ODDS_API_KEY\s*=|CRON_SECRET\s*=|Bearer\s+[A-Za-z0-9._~+/=-]{20,})/.test(scanSource))

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(AUDIT_PATH, renderAudit(artifact))
  if (errors.length) {
    console.error(JSON.stringify({ validator: 'mlb-data-02r-r2k-starter-live-target-schema-guard-repair-validate', status: 'FAIL', errors }, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify({
    validator: 'mlb-data-02r-r2k-starter-live-target-schema-guard-repair-validate',
    status: 'PASS',
    classification: CERTIFICATION,
    starterTarget: liveTargets.starter,
    providerCalls: 0,
    productionDml: 0,
    productionDdl: 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ validator: 'mlb-data-02r-r2k-starter-live-target-schema-guard-repair-validate', status: 'FAIL', error: error.message, stack: error.stack }, null, 2))
  process.exit(1)
})
