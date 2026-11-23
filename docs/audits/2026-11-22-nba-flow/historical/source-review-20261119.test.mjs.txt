import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../../', import.meta.url))
const currentPath = 'docs/CERTIFICATION/MLB_OPERATIONAL_READINESS_REVALIDATION_20261119.json'
const previousPath = 'docs/CERTIFICATION/MLB_OPERATIONAL_READINESS_REVALIDATION_20261014.json'
const r3Path = 'docs/CERTIFICATION/MLB_DATA_02R_R2T_R3_REVALIDATION_20261014.json'
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const digest = file => createHash('sha256').update(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n')).digest('hex')

// Mutate only disposable copies of the exact checked-in sources. No provider,
// database, runtime tick, git operation, or real certificate is changed.
function runGuard(t, mutate = () => {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mlb-source-review-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const files = new Set()
  for (const certificatePath of [r3Path, previousPath, currentPath]) {
    files.add(certificatePath)
    const certificate = readJson(path.join(root, certificatePath))
    for (const file of Object.keys(certificate.sourceHashes)) files.add(file)
    const oldReview = certificate.revalidation20261014
    files.add(oldReview.priorCertificate)
    for (const file of Object.keys(oldReview.evidenceHashes)) files.add(file)
    for (const file of Object.keys(certificate.revalidation20261119?.evidenceHashes ?? {})) files.add(file)
  }
  for (const file of files) {
    const destination = path.join(directory, file)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(path.join(root, file), destination)
  }
  mutate(directory)
  return spawnSync(process.execPath, ['scripts/verify-mlb-release-readiness.mjs'], {
    cwd: directory, encoding: 'utf8', timeout: 30_000,
  })
}

function changeManifest(directory, mutate) {
  const file = path.join(directory, currentPath)
  const manifest = readJson(file)
  mutate(manifest)
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n')
}

function assertBlocked(result, reason) {
  assert.equal(result.error, undefined)
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.ok(result.stderr.includes(reason), result.stderr)
}

test('reviewed manifest preserves all runtime and historical source guards', t => {
  const result = runGuard(t)
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
  const receipt = JSON.parse(result.stdout)
  assert.equal(receipt.status, 'OFFLINE_RELEASE_GUARDS_PASS')
  assert.equal(receipt.r3.sourceFiles, 37)
  assert.equal(receipt.pinnedRuntimeFiles, 110)
  assert.equal(receipt.providerCalls, 0)
  assert.equal(receipt.databaseWrites, 0)
})

test('changed protected source still fails closed', t => {
  const result = runGuard(t, directory => fs.appendFileSync(path.join(directory, 'src/app/globals.css'), '\n/* unreviewed change */\n'))
  assertBlocked(result, 'SOURCE_DRIFT:src/app/globals.css')
})

test('removing a previously protected source still fails closed', t => {
  const result = runGuard(t, directory => changeManifest(directory, manifest => {
    delete manifest.sourceHashes['src/app/globals.css']
  }))
  assertBlocked(result, 'SOURCE_REMOVED:src/app/globals.css')
})

test('refreshing a source hash without its bounded review is rejected', t => {
  const result = runGuard(t, directory => {
    const file = path.join(directory, 'src/app/globals.css')
    fs.appendFileSync(file, '\n/* unreviewed change */\n')
    changeManifest(directory, manifest => { manifest.sourceHashes['src/app/globals.css'] = digest(file) })
  })
  assertBlocked(result, 'SOURCE_REVIEW_DRIFT:src/app/globals.css')
})

test('historical operational manifest remains immutable', t => {
  const result = runGuard(t, directory => fs.appendFileSync(path.join(directory, previousPath), '\n'))
  assertBlocked(result, 'SOURCE_DRIFT:' + previousPath)
})

test('review evidence remains immutable', t => {
  const file = 'docs/product/MLB_SOURCE_REVIEW_20261119.md'
  const result = runGuard(t, directory => fs.appendFileSync(path.join(directory, file), '\nUnreviewed evidence.\n'))
  assertBlocked(result, 'SOURCE_REVIEW_EVIDENCE_DRIFT:' + file)
})

test('new read-only policy dependency is protected against source drift', t => {
  const file = 'src/lib/read-only-sport-route.mjs'
  const result = runGuard(t, directory => fs.appendFileSync(path.join(directory, file), '\n// unreviewed routing change\n'))
  assertBlocked(result, 'SOURCE_DRIFT:' + file)
})

test('new read-only dependency cannot be removed together with its review entry', t => {
  const file = 'src/lib/read-only-sport-route.mjs'
  const result = runGuard(t, directory => changeManifest(directory, manifest => {
    delete manifest.sourceHashes[file]
    delete manifest.revalidation20261119.addedSources[file]
  }))
  assertBlocked(result, 'SOURCE_REMOVED:' + file)
})
