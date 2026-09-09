import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MLB_SETTLEMENT_VERSION, summarizeMlbPerformance, type PickSettlement } from './pick2-mlb-settlement'

export async function getMlbOfficialPerformance() {
  const { data, error } = await supabaseAdmin.from('pick2_prediction_results').select('actual_result').eq('evaluator_version', MLB_SETTLEMENT_VERSION).order('evaluated_at', { ascending: false }).limit(1000)
  if (error || !data || data.length >= 1000) return { status: 'UNAVAILABLE', summary: summarizeMlbPerformance([]), warning: 'Settlement evidence unavailable or exceeds the bounded report limit.' }
  try {
    const settlements = data.flatMap(r => r.actual_result?.settlements ?? []) as PickSettlement[]
    return { status: settlements.length ? 'STORED_SETTLEMENTS' : 'NO_SETTLED_SAMPLE', summary: summarizeMlbPerformance(settlements), warning: settlements.length ? null : 'No certified Official Pick settlements are stored yet.' }
  } catch { return { status: 'INVALID_SETTLEMENT_EVIDENCE', summary: summarizeMlbPerformance([]), warning: 'Settlement integrity check failed.' } }
}
