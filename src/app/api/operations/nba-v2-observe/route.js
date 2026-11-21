import {createClient} from '@supabase/supabase-js';
import {readNbaDecisionBoard} from '@/services/nba-decision-board.service';
import {operatorHost,observationTransport} from '@/lib/nba/decision-observe-v2.mjs';
import {planReadOnlyBatch} from '../../../../../scripts/research/nba-v2/daily/runner.mjs';
import {supabasePort} from '../../../../../scripts/research/nba-v2/daily/supabase-port.mjs';
import model from '../../../../../docs/research/nba-v2/model.json';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;

export async function GET(request) {
  const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
  if(!operatorHost(request,process.env))return reply({status:'CLOSED'},404);
  const start=performance.now(),cpu=process.cpuUsage(),sha=process.env.VERCEL_GIT_COMMIT_SHA;
  const io=observationTransport(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
    global:{fetch:io.fetch},auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const allowed=await db.rpc('nba_v2_shadow_observe_allowed',{p_sha:sha,p_host:process.env.VERCEL_URL})
      .abortSignal(AbortSignal.timeout(5000));
    if(allowed.error||allowed.data!==true)return reply({status:'CLOSED'},404);
    const afterGate={...io.metrics};
    const board=await readNbaDecisionBoard({db});
    const afterBoard={...io.metrics},boardMs=Math.round(performance.now()-start);
    const at=new Date().toISOString(),port=supabasePort(db);
    const freeze=await planReadOnlyBatch({kind:'freeze',model,board,port,at});
    const freezeMs=Math.round(performance.now()-start)-boardMs;
    const settle=await planReadOnlyBatch({kind:'settle',model,port,at});
    const ids=batch=>batch.records.map(r=>r.forecastId);
    const duplicates=batch=>batch.records.length-new Set(ids(batch)).size;
    const totalMs=Math.round(performance.now()-start),used=process.cpuUsage(cpu);
    const rows=Object.fromEntries(Object.entries(board.rows).map(([lane,r])=>[lane,r.length]));
    const evidence={status:'OBSERVED',mode:'observe',scheduledMode:'off',sha,at,boardAsOf:board.asOf,
      sharedBoard:{rows,top25:board.top25.length,readIssues:board.evidence.readIssues,qualityCounts:board.summary.qualityCounts,marketCaptureIssues:board.evidence.marketCaptureIssues.length},
      freeze:{considered:freeze.diagnostics.considered,eligible:freeze.records.length,excluded:freeze.diagnostics.excluded,
        duplicates:duplicates(freeze),withoutPairedPrice:freeze.diagnostics.withoutPairedPrice},
      settle:{...settle.diagnostics,duplicates:duplicates(settle),results:settle.records.map(r=>({id:r.forecastId,
        result:r.result??null,actual:r.actual??null,reason:r.reason??null}))},
      elapsedMs:{permissionAndBoard:boardMs,freeze:freezeMs,settle:totalMs-boardMs-freezeMs,total:totalMs},
      processCpuMs:Math.round((used.user+used.system)/1000),transport:{afterGate,afterBoard,total:io.metrics},
      v1WriterCalls:0,v2WriterCalls:0,providerCalls:0,approvedForBetting:false};
    if(board.evidence.readIssues.length||io.metrics.httpErrors||evidence.freeze.duplicates||evidence.settle.duplicates){
      console.error('NBA_V2_OPERATOR_OBSERVE_FAILED','OBSERVATION_INTEGRITY_FAILED');
      return reply({...evidence,status:'FAILED',reason:'OBSERVATION_INTEGRITY_FAILED'},503);
    }
    console.info('NBA_V2_OPERATOR_OBSERVE',JSON.stringify({sha,at,totalMs,eligible:freeze.records.length,settled:settle.diagnostics.settled,requests:io.metrics.requests}));
    return reply(evidence);
  }catch(error){
    const reason=error instanceof Error?error.message.split(':')[0].slice(0,100):'UNKNOWN';
    console.error('NBA_V2_OPERATOR_OBSERVE_FAILED',reason);return reply({status:'FAILED',reason,elapsedMs:Math.round(performance.now()-start),transport:io.metrics},503);
  }
}
