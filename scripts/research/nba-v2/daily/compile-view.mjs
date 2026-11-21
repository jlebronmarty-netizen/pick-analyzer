import {readFileSync,writeFileSync} from 'node:fs';
import {contractReview} from './review.mjs';
import {evaluateForward} from '../forward-metrics.mjs';
import {holdoutFrom} from './runner.mjs';
import {challengeStage} from '../../../../src/lib/nba/decision-probability-v2.mjs';
const dir='docs/research/nba-v2/';
const read=name=>JSON.parse(readFileSync(dir+name+'.json','utf8'));
const initial=read('forward-20261120'),next=read('forward-20261121'),outcomes=read('outcomes-20261120');
const evidence=read('operations/evidence-20261120'),nextEvidence=read('operations/evidence-20261121'),model=read('model');
const results=new Map(outcomes.outcomes.map(r=>[r.forecastId,r]));
const games={...evidence.games,...nextEvidence.games};
const context=new Map(nextEvidence.context.map(r=>[r.forecastId,r]));
const report=evaluateForward(model,[initial,next],[outcomes],{asOf:next.frozenAt,holdoutFrom,
  benchmarks:[...evidence.benchmarks,...nextEvidence.benchmarks],includeEmpty:true,includeCombined:true});
const contracts=[initial,next].flatMap(b=>b.rows.map(f=>{
  const g=games[f.gameId],c=context.get(f.forecastId),result=results.get(f.forecastId);
  return contractReview(f,result,{matchup:g.away+' @ '+g.home,l5:c?.l5,l10:c?.l10});
}));
const bankroll=read('operations/challenge-balance');
const stage=challengeStage([initial,next].flatMap(b=>b.rows.map(f=>({candidate:{...f,dataQuality:f.qualityStatus}}))),
  next.frozenAt,{currentCapitalCents:bankroll.currentCents});
const view={modelHash:initial.modelHash,asOf:next.frozenAt,source:'archive',exclusionsAt:next.frozenAt,bankroll,challenge:stage.classification,approvedForBetting:false,report,contracts,exclusions:next.ignored};
writeFileSync(dir+'operations/prospective-report.json',JSON.stringify(view,null,2)+'\n');
