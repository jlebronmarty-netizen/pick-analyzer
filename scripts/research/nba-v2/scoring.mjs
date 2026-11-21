import {expectedValue,impliedProbability} from '../../../src/lib/nba/decision-probability-v2.mjs';
const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
function byGame(rows, value) {
  const game = new Map();
  for (const r of rows) {
    const x=value(r); if (!Number.isFinite(x)) continue;
    if (!game.has(r.game)) game.set(r.game,[]);
    game.get(r.game).push(x);
  }
  return [...game.values()].map(mean);
}
export function gameMean(rows,fn){return mean(byGame(rows,fn));}
function interval(sample) {
  if (sample.length<2) return null;
  let seed=391393;
  const draws=[];
  for(let i=0;i<1000;i++) {
    let sum=0;
    for(let j=0;j<sample.length;j++) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      sum+=sample[Math.floor(seed/2**32*sample.length)];
    }
    draws.push(sum/sample.length);
  }
  draws.sort((a,b)=>a-b);
  return [draws[24],draws[974]];
}
export function score(rows, uncertainty=true) {
  const binary=rows.filter(r=>r.y!==r.line);
  const y=r=>Number(r.y>r.line);
  const brier=r=>(r.p-y(r))**2;
  const games=byGame(binary,brier);
  const cal=[];
  const counts=new Map();
  for(const r of binary) counts.set(r.game,(counts.get(r.game)??0)+1);
  for(let i=0;i<10;i++) {
    const bin=binary.filter(r=>Math.min(9,Math.floor(r.p*10))===i);
    if (!bin.length) continue;
    const weight=r=>1/counts.get(r.game);
    const mass=bin.reduce((s,r)=>s+weight(r),0);
    const avg=f=>bin.reduce((s,r)=>s+weight(r)*f(r),0)/mass;
    cal.push({bin:i, contracts:bin.length,mass,p:avg(r=>r.p), observed:avg(y)});
  }
  const roi=r=>r.y===r.line?0:r.y<r.line?-1:1/impliedProbability(r.odds)-1;
  const priced=rows.filter(r=>impliedProbability(r.odds)!==null);
  const ev=r=>expectedValue(r.p,r.odds,r.push);
  const realized=byGame(priced,roi);
  const selected=priced.filter(r=>ev(r)>0);
  const positive=byGame(selected,roi);
  const paired=byGame(binary.filter(r=>Number.isFinite(r.book)),r=>brier(r)-(r.book-y(r))**2);
  return {games:new Set(rows.map(r=>r.game)).size,contracts:rows.length,binaryGames:games.length,
    pushes:rows.length-binary.length,brier:mean(games),logLoss:mean(byGame(binary,r=>-Math.log(y(r)?r.p:1-r.p))),
    accuracy:mean(byGame(binary,r=>Number((r.p>=.5)===Boolean(y(r))))),
    mae:mean(byGame(rows,r=>Number.isFinite(r.mu)?Math.abs(r.y-r.mu):null)),
    ece:games.length?cal.reduce((s,b)=>s+b.mass*Math.abs(b.p-b.observed),0)/games.length:null,
    brier95:uncertainty?interval(games):null,calibrationBins:cal,
    pricedGames:realized.length,simulatedRoi:mean(realized),meanEv:mean(byGame(priced,ev)),
    positiveEvGames:positive.length,positiveEvRoi:mean(positive),positiveEvRoi95:uncertainty?interval(positive):null,
    differenceVsBookBrier:mean(paired),differenceVsBookBrier95:uncertainty?interval(paired):null};
}
