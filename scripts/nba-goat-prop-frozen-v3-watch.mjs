#!/usr/bin/env node
// Safe, read-only forward as-of research audit of two PRE-FROZEN GOAT V3 formulas.
// Never changes official models or makes GOAT provider requests.
import {createClient} from '@supabase/supabase-js';
import {buildV3Examples} from '../src/lib/nba/goat-formula-lab-v3.mjs';
import {FROZEN_FORMULAS,checkFrozenV3} from '../src/lib/nba/goat-formula-v3-frozen-validation.mjs';
const execute=process.argv.includes('--execute');
const config={version:'NBA_GOAT_FROZEN_V3_FORWARD_ASOF',season:2026,
 mode:'PROSPECTIVE_ASOF_VERIFIED',start:'2026-11-16',candidates:FROZEN_FORMULAS,
 source:'nba_goat_player_game_research_v1',writes:0,providerCalls:0,officialModelChanges:0};
if(!execute){console.log(JSON.stringify({status:'DRY_RUN_NO_NETWORK',...config}));process.exit(0)}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('SERVER_CREDENTIALS_REQUIRED');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),facts=[];
for(let page=0;page<20;page++){
 const {data,error}=await db.from('nba_goat_player_game_research_v1')
  .select('season,provider_game_id,player_id,game_datetime,source_captured_at,projection_eligible,minutes_played,pts,reb,ast,fg3m')
  .eq('season',2026).order('provider_game_id').order('player_id').range(page*1000,page*1000+999);
 if(error||!data)throw Error('COMPACT_FACTS_UNAVAILABLE');
 facts.push(...data);
 if(data.length<1000)break;
 if(page===19)throw Error('COMPACT_FACT_SCAN_CAP');
}
const examples=buildV3Examples(facts,{mode:'PROSPECTIVE_ASOF_VERIFIED'});
const reports=checkFrozenV3(examples);
console.log(JSON.stringify({status:'READ_ONLY_FROZEN_RESEARCH',...config,sourceRows:facts.length,
 futureGameCount:new Set(examples.filter(e=>e.day>=config.start).map(e=>e.gameId)).size,reports,
 caveat:'As-of replay does not certify recorded pregame predictions or profitability; human review needed for promotion.'}));
