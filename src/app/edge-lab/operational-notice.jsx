'use client';
import {ttBudgetStatus,settlementCoverage} from '../../lib/edge-lab/operational-readiness.mjs';
const format=v=>v?new Date(v).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'}):'No confirmado';
export default function OperationalNotice({sport,data,rows,coverage:observedCoverage=null,nextDue=null,paused=false}){
 if(!data?.checked_at||paused)return null;
 const coverage=observedCoverage??settlementCoverage(rows,sport,data.checked_at,{reviewAfterHours:sport==='NCAAF'?8:4});
 const budget=sport==='TT'?ttBudgetStatus(data.budget,data.checked_at,nextDue):null;
 return <section aria-label="Seguimiento operativo" style={{border:'1px solid #64748b',borderRadius:12,padding:16,marginTop:16}}>
 <h2>{sport==='TT'?'Tenis de mesa':'NCAAF'} · seguimiento operativo</h2><p>Comprobación: {format(data.checked_at)} · hora de Puerto Rico.</p>
 {coverage.status==='OBSERVED'&&<><p>Partidos futuros con proyecciones: <strong>{coverage.future_events}</strong>. Partidos iniciados sin resultado guardado: <strong>{coverage.started_pending_events}</strong>. Un partido con varios mercados cuenta una sola vez aquí.</p>
 {coverage.review_events>0&&<p role="status">Revisar {coverage.review_events} partido(s): transcurrieron {coverage.review_after_hours} horas desde el inicio programado sin evaluación guardada. Esto no confirma que hayan finalizado ni los convierte en pérdidas.</p>}
 {coverage.disputed_contracts>0&&<p>Contratos en disputa o sin verificación: {coverage.disputed_contracts}. Permanecen fuera del accuracy certificado.</p>}</>}
 {budget&&budget.status!=='UNKNOWN'&&<><p>Consultas locales de tenis de mesa: <strong>{budget.daily_used}/{budget.daily_cap}</strong> del día UTC; <strong>{budget.monthly_used}/{budget.monthly_cap}</strong> del mes. No representa el saldo de la cuenta del proveedor.</p>
 {!budget.full_cycle_budget_available&&<p role="status"><strong>{budget.status==='LOCAL_LIMIT_REACHED'?'Límite local alcanzado.':'Presupuesto insuficiente para un ciclo completo.'}</strong> No se amplían cuotas ni se contratan servicios. Un ciclo completo puede utilizar hasta tres consultas.</p>}
 {budget.budget_reset_at&&<p>Próxima renovación del límite aplicable: {format(budget.budget_reset_at)}. Próximo ciclo completo no antes de: {format(budget.next_full_cycle_not_before)}; no garantiza ejecución a esa hora.</p>}</>}
 {budget?.status==='UNKNOWN'&&<p>No se pudo verificar el contador local de consultas; no se supone saldo disponible.</p>}
 </section>;
}
