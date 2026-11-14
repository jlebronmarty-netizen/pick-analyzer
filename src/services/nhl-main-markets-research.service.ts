import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {
 normalizeNhlStoredFinal,buildNhlMainMarketResearchPreview,buildNhlTeamPregameForm,
 compareNhlFrozenMoneylineBenchmark,NHL_MAIN_MARKETS_RESEARCH_VERSION
} from '@/lib/nhl-main-markets-research-core.mjs';
const take=(r:any,reason:string)=>{if(r.error)throw Error(reason);return r.data??[];};
// Pure database read on stored source evidence; no external provider fetch, no persistence.
export async function getNhlMainMarketsResearchAudit(){
 const now=new Date(),at=now.toISOString(),cutoff=new Date(now.getTime()+10*60000).toISOString();
 const [contextR,predR,outcomeR,oddsR,runR,quoteR]=await Promise.all([
  db.from('nhl_game_context_v2').select('event_id,boxscore,boxscore_captured_at').order('event_id').limit(500),
  db.from('nhl_free_predictions_v1').select('id,body').order('id').limit(500),
  db.from('nhl_free_outcomes_v1').select('id,body').order('id').limit(500),
  db.from('sports_odds_snapshots').select('market,snapshot_time').eq('sport_key','icehockey_nhl').order('snapshot_time',{ascending:false}).limit(1000),
  db.from('nhl_free_runs_v1').select('detail,completed_at,status').eq('status','PASS').order('started_at',{ascending:false}).limit(1),
  db.from('nhl_free_quote_observations_v1').select('captured_at').order('captured_at',{ascending:false}).limit(1)
 ]);
 const contexts=take(contextR,'NHL_RESEARCH_CONTEXT_READ_FAILED'),predictions=take(predR,'NHL_RESEARCH_PREDICTION_READ_FAILED'),
  outcomes=take(outcomeR,'NHL_RESEARCH_OUTCOME_READ_FAILED'),odds=take(oddsR,'NHL_RESEARCH_ODDS_READ_FAILED'),
  runs=take(runR,'NHL_RESEARCH_RUN_READ_FAILED'),quotes=take(quoteR,'NHL_RESEARCH_QUOTE_READ_FAILED');
 const finals=contexts.flatMap((r:any)=>{
  const g=normalizeNhlStoredFinal({eventId:r.event_id,boxscore:r.boxscore,capturedAt:r.boxscore_captured_at});
  return g?[g]:[];
 });
 const latestSchedule=Array.isArray(runs[0]?.detail?.games)?runs[0].detail.games:[];
 const upcoming=latestSchedule.filter((g:any)=>g?.status==='SCHEDULED'&&Number.isFinite(Date.parse(g?.scheduledAt??''))&&g.scheduledAt>cutoff);
 const teams=new Set<number>(),byTeam=new Map<number,number>();
 for(const g of finals){for(const t of [g.home,g.away]){teams.add(t.id);byTeam.set(t.id,(byTeam.get(t.id)??0)+1);}}
 const five=[...byTeam.values()].filter(x=>x>=5).length,ten=[...byTeam.values()].filter(x=>x>=10).length;
 const ready=upcoming.filter((g:any)=>buildNhlMainMarketResearchPreview({
  homeId:g.homeId,awayId:g.awayId,scheduledAt:g.scheduledAt,asOf:at,finals
 }).status==='DESCRIPTIVE_SHADOW_ONLY').length;
 const benchmark=compareNhlFrozenMoneylineBenchmark(predictions,outcomes);
 const marketCoverage=Object.fromEntries(['moneyline','spread','total'].map(m=>{
  const marketRows=odds.filter((o:any)=>o.market===m);
  return [m,{generalArchiveRows:marketRows.length,latestGeneralQuoteAt:marketRows[0]?.snapshot_time??null,
   recentGeneralQuotes45m:marketRows.filter((o:any)=>{
    const t=Date.parse(o.snapshot_time);return Number.isFinite(t)&&t<=now.getTime()&&now.getTime()-t<=45*60000;
   }).length}];
 }));
 return {
  status:'RESEARCH_GATED',version:NHL_MAIN_MARKETS_RESEARCH_VERSION,checkedAt:at,
  classification:'SHADOW_RESEARCH_ONLY',readOnly:true,providerCalls:0,databaseWrites:0,providerSubscriptionsAdded:0,
  historicalData:{storedContextRows:contexts.length,validFinalBoxscores:finals.length,teamGameRows:finals.length*2,
   distinctTeams:teams.size,teamsWithFivePriorGamesInStoredArchive:five,teamsWithTenPriorGamesInStoredArchive:ten,
   completeArchiveScanned:contexts.length<500},
  currentSlate:{upcomingGames:upcoming.length,descriptiveFiveGameMatchups:ready,
   gameModelMoneylineReady:false,gameModelSpreadReady:false,gameModelTotalReady:false},
  featureReadiness:{
   fromOfficialBoxscore:['goals_for_against','shots_for_against','previous_goalie_actuals','historical_rest'],
   missingPregame:['confirmed_starting_goalie','goalie_status_at_decision','injury_status_at_decision',
    'powerplay_penaltykill_asof','travel_context_asof','expected_goals_xg_asof'],
   actualPostgameGoalieMustNotBeUsedAsPregameStarter:true,
   cannotReplayLateBackfilledDataAtEarlierCutoffs:true
  },
  markets:marketCoverage,
  circaMoneylineArchive:{latestCapturedAt:quotes[0]?.captured_at??null,fullGameContractVerifiedForUserJurisdiction:false},
  moneylineBenchmark:benchmark,
  puckLine:{ready:false,requires:'Fresh game+side+line+price with OT/SO market rule and independent holdout'},
  totalGoals:{ready:false,requires:'Fresh game+over/under+exact line+price, push rules and independent holdout'},
  playerProps:{historicalBoxscoresAvailable:finals.length,oddsCoverageCertified:false,
   firstResearchMarkets:['shots_on_goal','goalie_saves'],predictionsCertified:false},
  policy:{noModelModification:true,noAutoPromotion:true,noOfficialPickModification:true,
   actualProspectiveSampleRequired:true,chronologicalHoldoutRequired:true,marketBenchmarksRequired:true},
  warnings:[
   'Existing 2026 NHL price archive for spread and total is stale; no active FanDuel prices are certified.',
   'DRatings public Moneyline source is not a trained or validated Pick Analyzer champion.',
   'The 5-game descriptive projection is not a probabilistic market forecast and creates no official picks.'
  ]
 };
}
