import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {buildNhlFeatureResearch,normalizeNhlResearchContexts,readNhlResearchSchedules,
 NHL_FEATURE_RESEARCH_REGISTERED_AT,NHL_FEATURE_RESEARCH_SPLITS} from '../src/lib/nhl-research-features.mjs';

const cutoff=NHL_FEATURE_RESEARCH_REGISTERED_AT,HOUR=3600000;
const timestamp=(date,hour)=>`${date}T${String(hour).padStart(2,'0')}:00:00.000Z`;
const id=i=>'nhl:202602'+String(i).padStart(4,'0');
function context(i,date,{homeId=1,awayId=2,homeGoals=3,awayGoals=2,homeShots=30,awayShots=28,type='REG'}={}){
 const start=timestamp(date,20),homeActual=homeGoals-(type==='SO'&&homeGoals>awayGoals?1:0),awayActual=awayGoals-(type==='SO'&&awayGoals>homeGoals?1:0);
 const players=(team,goals,shots,againstGoals,againstShots,name)=>({
  forwards:Array.from({length:10},(_,j)=>({playerId:team*100+j+1,name:{default:'P. '+j},position:'C',toi:'12:00',
   goals:j===0?goals:0,assists:0,points:j===0?goals:0,sog:j===0?shots-9:1,powerPlayGoals:0,hits:0,blockedShots:0})),
  defense:[],goalies:[{playerId:team*1000,name:{default:name},position:'G',toi:'60:00',starter:true,
   shotsAgainst:againstShots,goalsAgainst:againstGoals,saves:againstShots-againstGoals},
  {playerId:team*1000+1,name:{default:'B. Backup'},position:'G',toi:'00:00',starter:false,shotsAgainst:0,goalsAgainst:0,saves:0}]
 });
 return {event_id:id(i),provider_game_id:Number(id(i).slice(4)),boxscore_captured_at:new Date(Date.parse(start)+4*HOUR).toISOString(),
  pbp_captured_at:new Date(Date.parse(start)+4*HOUR).toISOString(),source_version:'FIXTURE',boxscore:{id:Number(id(i).slice(4)),season:20262027,
   gameType:2,gameDate:date,startTimeUTC:start,gameState:'OFF',periodDescriptor:{periodType:type,number:type==='REG'?3:type==='OT'?4:5},
   gameOutcome:{lastPeriodType:type},homeTeam:{id:homeId,abbrev:'HOME',score:homeGoals,sog:homeShots},
   awayTeam:{id:awayId,abbrev:'AWAY',score:awayGoals,sog:awayShots},playerByGameStats:{
    homeTeam:players(homeId,homeActual,homeShots,awayActual,awayShots,'H. Keeper'),
    awayTeam:players(awayId,awayActual,awayShots,homeActual,homeShots,'A. Keeper')}}};
}
function freeze(c){const b=c.boxscore,t=Date.parse(b.startTimeUTC)-2*HOUR;return {
 id:'frozen:'+c.event_id,event_id:c.event_id,model_version:'NHL_SCORES_POISSON_SHADOW_V1',scheduled_at:b.startTimeUTC,
 frozen_at:new Date(t).toISOString(),source_completed_at:new Date(t-5000).toISOString(),created_at:new Date(t+1000).toISOString(),
 home_team_id:b.homeTeam.id,away_team_id:b.awayTeam.id,home_team:'Home Team',away_team:'Away Team',
 projection:{homeGoals:3.1,awayGoals:2.7,totalGoals:5.8,homeMargin:.4},status:'FROZEN_RESEARCH',official_pick:false,production_eligible:false};}
function outcome(c){const b=c.boxscore;return {event_id:c.event_id,observed_at:c.boxscore_captured_at,body:{eventId:c.event_id,
 scheduledAt:b.startTimeUTC,homeId:b.homeTeam.id,awayId:b.awayTeam.id,homeScore:b.homeTeam.score,awayScore:b.awayTeam.score}};}
function receipt(date,games,capturedAt=timestamp('2026-11-12',17)){
 const raw=JSON.stringify({currentDate:date,games:games.map(c=>({id:c.provider_game_id,gameType:2,startTimeUTC:c.boxscore.startTimeUTC,
  homeTeam:{id:c.boxscore.homeTeam.id},awayTeam:{id:c.boxscore.awayTeam.id},gameState:'FUT',gameScheduleState:'OK'}))});
 return {id:'score:'+date,source_url:'https://api-web.nhle.com/v1/score/'+date,captured_at:capturedAt,
  body:{http_status:200,error:null,encoding:'gzip/base64',sha256:createHash('sha256').update(raw).digest('hex'),raw:gzipSync(raw).toString('base64')}};
}
function dataset(){
 const contexts=[];
 for(let day=1;day<=22;day++)for(let pair=0;pair<2;pair++){
  const n=(day-1)*2+pair+1;contexts.push(context(n,`2026-11-${String(day).padStart(2,'0')}`,{
   homeId:1+pair*2,awayId:2+pair*2,homeGoals:3+(n%3),awayGoals:1+(n%2),homeShots:25+(n%7),awayShots:24+(n%5)}));
 }
 return {contexts,early:contexts.filter(c=>c.boxscore.gameDate>='2026-11-06').map(freeze),
  outcomes:contexts.map(outcome),cutoff};
}

test('shootout deciding score is kept for contracts but excluded from physical goals and player/goalie stats',()=>{
 const c=context(1,'2026-11-10',{homeGoals:3,awayGoals:2,type:'SO'}),r=normalizeNhlResearchContexts([c],cutoff);
 assert.equal(r.games[0].homeScore,3);assert.equal(r.games[0].homeGoals,2);
 assert.equal(r.teamGames[0].finalGoalsFor,3);assert.equal(r.teamGames[0].goalsFor,2);
 assert.equal(r.teamGames[0].shootoutBonusFor,1);assert.equal(r.teamGames[0].performanceGoalsVerified,true);
 assert.equal(r.skaterGames.filter(p=>p.side==='home').reduce((s,p)=>s+p.goals,0),2);
 assert.equal(r.goalieGames.find(p=>p.side==='away'&&p.played).goalsAgainst,2);
});

test('normalization retains missing numerics as null and quarantines discrepant stat groups without rewriting raw',()=>{
 const c=context(1,'2026-11-10');delete c.boxscore.playerByGameStats.homeTeam.forwards[0].sog;
 c.boxscore.playerByGameStats.awayTeam.goalies[0].saves++;
 const before=JSON.stringify(c),r=normalizeNhlResearchContexts([c],cutoff);
 assert.equal(r.skaterGames[0].shotsOnGoal,null);assert.equal(r.teamGames[0].shootingPct,null);
 assert.equal(r.teamGames[1].shotsVerified,false);assert.equal(r.goalieGames.find(p=>p.side==='away'&&p.played).accountingValid,false);
 assert.ok(r.exclusions.some(x=>x.scope==='goalieSource'));assert.equal(JSON.stringify(c),before);
});

test('duplicate games, same-game player identity collision and mismatched end-type evidence fail closed',()=>{
 const c=context(1,'2026-11-10');assert.equal(normalizeNhlResearchContexts([c,c],cutoff).games.length,0);
 const conflict=structuredClone(c);conflict.pbp_period={periodType:'SO'};
 assert.equal(normalizeNhlResearchContexts([conflict],cutoff).games.length,0);
 const players=structuredClone(c);players.boxscore.playerByGameStats.awayTeam.forwards[0].playerId=101;
 const r=normalizeNhlResearchContexts([players],cutoff);
 assert.equal(r.skaterGames.filter(p=>p.playerId===101).length,0);assert.equal(r.duplicates,2);
});

test('future and same-game boxscores never enter prior feature history',()=>{
 const all=dataset(),target=all.contexts.find(c=>c.boxscore.gameDate==='2026-11-10'&&c.boxscore.homeTeam.id===1);
 const prior=all.contexts.find(c=>c.boxscore.gameDate==='2026-11-09'&&c.boxscore.homeTeam.id===1);
 prior.boxscore_captured_at=timestamp('2026-11-11',10);
 const r=buildNhlFeatureResearch({...all,early:[freeze(target)]}),d=r.decisionFeatures[0];
 assert.equal(d.priorObserved.home,8);assert.equal(d.priorObserved.away,8);
 assert.ok(!d.details.shots.homeGames.includes(prior.event_id));assert.ok(!d.details.shots.homeGames.includes(target.event_id));
});

test('rest requires an actual complete daily schedule including empty days and the target identity',()=>{
 const before=context(1,'2026-11-10'),target=context(2,'2026-11-12');
 const sources=[receipt('2026-11-10',[before]),receipt('2026-11-11',[]),receipt('2026-11-12',[target])];
 const input={contexts:[before,target],early:[freeze(target)],outcomes:[outcome(target)],sources,cutoff};
 assert.equal(buildNhlFeatureResearch(input).windowCoverage.restCertified,1);
 const missing=buildNhlFeatureResearch({...input,sources:sources.filter(s=>!s.source_url.endsWith('2026-11-11'))});
 assert.equal(missing.windowCoverage.restCertified,0);assert.ok(missing.exclusions.some(x=>x.reason==='MISSING_ASOF_DAILY_SCHEDULE'));
 assert.equal(buildNhlFeatureResearch({...input,sources:[...sources.slice(0,2),receipt('2026-11-12',[])]}).windowCoverage.restCertified,0);
});

test('saved official schedule uses capture time and SHA, not a forged or later payload',()=>{
 const c=context(1,'2026-11-10'),r=receipt('2026-11-10',[c]);r.body.sha256='0'.repeat(64);
 assert.equal(readNhlResearchSchedules([r],cutoff).snapshots.length,0);
 const later=receipt('2026-11-10',[c],timestamp('2026-11-24',10));
 assert.equal(readNhlResearchSchedules([later],cutoff).snapshots.length,0);
});

test('goalie form reuses pregame probable identity and quarantines inconsistent prior shot accounting',()=>{
 const prior=[context(1,'2026-11-08'),context(2,'2026-11-09')],target=context(3,'2026-11-10');
 const probable={id:'probable',captured_at:timestamp('2026-11-10',17),raw_sha256:'a'.repeat(64),source_version:'NHL_ESPN_FREE_PROBABLE_V5',
  games:[{eventId:target.event_id,scheduledAt:target.boxscore.startTimeUTC,homeTeamId:1,awayTeamId:2,homeName:'Home Team',awayName:'Away Team',
   homeProbable:{displayName:'Home Keeper',sourceAthleteId:'9991',sourceAthleteIdIsNhlPlayerId:false},
   awayProbable:{displayName:'Away Keeper',sourceAthleteId:'9992',sourceAthleteIdIsNhlPlayerId:false},confirmedHome:false,confirmedAway:false}]};
 const input={contexts:[...prior,target],early:[freeze(target)],outcomes:[outcome(target)],goalies:[probable],cutoff};
 const valid=buildNhlFeatureResearch(input),g=valid.decisionFeatures[0].details.goalie;
 assert.equal(valid.variables.find(x=>x.id==='goalie').availableGames,1);assert.equal(g.home.goalieNhlIdCandidate,1000);
 assert.equal(g.home.priorShots,56);assert.equal(g.confirmedStarter,false);assert.equal(g.crosswalkCertified,false);
 prior[0].boxscore.playerByGameStats.homeTeam.goalies[0].saves++;
 const disputed=buildNhlFeatureResearch(input);assert.equal(disputed.variables.find(x=>x.id==='goalie').availableGames,0);
 assert.ok(disputed.exclusions.some(x=>x.scope==='goalieSource'));
 assert.equal(buildNhlFeatureResearch({...input,goalies:[{...probable,captured_at:timestamp('2026-11-10',19)}]}).variables.find(x=>x.id==='goalie').availableGames,0);
});

test('PP/PK uses only the captured season snapshot before the freeze and never a later aggregate',()=>{
 const target=context(1,'2026-11-10'),snapshot={id:'pp',captured_at:timestamp('2026-11-10',17),source_hash:'b'.repeat(64),
  source_version:'NHL_SPECIAL_TEAMS_ASOF_V3',season_id:20262027,teams:Array.from({length:32},(_,i)=>({teamId:i+1,gamesPlayed:10,
   powerPlayPct:.2+(i+1)*.001,penaltyKillPct:.8}))};
 const input={contexts:[target],early:[freeze(target)],outcomes:[outcome(target)],specialTeams:[snapshot],cutoff};
 assert.equal(buildNhlFeatureResearch(input).variables.find(x=>x.id==='specialTeams').availableGames,1);
 assert.equal(buildNhlFeatureResearch({...input,specialTeams:[{...snapshot,captured_at:timestamp('2026-11-10',19)}]}).variables.find(x=>x.id==='specialTeams').availableGames,0);
 assert.equal(buildNhlFeatureResearch({...input,specialTeams:[{...snapshot,captured_at:timestamp('2026-11-08',1)}]}).variables.find(x=>x.id==='specialTeams').availableGames,0);
});

test('ablations have fixed registered boundaries, game-paired scores, deterministic intervals and no official effect',()=>{
 const input=dataset(),before=JSON.stringify(input),r=buildNhlFeatureResearch(input),a=r.ablations.find(x=>x.id==='shots');
 assert.equal(a.status,'EXPLORATORY_CHRONOLOGICAL_TEST');assert.equal(a.baseline.games,a.laterGames);assert.equal(a.candidate.games,a.laterGames);
 assert.ok(a.trainingGames>=10&&a.laterGames>=5);assert.equal(a.ridgePenalty,10);assert.equal(a.parameterSearch,false);
 assert.equal(r.variantRegistry.lockedDateBoundaries.shots.trainingThrough,'2026-11-17');
 assert.deepEqual(r.ablations,buildNhlFeatureResearch(input).ablations);assert.equal(JSON.stringify(input),before);
 assert.equal(r.databaseWrites,0);assert.equal(r.providerCalls,0);assert.equal(r.officialPicksChanged,false);
 assert.equal(r.cohort.independentHoldoutPassed,false);
});

test('later result changes cannot refit a training coefficient or change stored baseline projections',()=>{
 const input=dataset(),original=buildNhlFeatureResearch(input);
 for(const c of input.contexts.filter(c=>c.boxscore.gameDate>'2026-11-19')){
  c.boxscore.homeTeam.score+=2;c.boxscore.playerByGameStats.homeTeam.forwards[0].goals+=2;
  c.boxscore.playerByGameStats.homeTeam.forwards[0].points+=2;
  c.boxscore.playerByGameStats.awayTeam.goalies[0].goalsAgainst+=2;c.boxscore.playerByGameStats.awayTeam.goalies[0].saves-=2;
 }
 input.outcomes=input.contexts.map(outcome);
 const changed=buildNhlFeatureResearch(input);
 for(const key of ['shots','opponent'])assert.equal(changed.ablations.find(x=>x.id===key).coefficient,original.ablations.find(x=>x.id===key).coefficient);
 assert.equal(changed.decisionFeatures[0].base[0],3.1);
});

test('delayed training labels are purged before fitting and listed explicitly',()=>{
 const input=dataset(),delayed=input.outcomes.find(o=>o.body.scheduledAt.startsWith('2026-11-17'));
 delayed.observed_at=timestamp('2026-11-19',12);
 const r=buildNhlFeatureResearch(input),a=r.ablations.find(x=>x.id==='shots');
 assert.equal(a.purgedTrainingGames,1);assert.ok(a.purgedTrainingEventIds.includes(delayed.event_id));
 assert.ok(!a.eventIds.training.includes(delayed.event_id));
 assert.ok(r.exclusions.some(x=>x.eventId===delayed.event_id&&x.reason==='LABEL_CAPTURE_AFTER_EVALUATION_DECISION'));
});

test('future live inventory can grow without recutting or fitting on the reserved future sample',()=>{
 const input=dataset(),original=buildNhlFeatureResearch(input),future=context(100,'2026-11-24');
 const next=buildNhlFeatureResearch({...input,contexts:[...input.contexts,future],early:[...input.early,freeze(future)],
  outcomes:[...input.outcomes,outcome(future)],cutoff:timestamp('2026-11-26',12)});
 assert.equal(next.coverage.games,original.coverage.games+1);assert.equal(next.researchCutoff,NHL_FEATURE_RESEARCH_REGISTERED_AT);
 assert.deepEqual(next.ablations,original.ablations);assert.equal(next.cohort.futureHoldoutGames,1);assert.equal(next.cohort.futureHoldoutScored,false);
 assert.equal(next.variantRegistry.lockedDateBoundaries,NHL_FEATURE_RESEARCH_SPLITS);
});

test('future duplicate observations cannot quarantine original registered rows',()=>{
 const input=dataset(),original=buildNhlFeatureResearch(input),frozenDuplicate={...input.early[0],created_at:timestamp('2026-11-24',12)},
  outcomeDuplicate={...input.outcomes[12],observed_at:timestamp('2026-11-24',12)};
 const next=buildNhlFeatureResearch({...input,early:[...input.early,frozenDuplicate],outcomes:[...input.outcomes,outcomeDuplicate],
  cutoff:timestamp('2026-11-26',12)});
 assert.deepEqual(next.ablations,original.ablations);assert.equal(next.cohort.settled,original.cohort.settled);
});

test('wrong model family and post-start forecast persistence cannot become historical feature decisions',()=>{
 const c=context(1,'2026-11-10'),f=freeze(c),input={contexts:[c],outcomes:[outcome(c)],cutoff};
 assert.equal(buildNhlFeatureResearch({...input,early:[{...f,model_version:'UNRELATED'}]}).cohort.decisions,0);
 assert.equal(buildNhlFeatureResearch({...input,late:[f]}).cohort.decisions,0);
 assert.equal(buildNhlFeatureResearch({...input,early:[{...f,created_at:c.boxscore_captured_at}]}).cohort.decisions,0);
});

test('a correct score with pregame observation, wrong body event or conflicting capturedAt is still invalid truth',()=>{
 const c=context(1,'2026-11-10'),valid=outcome(c),input={contexts:[c],early:[freeze(c)],cutoff};
 for(const bad of [
  {...valid,observed_at:timestamp('2026-11-10',19)},
  {...valid,body:{...valid.body,eventId:id(999)}},
  {...valid,body:{...valid.body,capturedAt:timestamp('2026-11-11',1)}},
  {...valid,body:{...valid.body,capturedAt:null}},
  {...valid,body:{...valid.body,homeScore:-1}},
 ]){
  const r=buildNhlFeatureResearch({...input,outcomes:[bad]});
  assert.equal(r.cohort.settled,0);assert.ok(r.exclusions.some(x=>x.scope==='outcome'&&x.reason==='INVALID_FINAL_OR_OBSERVED_TIME'));
 }
 assert.equal(buildNhlFeatureResearch({...input,outcomes:[{...valid,body:{...valid.body,capturedAt:valid.observed_at}}]}).cohort.settled,1);
});

test('empty or invalid source state yields typed empty metrics rather than fabricated performance',()=>{
 const empty=buildNhlFeatureResearch({cutoff});assert.equal(empty.status,'EMPTY');assert.equal(empty.coverage.games,0);
 assert.equal(empty.cohort.settled,0);assert.ok(empty.ablations.every(a=>a.baseline.totalMAE===null&&a.candidate.totalMAE===null));
 const invalid=buildNhlFeatureResearch({contexts:[context(1,'2026-11-10')],cutoff:'invalid'});
 assert.equal(invalid.coverage.games,0);assert.equal(invalid.cohort.settled,0);
});
