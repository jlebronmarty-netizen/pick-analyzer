import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

type RpcResult = Record<string, unknown>

async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin.rpc(name, args)
  if (error) throw new Error(`${name.toUpperCase()}_FAILED:${error.message}`)
  return (data && typeof data === 'object' ? data : { result: data }) as RpcResult
}

export async function captureMlbMoneylinePregameStarterEvidence(targetDate: string) {
  const result = await rpc('mlb_ml_capture_pregame_starter_evidence_v1', { p_target_date: targetDate })
  return {
    success: true,
    status: 'MLB_ML_PREGAME_STARTER_EVIDENCE_CAPTURED',
    targetDate,
    result,
    researchOnly: true,
    officialPicksModified: false,
    apostarActivated: false,
  }
}

export async function syncMlbMoneylineXyearDaily(targetDate: string) {
  const base = await rpc('mlb_ml_xyear_refresh_base_v2', { p_target_date: targetDate })
  const pregame = await rpc('mlb_ml_xyear_materialize_pregame_v3', { p_target_date: targetDate })
  return {
    success: true,
    status: 'MLB_ML_XYEAR_DAILY_SYNC_COMPLETE',
    targetDate,
    base,
    pregame,
    researchOnly: true,
    sameGamePregameUse: false,
    retroactiveForwardPicks: false,
    officialPicksModified: false,
    apostarActivated: false,
  }
}
