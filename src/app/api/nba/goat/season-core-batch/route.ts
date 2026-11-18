import {NextRequest,NextResponse} from 'next/server';
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createClient} from '@supabase/supabase-js';

export const runtime='nodejs';export const dynamic='force-dynamic';export const revalidate=0;export const maxDuration=300;
const BUCKET='nba-goat-2026-private',SEASON=2026,FIRST='2026-10-20',LAST=new Date().toLocaleDateString('en-CA',{timeZone:'America/Puerto_Rico'});
const CALL_CAP=50,GAME_CAP=10,MAX_PAGES=30,MAX_JSON=100*1024*1024,MAX_GZIP=20*1024*1024;
const environmentOK=()=>process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_TARGET_ENV==='goat-research'&&Boolean(process.env.CRON_SECRET);
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const secretSign=(ts:string)=>createHmac('sha256',process.env.CRON_SECRET!).update('goat-season-core-2026:'+ts).digest('hex');
function authorizedToken(t:unknown){
 if(typeof t!=='string')return false;
 const m=/^(\d{13})\.([a-f0-9]{64})$/.exec(t);
 if(!m||Math.abs(Date.now()-Number(m[1]))>10*60*1000)return false;
 return timingSafeEqual(Buffer.from(m[2],'hex'),Buffer.from(secretSign(m[1]),'hex'));
}
export async function GET(req:NextRequest){
 if(!environmentOK())return json({status:'RESEARCH_ENV_ONLY'},404);
 const ts=String(Date.now()),ticket=ts+'.'+secretSign(ts),nonce=randomBytes(16).toString('base64');
 if(req.nextUrl.searchParams.get('ticket')==='1')return json({ticket,expiresInSeconds:600});
 const page="\n<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>NBA GOAT | Descarga de temporada</title></head>\n<body style=\"font:16px system-ui;margin:2.5rem auto;max-width:760px;padding:0 1rem;line-height:1.5\">\n<h2>NBA GOAT — descarga automática de la temporada 2026–27</h2>\n<p>Desde el 20 de octubre hasta el 15 de noviembre de 2026. Un clic procesa los partidos finales pendientes por lotes de hasta diez, con un máximo de 50 llamadas por lote y un límite adicional para toda esta sesión. El progreso se conserva en Supabase Storage privado.</p>\n<p><strong>No cambia</strong> modelos, predicciones oficiales, cron jobs ni otras tablas operativas. Esta fase incluye boxscores y estadísticas avanzadas; otras familias GOAT se archivarán en una fase posterior.</p>\n<p><strong>Mantén esta pestaña abierta mientras se ejecuta.</strong> Si se cierra o se interrumpe la conexión, los archivos terminados permanecen guardados y podrás reanudar el proceso desde aquí. No ejecutes otra sesión simultáneamente.</p>\n<div style=\"display:flex;gap:.75rem;flex-wrap:wrap\">\n<button id=\"start\" style=\"padding:.8rem 1rem\">Descargar toda la temporada automáticamente</button>\n<button id=\"stop\" type=\"button\" disabled style=\"padding:.8rem 1rem\">Detener después del lote actual</button>\n<button id=\"retry\" type=\"button\" style=\"padding:.8rem 1rem\">Revisar estadísticas avanzadas incompletas</button>\n</div>\n<p id=\"status\" role=\"status\" aria-live=\"polite\">Listo para comenzar, sin llamadas al proveedor.</p>\n<pre id=\"result\" style=\"white-space:pre-wrap;word-break:break-word;max-height:32rem;overflow:auto;background:#111;color:#f1f1f1;padding:1rem;border-radius:8px\"></pre>\n<script nonce=\""+nonce+"\">\n(function(){\n const start=document.getElementById(\"start\"),stop=document.getElementById(\"stop\"),retry=document.getElementById(\"retry\"),status=document.getElementById(\"status\"),log=document.getElementById(\"result\");\n const MAX_BATCHES=30,SESSION_CALL_CAP=600,MAX_SESSION_MS=75*60*1000;\n let running=false,stopRequested=false;\n const show=(message)=>{status.textContent=message;};\n const append=(message)=>{log.textContent+=message+\"\\n\";log.scrollTop=log.scrollHeight;};\n start.onclick=async function(){\n  if(running)return;\n  if(!confirm(\"¿Iniciar la descarga automática de los partidos finales pendientes? Hasta 600 solicitudes GOAT en total, repartidas en lotes; almacenamiento privado. Mantén abierta esta pestaña.\"))return;\n  running=true;stopRequested=false;start.disabled=true;stop.disabled=false;retry.disabled=true;log.textContent=\"\";\n  let batches=0,totalCalls=0,totalFiles=0,totalGames=0,completed=false;const since=Date.now();\n  try{\n   for(let n=0;n<MAX_BATCHES;n++){\n    if(stopRequested){show(\"Detenido a solicitud del usuario. Los archivos guardados se conservaron.\");break;}\n    if(Date.now()-since>MAX_SESSION_MS||totalCalls+50>SESSION_CALL_CAP){\n      show(\"Se alcanzó el límite de seguridad de la sesión. Puedes reanudar desde esta página.\");break;\n    }\n    show(\"Procesando lote \"+(n+1)+\"… Partidos archivados ahora: \"+totalGames+\" · Consultas GOAT: \"+totalCalls);\n    const ticketResponse=await fetch(location.pathname+\"?ticket=1\",{credentials:\"same-origin\",cache:\"no-store\"});\n    if(!ticketResponse.ok)throw Error(\"No se pudo renovar la autorización privada: HTTP \"+ticketResponse.status);\n    const ticketData=await ticketResponse.json();\n    if(typeof ticketData.ticket!==\"string\")throw Error(\"La autorización no es válida\");\n    const response=await fetch(location.pathname,{method:\"POST\",credentials:\"same-origin\",cache:\"no-store\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({ticket:ticketData.ticket})});\n    let data;try{data=await response.json()}catch{throw Error(\"El servidor no devolvió un resultado verificable; no repitas sin revisar el inventario\");}\n    if(!response.ok||data.status===\"PARTIAL\"||data.status===\"INVENTORY_FAILED\"){\n      append(\"Lote detenido: \"+JSON.stringify({http:response.status,status:data.status,callsUsed:data.callsUsed,errors:data.errors||data.reason||null,gameIds:data.batchGameIds||[]}));\n      show(\"Se detectó una incidencia. Detenido para proteger datos y llamadas; se conservaron los lotes completos.\");\n      break;\n    }\n    const calls=Number(data.callsUsed||0),files=Array.isArray(data.files)?data.files:[];\n    totalCalls+=calls;totalFiles+=files.length;\n    batches++;const games=new Set(files.map(f=>f.gameId));totalGames+=games.size;\n    if(data.status===\"CORE_SEASON_ARCHIVED\"){\n      completed=true;show(\"Archivo Core validado: todos los partidos finales disponibles para este corte están archivados.\");\n      append(\"TERMINADO: \"+JSON.stringify({inventoryFinals:data.inventoryFinals,sessionCalls:totalCalls,batches,totalFiles,totalGames}));break;\n    }\n    if(data.status===\"CORE_SEASON_REVIEW_REQUIRED\"){\n      completed=true;show(\"Los datos Core se archivaron, pero GOAT aún no ofrece estadísticas avanzadas completas en uno o más partidos.\");\n      append(\"REQUIERE_REVISIÓN: \"+JSON.stringify({gameIds:data.unverifiedGames,inventoryFinals:data.inventoryFinals,sessionCalls:totalCalls}));break;\n    }\n    if(![\"COMPLETED\",\"COMPLETED_WITH_REVIEW\"].includes(data.status)||!Array.isArray(data.batchGameIds)||!data.batchGameIds.length||!files.length){\n      append(\"Respuesta inesperada: \"+JSON.stringify(data));\n      show(\"Detenido: respuesta inesperada del proveedor o archivo.\");break;\n    }\n    append(\"Lote \"+batches+\": \"+data.batchGameIds.length+\" partidos; \"+calls+\" llamadas; \"+files.length+\" archivos; faltaban \"+data.remainingBefore+\" al empezar.\");\n    if(Array.isArray(data.warnings)&&data.warnings.length)append(\"AVISO - Datos avanzados por revisar: \"+JSON.stringify(data.warnings));\n    if(data.remainingBefore<=data.batchGameIds.length){\n      completed=true;\n      if(data.status===\"COMPLETED_WITH_REVIEW\"||(Array.isArray(data.unverifiedGames)&&data.unverifiedGames.length)){\n        show(\"Terminó la descarga, pero GOAT devolvió estadísticas avanzadas incompletas. Los casos permanecen marcados para revisión.\");\n        append(\"REQUIERE_REVISIÓN: \"+JSON.stringify({gameIds:data.unverifiedGames,batches,totalCalls,totalGames,totalFiles}));\n      }else{\n        show(\"Archivo Core completado. \"+totalGames+\" partidos procesados en esta sesión, \"+totalCalls+\" llamadas GOAT.\");\n        append(\"TERMINADO: \"+JSON.stringify({batches,totalCalls,totalGames,totalFiles}));\n      }\n      break;\n    }\n    if(totalCalls>=SESSION_CALL_CAP){show(\"Límite global de llamadas alcanzado. Los datos se conservan; puedes reanudar luego.\");break;}\n    await new Promise(resolve=>setTimeout(resolve,350));\n   }\n   if(!completed&&batches===MAX_BATCHES)show(\"Límite de 30 lotes alcanzado. Progreso guardado; puedes reanudar.\");\n  }catch(err){\n   append(\"Error: \"+String(err&&err.message||err));\n   show(\"Interrumpido por error de conexión o autorización. Los lotes completos siguen archivados.\");\n  }finally{running=false;start.disabled=false;stop.disabled=true;retry.disabled=false;}\n };\n stop.onclick=()=>{stopRequested=true;stop.disabled=true;show(\"Se detendrá después de que termine el lote en curso.\");};\n retry.onclick=async()=>{\n  if(running)return;\n  if(!confirm(\"¿Reintentar una vez hoy las estadísticas avanzadas que GOAT entregó incompletas? Máximo 50 llamadas. No modifica datos validados.\"))return;\n  running=true;start.disabled=true;retry.disabled=true;stop.disabled=true;\n  try{\n   show(\"Consultando estadísticas avanzadas pendientes…\");\n   const ticketResp=await fetch(location.pathname+\"?ticket=1\",{credentials:\"same-origin\",cache:\"no-store\"});\n   if(!ticketResp.ok)throw Error(\"No fue posible renovar la autorización privada\");\n   const info=await ticketResp.json();\n   const response=await fetch(location.pathname,{method:\"POST\",credentials:\"same-origin\",cache:\"no-store\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({ticket:info.ticket,retryUnverified:true})});\n   const data=await response.json();\n   append(\"REVISIÓN: \"+JSON.stringify(data));\n   if(!response.ok){show(\"Revisión detenida: \"+String(data.status||response.status));}\n   else if(data.status===\"NO_UNVERIFIED_PENDING\"){show(\"No quedan estadísticas avanzadas marcadas como incompletas.\");}\n   else if(data.status===\"COMPLETED\"&&Array.isArray(data.unverifiedGames)&&data.unverifiedGames.length===0){show(\"Las estadísticas avanzadas pendientes ahora están validadas.\");}\n   else{show(\"GOAT todavía tiene estadísticas avanzadas incompletas. Se conservaron como no verificadas y se puede volver a comprobar otro día.\");}\n  }catch(e){show(\"La revisión encontró un problema de conexión. No repitas hasta comprobar los registros.\");append(String(e));}\n  finally{running=false;start.disabled=false;retry.disabled=false;}\n };\n})();\n</script></body></html>";
 return new NextResponse(page,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'"}});
}
export async function POST(req:NextRequest){
 if(!environmentOK())return json({status:'RESEARCH_ENV_ONLY'},404);
 const scheduleName=req.headers.get('ce-vssschedulename');
 const scheduled=req.headers.get('ce-type')==='com.vercel.schedule.v1beta'&&
  ['nba-goat-core-daily-research','nba-goat-advanced-retry-research'].includes(scheduleName??'')&&
  req.headers.get('authorization')===('Bearer '+process.env.CRON_SECRET);
 // A separate bounded daily job rechecks only previously unverified advanced records.
 let body:any={retryUnverified:scheduled&&scheduleName==='nba-goat-advanced-retry-research'};
 if(!scheduled){
  if(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('content-type')?.split(';')[0]!=='application/json')return json({status:'FORBIDDEN'},403);
  try{body=await req.json()}catch{return json({status:'BAD_REQUEST'},400)}
  if(!authorizedToken(body?.ticket))return json({status:'FORBIDDEN'},403);
 }
 const callCap=scheduled?20:CALL_CAP;
 const key=process.env.BALLDONTLIE_API_KEY?.trim(),url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),role=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 if(!key||!url||!role)return json({status:'SERVER_CREDENTIALS_UNAVAILABLE'},503);
 const db=createClient(url,role,{auth:{persistSession:false,autoRefreshToken:false}}),store=db.storage.from(BUCKET);
 const {data:bucket,error:bErr}=await db.storage.getBucket(BUCKET);
 if(bErr||!bucket||bucket.public!==false||bucket.file_size_limit!==20971520)return json({status:'PRIVATE_ARCHIVE_BUCKET_UNVERIFIED'},503);
 const prior:{provider_game_id:number,dataset_key:string}[]=[];
 for(let offset=0;offset<6000;offset+=1000){
  const {data,error}=await db.from('nba_goat_season_archive_v1').select('provider_game_id,dataset_key').eq('season',SEASON).in('dataset_key',['player_stats','advanced_v2','advanced_v2_unverified']).order('provider_game_id',{ascending:true}).order('dataset_key',{ascending:true}).range(offset,offset+999);
  if(error||!data)return json({status:'ARCHIVE_MANIFEST_READ_UNAVAILABLE'},503);
  prior.push(...data);if(data.length<1000)break;
  if(offset===5000)return json({status:'ARCHIVE_MANIFEST_PAGINATION_BOUND'},503);
 }
 const completed=new Set(prior.map(r=>r.provider_game_id+':'+r.dataset_key));
 let calls=0;
 const dataGet=async(path:string,params:Record<string,string>,maxRows=10000)=>{
  let cursor:string|null=null;const seen=new Set<string>(),rows:any[]=[];
  for(let page=0;page<MAX_PAGES;page++){
   if(calls>=callCap)throw Error('PROVIDER_CALL_CAP');calls++;
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
  games=await dataGet('/v1/games',{'seasons[]':'2026',start_date:scheduled?new Date(Date.now()-10*86400000).toISOString().slice(0,10):FIRST,end_date:LAST},1600);
 }catch(e){return json({status:'INVENTORY_FAILED',callsUsed:calls,reason:String((e as Error).message).slice(0,90)},502)}
 const finals=[...new Map(games.filter(g=>Number(g.id)>0&&Number(g.season)===SEASON&&g.date>=FIRST&&g.date<=LAST&&String(g.status_state).toLowerCase()==='final'&&g.postponed===false&&g.postseason===false).map(g=>[Number(g.id),g])).values()].sort((a,b)=>a.date.localeCompare(b.date)||Number(a.id)-Number(b.id));
 const reviewGames=finals.filter(g=>!completed.has(g.id+':advanced_v2')&&completed.has(g.id+':advanced_v2_unverified')).map(g=>Number(g.id));
 const retryUnverified=body.retryUnverified===true;
 const pending=retryUnverified
  ? finals.filter(g=>reviewGames.includes(Number(g.id)))
  : finals.filter(g=>!completed.has(g.id+':player_stats')||(!completed.has(g.id+':advanced_v2')&&!completed.has(g.id+':advanced_v2_unverified')));
 if(!pending.length)return json({status:retryUnverified?'NO_UNVERIFIED_PENDING':reviewGames.length?'CORE_SEASON_REVIEW_REQUIRED':'CORE_SEASON_ARCHIVED',inventoryFinals:finals.length,callsUsed:calls,unverifiedGames:reviewGames});
 const batch=pending.slice(0,GAME_CAP),ident=batch.map(g=>g.id).join('-'),
 lockName=retryUnverified?'batches/season-2026-core-retry/'+new Date().toISOString().slice(0,10)+'/'+ident+'.lock.json':'batches/season-2026-core/'+ident+'.lock.json';
 const lock=await store.upload(lockName,Buffer.from(JSON.stringify({at:new Date().toISOString(),gameIds:batch.map(g=>g.id),version:'CORE_SEASON_2026_BOUNDED_V2'})),{contentType:'application/json',upsert:false});
 if(lock.error)return json({status:'BATCH_ALREADY_CLAIMED_OR_STORAGE_UNAVAILABLE',batch:batch.map(g=>g.id),callsUsed:calls,nextStep:'Manual review; do not erase the lock automatically'},409);
 const results:any[]=[],errors:any[]=[],warnings:any[]=[];
 async function save(game:any,dataset:string,data:any[],originalAt?:string){
  if(data.length<10&&dataset!=='advanced_v2_unverified')throw Error('INSUFFICIENT_ROWS');
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
   if((retryUnverified&&kind==='player_stats')||completed.has(game.id+':'+kind)||(kind==='advanced_v2'&&!retryUnverified&&completed.has(game.id+':advanced_v2_unverified')))continue;
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
     if(rows.length<10){
      // Valid HTTP response with sparse data: preserve separately and never claim validated advanced stats.
      await save(game,'advanced_v2_unverified',rows);
      warnings.push({gameId:Number(game.id),dataset:'advanced_v2',reason:'PROVIDER_ADVANCED_INCOMPLETE',returnedRows:rows.length});
      continue;
     }
    }
    await save(game,kind,rows,capturedAt);
   }catch(err){
    const reason=String((err as Error).message);
    errors.push({gameId:game.id,dataset:kind,reason:reason.slice(0,100)});
    if(reason==='PROVIDER_CALL_CAP'||reason.startsWith('PROVIDER_HTTP_401')||reason.startsWith('PROVIDER_HTTP_403'))break outer;
   }
  }
 }
 return json({status:errors.length?'PARTIAL':warnings.length?'COMPLETED_WITH_REVIEW':'COMPLETED',batchGameIds:batch.map(g=>g.id),season:SEASON,dateRange:[FIRST,LAST],inventoryFinals:finals.length,remainingBefore:pending.length,callsUsed:calls,callsMax:callCap,files:results,errors,warnings,unverifiedGames:[...new Set([...reviewGames.filter(id=>!results.some(r=>r.dataset==='advanced_v2'&&Number(r.gameId)===id)),...warnings.map(w=>w.gameId)])],productionModelsChanged:false,operationalTablesWritten:false});
}