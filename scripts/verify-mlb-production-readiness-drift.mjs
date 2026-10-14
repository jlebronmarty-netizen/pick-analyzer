// Offline inspection only: reads Git objects, makes no provider/DB requests.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { verifyR3Certificate } from './mlb-data-02r-r2t-r3-readiness.mjs'
const ref = process.argv[2] ?? 'f7e5f5694660bc97e1d8946271bc277c995d0947'
if (!/^[a-f0-9]{40}$/.test(ref)) throw Error('FULL_COMMIT_SHA_REQUIRED')
const read = path => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 10_000_000 })
const digest = path => createHash('sha256').update(read(path).replaceAll('\r\n', '\n')).digest('hex')
const certificates = ['docs/CERTIFICATION/MLB_DATA_02R_R2T_R3_LIVE_REENABLEMENT_CERTIFICATION.json', 'docs/CERTIFICATION/MLB_PRE_NONEMPTY_LIVE_READINESS.json']
const reports = certificates.map(path => {
  const certificate = JSON.parse(read(path))
  const mismatches = Object.entries(certificate.sourceHashes).flatMap(([file, expected]) => {
    const actual = digest(file)
    return actual === expected ? [] : [{ file, expected, actual }]
  })
  return { path, checked: Object.keys(certificate.sourceHashes).length, mismatches }
})
let gate
try { gate = verifyR3Certificate(JSON.parse(read(certificates[0])), digest) }
catch (error) { gate = { status: 'BLOCKED', reason: error.message } }
console.log(JSON.stringify({ inspectedCommit: ref, gate, reports, providerCalls: 0, databaseWrites: 0 }, null, 2))
if (gate.status === 'BLOCKED' || reports.some(r => r.mismatches.length)) process.exitCode = 2
