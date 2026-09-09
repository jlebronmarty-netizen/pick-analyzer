import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StoredRow } from './pick2-operational-projection'
import { persistMlbSettlements, type SettlementRow } from './pick2-mlb-settlement'

// INSERT-only production adapter; neither predictions nor picks is a write target.
export async function persistMlbSettlementPlan(client: SupabaseClient, plan: SettlementRow[], cap: number) {
  return persistMlbSettlements(plan, {
    async read(ids) {
      if (!ids.length) return []
      if (ids.length > 100) throw new Error('SETTLEMENT_READ_CAP')
      const { data, error } = await client.from('pick2_prediction_results').select('*').in('prediction_id', ids).limit(ids.length + 1)
      if (error || !data || data.length > ids.length) throw new Error('SETTLEMENT_READ_FAILED')
      return data as StoredRow[]
    },
    async insert(rows) {
      const { data, error } = await client.from('pick2_prediction_results').insert(rows).select('prediction_id')
      // A timeout is recovered by the next prewrite read, never by blind retry.
      if (error || data?.length !== rows.length) throw new Error('SETTLEMENT_WRITE_REQUIRES_READBACK_RECOVERY')
    },
  }, cap)
}
