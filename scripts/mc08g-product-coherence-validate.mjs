#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const checks = []

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function exists(file) {
  return fs.existsSync(path.join(root, file))
}

function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail })
  if (!pass) console.error('FAIL', name, detail)
}

const home = read('src/components/home/HomeBettingPlan.tsx')
const settings = read('src/components/settings/PersonalizationSettingsClient.tsx')
const performance = read('src/components/performance/PerformanceProductClient.tsx')
const mostLikely = read('src/components/market-opportunities/MostLikelyTool.tsx')
const bestValue = read('src/components/market-opportunities/BestValueTool.tsx')
const workbench = read('src/components/market-opportunities/BettingWorkbenchTool.tsx')
const mcStatus = JSON.parse(read('docs/MISSION_CONTROL/MISSION_CONTROL_STATUS.json'))
const cert = JSON.parse(read('docs/CERTIFICATION/mc-08g-product-coherence-review.json'))

check('certification artifact exists', exists('docs/CERTIFICATION/MC_08G_PRODUCT_COHERENCE_REVIEW.md'))
check('mission artifact exists', exists('docs/MISSION_CONTROL/MC_08G_PRODUCT_COHERENCE_REVIEW.md'))
check('certification status valid', ['LOCAL_VALIDATION_PENDING', 'LOCALLY_COMPLETE', 'PRODUCTION_CERTIFIED'].includes(cert.status))
check('mission control mc08g present', mcStatus.mc08g?.title === 'Product Polish And Coherence Review')
check('mission control mc08h not started', mcStatus.mc08g?.mc08hStarted === false)
check('mission control mc03 not started', mcStatus.mc08g?.mc03Started === false)
check('homepage timezone labels are user-facing', home.includes('Display timezone') && home.includes('Operating timezone') && !home.includes('Display TZ') && !home.includes('Canonical TZ'))
check('settings persistence status is humanized', settings.includes('function persistenceLabel') && settings.includes('Saved on this device') && settings.includes('Default local settings'))
check('settings preview labels are examples', settings.includes('Example time') && settings.includes('Example odds') && !settings.includes('Preview time') && !settings.includes('Preview odds'))
check('most likely price unavailable copy is clear', mostLikely.includes('Price unavailable - no aligned market') && !mostLikely.includes('Price N/A / Reason No aligned market'))
check('daily decision tool navigation points to Daily Brief', mostLikely.includes('Back to Daily Brief') && bestValue.includes('Back to Daily Brief') && workbench.includes('Back to Daily Brief') && performance.includes('Back to Daily Brief'))
check('workbench confidence label is expanded', workbench.includes('Average Confidence') && !workbench.includes('Avg Conf.'))
check('homepage remains personalized from MC08F', home.includes('data-mc08f-homepage-personalized'))
check('performance remains personalized from MC08F', performance.includes('data-mc08f-performance-personalized'))
check('provider calls documented zero', cert.certificationReads.providerCallsMade === 0)
check('remote mutations documented zero', cert.certificationReads.remoteMutationsMade === 0)
check('behavior changes remain false', Object.entries(cert.behaviorChanges).every(([, value]) => value === false))
check('current era scope unchanged', cert.scopeGuards.currentEraMathChanged === false && cert.scopeGuards.replayBehaviorChanged === false)

let changed = ''
try {
  changed = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8' })
} catch {}
const changedFiles = changed.split(/\r?\n/).filter(Boolean)
const forbiddenRuntime = [
  'src/app/api/',
  'src/services/',
  'src/lib/providers/',
  'src/config/providers',
  'src/config/model',
  'supabase/migrations/',
]
check('no forbidden runtime paths changed', !changedFiles.some((file) => forbiddenRuntime.some((prefix) => file.startsWith(prefix))), changedFiles.join(', '))
check('runtime patch bounded to presentation and docs', changedFiles.every((file) => (
  file.startsWith('src/components/')
  || file.startsWith('docs/')
  || file.startsWith('scripts/mc08g-product-coherence-validate.mjs')
)), changedFiles.join(', '))

const failed = checks.filter((item) => !item.pass)
console.log(JSON.stringify({ validator: 'mc08g-product-coherence-review', checks: checks.length, failures: failed.length, failed }, null, 2))
if (failed.length) process.exit(1)
