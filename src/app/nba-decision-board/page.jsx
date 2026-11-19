import {notFound,redirect} from 'next/navigation';
import {headers} from 'next/headers';
import DashboardShell from '@/components/dashboard/DashboardShell';
import DecisionBoard from './decision-board';
export const dynamic='force-dynamic';
export default async function Page(){
  if(process.env.VERCEL_ENV==='production'){
    if(process.env.NBA_DECISION_BOARD_ENABLED!=='true')notFound();
    const host=process.env.VERCEL_URL;
    if(!host||!/^[a-z0-9-]+\.vercel\.app$/.test(host))notFound();
    if((await headers()).get('host')!==host)redirect('https://'+host+'/nba-decision-board');
  }else if(process.env.VERCEL_ENV!=='preview')notFound();
  return <DashboardShell><DecisionBoard/></DashboardShell>;
}
