// Research-only comparison against always choosing ODD sets. Never promotes picks.
export function ttOddEvenBaseline(rows){
 let modelWins=0,modelLosses=0,alwaysOddWins=0,oddSelected=0,evenSelected=0;
 const ids=new Set();
 for(const r of Array.isArray(rows)?rows:[]){
  if(r?.sport!=='TT'||r?.market!=='SETS_ODD_EVEN'||r?.status!=='FORECAST'||
   !['ODD','EVEN'].includes(r.selection)||!['W','L'].includes(r.outcome?.status)||
   typeof r.event_id!=='string'||ids.has(r.event_id))continue;
  ids.add(r.event_id);
  const modelWon=r.outcome.status==='W';
  modelWins+=Number(modelWon);modelLosses+=Number(!modelWon);
  oddSelected+=Number(r.selection==='ODD');evenSelected+=Number(r.selection==='EVEN');
  alwaysOddWins+=Number((r.selection==='ODD')===modelWon);
 }
 const n=modelWins+modelLosses;
 return {games:n,modelWins,modelLosses,alwaysOddWins,
  oddSelected,evenSelected,
  modelAccuracy:n?modelWins/n:null,alwaysOddAccuracy:n?alwaysOddWins/n:null,
  edgeOverBaseline:n?(modelWins-alwaysOddWins)/n:null,
  classification:'DESCRIPTIVE_NO_BETTING_EDGE'};
}
