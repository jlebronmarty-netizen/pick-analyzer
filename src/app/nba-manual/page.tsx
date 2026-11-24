'use client';
import {useState,useRef} from 'react';
import Link from 'next/link';
type Metric={value:number|null;n:number};
type Game={id:string;date:string;opponent:string;home:boolean;pointsFor:number;pointsAgainst:number};
type Team={name:string;observedGames:number;wins:number;losses:number;pointsFor:Metric;pointsAgainst:Metric;recent:Game[];sequenceVerified:boolean};
type Player={playerId:string;observedTeamId:number;observedAppearances:number;averages:Record<string,Metric>;recent:Record<string,unknown>[];sequenceVerified:boolean};
type Fixture={id:number;scheduledAt:string;home:{name:string;id:number};away:{name:string;id:number};state:string};
type Report={schemaVersion:string;date:string;status:string;readAt:string;source:{scheduleCapturedAt:string};coverage:Record<string,number>;fixtures:Fixture[];teams:Team[];players:Player[];warnings:string[]};
const tabs=['Resumen','Partidos','Equipos','Últimos 10','Jugadores','Cuartos y mitades','Lesiones y alineaciones','Matchups'] as const;
const fmt=(n:number|null|undefined)=>n==null?'—':n.toLocaleString('es-PR',{maximumFractionDigits:1});
const stamp=(s:string)=>new Date(s).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export default function Page(){
 const [date,setDate]=useState(today),[report,setReport]=useState<Report|null>(null),[tab,setTab]=useState<typeof tabs[number]>('Resumen'),[query,setQuery]=useState(''),[page,setPage]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const req=useRef<AbortController|null>(null);
 async function load(){req.current?.abort();const c=new AbortController();req.current=c;setLoading(true);setError('');setReport(null);try{const res=await fetch('/api/nba/manual-data?date='+encodeURIComponent(date),{cache:'no-store',signal:c.signal});const r=await res.json();if(!res.ok||r.schemaVersion!=='NBA_MANUAL_DATA_V1'||r.date!==date||r.readOnly!==true||!Array.isArray(r.teams)||!Array.isArray(r.players))throw Error();if(!c.signal.aborted)setReport(r);}catch{if(!c.signal.aborted)setError('No se pudo verificar el archivo. Intenta nuevamente.');}finally{if(!c.signal.aborted)setLoading(false);}}
 const q=query.toLowerCase().trim(),teams=report?.teams.filter(t=>t.name.toLowerCase().includes(q))??[],players=report?.players.filter(p=>p.playerId.includes(q)||String(p.observedTeamId)===q)??[];
 const control='rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm min-h-11';
 return <main className="mx-auto max-w-6xl space-y-5 p-4 text-slate-100">
 <Link href="/nba" className="text-teal-300">Volver a NBA</Link><h1 className="text-2xl font-bold">NBA · Datos compartidos para el análisis</h1>
 <p className="text-sm text-slate-300">Archivo observado de Pick. Los registros incompletos no se consideran una secuencia certificada.</p>
 <div className="flex flex-wrap gap-2 items-end"><label className="flex flex-col text-sm">Fecha PR<input className={control} type="date" value={date} onChange={e=>{req.current?.abort();setDate(e.target.value);setReport(null);setLoading(false);setError('');}}/></label><button className={control} onClick={load} disabled={loading||!date}>{loading?'Consultando…':'Consultar datos compartidos'}</button></div>
 {error&&<p role="alert" className="text-amber-300">{error}</p>}
 {report&&<><p className="text-sm">Calendario: {stamp(report.source.scheduleCapturedAt)} PR · Lectura: {stamp(report.readAt)} PR</p><div className="flex flex-wrap gap-2" role="tablist">{tabs.map(t=><button key={t} role="tab" aria-selected={tab===t} className={control+(tab===t?' border-teal-300 text-teal-300':'')} onClick={()=>{setTab(t);setQuery('');setPage(0);}}>{t}</button>)}</div>
 <section role="tabpanel" className="space-y-3">
 {tab==='Resumen'&&<><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Object.entries(report.coverage).map(([k,v])=><div key={k} className="rounded-lg border border-slate-700 p-3"><div className="text-xs">{({fixtures:'Partidos del día',observedFinals:'Finales observados',goatGames:'Partidos GOAT',playerRows:'Registros individuales',players:'Jugadores',conflicts:'Conflictos excluidos',matchedFinals:'Finales vinculados a GOAT'} as Record<string,string>)[k]??k}</div><strong className="text-xl">{v}</strong></div>)}</div>{report.warnings.map(w=><p key={w} className="text-sm text-amber-200">{w}</p>)}</>}
 {tab==='Partidos'&&report.fixtures.map(f=><article key={f.id} className="rounded-lg border border-slate-700 p-4"><strong>{f.away.name} @ {f.home.name}</strong><p>{stamp(f.scheduledAt)} PR · {f.state}</p></article>)}
 {(tab==='Equipos'||tab==='Últimos 10'||tab==='Jugadores')&&<input className={control} aria-label="Buscar" placeholder={tab==='Jugadores'?'ID de jugador o equipo':'Buscar equipo'} value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>}
 {(tab==='Equipos'||tab==='Últimos 10')&&teams.slice(page*12,page*12+12).map(t=><article key={t.name} className="rounded-lg border border-slate-700 p-4"><strong>{t.name}</strong><p>{t.wins}–{t.losses} · {t.observedGames} finales observados · {fmt(t.pointsFor.value)} / {fmt(t.pointsAgainst.value)} puntos</p><p className="text-xs text-amber-200">Cobertura no certificada como temporada completa.</p>{tab==='Últimos 10'&&t.recent.map(g=><div key={g.id} className="border-t border-slate-700 py-2 text-sm">{stamp(g.date)} · {g.home?'Local':'Visitante'} · {g.opponent} · {g.pointsFor}–{g.pointsAgainst}</div>)}</article>)}
 {tab==='Jugadores'&&players.slice(page*12,page*12+12).map(p=><article key={p.playerId} className="rounded-lg border border-slate-700 p-4"><strong>Jugador ID {p.playerId}</strong><p>Equipo observado: {p.observedTeamId} · {p.observedAppearances} apariciones archivadas</p><p className="text-xs text-amber-200">Últimas apariciones observadas, no secuencia verificada.</p><div className="flex flex-wrap gap-3">{Object.entries(p.averages).map(([k,m])=><span key={k}>{k}: {fmt(m.value)} ({m.n})</span>)}</div><details><summary>Partidos recientes</summary>{p.recent.map((g,i)=><p key={i} className="text-xs">{String(g.date)} · PTS {String(g.pts??'—')} · REB {String(g.reb??'—')} · AST {String(g.ast??'—')}</p>)}</details></article>)}
 {['Equipos','Últimos 10','Jugadores'].includes(tab)&&<div className="flex items-center gap-3"><button className={control} disabled={page===0} onClick={()=>setPage(page-1)}>Anterior</button><span>Página {page+1}</span><button className={control} disabled={(page+1)*12>=(tab==='Jugadores'?players.length:teams.length)} onClick={()=>setPage(page+1)}>Siguiente</button></div>}
 {['Cuartos y mitades','Lesiones y alineaciones','Matchups'].includes(tab)&&<p className="text-amber-200">Integración pendiente de conciliación de las fuentes. No se muestran valores inventados.</p>}
 </section></>}
 </main>;
}
