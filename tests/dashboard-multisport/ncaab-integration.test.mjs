import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
import {getNcaabCheckpoint} from '../../src/services/ncaab-checkpoint-read.service.ts';
import {checkpointSchema,ncaabModelCohort} from '../../src/lib/ncaab-checkpoint.ts';
import {displayedModelTotal} from '../../src/lib/sport-model-overview.ts';
import NcaabDashboard from '../../src/components/dashboard/NcaabDashboard.tsx';
const report=getNcaabCheckpoint();
test('published NCAAB source projects exactly 73 forecasts and 108 abstentions',()=>{
 assert.equal(report.status,'AVAILABLE');
 assert.equal(report.data.observations.length,181);
 assert.equal(report.data.observations.filter(r=>r.state==='FORECAST').length,73);
 assert.equal(report.data.observations.filter(r=>r.state==='ABSTAIN').length,108);
 assert.deepEqual(report.data.models.map(m=>[m.id,m.forecasts,m.accuracy]),[['NCAAB_PRESEASON_V1',73,null],['NCAAB_FREE_SCORE_V1_1',0,null]]);
 assert.equal(report.data.continuousSync,false);
});
test('schema rejects duplicate events, invented outcomes, and post-start forecasts',()=>{
 for(const mutate of [s=>s.observations.push(s.observations[0]),s=>s.models[0].settled=1,s=>s.models[0].accuracy=.75,s=>s.observations[0].created_at=s.observations[0].scheduled_at,s=>s.observations[0].home_win_probability=.99,s=>s.models[1].id=s.models[0].id]){
  const s=structuredClone(report.data);mutate(s);assert.equal(checkpointSchema.safeParse(s).success,false);
 }
});
test('zero settled NCAAB adds pending observations without changing aggregate W/L accuracy',()=>{
 const c=ncaabModelCohort(report);assert.equal(c.accuracy,null);assert.equal(c.pending,73);
 const total=displayedModelTotal([{...c,wins:3,losses:1,pending:0},c]);assert.equal(total.accuracy,.75);assert.equal(total.pending,73);
 assert.equal(displayedModelTotal([ncaabModelCohort({status:'UNAVAILABLE',warning:'offline'})]).available,false);
});
test('NCAAB page keeps experimental probabilities and empty settlement explicit',()=>{
 const html=renderToStaticMarkup(React.createElement(NcaabDashboard,{report}));
 for(const text of ['NCAAB_PRESEASON_V1','NCAAB_FREE_SCORE_V1_1','Sin sincronización continua','0 WIN / 0 LOSS','No hay resultados liquidados','Butler Bulldogs'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('66.96%'));
});
import {combinedDay,filterDayGames} from '../../src/lib/multisport-day.ts';
const slate=(date)=>combinedDay({date,warnings:[],games:[],board:{rows:[]}}, {status:'UNAVAILABLE',warning:'offline'}, {status:'EMPTY',groups:[],entries:[]},report);
test('daily NCAAB slate is date scoped, excludes unverified tips and creates no edge or official recommendations',()=>{
 const today=slate('2026-10-15');assert.equal(today.games.length,0);assert.equal(today.selected.length,0);
 const opening=slate('2026-11-02');assert.equal(opening.selected.length,72);assert.equal(opening.edge.length,0);assert.equal(slate('2026-11-03').selected.length,1);
 assert.equal(opening.games.length,111);assert.equal(filterDayGames(opening.games,'NCAAB','Picks').length,72);
 assert.ok(opening.games.every(g=>g.official===0&&g.value===0&&!g.noEdge));
 assert.ok(opening.selected.every(p=>p.odds===null&&p.edgePp===null&&p.book===null));
 assert.ok(!opening.games.some(g=>report.data.observations.find(r=>r.event_id===g.eventId).reason==='UNVERIFIED_TIP'));
});
