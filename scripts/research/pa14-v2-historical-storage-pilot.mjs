#!/usr/bin/env node
import { supabaseAdmin } from '../../src/lib/supabase-admin.ts'
import { buildPePitcherKV2Row, pa14V2CanonicalJson, pa14V2Sha256 } from '../../src/lib/pe-pitcher-k-v2-builder.ts'
import { auditHistoricalPa14V2Target } from '../../src/services/pa14-v2-historical-yield-audit.service.ts'

const EXPECTED_BRANCH = 'research/pa14-v2-historical-storage-pilot-20260917'
if (process.env.VERCEL !== '1' || process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH) {
  console.log(JSON.stringify({ status: 'PA14_V2_HISTORICAL_STORAGE_PILOT_SKIPPED_NOT_EXACT_PREVIEW_BRANCH' }))
  process.exit(0)
}

const target = {
  canonicalGamePk: 778177,
  expectedPitcherIds: [519242, 668678],
  targetPitcherId: 668678,
}

const evidence = await auditHistoricalPa14V2Target(target)
if (!evidence.historicalAuditEligible || evidence.result?.status !== 'ELIGIBLE' || !evidence.replayMatch) {
  throw new Error('PA14_HISTORICAL_STORE_NOT_ELIGIBLE')
}
if (!evidence.storedInput || typeof evidence.inputDigest !== 'string') {
  throw new Error('PA14_HISTORICAL_STORE_MISSING_INPUT')
}

const computedInputDigest = pa14V2Sha256(pa14V2CanonicalJson(evidence.storedInput))
if (computedInputDigest !== evidence.inputDigest) throw new Error('PA14_HISTORICAL_STORE_INPUT_DIGEST_MISMATCH')

const row = evidence.result.row
const deterministicKey = `PA14_V2_HISTORICAL_EVIDENCE_BUNDLE|${row.canonicalGamePk}|${row.pitcherMlbamId}|${computedInputDigest}`
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
if (upsertError) throw new Error(`PA14_HISTORICAL_STORE_UPSERT:${upsertError.message}`)

const { data: stored, error: readError } = await supabaseAdmin
  .from('pa14_v2_evidence_bundles')
  .select('*')
  .eq('deterministic_key', deterministicKey)
  .single()
if (readError || !stored) throw new Error(`PA14_HISTORICAL_STORE_READBACK:${readError?.message ?? 'MISSING'}`)

const readbackDigest = pa14V2Sha256(pa14V2CanonicalJson(stored.build_input))
if (readbackDigest !== computedInputDigest || stored.input_digest !== computedInputDigest) {
  throw new Error('PA14_HISTORICAL_STORE_READBACK_DIGEST_MISMATCH')
}
if (pa14V2CanonicalJson(stored.expected_result) !== pa14V2CanonicalJson(evidence.result)) {
  throw new Error('PA14_HISTORICAL_STORE_EXPECTED_RESULT_MISMATCH')
}
if (stored.production_eligible !== false || stored.shadow_only !== true) {
  throw new Error('PA14_HISTORICAL_STORE_RESEARCH_BOUNDARY_BROKEN')
}

const originalFetch = globalThis.fetch
let networkCalls = 0
globalThis.fetch = async () => {
  networkCalls += 1
  throw new Error('PA14_HISTORICAL_STORED_REPLAY_NETWORK_FORBIDDEN')
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
if (updateError) throw new Error(`PA14_HISTORICAL_REPLAY_UPDATE:${updateError.message}`)
if (!pass) throw new Error('PA14_HISTORICAL_STORED_REPLAY_FAILED')

console.log('PA14_V2_HISTORICAL_STORAGE_PILOT_PASS=' + JSON.stringify({
  id: stored.id,
  deterministicKey,
  canonicalGamePk: row.canonicalGamePk,
  pitcherMlbamId: row.pitcherMlbamId,
  contractVersion: row.contractVersion,
  builderVersion: row.builderVersion,
  inputDigest: computedInputDigest,
  lineageDigest: row.lineageDigest,
  censusDigest: evidence.audit.censusDigest,
  networkCalls,
  deterministicReplay,
  expectedMatch,
  lineageMatch,
  temporalPass,
  replayStatus: 'PASS',
  certificationCandidate: true,
  productionEligible: false,
  shadowOnly: true,
  officialPicksModified: false,
  apostarActivated: false,
  modelTrainingAuthorized: false,
}))
