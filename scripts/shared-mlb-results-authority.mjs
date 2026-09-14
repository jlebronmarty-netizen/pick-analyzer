// Public-safe structural authority: identities, timestamps and digests only; no score samples.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {resultDigest,readSharedResult} from '../src/lib/shared-mlb-results-contract.ts';
const root=path.join(os.tmpdir(),'pick-analyzer-shared-mlb-bdl-goat');
const rows=JSON.parse(fs.readFileSync(path.join(root,'results-v1/canonical-results.json')));
const hist=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'pick-analyzer-mlb-v2/a3/sources.json'))).historical;
const byId=new Map(hist.map(h=>[h.source_game_id,h]));let checks=0;
const authority=rows.map(r=>{
 const h=byId.get(r.source_lineage.retrosheetReference);assert.ok(h);
 const a={gamePk:r.gamePk,reference:h.source_game_id,digest:resultDigest(h),scheduledAt:r.scheduled_at,officialDigest:r.source_lineage.officialResponseDigest,classification:r.training_eligibility_reason,reasons:r.blockers};
 const out=readSharedResult(h,a);assert.equal(out.training_eligible,r.training_eligible);checks++;
 if(r.training_eligible){assert.equal(out.final_home_score,r.final_home_score);assert.equal(out.final_away_score,r.final_away_score);checks+=2;}
 assert.equal(readSharedResult({...h,final_score:{home:999,away:998}},a),null);checks++;
 return a;
});
assert.equal(authority.length,2430);
fs.writeFileSync('src/lib/shared-mlb-results-authority.json',JSON.stringify(authority)+'\n');
console.log(JSON.stringify({checks,rows:authority.length,eligible:authority.filter(x=>x.classification==='TRAINING_ELIGIBLE').length,rawScoresPublished:false}));
