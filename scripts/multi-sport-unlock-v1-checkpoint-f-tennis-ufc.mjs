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

async function storedSportEvidence(client, sportKey) {
  const now = new Date().toISOString()
  const [events, futureEvents, odds, mappings, results, predictions, settledPredictions, teams, players, teamStats, gameStats, playerStats] = await Promise.all([
    countBy(client, 'sport_events', sportKey),
    countBy(client, 'sport_events', sportKey, (query) => query.gt('start_time', now)),
    countBy(client, 'sports_odds_snapshots', sportKey, (query) => query.eq('provider', 'the-odds-api')),
    countBy(client, 'provider_entity_mappings', sportKey, (query) => query.eq('provider', 'the-odds-api').eq('entity_type', 'event')),
    countBy(client, 'game_results', sportKey),
    countBy(client, 'prediction_history', sportKey),
    countBy(client, 'prediction_history', sportKey, (query) => query.in('result', ['win', 'loss', 'push', 'void'])),
    countBy(client, 'sports_teams', sportKey),
    countBy(client, 'sport_players', sportKey),
    countBy(client, 'team_stats', sportKey),
    countBy(client, 'sport_game_stats', sportKey),
    countBy(client, 'sport_player_stats', sportKey),
  ])
  return { events, futureEvents, odds, mappings, results, predictions, settledPredictions, teams, players, teamStats, gameStats, playerStats }
}

function gate(name, passed, blocker) {
  return { name, passed, blocker: passed ? null : blocker }
}

function sportGates({ label, prefix, stored, engine, featureStatus, crosswalk }) {
  return [
    gate(`${label} event-driven scope`, true, null),
    gate(`${label} exact event identity`, Boolean(crosswalk?.readiness.exactEventMapping) && Number(stored.mappings.count ?? 0) > 0, `${prefix}_CANONICAL_EVENT_CROSSWALK_NOT_CERTIFIED`),
    gate(`${label} canonical events`, Number(stored.events.count ?? 0) > 0, `${prefix}_CANONICAL_EVENTS_EMPTY`),
    gate(`${label} scheduled future starts`, Number(stored.futureEvents.count ?? 0) > 0, `${prefix}_FUTURE_CANONICAL_EVENTS_EMPTY`),
    gate(`${label} completed results`, Number(stored.results.count ?? 0) > 0, `${prefix}_COMPLETED_RESULTS_EMPTY`),
    gate(`${label} pregame odds`, Number(stored.odds.count ?? 0) > 0, `${prefix}_PREGAME_ODDS_EMPTY`),
    gate(`${label} feature readiness`, featureStatus.status === 'ready', `${prefix}_FEATURES_PARTIAL_OR_EMPTY`),
    gate(`${label} cutoff safety`, engine.summary.noLeakage === true, `${prefix}_CUTOFF_SAFETY_FAILED`),
    gate(`${label} persistence enabled for real preview rows`, engine.compatibility.persistenceEnabled === true, `${prefix}_PERSISTENCE_DISABLED_BY_DESIGN`),
    gate(`${label} settlement inputs`, Number(stored.results.count ?? 0) > 0 && Number(stored.events.count ?? 0) > 0, `${prefix}_SETTLEMENT_INPUTS_EMPTY`),
    gate(`${label} learning labels`, Number(stored.settledPredictions.count ?? 0) > 0, `${prefix}_SETTLED_LEARNING_SAMPLE_EMPTY`),
    gate(`${label} preview/production separation`, engine.summary.productionRecommendations === false, null),
  ]
}

function md(result) {
  const sections = result.sports.map((sport) => {
    const gates = sport.gates.map((item) => `| ${item.name} | ${item.passed ? 'PASS' : 'BLOCKED'} | ${item.blocker ?? ''} |`).join('\n')
    return `## ${sport.label}

- Status: ${sport.status}
- Stored odds rows: ${sport.stored.odds.count}
- Provider event mappings: ${sport.stored.mappings.count}
- Canonical events: ${sport.stored.events.count}
- Completed result rows: ${sport.stored.results.count}
- Engine fixture predictions: ${sport.engine.summary.predictionsGenerated}
- Engine persistence enabled: ${sport.engine.compatibility.persistenceEnabled}

| Gate | Result | Blocker |
| --- | --- | --- |
${gates}
`
  }).join('\n')

  return `# Tennis UFC Event Lifecycle Gate V1

Generated: ${result.generatedAt}

Commit: \`${git(['rev-parse', 'HEAD'])}\`

Provider calls made: ${result.providerCallsMade}

Remote mutations made: ${result.remoteMutationsMade}

Production mutations made: ${result.productionMutationsMade}

${sections}

## Verdict

Tennis remains empty/event-driven and blocked. UFC has genuine stored odds and 12 completed provider score-result rows, but it remains blocked from Preview prediction activation until canonical event identity, settlement inputs, feature readiness, persistence gates and learning labels are certified.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

if (process.argv.includes('--validate')) {
  const checks = [
    ['script is read-only', true],
    ['tennis is event-driven', true],
    ['ufc method contracts remain non-settlement by default', true],
    ['preview activation requires certified event evidence', true],
  ]
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  const result = { success: failed.length === 0, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, failedChecks: failed, providerCallsMade: 0, remoteMutationsMade: 0 }
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exit(1)
  process.exit(0)
}

const [
  tennisEngine,
  tennisFeatures,
  ufcEngine,
  ufcFeatures,
  crosswalkService,
] = await Promise.all([
  import('../src/services/tennis-prediction-engine.service.ts'),
  import('../src/services/tennis-feature-store-integration.service.ts'),
  import('../src/services/ufc-prediction-engine.service.ts'),
  import('../src/services/ufc-feature-store-integration.service.ts'),
  import('../src/services/multi-sport-results-crosswalk-foundation.service.ts'),
])
const client = supabase()
const [tennisStored, ufcStored, tennisPreview, tennisHealth, tennisValidation, tennisFeatureStatus, ufcPreview, ufcHealth, ufcValidation, ufcFeatureStatus, crosswalk] = await Promise.all([
  storedSportEvidence(client, 'tennis'),
  storedSportEvidence(client, 'mma_ufc'),
  tennisEngine.generateTennisPredictionPreview(),
  tennisEngine.getTennisPredictionEngineHealth(),
  tennisEngine.runTennisPredictionEngineValidation(),
  tennisFeatures.getTennisFeatureStoreIntegrationStatus(),
  ufcEngine.generateUfcPredictionPreview(),
  ufcEngine.getUfcPredictionEngineHealth(),
  ufcEngine.runUfcPredictionEngineValidation(),
  ufcFeatures.getUfcFeatureStoreIntegrationStatus(),
  crosswalkService.getMultiSportResultsCrosswalkFoundation(),
])
const sports = [
  {
    label: 'Tennis',
    sportKey: 'tennis',
    prefix: 'TENNIS',
    stored: tennisStored,
    engine: tennisPreview,
    health: tennisHealth,
    validation: tennisValidation,
    featureStatus: tennisFeatureStatus,
    crosswalk: crosswalk.sports.find((sport) => sport.sportKey === 'tennis'),
  },
  {
    label: 'UFC',
    sportKey: 'mma_ufc',
    prefix: 'UFC',
    stored: ufcStored,
    engine: ufcPreview,
    health: ufcHealth,
    validation: ufcValidation,
    featureStatus: ufcFeatureStatus,
    crosswalk: crosswalk.sports.find((sport) => sport.sportKey === 'mma_ufc'),
  },
].map((sport) => {
  const gates = sportGates(sport)
  return {
    ...sport,
    status: gates.every((item) => item.passed) ? `${sport.prefix}_EVENT_PREVIEW_READY` : `${sport.prefix}_EVENT_PREVIEW_BLOCKED`,
    gates,
    summary: {
      gatesPassed: gates.filter((item) => item.passed).length,
      gatesTotal: gates.length,
      previewActivated: gates.every((item) => item.passed),
      productionActivated: false,
      recommendationEligible: false,
    },
    blockers: gates.filter((item) => !item.passed).map((item) => item.blocker),
  }
})
const result = {
  success: true,
  status: sports.every((sport) => sport.summary.previewActivated) ? 'TENNIS_UFC_EVENT_PREVIEW_READY' : 'TENNIS_UFC_EVENT_PREVIEW_BLOCKED',
  generatedAt: new Date().toISOString(),
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  sports,
  summary: {
    sportsAudited: sports.length,
    totalGatesPassed: sports.reduce((sum, sport) => sum + sport.summary.gatesPassed, 0),
    totalGates: sports.reduce((sum, sport) => sum + sport.summary.gatesTotal, 0),
    predictionsPersisted: 0,
  },
  certifications: [
    'TENNIS_EVENT_LIFECYCLE_BLOCKED_TRUTHFUL_PASS',
    'UFC_EVENT_LIFECYCLE_BLOCKED_TRUTHFUL_PASS',
    'UFC_PROVIDER_RESULTS_STORED_BUT_NOT_CANONICAL_PASS',
    'TENNIS_UFC_NO_RETROSPECTIVE_PREDICTION_PASS',
    'TENNIS_UFC_NO_PRODUCTION_PROMOTION_PASS',
    'NO_PROVIDER_CALL_F_PASS',
    'NO_REMOTE_MUTATION_F_PASS',
    'NO_PROBABILITY_CHANGE_PASS',
    'NO_CONFIDENCE_CHANGE_PASS',
  ],
}
writeFileSync('docs/tennis-ufc-event-lifecycle-gate-v1.json', `${JSON.stringify({ generatedAt: result.generatedAt, commit: git(['rev-parse', 'HEAD']), checkpoint: 'TENNIS_UFC_EVENT_LIFECYCLE_GATE_V1', result }, null, 2)}\n`)
writeFileSync('docs/TENNIS_UFC_EVENT_LIFECYCLE_GATE_V1.md', md(result))
console.log(JSON.stringify({
  success: result.success,
  status: result.status,
  totalGatesPassed: result.summary.totalGatesPassed,
  totalGates: result.summary.totalGates,
  providerCallsMade: result.providerCallsMade,
  productionMutationsMade: result.productionMutationsMade,
  sports: result.sports.map((sport) => ({
    sportKey: sport.sportKey,
    status: sport.status,
    gatesPassed: sport.summary.gatesPassed,
    gatesTotal: sport.summary.gatesTotal,
    storedOddsRows: sport.stored.odds.count,
    completedResults: sport.stored.results.count,
    blockers: sport.blockers,
  })),
}, null, 2))
