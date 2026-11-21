import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {challengeStage,expectedValue,evaluateProbabilityCohort,researchDecision} from '../src/lib/nba/decision-probability-v2.mjs';
import {residualForecast,fitErrors} from '../src/lib/nba/decision-residual-v2.mjs';
import {planProbabilityFreeze,previewProbabilityBoard,settleProbabilityFreeze} from '../src/lib/nba/decision-shadow-v2.mjs';
import {verifiedPrices} from '../scripts/research/nba-v2/archive.mjs';
import {score} from '../scripts/research/nba-v2/scoring.mjs';
const load=k=>JSON.parse(readFileSync(new URL('../docs/research/nba-v2/'+k+'.json',import.meta.url),'utf8'));
const ledger=load('forward-20261120'),model=load('model'),f=ledger.rows[0];
const candidate={...f,dataQuality:'VALIDATED',quoteId:'quote',americanOdds:-160,probability:.74,
  contextVerified:true,regionalExecutionVerified:true,evLower95:.02};
const review={validationStatus:'VALIDATED_INDEPENDENT_HOLDOUT',trainGames:100,holdoutGames:100,
  separateProspective:true,humanReviewed:true,calibrationPassed:true,modelHash:f.modelHash,modelVersion:f.modelVersion,scope:f.scope};
const when=f.frozenAt;
test('settled training labels and holdout decisions must respect the two clocks',()=>{
 const a={...f,result:'win',outcomeAt:'2026-12-01T16:00:00Z'};
 const split={trainBefore:'2026-11-22T00:00:00Z',holdoutFrom:'2026-11-29T00:00:00Z'};
 const b={...a,gameId:99,forecastId:'b',gameStartAt:'2026-11-30T00:00:00Z'};
 const r=evaluateProbabilityCohort([a,b],split);
 assert.equal(r.models[0].excludedGapContracts,2);
 assert.equal(r.models[0].trainGames+r.models[0].holdoutGames,0);
 assert.equal(evaluateProbabilityCohort([{...a,featuresAsOf:a.outcomeAt}],split).acceptedContracts,0);
});
test('duplicates, conflicting receipts, mismatched game clocks and different statistics',()=>{
 const a={...f,result:'win',outcomeAt:'2026-11-22T00:00:00Z'};
 const opts={trainBefore:'2026-11-24T00:00:00Z',holdoutFrom:'2026-11-29T00:00:00Z'};
 const evalRows=rows=>evaluateProbabilityCohort(rows,opts);
 assert.equal(evalRows([a,structuredClone(a)]).acceptedContracts,1);
 assert.equal(evalRows([a,{...a,result:'loss'}]).acceptedContracts,0);
 assert.equal(evalRows([a,{...a,forecastId:'other',gameStartAt:'2026-11-21T09:00:00Z'}]).acceptedContracts,0);
 assert.equal(evalRows(['points','assists'].map(statistic=>({...a,forecastId:statistic,market:'props',statistic}))).models.length,2);
});
test('returns pushes as returned stake and never treats an incomplete contract as ready',()=>{
 assert.equal(expectedValue(.6,-120,.2),.08);
 assert.equal(expectedValue(.6,-120,1),0);
 assert.equal(researchDecision({...candidate,probability:.51},review,when).classification,'PASAR');
 assert.equal(researchDecision({...candidate,line:10,pushProbability:undefined},review,when).reason,'PUSH_MODEL_UNAVAILABLE');
 assert.equal(researchDecision(null,review,when).classification,'SIN DATOS');
 for(const patch of [{quoteId:null},{regionalExecutionVerified:false},{contextVerified:false},{evLower95:-.1},{expiresAt:when}]){
  assert.equal(researchDecision({...candidate,...patch},review,when).reason,'PROBABILITY_NOT_VALIDATED');
 }
 assert.equal(researchDecision(candidate,{...review,scope:'other'},when).reason,'PROBABILITY_NOT_VALIDATED');
});
test('Challenge separates probability and EV, prioritizes price band and can never place a play',()=>{
 const c=(id,odds,p)=>({candidate:{...candidate,forecastId:id,americanOdds:odds,probability:p},validation:review});
 const rows=[c('likely',-200,.78),c('value',-110,.70),c('exception',-260,.88)];
 const r=challengeStage(rows,when,{allowExceptional:true});
 assert.equal(r.highestProbability.forecastId,'likely');assert.equal(r.highestEv.forecastId,'value');assert.equal(r.selection,null);
 assert.equal(challengeStage([rows[2]],when).highestEv,null);
 assert.equal(challengeStage([rows[2]],when,{allowExceptional:true}).highestEv.forecastId,'exception');
 assert.equal(challengeStage([c('too-expensive',-301,.9)],when,{allowExceptional:true}).highestProbability,null);
});
test('original pair binds both sides, reciprocal lines, exact price, original tip and settlement',()=>{
 const game=['g','s',10000,'h','a',105,101], by=new Map([['g',game]]);
 const bound=['g','spread','H','H','A',-3.5,-110,6000,6400,'win'];
 const pair=['o','H','A',10600,6000,'spread',[['H',-3.5,-110],['A',3.5,-110]]];
 const n=(bindings,pairs)=>verifiedPrices(bindings,pairs,by).usable.size;
 assert.equal(n([bound],[pair]),1);
 for(const bad of [[...pair.slice(0,6),[['H',-3.5,-110],['A',-3.5,-110]]],
  [...pair.slice(0,3),9900,...pair.slice(4)],[...pair.slice(0,3),12000,...pair.slice(4)]])assert.equal(n([bound],[bad]),0);
 assert.equal(n([bound],[pair,pair]),0);
 assert.equal(n([[...bound.slice(0,9),'loss']],[pair]),0);
 assert.equal(n([[...bound.slice(0,7),7000,...bound.slice(8)]],[pair]),0);
});
test('residual model respects independent games and discrete lines',()=>{
 const rows=Array.from({length:100},(_,game)=>({game,mu:10,y:game%10+5}));
 assert.equal(fitErrors(Array(120).fill(rows[0])),null);
 const fit=fitErrors(rows);
 for(const method of ['logistic','empirical']){
  assert.equal(residualForecast(fit,method,1,10,10.5).pushProbability,0);
  assert.ok(residualForecast(fit,method,1,10,10).pushProbability>0);
  assert.equal(residualForecast(fit,method,1,10,0,{noDraw:true}).pushProbability,0);
  assert.equal(residualForecast(fit,method,1,null,10),null);
 }
});
test('game weights, refunded stakes and calibration bins share explicit denominators',()=>{
 const row={game:1,y:2,line:1,p:.6,push:0,mu:2,odds:100};
 const s=score([row,{...row,y:0},{...row,game:2},{...row,game:3,y:1}],false);
 assert.equal(s.games,3);assert.equal(s.binaryGames,2);assert.equal(s.pushes,1);
 assert.ok(Math.abs(s.brier-.21)<1e-12);assert.equal(s.simulatedRoi,1/3);
 assert.equal(s.calibrationBins[0].mass,2);
});
test('published forward batch pins model, pre-tip receipts and distinct hypotheses',()=>{
 assert.equal(ledger.modelHash,createHash('sha256').update(JSON.stringify(model)).digest('hex'));
 assert.equal(ledger.rows.length,15);assert.equal(new Set(ledger.rows.map(r=>r.gameId)).size,3);
 assert.equal(new Set(ledger.rows.map(r=>r.forecastId)).size,15);
 for(const r of ledger.rows){
  assert.ok(Date.parse(r.frozenAt)<Date.parse(r.gameStartAt));
  assert.ok(Date.parse(r.capturedAt)<=Date.parse(r.featuresAsOf));
  assert.equal(r.regionalExecutionVerified,false); assert.equal(r.classification,'VIGILAR');
 }
});
function input(){
 const h={status:'VALIDATED',issues:[],required:10,cutoff:f.featuresAsOf,
   included:Array.from({length:10},(_,i)=>({id:100+i,date:'2026-11-01T01:00:00Z'}))};
 const row={id:'receipt',gameId:f.gameId,startsAt:f.gameStartAt,quoteId:f.quoteId,market:'total',period:f.period,
   selection:'Over',odds:f.americanOdds,line:f.line,projection:f.projection,sample:10,historyKey:'teams',
   dataQuality:f.quality,quoteFreshness:'RECENT',capturedAt:f.capturedAt};
 return {asOf:f.featuresAsOf,version:'board',day:f.gameDay,games:[{id:f.gameId,startsAt:f.gameStartAt,status:'scheduled'}],
   rows:{periods:[row]},preferredRows:{periods:[row]},top25:[row],historyEvidence:{teams:{home:h,away:h}}};
}
test('shadow freezes a complete receipt and suppresses stale, ambiguous, incomplete and future versions',()=>{
 const b=input(), row=b.rows.periods[0];
 const snapshot=JSON.stringify(b);
 const plan=planProbabilityFreeze(b,model,when);assert.equal(plan.rows.length,1);
 assert.equal(previewProbabilityBoard(b,plan).top25[0].shadowProbability.forecastId,plan.rows[0].forecastId);
 assert.equal(JSON.stringify(b),snapshot);
 assert.equal(previewProbabilityBoard({...b,asOf:when},plan).top25[0].shadowProbability,undefined);
 assert.throws(()=>planProbabilityFreeze(b,model,f.gameStartAt),/INVALID_FREEZE/);
 assert.equal(planProbabilityFreeze({...b,rows:{periods:[row,row]}},model,when).rows.length,0);
 b.historyEvidence.teams.home={...b.historyEvidence.teams.home,status:'INCOMPLETE_HISTORY'};
 assert.equal(planProbabilityFreeze(b,model,when).rows.length,0);
 assert.equal(settleProbabilityFreeze(f,{sourceReceivedAt:when}),null);
});
import {evaluateForward} from '../scripts/research/nba-v2/forward-metrics.mjs';
test('forward report counts the first freeze once and quarantines corrected settlement conflicts',()=>{
 const m={holdoutFrom:'2026-11-21T01:57:07Z',asOf:'2026-11-22T15:00:00Z'};
 const batch={modelHash:ledger.modelHash,checkedAt:m.asOf,pending:[],outcomes:[{
   forecastId:f.forecastId,actual:f.line+1,result:'win',snapshotId:'test-final',scope:'STATISTICAL_SETTLEMENT',outcomeAt:'2026-11-21T08:00:00Z'}]};
 const report=(settlements)=>evaluateForward(model,[ledger,ledger],settlements,m).find(r=>r.scope===f.scope);
 assert.equal(report([]).scheduledGames,3);
 assert.equal(report([batch,batch]).settledIndependentGames,1);
 const alt={...batch,outcomes:[{...batch.outcomes[0],actual:f.line-1,result:'loss'}]};
 assert.equal(report([batch,alt]).disputed,1);
 assert.equal(report([batch,alt]).settledIndependentGames,0);
 assert.equal(report([]).approvedForBetting,false);
});
test('reconciled period finals settle separately, keep push, and never change the forecast',()=>{
 const f1={...f,period:'q1',market:'total',side:'over',line:52};
 const game={id:f1.gameId,date:f1.gameDay,datetime:f1.gameStartAt,status_state:'final',period:4,
   home_team_score:100,visitor_team_score:98,home_q1:26,visitor_q1:26,home_q2:24,visitor_q2:24,
   home_q3:25,visitor_q3:23,home_q4:25,visitor_q4:25};
 const before=JSON.stringify(f1);
 const receipt={game,sourceReceivedAt:'2026-11-21T07:00:00Z'};
 assert.equal(settleProbabilityFreeze(f1,receipt).result,'push');
 assert.equal(settleProbabilityFreeze(f1,{...receipt,game:{...game,visitor_team_score:99}}),null);
 assert.equal(JSON.stringify(f1),before);
});
