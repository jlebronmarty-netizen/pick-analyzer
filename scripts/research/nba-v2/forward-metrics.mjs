import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {score} from './scoring.mjs';
const date=s=>typeof s==='string'?Date.parse(s):NaN;
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function evaluateForward(model,batches,settlements,{holdoutFrom,asOf}){
  const digest=hash(model),begin=date(holdoutFrom),end=date(asOf);
  if(!(date(model.selectionEnd)<begin && begin<=end))throw Error('INVALID_FORWARD_WINDOW');
  const first=new Map(),disputed=new Set(),labels=new Map(),scopes=new Map();
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
      else labels.set(y.forecastId,y);
    }
    for(const issue of batch.pending??[]){
      if(issue.reason==='DISPUTED_OR_UNVERIFIED_COMPONENT')disputed.add(issue.forecastId);
    }
  }
  for(const r of first.values()){
    if(!scopes.has(r.scope))scopes.set(r.scope,{scheduled:new Set(),rows:[],disputed:0,pending:0});
    const group=scopes.get(r.scope);group.scheduled.add(r.gameId);
    if(disputed.has(r.forecastId)){group.disputed++;continue;}
    const label=labels.get(r.forecastId);
    if(!label){group.pending++;continue;}
    group.rows.push({game:r.gameId,y:label.actual,line:r.market==='moneyline'?0:r.market==='spread'?-r.line:r.line,
      mu:r.projection,p:r.probability,push:r.pushProbability,odds:r.americanOdds});
  }
  return [...scopes].map(([scope,g])=>{
    const metrics=score(g.rows);
    return {scope,scheduledGames:g.scheduled.size,pending:g.pending,disputed:g.disputed,
      historicalTrainingGames:model.scopes[scope].trainGames,settledIndependentGames:metrics.games,metrics,
      status:model.scopes[scope].trainGames>=100 && metrics.binaryGames>=100?'INDEPENDENT_REVIEW_REQUIRED':'INSUFFICIENT_INDEPENDENT_GAMES',
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
