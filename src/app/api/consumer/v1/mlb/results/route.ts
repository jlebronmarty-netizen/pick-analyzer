import {NextResponse} from 'next/server'
import {supabaseAdmin} from '@/lib/supabase-admin'
import authority from '@/lib/shared-mlb-results-authority.json'
import {readSharedResult,SHARED_RESULTS_VERSION} from '@/lib/shared-mlb-results-contract'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,headers={'Cache-Control':'no-store'}
 const cursor=params.get('cursor')??'0',limit=params.get('limit')??'100'
 if(!/^\d+$/.test(cursor)||!/^\d+$/.test(limit)||!Number.isSafeInteger(Number(cursor))||Number(limit)<1||Number(limit)>250||params.has('season')&&params.get('season')!=='2025')return NextResponse.json({version:SHARED_RESULTS_VERSION,status:'INVALID_SCOPE',data:[]},{status:400,headers})
 const batch=authority.slice(Number(cursor),Number(cursor)+Number(limit))
 try{
  const {data,error}=batch.length?await supabaseAdmin.from('historical_baseball_games').select('source_game_id,game_date,canonical_home_team,canonical_away_team,final_score,checksum_sha256,validation_status,errors,source_lineage').eq('season','2025').in('source_game_id',batch.map(a=>a.reference)):{data:[],error:null}
  if(error)throw new Error('READ_FAILED')
  const mapped=batch.map(a=>{const rows=(data??[]).filter(r=>r.source_game_id===a.reference);return rows.length===1?readSharedResult(rows[0],a):null})
  if(mapped.some(r=>r===null))return NextResponse.json({version:SHARED_RESULTS_VERSION,status:'CERTIFIED_SOURCE_DRIFT',data:[]},{status:503,headers})
  const next=Number(cursor)+batch.length
  return NextResponse.json({version:SHARED_RESULTS_VERSION,status:mapped.length?'AVAILABLE':'EMPTY',asOf:new Date().toISOString(),data:mapped,total:authority.length,nextCursor:next<authority.length?next:null},{headers})
 }catch{return NextResponse.json({version:SHARED_RESULTS_VERSION,status:'CANONICAL_RESULTS_READ_UNAVAILABLE',data:[]},{status:503,headers})}
}
