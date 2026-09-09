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
const { reviewSchemaCatalog } = await import('../supabase/functions/mlb-operational-preflight/review.mjs')
const result = reviewSchemaCatalog(catalog, historical, expected, constraints)
fs.writeFileSync(path.join(root, 'r3-schema-preflight-review.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
if (result.failures.length) process.exitCode = 1
