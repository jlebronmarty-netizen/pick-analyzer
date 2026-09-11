import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createEvidenceStorage, evidenceEnvelope, evidenceIdentity } from '../../supabase/functions/_shared/mlb-provider-evidence.mjs'
import { sha256 } from '../../scripts/mlb-data-02r-r2f-stage-contracts.mjs'
import type { StoredRow } from './pick2-operational-projection'

// Read the existing private immutable evidence store. No acquisition, writes,
// public URLs, credentials, checkpoint contents or raw payloads leave this service.
export async function readObservedMlbSchedule(date: string, at: string): Promise<StoredRow[]> {
  const { data, error } = await supabaseAdmin.from('pick2_mlb_runtime_state')
    .select('run_id,package_sha,run_as_of,mlb_official_calls,dml_accounting,checkpoint')
    .eq('state_kind', 'RUN').eq('run_date', date)
    .in('checkpoint->>mode', ['PREGAME', 'INITIALIZE', 'STARTER_CHANGE', 'ODDS_FRESHNESS'])
    .lte('run_as_of', at).order('run_as_of', { ascending: false }).order('run_id').limit(4)
  if (error) throw new Error('SCHEDULE_EVIDENCE_READ_UNAVAILABLE')
  const storage = createEvidenceStorage({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY })
  const result: StoredRow[] = []
  for (const run of data ?? []) {
    const ref = run.checkpoint?.references?.find((r: StoredRow) => r.kind === 'schedule_evidence')
    if (!ref || Date.parse(ref.asOf) > Date.parse(at)) continue
    const stored = await storage.read(evidenceIdentity(run, 'schedule').key)
    if (!stored || sha256(stored) !== ref.digest || sha256(stored) !== sha256(evidenceEnvelope(run, 'schedule', stored.evidence))) throw new Error('SCHEDULE_EVIDENCE_DIGEST_MISMATCH')
    if (stored.evidence.acquiredAt !== ref.asOf) throw new Error('SCHEDULE_EVIDENCE_TIME_MISMATCH')
    const games = stored.evidence.payload.dates.flatMap((d: { games: StoredRow[] }) => d.games)
    if (games.length > 50) throw new Error('SCHEDULE_EVIDENCE_READ_CAP')
    for (const game of games) {
      const teams = game.teams as { home: { probablePitcher?: { id?: number; fullName?: string } }; away: { probablePitcher?: { id?: number; fullName?: string } } }
      result.push({ game_pk: game.gamePk, scheduled_at: game.gameDate, official_status: (game.status as StoredRow).detailedState,
        observed_at: stored.evidence.acquiredAt, homeStarter: teams.home.probablePitcher ?? {}, awayStarter: teams.away.probablePitcher ?? {} })
    }
  }
  return result
}
