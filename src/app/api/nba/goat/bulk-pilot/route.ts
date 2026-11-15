import {NextRequest,NextResponse} from 'next/server';
import {createHash,createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';export const dynamic='force-dynamic';export const revalidate=0;export const maxDuration=300;
const GAMES=[21718062,21718063,21718064],BUCKET='nba-goat-2026-private',MAX_CALLS=30;
const researchOnly=()=>process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_TARGET_ENV==='goat-research'&&Boolean(process.env.CRON_SECRET);
const deny=()=>NextResponse.json({status:'RESEARCH_ENV_ONLY'},{status:404,headers:{'Cache-Control':'no-store'}});
const sign=(ts:string)=>createHmac('sha256',process.env.CRON_SECRET!).update('nba-goat-bulk-v1:'+ts).digest('hex');
function valid(token:unknown){if(typeof token!=='string')return false;const m=/^([0-9]{13})\.([0-9a-f]{64})$/.exec(token);if(!m||Math.abs(Date.now()-Number(m[1]))>600000)return false;return timingSafeEqual(Buffer.from(m[2],'hex'),Buffer.from(sign(m[1]),'hex'));}
export async function GET(){
 if(!researchOnly())return deny();
 const t=String(Date.now()),csrf=t+'.'+sign(t),nonce=randomBytes(16).toString('base64');
 const html='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Piloto GOAT privado</title><body style="font:16px system-ui;max-width:650px;margin:4rem auto;padding:1rem"><h2>NBA GOAT — piloto privado</h2><p>Entorno protegido goat-research. Solo tres partidos del 8 de noviembre; máximo 30 consultas. No cambia modelos, predicciones ni crons.</p><form method="post" id="go"><button type="submit">Ejecutar piloto privado</button></form><pre id="out" style="white-space:pre-wrap"></pre><script nonce="'+nonce+'">document.getElementById("go").onsubmit=async(e)=>{e.preventDefault();if(!confirm("¿Ejecutar piloto de tres partidos y hasta 30 consultas GOAT?"))return;const button=e.target.querySelector("button");button.disabled=true;const out=document.getElementById("out");out.textContent="Ejecutando...";try{const r=await fetch(location.pathname,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({csrf:"'+csrf+'"})});out.textContent=JSON.stringify(await r.json(),null,2)}catch{out.textContent="Error de conexión"}};</script></body></html>';
 return new NextResponse(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'"}});
}
export async function POST(req:NextRequest){
 if(!researchOnly())return deny();
 if(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('content-type')?.split(';')[0]!=='application/json')return NextResponse.json({status:'FORBIDDEN'},{status:403});
 let body:any;try{body=await req.json();}catch{return NextResponse.json({status:'BAD_REQUEST'},{status:400});}
 if(!valid(body?.csrf))return NextResponse.json({status:'FORBIDDEN'},{status:403});
 const key=process.env.BALLDONTLIE_API_KEY?.trim(),url=process.env.NEXT_PUBLIC_SUPABASE_URL,role=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key||!url||!role)return NextResponse.json({status:'MISSING_SERVER_CONFIGURATION'},{status:503});
 const db=createClient(url,role,{auth:{persistSession:false,autoRefreshToken:false}}),store=db.storage.from(BUCKET);
 const {data:bucket,error:bucketError}=await db.storage.getBucket(BUCKET);
 if(bucketError||bucket?.public!==false||bucket.file_size_limit!==20971520)return NextResponse.json({status:'PRIVATE_BUCKET_UNVERIFIED'},{status:503});
 const claim=await store.upload('pilots/2026-11-14-v1/lock.json',Buffer.from(JSON.stringify({at:new Date().toISOString(),games:GAMES})),{upsert:false,contentType:'application/json'});
 if(claim.error)return NextResponse.json({status:'ALREADY_CLAIMED_OR_STORAGE_ERROR',retry:'manual_review_required'},{status:409});
 let calls=0;const files:any[]=[],errors:any[]=[];
 async function save(gid:number,date:string,dataset:string,records:any[],capturedAt?:string){
  if(!records.length)throw Error('NO_DATA');
  const raw=Buffer.from(JSON.stringify(records));if(raw.length>100*1024*1024)throw Error('RAW_LIMIT');
  const hash=createHash('sha256').update(raw).digest('hex'),compressed=gzipSync(raw,{level:6});
  if(compressed.length>20*1024*1024)throw Error('OBJECT_LIMIT');
  const path='2026/'+gid+'/'+dataset+'/'+hash+'.json.gz';
  const up=await store.upload(path,compressed,{upsert:false,contentType:'application/gzip'});if(up.error)throw Error('STORAGE_UPLOAD_FAILED');
  const row={season:2026,provider_game_id:gid,dataset_key:dataset,provider:'balldontlie',source_captured_at:capturedAt||new Date().toISOString(),game_date:date,response_sha256:hash,data_count:records.length,storage_bucket:BUCKET,storage_object_path:path,compressed_bytes:compressed.length,json_bytes:raw.length};
  const {error}=await db.from('nba_goat_season_archive_v1').upsert(row,{onConflict:'season,provider_game_id,dataset_key'});
  if(error)throw Error('MANIFEST_WRITE_FAILED');
  files.push({gameId:gid,dataset,rows:records.length,compressedBytes:compressed.length,sha256:hash});
 }
 async function advanced(gid:number){
  const rows:any[]=[];let cursor:any=null;const seen=new Set<string>();
  for(let page=0;page<30;page++){
   if(calls>=MAX_CALLS)throw Error('CALL_BUDGET_EXHAUSTED');calls++;
   const u=new URL('https://api.balldontlie.io/nba/v2/stats/advanced');u.searchParams.append('game_ids[]',String(gid));u.searchParams.set('period','0');u.searchParams.set('per_page','100');if(cursor!==null)u.searchParams.set('cursor',String(cursor));
   const response=await fetch(u,{headers:{Authorization:key,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('PROVIDER_HTTP_'+response.status);
   const payload=await response.json();if(!Array.isArray(payload?.data))throw Error('INVALID_PROVIDER_DATA');
   rows.push(...payload.data);const next=payload.meta?.next_cursor??null;if(next===null)return rows;
   if(seen.has(String(next)))throw Error('REPEATED_CURSOR');seen.add(String(next));cursor=next;
  }
  throw Error('TOO_MANY_PAGES');
 }
 for(const gid of GAMES){
  const {data,error}=await db.from('nba_game_context_v2').select('player_stats,player_stats_captured_at').eq('provider_game_id',gid).maybeSingle();
  const stats=data?.player_stats?.data;
  if(error||!Array.isArray(stats)||stats.length<10||stats.some((x:any)=>Number(x.game?.id)!==gid||x.game?.status_state!=='final'||x.game?.date!=='2026-11-08')){
   errors.push({gameId:gid,reason:'HISTORIC_GAME_NOT_VERIFIED'});continue;
  }
  try{await save(gid,'2026-11-08','player_stats',stats,data.player_stats_captured_at);}catch(e){errors.push({gameId:gid,dataset:'player_stats',reason:(e as Error).message});continue;}
  try{const result=await advanced(gid);if(result.some((x:any)=>Number(x?.game?.id)!==gid||Number(x?.period)!==0))throw Error('ADVANCED_GAME_OR_PERIOD_MISMATCH');await save(gid,'2026-11-08','advanced_v2',result);}catch(e){errors.push({gameId:gid,dataset:'advanced_v2',reason:(e as Error).message});if(calls>=MAX_CALLS)break;}
 }
 return NextResponse.json({status:errors.length?'PARTIAL':'COMPLETED',environment:'goat-research',games:GAMES,callsUsed:calls,callsMax:MAX_CALLS,files,errors,officialModelsUnchanged:true},{headers:{'Cache-Control':'no-store'}});
}