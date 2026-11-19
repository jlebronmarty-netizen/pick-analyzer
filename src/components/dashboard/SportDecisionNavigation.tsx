import Link from 'next/link';

export const PICK_SPORTS = [
 {id:'NBA',label:'NBA',href:'/nba',detail:'Decision Board · seis mercados'},
 {id:'NHL',label:'NHL',href:'/nhl',detail:'Moneyline · evidencias y resultados'},
 {id:'NCAAB',label:'NCAAB',href:'/ncaab',detail:'Proyecciones experimentales'},
 {id:'NCAAF',label:'NCAAF',href:'/ncaaf',detail:'Edge Lab · modelos disponibles'},
 {id:'SOCCER',label:'Fútbol',href:'/soccer',detail:'Edge Lab · mercados verificados'},
 {id:'TABLE_TENNIS',label:'Tenis de mesa',href:'/table-tennis',detail:'Edge Lab · mercado registrado'},
 {id:'MLB',label:'MLB',href:'/mlb',detail:'Decision Board · temporada pausada'},
] as const;

export default function SportDecisionNavigation({current,compact=false}:{
 current?:string;compact?:boolean
}) {
 return <nav aria-label="Navegación de Decision Boards por deporte" className="space-y-3">
  {!compact&&<div><p className="text-xs font-bold uppercase tracking-widest text-teal-300">Pick Analyzer · todos los deportes</p>
   <h2 className="mt-1 text-lg font-semibold">Selecciona un deporte</h2>
   <p className="mt-1 text-xs text-slate-400">La estructura visual es compartida. Los mercados mostrados dependen de los datos y validación disponibles en cada modelo.</p></div>}
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
   {PICK_SPORTS.map(s=><Link key={s.id} href={s.href} prefetch={false}
    aria-current={current===s.id?'page':undefined}
    className={`rounded-xl border p-3 transition-colors hover:border-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300 ${current===s.id?'border-teal-400 bg-teal-500/10':'border-slate-700 bg-slate-900/70'}`}>
    <p className="font-semibold text-slate-100">{s.label}</p>
    {!compact&&<p className="mt-1 text-[11px] leading-4 text-slate-400">{s.detail}</p>}
   </Link>)}
  </div>
 </nav>;
}
