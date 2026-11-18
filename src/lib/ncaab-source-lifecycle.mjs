// Provider-only NCAAB event lifecycle, never a settlement or prediction update.
// Reads only normal scoreboard captures already collected by the free daily cron.
const time=x=>{const t=Date.parse(String(x??''));return Number.isFinite(t)?t:null;};
const result=(kind,schedule)=>({
 event_id:schedule.event_id,kind,source_captured_at:schedule.captured_at,
 source_scheduled_at:schedule.scheduled_at,provider_status:schedule.status
});
export function ncaabSourceLifecycle(frozen,schedule){
 if(!frozen||!schedule||typeof frozen.event_id!=='string'||frozen.event_id!==schedule.event_id)return null;
 const old=time(frozen.scheduled_at),next=time(schedule.scheduled_at),seen=time(schedule.captured_at);
 if(old===null||next===null||seen===null)return result('REVIEW_SOURCE',schedule);
 const h=String(frozen.home_id),a=String(frozen.away_id);
 const sh=String(schedule.home_id),sa=String(schedule.away_id);
 if(!h||!a||h===a||!((h===sh&&a===sa)||(h===sa&&a===sh)))return result('REVIEW_IDENTITY',schedule);
 if(schedule.status==='STATUS_POSTPONED')return result('POSTPONED',schedule);
 if(schedule.status==='STATUS_CANCELED'||schedule.status==='STATUS_CANCELLED')return result('CANCELLED',schedule);
 if(schedule.status==='STATUS_FINAL')return result('REVIEW_FINAL',schedule);
 if(schedule.status==='SCHEDULED'){
  return result(Math.abs(next-old)>120*60000?'RESCHEDULED':'SCHEDULED',schedule);
 }
 return result('REVIEW_SOURCE',schedule);
}
