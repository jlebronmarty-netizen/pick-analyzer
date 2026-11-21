import {score,gameMean} from './scoring.mjs';
import {marketAnchor} from './market-anchor.mjs';
import {fitErrors,residualForecast,METHODS,TEMPERATURES} from '../../../src/lib/nba/decision-residual-v2.mjs';
const cut=Date.parse('2024-01-01T00:00:00Z')/1000;
function predict(rows,fit,method,temp,noDraw,priced=false) {
  return rows.filter(r=>!priced||r.price).map(r=>{
    const contract=priced?r.price:{line:r.line,book:null,odds:null};
    const f=residualForecast(fit,method,temp,r.mu,contract.line,{noDraw});
    return {...r,...contract,p:f.probability,push:f.pushProbability};
  });
}
export function study(scoped,scope) {
  const noDraw=scope==='moneyline';
  const train=scoped.filter(r=>r.season==='2022-23'), fit=fitErrors(train);
  const cal=scoped.filter(r=>r.season==='2023-24' && r.tip+28800<cut);
  const select=scoped.filter(r=>r.season==='2023-24' && r.tip-3600>=cut);
  const test=scoped.filter(r=>r.season==='2024-25');
  if(!fit || !cal.length || !select.length || !test.length) throw Error('INSUFFICIENT_DATA '+scope);
  const candidates=METHODS.map(method=>{
    const loss=(rows,t)=>score(predict(rows,fit,method,t,noDraw),false).brier;
    const temperature=[...TEMPERATURES].sort((a,b)=>loss(cal,a)-loss(cal,b)||Math.abs(a-1)-Math.abs(b-1))[0];
    return {method,temperature,selectionBrier:loss(select,temperature)};
  }).sort((a,b)=>a.selectionBrier-b.selectionBrier);
  const winner=candidates[0];
  const artifact={...winner,fit,trainGames:fit.games};
  const scored=predict(test,fit,winner.method,winner.temperature,noDraw);
  const priced=predict(test,fit,winner.method,winner.temperature,noDraw,true);
  const prevalenceRows=train.filter(r=>r.y!==r.line);
  const baseline=gameMean(prevalenceRows,r=>Number(r.y>r.line));
  let playerBaselineBrier=null;
  if(scope.startsWith('props_')){
    const priors=new Map();
    for(const r of prevalenceRows){
      if(!priors.has(r.entity))priors.set(r.entity,{wins:0,n:0});
      const a=priors.get(r.entity);a.n++;a.wins+=Number(r.y>r.line);
    }
    const rates=scored.map(r=>{
      const a=priors.get(r.entity)??{wins:0,n:0};
      return {...r,p:(a.wins+10*baseline)/(a.n+10)};
    });
    playerBaselineBrier=score(rates,false).brier;
  }
  const report={playerBaselineBrier,trainGames:fit.games,calibrationGames:new Set(cal.map(r=>r.game)).size,
    selectionGames:new Set(select.map(r=>r.game)).size,candidates:candidates.map(c=>({...c,referenceHoldoutBrier:
      score(predict(test,fit,c.method,c.temperature,noDraw),false).brier})),
    baselineProbability:baseline,baselineBrier:score(scored.map(r=>({...r,p:baseline})),false).brier,
    marketAnchor:marketAnchor(priced),reference:score(scored),exactTipSensitivity:priced.length?score(priced.filter(r=>r.exactTip)):null,priced:priced.length?score(priced):null,
    noVigBrier:priced.length?score(priced.map(r=>({...r,p:r.book})),false).brier:null};
  return {artifact,report};
}
