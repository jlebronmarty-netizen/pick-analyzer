import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

const CONTRACT_VERSION = 'PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0'
const BUILDER_VERSION = '697ead7e1d596aa3aeee50fbeafe45424735af5ca32f58c5786a4965064a0fc3'

function positiveSafeInteger(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function sameInstant(left: unknown, right: unknown) {
  if (typeof left !== 'string' || typeof right !== 'string') return false
  const a = Date.parse(left)
  const b = Date.parse(right)
  return Number.isFinite(a) && Number.isFinite(b) && a === b
}

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  const params = new URL(request.url).searchParams
  const gamePk = positiveSafeInteger(params.get('gamePk'))
  const pitcherId = positiveSafeInteger(params.get('pitcherId'))

  if (!gamePk || !pitcherId) {
    return NextResponse.json({
      version: CONTRACT_VERSION,
      status: 'INVALID_REQUEST',
      error: 'gamePk and pitcherId must be positive safe integers',
      data: null,
    }, { status: 400, headers })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('pa14_v2_evidence_bundles')
      .select('id,target_game_pk,pitcher_mlbam_id,contract_version,builder_version,target_start,cutoff,data_as_of,input_digest,lineage_digest,census_digest,expected_result,replay_status,certification_candidate,production_eligible,shadow_only,updated_at')
      .eq('target_game_pk', gamePk)
      .eq('pitcher_mlbam_id', pitcherId)
      .eq('contract_version', CONTRACT_VERSION)
      .eq('builder_version', BUILDER_VERSION)
      .eq('replay_status', 'PASS')
      .eq('certification_candidate', true)
      .eq('production_eligible', false)
      .eq('shadow_only', true)
      .order('updated_at', { ascending: false })
      .limit(2)

    if (error) throw new Error('CERTIFIED_BUNDLE_READ_FAILED')
    if (!data?.length) {
      return NextResponse.json({
        version: CONTRACT_VERSION,
        status: 'NO_CERTIFIED_STORED_EVIDENCE_ROW',
        data: null,
      }, { status: 404, headers })
    }
    if (data.length !== 1) {
      return NextResponse.json({
        version: CONTRACT_VERSION,
        status: 'CERTIFIED_ROW_AMBIGUOUS',
        data: null,
      }, { status: 409, headers })
    }

    const stored = data[0]
    const expected = objectValue(stored.expected_result)
    const row = objectValue(expected?.row)
    if (
      expected?.status !== 'ELIGIBLE' ||
      !row ||
      row.canonicalGamePk !== gamePk ||
      row.pitcherMlbamId !== pitcherId ||
      row.contractVersion !== CONTRACT_VERSION ||
      row.builderVersion !== BUILDER_VERSION ||
      row.lineageDigest !== stored.lineage_digest ||
      !sameInstant(row.targetStart, stored.target_start) ||
      !sameInstant(row.cutoff, stored.cutoff) ||
      !sameInstant(row.dataAsOf, stored.data_as_of)
    ) {
      return NextResponse.json({
        version: CONTRACT_VERSION,
        status: 'CERTIFIED_STORED_ROW_INTEGRITY_FAILURE',
        data: null,
      }, { status: 409, headers })
    }

    return NextResponse.json({
      version: CONTRACT_VERSION,
      status: 'AVAILABLE',
      asOf: new Date().toISOString(),
      data: {
        canonicalGamePk: row.canonicalGamePk,
        pitcherMlbamId: row.pitcherMlbamId,
        targetStart: row.targetStart,
        dataAsOf: row.dataAsOf,
        cutoff: row.cutoff,
        contractVersion: row.contractVersion,
        builderVersion: row.builderVersion,
        sourceVersions: row.sourceVersions,
        statistics: row.statistics,
        features: row.features,
        lineageDigest: row.lineageDigest,
        inputDigest: stored.input_digest,
        censusDigest: stored.census_digest,
        storedEvidenceBundleId: stored.id,
        replayStatus: stored.replay_status,
        certificationCandidate: stored.certification_candidate,
        researchOnly: true,
        productionEligible: false,
        shadowOnly: true,
      },
    }, { headers })
  } catch {
    return NextResponse.json({
      version: CONTRACT_VERSION,
      status: 'CERTIFIED_STORED_EVIDENCE_READ_UNAVAILABLE',
      data: null,
    }, { status: 503, headers })
  }
}
