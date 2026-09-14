import fs from 'node:fs';import assert from 'node:assert/strict';import {createClient} from '@supabase/supabase-js';
import {readSharedResult} from '../src/lib/shared-mlb-results-contract.ts';
const authority=JSON.parse(fs.readFileSync('src/lib/shared-mlb-results-authority.json'));
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
let count=0,eligible=0;
for(let i=0;i<authority.length;i+=100){const batch=authority.slice(i,i+100);const {data,error}=await db.from('historical_baseball_games').select('source_game_id,game_date,canonical_home_team,canonical_away_team,final_score,checksum_sha256,validation_status,errors,source_lineage').eq('season','2025').in('source_game_id',batch.map(x=>x.reference));assert.equal(error,null);for(const a of batch){const found=data.filter(x=>x.source_game_id===a.reference);assert.equal(found.length,1);const r=readSharedResult(found[0],a);assert.ok(r,'SOURCE_DRIFT_'+a.gamePk);count++;eligible+=Number(r.training_eligible);}}
assert.equal(count,2430);assert.equal(eligible,2278);console.log(JSON.stringify({readback:'PASS',count,eligible,blocked:count-eligible,productionDml:0}));
