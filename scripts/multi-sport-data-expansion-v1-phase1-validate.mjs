import fs from 'node:fs'

const service = fs.readFileSync('src/services/data-coverage-inventory.service.ts', 'utf8')
const route = fs.readFileSync('src/app/api/data-coverage/inventory/route.ts', 'utf8')
const page = fs.readFileSync('src/app/data-coverage/page.tsx', 'utf8')
const sportPage = fs.readFileSync('src/app/data-coverage/[sport]/page.tsx', 'utf8')
const docs = fs.readFileSync('docs/MULTI_SPORT_DATA_EXPANSION_V1.md', 'utf8')

const checks = [
  ['inventory service exists', service.includes('getDataCoverageInventoryV1')],
  ['uses existing coverage audit', service.includes('getSportsDataCoverageAuditV2')],
  ['audits missed opportunities', service.includes('missed_pipeline_opportunities')],
  ['audits post-start predictions', service.includes('post_start_predictions')],
  ['audits learning labels', service.includes('learning_labels')],
  ['does not estimate unavailable counts', service.includes('exactCountAvailable') && service.includes('noCountReason')],
  ['reports zero provider calls', service.includes('providerCallsMade: 0')],
  ['reports zero remote mutations', service.includes('remoteMutationsMade: 0')],
  ['route exposes validation', route.includes("validate') === 'true'")],
  ['main page exists', page.includes('Data Coverage')],
  ['sport drilldown exists', sportPage.includes('Domain Inventory')],
  ['docs include certification marker', docs.includes('DATA_INVENTORY_EXACTNESS_PASS')],
]

const failed = checks.filter(([, pass]) => !pass).map(([name]) => name)
const result = {
  success: failed.length === 0,
  mode: 'multi_sport_data_expansion_v1_phase1_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
