// NBA GOAT V2 — preregistered, read-only per-market candidate search.
// All estimates use prior completed games only. Retrospective reconstructions are NOT prospective evidence.
export const NBA_FORMULA_LAB_V2='NBA_GOAT_FORMULA_LAB_V2';
export const STATS=Object.freeze({points:'pts',rebounds:'reb',assists:'ast',threes:'fg3m'});
export const CANDIDATES=Object.freeze([
 'L10','L5','EWMA_0_2','EWMA_0_4','EWMA_0_6','RATE_L5_MIN_L5','RATE_L10_MIN_L10','RATE_L10_MIN_L5'
]);
const ms=x=>Date.parse(String(x??''));
const n=x=>x===null||x===undefined||x===''?null:Number(x);
const average=a=>a.reduce((s,v)=>s+v,0)/a.length;
const round=x=>Number(x.toFixed(4));
function estimate(history,stat,formula){
 const last10=history.slice(-10),last5=last10.slice(-5),values=last10.map(x=>n(x[stat]));
 if(values.length!==10||values.some(x=>x===null||!Number.isFinite(x)))return null;
 const m10=average(values),m5=average(values.slice(-5));
 if(formula==='L10')return m10;
 if(formula==='L5')return m5;
 if(formula.startsWith('EWMA_')){
  const alpha=Number(formula.replace('EWMA_0_',''))/10;
  if(![0.2,0.4,0.6].includes(alpha))throw Error('UNLISTED_EWMA');
  let sum=0,weights=0;for(let i=0;i<values.length;i++){const weight=alpha*Math.pow(1-alpha,values.length-1-i);sum+=values[i]*weight;weights+=weight;}
  return sum/weights;
 }
 const rateGames=formula==='RATE_L5_MIN_L5'?last5:last10;
 const projectedMinutesGames=formula==='RATE_L10_MIN_L5'?last5:rateGames;
 const mins=rateGames.map(x=>n(x.minutes_played)),projected=projectedMinutesGames.map(x=>n(x.minutes_played));
 if(mins.some(x=>x===null||x<10)||projected.some(x=>x===null||x<10))return null;
 const totalMinutes=mins.reduce((s,v)=>s+v,0);
 if(totalMinutes<=0)return null;
 // Conserves total boxscore volume; does NOT use today's realized minutes.
 return rateGames.reduce((s,x)=>s+n(x[stat]),0)/totalMinutes*average(projected);
}
export function buildV2Examples(facts,{mode='RETROSPECTIVE_RECONSTRUCTED',cutoffLeadMinutes=30}={}){
 if(!['RETROSPECTIVE_RECONSTRUCTED','PROSPECTIVE_ASOF_VERIFIED'].includes(mode)||cutoffLeadMinutes<10)throw Error('INVALID_MODE_OR_CUTOFF');
 const seen=new Set(),players=new Map();
 for(const f of facts){
  const player=Number(f.player_id),game=Number(f.provider_game_id),time=ms(f.game_datetime),capture=ms(f.source_captured_at);
  if(!Number.isSafeInteger(player)||!Number.isSafeInteger(game)||!Number.isFinite(time)||!Number.isFinite(capture))throw Error('INVALID_SOURCE_ID_OR_DATE');
  const key=player+':'+game;if(seen.has(key))throw Error('DUPLICATE_PLAYER_GAME');seen.add(key);
  const rows=players.get(player)??[];rows.push(f);players.set(player,rows);
 }
 const examples=[];
 for(const [player,rows] of players){
  rows.sort((a,b)=>ms(a.game_datetime)-ms(b.game_datetime)||Number(a.provider_game_id)-Number(b.provider_game_id));
  for(const current of rows){
   if(current.projection_eligible!==true)continue;
   const cutoff=ms(current.game_datetime)-cutoffLeadMinutes*60000;
   const prior=rows.filter(f=>f.projection_eligible===true&&ms(f.game_datetime)<ms(current.game_datetime)&&
    (mode==='RETROSPECTIVE_RECONSTRUCTED'||ms(f.source_captured_at)<=cutoff));
   if(prior.length<10)continue;
   for(const [market,stat] of Object.entries(STATS)){
    const actual=n(current[stat]);if(actual===null||!Number.isFinite(actual))continue;
    const predictions={};
    for(const formula of CANDIDATES){
     const value=estimate(prior,stat,formula);predictions[formula]=value===null?null:round(Math.max(0,value));
    }
    if(predictions.L10===null)continue;
    examples.push({playerId:player,gameId:Number(current.provider_game_id),
     day:new Date(ms(current.game_datetime)).toISOString().slice(0,10),market,actual,
     mode,priorGames:prior.length,predictions});
   }
  }
 }
 return examples.sort((a,b)=>a.day.localeCompare(b.day)||a.gameId-b.gameId||a.playerId-b.playerId||a.market.localeCompare(b.market));
}
function score(xs,formula){
 const usable=xs.filter(x=>x.predictions?.[formula]!==null&&Number.isFinite(x.predictions?.[formula]));
 if(!usable.length)return {n:0,games:0,mae:null,rmse:null,bias:null};
 const errors=usable.map(x=>x.predictions[formula]-x.actual);
 return {n:usable.length,games:new Set(usable.map(x=>x.gameId)).size,
  mae:round(average(errors.map(Math.abs))),rmse:round(Math.sqrt(average(errors.map(e=>e*e)))),bias:round(average(errors))};
}
export function evaluateV2(examples,{mode='RETROSPECTIVE_RECONSTRUCTED',trainFrom='2026-11-08',trainThrough='2026-11-12',
 holdoutFrom='2026-11-13',holdoutThrough='2026-11-15',minTrain=50,minHoldout=50}={}){
 if(trainThrough>=holdoutFrom||!['RETROSPECTIVE_RECONSTRUCTED','PROSPECTIVE_ASOF_VERIFIED'].includes(mode))throw Error('INVALID_CHRONOLOGY');
 const reports=[];
 for(const market of Object.keys(STATS)){
  const marketRows=examples.filter(e=>e.market===market&&e.mode===mode);
  const train=marketRows.filter(e=>e.day>=trainFrom&&e.day<=trainThrough);
  const holdout=marketRows.filter(e=>e.day>=holdoutFrom&&e.day<=holdoutThrough);
  const trainScores=CANDIDATES.map(formula=>({formula,metrics:score(train,formula)}));
  const fullyComparable=trainScores.filter(x=>x.metrics.n===train.length&&train.length>=minTrain);
  fullyComparable.sort((a,b)=>{const diff=a.metrics.mae-b.metrics.mae;return Math.abs(diff)>1e-8?diff:CANDIDATES.indexOf(a.formula)-CANDIDATES.indexOf(b.formula);});
  const selected=fullyComparable[0]??null;
  const baseline=score(holdout,'L10'),choice=selected?score(holdout,selected.formula):null;
  const sufficient=Boolean(selected)&&holdout.length>=minHoldout&&baseline.games>=10&&choice?.n===holdout.length;
  reports.push({market,version:NBA_FORMULA_LAB_V2,mode,
   trainRows:train.length,trainGames:new Set(train.map(x=>x.gameId)).size,
   holdoutRows:holdout.length,holdoutGames:baseline.games,candidatesTried:CANDIDATES.length,trainScores,
   selectedFormula:sufficient?selected.formula:null,trainSelectedMae:sufficient?selected.metrics.mae:null,
   holdoutBaseline:baseline,holdoutSelected:sufficient?choice:null,
   holdoutMaeDeltaVsL10:sufficient?round(baseline.mae-choice.mae):null,
   status:sufficient?'EXPLORATORY_RECONSTRUCTED_FORMULA_CANDIDATE':'INSUFFICIENT_COMPARABLE_SAMPLE',
   productionEligible:false,certified:false,
   caveat:'Historical reconstructed backtest, same already inspected date window; cannot certify an independent holdout, ROI, or performance on future games.'});
 }
 return reports;
}
