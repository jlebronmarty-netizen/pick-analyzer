'use client';
import {useEffect,useRef,useState} from 'react';
import {createPoller,preserveSelection} from './polling.mjs';
const types={points:'Puntos',rebounds:'Rebotes',assists:'Asistencias',threes:'Triples',blocks:'Tapones',steals:'Robos',points_rebounds_assists:'Puntos + rebotes + asistencias',points_rebounds:'Puntos + rebotes',points_assists:'Puntos + asistencias',rebounds_assists:'Rebotes + asistencias'};
const price=n=>n>0?`+${n}`:String(n);
const time=x=>x&&Number.isFinite(Date.parse(x))?new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',dateStyle:'short',timeStyle:'medium'}).format(new Date(x)):'No verificada';
const today=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
async function get(query,signal){const r=await fetch('/api/market-data/nba?'+query,{cache:'no-store',signal});const b=await r.json();if(!r.ok)throw new Error(b.error||'SOURCE_UNAVAILABLE');return b;}
export default function Board({archiveControls=false}){
 const [date,setDate]=useState(''),[games,setGames]=useState([]),[game,setGame]=useState(''),[market,setMarket]=useState('main'),[result,setResult]=useState(null),[error,setError]=useState(''),[scheduleError,setScheduleError]=useState(''),[filter,setFilter]=useState(''),[automatic,setAutomatic]=useState(true),[clock,setClock]=useState(0),[archive,setArchive]¶»§q«^