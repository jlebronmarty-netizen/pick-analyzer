// NBA GOAT Player Props Formula Lab V1
// Research only: never outputs calibrated probabilities, picks, EV, or promotion decisions.
// Reconstructed backtests do not imply that late-ingested GOAT data existed pregame.
export const MARKETS=Object.freeze({points:'pts',rebounds:'reb',assists:'ast',threes:'fg3m'});
export const FORMULA_WEIGHTS=Object.freeze(Array.from({length:11},(_,i)=>i/10));
export const LAB_VERSION='NBA_GOAT_PROP_FORMULA_LAB_V1';
const t=v=>Date.parse(String(v??''));
const valid=(v)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const norm=v=>Number(v);
const round=(v,n=4)=>Number(v.toFixed(n));
const mean=a=>a.reduce((sum,v)=>sum+v,0)/a.length;
export function collectFormulaExamples(facts,{mode='RETROSPECTIVE_RECONSTRUCTED',cutoffLeadMinutes=30}={}){
 if(!['RETROSPECTIVE_RECONSTRUCTED','PROSPECTIVE_ASOF_VERIFIED'].includes(mode))throw Error('INVALID_LAB_MODE');
 const keyed=new Set(),byPlayer=new Map();
 for(const f of facts){
  const id=Number(f.player_id),game=Number(f.provider_game_id),ts=t(f.game_datetime),capture=t(f.source_captured_at);
  if(!Number.isSafeInteger(id)||!Number.isSafeInteger(game)||!Number.isFinite(ts)||!Number.isFinite(capture))throw Error('INVALID_FACT_ID_OR_TIMESTAMP');
  const key=game+':'+id;
  if(keyed.has(key))throw Error('DUPLICATE_PLAYER_GAME_FACT');keyed.add(key);
  const arr=byPlayer.get(id)??[];arr.push(f);byPlayer.set(id,arr);
 }
 const examples=[];
 for(const [playerId,playerFacts] of byPlayer){
  playerFacts.sort((a,b)=>t(a.game_datetime)-t(b.game_datetime)||Number(a.provider_game_id)-Number(b.provider_game_id));
  for(let i=0;i<playerFacts.length;i++){
   const target=playerFacts[i],now=t(target.game_datetime),cutoff=now-cutoffLeadMinutes*60000;
   if(target.projection_eligible!==true)continue;
   const prior=playerFacts.slice(0,i).filter(p=>p.projection_eligible===true&&t(p.game_datetime)<now&&
    (mode==='RETROSPECTIVE_RECONSTRUCTED'||t(p.source_captured_at)<=cutoff));
   if(prior.length<10)continue;
   const last10=prior.slice(-10),last5=last10.slice(-5);
   for(const [market,field] of Object.entries(MARKETS)){
    if(!valid(target[field])||last10.some(p=>!valid(p[field])))continue;
    const actual=norm(target[field]),m5=mean(last5.map(p=>norm(p[field]))),m10=mean(last10.map(p=>norm(p[field])));
    examples.push({market,playerId,gameId:Number(target.provider_game_id),day:new Date(now).toISOString().slice(0,10),
     actual,L5:m5,L10:m10,priorGames:prior.length,
     mode,featureLatestSourceCapturedAt:new Date(Math.max(...last10.map(p=>t(p.source_captured_at)))).toISOString()});
   }
  }
 }
 return examples.sort((a,b)=>a.day.localeCompare(b.day)||a.gameId-b.gameId||a.playerId-b.playerId||a.market.localeCompare(b.market));
}
function metrics(examples,weight){
 if(!examples.length)return {n:0,mae:null,rmse:null,bias:null,distinctGames:0,days:0};
 const errors=examples.map(x=>weight*x.L5+(1-weight)*x.L10-x.actual);
 return {n:examples.length,mae:round(mean(errors.map(Math.abs))),rmse:round(Math.sqrt(mean(errors.map(e=>e*e)))),bias:round(mean(errors)),
  distinctGames:new Set(examples.map(e=>e.gameId)).size,days:new Set(examples.map(e=>e.day)).size};
}
export function evaluateMarketFormulas(examples,{
 mode='RETROSPECTIVE_RECONSTRUCTED',trainFrom='2026-11-08',trainThrough='2026-11-12',
 holdoutFrom='2026-11-13',holdoutThrough='2026-11-15',minTrain=50,minHoldout=50
}={}){
 if(trainThrough>=holdoutFrom)throw Error('OVERLAPPING_TRAIN_HOLDOUT');
 if(!['RETROSPECTIVE_RECONSTRUCTED','PROSPECTIVE_ASOF_VERIFIED'].includes(mode))throw Error('INVALID_LAB_MODE');
 const out=[];
 for(const market of Object.keys(MARKETS)){
  const clean=examples.filter(e=>e.market===market&&e.mode===mode);
  const train=clean.filter(e=>e.day>=trainFrom&&e.day<=trainThrough);
  const test=clean.filter(e=>e.day>=holdoutFrom&&e.day<=holdoutThrough);
  const candidates=FORMULA_WEIGHTS.map(weight=>({weightL5:round(weight,2),train:metrics(train,weight)}));
  candidates.sort((a,b)=>(a.train.mae??Infinity)-(b.train.mae??Infinity)||Math.abs(a.weightL5-.5)-Math.abs(b.weightL5-.5));
  const winner=candidates[0]??null;
  const base=metrics(test,0),selected=metrics(test,winner?.weightL5??0);
  const qualified=train.length>=minTrain&&test.length>=minHoldout&&base.distinctGames>=10;
  out.push({market,mode,version:LAB_VERSION,trainRows:train.length,trainGames:new Set(train.map(x=>x.gameId)).size,
   holdoutRows:test.length,holdoutGames:base.distinctGames,
   candidatesTried:candidates.length,candidates,
   selectedWeightL5:qualified?winner?.weightL5??null:null,
   selectionTrainMae:qualified?winner?.train.mae??null:null,
   holdout:{selected:qualified?selected:null,baselineL10:base,
    maeImprovementVsL10:qualified?round(base.mae-selected.mae):null},
   status:qualified?'EXPLORATORY_RECONSTRUCTED_FORMULA_CANDIDATE':'INSUFFICIENT_INDEPENDENT_SAMPLE',
   productionEligible:false,holdoutCertified:false,
   warning:mode==='RETROSPECTIVE_RECONSTRUCTED'?'Offline reconstruction; not evidence of real pregame access, ROI, or calibrated probability.':'Requires prospective pregame-snapshot and independent certification.'});
 }
 return out;
}
