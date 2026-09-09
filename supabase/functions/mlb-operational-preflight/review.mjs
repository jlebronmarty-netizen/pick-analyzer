// Shared pure checker used by both the original local review and unattended preflight.
export function reviewSchemaCatalog(catalog, historical, expected, constraints, indexes = []) {
const failures = []
for (const index of indexes) if (!catalog.indexes.some(i => i.table_name === index.table_name && i.index_name === index.index_name && i.definition === index.definition && i.indisvalid && i.indisunique === index.indisunique)) failures.push(`INDEX:${index.index_name}`)
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
return { status: failures.length ? 'FAIL' : 'PASS', checkedAt: catalog.checkedAt, columnsCompared: expected.length,
  preservedConstraintsCompared: constraints.length, requiredIndexesCompared: indexes.length, existingNotValidatedChecks: pending.length, historicalCheckViolations: historical.reduce((n, row) => n + row.violating_rows, 0),
  invalidIndexes: catalog.indexes.filter(i => !i.indisvalid).length, orphanSnapshotReferences: catalog.integrity.reduce((n, i) => n + i.orphans, 0),
  nativeSnapshotUniqueIndexes: unique.length, schemaCompatible: !failures.length, failures,
  ddlDigest: '3f2df0f2baf8b4cd405bc10560c47eadc143198df85a80fb3577b4b03d5b1f46' }
}
