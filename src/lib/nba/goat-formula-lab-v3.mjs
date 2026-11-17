// NBA GOAT Formula Lab V3: robust distribution candidates, minute trends, game-cluster uncertainty.
// Research only; never generates a bet, official model, calibrated probability, ROI, or EV.
export const VERSION='NBA_GOAT_FORMULA_LAB_V3_RESEARCH_ONLY';
export const STAT_MAP=Object.freeze({points:'pts',rebounds:'reb',assists:'ast',threes:'fg3m'});
export const FORMULAS=Object.freeze([
 'L10','L5','MED10','MED5','Q35','Q40','Q45','Q60',
 'EWMA25','EWMA45','EWMA65','EWMA85',
 'MEAN_MED10_25','MEAN_MED10_50','MEAN_MED10_75','MEAN_MED5_50',
 'MEAN_Q35_50','MEAN_Q40_50','MEAN_Q45_50',
 'L10_MINUTE_RATIO_HALF','MED10_MINUTE_RATIO_HALF','MEAN_MED10_50_MINUTE_RATIO_HALF'
]);
const time=x=>Date.parse(String(x??''));
const good=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const avg=a=>a.reduce((sum,n)=>sum+n,0)/a.length;
const round=x=>Number(x.toFixed(6));
export function quantile(values,q){
 if(!values.length||q<0||q>1)throw Error('INVALID_QUANTILE');
 const sorted=[...values].sort((a,b)=>a-b),index=q*(sorted.length-1),lo=Math.floor(index),hi=Math.ceil(index);
 return sorted[lo]+(sorted[hi]-sorted[lo])*(index-lo);
}
export function formulaValues(prior,stat){
 if(!Array.isArray(prior)||prior.length!==10||prior.some(x=>!good(x[stat])||!good(x.minutes_played)||Number(x.minutes_played)<10))return null;
 const vals=prior.map(x=>Number(x[stat])),mins=prior.map(x=>Number(x.minutes_played));
 const l10=avg(vals),l5=avg(vals.slice(-5)),med10=quantile(vals,.5),med5=quantile(vals.slice(-5),.5);
 const ewma=(decay)=>{let sum=0,n=0;for(let i=0;i<10;i++){const w=Math.pow(decay,9-i);sum+=vals[i]*w;n+=w;}return sum/n};
 const ratio=Math.sqrt(avg(mins.slice(-5))/avg(mins));
 const out={
  L10:l10,L5:l5,MED10:med10,MED5:med5,Q35:quantile(vals,.35),Q40:quantile(vals,.4),Q45:quantile(vals,.45),Q60:quantile(vals,.6),
  EWMA25:ewma(.75),EWMA45:ewma(.55),EWMA65:ewma(.35),EWMA85:ewma(.15),
  MEAN_MED10_25:.75*l10+.25*med10,MEAN_MED10_50:.5*l10+.5*med10,MEAN_MED10_75:.25*l10+.75*med10,
  MEAN_MED5_50:.5*l10+.5*med5,
  MEAN_Q35_50:.5*l10+.5*quantile(vals,.35),
  MEAN_Q40_50:.5*l10+.5*quantile(vals,.4),
  MEAN_Q45_50:.5*l10+.5*quantile(vals,.45),
  L10_MINUTE_RATIO_HALF:l10*ratio,MED10_MINUTE_RATIO_HALF:med10*ratio,
  MEAN_MED10_50_MINUTE_RATIO_HALF:(.5*l10+.5*med10)*ratio
 };
 return Object.fromEntries(FORMULAS.map(k=>[k,round(Math.max(0,out[k]))]));
}
export function buildV3Examples(facts,{mode='RETROSPECTIVE_RECONSTRUCTED',cutoffLeadMinutes=30}={}){
 if(!['RETROSPECTIVE_RECONSTRUCTED','PROSPECTIVE_ASOF_VERIFIED'].includes(mode)||cutoffLeadMinutes<10||cutoffLeadMinutes>180)throw Error('INVALID_EXPERIMENT_CONFIG');
 const seen=new Set(),players=new Map();
 for(const f of facts){
  const player=Number(f.player_id),game=Number(f.provider_game_id),at=time(f.game_datetime),captured=time(f.source_captured_at);
  if(!Number.isSafeInteger(player)||!Number.isSafeInteger(game)||!Number.isFinite(at)||!Number.isFinite(captured))throw Error('INVALID_GAME_FACT');
  const identity=player+':'+game;if(seen.has(identity))throw Error('DUPLICATE_FACT');seen.add(identity);
  const rows=players.get(player)??[];rows.push(f);players.set(player,rows);
 }
 const examples=[];
 for(const [player,rows] of players){
  rows.sort((a,b)=>time(a.game_datetime)-time(b.game_datetime)||Number(a.provider_game_id)-Number(b.provider_game_id));
  for(const current of rows){
   if(current.projection_eligible!==true)continue;
   const start=time(current.game_datetime),cutoff=start-cutoffLeadMinutes*60000;
   const prior=rows.filter(x=>x.projection_eligible===true&&time(x.game_datetime)<start&&
     (mode==='RETROSPECTIVE_RECONSTRUCTED'||time(x.source_captured_at)<=cutoff)).slice(-10);
   if(prior.length!==10)continue;
   for(const [market,stat] of Object.entries(STAT_MAP)){
    if(!good(current[stat]))continue;
    const predictions=formulaValues(prior,stat);
    if(!predictions)continue;
    examples.push({playerId:player,gameId:Number(current.provider_game_id),
      day:new Date(start).toISOString().slice(0,10),market,actual:Number(current[stat]),predictions,mode,
      latestFeatureCapture:new Date(Math.max(...prior.map(x=>time(x.source_captured_at)))).toISOString()});
   }
  }
 }
 return examples.sort((a,b)=>a.day.localeCompare(b.day)||a.gameId-b.gameId||a.playerId-b.playerId||a.market.localeCompare(b.market));
}
const score=(rows,formula)=>{
 const errors=rows.map(r=>r.predictions[formula]-r.actual);
 if(!errors.length)return {n:0,games:0,mae:null};
 return {n:errors.length,games:new Set(rows.map(r=>r.gameId)).size,mae:round(avg(errors.map(Math.abs)))};
};
// Deterministic game-cluster bootstrap; same game's players remain together.
export function gameClusterCI(rows,formula,baseline='L10',{iterations=2000,seed=87453}={}){
 if(!rows.length)return {nGames:0,pointDelta:null,ci95:null,positiveGames:0,negativeGames:0};
 if(!Number.isSafeInteger(iterations)||iterations<100||iterations>10000)throw Error('INVALID_BOOTSTRAP_BOUND');
 const games=new Map();
 for(const row of rows){
  const b=Math.abs(row.predictions[baseline]-row.actual),c=Math.abs(row.predictions[formula]-row.actual);
  const g=games.get(row.gameId)??{n:0,delta:0};g.n++;g.delta+=b-c;games.set(row.gameId,g);
 }
 const clusters=[...games.values()],total=clusters.reduce((a,x)=>a+x.delta,0),n=clusters.reduce((a,x)=>a+x.n,0);
 const pointDelta=total/n,sim=[];
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296};
 for(let i=0;i<iterations;i++){
  let numerator=0,denominator=0;
  for(let j=0;j<clusters.length;j++){
   const x=clusters[Math.floor(random()*clusters.length)];numerator+=x.delta;denominator+=x.n;
  }
  sim.push(numerator/denominator);
 }
 sim.sort((a,b)=>a-b);
 return {nGames:clusters.length,pointDelta:round(pointDelta),
  ci95:[round(sim[Math.floor(iterations*.025)]),round(sim[Math.floor(iterations*.975)])],
  positiveGames:clusters.filter(x=>x.delta>1e-9).length,negativeGames:clusters.filter(x=>x.delta < -1e-9).length};
}
export function evaluateV3(examples,{mode='RETROSPECTIVE_RECONSTRUCTED',
 trainFrom='2026-11-08',trainThrough='2026-11-12',
 testFrom='2026-11-13',testThrough='2026-11-15',minTrain=50,minTest=50}={}){
 if(trainThrough>=testFrom||!['RETROSPECTIVE_RECONSTRUCTED','PROSPECTIVE_ASOF_VERIFIED'].includes(mode))throw Error('INVALID_EVALUATION_SPLIT');
 return Object.keys(STAT_MAP).map(market=>{
  const matching=examples.filter(e=>e.market===market&&e.mode===mode);
  const train=matching.filter(e=>e.day>=trainFrom&&e.day<=trainThrough);
  const test=matching.filter(e=>e.day>=testFrom&&e.day<=testThrough);
  const trainScores=FORMULAS.map(formula=>({formula,...score(train,formula)}))
   .sort((a,b)=>Math.abs((a.mae??Infinity)-(b.mae??Infinity))>1e-8?a.mae-b.mae:FORMULAS.indexOf(a.formula)-FORMULAS.indexOf(b.formula));
  const selected=trainScores[0],baseline=score(test,'L10'),chosen=score(test,selected.formula);
  const enough=train.length>=minTrain&&test.length>=minTest&&baseline.games>=10;
  const cluster=enough?gameClusterCI(test,selected.formula):null;
  return {version:VERSION,market,mode,candidates:FORMULAS.length,trainRows:train.length,trainGames:new Set(train.map(x=>x.gameId)).size,
   testRows:test.length,testGames:baseline.games,selected:enough?selected.formula:null,
   trainSelectedMAE:enough?selected.mae:null,
   testBaselineMAE:baseline.mae,testSelectedMAE:enough?chosen.mae:null,
   gameClusterCI:cluster,status:!enough?'INSUFFICIENT_SAMPLE':
     cluster.pointDelta>0?'SMALL_RECONSTRUCTED_SIGNAL_UNCERTIFIED':'NO_RECONSTRUCTED_GAIN',
   productionEligible:false,validatedCandidate:false,holdoutCertified:false,
   caveat:'Previously inspected, reconstructed test interval is not independent untouched evidence; no ROI, picks, or claims of predictive edge.'};
 });
}
