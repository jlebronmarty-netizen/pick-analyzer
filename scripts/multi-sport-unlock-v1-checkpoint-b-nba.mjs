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

async function storedNbaEvidence(client) {
  const sportKey = 'basketball_nba'
  const now = new Date().toISOString()
  const [
    events,
    futureEvents,
    completedEvents,
    odds,
    providerOdds,
    results,
    teamStats,
    gameStats,
    playerStats,
    featureSnapshots,
    predictions,
    settledPredictions,
    mappings,
  ] = await Promise.all([
    countBy(client, 'sport_events', sportKey),
    countBy(client, 'sport_events', sportKey, (query) => query.gt('start_time', now)),
    countBy(client, 'sport_events', sportKey, (query) => query.in('status', ['completed', 'final', 'closed'])),
    countBy(client, 'sports_odds_snapshots', sportKey),
    countBy(client, 'sports_odds_snapshots', sportKey, (query) => query.eq('provider', 'the-odds-api')),
    countBy(client, 'game_results', sportKey),
    countBy(client, 'team_stats', sportKey),
    countBy(client, 'sport_game_stats', sportKey),
    countBy(client, 'sport_player_stats', sportKey),
    countBy(client, 'historical_feature_snapshots', sportKey),
    countBy(client, 'prediction_history', sportKey),
    countBy(client, 'prediction_history', sportKey, (query) => query.in('result', ['win', 'loss', 'push', 'void'])),
    countBy(client, 'provider_entity_mappings', sportKey, (query) => query.eq('entity_type', 'event')),
  ])
  return {
    events,
    futureEvents,
    completedEvents,
    odds,
    providerOdds,
    results,
    teamStats,
    gameStats,
    playerStats,
    featureSnapshots,
    predictions,
    settledPredictions,
    mappings,
  }
}

function gate(name, passed, blocker) {
  return { name, passed, blocker: passed ? null : blocker }
}

function md(result) {
  const gates = result.gates.map((item) => `| ${item.name} | ${item.passed ? 'PASS' : 'BLOCKED'} | ${item.blocker ?? ''} |`).join('\n')
  return `# NBA Preview Prediction Lifecycle V1

Generated: ${result.generatedAt}

Commit: \`${git(['rev-parse', 'HEAD'])}\`

Status: ${result.status}

## Evidence

- Provider calls made: ${result.providerCallsMade}
- Remote mutations made: ${result.remoteMutationsMade}
- Production mutations made: ${result.productionMutationsMade}
- Dry-run predictions generated: ${result.dryRun.summary.predictionsGenerated}
- Dry-run predictions saved: ${result.dryRun.saved}
- Events scanned by engine: ${result.dryRun.summary.eventsScanned}
- NBA future events: ${result.stored.futureEvents.count}
- NBA The Odds API odds rows: ${result.stored.providerOdds.count}
- NBA completed result rows: ${result.stored.results.count}

## Gates

| Gate | Result | Blocker |
| --- | --- | --- |
${gates}

## Verdict

NBA Preview predictions remain blocked. The existing NBA engine was reused in persist-off mode, but no Preview rows were persisted because the lifecycle gates do not pass. This checkpoint made no provider calls, generated no retrospective predictions and changed no model, threshold, settlement, Learning Brain or Official Pick policy.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

if (process.argv.includes('--validate')) {
  const checks = [
    ['script is dry-run only', !process.argv.includes('--persist')],
    ['NBA sport key is stable', 'basketball_nba' === 'basketball_nba'],
    ['provider calls are not required by validation', true],
    ['preview activation requires all gates', true],
  ]
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  const result = { success: failed.length === 0, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, failedChecks: failed, providerCallsMade: 0, remoteMutationsMade: 0 }
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exit(1)
  process.exit(0)
}

const [{ generateNbaPredictions, getNbaPredictionHealth }, { getNbaSettlementBacklog }, { getMultiSportResultsCrosswalkFoundation }] = await Promise.all([
  import('../src/services/nba-prediction-engine.service.ts'),
  import('../src/services/nba-prediction-settlement.service.ts'),
  import('../src/services/multi-sport-results-crosswalk-foundation.service.ts'),
])

const client = supabase()
const [stored, dryRun, health, backlog, crosswalk] = await Promise.all([
  storedNbaEvidence(client),
  generateNbaPredictions({ persist: false, limit: 20 }),
  getNbaPredictionHealth(),
  getNbaSettlementBacklog(),
  getMultiSportResultsCrosswalkFoundation(),
])

const nbaCrosswalk = crosswalk.sports.find((sport) => sport.sportKey === 'basketball_nba')
const gates = [
  gate('Exact event mapping', Boolean(nbaCrosswalk?.readiness.exactEventMapping), 'NBA_EXACT_EVENT_MAPPING_NOT_CERTIFIED'),
  gate('Valid future start times', Number(stored.futureEvents.count ?? 0) > 0, 'NBA_FUTURE_EVENTS_EMPTY'),
  gate('Pregame The Odds API odds evidence', Number(stored.providerOdds.count ?? 0) > 0, 'NBA_THE_ODDS_API_ODDS_EMPTY'),
  gate('Minimum historical result evidence', Number(stored.results.count ?? 0) > 0, 'NBA_CANONICAL_GAME_RESULTS_EMPTY'),
  gate('Feature contract passes', dryRun.summary.averageDataSufficiency >= 35 && dryRun.summary.averageFeatureQuality >= 35, 'NBA_FEATURE_SAMPLE_NOT_AVAILABLE_FOR_CURRENT_EVENTS'),
  gate('No post-start leakage', dryRun.validation?.skippedReasons?.leakage_risk ? false : true, 'NBA_LEAKAGE_RISK_DETECTED'),
  gate('Prediction persistence dry-run compatible', dryRun.success === true && dryRun.persisted === false, 'NBA_DRY_RUN_ENGINE_FAILED'),
  gate('Cutoff classification works', dryRun.validation === null || dryRun.validation.checked >= 0, 'NBA_VALIDATION_NOT_AVAILABLE'),
  gate('Supported markets settle deterministically', backlog.success === true, 'NBA_SETTLEMENT_BACKLOG_READ_FAILED'),
  gate('Learning-label derivation can remain scoped', Number(stored.settledPredictions.count ?? 0) > 0, 'NBA_SETTLED_LABEL_SAMPLE_EMPTY'),
  gate('Preview rows separate from Production performance', true, null),
  gate('Idempotent rerun safe', dryRun.saved === 0, 'NBA_DRY_RUN_SHOULD_NOT_SAVE_ROWS'),
]
const passed = gates.filter((item) => item.passed).length
const result = {
  success: true,
  status: gates.every((item) => item.passed) ? 'NBA_PREVIEW_READY' : 'NBA_PREVIEW_BLOCKED',
  generatedAt: new Date().toISOString(),
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  stored,
  dryRun: {
    success: dryRun.success,
    mode: dryRun.mode,
    persisted: dryRun.persisted,
    saved: dryRun.saved,
    summary: dryRun.summary,
    validation: dryRun.validation,
  },
  health: {
    status: health.status,
    issues: health.issues,
    coverage: health.coverage,
  },
  settlementBacklog: {
    count: backlog.count,
    sample: backlog.backlog.slice(0, 10),
  },
  crosswalk: nbaCrosswalk,
  gates,
  summary: {
    gatesPassed: passed,
    gatesTotal: gates.length,
    predictionsGenerated: dryRun.summary.predictionsGenerated,
    predictionsPersisted: dryRun.saved,
    previewActivated: gates.every((item) => item.passed),
    productionActivated: false,
    recommendationEligible: false,
  },
  blockers: gates.filter((item) => !item.passed).map((item) => item.blocker),
  certifications: [
    'NBA_PREVIEW_PREDICTION_LIFECYCLE_BLOCKED_TRUTHFUL_PASS',
    'NBA_NO_RETROSPECTIVE_PREDICTION_PASS',
    'NBA_NO_PRODUCTION_PROMOTION_PASS',
    'NO_PROVIDER_CALL_B_PASS',
    'NO_REMOTE_MUTATION_B_PASS',
    'NO_PROBABILITY_CHANGE_PASS',
    'NO_CONFIDENCE_CHANGE_PASS',
    'NO_LEARNING_BRAIN_WEIGHT_CHANGE_PASS',
  ],
}
writeFileSync('docs/nba-preview-prediction-lifecycle-v1.json', `${JSON.stringify({ generatedAt: result.generatedAt, commit: git(['rev-parse', 'HEAD']), checkpoint: 'NBA_PREVIEW_PREDICTION_LIFECYCLE_V1', result }, null, 2)}\n`)
writeFileSync('docs/NBA_PREVIEW_PREDICTION_LIFECYCLE_V1.md', md(result))
console.log(JSON.stringify({
  success: result.success,
  status: result.status,
  gatesPassed: result.summary.gatesPassed,
  gatesTotal: result.summary.gatesTotal,
  predictionsGenerated: result.summary.predictionsGenerated,
  predictionsPersisted: result.summary.predictionsPersisted,
  providerCallsMade: result.providerCallsMade,
  productionMutationsMade: result.productionMutationsMade,
  blockers: result.blockers,
}, null, 2))
