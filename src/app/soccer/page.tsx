import DashboardShell from '@/components/dashboard/DashboardShell';
import SoccerDashboard from '@/components/dashboard/SoccerDashboard';
import {getSoccerShadowReport} from '@/services/soccer-shadow-read.service';
export const dynamic='force-dynamic';
export default async function SoccerPage(){return <DashboardShell><SoccerDashboard report={await getSoccerShadowReport()}/></DashboardShell>;}
