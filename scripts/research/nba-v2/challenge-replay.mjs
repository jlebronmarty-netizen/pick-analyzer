import {score} from './scoring.mjs';
import {residualForecast} from '../../../src/lib/nba/decision-residual-v2.mjs';
import {expectedValue} from '../../../src/lib/nba/decision-probability-v2.mjs';
const prDay=t=>new Date(t*1000-4*3600000).toISOString().slice(0,10);
export function challengeReplay(samples,models){
  const stages=new Map();
  const season=samples.filter(r=>r.season==='2024-25' && ['moneyline','spread','total'].includes(r.scope));
  for(const r of season){
    const day=prDay(r.tip);
    if(!stages.has(day))stages.set(day,[]);
    const stageTime=Date.parse(day+'T18:00:00-04:00')/1000;
    const q=r.price;
    if(!q || q.at>stageTime || stageTime-q.at>3*3600 || !(r.tip>stageTime+600) || r.featuresReadyAt>stageTime)continue;
    const m=models[r.scope],f=residualForecast(m.fit,m.method,m.temperature,r.mu,q.line,{noDraw:r.scope==='moneyline'});
    for(const reverse of [false,true]){
      const p=reverse?1-f.probability:f.probability;
      const odds=reverse?q.otherOdds:q.odds;
      if(odds< -200 || odds> -110)continue;
      const ev=expectedValue(p,odds,f.pushProbability);
      if(ev<=0)continue;
      stages.get(day).push({...r,p,odds,ev,push:f.pushProbability,y:reverse?-r.y:r.y,
        line:reverse?-q.line:q.line,mu:reverse?-r.mu:r.mu,side:reverse?'opposite':'canonical'});
    }
  }
  const summarize=field=>{
    const picks=[];
    for(const rows of stages.values()){
      const first=[...rows].sort((a,b)=>b[field]-a[field]||
        a.game.localeCompare(b.game)||a.scope.localeCompare(b.scope)||a.side.localeCompare(b.side))[0];
      if(first)picks.push(first);
    }
    return {stages:stages.size,selectedStages:picks.length,abstentions:stages.size-picks.length,metrics:score(picks)};
  };
  return {clock:'18:00 America/Puerto_Rico',oddsRange:[-200,-110],stakeUnits:1,realSelections:0,
    highestProbability:summarize('p'),highestEv:summarize('ev')};
}
