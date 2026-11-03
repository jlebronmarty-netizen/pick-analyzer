import DashboardShell from '@/components/dashboard/DashboardShell';
import NcaabDashboard from '@/components/dashboard/NcaabDashboard';
import {getNcaabDailyReport} from '@/services/ncaab-daily.service';
export const dynamic="force-dynamic";
export default async function NcaabPage(){return <DashboardShell><NcaabDashboard report={await getNcaabDailyReport()}/></DashboardShell>;}
