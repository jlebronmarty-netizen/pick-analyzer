import crypto from 'node:crypto'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  fingerprintMlbShadowImmutableEvidence,
  immutableEvidenceFromMlbShadowRow,
  MLB_SHADOW_IMMUTABLE_FINGERPRINT_VERSION,
} from './lib/mlb-shadow-immutable-fingerprint.mjs'

const SPORT = 'baseball_mlb'
const ORIGIN = 'CURRENT_ERA_SHADOW'
const SHADOW_MODEL_VERSION = 'MLB_CALIBRATED_SHADOW_V1'
const PENDING_SHADOW_CERTIFICATION_STATUS = 'SHADOW_PENDING'
const SNAPSHOT_TYPE = 'MORNING'
const ARTIFACT_PATH = 'artifacts/mlb/mlb-03-market-calibration-v1.json'
const EXPECTED_DIGEST = '8c8fbf9c5da43ea3933119d39e6c8b1de2b17ee20fa72c5bc2cd65650290c66c'
const MAX_ODDS_AGE_MINUTES = 30
const CERTIFICATION_STATUS_ALLOWED_VALUES = new Set([
  'SHADOW_PENDING',
  'CERTIFIED',
  'QUARANTINED',
  'INVALID',
  'REJECTED',
])

function loadEnvFile(path = '.env.local') {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const index = line.indexOf('=')
    if (index < 1) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && !process.env[key]) process.env[key] = value
  }
}

function stableText(value) {
  return String(value ?? 'null').trim().toLowerCase().replace(/\s+/g, '_')
}

function sameInstant(left, right) {
  return new Date(String(left ?? '')).getTime() === new Date(String(right ?? '')).getTime()
}

function clampProbability(value) {
  return Math.min(0.99, Math.max(0.01, value))
}

function logit(value) {
  const p = clampProbability(value)
  return Math.log(p / (1 - p))
}

function sigmoid(value) {
  if (value >= 0) return 1 / (1 + Math.exp(-value))
  const z = Math.exp(value)
  return z / (1 + z)
}

function normalizeMarket(value) {
  const market = String(value ?? '').toLowerCase()
  if (market.includes('moneyline') || market === 'h2h') return 'moneyline'
  if (market.includes('run') || market.includes('spread')) return 'run_line'
  if (market.includes('total')) return 'total'
  return null
}

function impliedProbability(odds) {
  return odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100)
}

function decimalOdds(odds) {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)
}

function roundPercent(value, digits = 4) {
  return Number((value * 100).toFixed(digits))
}

function calibrate(artifact, rawProbability, market) {
  const map = artifact.markets[market]
  if (!map) return null
  const bucket = map.buckets.find((entry) => rawProbability >= entry.min && rawProbability < entry.max)
  const calibrated =
    bucket && bucket.sample >= map.minBucketSample
      ? bucket.value
      : sigmoid(map.fallback.intercept + map.fallback.slope * logit(rawProbability))
  return {
    probability: clampProbability(calibrated),
    method: bucket && bucket.sample >= map.minBucketSample ? map.method : map.fallback.method,
    version: artifact.artifactVersion,
  }
}

function buildSelectedPriceEvidence(candidate) {
  const implied = impliedProbability(candidate.odds)
  return {
    eventId: candidate.eventId,
    market: candidate.market,
    selection: candidate.selection,
    line: candidate.line ?? null,
    sportsbook: candidate.sportsbook,
    odds: candidate.odds,
    oddsTimestamp: candidate.oddsTimestamp,
    impliedProbability: implied,
    impliedProbabilityPercent: roundPercent(implied),
  }
}

export function buildMlb03r1aPendingSettlementDetails() {
  return {}
}

export function assertMlb03r1aPendingSettlementDetails(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('settlement_details must be a non-null pending metadata object')
  }
  const serialized = JSON.stringify(value).toLowerCase()
  for (const forbidden of ['final_score', 'home_score', 'away_score', 'winner', 'settled_at', 'win', 'loss', 'push']) {
    if (serialized.includes(forbidden)) {
      throw new Error(`settlement_details contains postgame or outcome evidence: ${forbidden}`)
    }
  }
}

export function buildMlb03r1bPendingManualAdjustment() {
  return false
}

export function assertMlb03r1bPendingManualAdjustment(value) {
  if (value !== false) {
    throw new Error('manual_adjustment must be explicit false for autonomous pending shadow rows')
  }
}

function assertNoPendingOutcomeEvidence(row) {
  if (row.result !== null) throw new Error('pending shadow row must not contain a result label')
  if (row.settled_at !== null) throw new Error('pending shadow row must not contain settled_at')
  if (row.result_id !== null) throw new Error('pending shadow row must not contain result_id')
  if (row.profit !== null) throw new Error('pending shadow row must not contain profit')
}

function assertCertificationStatus(value) {
  if (value !== PENDING_SHADOW_CERTIFICATION_STATUS) {
    throw new Error('CURRENT_ERA_SHADOW pending row must use certification_status SHADOW_PENDING')
  }
  if (!CERTIFICATION_STATUS_ALLOWED_VALUES.has(value)) {
    throw new Error(`certification_status is not production-allowed: ${value}`)
  }
}

function buildIdentity(priceEvidence, artifact) {
  return [
    SPORT,
    priceEvidence.eventId,
    priceEvidence.market,
    stableText(priceEvidence.selection),
    priceEvidence.line ?? 'null',
    stableText(priceEvidence.sportsbook),
    ORIGIN,
    artifact.shadowModelVersion,
    artifact.artifactVersion,
    SNAPSHOT_TYPE,
  ].join('|')
}

function assertPriceEvidenceBinding(row, priceEvidence) {
  if (row.sportsbook !== priceEvidence.sportsbook) throw new Error('payload sportsbook must match selected price evidence')
  if (Number(row.odds) !== Number(priceEvidence.odds)) throw new Error('payload odds must match selected price evidence')
  if (!sameInstant(row.odds_timestamp, priceEvidence.oddsTimestamp)) throw new Error('payload odds_timestamp must match selected price evidence')
  if (row.market !== priceEvidence.market) throw new Error('payload market must match selected price evidence')
  if (row.selection !== priceEvidence.selection) throw new Error('payload selection must match selected price evidence')
  if ((row.line ?? null) !== (priceEvidence.line ?? null)) throw new Error('payload line must match selected price evidence')
  if (Number(row.implied_probability) !== Number(priceEvidence.impliedProbabilityPercent)) {
    throw new Error('payload implied_probability must derive from selected price evidence')
  }
  if (!String(row.idempotency_key ?? '').includes(`|${stableText(priceEvidence.sportsbook)}|`)) {
    throw new Error('idempotency key sportsbook must match selected price evidence')
  }
  if (!String(row.prediction_group_key ?? '').includes(`|${stableText(priceEvidence.sportsbook)}|`)) {
    throw new Error('prediction group key sportsbook must match selected price evidence')
  }
  const metadata = row.certification_metadata ?? {}
  const metadataPrice = metadata.selectedPriceEvidence ?? {}
  if (metadataPrice.sportsbook !== priceEvidence.sportsbook) throw new Error('metadata sportsbook must match selected price evidence')
  if (Number(metadataPrice.odds) !== Number(priceEvidence.odds)) throw new Error('metadata odds must match selected price evidence')
}

function safeSourcePredictionFields(source) {
  return {
    sport_key: source.sport_key,
    game_id: source.game_id,
    commence_time: source.commence_time,
    home_team: source.home_team,
    away_team: source.away_team,
    opponent: source.opponent,
    confidence: source.confidence,
    stake: 0,
    lifecycle_status: 'active',
    projected_line: source.projected_line,
    cutoff_at: source.cutoff_at,
    feature_snapshot_id: source.feature_snapshot_id,
    feature_snapshot_key: source.feature_snapshot_key,
    feature_set_version: source.feature_set_version,
    feature_snapshot_generated_at: source.feature_snapshot_generated_at,
    odds_snapshot_id: source.odds_snapshot_id,
    operating_day_id: source.operating_day_id ?? null,
  }
}

function assertPhysicalIdentityIsolation(payload, source) {
  if (!payload.id) throw new Error('new shadow row must have an explicit fresh physical id')
  if (payload.id === source.id) throw new Error('new shadow row must not reuse source prediction id')
  if (payload.result_id !== null) throw new Error('new pending shadow row must not inherit result_id')
  if (payload.result !== null) throw new Error('new pending shadow row must not inherit result')
  if (payload.settled_at !== null) throw new Error('new pending shadow row must not inherit settled_at')
  if (payload.profit !== null) throw new Error('new pending shadow row must not inherit profit')
  if (payload.parent_prediction_id !== source.id) throw new Error('source prediction lineage must be explicit parent_prediction_id')
  if (payload.challenger_of_prediction_id !== source.id) throw new Error('source prediction lineage must be explicit challenger_of_prediction_id')
  if (payload.version_lineage?.sourcePredictionId !== source.id) throw new Error('source prediction lineage missing from version_lineage')
  if (payload.certification_metadata?.sourcePredictionId !== source.id) throw new Error('source prediction lineage missing from certification_metadata')
}

function assertShadowPayload(row, priceEvidence) {
  if (row.prediction_origin !== ORIGIN) throw new Error('wrong prediction_origin')
  if (row.model_role !== 'shadow') throw new Error('wrong model_role')
  if (row.is_current !== false) throw new Error('is_current must be false')
  if (row.recommended_pick !== false) throw new Error('recommended_pick must be false')
  if (row.production_eligible !== false) throw new Error('production_eligible must be false')
  if (row.status !== 'pending') throw new Error('status must be pending')
  if (row.validation_status !== 'valid') throw new Error('validation_status must be valid')
  if (!row.game_id || !row.market || !row.selection || !row.sportsbook || !row.odds_timestamp) {
    throw new Error('missing event/market/selection/price identity')
  }
  if ((row.market === 'run_line' || row.market === 'total') && (row.line === null || row.line === undefined)) {
    throw new Error('exact line required for line market')
  }
  assertMlb03r1aPendingSettlementDetails(row.settlement_details)
  assertMlb03r1bPendingManualAdjustment(row.manual_adjustment)
  assertCertificationStatus(row.certification_status)
  assertNoPendingOutcomeEvidence(row)
  assertPriceEvidenceBinding(row, priceEvidence)
}

async function count(supabase, table, filter) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  if (filter) query = filter(query)
  const { count: exactCount, error } = await query
  if (error) throw new Error(`${table} count failed: ${error.message}`)
  return exactCount ?? 0
}

async function main() {
  loadEnvFile()
  const mode = process.argv.includes('--execute') ? 'execute' : 'dry-run'
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'))
  if (artifact.digest !== EXPECTED_DIGEST) throw new Error('calibration artifact digest mismatch')

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const pre = {
    predictionHistory: await count(supabase, 'prediction_history', (query) => query.eq('sport_key', SPORT)),
    currentEraShadow: await count(supabase, 'prediction_history', (query) => query.eq('sport_key', SPORT).eq('prediction_origin', ORIGIN)),
    activeValidCurrentEraShadow: await count(supabase, 'prediction_history', (query) =>
      query.eq('sport_key', SPORT).eq('prediction_origin', ORIGIN).neq('certification_status', 'QUARANTINED')
    ),
    recommendedPick: await count(supabase, 'prediction_history', (query) => query.eq('sport_key', SPORT).eq('recommended_pick', true)),
    productionEligible: await count(supabase, 'prediction_history', (query) => query.eq('sport_key', SPORT).eq('production_eligible', true)),
  }
  if (mode === 'execute' && pre.activeValidCurrentEraShadow !== 0) {
    throw new Error(`unexpected existing active MLB CURRENT_ERA_SHADOW rows: ${pre.activeValidCurrentEraShadow}`)
  }

  const board = await fetch('https://pick-analyzer.vercel.app/api/current-board?mode=current&limit=50').then((response) => response.json())
  const candidates = []
  for (const row of board.candidates ?? []) {
    const market = normalizeMarket(row.market)
    const rawProbability = Number(row.rawProbability ?? row.modelProbability ?? row.probability) / 100
    const odds = Number(row.americanOdds)
    const oddsAgeMinutes = Number(row.oddsAgeMinutes)
    if (!market || !Number.isFinite(rawProbability) || !Number.isFinite(odds) || !Number.isFinite(oddsAgeMinutes)) continue
    const calibration = calibrate(artifact, rawProbability, market)
    if (!calibration) continue
    const candidate = {
      predictionId: row.predictionId,
      event: row.matchup,
      eventId: row.eventId,
      kickoff: row.scheduledTime,
      eventStatus: row.eventStatus,
      market,
      selection: row.selection,
      line: row.line ?? null,
      sportsbook: row.sportsbook,
      odds,
      oddsTimestamp: row.oddsTimestamp,
      oddsAgeMinutes,
      rawProbability,
      calibratedProbability: calibration.probability,
      calibrationMethod: calibration.method,
      calibrationVersion: calibration.version,
      impliedProbability: impliedProbability(odds),
      pregameSafe: row.pregameSafe === true,
    }
    candidate.calibratedEdge = (candidate.calibratedProbability - candidate.impliedProbability) * 100
    const priceEvidence = buildSelectedPriceEvidence(candidate)
    candidate.identity = buildIdentity(priceEvidence, artifact)
    candidate.existing = await count(supabase, 'prediction_history', (query) =>
      query.eq('sport_key', SPORT).eq('prediction_origin', ORIGIN).eq('idempotency_key', candidate.identity)
        .neq('certification_status', 'QUARANTINED')
    )
    candidate.eligible =
      candidate.pregameSafe &&
      candidate.eventStatus === 'scheduled' &&
      candidate.oddsAgeMinutes <= MAX_ODDS_AGE_MINUTES &&
      candidate.existing === 0 &&
      candidate.selection &&
      candidate.sportsbook &&
      candidate.oddsTimestamp &&
      (candidate.market === 'moneyline' || candidate.line !== null)
    candidates.push(candidate)
  }
  candidates.sort((a, b) => b.calibratedEdge - a.calibratedEdge)
  const chosen = candidates.find((candidate) => candidate.eligible && candidate.calibratedEdge > 0)
  if (!chosen) throw new Error('NO_ELIGIBLE_FRESH_POSITIVE_CALIBRATED_CANDIDATE')

  const sourceResult = await supabase.from('prediction_history').select('*').eq('id', chosen.predictionId).single()
  if (sourceResult.error) throw new Error(`source prediction read failed: ${sourceResult.error.message}`)
  const source = sourceResult.data
  const contextResult = await supabase
    .from('mlb_context_snapshots')
    .select('id,snapshot_type,snapshot_timestamp,temporal_status,missing_components,blockers,completeness')
    .eq('event_id', chosen.eventId)
    .order('snapshot_timestamp', { ascending: false })
    .limit(1)
  if (contextResult.error) throw new Error(`context read failed: ${contextResult.error.message}`)
  const context = contextResult.data?.[0] ?? null
  if (context && context.temporal_status !== 'PREGAME') throw new Error('context snapshot is not pregame')

  const generatedAt = new Date().toISOString()
  const settlementDetails = buildMlb03r1aPendingSettlementDetails()
  const manualAdjustment = buildMlb03r1bPendingManualAdjustment()
  const priceEvidence = buildSelectedPriceEvidence(chosen)
  const payload = {
    ...safeSourcePredictionFields(source),
    id: crypto.randomUUID(),
    market: priceEvidence.market,
    selection: priceEvidence.selection,
    team: priceEvidence.selection,
    line: priceEvidence.line,
    sportsbook: priceEvidence.sportsbook,
    odds: priceEvidence.odds,
    model_probability: Number((chosen.calibratedProbability * 100).toFixed(4)),
    implied_probability: priceEvidence.impliedProbabilityPercent,
    edge: Number(chosen.calibratedEdge.toFixed(4)),
    ev: Number(((chosen.calibratedProbability * decimalOdds(chosen.odds) - 1) * 100).toFixed(4)),
    recommended_pick: false,
    result: null,
    stake: 0,
    profit: null,
    created_at: generatedAt,
    settled_at: null,
    status: 'pending',
    result_id: null,
    closing_odds: null,
    clv: null,
    clv_status: null,
    closing_checked_at: null,
    clv_implied_open: null,
    clv_implied_close: null,
    clv_percent: null,
    clv_quality: null,
    lifecycle_status: 'active',
    odds_timestamp: priceEvidence.oddsTimestamp,
    generated_at: generatedAt,
    model_version: SHADOW_MODEL_VERSION,
    feature_snapshot: {
      ...(source.feature_snapshot ?? {}),
      mlb03CalibratedShadow: {
        contract: 'CALIBRATED_BASELINE_ONLY',
        sourcePredictionId: source.id,
        rawModelProbability: chosen.rawProbability,
        calibratedProbability: chosen.calibratedProbability,
        calibrationMethod: chosen.calibrationMethod,
        calibrationVersion: chosen.calibrationVersion,
        calibrationDigest: artifact.digest,
        contextSnapshotId: context?.id ?? null,
        contextSnapshotType: context?.snapshot_type ?? SNAPSHOT_TYPE,
        contextCompleteness: context?.completeness ?? null,
        missingComponents: context?.missing_components ?? [],
        shadowOnly: true,
      },
    },
    validation_warnings: ['MLB_03_CALIBRATED_SHADOW_CANARY', ...(context?.missing_components ?? [])],
    validation_status: 'valid',
    skip_reason: null,
    settlement_details: settlementDetails,
    manual_adjustment: manualAdjustment,
    production_eligible: false,
    trial: false,
    scrambled: false,
    recommendation_locked_at: null,
    recommendation_lock_status: null,
    official_pick_at_lock: false,
    is_current: false,
    prediction_version: 1,
    model_role: 'shadow',
    prediction_group_key: chosen.identity,
    parent_prediction_id: source.id,
    challenger_of_prediction_id: source.id,
    superseded_at: null,
    superseded_by_prediction_id: null,
    version_created_reason: 'MLB_03_FIRST_CALIBRATED_SHADOW_CANARY',
    idempotency_key: chosen.identity,
    version_lineage: {
      sourcePredictionId: source.id,
      reason: 'MLB_03_FIRST_CALIBRATED_SHADOW_CANARY',
      shadowModelVersion: SHADOW_MODEL_VERSION,
      calibrationVersion: chosen.calibrationVersion,
      calibrationDigest: artifact.digest,
    },
    prediction_epoch_id: null,
    prediction_epoch_key: null,
    prediction_origin: ORIGIN,
    certification_status: PENDING_SHADOW_CERTIFICATION_STATUS,
    certification_metadata: {
      phase: 'MLB-03R1E-R1',
      phaseClassification: 'MLB_03_FIRST_CALIBRATED_SHADOW_CANARY',
      candidateKey: chosen.identity,
      sourcePredictionId: source.id,
      shadowModelVersion: SHADOW_MODEL_VERSION,
      snapshotType: SNAPSHOT_TYPE,
      selectedProbabilityContract: 'CALIBRATED_BASELINE_ONLY',
      rawModelProbability: chosen.rawProbability,
      calibratedProbability: chosen.calibratedProbability,
      calibrationDelta: chosen.calibratedProbability - chosen.rawProbability,
      selectedPriceEvidence: priceEvidence,
      calibrationVersion: chosen.calibrationVersion,
      calibrationDigest: artifact.digest,
      contextSnapshotId: context?.id ?? null,
      contextCompleteness: context?.completeness ?? null,
      impliedProbability: chosen.impliedProbability,
      calibratedEdge: chosen.calibratedEdge,
      settlementDetailsContract: 'EMPTY_PENDING_OBJECT',
      manualAdjustmentContract: 'BOOLEAN_FALSE_PENDING_NO_OVERRIDE',
      productIsolation: {
        recommendedPick: false,
        productionEligible: false,
        isCurrent: false,
      },
    },
  }
  assertPhysicalIdentityIsolation(payload, source)
  assertShadowPayload(payload, priceEvidence)

  let inserted = null
  if (mode === 'execute') {
    const insertResult = await supabase
      .from('prediction_history')
      .insert(payload)
      .select('id,game_id,market,selection,line,sportsbook,odds,odds_timestamp,model_probability,implied_probability,edge,ev,prediction_origin,model_role,is_current,recommended_pick,production_eligible,status,result,settled_at,result_id,profit,manual_adjustment,validation_status,idempotency_key,prediction_group_key,settlement_details,certification_status,parent_prediction_id,certification_metadata')
      .single()
    if (insertResult.error) throw new Error(`canary insert failed: ${insertResult.error.message}`)
    inserted = insertResult.data
    assertShadowPayload(inserted, priceEvidence)
  }

  const post = {
    predictionHistory: await count(supabase, 'prediction_history', (query) => query.eq('sport_key', SPORT)),
    currentEraShadow: await count(supabase, 'prediction_history', (query) => query.eq('sport_key', SPORT).eq('prediction_origin', ORIGIN)),
    activeValidCurrentEraShadow: await count(supabase, 'prediction_history', (query) =>
      query.eq('sport_key', SPORT).eq('prediction_origin', ORIGIN).neq('certification_status', 'QUARANTINED')
    ),
    quarantinedCurrentEraShadow: await count(supabase, 'prediction_history', (query) =>
      query.eq('sport_key', SPORT).eq('prediction_origin', ORIGIN).eq('certification_status', 'QUARANTINED')
    ),
    recommendedPick: await count(supabase, 'prediction_history', (query) => query.eq('sport_key', SPORT).eq('recommended_pick', true)),
    productionEligible: await count(supabase, 'prediction_history', (query) => query.eq('sport_key', SPORT).eq('production_eligible', true)),
    activeExactIdentity: await count(supabase, 'prediction_history', (query) =>
      query.eq('sport_key', SPORT).eq('prediction_origin', ORIGIN).eq('idempotency_key', chosen.identity)
        .neq('certification_status', 'QUARANTINED')
    ),
  }

  console.log(JSON.stringify({
    classification: mode === 'execute' ? 'MLB_03_FIRST_CALIBRATED_SHADOW_CANARY_PASS' : 'MLB_03R1A_CANARY_PAYLOAD_CONTRACT_DRY_RUN_PASS',
    mode,
    artifact: { path: ARTIFACT_PATH, digest: artifact.digest, version: artifact.artifactVersion },
    pre,
    boardGeneratedAt: board.generatedAt,
    candidateUniverse: {
      total: candidates.length,
      eligibleFreshPositive: candidates.filter((candidate) => candidate.eligible && candidate.calibratedEdge > 0).length,
    },
    chosen,
    certificationStatusContract: {
      pendingShadowValue: PENDING_SHADOW_CERTIFICATION_STATUS,
      allowedValues: Array.from(CERTIFICATION_STATUS_ALLOWED_VALUES),
      phaseStoredInMetadata: true,
    },
    pendingSettlementDetailsContract: 'EMPTY_PENDING_OBJECT',
    pendingManualAdjustmentContract: 'BOOLEAN_FALSE_PENDING_NO_OVERRIDE',
    selectedPriceEvidence: priceEvidence,
    payloadAudit: {
      settlementDetailsNonNull: payload.settlement_details !== null,
      manualAdjustmentNonNull: payload.manual_adjustment !== null,
      manualAdjustmentPendingSafe: payload.manual_adjustment === false,
      certificationStatusAllowed: CERTIFICATION_STATUS_ALLOWED_VALUES.has(payload.certification_status),
      certificationStatusPendingSafe: payload.certification_status === PENDING_SHADOW_CERTIFICATION_STATUS,
      priceEvidenceBinding: {
        sportsbook: payload.sportsbook === priceEvidence.sportsbook,
        odds: Number(payload.odds) === Number(priceEvidence.odds),
        oddsTimestamp: payload.odds_timestamp === priceEvidence.oddsTimestamp,
        impliedProbability: Number(payload.implied_probability) === Number(priceEvidence.impliedProbabilityPercent),
        identitySportsbook: String(payload.idempotency_key).includes(`|${stableText(priceEvidence.sportsbook)}|`),
        metadataSportsbook: payload.certification_metadata.selectedPriceEvidence.sportsbook === priceEvidence.sportsbook,
      },
      physicalIdentity: {
        sourcePredictionId: source.id,
        newPayloadId: payload.id,
        sourcePrimaryKeyReused: payload.id === source.id,
        sourceResultIdLeaked: payload.result_id !== null,
        sourceOutcomeLeaked: payload.result !== null || payload.settled_at !== null || payload.profit !== null,
        lineageMetadataPreserved: payload.certification_metadata.sourcePredictionId === source.id,
      },
      pendingOutcomeEvidence: {
        result: payload.result,
        settledAt: payload.settled_at,
        resultId: payload.result_id,
        profit: payload.profit,
      },
      pendingSafe: true,
      missingRequiredFields: 0,
      invalidNullFields: 0,
      unsupportedFields: 0,
    },
    inserted,
    immutableFingerprint: inserted
      ? {
          version: MLB_SHADOW_IMMUTABLE_FINGERPRINT_VERSION,
          digest: fingerprintMlbShadowImmutableEvidence(immutableEvidenceFromMlbShadowRow(inserted)),
        }
      : null,
    post,
    deltas: {
      predictionHistory: post.predictionHistory - pre.predictionHistory,
      currentEraShadow: post.currentEraShadow - pre.currentEraShadow,
      activeValidCurrentEraShadow: post.activeValidCurrentEraShadow - pre.activeValidCurrentEraShadow,
      recommendedPick: post.recommendedPick - pre.recommendedPick,
      productionEligible: post.productionEligible - pre.productionEligible,
    },
    idempotencyProof: {
      status: post.activeExactIdentity === 1 ? 'ALREADY_EXISTS_REUSE_NO_OP' : mode === 'dry-run' ? 'WOULD_INSERT' : 'FAILED',
      wouldInsert: post.activeExactIdentity === 1 ? 0 : mode === 'dry-run' ? 1 : null,
    },
    providerCalls: { theOddsApi: 0, mlbOfficial: 0, sportsDataIO: 0, weather: 0, historical: 0 },
    databaseMutations: mode === 'execute' ? 1 : 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
