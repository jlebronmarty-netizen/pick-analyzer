import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
 buildNbaVersionReport,nbaCalibrationGroups,nbaProbabilityFraction,nbaVersionAuditEvidence,
} from '../src/lib/nba/model-version-evidence.ts';
import {displayedModelTotal} from '../src/lib/sport-model-overview.ts';
import SportModelOverview from '../src/components/dashboard/SportModelOverview.tsx';
import {PredictionCard} from '../src/components/dashboard/NbaPredictionEnginePanel.tsx';

// All service reads below are intercepted. No database, provider or production IO.
process.env.NEXT_PUBLIC_SUPABASE_URL='https://nba-version-tests.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='local-test-key';
const {supabaseAdmin:db}=await import('../src/lib/supabase-admin.ts');
const {evaluateNbaVersionGroups}=await import('../src/services/multisport-learning-evaluator.service.ts');
const {nbaVersionLearningOverview,getMultisportLearningOverview}=await import('../src/services/multisport-learning-overview.service.ts');
const {getNbaGoatModelReport,getNbaGoatModelCard}=await import('../src/services/nba-goat-model-read.service.ts');
const {getNbaPredictionPerformance,getNbaModelHealthV2,getNbaSettlementBacklog,settleNbaPredictions,settleNbaPredictionsByIds}=await import('../src/services/nba-prediction-settlement.service.ts');

const historical='nba_prediction_engine_v1',corrected='nba_prediction_engine_v1_1_inputs_shadow';
function row(id,extra={}) {
 return {id,sport_key:'basketball_nba',game_id:'game-1',model_version:historical,market:'moneyline',result:'win',model_probability:88,
  generated_at:'2026-11-20T16:00:00Z',created_at:'2026-11-20T16:00:01Z',commence_time:'2026-11-20T20:00:00Z',settled_at:'2026-11-20T23:00:00Z',
  recommended_pick:false,production_eligible:false,prediction_origin:'CURRENT_ERA_SHADOW',home_team:'Home',away_team:'Away',team:'Home',selection:'Home',line:null,
  sportsbook:'FanDuel',odds:-130,implied_probability:56.52,edge:31.48,ev:55.69,confidence:70,
  feature_snapshot:{goatProviderPolicy:'NBA_GOAT_ARCHIVE_SHADOW_V1'},...extra};
}
const twoVersions=()=>[
 row('old-ml'),row('old-spread',{market:'spread',result:'loss'}),
 row('new-ml',{model_version:corrected,result:'loss',model_probability:61,generated_at:'2026-11-20T17:00:00Z',created_at:'2026-11-20T17:00:01Z'}),
 row('new-spread',{model_version:corrected,market:'spread',result:'win',model_probability:61,generated_at:'2026-11-20T17:00:00Z',created_at:'2026-11-20T17:00:01Z'}),
];
function mockReads(data) {
 const original=db.from,reads=[];
 db.from=table=>{
  reads.push(table);
  const response={data:data[table]??[],error:null};
  const query=new Proxy({}, {get:(_target,key)=>key==='then'?resolve=>Promise.resolve(response).then(resolve):()=>query});
  return query;
 };
 return {reads,restore:()=>{db.from=original;}};
}

test('two NBA versions retain separate market results and immutable original rows',()=>{
 const input=twoVersions(),before=JSON.stringify(input),report=buildNbaVersionReport(input);
 assert.equal(report.models,2);assert.equal(report.selectedModelVersion,corrected);
 assert.equal(report.rows.length,2);assert.ok(report.rows.every(row=>row.model_version===corrected));
 assert.equal(report.metrics.find(metric=>metric.market==='moneyline').accuracy,0);
 assert.equal(report.versions.find(version=>version.modelVersion===historical).metrics.find(metric=>metric.market==='moneyline').accuracy,1);
 assert.deepEqual(report.allVersionsTotal,{rows:4,uniqueGames:1,models:2});
 assert.equal(report.aggregationScope,'SELECTED_MODEL_VERSION');assert.equal(report.probabilityStatus,'EXPLORATORY_UNVALIDATED');
 assert.equal(JSON.stringify(input),before);
});

test('missing version or unsafe official-pick flags cannot silently enter a research cohort',()=>{
 for(const extra of [{model_version:null},{model_version:''}])assert.throws(()=>buildNbaVersionReport([row('bad',extra)]),/MODEL_VERSION_MISSING/);
 for(const extra of [{recommended_pick:true},{production_eligible:true},{recommended_pick:null},{market:'props'}])assert.throws(()=>buildNbaVersionReport([row('bad',extra)]),/INTEGRITY_FAILED/);
});

test('NBA probability normalization uses the documented percent unit, never a magnitude heuristic',()=>{
 assert.equal(nbaProbabilityFraction(88),.88);assert.equal(nbaProbabilityFraction(.88),.0088);
 for(const value of [null,undefined,'88',0,100,101,-5,NaN,Infinity])assert.equal(nbaProbabilityFraction(value),null);
 const [group]=nbaCalibrationGroups([row('valid')]);
 assert.equal(group.records[0].p,.88);assert.equal(group.sourceProbabilityUnit,'PERCENT_0_100');
 assert.equal(group.evaluationProbabilityUnit,'FRACTION_0_1');
});

test('independent games are counted within a version and market, never as all contracts',()=>{
 const input=twoVersions();for(let index=0;index<100;index++)input.push(row('repeat-'+index,{generated_at:'2026-11-20T18:00:00Z',created_at:'2026-11-20T18:00:01Z'}));
 const groups=nbaCalibrationGroups(input),ml=groups.find(group=>group.modelVersion===historical&&group.market==='moneyline');
 assert.equal(groups.length,4);assert.equal(ml.independentGames,1);assert.equal(ml.duplicateRowsExcluded,100);
 assert.ok(evaluateNbaVersionGroups(input).every(evaluation=>evaluation.state==='INSUFFICIENT_SAMPLE'&&evaluation.records===1));
 const overview=nbaVersionLearningOverview(input);assert.equal(overview.length,4);assert.ok(overview.every(item=>item.settled===1));
});

test('first frozen pending, push, invalid probability or loss is never replaced with a later winner',()=>{
 for(const first of [{result:'pending',settled_at:null},{result:'push'},{model_probability:null}]){
  const group=nbaCalibrationGroups([row('first',first),row('later',{result:'win',generated_at:'2026-11-20T17:00:00Z',created_at:'2026-11-20T17:00:01Z'})])[0];
  assert.equal(group.records.length,0);assert.equal(group.duplicateRowsExcluded,1);
 }
 const group=nbaCalibrationGroups([row('first',{result:'loss'}),row('later',{generated_at:'2026-11-20T17:00:00Z',created_at:'2026-11-20T17:00:01Z'})])[0];
 assert.equal(group.records.length,1);assert.equal(group.records[0].y,0);
});

test('post-start receipt, missing freeze and settlement-before-game are excluded with explicit reasons',()=>{
 const input=[row('valid',{game_id:'valid'}),row('late',{game_id:'late',created_at:'2026-11-20T20:00:00Z'}),row('missing',{game_id:'missing',generated_at:null}),row('early-outcome',{game_id:'early',settled_at:'2026-11-20T19:59:00Z'})];
 const group=nbaCalibrationGroups(input)[0];
 assert.equal(group.independentGames,1);assert.equal(group.invalidRowsExcluded,3);
 assert.deepEqual(group.exclusionReasons,{UNVERIFIED_PREGAME_FREEZE:2,UNVERIFIED_SETTLEMENT_RECEIPT:1});
});

test('an ambiguous first receipt blocks that game instead of falling back to a later winning row',()=>{
 const [group]=nbaCalibrationGroups([row('unknown-freeze',{generated_at:null}),row('later',{generated_at:'2026-11-20T17:00:00Z',created_at:'2026-11-20T17:00:01Z'})]);
 assert.equal(group.records.length,0);assert.equal(group.invalidRowsExcluded,2);
 assert.deepEqual(group.exclusionReasons,{UNVERIFIED_PREGAME_FREEZE:1,AMBIGUOUS_FIRST_FREEZE:1});
});

test('100 independent NBA games can suggest retrospective calibration but cannot validate a candidate',()=>{
 const input=Array.from({length:100},(_,index)=>{
  const start=Date.UTC(2026,0,1+index,20);
  return row('game-'+index,{game_id:'game-'+index,model_probability:80,result:index%10<9?'win':'loss',
   commence_time:new Date(start).toISOString(),generated_at:new Date(start-7200000).toISOString(),
   created_at:new Date(start-7199000).toISOString(),settled_at:new Date(start+10800000).toISOString()});
 });
 const [evaluation]=evaluateNbaVersionGroups(input);
 assert.equal(evaluation.independentGames,100);assert.equal(evaluation.alpha,1.3);
 assert.ok(evaluation.baseline.validation.brier-evaluation.challenger.validation.brier>.003);
 assert.ok(evaluation.baseline.holdout.brier-evaluation.challenger.holdout.brier>.003);
 assert.equal(evaluation.state,'CHALLENGER_TEST');assert.equal(evaluation.prospectiveHoldoutVerified,false);
 assert.equal(evaluation.validationScope,'RETROSPECTIVE_EXPLORATORY');
});

test('audit intervals and calibration use one frozen contract per game within each version',()=>{
 const input=twoVersions();input.push(row('old-repeat',{result:'loss',model_probability:50,generated_at:'2026-11-20T18:00:00Z',created_at:'2026-11-20T18:00:01Z'}));
 const versions=nbaVersionAuditEvidence(input),old=versions.find(group=>group.modelVersion===historical),updated=versions.find(group=>group.modelVersion===corrected);
 assert.equal(old.calibrationAudit.observedMoneylineAccuracy,1);assert.equal(updated.calibrationAudit.observedMoneylineAccuracy,0);
 assert.equal(old.calibrationAudit.moneylineSettled,1);assert.equal(old.calibrationAudit.moneylineContractRows,2);
 assert.equal(old.calibrationAudit.moneylineWilson95.sample,1);assert.equal(old.byMarket[0].duplicateRowsExcluded,1);
 assert.deepEqual(old.calibrationAudit.distinctMoneylineProbabilities,[88]);assert.deepEqual(updated.calibrationAudit.distinctMoneylineProbabilities,[61]);
});

test('read service exposes both versions, card counts two, and neither is pooled in the homepage helper',async()=>{
 const mock=mockReads({prediction_history:twoVersions()});
 try{
  const report=await getNbaGoatModelReport(),card=await getNbaGoatModelCard();
  assert.equal(report.models,2);assert.equal(card.models,2);assert.equal(card.cohorts.length,2);
  assert.equal(card.cohorts[0].modelVersion,corrected);assert.ok(card.cohorts.every(cohort=>cohort.models===1));
  assert.equal(displayedModelTotal(card.cohorts).reason,'MODEL_VERSIONS_NOT_POOLED');
  const html=renderToStaticMarkup(React.createElement(SportModelOverview,{cards:[card]}));
  for(const text of [historical,corrected,'2 versiones separadas','historial separado','0.00%','100.00%'])assert.ok(html.includes(text),text);
  assert.ok(mock.reads.every(table=>table==='prediction_history'));
 }finally{mock.restore();}
});

test('legacy aggregate NBA candidate cannot mark either version validated or create an alert',async()=>{
 const mock=mockReads({prediction_history:twoVersions(),model_learning_candidates_v1:[
  {sport:'NBA',model_version:'NBA GOAT',title:'Legacy aggregate',state:'VALIDATED_CANDIDATE',reason:'Old retrospective split',validation_sample:100,holdout_sample:100},
 ]});
 try{
  const overview=await getMultisportLearningOverview(),nba=overview.sports.filter(sport=>sport.sport==='NBA');
  assert.equal(nba.length,4);assert.ok(nba.every(sport=>sport.state!=='VALIDATED_CANDIDATE'&&sport.candidate===null));
  assert.equal(overview.alerts.length,0);assert.equal(overview.candidates[0].stored_state,'VALIDATED_CANDIDATE');
  assert.equal(overview.candidates[0].state,'CHALLENGER_TEST');
 }finally{mock.restore();}
});

test('version aggregation guard leaves unrelated sport accounting compatible',()=>{
 const cohort={key:'MLB',label:'MLB',available:true,wins:9,losses:1,pending:2,pushes:0,voids:0,models:2,accuracy:.9,note:''};
 const result=displayedModelTotal([cohort,{...cohort,key:'NHL',wins:1,losses:1}]);
 assert.equal(result.available,true);assert.equal(result.wins,10);assert.equal(result.losses,2);assert.equal(result.accuracy,10/12);
});

function mockLegacyStorage(predictions) {
 const original=db.from,writes=[],reads=[],tables={prediction_history:structuredClone(predictions),sport_game_stats:[],
  sport_events:[{id:'game-1',sport_key:'basketball_nba',status:'completed',home_team:'Home',away_team:'Away',home_score:100,away_score:90,start_time:'2026-11-20T20:00:00Z',period_scores:null}]};
 db.from=table=>{
  const filters=[];let patch=null;
  const query=new Proxy({}, {get:(_target,key)=>{
   if(key==='then')return resolve=>{
    const selected=(tables[table]??[]).filter(row=>filters.every(filter=>filter(row)));
    if(patch){for(const row of selected){writes.push({table,id:row.id,patch});Object.assign(row,patch);}}
    else reads.push({table,ids:selected.map(row=>row.id)});
    return Promise.resolve({data:patch?null:selected,error:null}).then(resolve);
   };
   return (...args)=>{
    if(key==='eq')filters.push(row=>row[args[0]]===args[1]);
    if(key==='in')filters.push(row=>args[1].includes(row[args[0]]));
    if(key==='or'&&String(args[0]).includes('result.is.null'))filters.push(row=>row.result==null||row.result==='pending'||row.status==='pending');
    if(key==='update')patch=args[0];
    if(['insert','upsert','delete'].includes(String(key)))throw Error('UNEXPECTED_WRITE_METHOD');
    return query;
   };
  }});
  return query;
 };
 return {tables,writes,reads,restore:()=>{db.from=original;}};
}
const legacyRow=(id,extra={})=>row(id,{status:'win',lifecycle_status:'settled',manual_adjustment:false,stake:100,profit:76.92,...extra});

test('legacy performance/health exclude the corrected version and distinguish different lines',async()=>{
 const mock=mockLegacyStorage([
  legacyRow('legacy-ml'),legacyRow('legacy-spread-a',{market:'spread',line:1.5,result:'loss',status:'loss',profit:-100}),
  legacyRow('legacy-spread-b',{market:'spread',line:2.5,result:'pending',status:'pending',lifecycle_status:'active',settled_at:null}),
  legacyRow('corrected',{model_version:corrected,result:'pending',status:'pending',lifecycle_status:'active',settled_at:null}),
  legacyRow('unversioned',{model_version:null}),
 ]);
 try{
  const performance=await getNbaPredictionPerformance(),health=await getNbaModelHealthV2();
  assert.equal(performance.modelVersion,historical);assert.equal(performance.scope,'LEGACY_MODEL_VERSION_ONLY');
  assert.equal(performance.overall.total,3);assert.equal(performance.overall.wins,1);assert.equal(performance.uniqueGames,1);
  assert.equal(health.modelVersion,historical);assert.equal(health.checks.totalPredictions,3);
  assert.equal(health.checks.duplicateKeys,0);assert.equal(health.checks.settlementBacklog,1);
  assert.ok(mock.reads.filter(read=>read.table==='prediction_history').every(read=>!read.ids.includes('corrected')&&!read.ids.includes('unversioned')));
  const all=await getNbaSettlementBacklog();assert.equal(all.scope,'ALL_STORED_NBA_VERSIONS');assert.equal(all.count,2);
  mock.tables.prediction_history.push(legacyRow('genuine-duplicate',{market:'spread',line:1.5}));
  assert.equal((await getNbaModelHealthV2()).checks.duplicateKeys,1);
  assert.deepEqual(mock.writes,[]);
 }finally{mock.restore();}
});

test('generic and bounded settlement skip corrected SHADOW, retain null-version legacy, and never regrade a final',async()=>{
 for(const bounded of [false,true]){
  const input=[legacyRow('legacy-open',{result:'pending',status:'pending',lifecycle_status:'active',settled_at:null,profit:null}),
   legacyRow('legacy-null',{model_version:null,result:'pending',status:'pending',lifecycle_status:'active',settled_at:null,profit:null}),
   legacyRow('legacy-final',{profit:12.34}),
   legacyRow('corrected-open',{model_version:corrected,result:'pending',status:'pending',lifecycle_status:'active',settled_at:null,profit:null})];
  const mock=mockLegacyStorage(input),frozenNew=JSON.stringify(mock.tables.prediction_history[3]),frozenFinal=JSON.stringify(mock.tables.prediction_history[2]);
  try{
   const result=bounded?await settleNbaPredictionsByIds(input.map(row=>row.id)):await settleNbaPredictions();
   assert.equal(result.settled,2);assert.deepEqual(mock.writes.map(write=>write.id).sort(),['legacy-null','legacy-open']);
   assert.equal(JSON.stringify(mock.tables.prediction_history[3]),frozenNew);
   assert.equal(JSON.stringify(mock.tables.prediction_history[2]),frozenFinal);
   assert.equal(mock.tables.prediction_history[0].result,'win');assert.equal(mock.tables.prediction_history[1].result,'win');
  }finally{mock.restore();}
 }
});

test('prediction card labels unvalidated probability and EV without a certified recommendation',()=>{
 const prediction={id:'shadow',market:'moneyline',team:'Home',opponent:'Away',sportsbook:'FanDuel',odds:-130,
  modelProbability:61,ev:7.92,edge:4.48,confidence:70,adaptiveScore:60,riskGrade:'RESEARCH',recommendedPick:false,
  probabilityStatus:'EXPLORATORY_UNVALIDATED',modelVersion:corrected};
 for(const props of [{prediction},{prediction:{...prediction,probabilityStatus:undefined},exploratory:true}]){
  const html=renderToStaticMarkup(React.createElement(PredictionCard,props));
  for(const text of ['Prob. exploratoria','EV exploratorio','precio archivado','JUGADA bloqueada','4.48 pp'])assert.ok(html.includes(text),text);
 }
});
