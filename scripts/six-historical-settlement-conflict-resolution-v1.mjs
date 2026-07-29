import fs from 'node:fs'
import { writeFileSync } from 'node:fs'

const envPath = '.env.local'
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (match) process.env[match[1].trim()] ??= match[2].trim()
  }
}

const MODE = process.argv.includes('--apply') ? 'apply' : 'dry-run'
const VERSION = 'six_historical_settlement_conflict_resolution_v1'
const TARGET_IDS = [
  '0cf650e1-08b8-51ff-ad79-55a6f2f595b1',
  '583d8788-2bd5-5305-af4c-8569438d4dbc',
  '2355ad93-3def-5e9a-8d7f-48217fc1abd3',
  '60868978-2a82-5e1d-a35b-36ed06034e01',
  '7d8e67e1-ba78-5b6d-a102-0fba3448d7b5',
  '9bd2f825-fac2-590f-8b13-31c7c068bce3',
]

const { supabaseAdmin } = await import('../src/lib/supabase-admin.ts')
const {
  canonicalDeterministicOutcome,
  classifyCanonicalSettlementState,
} = await import('../src/services/canonical-settlement-state.service.ts')

const PREDICTION_COLUMNS = [
  'id',
  'sport_key',
  'game_id',
  'commence_time',
  'generated_at',
  'cutoff_at',
  'home_team',
  'away_team',
  'team',
  'opponent',
  'market',
  'line',
  'odds',
  'stake',
  'profit',
  'result',
  'status',
  'lifecycle_status',
  'settlement_details',
  'settled_at',
  'settlement_source',
  'settlement_market',
  'settlement_version',
  'result_id',
  'model_role',
  'model_version',
  'feature_snapshot_id',
  'feature_snapshot_key',
  'feature_snapshot',
  'odds_snapshot_id',
  'operating_day_id',
  'idempotency_key',
  'production_eligible',
  'recommended_pick',
  'trial',
  'scrambled',
  'validation_status',
  'validation_warnings',
  'is_current',
].join(', ')

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

function profitFor(odds, stake, outcome) {
  if (outcome === 'loss') return -stake
  if (outcome === 'push') return 0
  return odds < 0 ? stake * (100 / Math.abs(odds)) : stake * (odds / 100)
}

function selectedScorePair(row, result) {
  const selection = normalize(row.team)
  if (selection === normalize(result.home_team)) return { selectedScore: result.home_score, opponentScore: result.away_score, orientation: 'home' }
  if (selection === normalize(result.away_team)) return { selectedScore: result.away_score, opponentScore: result.home_score, orientation: 'away' }
  return { selectedScore: null, opponentScore: null, orientation: 'unmatched' }
}

async function readRows() {
  const { data, error } = await supabaseAdmin
    .from('prediction_history')
    .select(PREDICTION_COLUMNS)
    .in('id', TARGET_IDS)
  if (error) throw new Error(`prediction_history target read failed: ${error.message}`)
  if ((data ?? []).length !== TARGET_IDS.length) throw new Error(`Expected ${TARGET_IDS.length} target rows, found ${(data ?? []).length}`)
  const unexpected = (data ?? []).filter((row) => !TARGET_IDS.includes(row.id))
  if (unexpected.length) throw new Error(`Unexpected target rows returned: ${unexpected.map((row) => row.id).join(', ')}`)
  return data ?? []
}

async function readResults(gameIds) {
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('id, game_id, sport_key, commence_time, home_team, away_team, home_score, away_score, winner, created_at')
    .in('game_id', gameIds)
  if (error) throw new Error(`game_results target read failed: ${error.message}`)
  return data ?? []
}

async function readResultsByIds(resultIds) {
  if (!resultIds.length) return []
  const { data, error } = await supabaseAdmin
    .from('game_results')
    .select('id, game_id, sport_key, commence_time, home_team, away_team, home_score, away_score, winner, created_at')
    .in('id', resultIds)
  if (error) throw new Error(`game_results result_id read failed: ${error.message}`)
  return data ?? []
}

async function readEvents(gameIds) {
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id, sport_key, league_key, season, start_time, status, home_team, away_team, home_score, away_score, provider_ids, metadata, created_at, updated_at')
    .in('id', gameIds)
  if (error) throw new Error(`sport_events target read failed: ${error.message}`)
  return data ?? []
}

async function readMappings(gameIds) {
  const { data, error } = await supabaseAdmin
    .from('provider_entity_mappings')
    .select('id, sport_key, entity_type, provider, provider_id, internal_id, season, metadata, created_at, updated_at')
    .eq('entity_type', 'event')
    .in('internal_id', gameIds)
  if (error) return { rows: [], error: error.message }
  return { rows: data ?? [], error: null }
}

function proposalFor(row, result, state) {
  const deterministic = canonicalDeterministicOutcome(row, result)
  const stake = Number(row.stake ?? 100) || 100
  const odds = Number(row.odds)
  if (!Number.isFinite(odds)) return { allowed: false, reason: 'ODDS_MISSING_OR_INVALID' }
  if (!['win', 'loss', 'push'].includes(String(deterministic.outcome))) return { allowed: false, reason: deterministic.reason }
  const profit = Number(profitFor(odds, stake, deterministic.outcome).toFixed(2))
  const beforeDetails = asObject(row.settlement_details)
  const alreadyApplied = beforeDetails?.[VERSION]?.deterministicOutcome === deterministic.outcome &&
    row.result === deterministic.outcome &&
    row.status === deterministic.outcome &&
    row.result_id === result.id &&
    row.settlement_source === VERSION &&
    Number(row.profit) === profit
  const nextDetails = {
    ...beforeDetails,
    [VERSION]: {
      repairedAt: new Date().toISOString(),
      repairType: 'STORED_OUTCOME_INCORRECT',
      originalStatus: row.status ?? null,
      originalResult: row.result ?? null,
      originalProfit: row.profit ?? null,
      originalStake: row.stake ?? null,
      canonicalResultId: result.id,
      canonicalGameId: result.game_id,
      canonicalFinalScore: {
        homeTeam: result.home_team,
        awayTeam: result.away_team,
        homeScore: result.home_score,
        awayScore: result.away_score,
      },
      deterministicOutcome: deterministic.outcome,
      deterministicReason: deterministic.reason,
      priorClassification: state.classification,
    },
  }
  return {
    allowed: true,
    alreadyApplied,
    reason: 'STORED_OUTCOME_INCORRECT',
    update: {
      status: deterministic.outcome,
      result: deterministic.outcome,
      profit,
      stake,
      result_id: result.id,
      settlement_market: 'canonical_result_conflict_repair',
      settlement_source: VERSION,
      settlement_version: VERSION,
      settled_at: row.settled_at ?? new Date().toISOString(),
      settlement_details: nextDetails,
    },
  }
}

const beforeRows = await readRows()
const gameIds = Array.from(new Set(beforeRows.map((row) => row.game_id).filter(Boolean)))
const existingResultIds = Array.from(new Set(beforeRows.map((row) => row.result_id).filter(Boolean)))
const [results, events, mappings] = await Promise.all([
  readResults(gameIds),
  readEvents(gameIds),
  readMappings(gameIds),
])
const existingResults = await readResultsByIds(existingResultIds)
const resultByGame = new Map(results.map((row) => [row.game_id, row]))
const existingResultById = new Map(existingResults.map((row) => [row.id, row]))
const eventById = new Map(events.map((row) => [row.id, row]))
const mappingsByInternalId = new Map()
for (const mapping of mappings.rows) {
  const list = mappingsByInternalId.get(mapping.internal_id) ?? []
  list.push(mapping)
  mappingsByInternalId.set(mapping.internal_id, list)
}

const inventory = beforeRows
  .sort((a, b) => TARGET_IDS.indexOf(a.id) - TARGET_IDS.indexOf(b.id))
  .map((row) => {
    const result = row.game_id ? resultByGame.get(row.game_id) : null
    const event = row.game_id ? eventById.get(row.game_id) : null
    const state = classifyCanonicalSettlementState(row, result, event)
    const deterministic = canonicalDeterministicOutcome(row, result)
    const selectedScores = result ? selectedScorePair(row, result) : null
    const proposal = result ? proposalFor(row, result, state) : { allowed: false, reason: 'CANONICAL_RESULT_MISSING' }
    const mappingRows = row.game_id ? mappingsByInternalId.get(row.game_id) ?? [] : []
    const existingResult = row.result_id ? existingResultById.get(row.result_id) : null
    const resultLinkageState = !row.result_id
      ? 'NO_EXISTING_RESULT_LINK'
      : row.result_id === result?.id
        ? 'CANONICAL_RESULT_ALREADY_LINKED'
        : existingResult?.game_id !== row.game_id
          ? 'STALE_CROSS_EVENT_RESULT_LINK'
          : 'CONFLICTING_SAME_EVENT_RESULT_LINK'
    const gates = {
      exactTargetId: TARGET_IDS.includes(row.id),
      deterministicCanonicalEvent: Boolean(event?.id === row.game_id && result?.game_id === row.game_id),
      authoritativeResultEvidence: Boolean(result?.id && result.home_score !== null && result.away_score !== null),
      resultProvenanceNonConflicting: Boolean(result?.id && event?.id === row.game_id),
      supportedMarket: ['moneyline', 'spread', 'run_line', 'run line', 'total'].includes(normalize(row.market)),
      selectionOrientationUnambiguous: selectedScores?.orientation === 'home' || selectedScores?.orientation === 'away' || normalize(row.market) === 'total',
      deterministicOutcomeReproducible: ['win', 'loss', 'push'].includes(String(deterministic.outcome)),
      noDuplicateSettlement: ['NO_EXISTING_RESULT_LINK', 'CANONICAL_RESULT_ALREADY_LINKED', 'STALE_CROSS_EVENT_RESULT_LINK'].includes(resultLinkageState),
      cutoffKnown: Boolean(row.generated_at && row.commence_time),
      idempotentProposal: proposal.allowed === true,
    }
    const gatePassed = Object.values(gates).every(Boolean)
    return {
      predictionId: row.id,
      sport: row.sport_key,
      canonicalGameId: row.game_id,
      providerEventId: event?.provider_ids ?? null,
      eventMatchup: event ? `${event.away_team} @ ${event.home_team}` : `${row.away_team} @ ${row.home_team}`,
      eventStartTime: event?.start_time ?? row.commence_time,
      predictionGeneratedAt: row.generated_at,
      cutoffAt: row.cutoff_at,
      market: row.market,
      line: row.line,
      selection: row.team,
      storedStatus: row.status,
      storedResult: row.result,
      storedStake: row.stake,
      storedProfit: row.profit,
      existingResultId: row.result_id ?? null,
      existingResultGameId: existingResult?.game_id ?? null,
      existingResultFinalScore: existingResult ? `${existingResult.away_team} ${existingResult.away_score}, ${existingResult.home_team} ${existingResult.home_score}` : null,
      resultLinkageState,
      settledAt: row.settled_at,
      settlementSource: row.settlement_source,
      canonicalResultId: result?.id ?? null,
      canonicalFinalScore: result ? `${result.away_team} ${result.away_score}, ${result.home_team} ${result.home_score}` : null,
      canonicalResultProvenance: result ? { table: 'game_results', createdAt: result.created_at, winner: result.winner ?? null } : null,
      deterministicExpectedOutcome: deterministic.outcome,
      deterministicReason: deterministic.reason,
      selectedScoreOrientation: selectedScores,
      featureSnapshotLinkage: row.feature_snapshot_id ?? row.feature_snapshot_key ?? (Object.keys(asObject(row.feature_snapshot)).length ? 'embedded_feature_snapshot' : null),
      modelVersion: row.model_version,
      lifecycleState: state.storedOutcome,
      performanceInclusion: state.performanceIncluded,
      learningInclusion: state.learningIncluded,
      exactConflictReason: `${state.storedOutcome}_vs_${deterministic.outcome}`,
      providerMappings: mappingRows.map((mapping) => ({
        provider: mapping.provider,
        providerId: mapping.provider_id,
        season: mapping.season,
      })),
      classification: proposal.reason,
      repairGate: gates,
      repairGatePassed: gatePassed,
      proposedUpdate: proposal.allowed ? proposal.update : null,
      alreadyApplied: proposal.alreadyApplied === true,
    }
  })

const blocked = inventory.filter((row) => !row.repairGatePassed)
let mutations = 0
if (MODE === 'apply') {
  if (blocked.length) throw new Error(`Repair gate failed for ${blocked.map((row) => row.predictionId).join(', ')}`)
  for (const item of inventory) {
    if (item.alreadyApplied) continue
    const { error } = await supabaseAdmin
      .from('prediction_history')
      .update(item.proposedUpdate)
      .eq('id', item.predictionId)
    if (error) throw new Error(`prediction_history update failed for ${item.predictionId}: ${error.message}`)
    mutations += 1
  }
}

const afterRows = await readRows()
const afterResults = await readResults(gameIds)
const afterResultByGame = new Map(afterResults.map((row) => [row.game_id, row]))
const afterClassifications = afterRows.map((row) => {
  const result = row.game_id ? afterResultByGame.get(row.game_id) : null
  return {
    id: row.id,
    status: row.status,
    result: row.result,
    profit: row.profit,
    stake: row.stake,
    resultId: row.result_id,
    settlementSource: row.settlement_source,
    classification: classifyCanonicalSettlementState(row, result, row.game_id ? eventById.get(row.game_id) : null).classification,
  }
})

const evidence = {
  success: blocked.length === 0,
  mode: `six_historical_settlement_conflict_resolution_v1_${MODE}`,
  generatedAt: new Date().toISOString(),
  targetIds: TARGET_IDS,
  inventory,
  blocked,
  mutations,
  afterClassifications,
  providerCallsMade: 0,
  remoteMutationsMade: mutations,
  settlementWrites: mutations,
  learningWrites: 0,
  modelWeightMutations: 0,
  mappingReadError: mappings.error,
}

writeFileSync('docs/six-historical-settlement-conflict-resolution-v1.json', `${JSON.stringify(evidence, null, 2)}\n`)
console.log(JSON.stringify({
  success: evidence.success,
  mode: evidence.mode,
  targetRows: inventory.length,
  blocked: blocked.length,
  mutations,
  afterClassifications: afterClassifications.reduce((counts, row) => {
    counts[row.classification] = (counts[row.classification] ?? 0) + 1
    return counts
  }, {}),
  providerCallsMade: 0,
  remoteMutationsMade: mutations,
}, null, 2))

if (!evidence.success) process.exit(1)
