import {createHash} from 'node:crypto';
import {planProbabilityFreeze} from '../../../../src/lib/nba/decision-shadow-v2.mjs';
import {pairFromBoard} from './benchmarks.mjs';
import {contractReview} from './review.mjs';
import {grade} from './settlement.mjs';
import {evaluateForward} from '../forward-metrics.mjs';

export const holdoutFrom='2026-11-21T01:57:00Z';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function cycleSlot(kind,at){
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
  const hours=kind==='freeze'?['11:35','19:35']:kind==='settle'?['08:15']:[];
  const slot=hours.map(h=>Date.parse(day+'T'+h+':00-04:00')).find(t=>t<=Date.parse(at)&&Date.parse(at)<t+21*60000);
  if(slot===undefined)throw Error('OUTSIDE_EXISTING_NBA_SLOT');
  return new Date(slot).toISOString();
}
// Automatic runs always validate the existing PR slot before planning or persisting.
export async function runDaily({kind,model,board,port,clock=()=>new Date().toISOString(),write=false}){
  const at=clock(),slot=cycleSlot(kind,at),modelHash=hash(model);
  if(write){
    const existing=await port.existing(modelHash,kind,slot);
    if(existing){
      if(kind==='settle'&&!existing.hasReport)await refreshReport(port,model,existing.id);
      return {cycleId:existing.id,diagnostics:existing.diagnostics,reused:true};
    }
  }
  const batch=await planReadOnlyBatch({kind,model,board,port,at});
  if(!write)return {slot,batch,write:false};
  const cycleId=await port.commit(kind,slot,batch);
  if(kind==='freeze')return {cycleId,diagnostics:batch.diagnostics};
  return {cycleId,diagnostics:batch.diagnostics,report:await refreshReport(port,model,cycleId)};
}

// The operator rehearsal uses the actual clock. This planner has no write path or synthetic slot.
export async function planReadOnlyBatch({kind,model,board,port,at}){
  if(!['freeze','settle'].includes(kind))throw Error('INVALID_V2_OPERATION');
  const modelHash=hash(model);
  if(kind==='freeze'){
    const frozen=planProbabilityFreeze(board,model,at);
    const boardRows=new Map(Object.values(board.rows).flat().map(row=>[row.id,row]));
    const games=new Map(board.games.map(game=>[game.id,game]));
    const records=frozen.rows.map(f=>{
      const row=boardRows.get(f.rowId),game=games.get(f.gameId);
      const displayContext={matchup:game.away+' @ '+game.home,playerName:row.playerName??null,
        selection:row.selection,l5:row.l5??null,l10:row.l10??null};
      return {...f,displayContext,benchmark:pairFromBoard(f,board)};
    });
    const diagnostics={excluded:frozen.ignored,discarded:frozen.discarded??[],considered:Object.values(board.rows).flat().length,
      eligible:records.length,withoutPairedPrice:records.filter(f=>!f.benchmark).length,boardAsOf:board.asOf};
    return {modelHash,at,records,diagnostics};
  }
  const games=await port.due(modelHash,at),days=new Map(),records=[];
  for(const {gameId,forecasts} of games){
    const first=forecasts[0];
    if(!first || forecasts.some(f=>f.gameId!==gameId||f.gameDay!==first.gameDay||f.modelHash!==modelHash))throw Error('INVALID_DUE_GROUP');
    if(!days.has(first.gameDay))days.set(first.gameDay,await port.schedule(first.gameDay,at));
    const props=forecasts.filter(f=>f.market==='props');
    const extra=props.length?await port.playerEvidence(gameId,[...new Set(props.map(f=>f.playerId))],at):{};
    const receipts={...extra,scheduleReceipts:days.get(first.gameDay)};
    for(const f of forecasts)records.push(grade(f,receipts,at));
  }
  const diagnostics={games:games.length,settled:records.filter(r=>r.result).length,pending:records.filter(r=>r.reason).length};
  return {modelHash,at,records,diagnostics};
}

export async function refreshReport(port,model,cycleId){
  const rows=[],settlements=[];
  let after='',asOf;
  for(;;){
    const page=await port.page(cycleId,after);
    if(!page.length)break;
    for(const e of page){
      if(!(e.forecast.forecastId>after) || (asOf && asOf!==e.cutoff))throw Error('INVALID_METRIC_PAGE');
      after=e.forecast.forecastId;asOf=e.cutoff;
      rows.push({modelHash:e.forecast.modelHash,frozenAt:e.forecast.frozenAt,rows:[e.forecast]});
      for(const {checkedAt,record} of e.observations){
        settlements.push({modelHash:e.forecast.modelHash,checkedAt,outcomes:record.result?[record]:[],pending:record.reason?[record]:[]});
      }
    }
    if(page.length<100)break;
  }
  asOf??=await port.cutoff(cycleId);
  const recentDays=new Set([...new Set(rows.map(b=>b.rows[0].gameDay))].sort().slice(-2));
  const recentContracts=[];
  const scopes=evaluateForward(model,rows,settlements,{asOf,holdoutFrom,includeEmpty:true,includeCombined:true,
    onContract:(forecast,result)=>{if(recentDays.has(forecast.gameDay))recentContracts.push(contractReview(forecast,result));}});
  const report={asOf,modelHash:hash(model),scopes,recentContracts};
  await port.saveReport(cycleId,report);
  return report;
}
