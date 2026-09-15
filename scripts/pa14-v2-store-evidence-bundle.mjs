import { supabaseAdmin } from '../src/lib/supabase-admin.ts'
import { pa14V2CanonicalJson, pa14V2Sha256 } from '../src/lib/pe-pitcher-k-v2-builder.ts'
import { materializePa14V2RealBazRow } from '../src/services/pa14-v2-real-evidence.service.ts'

const evidence = await materializePa14V2RealBazRow()
if (!evidence.certificationCandidate || evidence.result?.status !== 'ELIGIBLE') {
  throw new Error(`PA14_STORE_REJECTED:${evidence.result?.status ?? 'UNKNOWN'}`)
}
if (!evidence.storedInput || typeof evidence.inputDigest !== 'string') throw new Error('PA14_STORE_MISSING_INPUT')

const computedInputDigest = pa14V2Sha256(pa14V2CanonicalJson(evidence.storedInput))
if (computedInputDigest !== evidence.inputDigest) throw new Error('PA14_STORE_INPUT_DIGEST_MISMATCH')

const row = evidence.result.row
const { data: pregame, error: pregameError } = await supabaseAdmin
  .from('mlb_context_snapshots')
  .select('id,deterministic_key,source_lineage,snapshot_timestamp,target_event_start_time')
  .eq('event_id', 'baseball_mlb:mlb:sportsdataio:event:79543')
  .eq('snapshot_type', 'CURRENT_PROBE')
  .like('deterministic_key', 'PA14_V2_PREGAME_SOURCE_STATE|823574|%')
  .order('snapshot_timestamp', { ascending: false })
  .limit(1)
  .maybeSingle()
if (pregameError || !pregame) throw new Error(`PA14_STORE_PREGAME_READ:${pregameError?.message ?? 'MISSING'}`)

const deterministicKey = `PA14_V2_EVIDENCE_BUNDLE|823574|669358|${computedInputDigest}`
const sourceManifest = {
  purpose: 'PA14_V2_STORED_EVIDENCE_REPLAY',
  researchOnly: true,
  storageAccess: 'service_role_only',
  externalAcquisitionUsedOnlyForBundleCreation: true,
  storedReplayRequiresExternalFetch: false,
  pregameSnapshot: {
    id: pregame.id,
    deterministicKey: pregame.deterministic_key,
    payloadSha256: pregame.source_lineage?.payloadSha256 ?? null,
    providerTimestamp: pregame.source_lineage?.providerTimestamp ?? null,
    observedAt: pregame.source_lineage?.observedAt ?? null,
  },
  pitchStore: 'public.pick2_raw_mlb_statcast_pitches',
  audit: evidence.audit,
  inputDigest: computedInputDigest,
  expectedLineageDigest: row.lineageDigest,
}

const payload = {
  deterministic_key: deterministicKey,
  target_game_pk: row.canonicalGamePk,
  pitcher_mlbam_id: row.pitcherMlbamId,
  event_id: 'baseball_mlb:mlb:sportsdataio:event:79543',
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
if (upsertError) throw new Error(`PA14_STORE_UPSERT:${upsertError.message}`)

const { data: stored, error: readbackError } = await supabaseAdmin
  .from('pa14_v2_evidence_bundles')
  .select('id,deterministic_key,input_digest,lineage_digest,census_digest,build_input,expected_result,replay_status,production_eligible,shadow_only')
  .eq('deterministic_key', deterministicKey)
  .single()
if (readbackError || !stored) throw new Error(`PA14_STORE_READBACK:${readbackError?.message ?? 'MISSING'}`)
const readbackDigest = pa14V2Sha256(pa14V2CanonicalJson(stored.build_input))
if (readbackDigest !== computedInputDigest || stored.input_digest !== computedInputDigest) throw new Error('PA14_STORE_READBACK_DIGEST_MISMATCH')
if (pa14V2CanonicalJson(stored.expected_result) !== pa14V2CanonicalJson(evidence.result)) throw new Error('PA14_STORE_EXPECTED_RESULT_MISMATCH')
if (stored.production_eligible !== false || stored.shadow_only !== true) throw new Error('PA14_STORE_RESEARCH_BOUNDARY_BROKEN')

console.log(`PA14_V2_EVIDENCE_STORED=${JSON.stringify({
  id: stored.id,
  deterministicKey,
  inputDigest: computedInputDigest,
  lineageDigest: stored.lineage_digest,
  censusDigest: stored.census_digest,
  replayStatus: stored.replay_status,
  startCount: evidence.audit.startCount,
  opponentGameCount: evidence.audit.opponentGameCount,
  researchOnly: true,
  storageAccess: 'service_role_only',
})}`)
