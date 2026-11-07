import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeNhlDirectory,normalizeNhlScore,matchFreeNhl,freezeNhlForecast,verifyFreeNhlForecast} from '../../src/lib/nhl-free.ts';
import {nhlQuoteCalendarDates} from '../../src/lib/nhl-quotes.ts';
import {parseDratingsUpcoming,parseDratingsCirca} from '../../src/lib/nhl-free-source.ts';
assert.ok(process.argv[2],'Supply the exported manifest/raw directory; this script never calls providers or writes to the database.');
const dir=process.argv[2].replace(/\/$/,'')+'/',m=JSON.parse(fs.readFileSync(dir+'manifest.json','utf8')),sources=new Map(m.sources.map(s=>[s.id,s]));
const raw=new Map();for(const s of m.sources){const bytes=fs.readFileSync(dir+s.id+'.raw');assert.equal(createHash('sha256').update(bytes).digest('hex'),s.sha256);assert.equal(s.http,200);raw.set(s.id,bytes.toString('utf8'));}
const verified=[];
for(const q of m.quotes){
 verifyFreeNhlForecast(q.body);assert.equal(q.prediction_id,q.body.id);assert.equal(q.event_id,q.body.eventId);assert.equal(Date.parse(q.captured_at),Date.parse(q.body.capturedAt));assert.ok(Date.parse(q.created_at)<Date.parse(q.scheduled_at));
 const directory=normalizeNhlDirectory(JSON.parse(raw.get(q.directory_source_id))),games=normalizeNhlScore(JSON.parse(raw.get(q.schedule_source_id)),directory),published=parseDratingsUpcoming(raw.get(q.forecast_source_id));
 const source=sources.get(q.source_id),matched=published.filter(f=>f.detailUrl===source.source_url&&matchFreeNhl(f,games,q.body.capturedAt)?.eventId===q.event_id);assert.equal(matched.length,1);
 const game=games.find(g=>g.eventId===q.event_id),prices=parseDratingsCirca(raw.get(q.source_id),matched[0]);assert.ok(prices);
 const expected=freezeNhlForecast(game,matched[0],q.body.capturedAt,prices);assert.deepEqual(q.body,expected);
 for(const id of [q.source_id,q.forecast_source_id,q.schedule_source_id,q.directory_source_id])assert.ok(Date.parse(sources.get(id).captured_at)<=Date.parse(q.captured_at));
 assert.ok(Date.parse(q.captured_at)-Date.parse(sources.get(q.directory_source_id).captured_at)<=24*3600000);
 verified.push({id:q.id,eventId:q.event_id,predictionId:q.prediction_id,paired:true,pregame:true,sourceIds:[q.source_id,q.forecast_source_id,q.schedule_source_id,q.directory_source_id]});
}
const forecasts=parseDratingsUpcoming(raw.get(m.quotes[0].forecast_source_id));
const planned=[...nhlQuoteCalendarDates(forecasts,[],m.run.started_at)];
const observed=m.sources.filter(s=>s.source_url.includes('/v1/score/')).map(s=>s.source_url.split('/').at(-1)).sort();
assert.deepEqual(planned.slice().sort(),observed);
console.log(JSON.stringify({calendarPlan:planned,result:'PASS',verifiedAt:new Date().toISOString(),raws:m.sources.length,quotes:verified.length,run:m.run,observations:verified,providerCalls:0,databaseWrites:0},null,2));
