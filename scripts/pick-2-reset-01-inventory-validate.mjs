import fs from 'node:fs'

const artifactPath = 'docs/CERTIFICATION/pick-2-reset-01-legacy-freeze-inventory.json'
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(artifact.certificationVerdict === 'PICK_2_RESET_01_LEGACY_FREEZE_AND_EXACT_INVENTORY_CERTIFIED', 'certification verdict must match RESET-01')
assert(artifact.readOnly === true, 'artifact must be read-only')
assert(artifact.providerCalls === 0, 'provider calls must be zero')
assert(artifact.productionDbMutations === 0, 'production DB mutations must be zero')
assert(artifact.flags.EXACT_PRODUCTION_ROW_COUNTS_READY === true, 'exact production row counts must be ready')
assert(artifact.flags.PICK_2_ERA_BOUNDARY_READY === true, 'Pick 2 era boundary must be ready')
assert(artifact.flags.LEGACY_METRIC_ISOLATION_READY === true, 'legacy metric isolation must be ready')
assert(artifact.flags.PICK_2_CHAMPION_MODEL === 'NONE', 'Pick 2 champion model must be NONE')
assert(artifact.flags.RESET_ROLLBACK_PLAN_READY === true, 'rollback plan must be ready')
assert(artifact.flags.RUNTIME_SIMPLIFICATION_MANIFEST_READY === true, 'runtime manifest must be ready')
assert(artifact.flags.API_SIMPLIFICATION_MANIFEST_READY === true, 'API manifest must be ready')
assert(artifact.flags.UI_SIMPLIFICATION_MANIFEST_READY === true, 'UI manifest must be ready')
assert(artifact.flags.DATABASE_RESET_MANIFEST_READY === true, 'database manifest must be ready')
assert(artifact.flags.NEW_DATA_IMPORT_ALLOWED_NOW === false, 'new data import must be blocked now')
assert(Array.isArray(artifact.exactProductionRowCounts) && artifact.exactProductionRowCounts.length >= 30, 'must count broad production table inventory')
assert(artifact.exactProductionRowCounts.filter((row) => row.resetCritical).every((row) => row.countReady && Number.isInteger(row.exactCount)), 'all reset-critical row counts must be exact integer counts')
assert(artifact.exactProductionRowCounts.some((row) => row.table === 'universal_market_registry' && row.productionSchemaState === 'ABSENT_IN_PRODUCTION_SCHEMA_CACHE'), 'absent optional universal_market_registry must stay disclosed')
assert(artifact.legacyPredictionInventory.totalRowsScanned >= 1, 'legacy prediction inventory must scan prediction rows')
assert(artifact.cleanStartContract.pick2Champion === 'NONE', 'clean start must have no champion')
assert(artifact.cleanStartContract.pick2Predictions === 0, 'clean start must have zero Pick 2 predictions')

console.log(JSON.stringify({
  validator: 'pick-2-reset-01-inventory-validate',
  status: 'PASS',
  checks: 19,
  providerCalls: 0,
  productionDbMutations: 0,
}, null, 2))
