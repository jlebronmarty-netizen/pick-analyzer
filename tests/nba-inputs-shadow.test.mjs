import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';

// Execute the real TypeScript functions with database boundaries replaced. No
// network, provider call, environment credentials or TypeScript loader is needed.
const nativeRequire=createRequire(import.meta.url);
function modules(overrides={}){
 const cache=new Map();
 function load(relative){
  const file=path.resolve(relative);if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const require=specifier=>{
   if(Object.hasOwn(overrides,specifier))return overrides[specifier];
   if(specifier.startsWith('node:')||specifier==='crypto')return nativeRequire(specifier);
   const target=specifier.startsWith('@/')?path.resolve('src',specifier.slice(2)):specifier.startsWith('.')?path.resolve(path.dirname(file),specifier):null;
   if(!target)throw Error('Unexpected dependency: '+specifier);
   return load(fs.existsSync(target)?target:target+'.ts');
  };
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,require,console,Date,Map,Set,JSON,process,URL},{filename:file});
  return module.exports;
 }
 return load;
}
const load=modules();
const core=load('src/lib/nba/prediction-inputs-shadow.ts');
const {buildNbaInputsShadowPredictions:build,NBA_INPUTS_SHADOW_MODEL_VERSION:VERSION,assertNbaInputsShadowPrediction:assertEvidence}=core;
const weights={homeAwayAdvantage:1.05,headToHeadAdvantage:1.15,pitcherAdvantage:1.45,injuryImpact:1.3,weatherImpact:.75};
const asOf='2026-11-21T23:00:00.000Z';
const event={id:'bdl_nba_21718199',sport_key:'basketball_nba',league_key:'nba',season:'2026-27',home_team:'Home',away_team:'Away',start_time:'2026-11-22T01:00:00.000Z',status:'scheduled',metadata:{production_eligible:true}};
function stats(team,delta={}){return {team_name:team,sport_key:'basketball_nba',season:2026,wins:9,losses:5,win_percentage:9/14,last_10_wins:6,last_10_losses:4,streak:2,updated_at:'2026-11-21T22:00:00.000Z',raw_data:{source:'balldontlie_team_season_averages',version:'NBA_GOAT_TEAM_STATS_V1',source_received_at:'2026-11-21T22:00:00.000Z',points_per_game:114,opponent_points_per_game:110,net_rating:4},...delta};}
function quote(market,outcome,line=null,price=-110,delta={}){return {id:[market,outcome,line].join(':'),event_id:event.id,provider:'balldontlie',sportsbook:'fanduel',market,outcome,price,line,snapshot_time:'2026-11-21T22:55:05.000Z',provider_timestamp:'2026-11-21T22:55:00.000Z',metadata:{module:'NBA_MARKET_DATA_V1',quote_id:[market,outcome,line].join(':'),snapshot_id:'snapshot-a',source_received_at:'2026-11-21T22:55:05.000Z',phase:'PREGAME',period:'FULL_GAME_LABEL_OT_UNVERIFIED',contract:market==='moneyline'?'WINNER':market==='spread'?'SIGNED_HANDICAP':outcome==='Over'?'STRICT_GREATER_THAN':'STRICT_LESS_THAN'},...delta};}
function fixture(delta={}){return {event,stats:[stats('Home'),stats('Away',{wins:5,losses:9,win_percentage:5/14,last_10_wins:4,last_10_losses:6,streak:-2})],odds:[quote('moneyline','Home',null,-150),quote('moneyline','Away',null,130),quote('spread','Home',-2.5,-112),quote('spread','Away',2.5,-108),quote('total','Over',230.5,-105),quote('total','Under',230.5,-115)],coverage:{confidence:{penalty:0,dataSufficiencyPenalty:0,featureQualityPenalty:0},warnings:[]},learnedWeights:weights,asOf,...delta};}
const plain=value=>JSON.parse(JSON.stringify(value));
const pick=(input=fixture(),market='moneyline')=>build(input).predictions.find(p=>p.market===market);

test('Global coverage penalty cannot increase probability, EV or confidence; no ceiling collapse',()=>{
 const predictions=[0,10,20,35,100].map(penalty=>pick(fixture({coverage:{confidence:{penalty,dataSufficiencyPenalty:penalty/2,featureQualityPenalty:penalty*.7},warnings:[]}})));
 assert.ok(predictions[0].modelProbability<88);
 for(let i=1;i<predictions.length;i++){
  assert.equal(predictions[i].modelProbability,predictions[0].modelProbability);
  assert.equal(predictions[i].ev,predictions[0].ev);
  assert.ok(predictions[i].confidence<=predictions[i-1].confidence);
 }
 assert.ok(predictions.every(p=>p.featureSnapshot.directionalFactors.injuryImpact===0));
});

test('Both actual prices and actual team statistics reach the shared formula',()=>{
 const p=pick(),input=p.featureSnapshot.moneylineInput;
 assert.equal(input.americanOdds,-150);assert.equal(input.opponentAmericanOdds,130);
 assert.equal(input.teamStats.wins,9);assert.equal(input.opponentStats.wins,5);
 const {calculatePredictionV4}=load('src/utils/prediction-engine-v4.ts');
 assert.equal(p.modelProbability,calculatePredictionV4(input,p.featureSnapshot.directionalFactors,weights).modelProbability);
 const changed=fixture();changed.odds[1].price=105;
 assert.notEqual(pick(changed).modelProbability,p.modelProbability);
});

test('Missing recent splits remain neutral and percent units normalize consistently',()=>{
 const a=fixture();a.stats[0]={...a.stats[0],win_percentage:9/14*100,last_10_wins:0,last_10_losses:0,streak:null};
 const p=pick(a);assert.ok(Math.abs(p.featureSnapshot.moneylineInput.teamStats.win_percentage-9/14)<1e-12);
 assert.equal(p.featureSnapshot.moneylineInput.teamStats.last_10_wins,null);
 assert.equal(p.featureSnapshot.neutralInputs.homeRecent,true);
 assert.ok(p.explanation.warnings.some(w=>w.startsWith('L10_UNAVAILABLE')));
});

for(const [name,mutate] of [
 ['missing opposite',x=>x.odds.splice(1,1)],
 ['different archive',x=>x.odds[1].metadata.snapshot_id='different'],
 ['different book',x=>x.odds[1].sportsbook='other'],
 ['different provider',x=>x.odds[1].provider='the-odds-api'],
 ['different timestamp',x=>x.odds[1].provider_timestamp='2026-11-21T22:54:00.000Z'],
 ['different game',x=>x.odds[1].event_id='bdl_nba_999'],
 ['different period',x=>x.odds[1].metadata.period='H1'],
 ['invalid contract',x=>x.odds[1].metadata.contract='UNVERIFIED'],
 ['missing selected price',x=>x.odds[0].price=null],
 ['zero odds',x=>x.odds[0].price=0],
 ['unobserved quote',x=>x.odds[0].metadata.source_received_at='2026-11-21T23:01:00.000Z'],
 ['stale quote',x=>x.odds[0].provider_timestamp='2026-11-21T22:00:00.000Z'],
 ['quote received by database after freeze',x=>x.odds[0].created_at='2026-11-21T23:01:00.000Z'],
 ['receipt without timezone',x=>x.odds[0].metadata.source_received_at='2026-11-21T22:55:05'],
])test('No synthetic moneyline when '+name,()=>{const x=plain(fixture());mutate(x);assert.equal(pick(x),undefined);});

test('Latest partial archive does not revive a removed earlier price',()=>{
 const x=fixture(),newer=plain(x.odds[0]);newer.id='newer';newer.metadata.snapshot_id='snapshot-b';newer.metadata.source_received_at='2026-11-21T22:59:05.000Z';newer.provider_timestamp='2026-11-21T22:59:00.000Z';newer.snapshot_time=newer.metadata.source_received_at;
 x.odds.push(newer);assert.equal(pick(x),undefined);
});

test('An entire removed market stays absent when the newest menu contains only totals',()=>{
 const x=plain(fixture());for(const old of x.odds.filter(q=>q.market==='total')){
  const q=plain(old);q.id+=':new';q.metadata.snapshot_id='snapshot-b';q.metadata.source_received_at='2026-11-21T22:59:05.000Z';q.provider_timestamp='2026-11-21T22:59:00.000Z';q.snapshot_time=q.metadata.source_received_at;x.odds.push(q);
 }
 const result=build(x);assert.equal(result.predictions.length,1);assert.equal(result.predictions[0].market,'total');
});

test('Ambiguous receipt timestamps and duplicate same-side quote identities fail closed',()=>{
 const malformed=plain(fixture());const bad=plain(malformed.odds[0]);bad.id='bad';bad.metadata.source_received_at='unknown';malformed.odds.push(bad);assert.equal(build(malformed).predictions.length,0);
 const duplicate=plain(fixture());duplicate.odds.push({...plain(duplicate.odds[0]),id:'same-side-different-id'});assert.equal(pick(duplicate),undefined);
 const split=plain(fixture());split.odds[0].metadata.snapshot_id='different-at-same-time';assert.equal(build(split).predictions.length,0);
});

test('Under uses its own real quote and first half has no fabricated line or price',()=>{
 const p=pick(fixture(),'total');assert.equal(p.team,'Under');assert.equal(p.odds,-115);
 assert.equal(p.featureSnapshot.selectedQuote.outcome,'Under');assert.equal(p.featureSnapshot.oppositeQuote.price,-105);
 assert.equal(build(fixture()).predictions.some(p=>p.market==='first_half'),false);
 assert.ok(build(fixture()).issues.some(x=>x.startsWith('FIRST_HALF_UNAVAILABLE')));
});

test('Spread uses signed handicap, accepts zero and rejects null',()=>{
 const zero=fixture();zero.odds[2].line=0;zero.odds[3].line=0;
 assert.equal(pick(zero,'spread').line,0);assert.ok(pick(zero,'spread').modelProbability>50);
 const plus=plain(zero);plus.odds[2].line=4;plus.odds[3].line=-4;
 assert.ok(pick(plus,'spread').modelProbability>pick(zero,'spread').modelProbability);
 const absent=plain(zero);absent.odds[2].line=null;assert.equal(pick(absent,'spread'),undefined);
 const mismatched=plain(zero);mismatched.odds[3].line=1;assert.equal(pick(mismatched,'spread'),undefined);
});

test('A total line must be positive and calendar timestamps must be real',()=>{
 for(const line of [0,-220.5]){const x=plain(fixture());for(const q of x.odds.filter(q=>q.market==='total'))q.line=line;assert.equal(pick(x,'total'),undefined);}
 assert.ok(Number.isNaN(core.nbaEvidenceTimestamp('2026-02-30T20:00:00Z')));
 assert.ok(Number.isNaN(core.nbaEvidenceTimestamp('2026-11-21T20:00:00')));
 assert.equal(core.nbaEvidenceTimestamp('2026-11-21T20:00:00-04:00'),Date.parse('2026-11-22T00:00:00Z'));
});

for(const [name,mutate] of [
 ['started',x=>x.event.start_time=asOf],['live',x=>x.event.status='live'],['scrambled',x=>x.event.metadata.scrambled=true],
 ['bad event identity',x=>x.event.id='not-a-provider-game'],['missing team',x=>x.stats.pop()],
 ['missing PPG',x=>x.stats[0].raw_data.points_per_game=null],['future stats',x=>x.stats[0].raw_data.source_received_at='2026-11-22T00:00:00.000Z'],
 ['stale stats',x=>x.stats[0].raw_data.source_received_at='2026-11-20T22:00:00.000Z'],['wrong season',x=>x.stats[0].season=2025],
 ['missing weights',x=>delete x.learnedWeights.injuryImpact],
 ['future coverage',x=>x.coverage.injuryFeed={latestUpdatedAt:'2026-11-21T23:01:00.000Z'}],
 ['fractional wins',x=>x.stats[0].wins=9.5],['L10 contains eleven games',x=>x.stats[0].last_10_losses=5],
])test('Fails closed on '+name,()=>{const x=plain(fixture());mutate(x);assert.equal(build(x).predictions.length,0);});

test('Actual coverage flags remain frozen without treating booleans as numeric penalties',()=>{
 const x=fixture();x.coverage.confidence.canImproveProductionConfidence=false;x.coverage.confidence.trialDataExcludedFromProductionConfidence=true;
 const p=pick(x);assert.ok(p);assert.equal(p.featureSnapshot.coverageSnapshot.confidence.canImproveProductionConfidence,false);
 assertEvidence(p,event,x.odds[0],asOf);
});

test('Research output stays ineligible and evidence is detached, reproducible and hash addressed',()=>{
 const f=plain(fixture()),p=pick(f),before=JSON.stringify(p.featureSnapshot);
 assert.equal(p.modelVersion,VERSION);assert.equal(p.probabilityStatus,'EXPLORATORY_UNVALIDATED');
 assert.equal(p.recommendedPick,false);assert.equal(p.recommendedStake,0);assert.equal(p.kellyPercent,0);
 assert.match(p.inputHash,/^[a-f0-9]{64}$/);assert.equal(p.inputHash,pick(f).inputHash);
 assertEvidence(p,event,f.odds[0],asOf);
 f.stats[0].wins=999;f.odds[0].price=-400;f.learnedWeights.injuryImpact=10;
 assert.equal(JSON.stringify(p.featureSnapshot),before);
 const altered=plain(p);altered.featureSnapshot.homeTeamStats.wins=99;
 assert.throws(()=>assertEvidence(altered,event,quote('moneyline','Home',null,-150),asOf),/REPLAY_MISMATCH/);
});

function integration(){
 const writes=[],stored=new Map();
 const db={from:table=>({upsert:(rows,options)=>({select:async()=>{writes.push({table,rows:plain(rows),options});const data=[];for(const row of rows){if(!stored.has(row.id)){stored.set(row.id,plain(row));data.push({id:row.id});}}return {data,error:null};}})})};
 const mocks={
  '@/lib/supabase-admin':{supabaseAdmin:db},
  '@/services/production-data-gate.service':{evaluateProductionDataGate:row=>({eligible:row.production_eligible===true,blockedReasons:[]})},
  '@/services/recommendation-eligibility-policy.service':{},'@/services/next-slate.service':{},
  '@/services/mlb-starter-weather-stadium-intelligence.service':{},'@/services/prediction-cutoff-enforcement.service':{},
  '@/services/nba-prediction-engine.service':{},
  '@/services/nba-prediction-validation.service':{NBA_SPORT_KEY:'basketball_nba',NBA_LEAGUE_KEY:'nba',NBA_PREDICTION_MODEL_VERSION:'nba_prediction_engine_v1'},
 };
 const local=modules(mocks),history=local('src/services/prediction-history.service.ts'),writer=local('src/services/nba-current-era-shadow-canary.service.ts');
 return {...history,...writer,writes,stored};
}
function rowFor(api,input=fixture()){
 const p=pick(input);return api.buildNbaCurrentEraShadowPredictionRow({event:input.event,odds:input.odds.find(q=>q.id===p.featureSnapshot.selectedQuote.id),generatedAt:input.asOf,modelPrediction:p});
}
test('Safe writer preserves cohort, exact inputs and distinct versioned identity',()=>{
 const api=integration(),row=rowFor(api);
 assert.equal(row.model_version,VERSION);assert.equal(row.model_role,'shadow');assert.equal(row.is_current,false);assert.equal(row.stake,0);
 assert.equal(row.feature_snapshot.inputHash,pick().inputHash);assert.equal(row.feature_snapshot.trainingWeightsHash,pick().trainingWeightsHash);
 assert.notEqual(row.id,api.buildPredictionHistoryDeterministicId({...row,model_version:'nba_prediction_engine_v1'}));
 assert.notEqual(api.buildNbaCurrentEraShadowModelMatchKey({eventId:event.id,market:'moneyline',selection:'Home',line:null,modelVersion:VERSION}),api.buildNbaCurrentEraShadowModelMatchKey({eventId:event.id,market:'moneyline',selection:'Home',line:null,modelVersion:'nba_prediction_engine_v1'}));
 api.assertNbaInputsShadowHistoryRow(row,asOf);
});

test('Public research constructor rechecks the current quote rather than trusting its frozen copy',()=>{
 const api=integration(),input=plain(fixture());input.odds[0].metadata.trial=true;
 assert.throws(()=>api.buildNbaCurrentEraShadowPredictionRow({event,odds:input.odds[0],generatedAt:asOf,modelPrediction:pick()}),/EVIDENCE_MISMATCH/);
});
for(const [name,change] of [
 ['default role',r=>delete r.model_role],['official role',r=>r.model_role='champion'],['current row',r=>r.is_current=true],
 ['recommended',r=>r.recommended_pick=true],['production eligible',r=>r.production_eligible=true],['nonzero stake',r=>r.stake=100],
 ['missing hash',r=>delete r.feature_snapshot.inputHash],['altered probability',r=>r.model_probability=88],
 ['altered opposite price',r=>r.feature_snapshot.oppositeQuote.price=-110],['altered event',r=>r.game_id='bdl_nba_99'],
 ['altered frozen factor',r=>r.feature_snapshot.directionalFactors.injuryImpact=-35],['altered frozen projection',r=>r.feature_snapshot.projection.margin=50],
 ['missing model version',r=>delete r.model_version],['relabelled as historical V1',r=>r.model_version='nba_prediction_engine_v1'],
 ['pre-filled win',r=>r.result='win'],['pre-filled settled status',r=>r.status='settled'],['pre-filled profit',r=>r.profit=50],
])test('Generic persistence guard rejects '+name,()=>{const api=integration(),r=rowFor(api);change(r);assert.throws(()=>api.assertNbaInputsShadowHistoryRow(r,asOf),/NBA_INPUTS_SHADOW/);});

test('Generic persistence checks actual time and retains legacy rows on their original path',()=>{
 const api=integration();assert.throws(()=>api.assertNbaInputsShadowHistoryRow(rowFor(api),event.start_time),/NBA_INPUTS_SHADOW/);
 assert.doesNotThrow(()=>api.assertNbaInputsShadowHistoryRow({model_version:'nba_prediction_engine_v1'},asOf));
});

test('New cohort persistence is append-only and reports only newly inserted rows',async()=>{
 const now=new Date(),future=new Date(now.getTime()+2*3600000),recent=new Date(now.getTime()-5*60000),updated=new Date(now.getTime()-3600000);
 const f=plain(fixture());f.asOf=now.toISOString();f.event.start_time=future.toISOString();
 for(const s of f.stats){s.updated_at=updated.toISOString();s.raw_data.source_received_at=s.updated_at;}
 for(const q of f.odds){q.provider_timestamp=recent.toISOString();q.snapshot_time=new Date(recent.getTime()+5000).toISOString();q.metadata.source_received_at=q.snapshot_time;}
 const api=integration(),row=rowFor(api,f),first=await api.savePredictionHistory([row]);
 api.stored.get(row.id).result='win';api.stored.get(row.id).profit=50;
 const initial=JSON.stringify(api.stored.get(row.id));
 const changed=plain(f);changed.odds[0].price=-175;changed.odds[1].price=145;
 const changedRow=rowFor(api,changed);assert.equal(changedRow.id,row.id);assert.notEqual(changedRow.feature_snapshot.inputHash,row.feature_snapshot.inputHash);
 const again=await api.savePredictionHistory([changedRow]);
 assert.equal(first.saved,1);assert.equal(again.saved,0);assert.equal(JSON.stringify(api.stored.get(row.id)),initial);
 assert.ok(api.writes.every(w=>w.options.ignoreDuplicates===true&&w.options.onConflict==='id'));
 await assert.rejects(()=>api.savePredictionHistory([{...row,is_current:true}]),/HISTORY_GUARD_REJECTED/);assert.equal(api.writes.length,2);
});

test('Direct engine persist rejects before database or provider access',async()=>{
 const local=modules({'@/lib/supabase-admin':{supabaseAdmin:{from(){throw Error('Unexpected DB access');}}},
  '@/services/adaptive-scoring.service':{},'@/services/adaptive-weight-engine.service':{},'@/services/model-learning.service':{},
  '@/services/nba-data-sync.service':{},'@/services/nba-injury-lineup-confidence.service':{},'@/services/nba-prediction-validation.service':{}});
 const engine=local('src/services/nba-prediction-engine.service.ts');
 await assert.rejects(()=>engine.generateNbaPredictions({persist:true}),/NBA_EXPLORATORY_REQUIRES_SHADOW_WRITER/);
});

test('Validation keeps historical V1 distinct from new research and preserves exact-line duplicates',async()=>{
 const api=integration(),newRow=rowFor(api),legacy={...newRow,model_version:'nba_prediction_engine_v1'};
 const validate=async(existing,candidate)=>{
  const db={from:table=>({select(){return this;},eq(){return this;},in:async()=>({data:table==='prediction_history'?existing:[event],error:null})})};
  const validation=modules({'@/lib/supabase-admin':{supabaseAdmin:db}})('src/services/nba-prediction-validation.service.ts');
  return validation.validateNbaPredictionCandidates([candidate]);
 };
 assert.equal((await validate([legacy],newRow)).valid,1);
 assert.equal((await validate([newRow],newRow)).skipped,1);
 assert.equal((await validate([legacy],legacy)).skipped,1);
 const spread=rowFor(api);spread.market='spread';spread.team='Home';spread.line=-2.5;
 assert.equal((await validate([{...spread,line:-3.5}],spread)).valid,1);
 assert.equal((await validate([spread],spread)).skipped,1);
});
