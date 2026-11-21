import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {impliedProbability} from '../../../src/lib/nba/decision-probability-v2.mjs';
import {scoreForward} from './forward-score.mjs';
const date=s=>typeof s==='string'?Date.parse(s):NaN;
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function evaluateForward(model,batches,settlements,{holdoutFrom,asOf,benchmarks=[],includeCombined=false,includeEmpty=false,onContract}){
  const digest=hash(model),begin=date(holdoutFrom),end=date(asOf);
  if(!(date(model.selectionEnd)<begin && begin<=end))throw Error('INVALID_FORWARD_WINDOW');
  const quotes=new Map(),invalidPairs=new Set();
  for(const b of benchmarks){
    if(quotes.has(b.forecastId)&&hash(quotes.get(b.forecastId))!==hash(b))invalidPairs.add(b.forecastId);
    quotes.set(b.forecastId,b);
  }
  const first=new Map(),disputed=new Set(),labels=new Map(),lastPending=new Map(),lastValid=new Map(),scopes=new Map();
  for(const batch of batches){
    if(batch.modelHash!==digest)continue;
    for(const r of batch.rows){
      if(r.modelHash!==digest||r.modelVersion!==model.version||!model.scopes[r.scope]||
        r.forecastId!==hash([digest,r.gameId,r.scope,r.playerId??null,r.side])||
        r.frozenAt!==batch.frozenAt || r.decisionAt!==r.frozenAt || r.qualityStatus!=='VALIDATED' ||
        !r.contractVerified || r.probabilityOrigin!=='FROZEN_PROSPECTIVE_MODEL' ||
        !(r.probability>0 && r.probability<1 && r.pushProbability>=0 && r.pushProbability<=1) ||
        !(date(r.quoteAt)<=date(r.capturedAt) && date(r.capturedAt)<=date(r.featuresAsOf) &&
          date(r.featuresAsOf)<=date(r.frozenAt) && begin<=date(r.frozenAt) && date(r.frozenAt)<=end &&
          date(r.frozenAt)<Math.min(date(r.gameStartAt),date(r.expiresAt))))continue;
      const prior=first.get(r.forecastId);
      if(!prior || date(r.frozenAt)<date(prior.frozenAt))first.set(r.forecastId,r);
      if(prior && r.frozenAt===prior.frozenAt && hash(r)!==hash(prior))disputed.add(r.forecastId);
    }
  }
  for(const batch of settlements){
    if(batch.modelHash!==digest || !(date(batch.checkedAt)<=end))continue;
    for(const y of batch.outcomes){
      const r=first.get(y.forecastId);
      if(!r || !y.snapshotId || !Number.isFinite(y.actual) ||
        !(date(r.gameStartAt)<date(y.outcomeAt)&&date(y.outcomeAt)<=date(batch.checkedAt)))continue;
      const line=r.market==='moneyline'?0:r.market==='spread'?-r.line:r.line;
      const verdict=y.actual===line?'push':y.actual>line?'win':'loss';
      const old=labels.get(y.forecastId);
      if(y.scope!=='STATISTICAL_SETTLEMENT'||y.result!==verdict || old && old.actual!==y.actual)
        disputed.add(y.forecastId);
      else {
        labels.set(y.forecastId,y);
        lastValid.set(y.forecastId,Math.max(lastValid.get(y.forecastId)??0,date(batch.checkedAt)));
      }
    }
    for(const issue of batch.pending??[]){
      const previous=lastPending.get(issue.forecastId);
      if(!previous || date(batch.checkedAt)>=previous.at)lastPending.set(issue.forecastId,{at:date(batch.checkedAt),reason:issue.reason});
    }
  }
  const empty=()=>({scheduled:new Set(),rows:[],disputed:0,pending:0});
  if(includeEmpty)for(const scope of Object.keys(model.scopes))scopes.set(scope,empty());
  for(const r of first.values()){
    if(!scopes.has(r.scope))scopes.set(r.scope,empty());
    const group=scopes.get(r.scope);group.scheduled.add(r.gameId);
    if(disputed.has(r.forecastId)){group.disputed++;onContract?.(r,{result:'disputed'});continue;}
    const label=labels.get(r.forecastId);
    const pending=lastPending.get(r.forecastId);
    if(pending && pending.at>=(lastValid.get(r.forecastId)??0)){
      const conflict=pending.reason==='DISPUTED_OR_UNVERIFIED_COMPONENT';
      if(conflict)group.disputed++;else group.pending++;
      onContract?.(r,{result:conflict?'disputed':'pending'});
      continue;
    }
    if(!label){group.pending++;onContract?.(r,null);continue;}
    onContract?.(r,label);
    const b=quotes.get(r.forecastId)??r.benchmark;
    const decimal=b?.basis==='ARCHIVED_DECIMAL_PAIR';
    const pOffer=decimal && b.decimal>1?1/b.decimal:impliedProbability(r.americanOdds);
    const pOpposite=decimal && b.oppositeDecimal>1?1/b.oppositeDecimal:impliedProbability(b?.oppositeAmericanOdds);
    const paired=b && (decimal || b.basis==='ARCHIVED_AMERICAN_PAIR') && pOffer && pOpposite &&
      (!decimal || Number.isFinite(b.decimal) && b.decimal>1 && Number.isFinite(b.oppositeDecimal) && b.oppositeDecimal>1) &&
      Math.abs(b.probability-pOffer/(pOffer+pOpposite))<1e-10 && !invalidPairs.has(r.forecastId) && b.forecastId===r.forecastId && b.quoteId===r.quoteId &&
      b.oppositeQuoteId && b.oppositeQuoteId!==r.quoteId && b.book===r.book &&
      date(b.capturedAt)===date(r.capturedAt) && date(b.quoteAt)===date(r.quoteAt) && b.probability>0 && b.probability<1;
    group.rows.push({game:r.gameId,book:paired?b.probability:null,decimal:paired&&decimal?b.decimal:null,y:label.actual,line:r.market==='moneyline'?0:r.market==='spread'?-r.line:r.line,
      mu:r.projection,p:r.probability,push:r.pushProbability,odds:r.americanOdds});
  }
  if(includeCombined){
    const combined=empty();
    for(const g of scopes.values()){
      for(const id of g.scheduled)combined.scheduled.add(id);
      combined.rows.push(...g.rows);combined.disputed+=g.disputed;combined.pending+=g.pending;
    }
    scopes.set('ALL_DESCRIPTIVE',combined);
  }
  return [...scopes].map(([scope,g])=>{
    const metrics=scoreForward(g.rows);
    const train=model.scopes[scope]?.trainGames??null;
    return {scope,scheduledGames:g.scheduled.size,pending:g.pending,disputed:g.disputed,
      historicalTrainingGames:train,settledIndependentGames:metrics.games,metrics,
      status:scope==='ALL_DESCRIPTIVE'?'POOLED_DESCRIPTIVE_ONLY':train>=100 && metrics.binaryGames>=100?'INDEPENDENT_REVIEW_REQUIRED':'INSUFFICIENT_INDEPENDENT_GAMES',
      executableRoi:null,approvedForBetting:false};
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const [model,manifest]=process.argv.slice(2);
  if(!manifest)throw Error('Usage: node forward-metrics.mjs model.json manifest.json');
  const read=p=>JSON.parse(readFileSync(p,'utf8'));
  const m=read(manifest);
  console.log(JSON.stringify(evaluateForward(read(model),m.batches.map(read),m.settlements.map(read),m),null,2));
}
