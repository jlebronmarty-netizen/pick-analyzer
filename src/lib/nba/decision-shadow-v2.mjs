import {createHash} from 'node:crypto';
import {hasValidatedInputs} from '../data-quality/window.mjs';
import {MODELV,residualForecast} from './decision-residual-v2.mjs';
import {challengeStage,expectedValue,impliedProbability,researchDecision} from './decision-probability-v2.mjs';
import {concordantPlayerFinal,settleNbaShadowForecast} from './decision-learning-core.mjs';

const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const time=s=>typeof s==='string'?Date.parse(s):NaN;
const trainedPlayers=new Set([1028038426,73,490,406,115,17896075,3547254,473]);
export function planProbabilityFreeze(board, model, frozenAt) {
  const now=time(frozenAt),asOf=time(board?.asOf);
  if(!(asOf<=now && now-asOf<=10*60000 && time(model?.selectionEnd)<asOf) || model.version!==MODELV)
    throw Error('INVALID_FREEZE_CLOCK_OR_MODEL');
  const rows=[],ignored={},groups=new Map(),modelHash=hash(model);
  const skip=reason=>{ignored[reason]=(ignored[reason]??0)+1;};
  for(const row of Object.values(board.rows).flat()) {
    const game=board.games.find(g=>g.id===row.gameId);
    const q=row.dataQuality;
    if(!hasValidatedInputs(row)){skip(q?.status??'SOURCE_UNAVAILABLE');continue;}
    if(!game || game.status!=='scheduled' || game.startsAt!==row.startsAt ||
       !(now<time(game.startsAt)-600000 && now<time(q.expiresAt))){skip('NO_LONGER_ELIGIBLE');continue;}
    const histories=board.historyEvidence?.[row.historyKey];
    const scopes=row.market==='props'?['player']:['home','away'];
    if(row.sample!==10 || scopes.some(k=>{
      const w=histories?.[k];
      return w?.status!=='VALIDATED'||w.issues?.length!==0||w.required!==10||
        time(w.cutoff)!==asOf||w.included?.length!==10||new Set(w.included.map(x=>x.id)).size!==10||
        w.included.some(x=>!Number.isSafeInteger(x.id)||!(time(x.date)<asOf));
    })){skip('HISTORY_RECEIPT_UNVERIFIED');continue;}
    const team=['moneyline','spread'].includes(row.market);
    const side=team?'home':'over';
    const scope=row.market==='props'?'props_'+row.statistic:row.period==='ft'?row.market:row.market+'_'+row.period;
    const selected=model.scopes[scope];
    if (!selected || (row.market==='props' && (!trainedPlayers.has(row.playerId)||row.line!==4.5)) ||
        row.selection!==(team?game.home:row.market==='props'?'over':'Over') && !(row.market==='props'&&row.selection==='Over')){
      skip('OUTSIDE_MODEL_OR_CANONICAL_SIDE');continue;
    }
    if(!row.quoteId||!row.id||q.book!=='FanDuel'||row.quoteFreshness!=='RECENT'||
       impliedProbability(row.odds)===null||!(time(q.providerUpdatedAt)<=time(row.capturedAt)&&time(row.capturedAt)<=asOf)||
       (['ft','h2'].includes(row.period)&&q.overtimeRule!=='INCLUDES_OVERTIME')){
      skip('PRICE_OR_CONTRACT_UNVERIFIED');continue;
    }
    const threshold=row.market==='moneyline'?0:row.market==='spread'?-row.line:row.line;
    if(row.market!=='moneyline' && !Number.isFinite(row.line)){skip('MISSING_LINE');continue;}
    const prediction=residualForecast(selected.fit,selected.method,selected.temperature,row.projection,threshold,{noDraw:row.market==='moneyline'});
    if(!prediction){skip('UNSUPPORTED_FORECAST');continue;}
    const id=hash([modelHash,game.id,scope,row.playerId??null,side]);
    const quantiles=selected.fit.quantiles;
    const entry={forecastId:id,modelVersion:model.version,modelHash,scope,gameId:game.id,gameStartAt:game.startsAt,
      gameDay:board.day,market:row.market,period:row.period,statistic:row.statistic??null,playerId:row.playerId??null,
      side,rowId:row.id,quoteId:row.quoteId,book:q.book,americanOdds:row.odds,line:row.line,quoteAt:q.providerUpdatedAt,
      capturedAt:row.capturedAt,expiresAt:q.expiresAt,featuresAsOf:board.asOf,trainedThrough:model.selectionEnd,
      frozenAt,decisionAt:frozenAt,projection:row.projection,projectionInterval80:[row.projection+quantiles[20],row.projection+quantiles[180]],
      probabilityOrigin:'FROZEN_PROSPECTIVE_MODEL',...prediction,impliedProbability:impliedProbability(row.odds),
      expectedValue:expectedValue(prediction.probability,row.odds,prediction.pushProbability),
      qualityStatus:'VALIDATED',contractVerified:true,regionalExecutionVerified:false,quality:q,historyReceiptHash:hash(histories),
      historyGameIds:scopes.map(k=>histories[k].included.map(r=>r.id)),classification:'VIGILAR'};
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(entry);
  }
  for(const entries of groups.values()){
    // More than one executable-looking line or source needs an explicit line-selection policy.
    if(entries.length!==1){skip('AMBIGUOUS_CONTRACT');continue;}
    rows.push(entries[0]);
  }
  return {version:model.version,frozenAt,modelHash,mode:'PROSPECTIVE_SHADOW',rows:rows.sort((a,b)=>a.forecastId.localeCompare(b.forecastId)),ignored};
}
export function settleProbabilityFreeze(f,receipts) {
  if(!f || !(time(f.frozenAt)<time(f.gameStartAt)) || f.probabilityOrigin!=='FROZEN_PROSPECTIVE_MODEL')return null;
  const raw={forecast_id:f.forecastId,game_id:f.gameId,game_start_at:f.gameStartAt,game_date_local:f.gameDay,
    market:f.market,period:f.period,side:f.side,line:f.line,model_version:f.modelVersion,projection:f.projection,
    player_id:f.playerId,statistic:f.statistic,evidence:{quality:f.quality}};
  if(f.market==='props' && (!receipts.compact || !receipts.original ||
      !(time(receipts.compact.materialized_at)>=time(receipts.compact.source_captured_at) &&
        time(receipts.compact.source_captured_at)>time(f.gameStartAt))))return null;
  const playerStat=f.market==='props'?concordantPlayerFinal(f.statistic,receipts.compact,receipts.original):null;
  const result=settleNbaShadowForecast(raw,{...receipts,playerStat});
  if(!result)return null;
  return {forecastId:f.forecastId,result:result.statistical_result,actual:result.actual,
    outcomeAt:new Date(Math.max(time(result.source_received_at),time(receipts.sourceReceivedAt),
      f.market==='props' ? time(receipts.compact.materialized_at) : 0)).toISOString(),scope:'STATISTICAL_SETTLEMENT',source:result.result_source};
}
// Enrich an archived board for branch-only display. The ranking and official classifications are inherited.
export function previewProbabilityBoard(board,ledger,{asOf=ledger.frozenAt,reviews={},execution={}}={}) {
  const assessed=new Map();
  const byId=new Map(ledger.rows.map(f=>[f.rowId,f]));
  const attach=r=>{
    const f=byId.get(r.id);
    if(!f || !hasValidatedInputs(r) || f.quoteId!==r.quoteId || f.americanOdds!==r.odds ||
      f.line!==r.line || f.projection!==r.projection || f.featuresAsOf!==board.asOf ||
      f.historyReceiptHash!==hash(board.historyEvidence?.[r.historyKey]??null))return r;
    const e=execution[f.forecastId],v=reviews[f.scope];
    const current=e?.quoteId===r.quoteId && e?.book===f.book && e?.americanOdds===r.odds &&
      e?.line===r.line && time(f.frozenAt)<=time(e?.checkedAt) && time(e?.checkedAt)<=time(asOf) &&
      time(asOf)<time(e?.expiresAt) && e.region==='PR';
    const candidate={...f,dataQuality:r.dataQuality.status,advantage:r.advantage,
      regionalExecutionVerified:current && e.available===true,
      contextVerified:current && e.contextVerified===true,evLower95:current?e.evLower95:null};
    const decision=researchDecision(candidate,v,asOf);
    assessed.set(f.forecastId,{candidate,validation:v});
    return {...r,shadowProbability:f,shadowDecision:decision};
  };
  const sections=obj=>Object.fromEntries(Object.entries(obj??{}).map(([k,v])=>[k,v.map(attach)]));
  const preview={...board,rows:sections(board.rows),preferredRows:sections(board.preferredRows),top25:(board.top25??[]).map(attach)};
  return {...preview,shadowChallenge:challengeStage([...assessed.values()],asOf)};
}
