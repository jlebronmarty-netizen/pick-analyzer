import {NextRequest,NextResponse} from 'next/server';
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createClient} from '@supabase/supabase-js';

export const runtime='nodejs';export const dynamic='force-dynamic';export const revalidate=0;export const maxDuration=300;
const BUCKET='nba-goat-2026-private',SEASON=2026,FIRST='2026-10-20',LAST='2026-11-14';
const CALL_CAP=30,GAME_CAP=3,MAX_PAGES=20,MAX_JSON=100*1024*1024,MAX_GZIP=20*1024*1024;
const environmentOK=()=>process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_TARGET_ENV==='goat-research'&&Boolean(process.env.CRON_SECRET);
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const secretSign=(ts:string)=>createHmac('sha256',process.env.CRON_SECRET!).update('goat-season-core-2026:'+ts).digest('hex');
function authorizedToken(t:unknown){
 if(typeof t!=='string')return false;
 const m=/^(\d{13})\.([a-f0-9]{64})$/.exec(t);
 if(!m||Math.abs(Date.now()-Number(m[1]))>10*60*1000)return false;
 return timingSafeEqual(Buffer.from(m[2],'hex'),Buffer.from(secretSign(m[1]),'hex'));
}
export async function GET(){
 if(!environmentOK())return json({status:'RESEARCH_ENV_ONLY'},404);
 const ts=String(Date.now()),ticket=ts+'.'+secretSign(ts),nonce=randomBytes(16).toString('base64');
 const page='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NBA GOAT: temporada 2026-27</title></head><body style="font:16px system-ui;margin:3rem auto;max-width:730px;padding:0 1rem"><h2>NBA GOAT · Temporada 2026–27</h2><p><strong>Extracción controlada:</strong> próximos tres partidos finales pendientes entre el 20 de octubre y el 14 de noviembre de 2026. Máximo 30 llamadas GOAT por ejecución. Solo boxscores y estadísticas avanzadas. No cambia modelos ni crons.</p><p>Una segunda ejecución completa otro grupo de partidos. No ejecutes dos veces simultáneamente. Los archivos se guardan en Storage privado.</p><form id="run"><button>Ejecutar próximo lote de 3 partidos</button></form><pre style="white-space:pre-wrap;word-break:break-word" id="result"></pre><script nonce="'+nonce+'">document.getElementById("run").onsubmit=async e=>{e.preventDefault();if(!confirm("¿Ejecutar el siguiente lote de hasta tres partidos, con un máximo de 30 llamadas GOAT?"))return;const b=e.target.querySelector("button");b.disabled=true;document.getElementById("result").textContent="Ejecutando el lote...";try{const r=await fetch(location.pathname,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({ticket:"'+ticket+'"})});document.getElementById("result").textContent=JSON.stringify(await r.json(),null,2)}catch{document.getElementById("result").textContent="No se pudo leer el resultado"};};</script></body></html>';
 return new NextResponse(page,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'"}});
}
export async function POST(req:NextRequest){
 if(!environmentOK())return json({status:'RESEARCH_ENV_ONLY'},404);
 if(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('content-type')?.split(';')[0]!=='application/json')return json({status:'FORBIDDEN'},403);
 let body:any;try{body=await req.json()}catch{return json({status:'BAD_REQUEST'},400)}
 if(!authorizedToken(body?.ticket))return json({status:'FORBIDDEN'},403);
 const key=process.env.BALLDONTLIE_API_KEY?.trim(),url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),role=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 if(!key||!url||!role)return json({status:'SERVER_CREDENTIALS_UNAVAILABLE'},503);
 const db=createClient(url,role,{auth:{persistSession:false,autoRefreshToken:false}}),store=db.storage.from(BUCKET);
 const {data:bucket,error:bErr}=await db.storage.getBucket(BUCKET);
 if(bErr||!bucket||bucket.public!==false||bucket.file_size_limit!==20971520)return json({status:'PRIVATE_ARCHIVE_BUCKET_UNVERIFIED'},503);
 const {data:prior,error:mErr}=await db.from('nba_goat_season_archive_v1').select('provider_game_id,dataset_key').eq('season',SEASON).in('dataset_key',['player_stats','advanced_v2']).limit(1000);
 if(mErr||!prior||prior.length===1000)return json({status:'ARCHIVE_MANIFEST_READ_UNAVAILABLE'},503);
 const completed=new Set(prior.map(r=>r.provider_game_id+':'+r.dataset_key));
 let calls=0;
 const dataGet=async(path:string,params:Record<string,string>,maxRows=10000)=>{
  let cursor:string|null=null;const seen=new Set<string>(),rows:any[]=[];
  for(let page=0;page<MAX_PAGES;page++){
   if(calls>=CALL_CAP)throw Error('PROVIDER_CALL_CAP');calls++;
   const endpoint=new URL(path,'https://api.balldontlie.io');
   for(const [k,v] of Object.entries(params))endpoint.searchParams.append(k,v);
   endpoint.searchParams.set('per_page','100');if(cursor!==null)endpoint.searchParams.set('cursor',cursor);
   const response=await fetch(endpoint,{headers:{Authorization:key!,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('PROVIDER_HTTP_'+response.status);
   const payload=await response.json();if(!Array.isArray(payload?.data))throw Error('PROVIDER_RESPONSE_INVALID');
   rows.push(...payload.data);if(rows.length>maxRows)throw Error('ROWS_BOUND_EXCEEDED');
   const next=payload?.meta?.next_cursor??null;
   if(next===null)return rows;
   if(seen.has(String(next)))throw Error('REPEATED_CURSOR');
   seen.add(String(next));cursor=String(next);
  }
  throw Error('PAGE_BOUND_EXCEEDED');
 };
 let games:any[];
 try{
  games=await dataGet('/v1/games',{'seasons[]':'2026',start_date:FIRST,end_date:LAST},1000);
 }catch(e){return json({status:'INVENTORY_FAILED',callsUsed:calls,reason:String((e as Error).message).slice(0,90)},502)}
 const finals=[...new Map(games.filter(g=>Number(g.id)>0&&Number(g.season)===SEASON&&g.date>=FIRST&&g.date<=LAST&&String(g.status_state).toLowerCase()==='final'&&g.postponed===false&&g.postseason===false).map(g=>[Number(g.id),g])).values()].sort((a,b)=>a.date.localeCompare(b.date)||Number(a.id)-Number(b.id));
 const pending=finals.filter(g=>!completed.has(g.id+':player_stats')||!completed.has(g.id+':advanced_v2'));
 if(!pending.length)return json({status:'CORE_SEASON_ARCHIVED',inventoryFinals:finals.length,callsUsed:calls});
 const batch=pending.slice(0,GAME_CAP),ident=batch.map(g=>g.id).join('-'),lockName='batches/season-2026-core/'+ident+'.lock.json';
 const lock=await store.upload(lockName,Buffer.from(JSON.stringify({at:new Date().toISOString(),gameIds:batch.map(g=>g.id),version:'CORE_SEASON_2026_BOUNDED_V1'})),{contentType:'application/json',upsert:false});
 if(lock.error)return json({status:'BATCH_ALREADY_CLAIMED_OR_STORAGE_UNAVAILABLE',batch:batch.map(g=>g.id),callsUsed:calls,nextStep:'Manual review; do not erase the lock automatically'},409);
 const results:any[]=[],errors:any[]=[];
 async function save(game:any,dataset:string,data:any[],originalAt?:string){
  if(data.length<10)throw Error('INSUFFICIENT_ROWS');
  const raw=Buffer.from(JSON.stringify(data));
  if(raw.length>MAX_JSON)throw Error('JSON_TOO_LARGE');
  const digest=createHash('sha256').update(raw).digest('hex'),gzip=gzipSync(raw,{level:6});
  if(gzip.length>MAX_GZIP)throw Error('COMPRESSED_FILE_TOO_LARGE');
  const path=[SEASON,game.id,dataset,digest+'.json.gz'].join('/');
  const put=await store.upload(path,gzip,{contentType:'application/gzip',upsert:false});
  if(put.error){
    const existing=await store.download(path);
    if(existing.error||!existing.data)throw Error('STORAGE_UPLOAD_FAILED');
    const restored=gunzipSync(Buffer.from(await existing.data.arrayBuffer()));
    if(createHash('sha256').update(restored).digest('hex')!==digest)throw Error('STORAGE_HASH_MISMATCH');
  }
  const {error}=await db.from('nba_goat_season_archive_v1').upsert({
   season:SEASON,provider_game_id:Number(game.id),dataset_key:dataset,provider:'balldontlie',
   source_captured_at:originalAt??new Date().toISOString(),game_date:game.date,
   response_sha256:digest,data_count:data.length,storage_bucket:BUCKET,
   storage_object_path:path,compressed_bytes:gzip.length,json_bytes:raw.length
  },{onConflict:'season,provider_game_id,dataset_key'});
  if(error)throw Error('MANIFEST_WRITE_FAILED');
  results.push({gameId:game.id,dataset,rows:data.length,compressedBytes:gzip.length,sha256:digest});
 }
 outer:for(const game of batch){
  for(const kind of ['player_stats','advanced_v2']){
   if(completed.has(game.id+':'+kind))continue;
   try{
    let rows:any[],capturedAt:string|undefined;
    if(kind==='player_stats'){
     const context=await db.from('nba_game_context_v2').select('player_stats,player_stats_captured_at').eq('provider_game_id',game.id).maybeSingle();
     if(context.error)throw Error('CONTEXT_READ_FAILED');
     const cached=context.data?.player_stats?.data;
     if(Array.isArray(cached)&&cached.length>=10&&cached.every((p:any)=>Number(p?.game?.id)===Number(game.id))){
      rows=cached;capturedAt=context.data?.player_stats_captured_at??undefined;
     }else rows=await dataGet('/v1/stats',{'game_ids[]':String(game.id)},200);
     if(rows.some((x:any)=>Number(x?.game?.id)!==Number(game.id)||String(x?.game?.status_state).toLowerCase()!=='final'))throw Error('PLAYER_GAME_NOT_FINAL');
    }else{
     rows=await dataGet('/nba/v2/stats/advanced',{'game_ids[]':String(game.id),period:'0'},200);
     if(rows.some((x:any)=>Number(x?.game?.id)!==Number(game.id)||Number(x?.period)!==0))throw Error('ADVANCED_GAME_MISMATCH');
    }
    await save(game,kind,rows,capturedAt);
   }catch(err){
    const reason=String((err as Error).message);
    errors.push({gameId:game.id,dataset:kind,reason:reason.slice(0,100)});
    if(reason==='PROVIDER_CALL_CAP'||reason.startsWith('PROVIDER_HTTP_401')||reason.startsWith('PROVIDER_HTTP_403'))break outer;
   }
  }
 }
 return json({status:errors.length?'PARTIAL':'COMPLETED',batchGameIds:batch.map(g=>g.id),season:SEASON,dateRange:[FIRST,LAST],inventoryFinals:finals.length,remainingBefore:pending.length,callsUsed:calls,callsMax:CALL_CAP,files:results,errors,productionModelsChanged:false,operationalTablesWritten:false});
}