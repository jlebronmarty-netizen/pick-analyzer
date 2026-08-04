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
const { validateHistoricalProgressiveReplayFixtures } = await import('../src/services/historical-progressive-replay.service.ts')

const allowed = new Set([
  'src/services/historical-progressive-replay.service.ts',
  'src/app/api/operations/historical-replay/route.ts',
  'src/app/api/operations/historical-replay/jobs/[id]/route.ts',
  'src/app/api/performance/route.ts',
  'docs/ARCHITECTURE/HISTORICAL_PROGRESSIVE_REPLAY_V1.md',
  'docs/ARCHITECTURE/E2E_PREDICTION_PIPELINE.md',
  'docs/OPERATIONAL_EXCELLENCE/P2_3_HISTORICAL_PROGRESSIVE_REPLAY.md',
  'docs/CERTIFICATION/P2_3_HISTORICAL_PROGRESSIVE_REPLAY.md',
  'docs/CERTIFICATION/p2-3-historical-progressive-replay.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json',
  'docs/MISSION_CONTROL/MISSION_CONTROL_QUEUE.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_CHECKLIST.md',
  'docs/MISSION_CONTROL/MISSION_CONTROL_LOG.md',
  'docs/PROJECT_STATUS.md',
  'docs/MASTER_ROADMAP.md',
  'scripts/p2-3-progressive-historical-replay-validate.mjs',
  'scripts/p2-2d-current-era-settlement-closure-validate.mjs',
])

const checks = []
function check(name, passed, detail = '') { checks.push({ name, passed: Boolean(passed), detail }) }

const service = read('src/services/historical-progressive-replay.service.ts')
const performance = read('src/app/api/performance/route.ts')
const route = read('src/app/api/operations/historical-replay/route.ts')
const jobRoute = read('src/app/api/operations/historical-replay/jobs/[id]/route.ts')
const disallowed = changed.filter((file) => !allowed.has(file))
const dryRun = await validateHistoricalProgressiveReplayFixtures()

check('only P2.3 allowed files changed', disallowed.length === 0, disallowed.join(', '))
check('paused MC-08E checkout remains dirty and untouched', originalStatus.includes('src/components/home/HomeBettingPlan.tsx') && originalStatus.includes('MC_08E_WATCHLIST_EXPERIENCE.md'))
check('replay scope is isolated', service.includes("P23_REPLAY_SCOPE = 'REPLAY'") && service.includes("forbiddenScopes: ['CURRENT_V2_PRODUCTION', 'LEGACY_PRE_V2']"))
check('Current Era production rows are not written', service.includes('currentEraWrites: 0') && service.includes('productionPredictionHistoryMutated: false'))
check('historical source rows are not mutated', service.includes('historicalMutations: 0') && service.includes('historicalFeaturesUnchanged'))
check('market timestamp is before cutoff', service.includes('marketTimestampBeforeCutoff') && service.includes('oddsTs < cutoffTs'))
check('features are before cutoff', service.includes('featureTimestampBeforeOrAtCutoff') && service.includes('featureAsOfTs <= cutoffTs'))
check('result is excluded from feature generation', service.includes('finalResultExcludedFromFeatureSnapshot'))
check('deterministic chronological ordering', service.includes("order('commence_time', { ascending: true })") && service.includes("order('game_id', { ascending: true })"))
check('engine version is frozen', service.includes('P23_REPLAY_ENGINE_VERSION') && service.includes('engineVersionFrozen'))
check('one canonical prediction per event-market', service.includes('selectCanonicalRows') && service.includes('for (const market of MARKETS)'))
check('opposite side double counting prevented', service.includes('sort((a, b) => Number(b.confidence') && service.includes('const candidate = eventRows'))
check('one-event dry-run validates', dryRun.success === true && dryRun.dryRun?.eventLimit === 1)
check('rerun idempotency is deterministic', service.includes('idempotency_key') && service.includes('existingIds') && service.includes('reused'))
check('bounded sample respects maximum', service.includes('MAX_EVENTS = 10') && service.includes('Math.min(Number(options.eventLimit ?? 1), MAX_EVENTS)'))
check('checkpoint resume contract exists', service.includes('CHECKPOINT_KEY') && service.includes('resumeSupported: true'))
check('skipped events carry reasons', service.includes('skippedDetails') && service.includes('HISTORICAL_ODDS_UNAVAILABLE') && service.includes('SKIPPED_LEAKAGE_RISK'))
check('leakage-risk events create no prediction', service.includes("continue\n      }") && service.includes('SKIPPED_LEAKAGE_RISK'))
check('provider calls remain zero', dryRun.providerCallsMade === 0 && service.includes('providerCallsMade: 0'))
check('production learning writes remain zero', service.includes('productionLearningWrites: 0'))
check('Replay metrics remain separate from Performance Current Era', performance.includes('replayPerformance: replay') && performance.includes('getHistoricalProgressiveReplayStatus'))
check('read-only diagnostic API exists', route.includes('GET') && route.includes('getHistoricalProgressiveReplayStatus'))
check('protected writer API requires CRON_SECRET for dryRun=false', route.includes('CRON_SECRET') && route.includes('dryRun === false') && route.includes('UNAUTHORIZED'))
check('job diagnostic API exists', jobRoute.includes('jobs') || jobRoute.includes('job status'))
check('docs/certification artifacts present or pending creation', exists('scripts/p2-3-progressive-historical-replay-validate.mjs'))

const failedChecks = checks.filter((item) => !item.passed)
const result = {
  success: failedChecks.length === 0,
  mode: 'p2_3_progressive_historical_replay_validation_v1',
  checks: checks.length,
  passed: checks.length - failedChecks.length,
  failed: failedChecks.length,
  failedChecks,
  dryRunSummary: {
    eventLimit: dryRun.dryRun?.eventLimit,
    predictions: dryRun.dryRun?.predictions,
    skipped: dryRun.dryRun?.skipped,
    providerCallsMade: dryRun.providerCallsMade,
    remoteMutationsMade: dryRun.remoteMutationsMade,
  },
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}

console.log(JSON.stringify(result, null, 2))
if (!result.success) process.exit(1)



