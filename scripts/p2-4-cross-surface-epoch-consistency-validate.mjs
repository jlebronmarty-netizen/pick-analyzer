import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(ROOT, file))
const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
const originalStatus = execFileSync('git', ['-C', 'C:/Projects/pick-analyzer', 'status', '--short'], { encoding: 'utf8' })
const envPath = 'C:/Projects/pick-analyzer/.env.local'
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}
const { validateE2eSystemIntegrityFixtures } = await import('../src/services/e2e-system-integrity.service.ts')

const allowed = new Set([
  'src/services/e2e-system-integrity.service.ts',
  'docs/ARCHITECTURE/CROSS_SURFACE_EPOCH_CONSISTENCY.md',
  'docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md',
  'docs/OPERATIONAL_EXCELLENCE/P2_4_CROSS_SURFACE_EPOCH_CONSISTENCY.md',
  'docs/CERTIFICATION/P2_4_CROSS_SURFACE_EPOCH_CONSISTENCY.md',
  'docs/CERTIFICATION/p2-4-cross-surface-epoch-consistency.json',
  'docs/CERTIFICATION/README.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
  'scripts/p2-4-cross-surface-epoch-consistency-validate.mjs',
])

const checks = []
function check(name, passed, detail = '') { checks.push({ name, passed: Boolean(passed), detail }) }

const service = read('src/services/e2e-system-integrity.service.ts')
const cert = JSON.parse(read('docs/CERTIFICATION/p2-4-cross-surface-epoch-consistency.json'))
const arch = read('docs/ARCHITECTURE/CROSS_SURFACE_EPOCH_CONSISTENCY.md')
const certification = read('docs/CERTIFICATION/P2_4_CROSS_SURFACE_EPOCH_CONSISTENCY.md')
const status = JSON.parse(read('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json'))
const disallowed = changed.filter((file) => !allowed.has(file))
const fixture = validateE2eSystemIntegrityFixtures()

check('only P2.4 allowed files changed', disallowed.length === 0, disallowed.join(', '))
check('paused MC-08E checkout remains preserved', originalStatus.includes('src/components/home/HomeBettingPlan.tsx') && originalStatus.includes('MC_08E_WATCHLIST_EXPERIENCE.md'))
check('surfaceConsistency runtime contract exists', service.includes('function buildSurfaceConsistency') && service.includes('surfaceConsistency'))
check('active Current V2 epoch is explicit', service.includes('CURRENT_V2_PRODUCTION') && cert.activeEpochKey === 'CURRENT_V2_PRODUCTION')
check('Legacy and Replay scopes are explicit', arch.includes('LEGACY_PRE_V2') && arch.includes('REPLAY') && cert.replayScope === 'REPLAY')
check('Current Era equation is enforced', service.includes('canonicalPredictionRows === settledCanonicalRows + pendingCanonicalRows + blockedCanonicalRows'))
check('Replay equation is enforced', service.includes('replayPredictions === replaySettled + replayPending'))
check('recommendation differences are scope-explained', service.includes('recommendation_filtering') && service.includes('EXPECTED_SCOPE_DIFFERENCE'))
check('Replay isolation is scope-explained', service.includes('replay_isolation') && service.includes('Replay is reported only as Replay'))
check('major surfaces are enumerated', cert.surfaces.length >= 14 && cert.surfaces.includes('Historical Replay') && cert.surfaces.includes('E2E Integrity'))
check('Homepage and Performance both documented', arch.includes('Homepage') && arch.includes('Performance') && certification.includes('Homepage'))
check('P2.4 docs are present', exists('docs/OPERATIONAL_EXCELLENCE/P2_4_CROSS_SURFACE_EPOCH_CONSISTENCY.md') && exists('docs/CERTIFICATION/P2_4_CROSS_SURFACE_EPOCH_CONSISTENCY.md'))
check('safety forbids business-rule changes', cert.safety.predictionFormulaChanged === false && cert.safety.officialPickPolicyChanged === false && cert.safety.schedulerChanged === false)
check('read path exposes zero provider calls', service.includes('providerCallsMade: 0') && cert.safety.providerCallsIntroduced === 0)
check('read path exposes zero mutations', service.includes('remoteMutationsMade: 0') && cert.safety.remoteMutationsIntroduced === 0)
check('fixture validator passes', fixture.success === true)
check('Mission Control records P2.4 and the next eligible phase', ['PASS_PENDING_PRODUCTION_DEPLOYMENT', 'PRODUCTION_CERTIFIED'].includes(status.p2_4?.status) && ['P2.4', 'MC-08E-R'].includes(status.nextEligiblePhase?.id))
check('MC-08E and MC-03 were not started', cert.mc08eResumed === false && cert.mc03Started === false)
check('expected Current Era counts are documented', cert.expectedCounts.currentEra.canonicalPredictionRows === 69 && cert.expectedCounts.currentEra.settledCanonicalRows === 24)
check('expected Replay counts are documented', cert.expectedCounts.replay.replayPredictionRows === 30 && cert.expectedCounts.replay.replaySettledRows === 30)

const failedChecks = checks.filter((item) => !item.passed)
const result = {
  success: failedChecks.length === 0,
  mode: 'p2_4_cross_surface_epoch_consistency_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  fixture,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}
console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)
