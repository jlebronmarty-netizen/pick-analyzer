import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {nbaManualAccess} from '@/lib/nba/manual-access.mjs';
import {readNbaDecisionBoard} from '@/services/nba-decision-board.service';
import Lab from './lab';
export const dynamic='force-dynamic';
export const maxDuration=120;
export default async function Page({searchParams}){
 const h=await headers(),host=h.get('host');
 if(nbaManualAccess(new Request('https://'+host+'/nba-cheat-sheets/analisis',{headers:h})))notFound();
 const query=await searchParams;
 try{
  const board=await readNbaDecisionBoard({forDisplay:true,withSheetLab:true});
  return <Lab data={board.lab} initialGame={String(query.game??'')} initialPlayer={String(query.player??'')}/>;
 }catch{return <main><Link href="/nba-cheat-sheets">← Cheat Sheets</Link><p>No se pudo leer la evidencia archivada de esta jornada.</p></main>;}
}
