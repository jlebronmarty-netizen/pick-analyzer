#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const failures = []
const startedAt = Date.now()
const timeoutMs = Number(process.env.RELEASE12_VALIDATOR_TIMEOUT_MS ?? 120000)
const maxFiles = Number(process.env.RELEASE12_VALIDATOR_MAX_FILES ?? 2500)
let scannedCount = 0

const releaseFiles = new Set([
  'src/app/betting-workbench/page.tsx',
  'src/components/market-opportunities/BettingDecisionWorkspace.tsx',
  'docs/PRODUCT/RELEASE_12_BETTING_WORKSPACE_AUDIT.md',
  'docs/PRODUCT/BETTING_DECISION_WORKSPACE.md',
  'docs/PRODUCT/BET_SLIP_AND_RISK_GUIDE.md',
  'docs/PRODUCT/PERSONAL_WAGER_TRACKING.md',
  'docs/CERTIFICATION/RELEASE_12_BETTING_WORKSPACE.md',
  'docs/CERTIFICATION/release-12-betting-workspace.json',
  'scripts/release12-betting-workspace-validate.mjs',
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

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function walk(dir, files = []) {
  if (Date.now() - startedAt > timeoutMs) throw new Error(`Release 12 validator exceeded ${timeoutMs}ms`)
  if (scannedCount > maxFiles) throw new Error(`Release 12 validator exceeded max file guard ${maxFiles}`)
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (['.git', '.next', 'node_modules', 'coverage', 'dist', 'build', 'generated', 'out', '.turbo', '.vercel'].includes(entry.name)) continue
    if (entry.isSymbolicLink()) continue
    const relative = rel(path.join(dir, entry.name))
    if (entry.isDirectory()) walk(relative, files)
    else {
      scannedCount += 1
      if (scannedCount % 500 === 0) console.error(`[release12] scanned ${scannedCount} files...`)
      files.push(relative)
    }
  }
  return files
}

const required = [
  'src/app/betting-workbench/page.tsx',
  'src/components/market-opportunities/BettingDecisionWorkspace.tsx',
  'docs/PRODUCT/RELEASE_12_BETTING_WORKSPACE_AUDIT.md',
  'docs/PRODUCT/BETTING_DECISION_WORKSPACE.md',
  'docs/PRODUCT/BET_SLIP_AND_RISK_GUIDE.md',
  'docs/PRODUCT/PERSONAL_WAGER_TRACKING.md',
  'docs/CERTIFICATION/RELEASE_12_BETTING_WORKSPACE.md',
  'docs/CERTIFICATION/release-12-betting-workspace.json',
  'scripts/release12-betting-workspace-validate.mjs',
]

for (const file of required) assert(exists(file), `missing required Release 12 file: ${file}`)

const cert = JSON.parse(read('docs/CERTIFICATION/release-12-betting-workspace.json'))
assert(cert.predictionFormulaChanged === false, 'prediction formulas must remain unchanged')
assert(cert.probabilityCalibrationChanged === false, 'probability calibration must remain unchanged')
assert(cert.officialPickPolicyChanged === false, 'Official Picks policy must remain unchanged')
assert(cert.learningWeightsChanged === false, 'learning weights must remain unchanged')
assert(cert.schedulerChanged === false, 'scheduler must remain unchanged')
assert(cert.providerContractsChanged === false, 'provider contracts must remain unchanged')
assert(cert.predictionSettlementChanged === false, 'prediction settlement must remain unchanged')
assert(cert.databaseSchemaChanged === false, 'database schema must remain unchanged')
assert(cert.providerCallsMade === 0, 'provider calls must be zero')
assert(cert.remoteMutationsMade === 0, 'remote mutations must be zero')
assert(cert.workspace.canonicalRoute === '/betting-workbench', 'canonical workspace route must be /betting-workbench')
assert(cert.workspace.officialPicks && cert.workspace.valueCandidates && cert.workspace.researchPicks && cert.workspace.noBetAvoid, 'all opportunity groups must be implemented')
assert(cert.betSlip.userControlled === true, 'bet slip must be user controlled')
assert(cert.betSlip.autoBetPlacement === false, 'bet slip must not place bets')
assert(cert.betSlip.evRequiresProbabilityAndPrice === true, 'EV must require probability and price')
assert(cert.parlaySafety.combinedModelProbabilityFabricated === false, 'parlay model probability must not be fabricated')
assert(cert.userWagerTracking.persistence === 'LOCAL_BROWSER_STORAGE_ONLY', 'user wager tracking must be local-only in Release 12')
assert(cert.userWagerTracking.separateFromPredictionSettlement === true, 'user wager settlement must remain separate from prediction settlement')
assert(cert.userWagerTracking.retrospectivePredictionCreation === false, 'no retrospective predictions may be created')
assert(cert.release13Started === false, 'Release 13 must not be started')

const page = read('src/app/betting-workbench/page.tsx')
const workspace = read('src/components/market-opportunities/BettingDecisionWorkspace.tsx')
assert(page.includes('BettingDecisionWorkspace'), 'betting workbench page must use Release 12 workspace')
for (const term of [
  '/api/current-board?mode=current&limit=100',
  '/api/predictions/top',
  '/api/model/intelligence',
  '/api/model/segments',
  '/api/dashboard/today',
  'OFFICIAL_PICK',
  'VALUE_CANDIDATE',
  'RESEARCH_ONLY',
  'NO_BET',
  'Combined model probability unavailable because leg dependence has not been validated.',
  'LOCAL_BROWSER_STORAGE_ONLY',
  'localStorage',
  'prediction settlement',
  'No Bet',
]) {
  assert(workspace.includes(term), `workspace missing required marker: ${term}`)
}
assert(!workspace.includes('/api/cron/'), 'workspace must not call cron routes')
assert(!workspace.includes('/api/operations/adaptive-refresh'), 'workspace must not invoke adaptive refresh')
assert(!workspace.includes('.insert(') && !workspace.includes('.update(') && !workspace.includes('.delete('), 'workspace must not perform database mutations')

const docs = [
  'docs/PRODUCT/RELEASE_12_BETTING_WORKSPACE_AUDIT.md',
  'docs/PRODUCT/BETTING_DECISION_WORKSPACE.md',
  'docs/PRODUCT/BET_SLIP_AND_RISK_GUIDE.md',
  'docs/PRODUCT/PERSONAL_WAGER_TRACKING.md',
  'docs/CERTIFICATION/RELEASE_12_BETTING_WORKSPACE.md',
].map(read).join('\n')
for (const term of [
  'Official Pick',
  'Value Candidate',
  'Research Pick',
  'No Bet',
  'user-entered',
  'combined model probability',
  'prediction settlement',
  'local browser storage',
  'Daily Brief',
]) {
  assert(docs.toLowerCase().includes(term.toLowerCase()), `Release 12 docs missing ${term}`)
}

const changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map(rel)
for (const file of Array.from(new Set([...changed, ...untracked])).sort()) {
  if (!releaseFiles.has(file) && !knownUnrelatedDirty.has(file)) failures.push(`unexpected dirty file: ${file}`)
  if (!knownUnrelatedDirty.has(file) && (file.startsWith('src/services/') || file.startsWith('src/app/api/') || file.startsWith('supabase/') || file.startsWith('.github/'))) {
    failures.push(`forbidden model, API, schema or scheduler file changed in Release 12: ${file}`)
  }
}

const scanned = [...walk('src'), ...walk('docs'), ...walk('scripts')]
for (const file of scanned) {
  if (!/\.(md|json|mjs|js|ts|tsx)$/.test(file)) continue
  const content = read(file)
  if (/sk-[A-Za-z0-9_-]{20,}/.test(content) || /ghp_[A-Za-z0-9_]{20,}/.test(content) || /github_pat_[A-Za-z0-9_]{20,}/.test(content) || /AKIA[0-9A-Z]{16}/.test(content) || /SUPABASE_SERVICE_ROLE_KEY\s*=/.test(content) || /ODDS_API_KEY\s*=/.test(content) || /CRON_SECRET\s*=/.test(content)) {
    failures.push(`possible secret found in ${file}`)
  }
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  release: 'Release 12',
  requiredFiles: required.length,
  scannedFiles: scanned.length,
  workspaceImplemented: true,
  betSlipImplemented: true,
  personalWagerTracking: 'LOCAL_BROWSER_STORAGE_ONLY',
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  modelBehaviorChanged: false,
  parlayProbabilityFabricated: false,
  failures: failures.length,
  failureMessages: failures,
}, null, 2))
process.exit(failures.length === 0 ? 0 : 1)
