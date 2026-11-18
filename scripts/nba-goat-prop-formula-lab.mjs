#!/usr/bin/env node
// Isolated NBA GOAT reconstructed/strict-asof player-prop formula comparison.
// Read-only with --execute. Does not change PostgreSQL, Storage, model versions, picks, or crons.
import {createClient} from '@supabase/supabase-js';
import {writeFile} from 'node:fs/promises';
import {collectFormulaExamples,evaluateMarketFormulas,LAB_VERSION} from '../src/lib/nba/goat-formula-lab-core.mjs';
const opt=(name,fallback)=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const mode=opt('mode','RETROSPECTIVE_RECONSTRUCTED');
const execute=process.argv.includes('--execute');
const season=Number(opt('season','2026'));
const trainFrom=opt('train-from','2026-11-08'),trainThrough=opt('train-through','2026-11-12');
const holdoutFrom=opt('holdout-from','2026-11-13'),holdoutThrough=opt('holdout-through','2026-11-15');
const output=opt('output','');
if(!['RETROSPECTIVE_RECONSTRUCTED','PROSPECTIVE_ASOF_VERIFIED'].includes(mode)||season!==2026||
 [trainFrom,trainThrough,holdoutFrom,holdoutThrough].some(x=>!/^2026-\d{2}-\d{2}$/.test(x))||
 trainThrough>=holdoutFrom||Boolean(output)&&(!output.startsWith('/tmp/')||!output.endsWith('.json')))
 throw Error('UNSAFE_ARGUMENTS');
const config={version:LAB_VERSION,mode,season,trainFrom,trainThrough,holdoutFrom,holdoutThrough,maxRows:20000,readsOnly:true,modelWrites:0,officialPicksWrites:0};
if(!execute){console.log(JSON.stringify({status:'DRY_RUN_NO_PROVIDER_OR_DATABASE_CALLS',...config}));process.exit(0)}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('SERVER_ENVIRONMENT_REQUIRED');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const facts=[];
for(let page=0;page<20;page++){
 const {data,error}=await db.from('nba_goat_player_game_research_v1')
  .select('season,provider_game_id,player_id,game_datetime,source_captured_at,projection_eligible,pts,reb,ast,fg3m')
  .eq('season',season).order('provider_game_id').order('player_id').range(page*1000,page*1000+999);
 if(error||!data)throw Error('COMPACT_FACTS_READ_FAILED');
 facts.push(...data);
 if(data.length<1000)break;
 if(page===19)throw Error('COMPACT_FACTS_LIMIT');
}
const examples=collectFormulaExamples(facts,{mode});
const report={status:'RESEARCH_ONLY',...config,sourceFacts:facts.length,eligibleMarketObservations:examples.length,createdAt:new Date().toISOString(),
 scores:evaluateMarketFormulas(examples,{mode,trainFrom,trainThrough,holdoutFrom,holdoutThrough}),
 conclusion:'Never classify selected formulas as validated; reconstructed history may not exist pregame. No ROI without verified quotes, contracts, and settlement.'};
if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
