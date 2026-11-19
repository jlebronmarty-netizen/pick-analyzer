// Read-only numerical evaluation of stored college projections. A missing
// error is not zero, and a disputed final is not a numerical observation.
export function collegeNumericEvaluation(rows,market,{source='diagnostics'}={}){
 const input=(['POINT_MARGIN','TOTAL_POINTS'].includes(market)&&Array.isArray(rows)?rows:[]).filter(r=>r?.market===market);
 const excluded={invalidIdentity:0,conflictingDuplicates:0,nonNumeric:0,invalidError:0};
 const groups=new Map();let duplicateRows=0,n=0,mae=0;
 for(const r of input){
  const id=source==='ledger'?r.id:r.forecast_id;
  if(typeof id!=='string'||!id.trim()){excluded.invalidIdentity++;continue;}
  const value={eventId:r.event_id,model:r.model_version,projection:r.projection,
   forecastState:source==='ledger'?r.status:undefined,
   status:source==='ledger'?r.outcome?.status:r.outcome_status,
   error:source==='ledger'?r.outcome?.absolute_error:r.absolute_error,
   actual:source==='ledger'?r.outcome?.actual:r.actual};
  const group=groups.get(id)??[];group.push(value);groups.set(id,group);
 }
 for(const id of [...groups.keys()].sort()){
  const group=groups.get(id);duplicateRows+=group.length-1;
  if(new Set(group.map(r=>JSON.stringify(r))).size>1){excluded.conflictingDuplicates++;continue;}
  const r=group[0];
  if(r.status!=='NUMERIC'||source==='ledger'&&r.forecastState!=='PROJECTION'){excluded.nonNumeric++;continue;}
  if(typeof r.error!=='number'||!Number.isFinite(r.error)||r.error<0){excluded.invalidError++;continue;}
  n++;mae+=(r.error-mae)/n;
 }
 return {n,mae:n?mae:null,loadedRows:input.length,duplicateRows,excluded,
  unit:'FROZEN_NUMERIC_FORECAST',scoring:'NUMERIC_ONLY_NOT_BETTING_ACCURACY'};
}
