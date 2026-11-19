import {notFound} from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import DecisionBoard from './decision-board';
export const dynamic='force-dynamic';
export default function Page(){
  if(process.env.VERCEL_ENV!=='preview')notFound();
  return <DashboardShell><DecisionBoard/></DashboardShell>;
}
