// Validate authorized SELECT-only catalog/integrity evidence. No connection,
// provider, DDL or DML capability; input and output remain in OS temporary space.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const root = process.env.R2S_VALIDATION_DIR
assert.ok(root && path.isAbsolute(root))
const load = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const catalog = load(path.join(root, 'r3-schema-catalog.json'))
const historical = load(path.join(root, 'r3-historical-check-violations.json'))
const manifest = name => load(`docs/CERTIFICATION/${name}`)
const expected = [], constraints = []
for (const name of ['MLB_OPERATIONAL_FEATURE_SCHEMA_REVIEW.json', 'MLB_OPERATIONAL_DOWNSTREAM_SCHEMA_REVIEW.json']) {
  const schema = manifest(name)
  for (const table of schema.schema) for (const col of table.columns) expected.push({ table: table.table_name, column: col.column, type: col.type, nullable: col.nullable, physical: col.physical_type })
  constraints.push(...schema.constraints.filter(c => c.contype !== 'u'))
}
for (const col of manifest('MLB_OPERATIONAL_NATIVE_SCHEMA_REVIEW.json').columns) expected.push({ table: col.table_name, column: col.column_name, type: col.data_type, nullable: col.is_nullable })
for (const col of manifest('MLB_OPERATIONAL_RAW_SCHEMA_REVIEW.json').columns) expected.push({ table: 'pick2_raw_mlb_statcast_pitches', column: col.column, type: col.type, nullable: col.nullable })
const failures = []
for (const col of expected) {
  const found = catalog.columns.find(c => c.table_name === col.table && c.column_name === col.column)
  if (!found || found.data_type !== col.type || found.is_nullable !== col.nullable || (col.physical && found.physical_type !== col.physical)) failures.push(`COLUMN:${col.table}:${col.column}`)
}
for (const expected of constraints) if (!catalog.constraints.some(c => c.table_name === expected.table_name && c.conname === expected.conname && c.definition === expected.definition)) failures.push(`CONSTRAINT:${expected.conname}`)
const unique = catalog.indexes.filter(i => i.index_name.endsWith('_snapshot_uidx'))
if (unique.length !== 6 || unique.some(i => !i.indisunique || !i.indisvalid || !i.definition.includes('(feature_snapshot_id) WHERE (target_game_pk IS NOT NULL)'))) failures.push('SNAPSHOT_UNIQUENESS')
if (catalog.indexes.some(i => !i.indisvalid) || catalog.integrity.length !== 6 || catalog.integrity.some(i => i.orphans !== 0)) failures.push('INTEGRITY')
// Existing additive NOT VALID positivity checks still enforce new writes.
// Preserve them, require their exact known shape and independently verify no
// stored rows violate them. Do not perform unapproved VALIDATE CONSTRAINT DDL.
const pending = catalog.constraints.filter(c => !c.convalidated)
for (const c of pending) {
  if (c.contype !== 'c' || !/^CHECK \(\(\((\w+) IS NULL\) OR \(\1 > 0\)\)\) NOT VALID$/.test(c.definition)
    || !historical.some(row => row.table_name === c.table_name && row.violating_rows === 0)) failures.push(`UNVALIDATED:${c.conname}`)
}
const result = { status: failures.length ? 'FAIL' : 'PASS', checkedAt: catalog.checkedAt, columnsCompared: expected.length,
  preservedConstraintsCompared: constraints.length, existingNotValidatedChecks: pending.length, historicalCheckViolations: historical.reduce((n, row) => n + row.violating_rows, 0),
  invalidIndexes: catalog.indexes.filter(i => !i.indisvalid).length, orphanSnapshotReferences: catalog.integrity.reduce((n, i) => n + i.orphans, 0),
  nativeSnapshotUniqueIndexes: unique.length, schemaCompatible: !failures.length, failures,
  ddlDigest: '3f2df0f2baf8b4cd405bc10560c47eadc143198df85a80fb3577b4b03d5b1f46' }
fs.writeFileSync(path.join(root, 'r3-schema-preflight-review.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
if (failures.length) process.exitCode = 1
