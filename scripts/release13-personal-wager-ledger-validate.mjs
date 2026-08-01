#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const failures = []
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE13_VALIDATOR_TIMEOUT_MS ?? 120000)
const maxFiles = Number(process.env.RELEASE13_VALIDATOR_MAX_FILES ?? 3500)
let scannedCount = 0

const releaseFiles = new Set([
  'supabase/migrations/202607310001_release13_personal_wager_ledger.sql',
  'src/services/user-wager-ledger.service.ts',
  'src/app/api/user/wagers/route.ts',
  'src/app/api/user/wagers/[id]/route.ts',
  'src/app/api/user/wagers/summary/route.ts',
  'src/app/api/user/wagers/export/route.ts',
  'src/components/market-opportunities/BettingDecisionWorkspace.tsx',
  'docs/PRODUCT/RELEASE_13_WAGER_LEDGER_AUDIT.md',
  'docs/PRODUCT/PERSONAL_WAGER_LEDGER.md',
  'docs/PRODUCT/PRODUCT_INVENTORY_V2.md',
  'docs/PRODUCT/ROUTE_AUDIT_V2.md',
  'docs/ARCHITECTURE/PERSONAL_WAGER_DATA_MODEL.md',
  'docs/SECURITY/PERSONAL_WAGER_RLS.md',
  'docs/CERTIFICATION/RELEASE_13_PERSONAL_WAGER_LEDGER.md',
  'docs/CERTIFICATION/release-13-personal-wager-ledger.json',
  'scripts/release13-personal-wager-ledger-validate.mjs',
  'docs/PRODUCT/README.md',
  'docs/ARCHITECTURE/README.md',
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
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 13 validator exceeded ${timeoutMs}ms`)
  if (scannedCount > maxFiles) throw new Error(`Release 13 validator exceeded max file guard ${maxFiles}`)
  for (const entry of fs.readdirSync(full(dir), { withFileTypes: true })) {
    if (['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'generated', 'out', '.turbo', '.vercel'].includes(entry.name)) continue
    if (entry.isSymbolicLink()) continue
    const relative = rel(path.join(dir, entry.name))
    if (entry.isDirectory()) walk(relative, files)
    else {
      scannedCount += 1
      if (scannedCount % 500 === 0) console.error(`[release13] scanned ${scannedCount} files...`)
      files.push(relative)
    }
  }
  return files
}

const required = [
  'supabase/migrations/202607310001_release13_personal_wager_ledger.sql',
  'src/services/user-wager-ledger.service.ts',
  'src/app/api/user/wagers/route.ts',
  'src/app/api/user/wagers/[id]/route.ts',
  'src/app/api/user/wagers/summary/route.ts',
  'src/app/api/user/wagers/export/route.ts',
  'src/components/market-opportunities/BettingDecisionWorkspace.tsx',
  'docs/PRODUCT/RELEASE_13_WAGER_LEDGER_AUDIT.md',
  'docs/PRODUCT/PERSONAL_WAGER_LEDGER.md',
  'docs/ARCHITECTURE/PERSONAL_WAGER_DATA_MODEL.md',
  'docs/SECURITY/PERSONAL_WAGER_RLS.md',
  'docs/CERTIFICATION/RELEASE_13_PERSONAL_WAGER_LEDGER.md',
  'docs/CERTIFICATION/release-13-personal-wager-ledger.json',
  'scripts/release13-personal-wager-ledger-validate.mjs',
]

for (const file of required) assert(exists(file), `missing required Release 13 file: ${file}`)

const cert = JSON.parse(read('docs/CERTIFICATION/release-13-personal-wager-ledger.json'))
assert(cert.predictionFormulaChanged === false, 'prediction formulas must remain unchanged')
assert(cert.probabilityOutputsChanged === false, 'probability outputs must remain unchanged')
assert(cert.officialPickPolicyChanged === false, 'Official Picks policy must remain unchanged')
assert(cert.kellyFormulaChanged === false, 'Kelly formulas must remain unchanged')
assert(cert.learningWeightsChanged === false, 'learning weights must remain unchanged')
assert(cert.schedulerChanged === false, 'scheduler must remain unchanged')
assert(cert.providerContractsChanged === false, 'provider contracts must remain unchanged')
assert(cert.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.predictionMutationsMade === 0, 'prediction mutations must be zero')
assert(cert.modelMutationsMade === 0, 'model mutations must be zero')
assert(cert.settlementMutationsMade === 0, 'settlement mutations must be zero')
assert(cert.userWagerSettlementAffectsModelSettlement === false, 'user wager settlement must not affect model settlement')
assert(cert.userWagerResultsAffectLearning === false, 'user wagers must not affect learning')
assert(cert.personalAnalyticsMixedWithModelMetrics === false, 'personal analytics must not mix with model metrics')
assert(cert.rls.enabled && cert.rls.usesAuthUid, 'RLS must be enabled and use auth.uid()')
assert(cert.localToRemoteMigration.failedSyncPreservesLocalData, 'failed sync must preserve local data')
assert(cert.release14Started === false, 'Release 14 must not be started')

const migration = read('supabase/migrations/202607310001_release13_personal_wager_ledger.sql')
for (const term of [
  'create table if not exists public.user_wagers',
  'create table if not exists public.user_wager_legs',
  'references auth.users',
  'client_created_id',
  'unique (user_id, client_created_id)',
  'enable row level security',
  'auth.uid() = user_id',
  'user_wager_legs_select_own',
  'user_wager_legs_insert_own',
  'user_wager_legs_update_own',
  'user_wager_legs_delete_own',
]) {
  assert(migration.toLowerCase().includes(term.toLowerCase()), `migration missing ${term}`)
}
for (const forbidden of ['alter table public.prediction_history', 'insert into public.prediction_history', 'update public.prediction_history', 'delete from public.prediction_history']) {
  assert(!migration.toLowerCase().includes(forbidden), `migration must not touch prediction history with ${forbidden}`)
}

const service = read('src/services/user-wager-ledger.service.ts')
for (const term of [
  'authenticateUserWagerRequest',
  'auth.getUser',
  'client_created_id',
  'providerCallsMade: 0',
  'predictionMutationsMade: 0',
  'modelMutationsMade: 0',
  'settlementMutationsMade: 0',
  'listUserWagers',
  'createUserWager',
  'updateUserWager',
  'archiveUserWager',
  'summarizeUserWagers',
  'exportUserWagers',
]) {
  assert(service.includes(term), `service missing ${term}`)
}
for (const forbidden of ['supabaseAdmin', 'prediction_history', '/api/cron', 'ODDS_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  assert(!service.includes(forbidden), `service must not include ${forbidden}`)
}

const routes = [
  'src/app/api/user/wagers/route.ts',
  'src/app/api/user/wagers/[id]/route.ts',
  'src/app/api/user/wagers/summary/route.ts',
  'src/app/api/user/wagers/export/route.ts',
].map(read).join('\n')
assert(routes.includes('authenticateUserWagerRequest'), 'routes must require authentication')
assert(routes.includes('createUserWager'), 'routes must create user wagers')
assert(routes.includes('archiveUserWager'), 'routes must archive user wagers')
assert(routes.includes('summarizeUserWagers'), 'routes must expose summary')
assert(routes.includes('exportUserWagers'), 'routes must expose export')
assert(!routes.includes('supabaseAdmin'), 'routes must not use service-role helper')

const workspace = read('src/components/market-opportunities/BettingDecisionWorkspace.tsx')
for (const term of [
  'Release 13',
  'sessionToken',
  '/api/user/wagers?limit=100',
  '/api/user/wagers',
  'Sync Local Wagers',
  'local-only mode',
  'local copy retained',
  'failed',
  'duplicate',
  'Archive',
  'Personal betting ROI is separate from model accuracy',
]) {
  assert(workspace.includes(term), `workspace missing ${term}`)
}
assert(workspace.includes('supabase.auth.getSession'), 'workspace must use Supabase auth session API')
assert(!workspace.includes('prediction_history'), 'workspace must not mutate prediction history')
assert(!workspace.includes('/api/cron/'), 'workspace must not call cron routes')
assert(!workspace.includes('/api/operations/adaptive-refresh'), 'workspace must not invoke provider or scheduler routes')

const docs = [
  'docs/PRODUCT/RELEASE_13_WAGER_LEDGER_AUDIT.md',
  'docs/PRODUCT/PERSONAL_WAGER_LEDGER.md',
  'docs/ARCHITECTURE/PERSONAL_WAGER_DATA_MODEL.md',
  'docs/SECURITY/PERSONAL_WAGER_RLS.md',
  'docs/CERTIFICATION/RELEASE_13_PERSONAL_WAGER_LEDGER.md',
].map(read).join('\n')
for (const term of ['user_wagers', 'user_wager_legs', 'RLS', 'client_created_id', 'local-only', 'prediction settlement', 'learning', 'model accuracy']) {
  assert(docs.toLowerCase().includes(term.toLowerCase()), `docs missing ${term}`)
}

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
for (const file of Array.from(new Set([...changed, ...untracked])).sort()) {
  if (!releaseFiles.has(file) && !knownUnrelatedDirty.has(file)) failures.push(`unexpected dirty file: ${file}`)
}

const scanned = [...walk('src'), ...walk('docs'), ...walk('scripts'), ...walk('supabase')]
for (const file of scanned) {
  if (!/\.(md|json|mjs|js|ts|tsx|sql)$/.test(file)) continue
  const content = read(file)
  if (/sk-[A-Za-z0-9_-]{20,}/.test(content) || /ghp_[A-Za-z0-9_]{20,}/.test(content) || /github_pat_[A-Za-z0-9_]{20,}/.test(content) || /AKIA[0-9A-Z]{16}/.test(content) || /SUPABASE_SERVICE_ROLE_KEY\s*=/.test(content) || /ODDS_API_KEY\s*=/.test(content) || /CRON_SECRET\s*=/.test(content)) {
    failures.push(`possible secret found in ${file}`)
  }
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  release: 'Release 13',
  requiredFiles: required.length,
  scannedFiles: scanned.length,
  schema: ['user_wagers', 'user_wager_legs'],
  rls: true,
  authenticatedApis: true,
  localFallback: true,
  providerCallsMade: 0,
  predictionMutationsMade: 0,
  modelMutationsMade: 0,
  settlementMutationsMade: 0,
  modelBehaviorChanged: false,
  failures: failures.length,
  failureMessages: failures,
}, null, 2))
process.exit(failures.length === 0 ? 0 : 1)
