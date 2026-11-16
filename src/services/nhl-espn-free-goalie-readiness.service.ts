import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NHL_ESPN_GOALIE_VERSION} from '@/lib/nhl-espn-free-goalie-probables-v5.mjs';
export async function getNhlEspnFreeGoalieReadiness(){
 const [snap,attempt]=await Promise.all([
  db.from('nhl_espn_goalie_probables_v1')
   .select('id,sports_date,captured_at,source_version,game_count,games')
   .order('captured_at',{ascending:false}).limit(35),
  db.from('sports_sync_jobs')
   .select('started_at,status,completed_at')
   .eq('job_type','nhl_espn_free_probables_v5')
   .order('started_at',{ascending:false}).limit(1)
 ]);
 if(snap.error?.code==='42P01')return {status:'SCHEMA_PENDING',version:NHL_ESPN_GOALIE_VERSION,
  providerCalls:0,databaseWrites:0,readOnly:true};
 if(snap.error||attempt.error)throw Error('NHL_ESPN_GOALIE_READINESS_SOURCE_UNAVAILABLE');
 const snapshots=snap.data??[],games=snapshots.flatMap((row:any)=>Array.isArray(row.games)?row.games:[]);
 const withBoth=games.filter((g:any)=>g.homeProbable&&g.awayProbable).length;
 const latest=snapshots[0],job=attempt.data?.[0];
 return {status:snapshots.length?'FREE_PREGAME_PROBABLE_SOURCE_OBSERVED':'AWAITING_FIRST_OPT_IN_CAPTURE',
  version:NHL_ESPN_GOALIE_VERSION,readOnly:true,providerCalls:0,databaseWrites:0,
  snapshots:snapshots.length,totalPregameGames:games.length,
  gamesWithBothProbableGoalies:withBoth,
  latest:{captureTime:latest?.captured_at??null,sportsDate:latest?.sports_date??null,
   storedGames:latest?.game_count??0},
  captureAttempt:{lastAttemptAt:job?.started_at??null,status:job?.status??null},
  eligibility:{confirmedStartingGoalies:0,sourcePublicationTimesVerified:false,
   espnAthleteToNhlIdCrosswalkVerified:false,sourceIsFreePublicESPN:true,
   periodicProviderBudget:'MAX_ONE_FREE_NHL_WIDE_ESPn_SCOREBOARD_CALL_PER_UTC_DAY',
   sourceCostPaidCredits:0},
  policy:{originalChallengerScoresUnmodified:true,modelPromotion:false,
   officialPicksModified:false,pregameCapturedTimeRequired:true},
  warning:'ESPN probableStartingGoalie is not a confirmed starting lineup; its ESPN player ID is not an NHL player ID.'};
}
