import {headers} from 'next/headers';
import {redirect,notFound} from 'next/navigation';
import {nbaManualAccess} from '@/lib/nba/manual-access.mjs';
import Link from 'next/link';
import {readNbaDecisionBoard} from '@/services/nba-decision-board.service';
import Sheet from './sheet';
import {projectionRows} from '@/lib/nba/cheat-projections.mjs';
import {captureNbaCheatSheets} from '@/services/nba-cheat-capture';
export const dynamic='force-dynamic';
export const maxDuration=60;
export default async function Page(){
  const h=await headers(),host=h.get('host'),canonical=process.env.VERCEL_URL;
  if(process.env.VERCEL_ENV==='production' && process.env.NBA_DECISION_BOARD_ENABLED==='true' &&
     canonical && /^[a-z0-9-]+\.vercel\.app$/.test(canonical) && canonical!==host)redirect('https://'+canonical+'/nba-cheat-sheets');
  if(nbaManualAccess(new Request('https://'+(canonical??'preview.vercel.app')+'/nba-cheat-sheets',{headers:h})))notFound();
  let board;
  try {board=await readNbaDecisionBoard({forDisplay:true,withCheatSheets:true});}
  catch {return <main className="p-6"><h1>Cheat Sheets NBA</h1><p>No se pudo leer el archivo de hoy. Vuelve a cargar la página.</p><Link href="/nba-decision-board">Volver al Decision Board</Link></main>;}
  let captureFailed=false;
  if(process.env.VERCEL_ENV==='production'){
    try {await captureNbaCheatSheets(board.day,board.cheatSheets??[]);}
    catch {captureFailed=true;}
  }
  return <Sheet projections={projectionRows(board.rows.props,board.projectionHistories)} showReference={process.env.VERCEL_ENV==='preview'} captureFailed={captureFailed} cards={board.cheatSheets} day={board.day} asOf={board.asOf}/>;
}
