import {NextResponse} from 'next/server';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
export const dynamic='force-dynamic';
export const runtime='nodejs';
// Preview-only read of existing, immutable free-source raw HTML. No new external HTTP calls.
// Sanitized 2-row table shape only; never expose full provider documents, keys or raw source.
export async function GET(){
 if(process.env.VERCEL_ENV!=='preview')return NextResponse.json({status:'NOT_AVAILABLE'},{status:404});
 const q=await db.from('nhl_free_source_v1')
  .select('source_url,captured_at,body')
  .like('source_url','https://www.dratings.com/predictor/nhl-hockey-predictions/%')
  .eq('body->>http_status','200').order('captured_at',{ascending:false}).limit(5);
 if(q.error)return NextResponse.json({status:'SOURCE_READ_FAILED'},{status:503});
 const texts=[] as any[];
 const clean=(s:string)=>s.replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|#160);/gi,' ')
  .replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,100);
 for(const row of q.data??[]){
  try{
   const body=row.body as any;
   if(body.encoding!=='gzip/base64'||typeof body.raw!=='string')continue;
   const unpacked=gunzipSync(Buffer.from(body.raw,'base64'),{maxOutputLength:2000000});
   if(createHash('sha256').update(unpacked).digest('hex')!==body.sha256)continue;
   const html=unpacked.toString('utf8');
   const idValues=[...html.matchAll(/id=["'](scroll-(?:money|spread|total|totals|overunder|ou)[^"']*)["']/gi)]
    .slice(0,30).map(x=>x[1]);
   const sections=['scroll-money','scroll-spread','scroll-total','scroll-totals','scroll-overunder'];
   const results=Object.fromEntries(sections.map(k=>{
    const pattern=new RegExp('id=["\\x27]'+k+'["\\x27]([\\s\\S]*?)(?=id=["\\x27]scroll-[\\w-]+["\\x27]|$)','i');
    const match=html.match(pattern);
    if(!match)return [k,{present:false}];
    const tableTags=[...match[0].matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].slice(0,3);
    const tables=tableTags.map(t=>{
     const rows=[...t[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].slice(0,3);
     return rows.map(r=>[...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>clean(x[1])).slice(0,15));
    });
    return [k,{present:true,tableCount:tableTags.length,tables}];
   }));
   texts.push({sourceObservedAt:row.captured_at,
    sourceType:'previously-stored DRatings detail page',
    idValues,sections:results,providerCalls:0,databaseWrites:0});
  }catch{texts.push({status:'SOURCE_DECOMPRESSION_FAILED'});}
 }
 return NextResponse.json({status:'STORED_MARKET_HTML_SCHEMA_PROBE',records:texts,
  readOnly:true,externalProviderCalls:0,databaseWrites:0,
  warning:'No odds or lines may be promoted from this diagnostic without frozen exact market rules.'},
  {headers:{'Cache-Control':'private, no-store'}});
}
