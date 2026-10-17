import 'server-only'
import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { parsePendingOfficialEvidence, type PendingOfficialEvidence } from '@/lib/mlb-pending-outcome'

export const PENDING_EVIDENCE_JOB = 'mlb_pending_outcome_evidence_v1'
const sha = (s:string) => createHash('sha256').update(s).digest('hex')

export async function readPendingOutcomeEvidence(gamePks:number[]) {
  const found = new Map<number,PendingOfficialEvidence>()
  if (!gamePks.length) return found
  // Keyset pagination keeps a full archive readable after more than 500 jobs.
  let after:string|null = null
  for (;;) {
    let q = supabaseAdmin.from('sports_sync_jobs').select('id,metadata')
      .eq('job_type',PENDING_EVIDENCE_JOB).eq('status','completed').order('id').limit(500)
    if(after) q=q.gt('id',after)
    const r=await q
    if(r.error) throw Error('MLB_PENDING_EVIDENCE_READ_FAILED:'+r.error.message)
    for(const row of r.data??[]) {
      const e=row.metadata?.evidence as PendingOfficialEvidence|undefined
      if(e?.version!=='MLB_PENDING_OUTCOME_EVIDENCE_V1' || !gamePks.includes(e.gamePk)) continue
      const prior=found.get(e.gamePk)
      if(!prior || e.capturedAt>prior.capturedAt) found.set(e.gamePk,e)
    }
    if(!r.data || r.data.length<500) break
    after=r.data[r.data.length-1].id
  }
  return found
}

// Uses the existing authenticated cron, never a second worker. At most 20 FREE
// requests per invocation; immutable final evidence is reused indefinitely.
export async function refreshPendingOutcomeEvidence(now=new Date()) {
  const pending=await supabaseAdmin.from('mlb_2026_forward_master_ledger_v1')
    .select('game_pk').eq('season',2026).is('result',null).lt('target_date',now.toISOString().slice(0,10)).limit(500)
  if(pending.error) throw Error('MLB_PENDING_READ_FAILED:'+pending.error.message)
  const games=[...new Set((pending.data??[]).map(r=>Number(r.game_pk)))].sort((a,b)=>a-b)
  const existing=await readPendingOutcomeEvidence(games)
  const day=now.toISOString().slice(0,10)
  const candidates=games.filter(g=>{const e=existing.get(g);return !e || (!e.final && e.capturedAt.slice(0,10)!==day)}).slice(0,10)
  let providerCalls=0, captured=0, failed=0
  for(const gamePk of candidates) {
    let attempted=0
    const digest=sha(`${PENDING_EVIDENCE_JOB}:${gamePk}:${day}`).slice(0,32)
    const id=`${digest.slice(0,8)}-${digest.slice(8,12)}-${digest.slice(12,16)}-${digest.slice(16,20)}-${digest.slice(20)}`
    // Unique job id is the concurrency/duplicate-call guard. Never reacquire a
    // running or failed reservation automatically during the same UTC day.
    const reservation=await supabaseAdmin.from('sports_sync_jobs').insert({id,job_type:PENDING_EVIDENCE_JOB,
      sport_key:'baseball_mlb',league_key:'mlb',provider:'mlb_official',season:'2026',status:'running',
      started_at:now.toISOString(),metadata:{gamePk,reason:'Resolve stale research settlement',requestBudget:2,paidCredits:0}})
    if(reservation.error) {
      if(reservation.error.code==='23505') continue
      throw Error('MLB_PENDING_RESERVATION_FAILED:'+reservation.error.message)
    }
    const urls=[`https://statsapi.mlb.com/api/v1/schedule?gamePk=${gamePk}&sportId=1`,`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`]
    try {
      const bodies:string[]=[]
      for(const url of urls) {
        providerCalls++
        attempted++
        const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)})
        if(!response.ok) throw Error(`OFFICIAL_HTTP_${response.status}`)
        bodies.push(await response.text())
      }
      const e=parsePendingOfficialEvidence(gamePk,JSON.parse(bodies[0]),JSON.parse(bodies[1]),{
        capturedAt:new Date().toISOString(),scheduleSha256:sha(bodies[0]),boxscoreSha256:sha(bodies[1])})
      const update=await supabaseAdmin.from('sports_sync_jobs').update({status:'completed',completed_at:e.capturedAt,
        records_fetched:1,metadata:{gamePk,evidence:e,sourceUrls:urls,providerCalls:2,paidCredits:0,
          researchOnly:true,officialPicksModified:false},updated_at:e.capturedAt}).eq('id',id).eq('status','running')
      if(update.error) throw Error('EVIDENCE_WRITE_FAILED')
      captured++
    } catch {
      failed++
      const update=await supabaseAdmin.from('sports_sync_jobs').update({status:'failed',completed_at:new Date().toISOString(),
        error_count:1,metadata:{gamePk,status:'OFFICIAL_EVIDENCE_UNAVAILABLE',providerCalls:attempted,requestBudget:2,paidCredits:0}}).eq('id',id).eq('status','running')
      if(update.error) throw Error('MLB_PENDING_FAILURE_RECORD_FAILED')
    }
  }
  return {captured,failed,providerCalls,requestBudget:20,researchOnly:true,officialPicksModified:false}
}
