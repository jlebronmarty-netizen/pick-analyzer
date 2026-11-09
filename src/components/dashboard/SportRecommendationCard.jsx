export default function SportRecommendationCard({
  eyebrow='Selección del modelo · SHADOW',
  title,
  matchup,
  lines=[],
  priceLine,
  timeLine,
  warning,
  result,
  children,
}){
 return <article className="rounded-xl border border-slate-700 bg-slate-900 p-5">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">{eyebrow}</p>
   {result&&<span className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300">{result}</span>}
  </div>
  <h3 className="mt-3 break-words text-2xl font-bold text-white">{title}</h3>
  {matchup&&<p className="mt-3 text-base text-slate-200">{matchup}</p>}
  {lines.map((line,i)=><p key={i} className={i===0?'mt-3 text-base text-slate-200':'mt-2 text-sm text-slate-300'}>{line}</p>)}
  {priceLine&&<p className="mt-3 text-sm text-slate-300">{priceLine}</p>}
  {timeLine&&<p className="mt-3 text-xs text-slate-400">{timeLine}</p>}
  {warning&&<p className="mt-3 text-xs text-amber-200">{warning}</p>}
  {children&&<div className="mt-4">{children}</div>}
 </article>;
}
