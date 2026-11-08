// Replays the first real forward observations from archived public responses; zero network/DB calls.
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {normalizeUfcBoard,normalizeUfcQuote,ratingsWithRecent,freezeUfc} from '../../src/lib/ufc/free.ts';
const root='research/ufc-free-v1/results',data=JSON.parse(gunzipSync(fs.readFileSync(root+'/initial-forward-archive.json.gz'))),seed=JSON.parse(fs.readFileSync('src/lib/ufc/seed.json')),hash=x=>createHash('sha256').update(x).digest('hex'),sources=new Map(data.sources.map(s=>[s.id,s]));
function payload(s){assert(s);assert(s.body.raw!==null);const raw=gunzipSync(Buffer.from(s.body.raw,'base64'));assert.equal(hash(raw),s.body.sha256);return JSON.parse(raw);}
let replayed=0,prices=0;for(const row of data.predictions){
 const f=row.body,historySource=sources.get(row.history_source_id),calendarSource=sources.get(row.source_id),history=normalizeUfcBoard(payload(historySource)),calendar=normalizeUfcBoard(payload(calendarSource));
 assert(Date.parse(historySource.captured_at)<=Date.parse(f.capturedAt));assert(Date.parse(calendarSource.captured_at)<=Date.parse(f.capturedAt));assert(Date.parse(f.capturedAt)<Date.parse(f.bout.scheduledAt));
 const state=ratingsWithRecent(seed.ratings,history,historySource.captured_at),bout=calendar.find(b=>b.id===f.bout.id);assert(bout);let quote=null;
 if(f.quote){const ss=data.sources.filter(s=>s.source_url.includes(`/competitions/${bout.id}/odds?`)&&Date.parse(s.captured_at)===Date.parse(f.quote.capturedAt));assert.equal(ss.length,1);quote=normalizeUfcQuote(payload(ss[0]),bout,f.quote.capturedAt);assert.deepEqual(quote,f.quote);prices++;}
 const replay=freezeUfc(bout,state.ratings,state.uncertain,f.capturedAt,quote);assert.deepEqual(replay,f);replayed++;
}
for(const q of data.quotes??[]){const f=data.predictions.find(p=>p.bout_id===q.bout_id);assert(f);const raw=sources.get(q.source_id);assert.equal(Date.parse(raw.captured_at),Date.parse(q.body.capturedAt));assert.deepEqual(normalizeUfcQuote(payload(raw),f.body.bout,q.body.capturedAt),q.body);}
const summary={status:'PASS',replayedQuoteObservations:data.quotes?.length??0,replayedPredictions:replayed,replayedOriginalPricePairs:prices,rawSources:data.sources.length,providerCalls:0,databaseWrites:0,checks:['gzip/raw SHA256','source foreign keys and capture ordering','real ESPN fighter IDs','history-derived Elo and uncertainty gates','original quote athlete pairing','complete equality with frozen prospective prediction body']};fs.writeFileSync(root+'/forward-replay-verification.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
