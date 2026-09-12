// Expected budget/cadence stops preserve upstream work and release the host loop.
// Only the deployed Edge authority can select the separate operational ledger.
import {sanitizedStageException} from './mlb-operational-r7-errors.mjs'
const oddsModes=new Set(['INITIALIZE','PREGAME','STARTER_CHANGE','ODDS_FRESHNESS'])
const downstream=new Set(['pick2_mlb_market_event_mappings','pick2_mlb_market_price_observations','pick2_mlb_market_value_evaluations','pick2_mlb_official_picks'])
export function missionBudgetExhausted(runtime,mode) {
  const count=runtime.ledger.missionOddsConsumed()
  if(!Number.isInteger(count)||count<2||count>20)throw Error('R6_STATE:MISSION_LEDGER')
  // A previously paid acquisition must remain recoverable at the cap.
  const operational=runtime.ledger.operationalBudget?.()
  return oddsModes.has(mode)&&(operational?.activation==='ACTIVE'?operational.remaining===0:count===20)&&runtime.run.odds_calls===0
}
export function exhaustedResult(runtime,status='ODDS_BUDGET_EXHAUSTED') {
  const run=runtime.run,stages=run.dml_accounting.stages
  if(run.status!=='RUNNING'||run.odds_calls!==0||run.checkpoint.marketReference||run.checkpoint.references.some(r=>r.kind==='odds_evidence')||stages.some(s=>s.conflicts!==0||s.readback!=='PASS'||downstream.has(s.target)))throw Error('R6_STATE:BLOCK_CONFLICT')
  return {status,predictions:stages.filter(s=>s.target==='pick2_game_predictions').reduce((n,s)=>n+s.inserted+s.reused,0),values:0,officialPicks:0,dml:stages}
}
export async function withMissionOddsBudget({runtime,mode,execute}) {
  if(missionBudgetExhausted(runtime,mode))return exhaustedResult(runtime)
  try{return await execute()}
  catch(error){
    const code=sanitizedStageException(error).code
    if(!oddsModes.has(mode)||!['MISSION_ODDS_CAP','OPERATIONAL_ODDS_DAILY_CAP','ODDS_MIN_INTERVAL','NO_ELIGIBLE_PREGAME_SCOPE'].includes(code))throw error
    // Reload the fenced authority after a cap race; never trust a stale counter.
    await runtime.refresh()
    return exhaustedResult(runtime,code==='ODDS_MIN_INTERVAL'?'ODDS_CADENCE_DEFERRED':code==='NO_ELIGIBLE_PREGAME_SCOPE'?'NO_VALID_PREGAME_SLATE':'ODDS_BUDGET_EXHAUSTED')
  }
}
