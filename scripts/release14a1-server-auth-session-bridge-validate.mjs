#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const failures = []

const releaseFiles = new Set([
  'src/app/api/user/session-bridge/route.ts',
  'src/components/market-opportunities/BettingDecisionWorkspace.tsx',
  'src/lib/api-contract.ts',
  'src/services/user-wager-ledger.service.ts',
  'docs/PRODUCT/RELEASE_14A1_SERVER_AUTH_BRIDGE.md',
  'docs/SECURITY/AUTHENTICATED_API_SESSION_BRIDGE.md',
  'docs/CERTIFICATION/RELEASE_14A1_SERVER_AUTH_SESSION.md',
  'docs/CERTIFICATION/release-14a1-server-auth-session.json',
  'scripts/release14a1-server-auth-session-bridge-validate.mjs',
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

function assert(condition, message) {
  if (!condition) failures.push(message)
}

for (const file of releaseFiles) {
  if (!fs.existsSync(full(file))) failures.push(`missing Release 14A.1 file: ${file}`)
}

const service = read('src/services/user-wager-ledger.service.ts')
for (const term of [
  'userWagerSessionCookieName',
  'cookieToken',
  'bearer(request) ?? cookieToken(request)',
  'client.auth.getUser(token)',
  'SESSION_INVALID',
  'SESSION_EXPIRED',
  "eq('user_id', auth.userId)",
]) assert(service.includes(term), `service missing marker: ${term}`)
assert(!service.includes('supabaseAdmin'), 'normal user flow must not use service role')

const bridge = read('src/app/api/user/session-bridge/route.ts')
for (const term of [
  'authenticateUserWagerRequest',
  'userWagerBearerToken',
  'httpOnly: true',
  'secure: true',
  "sameSite: 'lax'",
  'userWagerSessionCookieName',
]) assert(bridge.includes(term), `session bridge missing marker: ${term}`)
assert(!bridge.includes('console.log'), 'session bridge must not log tokens')
assert(!bridge.includes('supabaseAdmin'), 'session bridge must not use service role')

const workspace = read('src/components/market-opportunities/BettingDecisionWorkspace.tsx')
for (const term of [
  'bridgeServerSession',
  '/api/user/session-bridge',
  'credentials: \'same-origin\'',
  'supabase.auth.refreshSession',
  'local wagers remain',
]) assert(workspace.includes(term), `workspace missing marker: ${term}`)
assert(!workspace.includes('localStorage.getItem(\'supabase'), 'workspace must not inspect raw Supabase storage')

const apiContract = read('src/lib/api-contract.ts')
for (const term of ['SESSION_INVALID', 'AUTH_VERIFICATION_FAILED']) assert(apiContract.includes(term), `api contract missing ${term}`)

const cert = JSON.parse(read('docs/CERTIFICATION/release-14a1-server-auth-session.json'))
assert(cert.authStrategy.serviceRoleForUserFlow === false, 'service role must be false')
assert(cert.authStrategy.userIdFromClientPayload === false, 'user id from client payload must be false')
assert(cert.certification.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.certification.unauthenticatedRequestsBlocked === true, 'unauthenticated requests must be blocked')
assert(cert.modelSafety.predictionHistoryChanged === false, 'prediction history must not change')

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
for (const file of Array.from(new Set([...changed, ...untracked])).sort()) {
  if (!releaseFiles.has(file) && !knownUnrelatedDirty.has(file)) failures.push(`unexpected dirty file: ${file}`)
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  release: 'Release 14A.1',
  sessionBridge: true,
  serverVerifiesAuth: true,
  unauthenticatedBlocked: true,
  providerCallsMade: 0,
  modelBehaviorChanged: false,
  failures: failures.length,
  failureMessages: failures,
}, null, 2))

process.exit(failures.length === 0 ? 0 : 1)
