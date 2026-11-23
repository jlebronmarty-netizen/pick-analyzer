import 'server-only';
import {createHash} from 'node:crypto';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {localDay} from '@/lib/nba-archive-core.mjs';
import {originalContext} from '@/lib/nba/decision-storage-original.mjs';
import {prepareArchivedPlayerMaterialization,PLAYER_MATERIALIZER_VERSION,PLAYER_MATERIALIZER_CAP} from '@/lib/nba/archived-player-materializer-core.mjs';

const read=(r:any)=>{if(r.error)throw Error('NBA_MATERIALIZER_READ_FAILED');return r.data??[];};
const jobId=(slot:number)=>{const h=createHash('sha256').update(PLAYER_MATERIALIZER_VERSION+':'+slot).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};
// Existing archived operational JSON only. This runs after the existing NBA stages.
// It never calls a sports provider, rewrites a compact, or retrodates knowledge time.
export async function materializeNbaArchivedPlayerHistory({now=new Date(),db:providedDb,enabled=process.env.NBA_ARCHIVED_PLAYER_MATERIALIZATION_ENABLED==='true',budgetMs=55000}:{now?:Date;db?:SupabaseClient;enabled?:boolean;budgetMs?:number}={}){
 if(!enabled)return {status:'DISABLED',providerCalls:0,materializedGames:0,insertedRows:0};
 if(!Number.isFinite(budgetMs)||budgetMs<20000)return {status:'DEFERRED_CRON_BUDGET',providerCalls:0,materializedGames:0,insertedRows:0};
 const hardDeadline=Date.now()+Math.min(budgetMs,55000),deadline=hardDeadline-8000;
 let requestDeadline=deadline;
 // A private per-run client bounds every HTTP operation, including Storage upload.
 // The shared application client and unrelated cron stages are unchanged.
 const db=providedDb??createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{
  auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{
   const signals=[AbortSignal.timeout(Math.max(1,Math.min(8000,requestDeadline-Date.now())))];
   if(init?.signal)signals.push(init.signal);
   return fetch(input,{...init,signal:AbortSignal.any(signals)});
  }}
 });
 const asOf=now.toISOString(),since=new Date(now.getTime()-61*86400000).toISOString(),slot=Math.floor(now.getTime()/1800000),id=jobId(slot);
 const summary:any={version:PLAYER_MATERIALIZER_VERSION,providerCalls:0,materializedGames:0,insertedRows:0,considered:0,skipped:[],errors:[],gameCap:PLAYER_MATERIALIZER_CAP,asOf};
 const claim=await db.from('sports_sync_jobs').insert({id,job_type:'nba_archived_player_materialization_v1',sport_key:'basketball_nba',league_key:'nba',provider:'balldontlie',status:'running',started_at:asOf,
  metadata:{version:PLAYER_MATERIALIZER_VERSION,slot,providerCalls:0,gameCap:PLAYER_MATERIALIZER_CAP,materialized_games:[],sourceKind:'STORED_OPERATIONAL_JSON',officialPickDelta:0}}).abortSignal(AbortSignal.timeout(8000));
 if(claim.error){if(claim.error.code==='23505')return {...summary,status:'ALREADY_CLAIMED'};throw Error('NBA_MATERIALIZER_CLAIM_FAILED');}
 try{
  const meta=read(await db.from('nba_game_context_v2').select('game_id,provider_game_id,provider,source_version,player_stats_captured_at')
   .not('player_stats','is',null).gte('player_stats_captured_at',since).lte('player_stats_captured_at',asOf)
   .order('player_stats_captured_at',{ascending:false}).order('game_id').limit(1000).abortSignal(AbortSignal.timeout(8000)));
  const manifests=read(await db.from('nba_goat_season_archive_v1').select('provider_game_id,season')
   .eq('dataset_key','player_stats').gte('game_date',since.slice(0,10)).order('provider_game_id').limit(1000).abortSignal(AbortSignal.timeout(8000)));
  if(meta.length>=1000||manifests.length>=1000)throw Error('NBA_MATERIALIZER_SCAN_BOUND_REVIEW_REQUIRED');
  const have=new Set(manifests.map((m:any)=>m.provider_game_id)),seen=new Set<number>(),duplicates=new Set<number>();
  for(const c of meta){if(seen.has(c.provider_game_id))duplicates.add(c.provider_game_id);seen.add(c.provider_game_id);}
  const pending=meta.filter((c:any)=>!have.has(c.provider_game_id));
  summary.pendingArchivedContexts=pending.length;
  const previous=read(await db.from('sports_sync_jobs').select('metadata')
   .eq('job_type','nba_archived_player_materialization_v1').neq('id',id).order('started_at',{ascending:false}).limit(1).abortSignal(AbortSignal.timeout(8000)));
  const cursor=previous[0]?.metadata?.summary?.lastConsideredGame;
  const cursorIndex=pending.findIndex((c:any)=>c.provider_game_id===cursor);
  const start=cursorIndex>=0?cursorIndex+1:0;
  const queue=[...pending.slice(start),...pending.slice(0,start)].slice(0,12);
  const schedules=new Map<string,any>();
  for(const receipt of queue){
   if(summary.materializedGames>=PLAYER_MATERIALIZER_CAP||Date.now()>deadline)break;
   summary.considered++;
   const gid=receipt.provider_game_id;
   summary.lastConsideredGame=gid;
   if(duplicates.has(gid)){summary.skipped.push({game:gid,reason:'CONTEXT_NOT_UNIQUE'});continue;}
   try{
    const context=read(await db.from('nba_game_context_v2').select('game_id,provider_game_id,provider,source_version,player_stats_captured_at,player_stats')
     .eq('game_id',receipt.game_id).eq('provider_game_id',gid).lte('player_stats_captured_at',asOf).limit(2).abortSignal(AbortSignal.timeout(8000)));
    if(context.length!==1)throw Error('NBA_MATERIALIZER_CONTEXT_CHANGED');
    const c=context[0],tip=c.player_stats?.data?.[0]?.game?.datetime;
    if(!Number.isFinite(Date.parse(tip??'')))throw Error('NBA_MATERIALIZER_GAME_TIME_MISSING');
    const day=localDay(new Date(tip));
    if(!schedules.has(day)){
     const page=read(await db.from('nba_market_schedules_v1').select('snapshot_id,source_received_at,recorded_at,payload')
      .eq('date_local',day).lte('recorded_at',asOf).lte('source_received_at',asOf).order('source_received_at',{ascending:false})
      .limit(1).abortSignal(AbortSignal.timeout(8000)));
     schedules.set(day,page[0]??null);
    }
    const prepared=prepareArchivedPlayerMaterialization({context:c,schedule:schedules.get(day),asOf});
    const existing=read(await db.from('nba_goat_player_game_research_v1').select('player_id').eq('season',prepared.manifest.season)
     .eq('provider_game_id',gid).limit(1).abortSignal(AbortSignal.timeout(8000)));
    if(existing.length)throw Error('NBA_MATERIALIZER_EXISTING_PARTIAL_REQUIRES_REVIEW');
    const bucket=db.storage.from(prepared.manifest.storage_bucket),path=prepared.manifest.storage_object_path;
    const upload=await bucket.upload(path,prepared.compressed,{contentType:'application/gzip',upsert:false});
    if(upload.error&&String((upload.error as any).statusCode)!=='409')throw Error('NBA_MATERIALIZER_OBJECT_UPLOAD_FAILED');
    // Verify the actual persisted bytes, including an object left by an interrupted attempt.
    const stored=await bucket.download(path);
    if(stored.error||!stored.data||!originalContext(Buffer.from(await stored.data.arrayBuffer()),prepared.manifest))
     throw Error('NBA_MATERIALIZER_OBJECT_READBACK_FAILED');
    const committed=await db.rpc('materialize_nba_archived_player_game_v1',{p_job_id:id,p_game_id:gid,
     p_source_captured_at:c.player_stats_captured_at,p_schedule_snapshot_id:prepared.scheduleSnapshotId,
     p_payload_text:prepared.payloadText,p_response_sha256:prepared.manifest.response_sha256,
     p_compressed_bytes:prepared.manifest.compressed_bytes,p_as_of:asOf}).abortSignal(AbortSignal.timeout(8000));
    if(committed.error)throw Error('NBA_MATERIALIZER_TRANSACTION_REJECTED');
    if(committed.data?.status==='MATERIALIZED'){
     summary.materializedGames++;summary.insertedRows+=Number(committed.data.inserted_rows??0);
    }else if(committed.data?.status!=='ALREADY_MATERIALIZED')throw Error('NBA_MATERIALIZER_COMMIT_UNVERIFIED');
   }catch(e){summary.skipped.push({game:gid,reason:e instanceof Error?e.message:'NBA_MATERIALIZER_GAME_FAILED'});}
  }
  summary.remainingArchivedContexts=Math.max(0,pending.length-summary.materializedGames);
 }catch(e){summary.errors.push(e instanceof Error?e.message:'NBA_MATERIALIZER_FAILED');}
 // The RPC owns the durable inserted-row count; never replace it with a client
 // estimate after a lost response. Preserve its per-game hashes and timestamps.
 requestDeadline=hardDeadline;
 const ledger=await db.from('sports_sync_jobs').select('metadata,records_inserted').eq('id',id).abortSignal(AbortSignal.timeout(4000)).single();
 if(ledger.error)throw Error('NBA_MATERIALIZER_LEDGER_READ_FAILED');
 summary.insertedRows=Number(ledger.data.records_inserted??0);
 summary.materializedGames=Array.isArray(ledger.data.metadata?.materialized_games)?ledger.data.metadata.materialized_games.length:0;
 summary.remainingArchivedContexts=Math.max(0,Number(summary.pendingArchivedContexts??0)-summary.materializedGames);
 const status=summary.errors.length?'FAILED':summary.skipped.length?'PARTIAL':summary.materializedGames?'COMPLETED':'NO_NEW_ARCHIVED_GAMES';
 const finish=await db.from('sports_sync_jobs').update({status:summary.errors.length?'failed':summary.skipped.length?'partial':'completed',completed_at:new Date().toISOString(),
  metadata:{...ledger.data.metadata,summary}}).eq('id',id).abortSignal(AbortSignal.timeout(4000));
 if(finish.error)throw Error('NBA_MATERIALIZER_LEDGER_WRITE_FAILED');
 console.info('NBA_ARCHIVED_PLAYER_MATERIALIZATION',JSON.stringify({status,...summary}));
 return {status,...summary};
}
