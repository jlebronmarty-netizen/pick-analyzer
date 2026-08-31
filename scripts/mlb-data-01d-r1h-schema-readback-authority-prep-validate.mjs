import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/mlb-data-01d-r1h-schema-readback-authority-prep.json'
const sqlPath = 'docs/CERTIFICATION/mlb-data-01d-r1h-schema-readback-authority-prep.sql'
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
const sql = fs.readFileSync(sqlPath, 'utf8')
const executableSql = sql
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .toLowerCase()
const errors = []

function check(label, condition) {
  if (!condition) errors.push(label)
}

check('verdict certified', artifact.certificationVerdict === 'MLB_DATA_01D_R1H_SCHEMA_READBACK_AUTHORITY_PREP_CERTIFIED')
check('baseline pass', artifact.flags.R1H_SCHEMA_READBACK_PREP_BASELINE === 'PASS')
check('table identity', artifact.bullpenTable.schema === 'public' && artifact.bullpenTable.table === 'pick2_mlb_bullpen_daily_features')
check('sql packet path', artifact.manualSqlPacket.path === sqlPath)
check('catalog sources', artifact.manualSqlPacket.catalogSources.includes('pg_catalog.pg_constraint') && artifact.manualSqlPacket.catalogSources.includes('pg_catalog.pg_index'))
check('legacy query contract', sql.includes('pick2_mlb_bullpen_daily_featu_team_id_feature_date_feature__key') && artifact.queries.legacyConstraint.expectedRows === 0)
check('native query contract', sql.includes('pick2_mlb_bullpen_daily_features_target_game_team_version_key') && artifact.queries.nativeUniqueObject.expectedRows === 1)
check('native columns exact', artifact.queries.nativeUniqueObject.expectedOrderedColumns.join('|') === 'target_game_pk|team_id|feature_version' && sql.includes("array['target_game_pk', 'team_id', 'feature_version']"))
check('contradictory legacy check', sql.includes("array['team_id', 'feature_date', 'feature_version']"))
check('select-only sql', /\bselect\b/.test(executableSql) && !/\b(insert|update|delete|upsert|merge|alter|drop|create|truncate|grant|revoke|call|do|execute)\b/.test(executableSql))
check('success contract ready', artifact.flags.R1H_SCHEMA_READBACK_SUCCESS_CONTRACT === 'READY')
check('required fields complete', ['section', 'check_name', 'observed', 'expected', 'pass', 'object_type', 'object_name', 'schema_name', 'table_name', 'is_unique', 'ordered_columns', 'predicate'].every((field) => artifact.requiredManualOutputFields.includes(field)))
check('safety zero', artifact.safety.productionDmlMutations === 0 && artifact.safety.productionDdlMutations === 0 && artifact.safety.featureDml === 0 && artifact.safety.providerCalls === 0 && artifact.safety.import2026 === 'NO' && artifact.safety.automation === 'NO' && artifact.safety.cronChanges === 0)

if (errors.length) {
  console.error(JSON.stringify({ validator: 'mlb-data-01d-r1h-schema-readback-authority-prep-validate', status: 'FAIL', errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    validator: 'mlb-data-01d-r1h-schema-readback-authority-prep-validate',
    status: 'PASS',
    classification: artifact.certificationVerdict,
    sqlPath,
  }, null, 2))
}
