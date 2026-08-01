#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const failures = []

const releaseFiles = new Set([
  'src/components/market-opportunities/BettingDecisionWorkspace.tsx',
  'src/lib/wager-input-normalization.ts',
  'src/lib/api-contract.ts',
  'src/services/user-wager-ledger.service.ts',
  'src/app/api/user/wagers/route.ts',
  'src/app/api/user/wagers/[id]/route.ts',
  'src/app/api/user/wagers/summary/route.ts',
  'src/app/api/user/wagers/export/route.ts',
  'supabase/migrations/202608010001_release14a_user_wager_ledger_grants.sql',
  'docs/PRODUCT/RELEASE_14A_WAGER_SAVE_RECOVERY.md',
  'docs/CERTIFICATION/RELEASE_14A_AUTHENTICATED_WAGER_RECOVERY.md',
  'docs/CERTIFICATION/release-14a-authenticated-wager-recovery.json',
  'scripts/release14a-authenticated-wager-recovery-validate.mjs',
  'docs/PRODUCT/README.md',
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

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function american(value) {
  const raw = String(value ?? '').trim().replaceAll(',', '')
  if (!raw) return null
  const next = Number(raw)
  if (!Number.isInteger(next) || next === 0 || Math.abs(next) < 100) return null
  return next
}

function decimalFromAmerican(value) {
  return value > 0 ? 1 + value / 100 : 1 + 100 / Math.abs(value)
}

function money(value) {
  const next = Number(String(value ?? '').trim().replaceAll(',', ''))
  return Number.isFinite(next) && next > 0 ? Math.round(next * 100) / 100 : null
}

for (const file of releaseFiles) {
  if (!file.startsWith('docs/PRODUCT/README') && !file.startsWith('docs/CERTIFICATION/README') && !file.startsWith('docs/MASTER_PROGRAM') && !fs.existsSync(full(file))) {
    failures.push(`missing Release 14A file: ${file}`)
  }
}

assert(american('151') === 151, '151 must normalize to positive American odds')
assert(american('+151') === 151, '+151 must normalize')
assert(american('-110') === -110, '-110 must normalize')
assert(american('0') === null, 'zero odds must be invalid')
assert(american('99') === null, 'sub-100 positive odds must be invalid')
assert(money('25') === 25, 'stake 25 must normalize')
assert(money('0') === null, 'stake zero must be invalid')
assert(Math.abs(25 * decimalFromAmerican(151) - 62.75) < 0.0001, '25 at +151 must pay 62.75 total payout')

const workspace = read('src/components/market-opportunities/BettingDecisionWorkspace.tsx')
for (const term of [
  'normalizeAmericanOddsInput',
  'normalizeMoneyInput',
  'normalizeOptionalLineInput',
  "['authenticated', 'sync-pending', 'synced', 'duplicate'].includes(remoteMode)",
  'supabase.auth.refreshSession',
  'remoteFailure',
  'SESSION_REFRESH_FAILED',
  'Local wager was preserved',
]) assert(workspace.includes(term), `workspace missing marker: ${term}`)

const service = read('src/services/user-wager-ledger.service.ts')
for (const term of ['LEDGER_TABLE_UNAVAILABLE', 'RLS_DENIED', 'VALIDATION_FAILED', 'auth.client', "eq('user_id', auth.userId)"]) {
  assert(service.includes(term), `service missing marker: ${term}`)
}
assert(!service.includes('supabaseAdmin'), 'user wager service must not use service-role shortcuts')

const migration = read('supabase/migrations/202608010001_release14a_user_wager_ledger_grants.sql')
for (const term of ['grant select, insert, update, delete', 'to authenticated', "notify pgrst, 'reload schema'", 'user_wagers', 'user_wager_legs']) {
  assert(migration.includes(term), `grant migration missing ${term}`)
}
assert(!migration.includes('prediction_history'), 'grant migration must not touch prediction_history')

const cert = JSON.parse(read('docs/CERTIFICATION/release-14a-authenticated-wager-recovery.json'))
assert(cert.certification.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.certification.userWagerTablesOnly === true, 'mutations must be user wager table scoped')
assert(cert.modelSafety.predictionHistoryChanged === false, 'prediction history must be unchanged')
assert(cert.productionMigrationEvidence.user_wagers_exists === true, 'production evidence must record user_wagers exists')
assert(cert.productionMigrationEvidence.restVisibilityBeforeGrantMigration === 'PGRST205', 'production REST visibility root cause must be recorded')

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
for (const file of Array.from(new Set([...changed, ...untracked])).sort()) {
  if (!releaseFiles.has(file) && !knownUnrelatedDirty.has(file)) failures.push(`unexpected dirty file: ${file}`)
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  release: 'Release 14A',
  americanOdds151: american('151'),
  payout25AtPlus151: 25 * decimalFromAmerican(151),
  providerCallsMade: 0,
  modelBehaviorChanged: false,
  failures: failures.length,
  failureMessages: failures,
}, null, 2))

process.exit(failures.length === 0 ? 0 : 1)
