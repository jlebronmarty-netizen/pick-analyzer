import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {gradeNbaPropStoredQuote,NBA_PROP_RESEARCH_MARKETS} from '@/lib/nba/goat-props-core.mjs';

// Deliberately read-only. This checks historical settlement mechanics, NOT model performance.
export async function getNbaGoatPropsResearchAudit() {
  const contextR=await db.from('nba_game_context_v2')
    .select('provider_game_id,game_id,player_stats')
    .not('player_stats','is',null)
    .order('updated_at',{ascending:false}).limit(20);
  if(contextR.error)throw Error('NBA_PROPS_RESEARCH_CONTEXT_READ_FAILED');
  const contexts=contextR.data??[];
  const gameIds=[...new Set(contexts.map(x=>Number(x.provider_game_id)).filter(Number.isSafeInteger))];
  if(!gameIds.length)return {status:'NO_POSTGAME_PLAYER_TRUTH',providerCalls:0,databaseWrites:0,certifiedPredictions:0,certifiedAccuracy:null};
  const quoteR=await db.from('nba_market_quotes_v1')
    .select('quote_id,provider_game_id,player_id,market,statistic,side,line,contract,period,phase,source_received_at')
    .eq('market','props').eq('phase','PREGAME').in('side',['over','under'])
    .in('provider_game_id',gameIds)
    .order('source_received_at',{ascending:false}).limit(1000);
  if(quoteR.error)throw Error('NBA_PROPS_RESEARCH_QUOTES_READ_FAILED');
  const actualMap=new Map<string,any>();
  for(const context of contexts){
    for(const stat of Array.isArray(context.player_stats?.data)?context.player_stats.data:[]){
      const key=String(context.provider_game_id)+'|'+String(stat?.player?.id??'');
      if(stat?.player?.id!=null)actualMap.set(key,stat);
    }
  }
  const quotes=quoteR.data??[];
  const totals=Object.fromEntries(NBA_PROP_RESEARCH_MARKETS.map(m=>[m,{matchedQuotes:0,gradableQuotes:0,ungradableQuotes:0}]));
  const gameCoverage=new Set<string>();
  let matched=0,gradable=0,ungradable=0;
  for(const quote of quotes){
    if(!Object.hasOwn(totals,quote.statistic))continue;
    const actual=actualMap.get(String(quote.provider_game_id)+'|'+String(quote.player_id));
    if(!actual)continue;
    matched++;
    gameCoverage.add(String(quote.provider_game_id));
    totals[quote.statistic].matchedQuotes++;
    const grade=gradeNbaPropStoredQuote(quote,actual);
    if(grade.status==='STATISTICAL_COMPARISON'){gradable++;totals[quote.statistic].gradableQuotes++;}
    else{ungradable++;totals[quote.statistic].ungradableQuotes++;}
  }
  return {
    status:'HISTORICAL_SETTLEMENT_RESEARCH_ONLY',
    providerCalls:0,databaseWrites:0,
    archivedQuotesExamined:quotes.length,scanCapped:quotes.length>=1000,
    gamesWithPlayerTruth:contexts.length,gamesWithMatchingProps:gameCoverage.size,
    matchedPregameQuotes:matched,statisticallyGradableQuotes:gradable,ungradableQuotes:ungradable,
    byStatistic:totals,
    certifiedPredictions:0,certifiedAccuracy:null,
    productionModelModified:false,officialPicksModified:false,
    warning:'An ex-post historical quote comparison is not a prospective prediction, a sportsbook settlement, or prop model accuracy. Market scope and DNP rules still require external certification.'
  };
}
