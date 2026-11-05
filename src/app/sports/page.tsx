import Link from 'next/link'
export const dynamic='force-dynamic'
export default function SportsPage(){
 const mlbPaused=process.env.MLB_OFFSEASON_PAUSED==='true'
 const sports=[
 {name:'NBA',href:'/nba-market-data',mode:'Datos de mercado',detail:'FanDuel mediante BALLDONTLIE. Cuotas y archivo separados de las predicciones; disponibilidad y fecha se verifican en el tablero.'},
 {name:'MLB',href:'/today',mode:mlbPaused?'Automatizaciones en pausa por temporada':'Operación y modelos existentes',detail:mlbPaused?'Se conserva el histórico. La pausa es intencional; esta página no reactiva procesos ni suscripciones.':'Se conservan sus procesos y resultados. Consulta el estado de cada módulo antes de utilizarlo.'},
 {name:'NHL',href:'/nhl',mode:'MODEL_ONLY',detail:'Fuente Sports Edge Hub. El módulo muestra indisponibilidad si falla la lectura; no sustituye el historial con ceros.'},
 {name:'Tenis de mesa',href:'/table-tennis',mode:'Edge Lab · investigación',detail:'El colector guarda resultados y emisiones nuevas en Pick. Consulta la cobertura, los límites de la fuente y el historial disponible; PASAR cuando faltan datos.'},
 {name:'Soccer',href:'/soccer',mode:'Edge Lab · seguimiento nuevo',detail:'LaLiga: cálculo y archivo prospectivo en Pick. El tablero muestra ejecuciones reales, cobertura y resultados de la nueva cohorte, sin mezclar la captura histórica anterior.'},
 {name:'NCAAB',href:'/ncaab',mode:'Pronósticos y resultados',detail:'Proceso independiente en Pick con registros originales y resultados observados. Consulta la fecha de actualización y las incidencias en su tablero; no se ha duplicado el proceso.'},
 {name:'NCAAF',href:'/ncaaf',mode:'Edge Lab · PPG experimental',detail:'Temporada regular FBS: modelo PPG adaptado, seguimiento nuevo y cobertura explícita. Ridge no está activado sin un perfil semanal verificado. Consulta la ejecución real en el tablero.'},
 {name:'NFL / BSN / tenis / UFC',href:'/sports-center',mode:'Estados independientes',detail:'Consulta la preparación específica. Un acceso disponible no habilita Official Picks ni elimina los controles del modelo.'}
 ]
 return <main style={{maxWidth:1100,margin:'auto',padding:24}}><h1>Deportes · acceso y alcance</h1><p>El acceso a datos, la operación automática y la validación del modelo son tres comprobaciones distintas. El estado actual y la fecha se consultan dentro de cada tablero.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16,marginTop:20}}>{sports.map(s=><section key={s.name} style={{border:'1px solid #475569',borderRadius:12,padding:18}}><h2>{s.name}</h2><strong>{s.mode}</strong><p>{s.detail}</p>{s.href?<Link prefetch={false} href={s.href}>Abrir {s.name} →</Link>:<p>Sin tablero conectado en esta aplicación.</p>}</section>)}</div></main>
}
