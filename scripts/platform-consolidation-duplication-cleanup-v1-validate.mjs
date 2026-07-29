import fs from 'node:fs'

const evidence = JSON.parse(fs.readFileSync('docs/platform-consolidation-duplication-cleanup-v1.json', 'utf8'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(evidence.success === true, 'evidence must be successful')
assert(evidence.servicesAudited === 14, 'expected 14 service candidates audited')
assert(evidence.pagesAudited === 7, 'expected 7 page candidates audited')
assert(evidence.hotspotsAudited >= 10, 'expected responsibility hotspots audited')
assert(evidence.approvedRemovalCandidates === 0, 'no removal candidate should be approved by evidence')
assert(evidence.filesRemoved === 0, 'no files should be removed')
assert(evidence.callersMigrated === 0, 'no callers should be migrated in no-removal phase')
assert(evidence.providerCallsMade === 0, 'provider calls must remain zero')
assert(evidence.databaseMutations === 0, 'database mutations must remain zero')
assert(evidence.businessLogicChanged === false, 'business logic must remain unchanged')
assert(evidence.routeContractsChanged === false, 'route contracts must remain unchanged')

for (const service of evidence.services) {
  assert(service.exists === true, `${service.file} must exist during no-deletion classification`)
  assert(service.removalAllowed === false, `${service.file} must not be approved for removal`)
  assert(!['FULL_DUPLICATE', 'CONFLICTING_IMPLEMENTATION', 'LEGACY_UNUSED', 'DEAD', 'ORPHANED'].includes(service.classification), `${service.file} cannot be classified as removable without stronger proof`)
}

for (const page of evidence.pages) {
  assert(page.exists === true, `${page.file} must exist`)
  assert(page.removalAllowed === false, `${page.file} must not be removed`)
}

console.log(JSON.stringify({
  success: true,
  servicesAudited: evidence.servicesAudited,
  pagesAudited: evidence.pagesAudited,
  approvedRemovalCandidates: evidence.approvedRemovalCandidates,
  filesRemoved: evidence.filesRemoved,
  providerCallsMade: evidence.providerCallsMade,
  databaseMutations: evidence.databaseMutations,
}, null, 2))
