import {score,gameMean} from './scoring.mjs';

function measures(rows){
  const s=score(rows,false);
  const binary=rows.filter(r=>r.y!==r.line);
  const pair=binary.filter(r=>Number.isFinite(r.book));
  const outcome=r=>Number(r.y>r.line);
  return {brier:s.brier,logLoss:s.logLoss,accuracy:s.accuracy,overOrSelectedSideWinRate:gameMean(binary,outcome),
    calibrationError:s.ece,meanEv:s.meanEv,simulatedRoi:s.simulatedRoi,positiveEvRoi:s.positiveEvRoi,
    archivedDecimalRoi:gameMean(rows,r=>Number.isFinite(r.decimal)&&r.decimal>1?
      r.y===r.line?0:r.y>r.line?r.decimal-1:-1:null),
    bookLogLoss:gameMean(pair,r=>-Math.log(outcome(r)?r.book:1-r.book)),
    bookBrier:gameMean(pair,r=>(r.book-outcome(r))**2),pairedBrierDifference:s.differenceVsBookBrier};
}
export function scoreForward(rows) {
  const s=score(rows,false),estimate=measures(rows),byGame=new Map();
  for(const r of rows){if(!byGame.has(r.game))byGame.set(r.game,[]);byGame.get(r.game).push(r);}
  const blocks=[...byGame.entries()].sort(([a],[b])=>String(a).localeCompare(String(b))).map(([,g])=>g);
  const keys=Object.keys(estimate);
  // Cache per-game sufficient statistics. Each bootstrap draw then reweights whole games.
  const compact=blocks.map(block=>{
    const values=measures(block),bins=score(block,false).calibrationBins;
    return {values,bins:bins.map(b=>[b.bin,b.mass*(b.p-b.observed)])};
  });
  const samples=Object.fromEntries(keys.map(k=>[k,[]]));
  const n=blocks.length, exact=n<=5, repeats=n<2?0:exact?n**n:1000;
  let seed=393;
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(n*seed/2**32);};
  for(let i=0;i<repeats;i++){
    const sums=Array(keys.length).fill(0),counts=Array(keys.length).fill(0),bins=Array(10).fill(0);
    let binaryGames=0;
    for(let j=0;j<n;j++){
      const k=exact?Math.floor(i/n**j)%n:next(),block=compact[k];
      for(let m=0;m<keys.length;m++){
        const v=block.values[keys[m]];
        if(Number.isFinite(v)){sums[m]+=v;counts[m]++;}
      }
      if(block.bins.length)binaryGames++;
      for(const [index,delta] of block.bins)bins[index]+=delta;
    }
    keys.forEach((key,m)=>{
      if(counts[m])samples[key].push(key==='calibrationError'?bins.reduce((sum,v)=>sum+Math.abs(v),0)/binaryGames:sums[m]/counts[m]);
    });
  }
  const intervals={};
  for(const [k,a] of Object.entries(samples)){
    a.sort((x,y)=>x-y);
    intervals[k]=a.length===repeats && repeats>0?[a[Math.floor(.025*(a.length-1))],a[Math.ceil(.975*(a.length-1))]]:null;
  }
  return {...s,...estimate,intervals95:intervals,brier95:intervals.brier,
    differenceVsBookBrier95:intervals.pairedBrierDifference,positiveEvRoi95:intervals.positiveEvRoi,bootstrapReplicates:repeats,
    wins:rows.filter(r=>r.y>r.line).length,losses:rows.filter(r=>r.y<r.line).length,
    pairedBinaryGames:new Set(rows.filter(r=>r.y!==r.line&&Number.isFinite(r.book)).map(r=>r.game)).size};
}
