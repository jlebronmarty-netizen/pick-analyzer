import {edition} from "@/lib/cheat-sheets/jornada.mjs";
import {headers} from 'next/headers';
import {redirect,notFound} from 'next/navigation';
import {nbaManualAccess} from '@/lib/nba/manual-access.mjs';
import Link from 'next/link';
import {readNbaDecisionBoard} from '@/services/nba-decision-board.service';
import {milestoneHistory} from '@/lib/nba/cheat-menu-coverage.mjs';
import Sheet from './sheet';
import {projectionRows} from '@/lib/nba/cheat-projections.mjs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export default async function Page({searchParams}){
  const h=await headers(),host=h.get('host'),canonical=process.env.VERCEL_URL;
  if(process.env.VERCEL_ENV==='production' && process.env.NBA_DECISION_BOARD_ENABLED==='true' &&
     canonical && /^[a-z0-9-]+\.vercel\.app$/.test(canonical) && canonical!==host)redirect('https://'+canonical+'/nba-cheat-sheets');
  if(nbaManualAccess(new Request('https://'+(canonical??'preview.vercel.app')+'/nba-cheat-sheets',{headers:h})))notFound();
  const day=edition((await searchParams).date,Date.now(),(await searchParams).snapshot);if(!day)notFound();
  let board;
  try {board=await readNbaDecisionBoard({now:new Date(day.cutoff),forDisplay:true,withCheatSheets:true});}
  catch {return <main className="p-6"><h1>Cheat Sheets NBA</h1><p>No se pudo leer el archivo de hoy. Vuelve a cargar la página.</p><Link href="/nba-decision-board">Volver al Decision Board</Link></main>;}
  const projections=projectionRows(board.rows.props,board.projectionHistories);
  return <Sheet fixtures={board.displayFixtures} milestones={milestoneHistory(board.sheetMilestones??[],projections)} coverage={board.menuCoverage} projections={projections} showReference={process.env.VERCEL_ENV==='preview'} cards={board.cheatSheets} day={board.day} asOf={board.asOf}/>;
}
