import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {buildNbaPropShadowHypothesis,NBA_PROPS_SHADOW_STATS,NBA_PROPS_MIN_PRIOR_GAMES,NBA_PROPS_SHADOW_VERSION} from '@/lib/nba/goat-props-shadow-core.mjs';

// Read-only prospective readiness board. It NEVER outputs Official Picks or stores predictions.
export async function getNbaPropsProspectiveShadowReadiness(){
 const now=new Date(),at=now.toISOString(),safeCutoff=new Date(now.getTime()+600000).toISOString();
 const season=now.getUTCMonth()>=9?now.getUTCFullYear():now.getUTCFullYear()-1;
 const [eventsR,contextR,pregameR]=await Promise.all([
  db.from('sport_events').select('id,start_time,home_team,away_team,status').eq('sport_key','basketball_nba')
   .eq('league_key','nba').eq('season',String(season)+'-'+String(season+1).slice(-2))
   .eq('status','scheduled').gte('start_time',safeCutoff).order('start_time').limit(25),
  db.from('nba_game_context_v2').select('provider_game_id,player_stats,player_stats_captured_at')
   .not('player_stats','is',null).order('updated_at',{ascending:false}).limit(500),
  db.from('nba_pregame_context_v1').select('snapshot_id,captured_at,coverage')
   .order('captured_at',{ascending:false}).limit(1)
 ]);
 if(eventsR.error||contextR.error||pregameR.error)throw Error('NBA_PROPS_SHADOW_READINESS_SOURCE_UNAVAILABLE');
 const events=eventsR.data??[],contexts=contextR.data??[],pregame=pregameR.data?.[0]??null;
 const histories=new Map<number,any[]>(),playersWithGames=new Map<number,Set<number>>();
 let rawBoxscoreRows=0;
 for(const context of contexts){
  for(const stat of Array.isArray(context.player_stats?.data)?context.player_stats.data:[]){
   const pid=Number(stat?.player?.id),gid=Number(stat?.game?.id);
   if(!Number.isSafeInteger(pid)||!Number.isSafeInteger(gid)||gid!==Number(context.provider_game_id))continue;
   rawBoxscoreRows++;
   const records=histories.get(pid)??[];
   records.push({stat,capturedAt:context.player_stats_captured_at});
   histories.set(pid,records);
   const games=playersWithGames.get(pid)??new Set<number>();games.add(gid);playersWithGames.set(pid,games);
  }
 }
 const ids=events.map(e=>Number(/^bdl_nba_(\d+)$/.exec(String(e.id))?.[1])).filter(Number.isSafeInteger);
 const result:any={status:'READ_ONLY_PROSPECTIVE_RESEARCH',version:NBA_PROPS_SHADOW_VERSION,checkedAt:at,
  source:'ARCHIVED_PLAYER_BOXSCORES_AND_PREGAME_PROPS',providerCalls:0,databaseWrites:0,
  scope:['points','rebounds','assists','threes'],minPriorPlayerGames:NBA_PROPS_MIN_PRIOR_GAMES,
  futureGames:ids.length,postgamePlayerTruthGames:contexts.length,rawPlayerGameRows:rawBoxscoreRows,
  uniquePlayersWithTruth:playersWithGames.size,
  playersWithFiveObservedGames:[...playersWithGames.values()].filter(s=>s.size>=NBA_PROPS_MIN_PRIOR_GAMES).length,
  latestPregameContextAt:pregame?.captured_at??null,
  pregameInjuriesAndLineupsIncludedInScoring:false,
  archivedQuoteRowsScanned:0,quoteScanCapped:false,distinctPropContractsExamined:0,
  readyShadowHypotheses:0,rejectedContracts:0,notReadyReasons:{} as Record<string,number>,
  byStatistic:Object.fromEntries(Object.keys(NBA_PROPS_SHADOW_STATS).map(m=>[m,{examined:0,ready:0}])),
  previewOnly:true,calibrated:false,validated:false,holdoutPassed:false,
  certifiedPredictions:0,officialPicksChanged:false,
  warning:'A research-only projection requires five earlier verified games; it has no calibrated probability or EV. Postgame results, unknown settlement rules and live prices never become recommendations automatically.'
 };
 if(!ids.length)return {...result,status:'NO_UPCOMING_GAMES'};
 const quotesR=await db.from('nba_market_quotes_v1')
  .select('quote_id,provider_game_id,player_id,market,statistic,side,line,american_odds,contract,period,phase,source_received_at')
  .eq('market','props').eq('phase','PREGAME').in('side',['over','under'])
  .in('provider_game_id',ids).order('source_received_at',{ascending:false}).limit(1000);
 if(quotesR.error)throw Error('NBA_PROPS_SHADOW_QUOTES_READ_FAILED');
 const quotes=quotesR.data??[],latest=new Map<string,any>();
 for(const q of quotes){
  const key=[q.provider_game_id,q.player_id,q.statistic,q.side,q.line].join('|');
  if(!latest.has(key))latest.set(key,q);
 }
 const eventMap=new Map(events.map(e=>[Number(/^bdl_nba_(\d+)$/.exec(String(e.id))?.[1]),e]));
 result.archivedQuoteRowsScanned=quotes.length;result.quoteScanCapped=quotes.length>=1000;
 result.distinctPropContractsExamined=latest.size;
 for(const q of latest.values()){
  const e=eventMap.get(Number(q.provider_game_id));if(!e)continue;
  const byStat=result.byStatistic[q.statistic];if(byStat)byStat.examined++;
  const hypothesis=buildNbaPropShadowHypothesis({quote:q,event:e,playerGameStats:histories.get(Number(q.player_id))??[],asOf:at});
  if(hypothesis.status==='SHADOW_HYPOTHESIS_ONLY'){
   result.readyShadowHypotheses++;if(byStat)byStat.ready++;
  }else{
   result.rejectedContracts++;
   const reason=hypothesis.reason??'UNKNOWN';result.notReadyReasons[reason]=(result.notReadyReasons[reason]??0)+1;
  }
 }
 if(result.quoteScanCapped)result.warning+=' Scan capped at 1000 newest archived quote rows; metrics do not claim full slate coverage.';
 return result;
}
