import { pathToFileURL } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { createPrivateRunStore } from './mlb-data-02r-r2t-private-run-store.mjs'
import { verifyManualSchemaPreflight } from './mlb-operational-manual-refresh.mjs'
import { runMlbOperationalSchemaPreflight as fetchPreflight } from '../src/services/pick2-mlb-unattended-preflight.ts'
import { requireCanonicalR3Readiness } from './mlb-data-02r-r2t-r3-readiness.mjs'

// No interactive connector, supplied catalog, custom URL, or provider fallback.
export async function runMlbOperationalSchemaPreflight() {
  requireCanonicalR3Readiness()
  const result = await fetchPreflight()
  verifyManualSchemaPreflight(result, { at: new Date().toISOString(), projectRef: 'ynuocvexviorgdjrfthw' })
  if (result.connection?.transaction !== 'READ_ONLY' || result.connection?.serverOnly !== true) throw Error('UNATTENDED_PREFLIGHT_ACCESS_CONTRACT')
  const store = createPrivateRunStore(path.join(os.tmpdir(), 'pick-analyzer-mlb-operational-live'))
  store.acquire()
  try { store.save('schema-preflight', result) } finally { store.release() }
  return result
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.slice(2).join(' ') !== '--read-only-preflight') throw Error('EXPLICIT_PREFLIGHT_REQUIRED')
  runMlbOperationalSchemaPreflight().then(result => console.log(JSON.stringify(result)))
    .catch(() => { console.error(JSON.stringify({ status: 'BLOCKED', reason: 'UNATTENDED_PREFLIGHT_FAILED' })); process.exitCode = 1 })
}
