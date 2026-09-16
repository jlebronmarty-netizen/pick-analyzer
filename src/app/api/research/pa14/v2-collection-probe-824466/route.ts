import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildPePitcherKV2Row, pa14V2CanonicalJson, pa14V2Sha256 } from '@/lib/pe-pitcher-k-v2-builder'
import { materializePa14V2RealBazRow } from '@/services/pa14-v2-real-evidence.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const TARGET_GAME_PK = 824466
const TARGET_PITCHER_ID = 808967
const TARGET_EVENT_ID = 'baseball_mlb:mlb:sportsdataio:event:79553'

export async function POST() {
  const headers = { 'Cache-Control': 'no-store, max-age=0' }
  try {
    const evidence = await materializePa14V2RealBazRow()
    if (evidence.target?.canonicalGamePk !== TARGET_GAME_PK || evidence.target?.pitcherMlbamId !== TARGET_PITCHER_ID) {
      throw new Error(`PA14_COLLECTION_TARGET_MISMATCH:${evidence.target?.canonicalGamePk}/${evidence.target?.pitcherMlbamId}`)
    }
    if (evidence.result?.status !== 'ELIGIBLE' || evidence.replayMatch !== true) {
      throw new Error(`PA14_COLLECTION_NOT_ELIGIBLE:${evidence.result?.status ?? 'UNKNOWN'}`)
    }
    if (!evidence.storedInput || typeof evidence.inputDigest !== 'string') throw new Error('PA14_COLLECTION_MISSING_INPUT')
    if (evidence.productionEligible !== false || evidence.researchOnly !== true) throw new Error('PA14_COLLECTION_RESEARCH_BOUNDARY_BROKEN')

    const computedInputDigest = pa14V2Sha256(pa14V2CanonicalJson(evidence.storedInput))
    if (computedInputDigest !== evidence.inputDigest) throw new Error('PA14_COLLECTION_INPUT_DIGEST_MISMATCH')

    const { data: pregame, error: pregameError } = await supabaseAdmin
      .from('mlb_context_snapshots')
      .select('id,deterministic_key,source_lineage,snapshot_timestamp,target_event_start_time')
      .eq('event_id', TARGET_EVENT_ID)
      .eq('snapshot_type', 'CURRENT_PROBE')
      .eq('temporal_status', 'PREGAME')
      .like('deterministic_key', `PA14_V2_PREGAME_SOURCE_STATE|${TARGET_GAME_PK}|%`)
      .order('snapshot_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (pregameError || !pregame) throw new Error(`PA14_COLLECTION_PREGAME_READ:${pregameError?.message ?? 'MISSING'}`)

    const row = evidence.result.row
    const deterministicKey = `PA14_V2_EVIDENCE_BUNDLE|${TARGET_GAME_PK}|${TARGET_PITCHER_ID}|${computedInputDigest}`
    const sourceManifest = {
      purpose: 'PA14_V2_STORED_EVIDENCE_COLLECTION_PROBE',
      researchOnly: true,
      storageAccess: 'service_role_only',
      externalAcquisitionUsedOnlyForBundleCreation: true,
      storedReplayRequiresExternalFetch: false,
      target: 'Yoshinobu Yamamoto @ Cincinnati, 2026-09-15',
      oraclePolicy: 'NO_TARGET_SPECIFIC_ORACLE; generic contract builder plus deterministic stored replay only',
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
      event_id: TARGET_EVENT_ID,
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
    if (upsertError) throw new Error(`PA14_COLLECTION_UPSERT:${upsertError.message}`)

    const { data: stored, error: readbackError } = await supabaseAdmin
      .from('pa14_v2_evidence_bundles')
      .select('*')
      .eq('deterministic_key', deterministicKey)
      .single()
    if (readbackError || !stored) throw new Error(`PA14_COLLECTION_READBACK:${readbackError?.message ?? 'MISSING'}`)
    if (stored.production_eligible !== false || stored.shadow_only !== true) throw new Error('PA14_COLLECTION_STORED_BOUNDARY_BROKEN')

    const readbackDigest = pa14V2Sha256(pa14V2CanonicalJson(stored.build_input))
    if (readbackDigest !== computedInputDigest || stored.input_digest !== computedInputDigest) {
      throw new Error('PA14_COLLECTION_READBACK_DIGEST_MISMATCH')
    }

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
    const temporalLeakageZero = first?.status === 'ELIGIBLE' && first.row.dataAsOf < first.row.targetStart && first.row.cutoff < first.row.targetStart
    const pass = networkCalls === 0 && deterministicReplay && expectedMatch && lineageMatch && temporalLeakageZero && first?.status === 'ELIGIBLE'

    const { error: updateError } = await supabaseAdmin
      .from('pa14_v2_evidence_bundles')
      .update({ replay_status: pass ? 'PASS' : 'FAIL', certification_candidate: pass, updated_at: new Date().toISOString() })
      .eq('id', stored.id)
    if (updateError) throw new Error(`PA14_COLLECTION_REPLAY_UPDATE:${updateError.message}`)
    if (!pass) {
      throw new Error(`PA14_COLLECTION_REPLAY_FAILED:${JSON.stringify({ networkCalls, deterministicReplay, expectedMatch, lineageMatch, temporalLeakageZero, status: first?.status })}`)
    }

    if (!first || first.status !== 'ELIGIBLE') throw new Error('PA14_COLLECTION_REPLAY_STATUS_NARROWING_FAILED')

    return NextResponse.json({
      status: 'PA14_V2_COLLECTION_PROBE_PASS',
      bundleId: stored.id,
      canonicalGamePk: TARGET_GAME_PK,
      pitcherMlbamId: TARGET_PITCHER_ID,
      contractVersion: first.row.contractVersion,
      builderVersion: first.row.builderVersion,
      inputDigest: computedInputDigest,
      lineageDigest: first.row.lineageDigest,
      replayStatus: 'PASS',
      certificationCandidate: true,
      productionEligible: false,
      shadowOnly: true,
      networkCallsDuringStoredReplay: networkCalls,
      deterministicReplay,
      expectedMatch,
      lineageMatch,
      temporalLeakageZero,
      features: first.row.features,
      statistics: first.row.statistics,
    }, { status: 200, headers })
  } catch (error) {
    return NextResponse.json({
      status: 'PA14_V2_COLLECTION_PROBE_FAIL',
      canonicalGamePk: TARGET_GAME_PK,
      pitcherMlbamId: TARGET_PITCHER_ID,
      productionEligible: false,
      shadowOnly: true,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500, headers })
  }
}
