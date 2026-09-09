// Accept only a fresh result of the checked-in SELECT-only catalog query.
// The authorized database connector executes SQL; this tool has no DB writer.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createPrivateRunStore } from './mlb-data-02r-r2t-private-run-store.mjs'
import { verifyManualSchemaPreflight } from './mlb-operational-manual-refresh.mjs'
if (process.argv.slice(2).join(' ') !== '--accept-read-only-catalog') throw Error('EXPLICIT_PREFLIGHT_INPUT_REQUIRED')
let input = ''; for await (const chunk of process.stdin) { input += chunk; if (input.length > 1000000) throw Error('PREFLIGHT_INPUT_CAP') }
const catalog = JSON.parse(input)
if (!catalog.checkedAt || !Array.isArray(catalog.historicalChecks)) throw Error('INVALID_CATALOG')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pick-analyzer-schema-review-'))
fs.writeFileSync(path.join(root, 'r3-schema-catalog.json'), JSON.stringify(catalog))
fs.writeFileSync(path.join(root, 'r3-historical-check-violations.json'), JSON.stringify(catalog.historicalChecks))
execFileSync(process.execPath, ['scripts/mlb-operational-schema-preflight-review.mjs'], { env: { ...process.env, R2S_VALIDATION_DIR: root }, stdio: ['ignore', 'pipe', 'pipe'] })
const result = { ...JSON.parse(fs.readFileSync(path.join(root, 'r3-schema-preflight-review.json'), 'utf8')), projectRef: 'ynuocvexviorgdjrfthw' }
verifyManualSchemaPreflight(result, { at: new Date().toISOString(), projectRef: result.projectRef })
const store = createPrivateRunStore(path.join(os.tmpdir(), 'pick-analyzer-mlb-operational-live')); store.acquire()
try { store.save('schema-preflight', result) } finally { store.release() }
console.log(JSON.stringify(result))
