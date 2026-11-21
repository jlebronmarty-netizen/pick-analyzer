import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildSamples} from './archive.mjs';
import {score} from './scoring.mjs';
import {fitErrors,residualForecast,METHODS,TEMPERATURES,MODELV} from '../../../src/lib/nba/decision-residual-v2.mjs';

const [prefix,output]=process.argv.slice(2);
if(!prefix||!output) throw Error('Usage: node replay.mjs /tmp/pick-v2- docs/research/nba-v2');
const names=['games','players','prices','pairs'];
const data=names.map(k=>JSON.parse(readFileSync(prefix+k+'.json','utf8')));
const hashes=Object.fromEntries(data.map((rows,i)=>[names[i],createHash('sha256').update(JSON.stringify(rows)).digest('hex')]));
const {samples,coverage}=buildSamples(...data);
const selected={},results={};
const cut=Date.parse('2024-01-01T00:00:00Z')/1000;
function predict(rows,fit,method,temp,noDraw,priced=false) {
  return rows.filter(r=>!priced||r.price).map(r=>{
    const contract=priced?r.price:{line:r.line,book:null,odds:null};
    const f=residualForecast(fit,method,temp,r.mu,contract.line,{noDraw});
    return {...r,...contract,p:f.probability,push:f.pushProbability};
  });
}
for(const scope of new Set(samples.map(x=>x.scope))) {
  const scoped=samples.filter(r=>r.scope===scope),noDraw=scope==='moneyline';
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
  selected[scope]={...winner,fit,trainGames:fit.games};
  const scored=predict(test,fit,winner.method,winner.temperature,noDraw);
  const priced=predict(test,fit,winner.method,winner.temperature,noDraw,true);
  const prevalenceRows=train.filter(r=>r.y!==r.line);
  const baseline=score(prevalenceRows.map(r=>({...r,p:0,push:0})),false).brier;
  results[scope]={trainGames:fit.games,calibrationGames:new Set(cal.map(r=>r.game)).size,
    selectionGames:new Set(select.map(r=>r.game)).size,candidates:candidates.map(c=>({...c,referenceHoldoutBrier:
      score(predict(test,fit,c.method,c.temperature,noDraw),false).brier})),
    baselineProbability:baseline,baselineBrier:score(scored.map(r=>({...r,p:baseline})),false).brier,
    reference:score(scored),exactTipSensitivity:priced.length?score(priced.filter(r=>r.exactTip)):null,priced:priced.length?score(priced):null,
    noVigBrier:priced.length?score(priced.map(r=>({...r,p:r.book})),false).brier:null};
}
const replacer=(_k,v)=>typeof v==='number'?Number(v.toFixed(8)):v;
function save(name,obj){writeFileSync(output+'/'+name,JSON.stringify(obj,replacer,2)+'\n');}
save('replay.json',{version:MODELV,holdout:'2024-25_RETROSPECTIVE',sourceHashes:hashes,coverage,results});
save('model.json',{version:MODELV,trainingEnd:'2023-07-01T00:00:00Z',selectionEnd:'2024-07-01T00:00:00Z',
  strategy:'historically fitted; pregame SHADOW only',scopes:selected});
