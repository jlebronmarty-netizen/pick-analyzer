// Display-only filtering: never changes the ledger, outcomes or accuracy denominator.
export function visibleLedgerRows(rows,{period='TODAY',kind='MODELED',now=new Date().toISOString()}={}){
 if(!Array.isArray(rows)||!['TODAY','UPCOMING','ALL'].includes(period)||!['MODELED','ALL','ABSTAIN'].includes(kind)||!Number.isFinite(Date.parse(now)))return [];
 const datePR=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
 const current=Date.parse(now),today=datePR(now);
 return rows.filter(r=>{
  const starts=Date.parse(r.scheduled_at);if(!Number.isFinite(starts))return false;
  if(kind==='MODELED'&&!['FORECAST','PROJECTION'].includes(r.status)||kind==='ABSTAIN'&&r.status!=='ABSTAIN')return false;
  if(period==='TODAY'&&datePR(r.scheduled_at)!==today)return false;
  if(period==='UPCOMING'&&(starts<=current||r.outcome))return false;
  return true;
 }).slice().sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at)||String(a.market).localeCompare(String(b.market))||String(a.id).localeCompare(String(b.id)));
}
