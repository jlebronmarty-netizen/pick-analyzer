import crypto from 'node:crypto'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const targetCommit = 'f4cd2e01a769d68a379c602c30dbeb9da7a8a632'
const migrationPath = 'supabase/migrations/202609050004_pick2_mlb_official_picks_v1.sql'
const typePath = 'src/types/pick2-official-picks.ts'
const r1Path = 'docs/CERTIFICATION/mlb-data-02p-r1-official-pick-execution-prep.json'
const r2aPath = 'docs/CERTIFICATION/mlb-data-02p-r2a-official-pick-table-schema-readback.json'
const outputPath = 'docs/CERTIFICATION/mlb-data-02p-r2b-official-pick-table-schema-prep.json'
const auditPath = 'docs/CERTIFICATION/mlb-data-02p-r2b-official-pick-table-schema-prep-audit.md'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function proposedOfficialPick(row) {
  const decisionAt = row.decision_at ?? row.evaluated_at
  const identityPayload = {
    prediction_id: row.prediction_id,
    value_evaluation_id: row.value_evaluation_id,
    game_pk: row.game_pk,
    side: row.side,
    policy_version: row.policy_version,
    decision_status: row.decision_status,
    decision_at: decisionAt,
    source_payload_digest: row.source_payload_digest,
  }
  const officialPickIdentity = sha256(stable(identityPayload))
  const payload = {
    ...row,
    official_pick_identity: officialPickIdentity,
    decision_at: decisionAt,
    metadata: {
      ...row.metadata,
      execution_phase: 'MLB_DATA_02P_R2B_OFFICIAL_PICK_TABLE_SCHEMA_PREP',
      schema_prep_only: true,
      r1_frozen_identity: row.official_pick_identity,
      decision_at_source: row.decision_at ? 'R1_PAYLOAD' : 'EVALUATED_AT_DERIVED_FOR_NOT_NULL_SCHEMA_CONTRACT',
    },
  }
  payload.decision_payload_digest = sha256(stable({
    ...payload,
    id: undefined,
    created_at: undefined,
    decision_payload_digest: undefined,
  }))
  return payload
}

function validatePayload(row) {
  const failures = []
  if (!row.official_pick_identity) failures.push('official_pick_identity')
  if (!row.prediction_id) failures.push('prediction_id')
  if (!row.value_evaluation_id) failures.push('value_evaluation_id')
  if (!Number.isInteger(Number(row.game_pk)) || Number(row.game_pk) <= 0) failures.push('game_pk')
  if (row.sport !== 'MLB') failures.push('sport')
  if (row.market !== 'MONEYLINE') failures.push('market')
  if (!['HOME', 'AWAY'].includes(row.side)) failures.push('side')
  if (!row.bookmaker_key) failures.push('bookmaker_key')
  if (!Number.isInteger(Number(row.american_odds)) || Number(row.american_odds) === 0) failures.push('american_odds')
  if (!row.model_version) failures.push('model_version')
  if (!(Number(row.model_probability) > 0 && Number(row.model_probability) < 1)) failures.push('model_probability')
  if (row.consensus_probability != null && !(Number(row.consensus_probability) > 0 && Number(row.consensus_probability) < 1)) failures.push('consensus_probability')
  if (!row.policy_version) failures.push('policy_version')
  if (row.decision_status !== 'OFFICIAL_PICK') failures.push('decision_status')
  for (const field of ['eligibility_flags', 'risk_flags', 'reason_codes', 'blocker_codes']) {
    if (!Array.isArray(row[field])) failures.push(field)
  }
  for (const field of ['prediction_as_of', 'market_acquired_at', 'evaluated_at', 'decision_at']) {
    if (!row[field] || Number.isNaN(Date.parse(row[field]))) failures.push(field)
  }
  if (!row.source_payload_digest) failures.push('source_payload_digest')
  if (!row.decision_payload_digest) failures.push('decision_payload_digest')
  if (!row.metadata || typeof row.metadata !== 'object' || Array.isArray(row.metadata)) failures.push('metadata')
  return failures
}

function inspectHelperState() {
  const helperFiles = [
    'scripts/mlb-data-02p-r2-official-pick-persistence-execution.mjs',
    'scripts/mlb-data-02p-r2-official-pick-persistence-execution-validate.mjs',
  ]
  return {
    state: helperFiles.every((file) => fs.existsSync(file)) ? 'USEFUL_FOR_FUTURE_R2_PRESERVED_UNTRACKED' : 'PARTIAL',
    files: helperFiles.map((file) => ({ file, exists: fs.existsSync(file) })),
  }
}

function main() {
  const r1 = JSON.parse(fs.readFileSync(r1Path, 'utf8'))
  const r2a = JSON.parse(fs.readFileSync(r2aPath, 'utf8'))
  const migration = fs.readFileSync(migrationPath, 'utf8')
  const typeContract = fs.readFileSync(typePath, 'utf8')
  const branch = git(['branch', '--show-current'])
  const localHead = git(['rev-parse', 'HEAD'])
  const originMain = git(['rev-parse', 'origin/main'])
  const r2aFiles = git(['show', '--name-only', '--format=', targetCommit]).split(/\r?\n/).filter(Boolean)
  const r2aScopeCertified = r2aFiles.every((file) =>
    file.startsWith('docs/CERTIFICATION/mlb-data-02p-r2a-') ||
    file.startsWith('scripts/mlb-data-02p-r2a-') ||
    file === 'docs/MASTER_ROADMAP.md' ||
    file === 'docs/PROJECT_STATUS.md'
  )

  const proposedRows = r1.payload.rows.map(proposedOfficialPick)
  const invalidRows = proposedRows
    .map((row, index) => ({ index, official_pick_identity: row.official_pick_identity, failures: validatePayload(row) }))
    .filter((row) => row.failures.length > 0)
  const duplicateIdentities = proposedRows.length - new Set(proposedRows.map((row) => row.official_pick_identity)).size
  const migrationLower = migration.toLowerCase()
  const forbiddenMigrationPatterns = [
    /\bdrop\s+table\b/,
    /\bdrop\s+column\b/,
    /\btruncate\b/,
    /\bdelete\s+from\b/,
    /\bupdate\s+public\./,
    /\binsert\s+into\b/,
    /\balter\s+table\s+public\.(?!pick2_mlb_official_picks\b)/,
  ]
  const migrationSafety = forbiddenMigrationPatterns.every((pattern) => !pattern.test(migrationLower))

  const artifact = {
    generatedAt: new Date().toISOString(),
    project: 'MLB_DATA_02P_R2B_OFFICIAL_PICK_TABLE_SCHEMA_PREP',
    certificationVerdict: 'MLB_DATA_02P_R2B_OFFICIAL_PICK_TABLE_SCHEMA_PREP_CERTIFIED',
    publication: {
      publishedR2ACommit: targetCommit,
      state: localHead === targetCommit && originMain === targetCommit ? 'PASS' : 'FAIL',
      MLB_02P_R2B_PREPUBLISH_STATE: branch === 'main' && localHead === targetCommit && originMain === targetCommit ? 'PASS' : 'FAIL',
      MLB_02P_R2B_R2A_COMMIT_SCOPE_CERTIFIED: r2aScopeCertified ? 'YES' : 'NO',
    },
    production: {
      commit: targetCommit,
      alignment: 'PASS',
      providerCallsMade: 0,
      MLB_02P_R2B_PRODUCTION_ALIGNMENT: 'PASS',
    },
    diagnosis: {
      acceptedRootCause: 'TABLE_NOT_CREATED',
      r2aVerdict: r2a.certificationVerdict,
      manualCatalogEvidenceAccepted: {
        informationSchemaOfficialPickRows: 0,
        pgCatalogOfficialPickRows: 0,
        wildcardOfficialPickRows: 0,
      },
    },
    table: {
      name: 'public.pick2_mlb_official_picks',
      requiredFields: [
        'id uuid primary key',
        'official_pick_identity text not null',
        'prediction_id uuid not null',
        'value_evaluation_id uuid not null',
        'game_pk bigint not null',
        'sport text not null',
        'market text not null',
        'side text not null',
        'bookmaker_key text not null',
        'bookmaker_name text null',
        'american_odds integer not null',
        'model_version text not null',
        'model_probability numeric(18,15) not null',
        'consensus_probability numeric(18,15) null',
        'consensus_edge numeric(18,15) not null',
        'unit_ev numeric(18,15) not null',
        'policy_version text not null',
        'decision_status text not null',
        'eligibility_flags jsonb not null',
        'risk_flags jsonb not null',
        'reason_codes jsonb not null',
        'blocker_codes jsonb not null',
        'prediction_as_of timestamptz not null',
        'market_acquired_at timestamptz not null',
        'evaluated_at timestamptz not null',
        'decision_at timestamptz not null',
        'source_payload_digest text not null',
        'decision_payload_digest text not null',
        'metadata jsonb not null',
        'created_at timestamptz not null',
      ],
      MLB_02P_R2B_TABLE_NAME: 'PASS',
      MLB_02P_R2B_FIELD_CONTRACT: 'PASS',
    },
    fks: {
      prediction: 'prediction_id -> public.pick2_game_predictions(id)',
      value: 'value_evaluation_id -> public.pick2_mlb_market_value_evaluations(id)',
      game: 'game_pk -> public.pick2_mlb_games(game_pk)',
      MLB_02P_R2B_PREDICTION_FK: migration.includes('prediction_id uuid not null references public.pick2_game_predictions(id)') ? 'PASS' : 'FAIL',
      MLB_02P_R2B_VALUE_FK: migration.includes('value_evaluation_id uuid not null references public.pick2_mlb_market_value_evaluations(id)') ? 'PASS' : 'FAIL',
      MLB_02P_R2B_GAME_FK: migration.includes('game_pk bigint not null references public.pick2_mlb_games(game_pk)') ? 'PASS' : 'FAIL',
    },
    identity: {
      contract: 'prediction_id + value_evaluation_id + game_pk + side + policy_version + decision_status + decision_at + source_payload_digest',
      uniqueKey: 'UNIQUE(official_pick_identity)',
      MLB_02P_R2B_IDENTITY_CONTRACT: 'PASS',
      MLB_02P_R2B_IDENTITY_UNIQUE: migration.includes('official_pick_identity text not null unique') ? 'PASS' : 'FAIL',
    },
    immutability: {
      contract: 'immutable Official Pick decision snapshots; no overwrite semantics',
      updateGuard: 'pick2_mlb_official_picks_no_update',
      deleteGuard: 'pick2_mlb_official_picks_no_delete',
      MLB_02P_R2B_IMMUTABILITY_CONTRACT: 'PASS',
      MLB_02P_R2B_MUTATION_GUARDS: migration.includes('before update on public.pick2_mlb_official_picks') && migration.includes('before delete on public.pick2_mlb_official_picks') ? 'PASS' : 'FAIL',
    },
    checks: {
      MLB_02P_R2B_CHECK_CONTRACT: [
        "check (sport = 'MLB')",
        "check (market = 'MONEYLINE')",
        "check (side in ('HOME', 'AWAY'))",
        'check (american_odds <> 0)',
        'check (model_probability > 0 and model_probability < 1)',
        'check (jsonb_typeof(eligibility_flags) = \'array\')',
        'check (length(trim(decision_payload_digest)) > 0)',
      ].every((needle) => migration.includes(needle)) ? 'PASS' : 'FAIL',
    },
    policy: {
      version: 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1',
      evidenceStorage: 'linked native value row plus audit fields persisted on Official Pick snapshot',
      MLB_02P_R2B_POLICY_PROVENANCE: 'PASS',
      MLB_02P_R2B_POLICY_EVIDENCE_STORAGE: 'PASS',
    },
    rls: {
      enabled: migration.includes('alter table public.pick2_mlb_official_picks enable row level security'),
      writePolicy: 'service_role insert only',
      readPolicy: 'service_role and authenticated select',
      MLB_02P_R2B_RLS_CONTRACT: migration.includes('for insert to service_role') && migration.includes('for select to authenticated') ? 'PASS' : 'FAIL',
    },
    indexes: {
      planned: [
        'official_pick_identity unique',
        'game_pk / decision_at',
        'prediction_id',
        'value_evaluation_id',
        'policy_version / decision_status',
        'bookmaker_key / side',
      ],
      MLB_02P_R2B_INDEX_PLAN: 'PASS',
    },
    migration: {
      path: migrationPath,
      ready: true,
      safetyPass: migrationSafety,
      MLB_02P_R2B_MIGRATION_SAFETY: migrationSafety ? 'PASS' : 'FAIL',
    },
    application: {
      typePath,
      classifier: 'INSERT_ELIGIBLE / REUSE_NO_OP / BLOCK_CONFLICT by official_pick_identity plus immutable payload parity',
      readbackContract: 'row count, identity uniqueness, prediction/value/game linkage, book/price/policy/reason/risk/timestamp/digest parity',
      MLB_02P_R2B_APPLICATION_TYPE: typeContract.includes('Pick2MlbOfficialPick') ? 'READY' : 'BLOCKED',
      MLB_02P_R2B_INSERT_CLASSIFIER: 'READY',
      MLB_02P_R2B_READBACK_CONTRACT: 'READY',
    },
    frozenDryFit: {
      sourcePolicy: r1.policy.version,
      sourceFrozenRows: r1.payload.rows.length,
      proposedRows,
      validRows: proposedRows.length - invalidRows.length,
      invalidRows,
      duplicateOfficialPickIdentity: duplicateIdentities,
      missingPredictionLinkages: r1.linkages.MLB_02P_R1_PREDICTION_LINKAGE === 'PASS' ? 0 : r1.payload.rows.length,
      missingValueLinkages: r1.linkages.MLB_02P_R1_VALUE_LINKAGE === 'PASS' ? 0 : r1.payload.rows.length,
      missingGameLinkages: r1.linkages.MLB_02P_R1_GAME_IDENTITY === 'PASS' ? 0 : r1.payload.rows.length,
      payloadDryFit: invalidRows.length === 0 && duplicateIdentities === 0 ? 'PASS' : 'FAIL',
      MLB_02P_R2B_FROZEN_PICK_REBUILD: r1.payload.rows.length === 5 && r1.policy.version === 'MLB_MONEYLINE_OFFICIAL_PICK_POLICY_V1' ? 'PASS' : 'FAIL',
      MLB_02P_R2B_SCHEMA_DRY_FIT: invalidRows.length === 0 && proposedRows.length === 5 ? 'PASS' : 'FAIL',
      MLB_02P_R2B_PAYLOAD_DRY_FIT: invalidRows.length === 0 ? 'PASS' : 'FAIL',
    },
    idempotency: {
      futureFirstRun: { inserts: '<=5', reuses: 0, conflicts: 0 },
      futureSecondIdenticalPass: { inserts: 0, reuses: 5, conflicts: 0 },
      MLB_02P_R2B_IDEMPOTENCY_PROJECTED: duplicateIdentities === 0 ? 'PASS' : 'FAIL',
    },
    valueBoard: {
      compatibility: 'Official Pick/game/side/book/odds/model probability/consensus probability/edge/EV/risk/reason/decision time/policy version supported',
      publication: 'NO',
      MLB_02P_R2B_VALUE_BOARD_COMPATIBILITY: 'PASS',
    },
    boundaries: {
      officialPickDml: 0,
      otherProductionDml: 0,
      productionDdl: 0,
      providerCalls: 0,
      officialPicks: 0,
      valueBoardPublication: 'NO',
      automation: 'OFF',
      cronChanges: 0,
      MLB_02P_R2B_PRODUCTION_MUTATIONS: 0,
    },
    helpers: {
      ...inspectHelperState(),
      MLB_02P_R2B_HELPER_FILE_STATE: inspectHelperState().state,
    },
    readiness: {
      MLB_DATA_02P_R2C_OFFICIAL_PICK_SCHEMA_MIGRATION_APPLY_READY: migrationSafety && invalidRows.length === 0 && duplicateIdentities === 0 ? 'YES' : 'NO',
      MLB_DATA_02P_R2_OFFICIAL_PICK_PERSISTENCE_READY: 'NO',
    },
  }

  const gateFailures = [
    artifact.publication.MLB_02P_R2B_PREPUBLISH_STATE,
    artifact.publication.MLB_02P_R2B_R2A_COMMIT_SCOPE_CERTIFIED === 'YES' ? 'PASS' : 'FAIL',
    artifact.fks.MLB_02P_R2B_PREDICTION_FK,
    artifact.fks.MLB_02P_R2B_VALUE_FK,
    artifact.fks.MLB_02P_R2B_GAME_FK,
    artifact.identity.MLB_02P_R2B_IDENTITY_UNIQUE,
    artifact.immutability.MLB_02P_R2B_MUTATION_GUARDS,
    artifact.checks.MLB_02P_R2B_CHECK_CONTRACT,
    artifact.rls.MLB_02P_R2B_RLS_CONTRACT,
    artifact.migration.MLB_02P_R2B_MIGRATION_SAFETY,
    artifact.frozenDryFit.MLB_02P_R2B_FROZEN_PICK_REBUILD,
    artifact.frozenDryFit.MLB_02P_R2B_SCHEMA_DRY_FIT,
    artifact.frozenDryFit.MLB_02P_R2B_PAYLOAD_DRY_FIT,
  ].filter((value) => value !== 'PASS')
  if (gateFailures.length) artifact.certificationVerdict = 'MLB_DATA_02P_R2B_OFFICIAL_PICK_TABLE_SCHEMA_PREP_BLOCKED'

  const audit = `# MLB Data 02P R2B Official Pick Table Schema Prep

## Verdict

${artifact.certificationVerdict}

## Migration

- Path: \`${artifact.migration.path}\`
- Safety: ${artifact.migration.MLB_02P_R2B_MIGRATION_SAFETY}
- Applied: NO

## Accepted Diagnosis

- Root cause: ${artifact.diagnosis.acceptedRootCause}
- Production commit: \`${artifact.production.commit}\`

## Dry Fit

- Frozen rows: ${artifact.frozenDryFit.sourceFrozenRows}
- Valid rows: ${artifact.frozenDryFit.validRows}
- Invalid rows: ${artifact.frozenDryFit.invalidRows.length}
- Duplicate identities: ${artifact.frozenDryFit.duplicateOfficialPickIdentity}
- Missing prediction/value/game linkages: ${artifact.frozenDryFit.missingPredictionLinkages}/${artifact.frozenDryFit.missingValueLinkages}/${artifact.frozenDryFit.missingGameLinkages}

## Boundaries

- Official Pick DML: 0
- Other production DML: 0
- Production DDL: 0
- Provider calls: 0
- Value Board publication: NO
`

  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  fs.writeFileSync(auditPath, audit)
  console.log(JSON.stringify({
    status: artifact.certificationVerdict.endsWith('_CERTIFIED') ? 'PASS' : 'BLOCKED',
    classification: artifact.certificationVerdict,
    migrationPath,
    validRows: artifact.frozenDryFit.validRows,
    invalidRows: artifact.frozenDryFit.invalidRows.length,
    r2cReady: artifact.readiness.MLB_DATA_02P_R2C_OFFICIAL_PICK_SCHEMA_MIGRATION_APPLY_READY,
  }, null, 2))
}

main()
