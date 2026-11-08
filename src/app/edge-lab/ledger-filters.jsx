'use client';
import {useState} from 'react';
import {visibleLedgerRows} from '../../lib/edge-lab/ledger-visibility.mjs';
export function useLedgerView(originalRows){
 const [period,setPeriod]=useState('TODAY'),[kind,setKind]=useState('MODELED');
 const rows=visibleLedgerRows(originalRows,{period,kind}),events=new Set(rows.map(r=>r.event_id));
 const selectStyle={padding:10,border:'1px solid #64748b',borderRadius:8,background:'#0f172a',color:'#e2e8f0',maxWidth:'100%'};
 const controls=<div style={{margin:'16px 0'}}>
  <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
   <label>Fecha PR<br/><select aria-label="Periodo de selecciones" value={period} onChange={e=>setPeriod(e.target.value)} style={selectStyle}><option value="TODAY">Hoy</option><option value="UPCOMING">Próximas sin iniciar</option><option value="ALL">Todo el historial</option></select></label>
   <label>Tipo de registro<br/><select aria-label="Tipo de selecciones" value={kind} onChange={e=>setKind(e.target.value)} style={selectStyle}><option value="MODELED">Selecciones y proyecciones</option><option value="ABSTAIN">PASAR / abstenciones</option><option value="ALL">Todos los registros</option></select></label>
  </div><p role="status">{rows.length} registros en {events.size} partidos para este filtro. El accuracy acumulado no cambia al filtrar.</p>
  <p>FORECAST: selección del modelo. PROJECTION: estimación numérica sin contrato de apuesta. PASAR: sin selección. SHADOW / MODEL_ONLY no equivale a una apuesta aprobada.</p>
  {!rows.length&&<p>No hay registros para este filtro. Revisa «Próximas sin iniciar» o «Todo el historial» y el estado de actualización.</p>}
 </div>;
 return {rows,controls};
}
