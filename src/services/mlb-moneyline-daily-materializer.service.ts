import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function assertDate(value: string) {
  if (!DATE_RE.test(value)) throw new Error(`MLB_ML_MATERIALIZER_INVALID_DATE:${value}`)
}

function objectResult(data: unknown) {
  return data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {}
}

export async function captureMlbMoneylinePregameStarterEvidence(targetDate: string) {
  assertDate(targetDate)

  const { data, error } = await supabaseAdmin.rpc(
    'mlb_ml_capture_pregame_starter_evidence_v1',
    { p_target_date: targetDate },
  )

  if (error) throw new Error(`MLB_ML_STARTER_EVIDENCE_CAPTURE_FAILED:${error.message}`)

  return {
    success: true,
    status: 'MLB_ML_STARTER_EVIDENCE_CAPTURE_COMPLETE',
    targetDate,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    providerCallsMade: 0,
    ...objectResult(data),
  }
}

export async function materializeMlbMoneylineResearchDaily(targetDate: string) {
  assertDate(targetDate)

  const { data, error } = await supabaseAdmin.rpc(
    'mlb_ml_xyear_materialize_pregame_v4',
    { p_target_date: targetDate },
  )

  if (error) throw new Error(`MLB_ML_XYEAR_MATERIALIZER_V4_FAILED:${error.message}`)

  const result = objectResult(data)
  return {
    success: result.syncStatus === 'COMPLETE',
    status: String(result.syncStatus ?? 'UNKNOWN'),
    targetDate,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    modelRetuned: false,
    providerCallsMade: 0,
    ...result,
  }
}
