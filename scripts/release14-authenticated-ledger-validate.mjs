#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const failures = []
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE14_VALIDATOR_TIMEOUT_MS ?? 120000)
const maxFiles = Number(process.env.RELEASE14_VALIDATOR_MAX_FILES ?? 3500)
let scannedCount = 0

const releaseFiles = new Set([
  'src/components/market-opportunities/BettingDecisionWorkspace.tsx',
  'docs/PRODUCT/RELEASE_14_AUTH_AUDIT.md',
  'docs/PRODUCT/AUTHENTICATED_LEDGER_WORKFLOW.md',
  'docs/SECURITY/SESSION_RECOVERY.md',
  'docs/CERTIFICATION/RELEASE_14_AUTHENTICATED_LEDGER.md',
  'docs/CERTIFICATION/release-14-authenticated-ledger.json',
  'scripts/release14-authenticated-ledger-validate.mjs',
  'docs/PRODUCT/README.md',
  'docs/SECURITY/README.md',
  'docs/CERTIFICATION/README.md',
  'docs/MASTER_PROGRAM/PICK_ANALYZER_MASTER_PROGRAM_V2.md',
])

const knownUnrelatedDirty = new Set([
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'docs/build-memory-optimization-v1-phase-b-external-supabase.json',
  'docs/build-memory-optimization-v1-phase-b-final.json',
  'docs/build-memory-optimization-v1-phase-b-import-pressure.json',
  'docs/build-memory-optimization-v1-phase-b.json',
])

function rel(file) {
  return file.replaceAll('\\', '/')
}

function full(file) {
  return path.join(root, file)
}

function read(file) {
  return fs.readFileSync(full(file), 'utf8')
}

function exists(file) {
  return fs.existsSync(full(file))
}

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function walk(dir, files = []) {
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 14 validator exceeded ${timeoutMs}ms`)
  if (scannedCount > maxFiles) throw new Error(`Release 14 validator exceeded max file guard ${maxFiles}`)
  for (const entry of fs.readdirSync(full(dir), { withFileTypes: true })) {
    if (['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'generated', 'out', '.turbo', '.vercel'].includes(entry.name)) continue
    if (entry.isSymbolicLink()) continue
    const relative = rel(path.join(dir, entry.name))
    if (entry.isDirectory()) walk(relative, files)
    else {
      scannedCount += 1
      if (scannedCount % 500 === 0) console.error(`[release14] scanned ${scannedCount} files...`)
      files.push(relative)
    }
  }
  return files
}

const required = [
  'src/components/market-opportunities/BettingDecisionWorkspace.tsx',
  'docs/PRODUCT/RELEASE_14_AUTH_AUDIT.md',
  'docs/PRODUCT/AUTHENTICATED_LEDGER_WORKFLOW.md',
  'docs/SECURITY/SESSION_RECOVERY.md',
  'docs/CERTIFICATION/RELEASE_14_AUTHENTICATED_LEDGER.md',
  'docs/CERTIFICATION/release-14-authenticated-ledger.json',
  'scripts/release14-authenticated-ledger-validate.mjs',
]

for (const file of required) assert(exists(file), `missing required Release 14 file: ${file}`)

const cert = JSON.parse(read('docs/CERTIFICATION/release-14-authenticated-ledger.json'))
assert(cert.scope.authRedesign === false, 'auth redesign must remain false')
assert(cert.scope.workspaceAccountState === true, 'workspace account state must be certified')
assert(cert.scope.migrationPreview === true, 'migration preview must be certified')
assert(cert.scope.sessionRecovery === true, 'session recovery must be certified')
assert(cert.security.tokensRendered === false, 'tokens must not be rendered')
assert(cert.security.serviceRoleUsedForUserLedger === false, 'service role must not be used for user ledger')
assert(cert.security.rlsBoundaryPreserved === true, 'RLS boundary must be preserved')
for (const [key, value] of Object.entries(cert.modelSafety)) {
  assert(value === false, `${key} must remain false`)
}
assert(cert.productionCertification.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.productionCertification.modelMetricsChanged === false, 'model metrics must not change')

const workspace = read('src/components/market-opportunities/BettingDecisionWorkspace.tsx')
for (const term of [
  'Local Only Mode',
  'Remote Ledger Active',
  'Sync pending',
  'Syncing',
  'Synced',
  'Sync failed',
  'Offline mode',
  'Session recovery needed',
  'Duplicate ignored',
  'Migration Preview',
  'Confirm And Sync',
  'Reconnect',
  'supabase.auth.onAuthStateChange',
  '/api/user/wagers?limit=100',
  '/api/user/wagers/${wager.remoteId}',
  'localPersistenceScope',
  'local copy retained',
]) {
  assert(workspace.includes(term), `workspace missing required marker: ${term}`)
}
assert(!workspace.includes('SUPABASE_SERVICE_ROLE_KEY'), 'workspace must not reference service-role keys')
assert(!workspace.includes('/api/cron/'), 'workspace must not call cron routes')
assert(!workspace.includes('/api/operations/adaptive-refresh'), 'workspace must not call provider/scheduler routes')
assert(!workspace.includes('prediction_history'), 'workspace must not touch prediction_history')

const service = read('src/services/user-wager-ledger.service.ts')
assert(service.includes('auth.client') && service.includes('.eq(\'user_id\', auth.userId)'), 'user wager service must preserve authenticated ownership filters')
assert(!service.includes('supabaseAdmin'), 'user wager service must not use supabase admin shortcuts')

const docs = [
  'docs/PRODUCT/RELEASE_14_AUTH_AUDIT.md',
  'docs/PRODUCT/AUTHENTICATED_LEDGER_WORKFLOW.md',
  'docs/SECURITY/SESSION_RECOVERY.md',
  'docs/CERTIFICATION/RELEASE_14_AUTHENTICATED_LEDGER.md',
].map(read).join('\n')
for (const term of ['Local Only Mode', 'Remote Ledger Active', 'migration preview', 'RLS', 'Release 13', 'authenticated production']) {
  assert(docs.includes(term), `Release 14 docs missing ${term}`)
}

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
for (const file of Array.from(new Set([...changed, ...untracked])).sort()) {
  if (!releaseFiles.has(file) && !knownUnrelatedDirty.has(file)) failures.push(`unexpected dirty file: ${file}`)
  if (!knownUnrelatedDirty.has(file) && (file.startsWith('src/app/api/') || file.startsWith('src/services/') || file.startsWith('supabase/'))) {
    failures.push(`forbidden API/service/schema change in Release 14: ${file}`)
  }
}

const scanned = [...walk('docs'), ...walk('scripts'), ...walk('src')]
for (const file of scanned) {
  if (!/\.(md|json|mjs|js|ts|tsx)$/.test(file)) continue
  const content = read(file)
  if (/sk-[A-Za-z0-9_-]{20,}/.test(content) || /ghp_[A-Za-z0-9_]{20,}/.test(content) || /github_pat_[A-Za-z0-9_]{20,}/.test(content) || /AKIA[0-9A-Z]{16}/.test(content) || /SUPABASE_SERVICE_ROLE_KEY\s*=/.test(content) || /ODDS_API_KEY\s*=/.test(content) || /CRON_SECRET\s*=/.test(content)) {
    failures.push(`possible secret found in ${file}`)
  }
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  release: 'Release 14',
  requiredFiles: required.length,
  scannedFiles: scanned.length,
  accountSessionUx: true,
  migrationPreview: true,
  sessionRecovery: true,
  providerCallsMade: 0,
  modelBehaviorChanged: false,
  failures: failures.length,
  failureMessages: failures,
}, null, 2))

process.exit(failures.length === 0 ? 0 : 1)
