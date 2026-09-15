import { supabaseAdmin } from '../src/lib/supabase-admin.ts'
import { buildPePitcherKV2Row, pa14V2CanonicalJson, pa14V2Sha256 } from '../src/lib/pe-pitcher-k-v2-builder.ts'

const { data: stored, error } = await supabaseAdmin
  .from('pa14_v2_evidence_bundles')
  .select('*')
  .eq('target_game_pk', 823574)
  .eq('pitcher_mlbam_id', 669358)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
if (error || !stored) throw new Error(`PA14_STORED_REPLAY_READ:${error?.message ?? 'MISSING'}`)
if (stored.production_eligible !== false || stored.shadow_only !== true) throw new Error('PA14_STORED_REPLAY_BOUNDARY_BROKEN')

const inputDigest = pa14V2Sha256(pa14V2CanonicalJson(stored.build_input))
if (inputDigest !== stored.input_digest) throw new Error('PA14_STORED_REPLAY_INPUT_DIGEST_MISMATCH')

const originalFetch = globalThis.fetch
let networkCalls = 0
globalThis.fetch = async () => {
  networkCalls += 1
  throw new Error('PA14_STORED_REPLAY_NETWORK_FORBIDDEN')
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
const temporalLeakageZero = first?.status === 'ELIGIBLE' && first.row?.dataAsOf < first.row?.targetStart && first.row?.cutoff < first.row?.targetStart
const pass = networkCalls === 0 && deterministicReplay && expectedMatch && lineageMatch && temporalLeakageZero && first?.status === 'ELIGIBLE'

const { error: updateError } = await supabaseAdmin
  .from('pa14_v2_evidence_bundles')
  .update({
    replay_status: pass ? 'PASS' : 'FAIL',
    certification_candidate: pass,
    updated_at: new Date().toISOString(),
  })
  .eq('id', stored.id)
if (updateError) throw new Error(`PA14_STORED_REPLAY_UPDATE:${updateError.message}`)
if (!pass) throw new Error(`PA14_STORED_REPLAY_FAILED:${JSON.stringify({networkCalls,deterministicReplay,expectedMatch,lineageMatch,temporalLeakageZero,status:first?.status})}`)

console.log(`PA14_V2_STORED_REPLAY_PASS=${JSON.stringify({
  id: stored.id,
  status: first.status,
  networkCalls,
  deterministicReplay,
  expectedMatch,
  lineageMatch,
  temporalLeakageZero,
  inputDigest,
  lineageDigest: first.row.lineageDigest,
  builderVersion: first.row.builderVersion,
  contractVersion: first.row.contractVersion,
  certificationCandidate: true,
})}`)
