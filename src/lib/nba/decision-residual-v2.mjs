/** Offline distribution of out-of-game forecast errors. All probabilities conditional on action. */
export const METHODS = ['logistic', 'empirical'];
export const TEMPERATURES = [0.75, 1, 1.25, 1.5];
export const MODELV = 'nba-residual-20261120.1';
const clamp = p => Math.max(0.001, Math.min(0.999, p));
const sigmoid = z => 1 / (1 + Math.exp(-z));

export function fitErrors(rows) {
  const counts = new Map();
  for (const r of rows) counts.set(r.game, (counts.get(r.game) ?? 0) + 1);
  if (counts.size < 100) return null;
  const n = counts.size;
  const samples = rows.map(r => ({e:r.y - r.mu, w:1 / counts.get(r.game)})).sort((a,b) => a.e-b.e);
  const mean = samples.reduce((s,x) => s+x.w*x.e,0) / n;
  const variance = samples.reduce((s,x) => s+x.w*(x.e-mean)**2,0) / n;
  let i=0, mass=samples[0].w;
  const quantiles = Array.from({length:201}, (_,k) => {
    const target=(k+.5)*n/201;
    while (mass<target && i+1<samples.length) mass+=samples[++i].w;
    return Number(samples[i].e.toFixed(4));
  });
  return {games:n,mean,scale:Math.max(.01,Math.sqrt(variance)*Math.sqrt(3)/Math.PI),quantiles};
}
export function residualForecast(fit, method, temperature, mu, line, {noDraw=false}={}) {
  if (!fit || !METHODS.includes(method) || !TEMPERATURES.includes(temperature) ||
      !Number.isFinite(mu) || !Number.isSafeInteger(2*line) || typeof line!=='number') return null;
  function cdf(x) {
    if (method==='logistic') return sigmoid((x-mu-fit.mean)/fit.scale);
    const qs=fit.quantiles;
    let lo=0, hi=qs.length;
    while (lo<hi) {const mid=(lo+hi)>>>1; if(qs[mid]<=x-mu) lo=mid+1; else hi=mid;}
    return (lo+.5)/(qs.length+1);
  }
  const integral=Number.isInteger(line);
  const lose=cdf(integral ? line-.5 : line);
  const win=1-cdf(integral ? line+.5 : line);
  const conditional=clamp(win/(win+lose));
  const probability=clamp(sigmoid(Math.log(conditional/(1-conditional))/temperature));
  return {probability,pushProbability:noDraw ? 0 : Math.max(0,1-win-lose)};
}
