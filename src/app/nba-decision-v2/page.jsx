import {unstable_cache} from 'next/cache';
import {ledgerReview} from '../../../scripts/research/nba-v2/daily/review.mjs';
import {supabasePort} from '../../../scripts/research/nba-v2/daily/supabase-port.mjs';
import {notFound} from 'next/navigation';
import data from '../../../docs/research/nba-v2/operations/prospective-report.json';
import ShadowReview from './shadow-review';
export const dynamic='force-dynamic';
export const metadata={title:'NBA · Evaluación prospectiva V2',robots:{index:false,follow:false}};
const latest=unstable_cache(async()=>{
  const {supabaseAdmin}=await import('@/lib/supabase-admin');
  return supabasePort(supabaseAdmin).review(data.modelHash);
},['nba-v2-private-preview-review',data.modelHash],{revalidate:300});
export default async function Page(){
  if(process.env.VERCEL_ENV!=='preview')notFound();
  if(process.env.NBA_DECISION_V2_PREVIEW_LEDGER==='read'){
    try {
      const live=ledgerReview(await latest(),data);
      if(live)return <ShadowReview data={live}/>;
    } catch { return <p>El registro diario V2 no está disponible. Comprueba el acceso de lectura y el último ciclo liquidado.</p>; }
    return <p>El registro diario V2 aún no tiene un informe publicado.</p>;
  }
  return <ShadowReview data={data}/>;
}
