import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {NcaabArchiveReceipt} from '@/lib/ncaab-archived-evidence';
import {NCAAB_ARCHIVE_BASE} from '@/lib/ncaab-archived-evidence';
import {buildNcaabManualDataReport,unavailableNcaabManualDataReport} from '@/lib/ncaab-manual-data';
import type {NcaabManualDataReport} from '@/types/ncaab-manual-data';

const TIMEZONE='America/Puerto_Rico';
const MAX_SOURCE_BYTES=48*1024*1024;
const MAX_RECEIPT_BYTES=15*1024*1024;
const MAX_SOURCE_DATES=190;
type Row=Record<string,unknown>;
type Page={data:unknown;error:unknown;count:number|null};

export function ncaabManualDate(value=new Date().toISOString()) {
  const instant=Date.parse(value);
  if(!Number.isFinite(instant))throw Error('INVALID_DATE');
  return new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));
}
export function validateNcaabManualDate(date:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('INVALID_DATE');
  return date;
}

/** Stable keyset pages with a fixed cutoff and exact per-page source count. */
export async function readNcaabManualRows(readPage:(after:string|null,limit:number)=>PromiseLike<Page>,options:{key?:string;cap?:number;pageSize?:number}={}) {
  const {key='id',cap=5000,pageSize=250}=options;
  if(!Number.isSafeInteger(cap)||cap<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>500)throw Error('INVALID_READ_BUDGET');
  const rows:Row[]=[],seen=new Set<string>();let after:string|null=null,expected:number|null=null;
  for(;;) {
    const result=await readPage(after,pageSize);
    if(result.error||!Array.isArray(result.data)||!Number.isSafeInteger(result.count)||Number(result.count)<0)throw Error('ARCHIVE_READ_FAILED');
    // Count on a keyset page is its remaining count; retain the initial total.
    const total=Number(result.count)+rows.length;
    if(expected===null)expected=total;
    if(total!==expected||result.data.length>pageSize)throw Error('ARCHIVE_COUNT_CHANGED');
    if(expected>cap)throw Error('ARCHIVE_READ_CAPPED');
    for(const raw of result.data) {
      if(raw===null||typeof raw!=='object'||Array.isArray(raw))throw Error('INVALID_ARCHIVE_ROW');
      const row=raw as Row,id=row[key];
      // Postgres ORDER BY and gt share its collation. JavaScript code-point
      // order differs for legacy uppercase IDs, so verify global uniqueness.
      if(typeof id!=='string'||!id||seen.has(id))throw Error('ARCHIVE_PAGE_OVERLAP');
      seen.add(id);after=id;rows.push(row);
    }
    if(rows.length>expected||(!result.data.length&&rows.length<expected))throw Error('INCOMPLETE_ARCHIVE');
    if(rows.length===expected)return rows;
  }
}

function sourceDay(url:string) {
  if(!url.startsWith(NCAAB_ARCHIVE_BASE+'?dates='))return null;
  const match=/\?dates=(\d{4})(\d{2})(\d{2})&groups=50&limit=1000$/.exec(url);
  if(!match)return null;
  const date=match.slice(1).join('-');
  try{return validateNcaabManualDate(date);}catch{return null;}
}

export async function loadNcaabManualData(client:SupabaseClient,date:string,readAt:string,signal:AbortSignal,histories?:Parameters<typeof buildNcaabManualDataReport>[1]):Promise<NcaabManualDataReport> {
  validateNcaabManualDate(date);
  const year=Number(date.slice(0,4)),seasonStart=`${Number(date.slice(5,7))>=7?year:year-1}-07-01`;
  const from=date+'T00:00:00-04:00',to=new Date(Date.parse(from)+86400000).toISOString();
  const nextDay=ncaabManualDate(to);
  const started=performance.now();
  const metaPromise=readNcaabManualRows((after,limit)=> {
    let q=client.from('ncaab_daily_source_v1').select('id,captured_at,source_url',{count:'exact'})
      .gte('captured_at',seasonStart+'T00:00:00Z').lte('captured_at',readAt).order('id').limit(limit).abortSignal(signal);
    if(after)q=q.gt('id',after);return q;
  });
  const predictionsPromise=readNcaabManualRows((after,limit)=> {
    let q=client.from('ncaab_daily_predictions_v1').select('id,event_id,scheduled_at,created_at,source_id,body',{count:'exact'})
      .gte('scheduled_at',from).lt('scheduled_at',to).lte('created_at',readAt).order('id').limit(limit).abortSignal(signal);
    if(after)q=q.gt('id',after);return q;
  },{cap:2000});
  const contextPromise=readNcaabManualRows((after,limit)=> {
    let q=client.from('ncaab_game_context_v2').select('event_id,provider_event_id,captured_at,updated_at,header:summary_payload->header,teams:summary_payload->boxscore->teams',{count:'exact'})
      .gte('captured_at',seasonStart+'T00:00:00Z').lte('captured_at',readAt).lte('updated_at',readAt)
      .order('event_id').limit(limit).abortSignal(signal);
    if(after)q=q.gt('event_id',after);return q;
  },{key:'event_id',cap:10000,pageSize:100});
  const [metadataResult,predictionsResult,contextsResult]=await Promise.allSettled([metaPromise,predictionsPromise,contextPromise]);
  if(metadataResult.status!=='fulfilled')throw Error('SOURCE_METADATA_UNAVAILABLE');
  if(predictionsResult.status!=='fulfilled')throw Error('FORECAST_READ_UNAVAILABLE');
  const indexMs=performance.now()-started;
  const sourceErrors:string[]=[];
  const contexts=contextsResult.status==='fulfilled'?contextsResult.value:[];
  if(contextsResult.status!=='fulfilled')sourceErrors.push('DETAIL_ARCHIVE_UNAVAILABLE');
  const latest=new Map<string,Row>();
  for(const row of metadataResult.value) {
    if(typeof row.source_url!=='string'||typeof row.captured_at!=='string'||!Number.isFinite(Date.parse(row.captured_at)))throw Error('INVALID_SOURCE_METADATA');
    const day=sourceDay(row.source_url);
    if(!day||day<seasonStart||day>nextDay)continue;
    const old=latest.get(row.source_url);
    if(old&&Date.parse(String(old.captured_at))===Date.parse(row.captured_at)&&old.id!==row.id)throw Error('CONFLICTING_SOURCE_CUTOFF');
    if(!old||Date.parse(String(old.captured_at))<Date.parse(row.captured_at))latest.set(row.source_url,row);
  }
  if(latest.size>MAX_SOURCE_DATES)throw Error('SOURCE_DATE_LIMIT');
  const wanted=[...latest.values()].sort((a,b)=>String(a.source_url).localeCompare(String(b.source_url)));
  const receipts:NcaabArchiveReceipt[]=[];let totalBytes=0;
  // Three receipt bodies per request; two concurrent batches bound peak memory.
  async function loadBatch(offset:number) {
    const batch=wanted.slice(offset,offset+3),ids=batch.map(r=>String(r.id));
    const result=await client.from('ncaab_daily_source_v1').select('id,captured_at,source_url,events:body->events',{count:'exact'})
      .in('id',ids).lte('captured_at',readAt).order('id').limit(3).abortSignal(signal);
    if(result.error||!Array.isArray(result.data)||result.count!==ids.length||result.data.length!==ids.length)throw Error('INCOMPLETE_SOURCE_BODIES');
    const seen=new Set<string>();
    for(const value of result.data) {
      const raw=value as unknown as {id:string;captured_at:string;source_url:string;events:unknown};
      const row:NcaabArchiveReceipt={id:raw.id,captured_at:raw.captured_at,source_url:raw.source_url,body:{events:raw.events}};
      const expected=batch.find(m=>m.id===row.id);
      if(!expected||seen.has(row.id)||row.source_url!==expected.source_url||row.captured_at!==expected.captured_at)throw Error('SOURCE_BODY_IDENTITY_MISMATCH');
      seen.add(row.id);
      const bytes=Buffer.byteLength(JSON.stringify(row.body)??'');totalBytes+=bytes;
      if(bytes>MAX_RECEIPT_BYTES||totalBytes>MAX_SOURCE_BYTES)throw Error('SOURCE_BYTE_LIMIT');
      receipts.push(row);
    }
  }
  for(let offset=0;offset<wanted.length;offset+=6) {
    await Promise.all([loadBatch(offset), ...(offset+3<wanted.length?[loadBatch(offset+3)]:[])]);
  }
  const normalizedAt=performance.now();
  const report=buildNcaabManualDataReport({date,readAt,receipts,contexts,predictions:predictionsResult.value,readComplete:true,sourceErrors},histories);
  if(histories?.timings) Object.assign(histories.timings,{
    indexMs:Math.round(indexMs),receiptMs:Math.round(normalizedAt-started-indexMs),
    normalizeMs:Math.round(performance.now()-normalizedAt)});
  return report;
}

const cache=new Map<string,{expires:number;value:NcaabManualDataReport}>();
const inFlight=new Map<string,Promise<NcaabManualDataReport>>();
export async function getNcaabManualData(requestedDate?:string):Promise<NcaabManualDataReport> {
  const readAt=new Date().toISOString(),date=validateNcaabManualDate(requestedDate??ncaabManualDate(readAt));
  const hit=cache.get(date);if(hit&&hit.expires>Date.now())return hit.value;
  if(inFlight.has(date))return inFlight.get(date)!;
  if(inFlight.size>=2)return unavailableNcaabManualDataReport({date,readAt,reason:'READ_BUSY'});
  const operation=(async()=> {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try {
      const {supabaseAdmin}=await import('@/lib/supabase-admin');
      const report=await loadNcaabManualData(supabaseAdmin,date,readAt,controller.signal);
      if(report.status!=='UNAVAILABLE') {
        if(cache.size>=3&&!cache.has(date))cache.delete(cache.keys().next().value!);
        cache.set(date,{expires:Date.now()+180000,value:report});
      }
      return report;
    } catch(error) {
      const known=new Set(['READ_BUSY','SOURCE_METADATA_UNAVAILABLE','FORECAST_READ_UNAVAILABLE','INVALID_SOURCE_METADATA','CONFLICTING_SOURCE_CUTOFF','SOURCE_DATE_LIMIT','INCOMPLETE_SOURCE_BODIES','SOURCE_BODY_IDENTITY_MISMATCH','SOURCE_BYTE_LIMIT']);
      const code=error instanceof Error&&known.has(error.message)?error.message:controller.signal.aborted?'READ_TIMEOUT':'READ_UNAVAILABLE';
      return unavailableNcaabManualDataReport({date,readAt,reason:code});
    } finally {clearTimeout(timer);}
  })();
  inFlight.set(date,operation);
  try{return await operation;}finally{inFlight.delete(date);}
}
