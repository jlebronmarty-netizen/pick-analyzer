import Link from 'next/link'
const sports=[
 {name:'NBA',href:'/nba-market-data',mode:'Datos de mercado',detail:'FanDuel mediante BALLDONTLIE. Cuotas y archivo separados de las predicciones; disponibilidad y fecha se verifican en el tablero.'},
 {name:'MLB',href:'/today',mode:'Operación y modelos existentes',detail:'Se conservan sus procesos y resultados. Que una pantalla abra no certifica todos los procesos de liquidación.'},
 {name:'NHL',href:'/nhl',mode:'MODEL_ONLY',detail:'Fuente Sports Edge Hub. El módulo muestra indisponibilidad si falla la lectura; no sustituye el historial con ceros.'},
 {name:'Tenis de mesa',href:'/table-tennis',mode:'RESEARCH / SHADOW',detail:'Pronósticos y resultados originales. La conexión con la base fuente debe estar disponible para validar operación.'},
 {name:'Soccer',href:'/soccer',mode:'Checkpoint histórico',detail:'La captura publicada no es un feed continuo. Consulta su fecha original; no se actualiza su hora artificialmente.'},
 {name:'NCAAB',href:'/ncaab',mode:'Checkpoint experimental',detail:'Conserva el histórico publicado. La existencia de la página no demuestra un pipeline automático de resultados.'},
 {name:'NCAAF',href:null,mode:'Integración pendiente',detail:'El proyecto de investigación existe por separado; no hay aquí una ruta operativa certificada. No se usa NFL como sustituto.'},
 {name:'NFL / BSN / tenis / UFC',href:'/sports-center',mode:'Estados independientes',detail:'Consulta la preparación específica. Un acceso disponible no habilita Official Picks ni elimina los controles del modelo.'}
]
export default function SportsPage(){return <main style={{maxWidth:1100,margin:'auto',padding:24}}><h1>Deportes · acceso y alcance</h1><p>El acceso a datos, la operación automática y la validación del modelo son tres comprobaciones distintas. No se declara todo listo por abrir una página.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16,marginTop:20}}>{sports.map(s=><section key={s.name} style={{border:'1px solid #475569',borderRadius:12,padding:18}}><h2>{s.name}</h2><strong>{s.mode}</strong><p>{s.detail}</p>{s.href?<Link prefetch={false} href={s.href}>Abrir {s.name} →</Link>:<p>Sin tablero conectado en esta aplicación.</p>}</section>)}</div></main>}
