// Research only. The split was chosen retrospectively, NOT a prospective holdout.
// This function never recommends a bet or estimates EV/ROI.
const CUTOFF='2026-11-12T04:00:00.000Z';
const isDate=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const empty=()=>({games:0,modelHits:0,alwaysOddHits:0,oddChosen:0,evenChosen:0});
const summarize=s=>({...s,modelAccuracy:s.games?s.modelHits/s.games:null,alwaysOddAccuracy:s.games?s.alwaysOddHits/s.games:null,modelMinusOddPp:s.games?100*(s.modelHits-s.alwaysOddHits)/s.games:null});
export function ttOddEvenTemporalAudit(rows,{cutoff=CUTOFF}={}){
 if(!isDate(cutoff))throw Error('INVALID_CUTOFF');
 const map=new Map();let ignored=0,duplicates=0,conflicts=0;
 for(const row of Array.isArray(rows)?rows:[]){
  if(row?.sport!=='TT'||row.market!=='SETS_ODD_EVEN')continue;
  if(row.status!=='FORECAST'||
   !['ODD','EVEN'].includes(row.selection)||!['W','L'].includes(row.outcome?.status)||
   typeof row.event_id!=='string'||!row.event_id||!isDate(row.emitted_at)||!isDate(row.scheduled_at)||
   Date.parse(row.emitted_at)>=Date.parse(row.scheduled_at)){ignored++;continue;}
  const key=row.event_id, existing=map.get(key);
  if(!map.has(key)){map.set(key,row);continue;}
  if(existing===null){conflicts++;continue;}
  if(existing.selection===row.selection&&existing.outcome.status===row.outcome.status){duplicates++;continue;}
  map.set(key,null);conflicts++;
 }
 const all=empty(),early=empty(),later=empty();
 for(const row of map.values()){
  if(!row)continue;
  const win=row.outcome.status==='W',odd=row.selection==='ODD';
  const bucket=Date.parse(row.scheduled_at)<Date.parse(cutoff)?early:later;
  for(const b of [all,bucket]){
   b.games++;b.modelHits+=Number(win);b.alwaysOddHits+=Number(odd===win);
   b.oddChosen+=Number(odd);b.evenChosen+=Number(!odd);
  }
 }
 return {status:'DESCRIPTIVE_RETROSPECTIVE_NO_BETTING_EDGE',cutoff,
  all:summarize(all),early:summarize(early),later:summarize(later),
  ignored,duplicates,conflicts};
}
