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
 return <section aria-label="Selecciones NBA GOAT SHADOW" className="mlb-ui sport-standard sport-standard-p¶»§q«^