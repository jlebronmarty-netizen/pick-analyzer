import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { readSharedQuote, SHARED_MLB_PROP_VERSION } from '@/lib/shared-mlb-player-prop-contract'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const params=new URL(request.url).searchParams
  const gamePk=params.get('gamePk')
  const headers={'Cache-Control':'no-store'}
  if(gamePk!==null&&(!/^\d+$/.test(gamePk)||!Number.isSafeInteger(Number(gamePk))||Number(gamePk)<=0)) return NextResponse.json({error:'INVALID_GAME_PK',data:[]},{status:400,headers})
  try {
    const now=Date.now()
    let query=supabaseAdmin.from('sports_odds_snapshots').select('*').eq('sport_key','baseball_mlb').eq('provider','balldontlie').eq('market','pitcher_strikeouts').eq('odds_classification','shared_evidence_only').contains('metadata',{contract:SHARED_MLB_PROP_VERSION}).gte('snapshot_time',new Date(now-600000).toISOString()).order('snapshot_time',{ascending:false}).limit(501)
    if(gamePk) query=query.eq('event_id','mlb:game:'+gamePk)
    const {data,error}=await query
    if(error) throw new Error('READ_FAILED')
    if((data?.length??0)>500) return NextResponse.json({version:SHARED_MLB_PROP_VERSION,status:'SCOPE_TOO_LARGE_USE_GAME_PK',data:[]},{status:422,headers})
    const quotes=(data??[]).map(row=>readSharedQuote(row,Date.now())).filter(x=>x!==null)
    return NextResponse.json({version:SHARED_MLB_PROP_VERSION,status:quotes.length?'AVAILABLE':'NO_FRESH_CERTIFIED_QUOTES',asOf:new Date().toISOString(),data:quotes},{headers})
  } catch {
    return NextResponse.json({version:SHARED_MLB_PROP_VERSION,status:'CANONICAL_QUOTE_READ_UNAVAILABLE',data:[]},{status:503,headers})
  }
}
