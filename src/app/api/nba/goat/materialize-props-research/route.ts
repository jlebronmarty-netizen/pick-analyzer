import {NextRequest,NextResponse} from 'next/server';
import {createHmac,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {createClient} from '@supabase/supabase-js';
import {compactGoatBoxscores} from '@/lib/nba/goat-research-compact-core.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const revalidate=0;export const maxDuration=300;
const SEASON=2026,BUCKET='nba-goat-2026-private',GAME_CAP=10;
const guard=()=>process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_TARGET_ENV==='goat-research'&&Boolean(process.env.CRON_SECRET);
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const sign=(ts:string)=>createHmac('sha256',process.env.CRON_SECRET!).update('goat-props-research-v1:'+ts).digest('hex');
function valid(token:unknown){
 if(typeof token!=='string')return false;const m=/^(\d{13})\.([0-9a-f]{64})$/.exec(token);
 if(!m||Math.abs(Date.now()-Number(m[1]))>600000)return false;
 return timingSafeEqual(Buffer.from(m[2],'hex'),Buffer.from(sign(m[1]),'hex'));
}
function client(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw Error('SERVER_CONFIG_MISSING');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function inventory(db:ReturnType<typeof client>){
 const archived:{provider_game_id:number,response_sha256:string,storage_object_path:string,data_count:number,source_captured_at:string}[]=[];
 for(let i=0;i<20;i++){
  const {data,error}=await db.from('nba_goat_season_archive_v1').select('provider_game_id,response_sha256,storage_object_path,data_count,source_captured_at')
   .eq('season',SEASON).eq('dataset_key','player_stats').order('provider_game_id').range(i*100,(i+1)*100-1);
  if(error||!data)throw Error('ARCHIVE_INDEX_READ_FAILED');
  archived.push(...data);if(data.length<100)break;if(i===19)throw Error('ARCHIVE_PAGE_LIMIT');
 }
 const processed=new Set<number>();
 for(let i=0;i<40;i++){
  const {data,error}=await db.from('nba_goat_player_game_research_v1').select('provider_game_id').eq('season',SEASON)
   .order('provider_game_id').range(i*1000,(i+1)*1000-1);
  if(error||!data)throw Error('RESEARCH_TABLE_UNAVAILABLE');
  for(const row of data)processed.add(Number(row.provider_game_id));
  if(data.length<1000)break;if(i===39)throw Error('RESEARCH_PAGE_LIMIT');
 }
 return {archived,processed,pending:archived.filter(a=>!processed.has(Number(a.provider_game_id)))};
}
export async function GET(req:NextRequest){
 if(!guard())return reply({status:'RESEARCH_ENV_ONLY'},404);
 let inv;try{inv=await inventory(client())}catch{return reply({status:'RESEARCH_READ_UNAVAILABLE'},503)}
 if(req.nextUrl.searchParams.get('ticket')==='1'){
  const ts=String(Date.now());return reply({ticket:ts+'.'+sign(ts),archivedGames:inv.archived.length,materializedGames:inv.processed.size,pendingGames:inv.pending.length});
 }
 const nonce=randomBytes(16).toString('base64');
 const page="<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>NBA GOAT — Historial compacto</title></head>\n<body style=\"max-width:740px;padding:1rem;margin:3rem auto;font:16px/1.5 system-ui\">\n<h2>NBA GOAT — Historial compacto para Player Props</h2>\n<p>Este proceso usa archivos GOAT verificados y guarda únicamente estadísticas compactas de investigación. Nunca modifica modelos, picks o crons.</p>\n<button id=\"start\" style=\"padding:.8rem\">Preparar historial compacto automáticamente</button>\n<p id=\"message\" role=\"status\">Listo.</p><pre id=\"log\" style=\"background:#111;color:white;padding:1rem;white-space:pre-wrap;overflow:auto\"></pre>\n<script nonce=\""+nonce+"\">(()=>{\nconst button=document.getElementById(\"start\"),message=document.getElementById(\"message\"),log=document.getElementById(\"log\");\nbutton.onclick=async()=>{\n if(!confirm(\"¿Preparar el historial GOAT compacto de investigación? Sin cambios a modelos oficiales.\"))return;\n button.disabled=true;let total=0,games=0;\n try{\n  for(let n=0;n<30;n++){\n   message.textContent=\"Procesando lote \"+(n+1)+\"…\";\n   const ticketResponse=await fetch(location.pathname+\"?ticket=1\",{credentials:\"same-origin\",cache:\"no-store\"});\n   if(!ticketResponse.ok)throw Error(\"Autorización privada no disponible\");\n   const auth=await ticketResponse.json();\n   if(auth.pendingGames===0){message.textContent=\"Historial compacto completo\";break;}\n   const response=await fetch(location.pathname,{method:\"POST\",credentials:\"same-origin\",cache:\"no-store\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({ticket:auth.ticket})});\n   const data=await response.json();log.textContent+=JSON.stringify(data)+\"\\n\";\n   total+=Number(data.rowsWritten||0);games+=Number(data.gamesWritten||0);\n   if(!response.ok||data.status!==\"COMPLETED\"){message.textContent=\"Detenido para revisión: \"+String(data.status||response.status);break;}\n   if(data.pendingAfter===0){message.textContent=\"Completado: \"+games+\" juegos y \"+total+\" registros\";break;}\n   if(n===29)message.textContent=\"Límite de lotes alcanzado; progreso guardado\";\n  }\n }catch(e){message.textContent=\"Error: \"+String(e)+\". Revisar antes de repetir.\";}finally{button.disabled=false;}\n};\n})();</script></body></html>";
 return new NextResponse(page,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; connect-src 'self'; frame-ancestors 'none'"}});
}
export async function POST(req:NextRequest){
 if(!guard())return reply({status:'RESEARCH_ENV_ONLY'},404);
 const scheduled=req.headers.get('ce-type')==='com.vercel.schedule.v1beta'&&
  req.headers.get('ce-vssschedulename')==='nba-goat-compact-daily-research'&&
  Boolean(process.env.CRON_SECRET)&&req.headers.get('authorization')==='Bearer '+process.env.CRON_SECRET;
 if(!scheduled){
  if(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('content-type')?.split(';')[0]!=='application/json')return reply({status:'FORBIDDEN'},403);
  let body:any;try{body=await req.json()}catch{return reply({status:'BAD_REQUEST'},400)}
  if(!valid(body?.ticket))return reply({status:'FORBIDDEN'},403);
 }
 let db:ReturnType<typeof client>,inv:Awaited<ReturnType<typeof inventory>>;
 try{db=client();inv=await inventory(db)}catch{return reply({status:'RESEARCH_INVENTORY_UNAVAILABLE'},503)}
 if(!inv.pending.length)return reply({status:'COMPLETED',gamesWritten:0,rowsWritten:0,pendingAfter:0});
 const store=db.storage.from(BUCKET),{data:bucket,error:bucketError}=await db.storage.getBucket(BUCKET);
 if(bucketError||bucket?.public!==false)return reply({status:'PRIVATE_BUCKET_UNVERIFIED'},503);
 let gamesWritten=0,rowsWritten=0;
 for(const rec of inv.pending.slice(0,GAME_CAP)){
  try{
   const {data,error}=await store.download(rec.storage_object_path);
   if(error||!data)throw Error('SOURCE_STORAGE_MISSING');
   const bytes=Buffer.from(await data.arrayBuffer());if(bytes.length>20*1024*1024)throw Error('GZIP_TOO_LARGE');
   const raw=gunzipSync(bytes,{maxOutputLength:100*1024*1024});
   if(createHash('sha256').update(raw).digest('hex')!==rec.response_sha256)throw Error('SOURCE_SHA_MISMATCH');
   const facts=compactGoatBoxscores({season:SEASON,gameId:rec.provider_game_id,raw:JSON.parse(raw.toString('utf8')),sourceCapturedAt:rec.source_captured_at,sourceSha256:rec.response_sha256});
   if(facts.length!==rec.data_count)throw Error('SOURCE_ROW_COUNT_MISMATCH');
   const {error:writeError}=await db.from('nba_goat_player_game_research_v1').upsert(facts,{onConflict:'season,provider_game_id,player_id'});
   if(writeError)throw Error('RESEARCH_WRITE_FAILED');
   gamesWritten++;rowsWritten+=facts.length;
  }catch(e){return reply({status:'VALIDATION_STOP',gameId:rec.provider_game_id,reason:(e as Error).message,gamesWritten,rowsWritten,requiresReview:true},422)}
 }
 return reply({status:'COMPLETED',gamesWritten,rowsWritten,pendingAfter:inv.pending.length-gamesWritten,officialModelsUnchanged:true,archiveFilesUnchanged:true});
}
