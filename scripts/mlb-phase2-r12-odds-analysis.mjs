// Read-only production evidence analysis. Outputs aggregates only, never payloads.
import {createClient} from '@supabase/supabase-js'
import {createEvidenceStorage,evidenceEnvelope,evidenceIdentity} from '../supabase/functions/_shared/mlb-provider-evidence.mjs'
import {sha256} from './mlb-data-02r-r2f-stage-contracts.mjs'
import {planProposedOddsAcquisition} from './mlb-operational-budget-proposal.mjs'
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
if(url!=='https://ynuocvexviorgdjrfthw.supabase.co'||!key)throw Error('READ_CONFIGURATION')
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const read=async q=>{const {data,error}=await q;if(error||!Array.isArray(data))throw Error('BOUNDED_READ_FAILED');return data}
const runs=await read(client.from('pick2_mlb_runtime_state').select('*').eq('state_kind','RUN').gt('odds_calls',0).order('run_as_of').limit(21))
if(runs.length!==18)throw Error('MISSION_BASELINE_CHANGED')
const mission=(await read(client.from('pick2_mlb_runtime_state').select('mission_odds_calls,revision,updated_at').eq('state_kind','MISSION')))[0]
if(mission.mission_odds_calls!==20)throw Error('MISSION_BASELINE_CHANGED')
const storage=createEvidenceStorage({url,key});await storage.preflight()
const snapshots=[],ledger=[{ordinal:1,runId:'mlb-operational-04035c55-b6b8-47f6-9882-4553fc43df85',classification:'ACQUIRED',basis:'CERTIFIED_MANUAL_BASELINE',consumed:1},{ordinal:2,runId:'mlb-operational-64d4f1f1-a4c9-4cfc-a178-89bf8866fdd6',classification:'ACQUIRED',basis:'CERTIFIED_MANUAL_BASELINE',consumed:1}]
for(const run of runs){
  const ref=run.checkpoint.references.find(r=>r.kind==='odds_evidence')
  let classification='CONSUMED_UNCERTAIN'
  if(ref){
    const envelope=await storage.read(evidenceIdentity(run,'odds').key)
    if(!envelope||sha256(envelope)!==ref.digest||sha256(evidenceEnvelope(run,'odds',envelope.evidence))!==ref.digest)throw Error('EVIDENCE_DIGEST_MISMATCH')
    classification='RESERVED_AND_ACQUIRED'
    if(String(run.run_date).startsWith('2026-09-12'))snapshots.push({at:envelope.evidence.acquiredAt,events:envelope.evidence.payload.events})
  }
  ledger.push({ordinal:ledger.length+1,runId:run.run_id,runAsOf:run.run_as_of,classification,consumed:1,durableEvidenceVerified:Boolean(ref)})
}
const probability=n=>n>0?100/(100+n):-n/(100-n)
function quotes(snapshot){const map=new Map();for(const e of snapshot.events)for(const b of e.bookmakers??[])for(const m of b.markets??[])if(m.key==='h2h')for(const o of m.outcomes??[]){if(!Number.isFinite(o.price)||o.price===0)throw Error('INVALID_QUOTE');const side=o.name===e.home_team?'HOME':o.name===e.away_team?'AWAY':o.name;const id=JSON.stringify([e.id,b.key,side]);if(map.has(id))throw Error('DUPLICATE_QUOTE');map.set(id,{event:e.id,side,price:o.price,update:m.last_update??b.last_update})}return map}
const comparisons=[]
for(let i=1;i<snapshots.length;i++){
  const before=quotes(snapshots[i-1]),after=quotes(snapshots[i]),games=new Set(),sides=new Set();let common=0,changed=0,meaningful=0,added=0,removed=0,updateOnly=0,maxMove=0
  for(const [id,q]of after){const old=before.get(id);if(!old){added++;continue}common++;const move=Math.abs(probability(q.price)-probability(old.price))*100;if(q.price!==old.price){changed++;games.add(q.event);sides.add(q.event+':'+q.side);if(move>=1)meaningful++;maxMove=Math.max(maxMove,move)}else if(q.update!==old.update)updateOnly++}
  for(const id of before.keys())if(!after.has(id))removed++
  comparisons.push({acquiredAt:snapshots[i].at,comparableQuotes:common,changedPrices:changed,changedGames:games.size,changedSides:sides.size,meaningfulMovesAtLeastOneImpliedProbabilityPoint:meaningful,unchangedPrices:common-changed,timestampOnlyChanges:updateOnly,addedQuotes:added,removedQuotes:removed,identicalPriceSnapshot:changed===0&&added===0&&removed===0,maxImpliedProbabilityPointMove:Number(maxMove.toFixed(4))})
}
const games=await read(client.from('pick2_mlb_games').select('scheduled_at').eq('game_date','2026-09-12').order('scheduled_at').limit(51))
if(games.length!==15)throw Error('SLATE_CHANGED')
let last=null,calls=0,uncappedSlots=0
for(let t=Date.parse('2026-09-12T12:00:00Z');t<Date.parse('2026-09-13T04:00:00Z');t+=15*60000){const at=new Date(t).toISOString(),input={at,eligibleStarts:games.map(g=>g.scheduled_at),lastAcquisitionAt:last,dailyConsumed:calls};const plan=planProposedOddsAcquisition(input);if(plan.decision==='PROPOSE_ACQUIRE'){last=at;calls++}if(games.some(g=>Date.parse(g.scheduled_at)>t+5*60000))uncappedSlots++}
const total=k=>comparisons.reduce((n,c)=>n+c[k],0)
const afterMission=(await read(client.from('pick2_mlb_runtime_state').select('mission_odds_calls,revision,updated_at').eq('state_kind','MISSION')))[0]
if(sha256(afterMission)!==sha256(mission))throw Error('MISSION_CHANGED_DURING_READ')
console.log(JSON.stringify({analysisDate:'2026-09-12',observedAt:new Date().toISOString(),source:'DIGEST_VERIFIED_PRIVATE_ODDS_RESPONSES',scope:'ALL_H2H_QUOTES_IN_PRESERVED_RESPONSES_NOT_ONLY_PERSISTED_ELIGIBLE_SUBSET',historicalMission:{consumed:20,cap:20,unchangedDuringRead:true,ledger,separateLegacyAcquisitions:2},rejectedCurrentAttempt:{runId:'automation-2be095cab0b8e3aea0c0d5d92d39f897210507393791bd625d742de74e2d8303',classification:'REJECTED_BEFORE_PROVIDER',consumed:0},snapshotCount:snapshots.length,meaningfulThreshold:'Absolute raw implied probability movement >= 1 percentage point; analysis threshold, not Policy V1 logic',comparisons,totals:{comparableQuotes:total('comparableQuotes'),changedPrices:total('changedPrices'),unchangedPrices:total('unchangedPrices'),meaningfulMoves:total('meaningfulMovesAtLeastOneImpliedProbabilityPoint'),identicalSnapshots:comparisons.filter(c=>c.identicalPriceSnapshot).length},cadenceSimulation:{date:'2026-09-12',assumption:'All 15 stored start times potentially eligible; fixed 15-minute ticks from 08:00 PR; zero latency; no live eligibility claim',proposedCalls:calls,every15MinuteEligibleSlots:uncappedSlots},providerCalls:0,productionDml:0,productionDdl:0}))
