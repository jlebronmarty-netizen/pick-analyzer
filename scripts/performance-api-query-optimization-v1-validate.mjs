import { readFileSync } from 'node:fs'

const route = readFileSync('src/app/api/performance/route.ts', 'utf8')
const scope = readFileSync('src/services/performance-scope-v2.service.ts', 'utf8')

const checks = [
  [
    'default route keeps AI diagnostics behind explicit full flag',
    /includeFullDiagnostics[\s\S]+getAiPerformanceCenterLazy\(\{ sportKey, dryRun: true \}\)[\s\S]+Promise\.resolve\(null\)/.test(route),
  ],
  [
    'default route exposes product summary response mode',
    /responseMode:\s*includeFullDiagnostics \? 'full_diagnostics' : 'product_summary'/.test(route),
  ],
  [
    'performance route still uses canonical product contract',
    /getPerformanceProductContract\(\{[\s\S]*sportKey,[\s\S]*includeHistoryRows:[\s\S]*maxPredictionRows:[\s\S]*\}\)/.test(route),
  ],
  [
    'performance route reports zero provider calls',
    /providerCallsMade:\s*0/.test(route),
  ],
  [
    'performance route reports zero remote mutations',
    /remoteMutationsMade:\s*0/.test(route),
  ],
  [
    'scope loads scheduler coverage and rows in parallel',
    /const \[schedulerCoverage, rowLoad(?:, activeEpoch)?\] = await Promise\.all\(\[[\s\S]+getPregameSchedulerCoverage\(\)[\s\S]+loadRows\(sportKey, maxPredictionRows\)[\s\S]+\]\)/.test(scope),
  ],
  [
    'event lookup remains bounded at 100 ids to avoid Supabase header limits',
    /index \+= 100/.test(scope) && /eventIds\.slice\(index, index \+ 100\)/.test(scope),
  ],
]

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)

console.log(JSON.stringify({
  success: failed.length === 0,
  mode: 'performance_api_query_optimization_v1_validation',
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  failedChecks: failed,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
}, null, 2))

if (failed.length) process.exit(1)
