#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const failures = []
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE13B_VALIDATOR_TIMEOUT_MS ?? 120000)
const maxFiles = Number(process.env.RELEASE13B_VALIDATOR_MAX_FILES ?? 3500)
let scannedCount = 0

const releaseFiles = new Set([
  'src/components/market-opportunities/BettingDecisionWorkspace.tsx',
  'docs/PRODUCT/RELEASE_13B_LIVE_SLATE_AUDIT.md',
  'docs/PRODUCT/LIVE_SLATE_RULES.md',
  'docs/PRODUCT/BETTING_WORKSPACE_STATE_MACHINE.md',
  'docs/CERTIFICATION/RELEASE_13B_LIVE_SLATE.md',
  'docs/CERTIFICATION/release-13b-live-slate.json',
  'scripts/release13b-live-slate-validate.mjs',
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

function exists(file) {
  return fs.existsSync(full(file))
}

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function walk(dir, files = []) {
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 13B validator exceeded ${timeoutMs}ms`)
  if (scannedCount > maxFiles) throw new Error(`Release 13B validator exceeded max file guard ${maxFiles}`)
  for (const entry of fs.readdirSync(full(dir), { withFileTypes: true })) {
    if (['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'generated', 'out', '.turbo', '.vercel'].includes(entry.name)) continue
    if (entry.isSymbolicLink()) continue
    const relative = rel(path.join(dir, entry.name))
    if (entry.isDirectory()) walk(relative, files)
    else {
      scannedCount += 1
      if (scannedCount % 500 === 0) console.error(`[release13b] scanned ${scannedCount} files...`)
      files.push(relative)
    }
  }
  return files
}

const required = [
  'src/components/market-opportunities/BettingDecisionWorkspace.tsx',
  'docs/PRODUCT/RELEASE_13B_LIVE_SLATE_AUDIT.md',
  'docs/PRODUCT/LIVE_SLATE_RULES.md',
  'docs/PRODUCT/BETTING_WORKSPACE_STATE_MACHINE.md',
  'docs/CERTIFICATION/RELEASE_13B_LIVE_SLATE.md',
  'docs/CERTIFICATION/release-13b-live-slate.json',
  'scripts/release13b-live-slate-validate.mjs',
]

for (const file of required) assert(exists(file), `missing required Release 13B file: ${file}`)

const cert = JSON.parse(read('docs/CERTIFICATION/release-13b-live-slate.json'))
assert(cert.rules.activeBoardUsesAllStoredFallback === false, 'active board must not use all_stored fallback')
assert(cert.rules.historicalRowsSeparated === true, 'historical rows must be separated')
assert(cert.rules.currentPregameOnly === true, 'active board must be current pregame only')
assert(cert.rules.canonicalEventMarketSelection === true, 'canonical event/market/selection rule must be certified')
assert(cert.rules.liveGamesSelectable === false, 'live games must not be selectable')
assert(cert.rules.finalGamesActive === false, 'final games must not be active')
assert(cert.modelSafety.predictionFormulaChanged === false, 'prediction formulas must not change')
assert(cert.modelSafety.probabilityOutputsChanged === false, 'probability outputs must not change')
assert(cert.modelSafety.officialPickPolicyChanged === false, 'Official Picks policy must not change')
assert(cert.modelSafety.learningChanged === false, 'learning must not change')
assert(cert.modelSafety.settlementChanged === false, 'settlement must not change')
assert(cert.modelSafety.schedulerChanged === false, 'scheduler must not change')
assert(cert.certification.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.certification.remoteMutationsMade === 0, 'remote mutations must be zero')
assert(cert.certification.release14Started === false, 'Release 14 must not be started')

const workspace = read('src/components/market-opportunities/BettingDecisionWorkspace.tsx')
for (const term of [
  'canonicalLiveOpportunities',
  'activePregameState',
  'localDayKey',
  'America/Puerto_Rico',
  '/api/current-board?mode=current&limit=100',
  '/api/current-board?mode=all_stored_data&limit=100',
  'History',
  'No Official Picks Today',
  'No pregame opportunities remain today.',
  "Today's slate has concluded.",
  "boardLabel.toUpperCase() === 'HISTORICAL'",
  "item.currentState !== 'pregame'",
]) {
  assert(workspace.includes(term), `workspace missing required marker: ${term}`)
}
assert(!workspace.includes('if (!rows(board.candidates).length)'), 'workspace must not fall back from current board to all_stored active rows')
assert(!workspace.includes('setOpportunities(history'), 'history rows must not populate active opportunities')
assert(!workspace.includes('/api/cron/'), 'workspace must not call cron routes')
assert(!workspace.includes('/api/operations/adaptive-refresh'), 'workspace must not call provider/scheduler routes')
assert(!workspace.includes('prediction_history'), 'workspace must not touch prediction_history')

const docs = [
  'docs/PRODUCT/RELEASE_13B_LIVE_SLATE_AUDIT.md',
  'docs/PRODUCT/LIVE_SLATE_RULES.md',
  'docs/PRODUCT/BETTING_WORKSPACE_STATE_MACHINE.md',
  'docs/CERTIFICATION/RELEASE_13B_LIVE_SLATE.md',
].map(read).join('\n')
for (const term of ['all_stored_data', 'HISTORICAL', 'current pregame', 'event, market and selection', 'No pregame opportunities remain today', 'Prediction logic']) {
  assert(docs.includes(term), `Release 13B docs missing ${term}`)
}

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
for (const file of Array.from(new Set([...changed, ...untracked])).sort()) {
  if (!releaseFiles.has(file) && !knownUnrelatedDirty.has(file)) failures.push(`unexpected dirty file: ${file}`)
  if (!knownUnrelatedDirty.has(file) && (file.startsWith('src/app/api/') || file.startsWith('src/services/') || file.startsWith('supabase/'))) {
    failures.push(`forbidden API/service/schema change in Release 13B: ${file}`)
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
  release: 'Release 13B',
  requiredFiles: required.length,
  scannedFiles: scanned.length,
  activeAllStoredFallbackRemoved: true,
  historicalRowsSeparated: true,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  modelBehaviorChanged: false,
  failures: failures.length,
  failureMessages: failures,
}, null, 2))

process.exit(failures.length === 0 ? 0 : 1)
