'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import NcaafPanel from './ncaaf-panel';
import {useLedgerView} from './ledger-filters';
const box={border:'1px solid #334155',borderRadius:12,padding:18,marginTop:16};const pct=v=>typeof v==='number'?(v*100).toFixed(1)+'%':'N/A';const num=v=>typeof v==='number'?v.toFixed(2):'N/A';const date=v=>v?new Date(v).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'}):'Sin ejecuci贸n';
const names={SOCCER:'Soccer 路 LaLiga',TT:'Tenis de mesa 路 TT Elite',MLB:'MLB 路 motores Edge',NCAAF:'NCAAF'};
const marketName={MONEYLINE:'Ganador',TOTAL_POINTS:'Total de puntos',SETS_ODD_EVEN:'Sets par/impar',HOME_TEAM_RUNS:'Carreras local',AWAY_TEAM_RUNS:'Carreras visitante','1X2':'Local / empate / visitante',TOTAL_2_5:'Total de goles 2.5'};
function selection(r){const a=r.participant_a??r.home_name,b=r.participant_b??r.away_name;return r.selection==='A'||r.selection==='HOME'?a:r.selection==='B'||r.selection==='AWAY'?b:r.selection==='DRAW'?'Empate':r.selection==='OVER'?'Over '+r.line:r.selection==='UNDER'?'Under '+r.line:r.selection==='ODD'?'Impar':r.selection==='EVEN'?'Par':r.status==='PROJECTION'?'Proyecci贸n num茅rica':'PASAR';}
export default function Board({initialSport='SOCCER'}){
 const [sport,setSport]=useState(initialSport),[soccer,setSoccer]=useState(null),[multi,setMulti]=useState(null),[errors,setErrors]=useState([]),[busy,setBusy]=useState(false),request=useRef(null);
 const refresh=useCallback(async()=>{if(r痘玘