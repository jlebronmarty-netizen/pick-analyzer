#!/usr/bin/env node
// Read-only audit. No provider calls, model writes, fixture changes, or scheduled jobs.
const execute=process.argv.includes('--execute');
const windows=[
 {key:'nba_market_archive',sport:'NBA',table:'nba_market_schedules_v1',column:'source_received_at',maxAgeHours:2,policy:'ACTIVE'},
 {key:'nhl_free_raw',sport:'NHL',table:'nhl_free_source_v1',column:'captured_at',maxAgeHours:2,policy:'ACTIVE'},
 {key:'ncaab_free_raw',sport:'NCAAB',table:'ncaab_daily_source_v1',column:'captured_at',maxAgeHours:8,policy:'ACTIVE'},
 {key:'nfl_bsn_free_runs',sport:'NFL/BSN',table:'free_sports_runs_v1',column:'slot',maxAgeHours:8,policy:'SEASONAL_CHECK'},
 {key:'nba_goat_core_archive',sport:'NBA',table:'nba_goat_season_archive_v1',column:'source_captured_at',maxAgeHours:null,policy:'RESEARCH_NOT_SCHEDULED'},
 {key:'nba_props_compact',sport:'NBA',table:'nba_goat_player_game_research_v1',column:'materialized_at',maxAgeHours:null,policy:'RESEARCH_NOT_SCHEDULED'}
];
const names=new Set();
for(const w of windows){if(names.has(w.key))throw Error('DUPLICATE_SOURCE');names.add(w.key)}
if(!execute){console.log(JSON.stringify({status:'DRY_RUN',sources:windows,providerCalls:0,databaseWrites:0,officialModelWrites:0}));process.exit(0)}
const {createClient}=await import('@supabase/supabase-js');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('SERVER_SIDE_CREDS_REQUIRED');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const findings=[];
for(const spec of windows){
 const r=await db.from(spec.table).select(spec.column,{head:false,count:'exact'}).order(spec.column,{ascending:false}).limit(1);
 if(r.error){findings.push({source:spec.key,sport:spec.sport,status:'UNKNOWN_READ_FAILED',policy:spec.policy});continue;}
 const latest=r.data?.[0]?.[spec.column]??null,ageHours=latest?Number(((Date.now()-Date.parse(String(latest)))/3600000).toFixed(2)):null;
 findings.push({source:spec.key,sport:spec.sport,count:r.count??null,latestAt:latest,ageHours,
  policy:spec.policy,status:spec.policy==='RESEARCH_NOT_SCHEDULED'?'NOT_YET_AUTOMATED':
   latest===null?'NO_CAPTURE_YET':
   !Number.isFinite(ageHours)?'INVALID_TIMESTAMP':
   ageHours>spec.maxAgeHours?'LATE_REVIEW_REQUIRED':'RECENT'});
}
console.log(JSON.stringify({status:'READ_ONLY_MULTISPORT_ARCHIVE_AUDIT',checkedAt:new Date().toISOString(),
 findings,providerCalls:0,databaseWrites:0,officialModelWrites:0,notes:[
 'Freshness is not proof of full daily coverage or correct settling',
 'Seasonal and paused leagues require explicit expected-calendar configuration',
 'No new cron or ingestion is activated by this audit',
 'Separate NBA GOAT research archive remains manual until explicitly deployed and verified'
]}));
