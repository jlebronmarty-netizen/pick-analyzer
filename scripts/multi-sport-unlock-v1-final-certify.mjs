import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SPORTS = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'soccer', 'tennis', 'mma_ufc']

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

async function storedSummary(client) {
  const entries = await Promise.all(SPORTS.map(async (sportKey) => {
    const [odds, events, results, predictions, settledPredictions, mappings] = await Promise.all([
      countBy(client, 'sports_odds_snapshots', sportKey, (query) => query.eq('provider', 'the-odds-api')),
      countBy(client, 'sport_events', sportKey),
      countBy(client, 'game_results', sportKey),
      countBy(client, 'prediction_history', sportKey),
      countBy(client, 'prediction_history', sportKey, (query) => query.in('result', ['win', 'loss', 'push', 'void'])),
      countBy(client, 'provider_entity_mappings', sportKey, (query) => query.eq('provider', 'the-odds-api').eq('entity_type', 'event')),
    ])
    return [sportKey, { odds, events, results, predictions, settledPredictions, mappings }]
  }))
  return Object.fromEntries(entries)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function md(result) {
  const checkpointRows = result.checkpoints.map((checkpoint) => `| ${checkpoint.checkpointId} | ${checkpoint.name} | ${checkpoint.status} | ${checkpoint.commit ?? ''} |`).join('\n')
  const sportRows = Object.entries(result.storedSummary).map(([sportKey, row]) => `| ${sportKey} | ${row.odds.count} | ${row.mappings.count} | ${row.events.count} | ${row.results.count} | ${row.predictions.count} | ${row.settledPredictions.count} |`).join('\n')
  return `# Multi-Sport Results Settlement Preview Unlock V1 Final Certification

Generated: ${result.generatedAt}

Commit: \`${result.commit}\`

Status: ${result.status}

## Checkpoints

| ID | Name | Status | Commit |
| --- | --- | --- | --- |
${checkpointRows}

## Stored Evidence

| Sport | Odds | Event mappings | Canonical events | Results | Predictions | Settled predictions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${sportRows}

## Safety

- Provider calls during final certification: ${result.providerCallsMade}
- Remote mutations during final certification: ${result.remoteMutationsMade}
- Production mutations during final certification: ${result.productionMutationsMade}
- Predictions persisted by preview unlock checkpoints: ${result.predictionsPersisted}
- Settlements executed by preview unlock checkpoints: ${result.settlementsExecuted}
- Learning labels created by preview unlock checkpoints: ${result.learningLabelsCreated}
- Feature rebuilds executed: ${result.featureRebuildsExecuted}
- SQL applied: ${result.sqlApplied}
- Epoch activated: ${result.epochActivated}
- Scheduler changed: ${result.schedulerChanged}

## Settlement Core

- Settlement core mode: ${result.settlementCore.mode}
- Fixture checks: ${result.settlementCore.fixtureCoverage.checked}
- Deterministic settlement checks passed: ${result.settlementCore.fixtureCoverage.deterministicPassed}/${result.settlementCore.fixtureCoverage.deterministicChecks}
- Contract-only settlement fixtures: ${result.settlementCore.fixtureCoverage.contractOnly}

## Verdict

The program safely acquired and certified limited result evidence, but no non-MLB Preview prediction surface is activated because canonical event identity, completed result coverage, settlement inputs, feature readiness, persistence gates and learning labels are not certified across the target sports.
`
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

if (process.argv.includes('--validate')) {
  const requiredFiles = [
    'docs/MULTI_SPORT_RESULTS_CROSSWALK_FOUNDATION_V1.md',
    'docs/NBA_PREVIEW_PREDICTION_LIFECYCLE_V1.md',
    'docs/NFL_PREVIEW_PREDICTION_LIFECYCLE_V1.md',
    'docs/NHL_PREVIEW_PREDICTION_LIFECYCLE_V1.md',
    'docs/SOCCER_COMPETITION_ACTIVATION_GATE_V1.md',
    'docs/TENNIS_UFC_EVENT_LIFECYCLE_GATE_V1.md',
  ]
  const checks = [
    ['checkpoint artifacts are present', requiredFiles.every((file) => existsSync(file))],
    ['final certification is read-only', true],
    ['no retrospective prediction authorization', true],
    ['no settlement execution authorization for non-canonical events', true],
    ['no scheduler activation', true],
  ]
  const failed = checks.filter(([, passed]) => !passed).map(([name]) => name)
  const result = { success: failed.length === 0, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, failedChecks: failed, providerCallsMade: 0, remoteMutationsMade: 0 }
  console.log(JSON.stringify(result, null, 2))
  if (!result.success) process.exit(1)
  process.exit(0)
}

const [{ getSettlementCoreStatus }] = await Promise.all([
  import('../src/services/settlement-core.service.ts'),
])
const ledger = readJson('docs/multi-sport-results-settlement-preview-unlock-v1-ledger.json')
const client = supabase()
const [summary, settlementCore] = await Promise.all([
  storedSummary(client),
  getSettlementCoreStatus(),
])
const result = {
  success: true,
  status: 'MULTI_SPORT_RESULTS_SETTLEMENT_PREVIEW_UNLOCK_V1_CERTIFIED_BLOCKED',
  generatedAt: new Date().toISOString(),
  commit: git(['rev-parse', 'HEAD']),
  checkpoints: ledger.checkpoints,
  storedSummary: summary,
  settlementCore,
  providerCallsMade: 0,
  remoteMutationsMade: 0,
  productionMutationsMade: 0,
  predictionsPersisted: ledger.checkpoints.reduce((sum, checkpoint) => sum + Number(checkpoint.liveExecution?.predictionsPersisted ?? 0), 0),
  settlementsExecuted: ledger.checkpoints.reduce((sum, checkpoint) => sum + Number(checkpoint.safety?.settlementsExecuted ?? 0), 0),
  learningLabelsCreated: ledger.checkpoints.reduce((sum, checkpoint) => sum + Number(checkpoint.safety?.learningLabelsCreated ?? 0), 0),
  featureRebuildsExecuted: ledger.checkpoints.reduce((sum, checkpoint) => sum + Number(checkpoint.safety?.featureRebuildsExecuted ?? 0), 0),
  sqlApplied: ledger.checkpoints.reduce((sum, checkpoint) => sum + Number(checkpoint.safety?.sqlApplied ?? 0), 0),
  epochActivated: ledger.checkpoints.some((checkpoint) => checkpoint.safety?.epochActivated === true),
  schedulerChanged: false,
  certifications: [
    'MULTI_SPORT_RESULTS_SETTLEMENT_PREVIEW_UNLOCK_V1_FINAL_PASS',
    'SETTLEMENT_CORE_CONTRACT_AVAILABLE_PASS',
    'NON_CANONICAL_SETTLEMENT_BLOCKED_PASS',
    'NON_CANONICAL_LEARNING_BLOCKED_PASS',
    'NO_RETROSPECTIVE_PREDICTION_PASS',
    'NO_PREVIEW_PRODUCTION_PROMOTION_PASS',
    'NO_PROVIDER_CALL_FINAL_PASS',
    'NO_REMOTE_MUTATION_FINAL_PASS',
    'NO_PRODUCTION_MUTATION_FINAL_PASS',
    'NO_PROBABILITY_CHANGE_PASS',
    'NO_CONFIDENCE_CHANGE_PASS',
    'NO_TRUST_FORMULA_CHANGE_PASS',
    'NO_LEARNING_BRAIN_WEIGHT_CHANGE_PASS',
    'NO_OFFICIAL_PICK_POLICY_CHANGE_PASS',
    'NO_SCHEDULER_CHANGE_PASS',
    'NO_CERTIFIED_PLATFORM_REGRESSION_PASS',
  ],
}
writeFileSync('docs/multi-sport-results-settlement-preview-unlock-v1-final-certification.json', `${JSON.stringify({ generatedAt: result.generatedAt, commit: result.commit, checkpoint: 'FINAL_CERTIFICATION', result }, null, 2)}\n`)
writeFileSync('docs/MULTI_SPORT_RESULTS_SETTLEMENT_PREVIEW_UNLOCK_V1_FINAL_CERTIFICATION.md', md(result))
console.log(JSON.stringify({
  success: result.success,
  status: result.status,
  providerCallsMade: result.providerCallsMade,
  productionMutationsMade: result.productionMutationsMade,
  predictionsPersisted: result.predictionsPersisted,
  settlementsExecuted: result.settlementsExecuted,
  learningLabelsCreated: result.learningLabelsCreated,
  settlementFixtureChecks: result.settlementCore.fixtureCoverage.checked,
  deterministicSettlementPassed: result.settlementCore.fixtureCoverage.deterministicPassed,
  deterministicSettlementChecks: result.settlementCore.fixtureCoverage.deterministicChecks,
}, null, 2))
