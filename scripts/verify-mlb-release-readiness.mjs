// Provider-free CI gate. A source change requires a reviewed new manifest.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { requireCanonicalR3Readiness, normalizedFileDigest, R3_CERTIFICATE } from './mlb-data-02r-r2t-r3-readiness.mjs'
const readinessPath = 'docs/CERTIFICATION/MLB_OPERATIONAL_READINESS_REVALIDATION_20261122.json'
const previousReadinessPath = 'docs/CERTIFICATION/MLB_OPERATIONAL_READINESS_REVALIDATION_20261119.json'
const octoberReadinessPath = 'docs/CERTIFICATION/MLB_OPERATIONAL_READINESS_REVALIDATION_20261014.json'
const load = path => JSON.parse(fs.readFileSync(path, 'utf8'))
const certificates = [R3_CERTIFICATE, readinessPath].map(path => ({ path, value: load(path) }))
for (const { value } of certificates) {
  const review = value.revalidation20261014
  assert.equal(review.status, 'OFFLINE_REVALIDATED_PRODUCTION_READBACK_PENDING')
  assert.equal(normalizedFileDigest(review.priorCertificate), review.priorCertificateSha256, 'HISTORICAL_CERTIFICATE_CHANGED')
  for (const [path, digest] of Object.entries(review.evidenceHashes)) assert.equal(normalizedFileDigest(path), digest, `REVALIDATION_EVIDENCE_DRIFT:${path}`)
  for (const [path, digest] of Object.entries(value.sourceHashes)) assert.equal(normalizedFileDigest(path), digest, `SOURCE_DRIFT:${path}`)
}
const readiness = certificates[1].value
assert.equal(readiness.automation.status, 'DRY_CERTIFIED')
const prior = load(readiness.revalidation20261014.priorCertificate)
for (const path of Object.keys(prior.sourceHashes)) assert.ok(Object.hasOwn(readiness.sourceHashes, path), `SOURCE_REMOVED:${path}`)

// Check every link against its immutable predecessor. Historical source hashes
// describe their reviewed versions; only the newest inventory describes the
// current files. No former source pin or declared change may disappear.
function verifyReview(current, previous, key, previousPath) {
  const review = current[key]
  assert.equal(review.status, 'OFFLINE_SOURCE_REVIEW_MLB_PAUSE_UNCHANGED')
  assert.equal(review.priorManifest, previousPath)
  assert.equal(normalizedFileDigest(previousPath), review.priorManifestSha256, 'HISTORICAL_REVALIDATION_CHANGED')
  assert.equal(current.sourceHashes[previousPath], review.priorManifestSha256, 'HISTORICAL_REVALIDATION_NOT_PINNED')
  for (const path of Object.keys(previous.sourceHashes)) assert.ok(Object.hasOwn(current.sourceHashes, path), `SOURCE_REMOVED:${path}`)
  const changed = Object.keys(previous.sourceHashes).filter(path => previous.sourceHashes[path] !== current.sourceHashes[path]).sort()
  const added = Object.keys(current.sourceHashes).filter(path => !Object.hasOwn(previous.sourceHashes, path)).sort()
  assert.deepEqual(changed, Object.keys(review.reviewedChanges).sort(), 'UNREVIEWED_SOURCE_CHANGE')
  assert.deepEqual(added, Object.keys(review.addedSources).sort(), 'UNREVIEWED_SOURCE_ADDITION')
  for (const [path, hashes] of Object.entries(review.reviewedChanges)) {
    assert.equal(hashes.priorSha256, previous.sourceHashes[path], `SOURCE_REVIEW_BASELINE_DRIFT:${path}`)
    assert.equal(hashes.reviewedSha256, current.sourceHashes[path], `SOURCE_REVIEW_DRIFT:${path}`)
  }
  for (const [path, digest] of Object.entries(review.addedSources)) assert.equal(digest, current.sourceHashes[path], `SOURCE_ADDITION_REVIEW_DRIFT:${path}`)
  return review
}
const previous = load(previousReadinessPath), october = load(octoberReadinessPath)
const historicalReview = verifyReview(previous, october, 'revalidation20261119', octoberReadinessPath)
const review = verifyReview(readiness, previous, 'revalidation20261122', previousReadinessPath)
// A presentation review cannot rewrite inherited model, feature, automation,
// settlement, production-readback or historical review claims.
const inherited = { ...readiness }, previousClaims = { ...previous }
delete inherited.sourceHashes
delete inherited.revalidation20261122
delete previousClaims.sourceHashes
assert.deepEqual(inherited, previousClaims, 'HISTORICAL_READINESS_CLAIMS_CHANGED')
for (const path of ['src/components/dashboard/SportNavigation.tsx', 'src/lib/read-only-sport-route.mjs',
  'src/components/dashboard/SportDecisionNavigation.tsx', 'src/components/dashboard/SportModelOverview.tsx',
  'src/components/pick2/MlbTodayContent.tsx', 'src/components/dashboard/NbaBoardAccess.tsx',
  'vercel.json', 'src/services/edge-lab-multi.service.mjs', 'docs/CERTIFICATION/MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json']) {
  assert.ok(Object.hasOwn(readiness.sourceHashes, path), `SOURCE_REMOVED:${path}`)
}

// The old regression test necessarily named the old active manifest. Preserve
// its exact reviewed bytes, then pin its replacement as new evidence. This is
// the sole explicitly reviewed evidence supersession, not a general bypass.
const evidencePath = 'tests/mlb-production-readiness/source-review.test.mjs'
const historicalEvidencePath = 'docs/audits/2026-11-22-nba-flow/historical/source-review-20261119.test.mjs.txt'
assert.deepEqual(Object.keys(review.supersededEvidence ?? {}), [evidencePath], 'UNREVIEWED_HISTORICAL_EVIDENCE_CHANGE')
const superseded = review.supersededEvidence[evidencePath]
assert.equal(superseded.priorReview, 'revalidation20261119')
assert.equal(superseded.preservedPath, historicalEvidencePath)
assert.equal(superseded.priorSha256, historicalReview.evidenceHashes[evidencePath], 'HISTORICAL_EVIDENCE_BASELINE_DRIFT')
assert.equal(normalizedFileDigest(historicalEvidencePath), superseded.priorSha256, 'HISTORICAL_EVIDENCE_CHANGED')
assert.equal(superseded.reviewedSha256, review.evidenceHashes[evidencePath], 'EVIDENCE_REVIEW_DRIFT')
for (const [path, digest] of Object.entries(historicalReview.evidenceHashes)) {
  const preservedPath = path === evidencePath ? historicalEvidencePath : path
  assert.equal(normalizedFileDigest(preservedPath), digest, `SOURCE_REVIEW_EVIDENCE_DRIFT:${path}`)
}
for (const [path, digest] of Object.entries(review.evidenceHashes)) assert.equal(normalizedFileDigest(path), digest, `SOURCE_REVIEW_EVIDENCE_DRIFT:${path}`)
assert.equal(review.mlbActivationAuthorized, false)
assert.equal(review.schedulerChanges, 0)
assert.equal(review.environmentChanges, 0)
assert.equal(review.providerCalls, 0)
assert.equal(review.databaseWrites, 0)
assert.equal(review.operationalTickExecuted, false)
for (const path of ['scripts/mlb-operational-r6-vercel-runtime.mjs', 'scripts/mlb-operational-tick.mjs', 'next.config.ts']) assert.ok(fs.readFileSync(path, 'utf8').includes(readinessPath), `STALE_READINESS_REFERENCE:${path}`)
assert.ok(fs.readFileSync('next.config.ts', 'utf8').includes(R3_CERTIFICATE), 'CERTIFICATE_NOT_TRACED_IN_BUILD')
assert.ok(fs.readFileSync('src/services/pick2-mlb-unattended-preflight.ts', 'utf8').includes(R3_CERTIFICATE.split('/').at(-1)), 'PREFLIGHT_CERTIFICATE_MISMATCH')
console.log(JSON.stringify({ status: 'OFFLINE_RELEASE_GUARDS_PASS', r3: requireCanonicalR3Readiness(), pinnedRuntimeFiles: Object.keys(readiness.sourceHashes).length, reviewedManifestChain: ['2026-10-14', '2026-11-19', '2026-11-22'], providerCalls: 0, databaseWrites: 0, deploymentPerformed: false }))
