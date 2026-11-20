// Research-only numerical score accuracy. Never infer sportsbook odds, lines, EV or picks.
export function collegeScoreAccuracy(rows){
 let n=0,marginSum=0,totalSum=0,marginBias=0,totalBias=0;
 const input=Array.isArray(rows)?rows:[],groups=new Map();
 const audit={loadedRows:input.length,uniqueEvents:0,duplicateRows:0,invalidIdentityRows:0,
  excluded:{conflictingDuplicates:0,nonForecast:0,reviewRequired:0,pending:0,invalidTiming:0,invalidNumeric:0}};
 for(const r of input){
  if(typeof r?.event_id!=='string'||!r.event_id.trim()){audit.invalidIdentityRows++;continue;}
  const group=groups.get(r.event_id)??[];group.push(r);groups.set(r.event_id,group);
 }
 audit.uniqueEvents=groups.size;
 // Identical copies count once; conflicting copies are excluded as a group.
 // Never choose a better-performing duplicate based on input order.
 const signature=r=>JSON.stringify([r.state,r.review_required??false,r.home_id,r.away_id,
  r.created_at,r.scheduled_at,r.projected_margin,r.projected_total,
  r.settlement?[r.settlement.home_score,r.settlement.away_score,r.settlement.observed_at]:null]);
 for(const id of [...groups.keys()].sort()){
  const group=groups.get(id);audit.duplicateRows+=group.length-1;
  if(new Set(group.map(signature)).size>1){audit.excluded.conflictingDuplicates++;continue;}
  const r=group[0];
  if(r.state!=='FORECAST'){audit.excluded.nonForecast++;continue;}
  if(r.review_required){audit.excluded.reviewRequired++;continue;}
  if(!r.settlement){audit.excluded.pending++;continue;}
  const v=r.settlement, projectedMargin=r.projected_margin,projectedTotal=r.projected_total;
  const ts=Date.parse(r.created_at??''),start=Date.parse(r.scheduled_at??''),observed=Date.parse(v.observed_at??'');
  if(![ts,start,observed].every(Number.isFinite)||ts>=start||observed<=start){audit.excluded.invalidTiming++;continue;}
  if(![projectedMargin,projectedTotal,v.home_score,v.away_score].every(x=>typeof x==='number'&&Number.isFinite(x))||
     ![v.home_score,v.away_score].every(Number.isSafeInteger)||Math.min(v.home_score,v.away_score)<0||v.home_score===v.away_score){audit.excluded.invalidNumeric++;continue;}
  const actualMargin=v.home_score-v.away_score,actualTotal=v.home_score+v.away_score;
  n++;
  marginSum+=Math.abs(projectedMargin-actualMargin);
  totalSum+=Math.abs(projectedTotal-actualTotal);
  marginBias+=projectedMargin-actualMargin;
  totalBias+=projectedTotal-actualTotal;
 }
 const round=x=>n?Number((x/n).toFixed(3)):null;
 return {games:n,marginMae:round(marginSum),totalMae:round(totalSum),
  marginBias:round(marginBias),totalBias:round(totalBias),
  scoring:'NUMERIC_ONLY_NOT_BETTING_ACCURACY',audit};
}
