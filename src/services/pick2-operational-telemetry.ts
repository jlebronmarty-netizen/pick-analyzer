import type { SupabaseClient } from '@supabase/supabase-js'
import { digestSettlementEvidence } from './pick2-mlb-settlement'

export const MLB_OPERATIONAL_JOB_TYPE = 'PICK2_MLB_OPERATIONAL'
type Telemetry = { identity: string; startedAt: string; status: 'running' | 'completed' | 'failed'; metadata: Record<string, unknown> }

// One deterministic operational row, exact old-value UPDATE predicates and
// independent readback. Only the activated coordinator calls this writer.
export async function persistOperationalTelemetry(client: SupabaseClient, input: Telemetry) {
  if (!/^[a-f0-9]{64}$/.test(input.identity) || !Number.isFinite(Date.parse(input.startedAt))) throw Error('TELEMETRY_IDENTITY')
  const h = input.identity, id = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
  const read = async () => { const r = await client.from('sports_sync_jobs').select('*').eq('id', id).limit(2); if (r.error || !r.data || r.data.length > 1) throw Error('TELEMETRY_READ'); return r.data[0] }
  const old = await read()
  const same = old && old.job_type === MLB_OPERATIONAL_JOB_TYPE && old.status === input.status && digestSettlementEvidence(old.metadata) === digestSettlementEvidence(input.metadata)
  if (same) return { id, disposition: 'REUSE_NO_OP', inserted: 0, updated: 0, cap: 1 }
  const now = new Date().toISOString()
  const next = { status: input.status, metadata: input.metadata, updated_at: now, completed_at: input.status === 'running' ? null : now }
  if (old && (old.job_type !== MLB_OPERATIONAL_JOB_TYPE || old.sport_key !== 'baseball_mlb' || Date.parse(old.started_at) !== Date.parse(input.startedAt))) throw Error('TELEMETRY_BLOCK_CONFLICT')
  const result = old
    ? await client.from('sports_sync_jobs').update(next).eq('id', id).eq('job_type', MLB_OPERATIONAL_JOB_TYPE).eq('status', old.status).eq('updated_at', old.updated_at).eq('metadata', JSON.stringify(old.metadata)).select('id')
    : await client.from('sports_sync_jobs').insert({ id, job_type: MLB_OPERATIONAL_JOB_TYPE, sport_key: 'baseball_mlb', provider: 'CERTIFIED_R2_SHARED_STATCAST', started_at: input.startedAt, ...next }).select('id')
  if (result.error || result.data?.length !== 1) throw Error('TELEMETRY_WRITE_REQUIRES_READBACK_RECOVERY')
  const stored = await read()
  if (!stored || stored.status !== input.status || digestSettlementEvidence(stored.metadata) !== digestSettlementEvidence(input.metadata)) throw Error('TELEMETRY_READBACK')
  return { id, disposition: old ? 'BOUNDED_STATUS_UPDATE' : 'INSERT_ELIGIBLE', inserted: old ? 0 : 1, updated: old ? 1 : 0, cap: 1 }
}
