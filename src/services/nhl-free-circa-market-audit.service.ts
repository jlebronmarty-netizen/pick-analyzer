import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NHL_FREE_MARKETS_VERSION} from '@/lib/nhl-free-circa-main-markets.mjs';
const PAGE=500,CAP=2000;
export async function getNhlFreeCircaMainMarketsAudit(){
 const now=new Date(),at=now.toISOString();
 const rows:any[]=[];
 for(let offset=0;offset<CAP;offset+=PAGE){
  const q=await db.from('nhl_free_runs_v1')
   .select('completed_at,marketQuoteObservations:detail->marketQuoteObservations')
   .gte('started_at',new Date(now.getTime()-21*86400000).toISOString())
   .in('status',['PASS','PARTIAL']).order('completed_at',{ascending:true})
   .range(offset,offset+PAGE-1);
  if(q.error)throw Error('NHL_MARKET_ARCHIVE_READ_FAILED');
  rows.push(...(q.data??[]));if((q.data??[]).length<PAGE)break;
 }
 if(rows.length>=CAP)return {status:'ARCHIVE_SCAN_CAP',readOnly:true,providerCalls:0,databaseWrites:0};
 const quotes=rows.flatMap(r=>Array.isArray(r.marketQuoteObservations)?r.marketQuoteObservations:[]);
 const summary=Object.fromEntries(['spread','total'].map(m=>{
  const valid=quotes.filter(q=>q.market===m&&q.version===NHL_FREE_MARKETS_VERSION&&
   q.book==='CIRCA'&&q.marketRulesCertified===false&&q.officialPick===false&&
   /^nhl:202602\d{4}$/.test(String(q.eventId))&&
   Number.isFinite(Date.parse(q.capturedAt))&&
   Number.isFinite(Date.parse(q.scheduledAt))&&
   Date.parse(q.capturedAt)+10*60000<Date.parse(q.scheduledAt));
  const latest=valid.reduce((a,q)=>!a||q.capturedAt>a?q.capturedAt:a,null as string|null);
  return [m,{observations:valid.length,distinctGames:new Set(valid.map(q=>q.eventId)).size,
   latestCapturedAt:latest,provider:'Circa via already-fetched free DRatings detail HTML',
   actualProviderUpdatedAt:null,verifiedFanDuelPrices:0,
   exactMarketContractCertified:false}];
 }));
 return {status:quotes.length?'FREE_MARKET_PAIR_RESEARCH_COLLECTING':'AWAITING_NEXT_EXISTING_NHL_CRON_FETCH',
  version:NHL_FREE_MARKETS_VERSION,readOnly:true,verifiedAt:at,
  archivedRunsScanned:rows.length,marketSummary:summary,
  budgets:{additionalProviderCalls:0,additionalPaidCredits:0,newSubscriptions:0,newCrons:0},
  certification:{liveBookRulesCertified:false,fanDuelPricesCertified:false,
   sameTimeAsChallengerFreeze:false,expectedValueCertified:false,bettingRecommendations:false,
   previousOfficialNhlForecastsModified:false},
  warning:'Structured two-sided Circa quotes for forward research only. Do not infer real FanDuel odds or source-updated timestamps from capture time.'};
}
