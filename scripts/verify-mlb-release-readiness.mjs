// Provider-free CI gate. A source change requires a reviewed new manifest.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { requireCanonicalR3Readiness, normalizedFileDigest, R3_CERTIFICATE } from './mlb-data-02r-r2t-r3-readiness.mjs'
const readinessPath = 'docs/CERTIFICATION/MLB_OPERATIONAL_READINESS_REVALIDATION_20261119.json'
const previousReadinessPath = 'docs/CERTIFICATION/MLB_OPERATIONAL_READINESS_REVALIDATION_20261014.json'
const certificates = [R3_CERTIFICATE, readinessPath].map(path => ({ path, value: JSON.parse(fs.readFileSync(path, 'utf8')) }))
for (const { value } of certificates) {
  const review = value.revalidation20261014
  assert.equal(review.status, 'OFFLINE_REVALIDATED_PRODUCTION_READBACK_PENDING')
  assert.equal(normalizedFileDigest(review.priorCertificate), review.priorCertificateSha256, 'HISTORICAL_CERTIFICATE_CHANGED')
  for (const [path, digest] of Object.entries(review.evidenceHashes)) assert.equal(normalizedFileDigest(path), digest, `REVALIDATION_EVIDENCE_DRIFT:${path}`)
  for (const [path, digest] of Object.entries(value.sourceHashes)) assert.equal(normalizedFileDigest(path), digest, `SOURCE_DRIFT:${path}`)
}
const readiness = certificates[1].value
assert.equal(readiness.automation.status, 'DRY_CERTIFIED')
const prior = JSON.parse(fs.readFileSync(readiness.revalidation20261014.priorCertificate, 'utf8'))
for (const path of Object.keys(prior.sourceHashes)) assert.ok(Object.hasOwn(readiness.sourceHashes, path), `SOURCE_REMOVED:${path}`)
// A bounded source review extends the historical manifest; it cannot silently
// replace prior evidence, drop protected files, or bless an unreviewed digest.
const review = readiness.revalidation20261119
assert.equal(review.status, 'OFFLINE_SOURCE_REVIEW_MLB_PAUSE_UNCHANGED')
assert.equal(review.priorManifest, previousReadinessPath)
assert.equal(normalizedFileDigest(review.priorManifest), review.priorManifestSha256, 'HISTORICAL_REVALIDATION_CHANGED')
assert.equal(readiness.sourceHashes[review.priorManifest], review.priorManifestSha256, 'HISTORICAL_REVALIDATION_NOT_PINNED')
const previous = JSON.parse(fs.readFileSync(review.priorManifest, 'utf8'))
for (const path of Object.keys(previous.sourceHashes)) assert.ok(Object.hasOwn(readiness.sourceHashes, path), `SOURCE_REMOVED:${path}`)
for (const path of ['src/components/dashboard/SportNavigation.tsx', 'src/lib/read-only-sport-route.mjs']) assert.ok(Object.hasOwn(readiness.sourceHashes, path), `SOURCE_REMOVED:${path}`)
const changed = Object.keys(previous.sourceHashes).filter(path => previous.sourceHashes[path] !== readiness.sourceHashes[path]).sort()
const added = Object.keys(readiness.sourceHashes).filter(path => !Object.hasOwn(previous.sourceHashes, path)).sort()
assert.deepEqual(changed, Object.keys(review.reviewedChanges).sort(), 'UNREVIEWED_SOURCE_CHANGE')
assert.deepEqual(added, Object.keys(review.addedSources).sort(), 'UNREVIEWED_SOURCE_ADDITION')
for (const [path, hashes] of Object.entries(review.reviewedChanges)) {
  assert.equal(hashes.priorSha256, previous.sourceHashes[path], `SOURCE_REVIEW_BASELINE_DRIFT:${path}`)
  assert.equal(hashes.reviewedSha256, readiness.sourceHashes[path], `SOURCE_REVIEW_DRIFT:${path}`)
}
for (const [path, digest] of Object.entries(review.addedSources)) assert.equal(digest, readiness.sourceHashes[path], `SOURCE_ADDITION_REVIEW_DRIFT:${path}`)
for (const [path, digest] of Object.entries(review.evidenceHashes)) assert.equal(normalizedFileDigest(path), digest, `SOURCE_REVIEW_EVIDENCE_DRIFT:${path}`)
for (const path of ['scripts/mlb-operational-r6-vercel-runtime.mjs', 'scripts/mlb-operational-tick.mjs', 'next.config.ts']) assert.ok(fs.readFileSync(path, 'utf8').includes(readinessPath), `STALE_READINESS_REFERENCE:${path}`)
assert.ok(fs.readFileSync('next.config.ts', 'utf8').includes(R3_CERTIFICATE), 'CERTIFICATE_NOT_TRACED_IN_BUILD')
assert.ok(fs.readFileSync('src/services/pick2-mlb-unattended-preflight.ts', 'utf8').includes(R3_CERTIFICATE.split('/').at(-1)), 'PREFLIGHT_CERTIFICATE_MISMATCH')
console.log(JSON.stringify({ status: 'OFFLINE_RELEASE_GUARDS_PASS', r3: requireCanonicalR3Readiness(), pinnedRuntimeFiles: Object.keys(readiness.sourceHashes).length, providerCalls: 0, databaseWrites: 0, deploymentPerformed: false }))
