import {headers} from 'next/headers';
import {nbaManualAccess} from '@/lib/nba/manual-access.mjs';
import DashboardShell from '@/components/dashboard/DashboardShell';
import NcaabDashboard from '@/components/dashboard/NcaabDashboard';
import {getNcaabDailyReport} from '@/services/ncaab-daily.service';
export const dynamic="force-dynamic";
export default async function NcaabPage(){return <DashboardShell>{process.env.VERCEL_ENV==='preview' && !nbaManualAccess(new Request('https://preview.vercel.app',{headers:await headers()})) && <a href="/ncaab-cheat-sheets">NCAAB Cheat Sheets →</a>}<NcaabDashboard report={await getNcaabDailyReport({includeArchivedEvidence:true})}/></DashboardShell>;}
