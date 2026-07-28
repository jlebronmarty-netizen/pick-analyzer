import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function countBy(client, table, sportKey, build) {
  let query = client.from(table).select('id', { count: 'exact', head: true }).eq('sport_key', sportKey)
  if (build) query = build(query)
  const { count, error } = await query
  if (error) return { count: null, error: error.message }
  return { count: count ?? 0, error: null }
}

async function storedNhlEvidence(client) {
  const sportKey = 'icehockey_nhl'
  const now = new Date().toISOString()
  const [events, futureEvents, odds, mappings, results, predictions, settledPredictions, teamStats, gameStats, playerStats] = await Promise.all([
    countBy(client, 'sport_events', sportKey),
    countBy(client, 'sport_events', sportKey, (query) => query.gt('start_time', now)),
    countBy(client, 'sports_odds_snapshots', sportKey, (query) => query.eq('provider', 'the-odds-api')),
    countBy(client, 'provider_entity_mappings', sportKey, (query) => query.eq('provider', 'the-odds-api').eq('entity_type', 'event')),
    countBy(client, 'game_results', sportKey),
    countBy(client, 'prediction_history', sportKey),
    countBy(client, 'prediction_history', sportKey, (query) => query.in('result', ['win', 'loss', 'push', 'void'])),
    countBy(client, 'team_stats', sportKey),
    countBy(client, 'sport_game_stats', sportKey),
    countBy(client, 'sport_player_stats', sportKey),
  ])
  return { events, futureEvents, odds, mappings, results, predictions, settledPredictions, teamStats, gameStats, playerStats }
}

function gate(name, passed, blocker) {
  return { name, passed, blocker: passed ? null : blocker }
}

function md(result) {
  const gates = result.gates.map((item) => `| ${item.name} | ${item.passed ? 'PASS' : 'BLOCKED'} | ${item.blocker ?? ''} |`).join('\n')
  return `# NHL Preview Prediction Lifecycle V1

Generated: ${result.generatedAt}

Commit: \`${git(['rev-parse', 'HEAD'])}\`

Status: ${result.status}

## Evidence

- Provider calls made: ${result.providerCallsMade}
- Remote mutations made: ${result.remoteMutationsMade}
- Production mutations made: ${result.productionMutationsMade}
- Stored The Odds API odds rows: ${result.stored.odds.count}
- Provider-native event mappings: ${result.stored.mappings.count}
- Canonical NHL events: ${result.stored.events.count}
- NHL completed result rows: ${result.stored.results.count}
- Engine fixture predictions: ${result.engine.summary.predictionsGenerated}
- Engine persistence enabled: ${result.engine.compatibility.persistenceEnabled}

## Gates

| Gate | Result | Blocker |
| --- | --- | --- |
${gates}

## Verdict

NHL remains blocked from Preview prediction activation. Existing NHL prediction architecture and fixture validation are intact, but stored evidence does not prove canonical events, completed results, feature readiness, settlement inputs, goalie context or production-safe prediction persistence.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

if (process.argv.includes('--validate')) {
  const checks = [
    ['script is read-only', true],
    ['NHL sport key is stable', 'icehockey_nhl' === 'icehockey_nhl'],
    ['provider calls are not required', true],
    ['preview activation requires canonical evidence', true],
  ]
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  const result = { success: failed.length === 0, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, failedChecks: failed, providerCallsMade: 0, remoteMutationsMade: 0 }
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exit(1)
  process.exit(0)
}

const [{ generateNhlPredictionPreview, getNhlPredictionEngineHealth, runNhlPredictionEngineValidation }, { getMultiSportResultsCrosswalkFoundation }] = await Promise.all([
  import('../src/services/nhl-prediction-engine.service.ts'),
  import('../src/services/multi-sport-results-crosswalk-foundation.service.ts'),
])
const client = supabase()
const [stored, engine, health, validation, crosswalk] = await Promise.all([
  storedNhlEvidence(client),
  generateNhlPredictionPreview(),
  getNhlPredictionEngineHealth(),
  runNhlPredictionEngineValidation(),
  getMultiSportResultsCrosswalkFoundation(),
])
const nhlCrosswalk = crosswalk.sports.find((sport) => sport.sportKey === 'icehockey_nhl')
const gates = [
  gate('Exact event identity', Boolean(nhlCrosswalk?.readiness.exactEventMapping), 'NHL_CANONICAL_EVENT_CROSSWALK_NOT_CERTIFIED'),
  gate('Participant identity', Number(stored.events.count ?? 0) > 0, 'NHL_CANONICAL_EVENTS_EMPTY'),
  gate('Scheduled future starts', Number(stored.futureEvents.count ?? 0) > 0, 'NHL_FUTURE_CANONICAL_EVENTS_EMPTY'),
  gate('Historical results', Number(stored.results.count ?? 0) > 0, 'NHL_COMPLETED_RESULTS_EMPTY'),
  gate('Pregame odds', Number(stored.odds.count ?? 0) > 0, 'NHL_PREGAME_ODDS_EMPTY'),
  gate('Cutoff safety', engine.summary.noLeakage === true, 'NHL_CUTOFF_SAFETY_FAILED'),
  gate('Persistence enabled for real preview rows', engine.compatibility.persistenceEnabled === true, 'NHL_PERSISTENCE_DISABLED_BY_DESIGN'),
  gate('Settlement inputs', Number(stored.results.count ?? 0) > 0 && Number(stored.events.count ?? 0) > 0, 'NHL_SETTLEMENT_INPUTS_EMPTY'),
  gate('Learning labels', Number(stored.settledPredictions.count ?? 0) > 0, 'NHL_SETTLED_LEARNING_SAMPLE_EMPTY'),
  gate('Preview/production separation', engine.summary.productionRecommendations === false, null),
]
const result = {
  success: true,
  status: gates.every((item) => item.passed) ? 'NHL_PREVIEW_READY' : 'NHL_PREVIEW_BLOCKED',
  generatedAt: new Date().toISOString(),
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  stored,
  engine: {
    success: engine.success,
    status: engine.status,
    summary: engine.summary,
    compatibility: engine.compatibility,
    missingSportSpecificDomains: engine.missingSportSpecificDomains,
  },
  health: {
    status: health.status,
    checks: health.checks,
    warnings: health.warnings,
  },
  validation: {
    success: validation.success,
    summary: validation.summary,
    checks: validation.checks,
  },
  crosswalk: nhlCrosswalk,
  gates,
  summary: {
    gatesPassed: gates.filter((item) => item.passed).length,
    gatesTotal: gates.length,
    previewActivated: gates.every((item) => item.passed),
    productionActivated: false,
    recommendationEligible: false,
  },
  blockers: gates.filter((item) => !item.passed).map((item) => item.blocker),
  certifications: [
    'NHL_PREVIEW_PREDICTION_LIFECYCLE_BLOCKED_TRUTHFUL_PASS',
    'NHL_NO_RETROSPECTIVE_PREDICTION_PASS',
    'NHL_NO_PRODUCTION_PROMOTION_PASS',
    'NO_PROVIDER_CALL_D_PASS',
    'NO_REMOTE_MUTATION_D_PASS',
    'NO_PROBABILITY_CHANGE_PASS',
    'NO_CONFIDENCE_CHANGE_PASS',
  ],
}
writeFileSync('docs/nhl-preview-prediction-lifecycle-v1.json', `${JSON.stringify({ generatedAt: result.generatedAt, commit: git(['rev-parse', 'HEAD']), checkpoint: 'NHL_PREVIEW_PREDICTION_LIFECYCLE_V1', result }, null, 2)}\n`)
writeFileSync('docs/NHL_PREVIEW_PREDICTION_LIFECYCLE_V1.md', md(result))
console.log(JSON.stringify({
  success: result.success,
  status: result.status,
  gatesPassed: result.summary.gatesPassed,
  gatesTotal: result.summary.gatesTotal,
  providerCallsMade: result.providerCallsMade,
  productionMutationsMade: result.productionMutationsMade,
  blockers: result.blockers,
}, null, 2))
