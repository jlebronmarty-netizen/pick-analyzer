"use client";
import {useEffect,useState} from "react";
import {useRouter,useSearchParams,usePathname} from "next/navigation";
import Link from "next/link";
import {views,labels,phase,matches,instant,prDay,bands,windows} from "@/lib/cheat-sheets/jornada.mjs";
import styles from "./sheet.module.css";
import {FilterGroup} from "./presentation";

function change(key,value) {
  const url=new URL(location.href);
  url.searchParams.set(key,value);
  history.replaceState(null,"",url);
}
export function useSheetFilter(sport,key,fallback) {
  const params=useSearchParams();
  const mapping=(key==="band"?bands:windows)[sport];
  const value=mapping[params.get(key)] ?? fallback;
  return [value,v=>{const entry=Object.entries(mapping).find(([,local])=>local===v);if(entry)change(key,entry[0]);}];
}

export function ContextLink({href,children}) {
  const params=useSearchParams(), [path,search]=href.split("?"),q=new URLSearchParams(search);
  for(const key of ["date","snapshot","view","band","window"])if(params.has(key))q.set(key,params.get(key));
  return <Link href={path+(q.size?"?"+q:"")}>{children}</Link>;
}
export function Navigation({sport,enabled}) {
  const params=useSearchParams();
  function href(target) {
    const q=new URLSearchParams();
    for(const key of ["date","snapshot","view","band","window"]) {
      const v=params.get(key);
      if(v && (key!=="window" || Object.hasOwn(windows[target],v))) q.set(key,v);
    }
    return "/"+target+"-cheat-sheets"+(q.size?"?"+q:"");
  }
  return <nav aria-label="Deporte" className={styles.sportNav}>{enabled.map(id=><Link key={id} href={href(id)} aria-current={sport===id?"page":undefined}>{id.toUpperCase()}</Link>)}</nav>;
}

export function useJornada(date,cut,deadlines=[]) {
  const router=useRouter(),params=useSearchParams(),path=usePathname();
  const raw=params.get("view"), view=Object.hasOwn(views,raw)?raw:"upcoming";
  const frozen=params.get("date")===date && date<prDay(Date.now());
  const [clock,setClock]=useState(instant(cut));
  const now=frozen?instant(cut):Math.max(clock,instant(cut));
  const next=deadlines.reduce((n,d)=>{const t=instant(d);return t>now?Math.min(n,t):n;},Infinity);
  useEffect(()=>{
    if(frozen)return;
    const refresh=()=>{
      const ms=Date.now();
      setClock(ms);
      if(prDay(ms)!==date){
        const q=new URLSearchParams(location.search);q.delete("date");
        router.replace(path+(q.size?"?"+q:""));router.refresh();
      }else router.refresh();
    };
    setClock(Date.now());
    const midnight=Date.parse(date+"T04:00:00Z")+86400000;
    const id=setTimeout(refresh,Math.max(1,Math.min(next,midnight)-Date.now()));
    const interval=setInterval(refresh,60000);
    const resume=()=>{if(!document.hidden)refresh();};
    document.addEventListener("visibilitychange",resume);
    return ()=>{clearTimeout(id);clearInterval(interval);document.removeEventListener("visibilitychange",resume);};
  },[date,frozen,next,path,router,cut]);
  return {now,view,frozen,visible:g=>matches(g,view,now)};
}
export function JornadaControls({state,games,list=false}) {
  const visible=games.filter(state.visible);
  const params=useSearchParams(),path=usePathname();
  function snapshot(kind){const q=new URLSearchParams(params.toString());q.set("snapshot",kind);return path+"?"+q;}
  return <section><div className={styles.controls}><FilterGroup label="Estado del partido" value={state.view} options={views} onChange={v=>change("view",v)}/></div>
    <p className={styles.note}>{state.frozen?"Consulta histórica · corte congelado":"Jornada actual"} · {visible.length} partidos · Cuotas prepartido archivadas</p>
    {state.frozen&&<p className={styles.note}>Corte PR · <Link href={snapshot("midday")}>1:00 p. m.</Link> · <Link href={snapshot("close")}>Cierre del día</Link></p>}
    {list&&state.view!=="upcoming"&&visible.map(g=><p key={g.id}>{g.name} · {labels[phase(g,state.now)]}</p>)}</section>;
}
