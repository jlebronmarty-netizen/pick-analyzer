import type { QualifiedReport } from './qualified-plays';
import type { NhlReport } from './nhl-external-report';
import { engineTotals } from './mlb-engine-hub';

export const OFFICIAL_MLB_MODEL = 'MLB_MONEYLINE_REG_LOGISTIC_C1_2025_V1';
export type ModelCohort = { key:string; label:string; available:boolean; wins:number|null; losses:number|null; pending:number|null; pushes:number|null; voids:number|null; models:number|null; accuracy:number|null; note:string };
export type SportModelCard = { key:string; label:string; href:string; classification:string; cohorts:ModelCohort[] };
type Official = { status:string; summary:{wins:number;losses:number;pushes:number;voids:number;modelVersions:string[];dateFrom:string|null;dateTo:string|null};ledger:{pendingUniqueSelections:number} } | null;
const empty=(key:string,label:string,note:string):ModelCohort=>({key,label,available:false,wins:null,losses:null,pending:null,pushes:null,voids:null,models:null,accuracy:null,note});
export function mlbModelCohorts(research:QualifiedReport, official:Official):ModelCohort[]{
  return ['REGULAR_SEASON','POSTSEASON'].map(phase=>{
    const label=phase==='REGULAR_SEASON'?'MLB 2026 · temporada regular':'MLB 2026 · playoffs';
    if(research.status==='UNAVAILABLE')return empty(phase,label,'Registro de modelos no disponible');
    const groups=research.groups.filter(g=>g.phase===phase), t=engineTotals(groups);
    const versions=new Set(groups.map(g=>g.model));
    let wins=t.wins,losses=t.losses,pending=t.open,pushes=t.pushes,voids=t.voids;
    if(phase==='REGULAR_SEASON'){
      // The immutable production model is explicitly regular-season-only. Unknown
      // versions/years or an overlapping master model require review, not pooling.
      if(!official||['UNAVAILABLE','INVALID_SETTLEMENT_EVIDENCE'].includes(official.status)||
        official.summary.modelVersions.some(v=>v!==OFFICIAL_MLB_MODEL)||versions.has(OFFICIAL_MLB_MODEL)||
        [official.summary.dateFrom,official.summary.dateTo].some(d=>d!==null&&!d.startsWith('2026-')))
        return empty(phase,label,'No se pudo verificar el conjunto completo, incluido ML oficial');
      wins+=official.summary.wins;losses+=official.summary.losses;pending+=official.ledger.pendingUniqueSelections;
      pushes+=official.summary.pushes;voids+=official.summary.voids;
      official.summary.modelVersions.forEach(v=>versions.add(v));
    }
    return {key:phase,label,available:true,wins,losses,pending,pushes,voids,models:versions.size,
      accuracy:wins+losses?wins/(wins+losses):null,
      note:phase==='REGULAR_SEASON'?'Pick, Edge, Equilizer y ML oficial · registros de modelos':'Forward shadow de playoffs · cohorte independiente'};
  });
}
export function nhlModelCohort(r:NhlReport):ModelCohort{
  if(r.status!=='AVAILABLE')return empty('STORED','NHL · historial MODEL_ONLY',r.warning);
  const s=r.summary,known=new Set(r.history.map(p=>p.model).filter(Boolean));
  return {key:'STORED',label:'NHL · historial MODEL_ONLY',available:true,wins:s.wins,losses:s.losses,pending:s.pending,pushes:s.pushes,voids:s.voids,
    models:r.history.some(p=>p.model===null)?null:known.size,accuracy:s.accuracyPct===null?null:s.accuracyPct/100,
    note:'Registro completo de origen; conserva modelos de identidad no registrada. No se le asigna una fase MLB.'};
}
export function displayedModelTotal(cohorts:ModelCohort[]){
  if(!cohorts.length||cohorts.some(c=>!c.available))return {accuracy:null,wins:null,losses:null,pending:null,available:false};
  const wins=cohorts.reduce((n,c)=>n+c.wins!,0),losses=cohorts.reduce((n,c)=>n+c.losses!,0),pending=cohorts.reduce((n,c)=>n+c.pending!,0);
  return {accuracy:wins+losses?wins/(wins+losses):null,wins,losses,pending,available:true};
}
