import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeNhlDirectory,normalizeNhlScore,matchFreeNhl,freezeNhlForecast,verifyFreeNhlForecast,freeNhlMetrics,reconcileFreeNhl} from '../../src/lib/nhl-free.ts';
import {parseDratingsUpcoming,parseDratingsCirca} from '../../src/lib/nhl-free-source.ts';
assert.ok(process.argv[2],'Usage: node --loader ./tests/dashboard-multisport/tsx-loader.mjs research/nhl-free-direct-20261104/verify-release-export.mjs /path/to/export');
const root=process.argv[2].replace(/\/$/,'')+'/',m=JSON.parse(fs.readFileSync(root+'manifest.json','utf8'));
const raw=s=>fs.readFileSync(root+s.id+'.raw','utf8');
const directorySource=m.sources.find(s=>s.url==='https://api.nhle.com/stats/rest/en/team');
const directory=normalizeNhlDirectory(JSON.parse(raw(directorySource)));
const calendar=m.sources.filter(s=>s.url==='https://api-web.nhle.com/v1/score/2026-11-04').at(-1),games=normalizeNhlScore(JSON.parse(raw(calendar)),directory);
const verified=[];
for(const {id,source_id,body:f} of m.predictions){
 verifyFreeNhlForecast(f);assert.equal(id,f.id);
 const pSource=m.sources.find(s=>s.id===f.priceSourceId),dirSource=m.sources.find(s=>s.id===f.directorySourceId);assert.equal(dirSource.id,directorySource.id);
 const dr=m.sources.filter(s=>s.url==='https://www.dratings.com/predictor/nhl-hockey-predictions/'&&Date.parse(s.captured_at)<=Date.parse(f.capturedAt)).at(-1);
 assert.equal(source_id,dr.id);
 const matched=parseDratingsUpcoming(raw(dr)).filter(p=>matchFreeNhl(p,games,f.capturedAt)?.eventId===f.eventId);assert.equal(matched.length,1);
 for(const s of [pSource,dirSource,calendar,dr])assert.ok(Date.parse(s.captured_at)<=Date.parse(f.capturedAt));
 const price=parseDratingsCirca(raw(pSource),matched[0]);assert.ok(price);const expected=freezeNhlForecast(games.find(g=>g.eventId===f.eventId),matched[0],f.capturedAt,price);
 const actual=Object.fromEntries(Object.keys(expected).map(k=>[k,f[k]]));assert.deepEqual(actual,expected);
 assert.ok(Date.parse(f.capturedAt)<Date.parse(f.scheduledAt));verified.push({id,sourceIds:[dr.id,calendar.id,dirSource.id,pSource.id],entryPriceVerified:true,forwardCapture:true});
}
assert.equal(verified.length,4);
const summary=freeNhlMetrics(m.predictions.map(p=>reconcileFreeNhl(p.body,[])));assert.equal(summary.pending,4);assert.equal(summary.accuracyPct,null);assert.equal(summary.roiPct,null);
const out={verifiedAt:new Date().toISOString(),rawSourcesVerified:13,replayedPredictions:verified,summary,result:'PASS'};
console.log(JSON.stringify(out,null,2));
