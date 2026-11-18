import {NextRequest,NextResponse} from 'next/server';
import {privateHost} from '@/lib/nba-production-feed.mjs';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {buildPropPanelRows,buildDirectionalResearchRows,PANEL_MARKETS,PANEL_VERSION,DIRECTION_VERSION} from '@/lib/nba/nba-props-panel-core.mjs';
export const dynamic='force-dynamic';export const runtime='nodejs';export const revalidate=0;export const maxDuration=60;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(request:NextRequest){
 const env=process.env;
 const permitted=env.VERCEL_ENV==='production'||env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF==='feat/nba-props-visibility-20261117';
 if(!permitted||!privateHost(request,env)||!request.headers.get('x-vercel-oidc-token'))
  return reply({status:'PRIVATE_DEPLOYMENT_REQUIRED'},401);
 const id=Number(request.nextUrl.searchParams.get('game_id'));
 const market=request.nextUrl.searchParams.get('market');
 if(!Number.isSafeInteger(id)||id<1||!PANEL_MARKETS.includes(market as string)||request.nextUrl.searchParams.size!==2)
  return reply({status:'INVALID_GAME_OR_MARKET'},400);
 const at=new Date().toISOString(),cutoff=new Date(Date.now()-48*3600000).toISOString();
 // Reuse stored GOAT schedule; no provider call, historical rescan, or missing-game inference.
 const schedules=await db.from('nba_market_schedules_v1').select('payload,source_received_at')
  .gte('source_received_at',cutoff).order('source_received_at',{ascending:false}).limit(120);
 if(schedules.error||!schedules.data)return reply({status:'NBA_SCHEDULE_ARCHIVE_UNAVAILABLE'},503);
 const game=(schedules.data as any[]).flatMap(s=>Array.isArray(s.payload?.data?.games)?s.payload.data.games:[])
  .find(g=>Number(g?.id)===id);
 if(!game)return reply({status:'NO_VERIFIED_GAME_IN_RECENT_ARCHIVE',version:PANEL_VERSION,rows:[],checkedAt:at});
 if(game.status_state!=='scheduled'||Date.parse(game.datetime)-Date.now()<600000)
  return reply({status:'NO_VERIFIED_UPCOMING_PREGAME_GAME',version:PANEL_VERSION,rows:[],checkedAt:at});
 // Get the latest pregame capture first; a 30-minute raw history can contain
 // thousands of repeated snapshots, not thousands of distinct betting contracts.
 const newest=await db.from('nba_market_quotes_v1')
  .select('source_received_at')
  .eq('provider_game_id',id).eq('market','props').eq('phase','PREGAME')
  .eq('statistic',market!)
  .gte('source_received_at',new Date(Date.now()-30*60000).toISOString())
  .order('source_received_at',{ascending:false}).limit(1);
 if(newest.error)return reply({status:'GOAT_PROPS_PRICE_ARCHIVE_UNAVAILABLE'},503);
 if(!newest.data?.length)return reply({status:'NO_FRESH_VERIFIED_PROP_QUOTES',version:PANEL_VERSION,rows:[],checkedAt:at});
 const latestAt=Date.parse(newest.data[0].source_received_at);
 if(!Number.isFinite(latestAt)||latestAt>Date.now()+1000)return reply({status:'INVALID_LATEST_QUOTE_TIMESTAMP',version:PANEL_VERSION,rows:[],checkedAt:at},503);
 // 90-second batch accommodates provider stat groups captured a few seconds apart.
 // Never silently accept partial, capped batches; fall back to PASS/no evaluation.
 const batchStart=new Date(latestAt-90000).toISOString();
 const q=await db.from('nba_market_quotes_v1')
  .select('quote_id,provider_game_id,player_id,market,statistic,side,line,american_odds,contract,period,phase,source_received_at')
  .eq('provider_game_id',id).eq('market','props').eq('phase','PREGAME')
  .eq('statistic',market!).in('side',['over','under'])
  .gte('source_received_at',batchStart).lte('source_received_at',newest.data[0].source_received_at)
  .order('source_received_at',{ascending:false}).limit(1000);
 if(q.error||!q.data)return reply({status:'GOAT_PROPS_PRICE_ARCHIVE_UNAVAILABLE'},503);
 if(q.data.length>=1000)return reply({status:'QUOTE_BATCH_LIMIT_REVIEW_REQUIRED',version:PANEL_VERSION,rows:[],checkedAt:at},503);
 const ids=[...new Set(q.data.map(x=>Number(x.player_id)).filter(Number.isSafeInteger))];
 if(!ids.length)return reply({status:'NO_FRESH_VERIFIED_PROP_QUOTES',version:PANEL_VERSION,rows:[],checkedAt:at});
 const facts:any[]=[];
 for(let i=0;i<ids.length;i+=30){
  const chunk=ids.slice(i,i+30);
  // Filter per player to avoid a full raw archive scan. 2026 compact facts only.
  const r=await db.from('nba_goat_player_game_research_v1')
   .select('player_id,provider_game_id,game_datetime,source_captured_at,projection_eligible,pts,reb,ast,fg3m')
   .eq('season',2026).in('player_id',chunk).eq('projection_eligible',true)
   .order('game_datetime',{ascending:false}).limit(900);
  if(r.error||!r.data)return reply({status:'GOAT_COMPACT_HISTORY_UNAVAILABLE',version:PANEL_VERSION,rows:[],checkedAt:at},503);
  if(r.data.length>=900)return reply({status:'PLAYER_HISTORY_SCAN_LIMIT_REVIEW_REQUIRED',version:PANEL_VERSION,rows:[],checkedAt:at},503);
  facts.push(...r.data);
 }
 const research=buildPropPanelRows({game,quotes:q.data,facts,asOf:at});
 return reply({...research,version:PANEL_VERSION,directionVersion:DIRECTION_VERSION,directionalRows:buildDirectionalResearchRows(research.rows),providerGameId:id,checkedAt:at,
  archivedQuoteCount:q.data.length,latestQuoteAt:newest.data[0].source_received_at,quoteBatchWindowSeconds:90,selectedMarket:market,historyRowsExamined:facts.length,providerCalls:0,databaseWrites:0,
  warning:'SHADOW descriptive tendencies (OVER/UNDER/PASS) only, never betting recommendations. The distance thresholds are exploratory, not trained or validated. Price feeds are not verified regional book menus. No calibrated probabilities, EV, recommended picks, injury adjustment or sportsbook settlement certification.'});
}
