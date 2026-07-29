import fs from 'node:fs'

const evidencePath = 'docs/six-historical-settlement-conflict-resolution-v1.json'
const expectedIds = [
  '0cf650e1-08b8-51ff-ad79-55a6f2f595b1',
  '583d8788-2bd5-5305-af4c-8569438d4dbc',
  '2355ad93-3def-5e9a-8d7f-48217fc1abd3',
  '60868978-2a82-5e1d-a35b-36ed06034e01',
  '7d8e67e1-ba78-5b6d-a102-0fba3448d7b5',
  '9bd2f825-fac2-590f-8b13-31c7c068bce3',
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'))
const ids = new Set((evidence.inventory ?? []).map((row) => row.predictionId))
const classifications = evidence.afterClassifications ?? []

assert(evidence.success === true, 'six-row repair evidence must be successful')
assert(evidence.mode === 'six_historical_settlement_conflict_resolution_v1_dry-run', 'final evidence must be post-apply dry-run')
assert((evidence.inventory ?? []).length === 6, 'exactly six inventory rows required')
assert((evidence.blocked ?? []).length === 0, 'no blocked six-row repair gates expected')
assert(evidence.mutations === 0, 'post-apply dry-run must be idempotent with zero mutations')
assert(evidence.providerCallsMade === 0, 'provider calls must remain zero')
assert(evidence.remoteMutationsMade === 0, 'post-apply dry-run remote mutations must be zero')
assert(evidence.learningWrites === 0, 'learning writes must remain zero')
assert(evidence.modelWeightMutations === 0, 'model weight mutations must remain zero')

for (const id of expectedIds) assert(ids.has(id), `missing expected target id ${id}`)
for (const row of evidence.inventory ?? []) {
  assert(row.resultLinkageState === 'CANONICAL_RESULT_ALREADY_LINKED', `${row.predictionId} must be linked to canonical result after repair`)
  assert(row.repairGatePassed === true, `${row.predictionId} repair gate must pass`)
  assert(row.canonicalGameId === row.proposedUpdate?.settlement_details?.six_historical_settlement_conflict_resolution_v1?.canonicalGameId, `${row.predictionId} canonical game id must match evidence`)
  assert(row.canonicalResultId === row.proposedUpdate?.result_id, `${row.predictionId} proposed result id must be canonical`)
  assert(['win', 'loss', 'push'].includes(row.deterministicExpectedOutcome), `${row.predictionId} deterministic outcome must be terminal`)
}

for (const item of classifications) {
  assert(item.classification === 'STORED_SETTLED_AND_DETERMINISTIC_SETTLED', `${item.id} must classify as settled consistently`)
  assert(item.status === item.result, `${item.id} status and result must match after repair`)
  assert(item.settlementSource === 'six_historical_settlement_conflict_resolution_v1', `${item.id} must carry repair settlement source`)
}

console.log(JSON.stringify({
  success: true,
  checkedRows: expectedIds.length,
  classifications: classifications.reduce((counts, row) => {
    counts[row.classification] = (counts[row.classification] ?? 0) + 1
    return counts
  }, {}),
  providerCallsMade: evidence.providerCallsMade,
  remoteMutationsMade: evidence.remoteMutationsMade,
}, null, 2))
