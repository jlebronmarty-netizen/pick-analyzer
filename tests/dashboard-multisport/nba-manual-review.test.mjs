import test from 'node:test';
import assert from 'node:assert/strict';
import {createManualPrediction,gradeManualPrediction,summarizeManualAccuracy,recentTeamSummary} from '../../src/lib/nba/manual-review-core.mjs';
const game={id:10,state:'scheduled',scheduledAt:'2026-11-25T00:00:00.000Z',home:{name:'A'},away:{name:'B'}};
const now='2026-11-24T13:00:00.000Z';
const final={gameId:'10',scheduledAt:game.scheduledAt,home:'A',away:'B',homeScore:110,awayScore:100};
const pick=(market,side,line=null)=>createManualPrediction(game,{market,side,line},now,market+side+line);
test('pregame cutoff and valid line',()=>{
 assert.equal(createManualPrediction(game,{market:'moneyline',side:'home'},game.scheduledAt,'x'),null);
 assert.equal(createManualPrediction({...game,state:'final'},{market:'moneyline',side:'home'},now,'x'),null);
 assert.equal(pick('spread','home',-2.25),null);
 assert.equal(pick('total','home',210),null);
 assert.ok(pick('moneyline','home'));
});
test('exact identity and unique final required',()=>{
 const p=pick('moneyline','home');
 assert.equal(gradeManualPrediction(p,[final]),'WIN');
 assert.equal(gradeManualPrediction(p,[final,final]),'PENDING');
 assert.equal(gradeManualPrediction(p,[{...final,home:'C'}]),'PENDING');
 assert.equal(gradeManualPrediction(p,[{...final,homeScore:100}]),'PENDING');
 assert.equal(gradeManualPrediction(p,[]),'PENDING');
});
test('spread total and pushes, accuracy denominator',()=>{
 const rows=[pick('spread','home',-10),pick('total','over',209.5),pick('moneyline','away'),pick('total','under',210)];
 assert.deepEqual(rows.map(p=>gradeManualPrediction(p,[final])),['PUSH','WIN','LOSS','PUSH']);
 assert.deepEqual(summarizeManualAccuracy(rows,[final]),{wins:1,losses:1,pushes:2,pending:0,accuracy:0.5});
 assert.equal(summarizeManualAccuracy([],[]).accuracy,null);
});
test('recent team coverage remains explicit',()=>{
 assert.deepEqual(recentTeamSummary({recent:[{pointsFor:110,pointsAgainst:100},{pointsFor:100,pointsAgainst:120}],sequenceVerified:false}),{n:2,wins:1,losses:1,pointsFor:105,pointsAgainst:110,margin:-5,sequenceVerified:false});
 assert.equal(recentTeamSummary(undefined).margin,null);
});
