import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {evaluateNhlOddsSnapshotCoverage,NHL_MARKET_CONTRACT_VERSION} from '@/lib/nhl-market-quote-contract-v4.mjs';
import {assessNhlGoaltenderCoverage} from '@/lib/nhl-pregame-goalie-contract-v4.mjs';
export async function getNhlMarketGoalieV4Readiness(){
 const now=new Date(),at=now.toISOString();
 const [oddsR,runsR,goaliesR]=await Promise.all([
  db.from('sports_odds_snapshots').select('market,snapshot_time,sportsbook,event_id')
   .eq('sport_key','icehockey_nhl').order('snapshot_time',{ascending:false}).limit(750),
  db.from('nhl_free_runs_v1').select('completed_at,games:detail->games')
   .eq('status','PASS').order('completed_at',{ascending:false}).limit(1),
  db.from('sport_lineups').select('event_id,created_at')
   .eq('sport_key','icehockey_nhl').limit(20)
 ]);
 if(oddsR.error||runsR.error||goaliesR.error)throw Error('NHL_V4_RESEARCH_READ_FAILED');
 const gameRows=Array.isArray(runsR.data?.[0]?.games)?runsR.data[0].games:[];
 const upcoming=gameRows.filter((g:any)=>g?.status==='SCHEDULED'&&Date.parse(g.scheduledAt)>now.getTime()+3600000);
 const markets=evaluateNhlOddsSnapshotCoverage({rows:oddsR.data??[],now:at});
 // Historical lineup rows are not an independently verified pregame goaltender start source.
 // Never equate lineup table existence to confirmed player, team or starter identity.
 const goalie=assessNhlGoaltenderCoverage({observations:[],events:upcoming,asOf:at});
 return {
  status:'RESEARCH_PREREQUISITES_INCOMPLETE',version:NHL_MARKET_CONTRACT_VERSION,
  generatedAt:at,readOnly:true,providerCalls:0,databaseWrites:0,
  sportsbookMarketEvidence:markets,
  currentSlate:{upcomingGames:upcoming.length,atLeast60MinutesUntilStart:true,
   matchesAwaitingConfirmedBothStartingGoalies:upcoming.length},
  goalieEvidence:{...goalie,uncertifiedLegacyLineupRows:goaliesR.data?.length??0,
    specificPrefreezeSourceConfigured:false,
    potentialSourcesToEvaluate:['ESPN_PUBLIC_SCOREBOARD','DAILY_FACEOFF','TEAM_OR_NHL_NEWS'],
    sourceVerifiedForPregameUse:false},
  providerBudget:{providerKeyConfigured:Boolean(process.env.THE_ODDS_API_KEY?.trim()),
    availableCreditsVerified:false,additionalCreditsConsumed:0,
    existingBookPricesMayBeStale:true,automaticRefreshEnabled:false,
    oneRegionThreeMarketsEstimatedCredits:3},
  flags:{pricesCannotBeUsedForEdge:true,marketPeriodOTSORequiresVerification:true,
    historicalGoalieNotNextStarter:true,modelWeightsChanged:false,
    frozenChallengerRecordsChanged:false,officialPicksChanged:false},
  next:'Verify available provider credits and a timestamped pregame goalie feed before enabling capture.'
 };
}
