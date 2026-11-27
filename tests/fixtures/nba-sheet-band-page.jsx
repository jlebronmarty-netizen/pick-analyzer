import Sheet from '@/app/nba-cheat-sheets/sheet';
export const dynamic='force-dynamic';
export default function Page(){
  const asOf=new Date().toISOString();
  const ref={player:1,gameId:1,market:'points',quote:'fixture',odds:-400,threshold:10,
    updated:asOf,expires:Date.now()+3600000,ten:9,five:4,name:'Jugador de prueba',matchup:'A @ B'};
  return <Sheet day={asOf.slice(0,10)} asOf={asOf} milestones={[ref]}
    coverage={{expected:1,menus:[{points:{'-650':{strict:0,milestones:1}}}]}}/>;
}
