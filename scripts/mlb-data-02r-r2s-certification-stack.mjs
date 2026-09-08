import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

// Run original validators unchanged, with isolated outputs and GET/HEAD-only production access.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pick-analyzer-r2s-'))
const guard = pathToFileURL(path.resolve('scripts/mlb-data-02r-r2s-certification-guard.mjs')).href
const env = { ...process.env, R2S_VALIDATION_DIR: directory, NODE_OPTIONS: `--import "${guard}"` }
delete env.MLB_DATA_02R_R2_LIVE_EXECUTION_AUTHORIZED
delete env.MLB_DATA_02R_R2_EXECUTION_AUTHORIZED
delete env.MLB_DATA_02R_R2_ALLOW_CERTIFIED_COMPONENT_EXECUTION
const validators = [
  'mlb-data-02r-r2-frozen-execution-package-validate.mjs',
  'mlb-data-02r-r2a-live-refresh-executor-validate.mjs',
  'mlb-data-02r-r2d-current-slate-thin-wrapper-validate.mjs',
  'mlb-data-02r-r2f-component-interface-refactor-validate.mjs',
  'mlb-data-02r-r2g-persistence-interface-refactor-validate.mjs',
  'mlb-data-02r-r2h-executor-binding-full-dry-integration-validate.mjs',
  'mlb-data-02r-r2i-live-execution-interface-validate.mjs',
  'mlb-data-02r-r2k-starter-live-target-schema-guard-repair-validate.mjs',
  'mlb-data-02r-r2l-live-executor-stage-binding-repair-validate.mjs',
  'mlb-data-02r-r2m-native-game-insert-payload-schema-repair-validate.mjs',
  'mlb-data-02r-r2n-statcast-live-fetch-binding-repair-validate.mjs',
  'mlb-data-02r-r2o-feature-snapshot-identity-binding-repair-validate.mjs',
  'mlb-data-02r-r2p-feature-snapshot-date-field-binding-repair-validate.mjs',
  'mlb-data-02r-r2q-empty-eligible-slate-guard-repair-validate.mjs',
  'mlb-data-02r-r2r-current-run-date-asof-freeze-repair-validate.mjs',
  'mlb-data-02r-r2s-team-feature-snapshot-id-payload-binding-repair-validate.mjs',
]
const results = []
console.log(JSON.stringify({ validationDirectory: directory, validators: validators.length }))
for (const script of validators) {
  const args = [path.join('scripts', script), ...(script.includes('r2s-team') ? ['--canonical'] : [])]
  const run = spawnSync(process.execPath, args, { env, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 })
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
  fs.writeFileSync(path.join(directory, `${script}.log`), output)
  results.push({ validator: script, exitCode: run.status, status: run.status === 0 ? 'PASS' : 'FAIL', error: run.error?.code ?? null })
  console.log(JSON.stringify(results.at(-1)))
}
const ledger = fs.readdirSync(directory).filter((name) => /^network-\d+\.json$/.test(name))
  .map((name) => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')))
const boundaries = Object.fromEntries(['readOnlyRequests', 'forbiddenRequests', 'skippedOptionalReads', 'providerCalls', 'productionDml', 'productionDdl']
  .map((key) => [key, ledger.reduce((total, row) => total + row[key], 0)]))
const artifact = { generatedAt: new Date().toISOString(), results, boundaries, protectedDirectories: 'No access: cache paths redirected to OS temporary directory; worktree access rejected', errors: results.filter((row) => row.status !== 'PASS') }
fs.writeFileSync(path.join(directory, 'stack.json'), JSON.stringify(artifact, null, 2) + '\n')
console.log(JSON.stringify({ validationDirectory: directory, ...artifact }, null, 2))
if (artifact.errors.length || boundaries.forbiddenRequests) process.exitCode = 1
