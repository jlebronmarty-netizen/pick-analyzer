import {score} from './scoring.mjs';

// Secondary chronological analysis within the only price-covered season.
export function marketAnchor(priced) {
  const cutoff=Date.parse('2025-01-01T00:00:00Z')/1000;
  const end=Date.parse('2025-02-01T00:00:00Z')/1000;
  const train=priced.filter(r=>r.tip+28800<cutoff);
  const tune=priced.filter(r=>r.tip-3600>=cutoff && r.tip+28800<end);
  const out=priced.filter(r=>r.tip-3600>=end);
  if(!train.length || !tune.length || !out.length)return null;
  const logit=p=>Math.log(p/(1-p));
  const adjusted=(r,w,offset)=>1/(1+Math.exp(-(logit(r.book)*(1-w)+logit(r.p)*w+offset)));
  const specs=[{w:0,offset:0,method:'no_vig'},{w:.15,offset:0,method:'15pct_residual'},
    {w:.35,offset:0,method:'35pct_residual'}];
  const loss=(rows,s)=>score(rows.map(r=>({...r,p:adjusted(r,s.w,s.offset)})),false).brier;
  const fitted=[-.15,-.075,0,.075,.15].map(offset=>({w:.15,offset,method:'15pct_plus_intercept'}))
    .sort((a,b)=>loss(train,a)-loss(train,b)||Math.abs(a.offset)-Math.abs(b.offset))[0];
  specs.push(fitted);
  const ranked=specs.map(s=>({...s,selectionBrier:loss(tune,s)})).sort((a,b)=>a.selectionBrier-b.selectionBrier);
  const selected=ranked[0];
  return {trainingGames:train.length,selectionGames:tune.length,holdoutGames:out.length,
    holdoutFrom:'2025-02-01T00:00:00Z',selected:selected.method,
    candidates:ranked.map(s=>({...s,holdoutBrier:loss(out,s)})),
    evaluation:score(out.map(r=>({...r,p:adjusted(r,selected.w,selected.offset)})))};
}
