import fs from 'node:fs'

const summaryPath = 'docs/vercel-build-memory-recovery-v1-summary.json'
const repeatPath = 'docs/build-memory-optimization-v1-phase2-repeat.json'
const manifestPath = 'docs/build-memory-optimization-v1-phase2-route-manifest.json'

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const summary = readJson(summaryPath)
const repeat = readJson(repeatPath)
const manifest = readJson(manifestPath)

assert(summary.success === true, 'Phase 2 summary must be successful')
assert(summary.optimization.serverExternalPackages.includes('@supabase/supabase-js'), 'Supabase server externalization must be recorded')
assert(summary.optimization.webpackBuildWorker === true, 'webpack build worker must be enabled')
assert(repeat.success === true && repeat.exitCode === 0, 'repeat clean build must pass')
assert(repeat.generatedStaticPagesFromOutput === summary.after.generatedStaticPages, 'generated page count must match summary')
assert(repeat.prerenderRouteCount === summary.after.prerenderRouteCount, 'prerender route count must match summary')
assert(manifest.appPageRouteCount === summary.after.appPageRouteCount, 'app page route count must match summary')
assert(manifest.staticPrerenderRoutes.length === summary.after.prerenderRouteCount, 'manifest prerender count mismatch')
assert(summary.after.peakWorkingSetMb <= summary.after.repeatPeakWorkingSetMb, 'recorded best peak should not exceed repeat peak')
assert(summary.impact.peakReductionFromPhaseBFinalPercent >= 10, 'peak memory reduction must be at least 10% from Phase B final baseline')
assert(summary.impact.removedLargestServerChunks.includes('.next/server/chunks/26218.js'), 'Supabase server chunk 26218 should be removed from top bundle list')
assert(summary.impact.removedLargestServerChunks.includes('.next/server/chunks/5139.js'), 'Supabase server chunk 5139 should be removed from top bundle list')
assert(summary.safety.providerCallsMade === 0, 'provider calls must remain zero')
assert(summary.safety.databaseMutations === 0, 'database mutations must remain zero')
assert(summary.safety.businessLogicChanged === false, 'business logic must remain unchanged')

console.log(JSON.stringify({
  success: true,
  peakReductionFromPhaseBFinalPercent: summary.impact.peakReductionFromPhaseBFinalPercent,
  generatedStaticPages: repeat.generatedStaticPagesFromOutput,
  prerenderRouteCount: repeat.prerenderRouteCount,
  appPageRouteCount: manifest.appPageRouteCount,
  providerCallsMade: summary.safety.providerCallsMade,
  databaseMutations: summary.safety.databaseMutations,
}, null, 2))
