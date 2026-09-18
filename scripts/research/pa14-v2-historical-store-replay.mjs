#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { supabaseAdmin } from '../../src/lib/supabase-admin.ts'
import { buildPePitcherKV2Row, pa14V2CanonicalJson, pa14V2Sha256 } from '../../src/lib/pe-pitcher-k-v2-builder.ts'
import { auditHistoricalPa14V2Target } from '../../src/services/pa14-v2-historical-yield-audit.service.ts'

if (process.env.PA14_V2_HISTORICAL_STORE_CONFIRM !== 'RESEARCH_ONLY') {
  throw new Error('PA14_HISTORICAL_STORE_CONFIRM_REQUIRED')
}

function positiveInt(value, label) {
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`INVALID_${label}`)
  return n
}

async function loadTargets() {
  const arg = process.argv.find((value) => value.startsWith('--targets='))
  let raw = process.env.PA14_V2_HISTORICAL_TARGETS_JSON ?? null
  if (arg) raw = await readFile(arg.slice('--targets='.length), 'utf8')
  if (!raw) throw new Error('PA14_HISTORICAL_TARGETS_REQUIRED')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('PA14_HISTORICAL_TARGETS_INVALID')
  return parsed.map((row) => {
    if (!row || typeof row !== 'object') throw new Error('PA14_HISTORICAL_TARGET_INVALID')
    const expectedPitcherIds = Array.isArray(row.expectedPitcherIds)
      ? row.expectedPitcherIds.map((value) => positiveInt(value, 'EXPECTED_PITCHER_ID'))
      : []
    if (expectedPitcherIds.length !== 2 || new Set(expectedPitcherIds).size !== 2) {
      throw new Error('PA14_HISTORICAL_EXPECTED_STARTERS_INVALID')
    }
    const targetPitcherId = positiveInt(row.targetPitcherId, 'TARGET_PITCHER_ID')
    if (!expectedPitcherIds.includes(targetPitcherId)) throw new Error('PA14_HISTORICAL_TARGET_NOT_EXPECTED_STARTER')
    return {
      canonicalGamePk: positiveInt(row.canonicalGamePk, 'GAME_PK'),
      expectedPitcherIds,
      targetPitcherId,
    }
  })
}

async function storeAndReplay(target) {
  const evidence = await auditHistoricalPa14V2Target(target)
  if (!evidence.historicalAuditEligible || evidence.result?.status !== 'ELIGIBLE' || !evidence.replayMatch) {
    throw new Error(`NOT_ELIGIBLE:${target.canonicalGamePk}:${target.targetPitcherId}`)
  }
  if (!evidence.storedInput || typeof evidence.inputDigest !== 'string') throw new Error('MISSING_STORED_INPUT')

  const computedInputDigest = pa14V2Sha256(pa14V2CanonicalJson(evidence.storedInput))
  if (computedInputDigest !== evidence.inputDigest) throw new Error('INPUT_DIGEST_MISMATCH')

  const row = evidence.result.row
  const deterministicKey =
    `PA14_V2_HISTORICAL_EVIDENCE_BUNDLE|${row.canonicalGamePk}|${row.pitcherMlbamId}|${computedInputDigest}`
  const sourceManifest = {
    purpose: 'PA14_V2_HISTORICAL_STORED_EVIDENCE_REPLAY',
    researchOnly: true,
    storageAccess: 'service_role_only',
    externalAcquisitionUsedOnlyForBundleCreation: true,
    storedReplayRequiresExternalFetch: false,
    historicalSource: 'MLB_STATSAPI_ARCHIVED_TIMECODED_PREGAME_PLUS_CANONICAL_STORED_HISTORY',
    audit: evidence.audit,
    inputDigest: computedInputDigest,
    expectedLineageDigest: row.lineageDigest,
  }

  const payload = {
    deterministic_key: deterministicKey,
    target_game_pk: row.canonicalGamePk,
    pitcher_mlbam_id: row.pitcherMlbamId,
    event_id: null,
    contract_version: row.contractVersion,
    builder_version: row.builderVersion,
    target_start: row.targetStart,
    cutoff: row.cutoff,
    data_as_of: row.dataAsOf,
    input_digest: computedInputDigest,
    lineage_digest: row.lineageDigest,
    census_digest: evidence.audit.censusDigest,
    build_input: evidence.storedInput,
    expected_result: evidence.result,
    source_manifest: sourceManifest,
    replay_status: 'PENDING',
    certification_candidate: false,
    production_eligible: false,
    shadow_only: true,
    updated_at: new Date().toISOString(),
  }

  const { error: upsertError } = await supabaseAdmin
    .from('pa14_v2_evidence_bundles')
    .upsert(payload, { onConflict: 'deterministic_key' })
  if (upsertError) throw new Error(`STORE_UPSERT:${upsertError.message}`)

  const { data: stored, error: readError } = await supabaseAdmin
    .from('pa14_v2_evidence_bundles')
    .select('*')
    .eq('deterministic_key', deterministicKey)
    .single()
  if (readError || !stored) throw new Error(`STORE_READBACK:${readError?.message ?? 'MISSING'}`)

  const readbackDigest = pa14V2Sha256(pa14V2CanonicalJson(stored.build_input))
  if (readbackDigest !== computedInputDigest || stored.input_digest !== computedInputDigest) {
    throw new Error('STORE_READBACK_DIGEST_MISMATCH')
  }
  if (pa14V2CanonicalJson(stored.expected_result) !== pa14V2CanonicalJson(evidence.result)) {
    throw new Error('STORE_EXPECTED_RESULT_MISMATCH')
  }
  if (stored.production_eligible !== false || stored.shadow_only !== true) {
    throw new Error('STORE_RESEARCH_BOUNDARY_BROKEN')
  }

  const originalFetch = globalThis.fetch
  let networkCalls = 0
  globalThis.fetch = async () => {
    networkCalls += 1
    throw new Error('STORED_REPLAY_NETWORK_FORBIDDEN')
  }
  let first
  let second
  try {
    first = buildPePitcherKV2Row(stored.build_input)
    second = buildPePitcherKV2Row(stored.build_input)
  } finally {
    globalThis.fetch = originalFetch
  }

  const deterministicReplay = pa14V2CanonicalJson(first) === pa14V2CanonicalJson(second)
  const expectedMatch = pa14V2CanonicalJson(first) === pa14V2CanonicalJson(stored.expected_result)
  const lineageMatch = first?.status === 'ELIGIBLE' && first.row?.lineageDigest === stored.lineage_digest
  const temporalPass =
    first?.status === 'ELIGIBLE' &&
    Date.parse(first.row.dataAsOf) <= Date.parse(first.row.cutoff) &&
    Date.parse(first.row.cutoff) < Date.parse(first.row.targetStart)
  const pass =
    networkCalls === 0 &&
    deterministicReplay &&
    expectedMatch &&
    lineageMatch &&
    temporalPass &&
    first?.status === 'ELIGIBLE'

  const { error: updateError } = await supabaseAdmin
    .from('pa14_v2_evidence_bundles')
    .update({
      replay_status: pass ? 'PASS' : 'FAIL',
      certification_candidate: pass,
      updated_at: new Date().toISOString(),
    })
    .eq('id', stored.id)
  if (updateError) throw new Error(`REPLAY_UPDATE:${updateError.message}`)
  if (!pass) throw new Error('STORED_REPLAY_FAILED')

  return {
    id: stored.id,
    canonicalGamePk: row.canonicalGamePk,
    pitcherMlbamId: row.pitcherMlbamId,
    inputDigest: computedInputDigest,
    lineageDigest: row.lineageDigest,
    censusDigest: evidence.audit.censusDigest,
    networkCalls,
    replayStatus: 'PASS',
    certificationCandidate: true,
    productionEligible: false,
    shadowOnly: true,
  }
}

const targets = await loadTargets()
const results = []
for (const target of targets) {
  const result = await storeAndReplay(target)
  results.push(result)
  console.log('PA14_V2_HISTORICAL_STORE_REPLAY_PASS=' + JSON.stringify(result))
}
console.log('PA14_V2_HISTORICAL_STORE_REPLAY_SUMMARY=' + JSON.stringify({
  targetRows: targets.length,
  passRows: results.length,
  allStoredReplayNetworkCallsZero: results.every((row) => row.networkCalls === 0),
  productionEligibleRows: results.filter((row) => row.productionEligible).length,
  shadowOnlyRows: results.filter((row) => row.shadowOnly).length,
  officialPicksModified: false,
  apostarActivated: false,
  modelTrainingAuthorized: false,
}))
