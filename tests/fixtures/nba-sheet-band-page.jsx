import {prDay} from '@/lib/cheat-sheets/jornada.mjs';
import Sheet from '@/app/nba-cheat-sheets/sheet';
export const dynamic='force-dynamic';
export default function Page(){
  const asOf=new Date().toISOString();
  const ref={player:1,gameId:1,market:'points',quote:'fixture',projectionQuote:'model',odds:-400,threshold:10,
    updated:asOf,expires:Date.now()+3600000,ten:9,five:4,name:'Jugador de prueba',matchup:'A @ B'};
  return <Sheet fixtures={[{id:"1",start:new Date(Date.parse(asOf)+7200000).toISOString(),state:"scheduled",name:"A @ B"}]} day={prDay(asOf)} asOf={asOf} milestones={[ref,{...ref,quote:'second',odds:-150}]} projections={[{...ref,threshold:undefined,quote:'model',odds:-114,side:'Over',line:9.5,projection:12.1,
      start:new Date(Date.now()+7200000).toISOString(),captured:asOf,expires:new Date(Date.now()+3600000).toISOString(),
      l5:12,l10:11.5,warnings:[],trend:Array.from({length:10},(_,id)=>({id,date:asOf,value:id+5,rival:'B'}))}]}
    coverage={{expected:1,menus:[{points:{'-650':{strict:0,milestones:1}}}]}}/>;
}
