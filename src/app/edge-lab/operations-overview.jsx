'use client';
import {useEffect,useRef,useState} from 'react';
import OperationalNotice from './operational-notice';
export default function OperationsOverview(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),active=useRef(null);
 async function refresh(){if(active.current)return;const controller=new AbortController();active.current=controller;setBusy(true);const timeout=setTimeout(()=>controller.abort(),25000);
  try{const r=await fetch('/api/edge-lab/multi?mode=summary',{cache:'no-store',signal:controller.signal}),b=await r.json();if(!r.ok||!b.diagnostics?.read_only)throw Error('No se pudo verificar el estado operativo');if(active.current===controller){setData(b);setError('');}}
  catch(e){if(active.current!==controller)return;if(!controller.signal.aborted)setError(e.message);else setError('Consulta cancelada o excedida. El estado anterior no se certifica como actual.');}
  finally{clearTimeout(timeout);if(active.current===controller){active.current=null;setBusy(false);}}
 }
 useEffect(()=>{refresh();return()=>{const previous=active.current;active.current=null;previous?.abort();};},[]);
 return <aside style={{maxWidth:1250,width:'100%',margin:'auto',padding:'16px 24px'}} aria-label="Límites y seguimiento">
 <details><summary>Estado de consultas y resultados pendientes</summary><p>Este diagnóstico lee lo guardado. No ejecuta motores, no consulta proveedores y no cambia límites. Pulsa para actualizar su corte.</p>
 <button onClick={refresh} disabled={busy} style={{padding:10,border:'1px solid #64748b',borderRadius:8}}>{busy?'Comprobando…':'Actualizar diagnóstico'}</button>
 {error&&<p role="alert">{error}</p>}
 {data?.diagnostics?.settlement_coverage?.map(c=><OperationalNotice key={c.sport} sport={c.sport} data={data} coverage={c} nextDue={data.states?.find(s=>s.sport===c.sport)?.next_due}/>)}</details>
 </aside>;
}
