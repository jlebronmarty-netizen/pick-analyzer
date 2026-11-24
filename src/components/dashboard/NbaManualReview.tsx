'use client';
import {useState,useEffect} from 'react';
import {createManualPrediction,gradeManualPrediction,summarizeManualAccuracy,recentTeamSummary,validManualPrediction} from '@/lib/nba/manual-review-core.mjs';

type Fixture={id:number;scheduledAt:string;home:{id:number;name:string};away:{id:number;name:string};state:string};
type Final={gameId:string;scheduledAt:string;home:string;away:string;homeScore:number;awayScore:number};
type Team={name:string;recent:{pointsFor:number;pointsAgainst:number}[];sequenceVerified:boolean};
type Prediction={id:string;gameId:string;home:string;away:string;scheduledAt:string;recordedAt:string;market:string;side:string;line:number|null};
type Report={fixtures:Fixture[];teams:Team[];finals?:Final[];coverage:Record<string,number>;readAt:string};
const key='pick-nba-manual-tracker-preview-v1';
const control='min-h-11 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm';
const pct=(v:number|null)=>v===null?'—':(v*100).toFixed(1)+'%';
const fmt=(v:number|null)=>v===null?'—':v.toFixed(1);
const when=(s:string)=>new Date(s).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'});
export function NbaManualDailyDashboard({report}:{report:Report}){
 return <div className="space-y-3"><p className="text-sm text-amber-200">Comparación descriptiva de resultados observados, no una proyección calibrada ni recomendación oficial. Los historiales todavía no certifican todos los partidos consecutivos.</p>
 {report.fixtures.map(f=>{
 const away=recentTeamSummary(report.teams.find(t=>t.name===f.away.name)),home=recentTeamSummary(report.teams.find(t=>t.name===f.home.name));
 return <article key={f.id} className="rounded-xl border border-slate-700 p-4 space-y-3"><div><strong>{f.away.name} @ {f.home.name}</strong><p className="text-xs text-slate-400">{when(f.scheduledAt)} PR · {f.state}</p></div>
 <div className="grid grid-cols-2 gap-3">{[{name:f.away.name,s:away},{name:f.home.name,s:home}].map(({name,s})=><section key={name} className="rounded-lg bg-slate-900 p-3"><h3 className="font-semibold">{name}</h3><p className="text-xs text-amber-200">{s.n}/10 resultados observados · {s.sequenceVerified?'Secuencia verificada':'Secuencia no certificada'}</p><p>{s.wins}–{s.losses}</p><p className="text-sm">Puntos a favor: {fmt(s.pointsFor)}<br/>Puntos en contra: {fmt(s.pointsAgainst)}<br/>Margen observado: {fmt(s.margin)}</p></section>)}</div></article>;
 })}
 {!report.fixtures.length&&<p>No hay partidos archivados para esta fecha.</p>}
 </div>;
}
export function NbaManualTracker({report}:{report:Report}){
 const [rows,setRows]=useState<Prediction[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[game,setGame]=useState(''),[market,setMarket]=useState('moneyline'),[side,setSide]=useState('home'),[line,setLine]=useState('');
 useEffect(()=>{try{const value=localStorage.getItem(key);if(value){const parsed=JSON.parse(value);if(!Array.isArray(parsed)||parsed.length>1000||!parsed.every(validManualPrediction)||new Set(parsed.map(p=>p.id)).size!==parsed.length)throw Error();setRows(parsed);}setLoaded(true);}catch{setError('No se pudo leer el registro local. No se sobrescribirá.');}},[]);
 const finals=report.finals??[],counts=summarizeManualAccuracy(rows,finals);
 const selected=report.fixtures.find(f=>String(f.id)===game);
 function record(){
 setError('');
 if(!loaded||!selected||rows.length>=1000){setError('Selecciona un partido disponible.');return;}
 const p=createManualPrediction(selected,{market,side,line:market==='moneyline'?null:line.trim()?Number(line):null},new Date().toISOString(),crypto.randomUUID()) as Prediction|null;
 if(!p){setError('El partido debe estar programado y no haber iniciado; verifica el lado y la línea.');return;}
 if(rows.some(r=>r.gameId===p.gameId&&r.market===p.market&&r.side===p.side&&r.line===p.line)){setError('Ese pronóstico ya está registrado.');return;}
 const next=[p,...rows];try{localStorage.setItem(key,JSON.stringify(next));setRows(next);}catch{setError('No se pudo guardar el pronóstico en este navegador.');}
 }
 return <div className="space-y-4"><div className="rounded-lg border border-amber-800 p-3 text-sm text-amber-200">Prueba local del tracker: guarda en este navegador únicamente, no en el panel privado. La hora de registro depende del reloj del dispositivo. Los resultados se evalúan contra los finales observados del reporte consultado; no es liquidación de una casa de apuestas ni accuracy oficial de Pick.</div>
 <div className="grid grid-cols-2 md:grid-cols-5 gap-2">{[['Accuracy',pct(counts.accuracy)],['Acertados',counts.wins],['Fallados',counts.losses],['Push',counts.pushes],['Pendientes',counts.pending]].map(([label,value])=><div key={label} className="rounded-lg border border-slate-700 p-3"><div className="text-xs">{label}</div><strong className="text-xl">{value}</strong></div>)}</div>
 <div className="flex flex-wrap items-end gap-3"><label className="flex flex-col text-sm">Partido<select className={control} value={game} onChange={e=>setGame(e.target.value)}><option value="">Seleccionar</option>{report.fixtures.filter(f=>f.state==='scheduled').map(f=><option key={f.id} value={String(f.id)}>{f.away.name} @ {f.home.name}</option>)}</select></label>
 <label className="flex flex-col text-sm">Mercado<select className={control} value={market} onChange={e=>{setMarket(e.target.value);setSide(e.target.value==='total'?'over':'home');setLine('');}}><option value="moneyline">Ganador</option><option value="spread">Hándicap</option><option value="total">Total de puntos</option></select></label>
 <label className="flex flex-col text-sm">Selección<select className={control} value={side} onChange={e=>setSide(e.target.value)}>{market==='total'?<><option value="over">Over</option><option value="under">Under</option></>:<><option value="home">{selected?.home.name??'Local'}</option><option value="away">{selected?.away.name??'Visitante'}</option></>}</select></label>
 {market!=='moneyline'&&<label className="flex flex-col text-sm">{market==='spread'?'Línea de la selección (+/−)':'Línea total'}<input className={control+' w-32'} type="number" step="0.5" value={line} onChange={e=>setLine(e.target.value)}/></label>}
 <button className={control} disabled={!loaded||!selected} onClick={record}>Registrar pronóstico</button></div>
 {error&&<p role="alert" className="text-amber-200">{error}</p>}
 <p className="text-xs text-slate-400">Consulta una fecha posterior al partido para recuperar el final. Accuracy = aciertos / (aciertos + fallos), excluye pushes y pendientes.</p>
 {rows.map(p=>{const status=gradeManualPrediction(p,finals);return <article key={p.id} className="rounded-lg border border-slate-700 p-3"><strong>{p.away} @ {p.home}</strong><p className="text-sm">{p.market} · {p.side==='home'?p.home:p.side==='away'?p.away:p.side}{p.line!==null?' '+p.line:''} · {({WIN:'Acertado',LOSS:'Fallado',PUSH:'Push',PENDING:'Pendiente'} as Record<string,string>)[status]??status}</p><p className="text-xs">Registro local: {when(p.recordedAt)} PR</p></article>;})}
 {!rows.length&&<p className="text-sm">Todavía no has registrado pronósticos en este navegador.</p>}
 </div>;
}
