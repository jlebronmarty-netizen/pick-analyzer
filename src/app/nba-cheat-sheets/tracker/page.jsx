import Link from 'next/link';
import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {nbaManualAccess} from '@/lib/nba/manual-access.mjs';
import {supabaseAdmin} from '@/lib/supabase-admin';
import {marketLabels,sorts} from '@/lib/nba/sheet-lab/rank.mjs';
import {oddsBands} from '@/lib/nba/cheat-ranking.mjs';
import styles from '@/components/cheat-sheets/sheet.module.css';
import filters from '../analisis/lab.module.css';
export const dynamic='force-dynamic';
const methods={...sorts,projection_five:'Proyección · L5',projection_ten:'Proyección · L10',verified_five:'Verificado · L5',verified_ten:'Verificado · L10',verified_h2h:'Verificado · rival'};
const options={method:['Metodología',methods],scope:['Ranking de origen',{general:'General',...marketLabels}],band:['Cuotas',oddsBands],
 grain:['Ventana',{all:'Acumulado',day:'Día',week:'Semana',month:'Mes'}],market:['Mercado analizado',{'':'Todos',...marketLabels}],period:['Período',{'':'Todos',FT:'Partido completo',Q1:'Q1',Q2:'Q2',Q3:'Q3',Q4:'Q4','1H':'Primera mitad','2H':'Segunda mitad',OT:'Prórroga'}],side:['Lado',{'':'Ambos',over:'Over',under:'Under'}]};
const num=(v,pct=false)=>v==null?'—':(Number(v)*(pct?100:1)).toLocaleString('es-PR',{maximumFractionDigits:2})+(pct?' %':'');
export default async function Page({searchParams}){
 const h=await headers(),host=h.get('host');
 if(nbaManualAccess(new Request('https://'+host+'/nba-cheat-sheets/tracker',{headers:h})))notFound();
 const q=await searchParams, params=Object.fromEntries(Object.entries(options).map(([k,[,values]])=>[k,Object.hasOwn(values,q[k])?q[k]:Object.keys(values)[0]]));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico'}).format(new Date());
 const day=/^\d{4}-\d{2}-\d{2}$/.test(q.date??'')&&Number.isFinite(Date.parse(q.date+'T12:00Z'))?q.date:today;
 const bucket=new Date(day+'T12:00Z');
 if(params.grain==='week')bucket.setUTCDate(bucket.getUTCDate()-(bucket.getUTCDay()+6)%7);
 if(params.grain==='month')bucket.setUTCDate(1);
 const active=process.env.NBA_CHEAT_TRACKER_ENABLED==='true';
 let rows=[],failed=false;
 if(active){
  let query=supabaseAdmin.from('nba_sheet_performance_v1').select('*').eq('methodology',params.method).eq('scope',params.scope).eq('band',Number(params.band)).eq('grain',params.grain);
  query=params.grain==='all'?query.is('bucket',null):query.eq('bucket',bucket.toISOString().slice(0,10));
  for(const k of ['market','period','side'])query=params[k]?query.eq(k,params[k]):query.is(k,null);
  const response=await query.order('rank_type').order('rank_n').limit(15);
  rows=response.data??[];failed=Boolean(response.error);
 }
 return <main className={styles.sheet}><Link href="/nba-cheat-sheets">← Cheat Sheets</Link>
 <header className={styles.hero}><p>NBA / Resultados prospectivos</p><h1>Tracker</h1><p>Una unidad por contrato al precio de su primera selección prepartido.</p></header>
 <form className={styles.controls+' '+filters.filters}>{Object.entries(options).map(([k,[label,values]])=><label key={k}>{label}<select name={k} defaultValue={params[k]}>{Object.entries(values).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>)}<label>Fecha de la jornada<input type="date" name="date" defaultValue={day}/></label><button>Ver resultados</button></form>
 {!rows.length?<p className={styles.empty}>{!active?'Tracker pendiente de activación.':failed?'No se pudo consultar el registro.':'Sin observaciones para esta estrategia y ventana.'}</p>:<div className={styles.grid}>{rows.map(r=><article className={styles.card} key={r.rank_type+r.rank_n}><header>{r.rank_type==='top'?'Top acumulado':'Posición individual'} {r.rank_n}</header>
 <div className={styles.score}><b>{num(r.accuracy,true)}</b><span>Accuracy<small>{r.wins} aciertos · {r.losses} fallos · {r.decided} decididos</small></span></div>
 <div className={styles.stats}><div><small>ROI simulado</small>{num(r.roi,true)}</div><div><small>Saldo</small>{num(r.net_units)} u</div><div><small>Muestra</small>{r.contracts}</div></div>
 <div className={styles.footer}>+{num(r.won_units)} u ganadas · {num(r.lost_units)} u perdidas · {r.stake_units} u liquidadas</div>
 <details><summary>Liquidación y comparación con Pick</summary><p>{r.pushes} pushes · {r.dnp} DNP · {r.voids} anulaciones · {r.pending} pendientes</p><p>{r.pairs} pares decididos · Cheat Sheets {num(r.paired_sheet_accuracy,true)} · Pick {num(r.paired_pick_accuracy,true)}</p><p>ROI en {r.priced_pairs} pares con ambos precios · Cheat Sheets {num(r.paired_sheet_roi,true)} · Pick {num(r.paired_pick_roi,true)}</p></details></article>)}</div>}
 <p className={styles.note}>La posición pertenece al ranking original. Una nueva captura puede incorporar contratos nuevos a la misma posición en la jornada. Las semanas empiezan el lunes en Puerto Rico. El ROI divide las unidades netas entre las unidades liquidadas en victorias, derrotas y pushes. Cada Top incluye las posiciones anteriores.</p></main>;
}
