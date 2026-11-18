#!/usr/bin/env node
// V2: read-only formula experiment using verified compact player-game facts.
// Explicit opt-in; no provider calls, Official Pick writes, or model changes.
import {createClient} from '@supabase/supabase-js';
import {buildV2Examples,evaluateV2,NBA_FORMULA_LAB_V2,CANDIDATES} from '../src/lib/nba/goat-formula-lab-v2.mjs';
const get=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const execute=process.argv.includes('--execute');
const season=Number(get('season','2026')),mode=get('mode','RETROSPECTIVE_RECONSTRUCTED');
const trainFrom=get('train-from','2026-11-08'),trainThrough=get('train-through','2026-11-12');
const holdoutFrom=get('holdout-from','2026-11-13'),holdoutThrough=get('holdout-through','2026-11-15');
if(season!==2026||!['RETROSPECTIVE_RECONSTRUCTED','PROSPECTIVE_ASOF_VERIFIED'].includes(mode)||
 [trainFrom,trainThrough,holdoutFrom,holdoutThrough].some(s=>!/^2026-\d{2}-\d{2}$/.test(s))||
 trainThrough>=holdoutFrom)throw Error('INVALID_RESEARCH_OPTIONS');
const settings={version:NBA_FORMULA_LAB_V2,mode,season,trainFrom,trainThrough,holdoutFrom,holdoutThrough,
 formulaCandidates:CANDIDATES,readOnly:true,goatProviderCalls:0,productionModelWrites:0,officialPickWrites:0};
if(!execute){console.log(JSON.stringify({status:'DRY_RUN_NO_NETWORK',...settings}));process.exit(0)}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('SERVER_ONLY_CREDENTIALS_REQUIRED');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),facts=[];
for(let page=0;page<20;page++){
 const {data,error}=await db.from('nba_goat_player_game_research_v1')
  .select('season,provider_game_id,player_id,game_datetime,source_captured_at,projection_eligible,minutes_played,pts,reb,ast,fg3m')
  .eq('season',season).order('provider_game_id').order('player_id').range(page*1000,page*1000+999);
 if(error||!data)throw Error('GOAT_COMPACT_FACTS_UNAVAILABLE');
 facts.push(...data);
 if(data.length<1000)break;
 if(page===19)throw Error('SOURCE_SCAN_LIMIT_EXCEEDED');
}
const samples=buildV2Examples(facts,{mode});
const markets=evaluateV2(samples,{mode,trainFrom,trainThrough,holdoutFrom,holdoutThrough});
console.log(JSON.stringify({status:'RESEARCH_ONLY',...settings,sourceFactRows:facts.length,independentPlayerGameMarketObservations:samples.length,markets,
 warning:'Reconstructed and previously inspected dates; no independent new holdout. This is not ROI or a betting recommendation.'}));
