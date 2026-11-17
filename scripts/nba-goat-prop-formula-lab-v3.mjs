#!/usr/bin/env node
// Read-only NBA GOAT V3 research formula runner. No provider calls, no model or picks writes.
import {createClient} from '@supabase/supabase-js';
import {VERSION,FORMULAS,buildV3Examples,evaluateV3} from '../src/lib/nba/goat-formula-lab-v3.mjs';
const arg=(k,def)=>process.argv.find(x=>x.startsWith('--'+k+'='))?.slice(k.length+3)??def;
const executing=process.argv.includes('--execute'),mode=arg('mode','RETROSPECTIVE_RECONSTRUCTED');
const season=Number(arg('season','2026')),trainFrom=arg('train-from','2026-11-08'),trainThrough=arg('train-through','2026-11-12');
const testFrom=arg('test-from','2026-11-13'),testThrough=arg('test-through','2026-11-15');
if(season!==2026||!['RETROSPECTIVE_RECONSTRUCTED','PROSPECTIVE_ASOF_VERIFIED'].includes(mode)||
 [trainFrom,trainThrough,testFrom,testThrough].some(d=>!/^2026-\d{2}-\d{2}$/.test(d))||
 trainThrough>=testFrom)throw Error('INVALID_BOUNDED_EXPERIMENT_OPTIONS');
const config={version:VERSION,season,mode,trainFrom,trainThrough,testFrom,testThrough,
 maxCompactRows:20000,maxCandidates:FORMULAS.length,providerCalls:0,databaseWrites:0,officialPickWrites:0,productionModelUpdates:0};
if(!executing){console.log(JSON.stringify({status:'DRY_RUN_NO_NETWORK',...config}));process.exit(0)}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('SERVER_SIDE_RESEARCH_CREDENTIALS_REQUIRED');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),facts=[];
for(let p=0;p<20;p++){
 const {data,error}=await db.from('nba_goat_player_game_research_v1')
  .select('season,player_id,provider_game_id,game_datetime,source_captured_at,projection_eligible,minutes_played,pts,reb,ast,fg3m')
  .eq('season',season).order('provider_game_id').order('player_id').range(p*1000,p*1000+999);
 if(error||!data)throw Error('VERIFIED_COMPACT_FACT_READ_FAILED');
 facts.push(...data);
 if(data.length<1000)break;
 if(p===19)throw Error('ROW_BOUND_EXCEEDED');
}
const examples=buildV3Examples(facts,{mode});
console.log(JSON.stringify({status:'RESEARCH_ONLY',...config,sourceRows:facts.length,examples:examples.length,
 markets:evaluateV3(examples,{mode,trainFrom,trainThrough,testFrom,testThrough}),
 warning:'Candidate selection uses training only. Reconstructed, previously-inspected test interval is not an independent holdout, not true pregame, and not certified.'}));
