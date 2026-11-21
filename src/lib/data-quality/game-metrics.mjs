// First aggregate within a game so extra contracts cannot give one event more weight.
export function gameMetrics(rows) {
  const games=new Map();
  for(const r of rows){
    if(r.gameId==null || !['win','loss','push'].includes(r.result)) continue;
    const id=String(r.gameId);
    const g=games.get(id)??{wins:0,decisions:0,error:0,n:0};
    if(r.result!=='push'){g.decisions++;g.wins+=Number(r.result==='win');}
    if(typeof r.error==='number'&&Number.isFinite(r.error)&&r.error>=0){g.error+=r.error;g.n++;}
    games.set(id,g);
  }
  const values=[...games.values()];
  const accuracy=values.filter(g=>g.decisions),errors=values.filter(g=>g.n);
  return {uniqueGames:games.size,decisionGames:accuracy.length,errorGames:errors.length,
    hitRate:accuracy.length?100*accuracy.reduce((s,g)=>s+g.wins/g.decisions,0)/accuracy.length:null,
    mae:errors.length?errors.reduce((s,g)=>s+g.error/g.n,0)/errors.length:null};
}
