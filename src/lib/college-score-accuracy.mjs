// Research-only numerical score accuracy. Never infer sportsbook odds, lines, EV or picks.
export function collegeScoreAccuracy(rows){
 let n=0,marginSum=0,totalSum=0,marginBias=0,totalBias=0;
 const ids=new Set();
 for(const r of Array.isArray(rows)?rows:[]){
  if(r?.state!=='FORECAST'||r.review_required||!r.settlement||
    ids.has(r.event_id)||typeof r.event_id!=='string')continue;
  const v=r.settlement, projectedMargin=r.projected_margin,projectedTotal=r.projected_total;
  const ts=Date.parse(r.created_at??''),start=Date.parse(r.scheduled_at??''),observed=Date.parse(v.observed_at??'');
  if(![ts,start,observed].every(Number.isFinite)||ts>=start||observed<=start||
     ![projectedMargin,projectedTotal,v.home_score,v.away_score].every(x=>typeof x==='number'&&Number.isFinite(x))||
     ![v.home_score,v.away_score].every(Number.isSafeInteger)||Math.min(v.home_score,v.away_score)<0)
     continue;
  const actualMargin=v.home_score-v.away_score,actualTotal=v.home_score+v.away_score;
  n++;ids.add(r.event_id);
  marginSum+=Math.abs(projectedMargin-actualMargin);
  totalSum+=Math.abs(projectedTotal-actualTotal);
  marginBias+=projectedMargin-actualMargin;
  totalBias+=projectedTotal-actualTotal;
 }
 const round=x=>n?Number((x/n).toFixed(3)):null;
 return {games:n,marginMae:round(marginSum),totalMae:round(totalSum),
  marginBias:round(marginBias),totalBias:round(totalBias),
  scoring:'NUMERIC_ONLY_NOT_BETTING_ACCURACY'};
}
