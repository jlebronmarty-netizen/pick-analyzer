#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const failures = []
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE13A_VALIDATOR_TIMEOUT_MS ?? 120000)
const maxFiles = Number(process.env.RELEASE13A_VALIDATOR_MAX_FILES ?? 3500)
let scannedCount = 0

const releaseFiles = new Set([
  'docs/CERTIFICATION/RELEASE_13A_AUTHENTICATED_WAGER_LEDGER.md',
  'docs/CERTIFICATION/release-13a-authenticated-wager-ledger.json',
  'scripts/release13a-authenticated-wager-ledger-validate.mjs',
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
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 13A validator exceeded ${timeoutMs}ms`)
  if (scannedCount > maxFiles) throw new Error(`Release 13A validator exceeded max file guard ${maxFiles}`)
  for (const entry of fs.readdirSync(full(dir), { withFileTypes: true })) {
    if (['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'generated', 'out', '.turbo', '.vercel'].includes(entry.name)) continue
    if (entry.isSymbolicLink()) continue
    const relative = rel(path.join(dir, entry.name))
    if (entry.isDirectory()) walk(relative, files)
    else {
      scannedCount += 1
      if (scannedCount % 500 === 0) console.error(`[release13a] scanned ${scannedCount} files...`)
      files.push(relative)
    }
  }
  return files
}

const required = [
  'docs/CERTIFICATION/RELEASE_13A_AUTHENTICATED_WAGER_LEDGER.md',
  'docs/CERTIFICATION/release-13a-authenticated-wager-ledger.json',
  'scripts/release13a-authenticated-wager-ledger-validate.mjs',
  'docs/CERTIFICATION/release-13-personal-wager-ledger.json',
  'scripts/release13-personal-wager-ledger-validate.mjs',
  'supabase/migrations/202607310001_release13_personal_wager_ledger.sql',
  'src/services/user-wager-ledger.service.ts',
]

for (const file of required) assert(exists(file), `missing required file: ${file}`)

const cert = JSON.parse(read('docs/CERTIFICATION/release-13a-authenticated-wager-ledger.json'))
assert(cert.status === 'CONDITIONAL_PASS', 'Release 13A must remain conditional unless authenticated lifecycle evidence exists')
assert(cert.release13UpgradedToPass === false, 'Release 13 must not be upgraded without authenticated lifecycle proof')
assert(cert.authenticatedLifecycle.executed === false, 'certification JSON must reflect that authenticated lifecycle was not executed')
assert(cert.staticEvidence.authenticatedRoutesRequireRealUser === true, 'authenticated routes must require a real user')
assert(cert.staticEvidence.clientCannotOverrideUserId === true, 'client must not override user_id')
assert(cert.staticEvidence.creationIdempotentByClientCreatedId === true, 'creation idempotency must use clientCreatedId')
assert(cert.staticEvidence.rlsPoliciesExistForParentAndLegTables === true, 'RLS evidence must be present')
assert(cert.modelIsolation.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.modelIsolation.certificationDatabaseMutations === 0, 'certification DB mutations must be zero')
assert(Array.isArray(cert.tablesMutatedByCertification) && cert.tablesMutatedByCertification.length === 0, '13A certification must not mutate tables without authenticated lifecycle')
assert(cert.release14Started === false, 'Release 14 must not be started')

const release13Cert = JSON.parse(read('docs/CERTIFICATION/release-13-personal-wager-ledger.json'))
assert(release13Cert.providerCallsMade === 0, 'Release 13 provider calls must remain zero')
assert(release13Cert.predictionMutationsMade === 0, 'Release 13 prediction mutations must remain zero')
assert(release13Cert.modelMutationsMade === 0, 'Release 13 model mutations must remain zero')
assert(release13Cert.settlementMutationsMade === 0, 'Release 13 settlement mutations must remain zero')

const service = read('src/services/user-wager-ledger.service.ts')
for (const term of [
  'authenticateUserWagerRequest',
  'auth.getUser',
  'user_id: auth.userId',
  ".eq('user_id', auth.userId)",
  'client_created_id',
  'wagerMutationsMade: 0',
  'providerCallsMade: 0',
  'predictionMutationsMade: 0',
  'modelMutationsMade: 0',
  'settlementMutationsMade: 0',
]) {
  assert(service.includes(term), `service missing ${term}`)
}
assert(!service.includes('supabaseAdmin'), 'user wager service must not use service role')
assert(!service.includes('prediction_history'), 'user wager service must not touch prediction_history')

const migration = read('supabase/migrations/202607310001_release13_personal_wager_ledger.sql')
for (const term of [
  'alter table public.user_wagers enable row level security',
  'alter table public.user_wager_legs enable row level security',
  'auth.uid() = user_id',
  'user_wagers_insert_own',
  'user_wagers_update_own',
  'user_wager_legs_insert_own',
  'user_wager_legs_update_own',
]) {
  assert(migration.includes(term), `migration missing ${term}`)
}

const docs = read('docs/CERTIFICATION/RELEASE_13A_AUTHENTICATED_WAGER_LEDGER.md')
for (const term of [
  'CONDITIONAL PASS',
  'Release 13 remains CONDITIONAL PASS',
  'No legitimate signed-in browser session',
  'HTTP 401 unauthenticated',
  'SCHEDULER_LATE_OR_CRITICAL',
  'Release 14 started: no',
]) {
  assert(docs.includes(term), `Release 13A doc missing ${term}`)
}

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
for (const file of Array.from(new Set([...changed, ...untracked])).sort()) {
  if (!releaseFiles.has(file) && !knownUnrelatedDirty.has(file)) failures.push(`unexpected dirty file: ${file}`)
  if (!knownUnrelatedDirty.has(file) && (file.startsWith('src/app/api/') || file.startsWith('src/services/') || file.startsWith('src/components/') || file.startsWith('supabase/'))) {
    failures.push(`runtime/schema file changed during Release 13A: ${file}`)
  }
}

const scanned = [...walk('docs'), ...walk('scripts'), ...walk('src'), ...walk('supabase')]
for (const file of scanned) {
  if (!/\.(md|json|mjs|js|ts|tsx|sql)$/.test(file)) continue
  const content = read(file)
  if (/sk-[A-Za-z0-9_-]{20,}/.test(content) || /ghp_[A-Za-z0-9_]{20,}/.test(content) || /github_pat_[A-Za-z0-9_]{20,}/.test(content) || /AKIA[0-9A-Z]{16}/.test(content) || /SUPABASE_SERVICE_ROLE_KEY\s*=/.test(content) || /ODDS_API_KEY\s*=/.test(content) || /CRON_SECRET\s*=/.test(content)) {
    failures.push(`possible secret found in ${file}`)
  }
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  release: 'Release 13A',
  requiredFiles: required.length,
  scannedFiles: scanned.length,
  authenticatedLifecycleExecuted: false,
  release13UpgradedToPass: false,
  providerCallsMade: 0,
  certificationDatabaseMutations: 0,
  runtimeChanges: false,
  failures: failures.length,
  failureMessages: failures,
}, null, 2))

process.exit(failures.length === 0 ? 0 : 1)
