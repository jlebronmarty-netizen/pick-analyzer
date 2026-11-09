'use client';
import {useEffect,useRef,useState} from 'react';
const pct=v=>typeof v==='number'?(v*100).toFixed(2)+'%':'N/A';
const num=v=>typeof v==='number'?v.toFixed(2):'N/A';
const price=v=>typeof v==='number'?(v>0?'+'+v:String(v)):'N/A';
const date=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'}):'N/A';
const market={moneyline:'Moneyline',spread:'Spread',total:'Total'};
export default function NbaModelReport(){
 const [data,setData]=useState(null),[error,setError]=useState(''),active=useRef(null);
 async function refresh(){if(active.current)return;const c=new AbortController();active.current=c;const t=setTimeout(()=>c.abort(),20000);try{const r=await fetch('/api/market-data/nba/model-report',{cache:'no-store',signal:c.signal}),b=await r.json();if(!r.ok)throw Error('read');if(active.current===c){setData(b);setError('');}}catch{if(active.current===c)setError('Reporte SHADOW no verificado; esto no equivale a cero selecciones.');}finally{clearTimeout(t);if(active.current===c)active.current=null;}}
 useEffect(()=>{refresh();const id=setInterval(()=>{if(!document.hidden)refresh();},300000);return()=>{clearInterval(id);const c=active.current;active.current=null;c?.abort();};},[]);
 const box={maxWidth:1200,margin:'20px auto',padding:20,border:'1px solid #334155',borderRadius:12,color:'#e2e8f0',background:'#0f172a'};
 return <section aria-label="Selecciones NBA GOAT SHADOW" className="mlb-ui sport-standard sport-standard-panel" style={box}><h2>NBA · selecciones GOAT SHADOW</h2><p>Estas selecciones se guardan antes del partido para medir accuracy. No son Official Picks, no son APOSTAR y no incluyen las 61 filas legacy.</p>
 {error&&<p role="alert">{error}</p>}{data&&<><div style={{display:'flex',gap:18,flexWrap:'wrap'}}>{data.metrics.map(m=><div key={m.market}><strong>{market[m.market]??m.market}</strong><br/>{m.wins} W / {m.losses} L · {m.pending} pendientes · {pct(m.accuracy)}</div>)}</div>
 <div style={{overflowX:'auto',marginTop:16}}><table style={{width:'100%',textAlign:'left',borderSpacing:10}}><thead><tr>{['Inicio PR','Partido','Mercado','Selección','Línea','Cuota','Prob. modelo','Prob. implícita','Edge','EV','Confianza','Resultado'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{data.rows.map(r=><tr key={r.id}><td>{date(r.commence_time)}</td><td>{r.away_team} @ {r.home_team}</td><td>{market[r.market]??r.market}</td><td>{r.team??r.selection}</td><td>{r.line??'—'}</td><td>{price(r.odds)}</td><td>{num(r.model_probability)}%</td><td>{num(r.implied_probability)}%</td><td>{num(r.edge)}%</td><td>{num(r.ev)}%</td><td>{num(r.confidence)}%</td><td>{r.result??'pending'}</td></tr>)}</tbody></table></div>
 {!data.rows.length&&<p>Aún no hay selecciones en el nuevo cohort GOAT.</p>}<p>Lectura: {date(data.checked_at)} PR. Accuracy = W/(W+L); pushes y pendientes quedan fuera.</p></>}</section>;
}
