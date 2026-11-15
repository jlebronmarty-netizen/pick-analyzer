import 'server-only';
import {supabaseAdmin as db} from '@/lib/supabase-admin';
import {NHL_SPECIAL_TEAMS_VERSION} from '@/lib/nhl-special-teams-asof-core.mjs';
export async function getNhlSpecialTeamsResearchStatus(){
 const [dataR,jobsR]=await Promise.all([
  db.from('nhl_special_teams_asof_v1')
   .select('id,snapshot_day,captured_at,team_count,source_version,season_id')
   .order('captured_at',{ascending:false}).limit(2),
  db.from('sports_sync_jobs')
   .select('status,started_at,completed_at')
   .eq('job_type','nhl_special_teams_asof_v3')
   .order('started_at',{ascending:false}).limit(1)
 ]);
 if(dataR.error?.code==='42P01')return {status:'SCHEMA_PENDING',version:NHL_SPECIAL_TEAMS_VERSION,
  sourceCalls:0,databaseWrites:0,readOnly:true,officialPicksModified:false};
 if(dataR.error||jobsR.error)throw Error('NHL_SPECIAL_TEAMS_AUDIT_DATABASE_UNAVAILABLE');
 const last=dataR.data?.[0]??null,lastJob=jobsR.data?.[0]??null;
 const age=last?Date.now()-Date.parse(last.captured_at):null;
 const fresh=age!==null&&Number.isFinite(age)&&age>=0&&age<=36*3600000;
 return {status:fresh?'OFFICIAL_PREGAME_SOURCE_EVIDENCE_AVAILABLE':'PREGAME_SOURCE_EVIDENCE_MISSING',
  version:NHL_SPECIAL_TEAMS_VERSION,readOnly:true,sourceCalls:0,databaseWrites:0,
  latest:{capturedAt:last?.captured_at??null,teamCount:last?.team_count??0,seasonId:last?.season_id??null,
   freshnessHours:age!==null&&Number.isFinite(age)&&age>=0?Number((age/3600000).toFixed(2)):null,
   freshWithin36Hours:fresh},
  dailyCollector:{lastAttemptAt:lastJob?.started_at??null,lastAttemptStatus:lastJob?.status??null,
   oneOfficialFreeSourceCallPerUTCDate:true,extraPaidSubscriptions:0},
  modeling:{goalieStarterConfirmed:false,modelFormulaChanged:false,automaticPromotion:false,
   fanDuelMarketOddsCertified:false,officialPicksModified:false},
  warning:'PP/PK are from a season-to-date official NHL report only when captured and exact teams are verified; do not replay on historical dates.'};
}
