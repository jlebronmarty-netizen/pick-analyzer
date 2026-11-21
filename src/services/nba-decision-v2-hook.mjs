import model from '../../docs/research/nba-v2/model.json' with {type:'json'};
import {runDaily} from '../../scripts/research/nba-v2/daily/runner.mjs';
import {supabasePort} from '../../scripts/research/nba-v2/daily/supabase-port.mjs';

// The existing V1 service calls this hook after its own operation completes.
// Use the existing server-only database client and already-loaded board. No network call in off mode.
export async function runOptionalNbaV2(kind,db,board,{mode=process.env.NBA_DECISION_V2_MODE??'off',clock}={}) {
  if(!['observe','shadow'].includes(mode))return {status:'DISABLED'};
  try{
    const result=await runDaily({kind,model,board,port:supabasePort(db),clock,write:mode==='shadow'});
    const d=result.diagnostics??result.batch?.diagnostics;
    const state={mode,kind,status:mode==='observe'?'DRY_RUN':result.reused?'ALREADY_COMMITTED':'COMMITTED',
      cycleId:result.cycleId??null,eligible:d?.eligible??null,excluded:d?.excluded??null,
      settled:d?.settled??null,pending:d?.pending??null,reportScopes:result.report?.scopes.length??null};
    console.info('NBA_DECISION_V2_SHADOW',JSON.stringify(state));return state;
  }catch(error){
    const failure=error instanceof Error?error.message.split(':')[0]:'UNKNOWN';
    console.error('NBA_DECISION_V2_SHADOW_FAILED',kind,failure);
    return {status:'V2_FAILED',kind,failure};
  }
}
