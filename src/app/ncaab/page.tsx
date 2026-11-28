import {headers} from 'next/headers';
import {allowed} from '@/app/ncaab-cheat-sheets/access.mjs';
import DashboardShell from '@/components/dashboard/DashboardShell';
import NcaabDashboard from '@/components/dashboard/NcaabDashboard';
import {getNcaabDailyReport} from '@/services/ncaab-daily.service';
export const dynamic="force-dynamic";
export default async function NcaabPage(){return <DashboardShell>{allowed(await headers()) && <a href="/ncaab-cheat-sheets">NCAAB Cheat Sheets →</a>}<NcaabDashboard report={await getNcaabDailyReport({includeArchivedEvidence:true})}/></DashboardShell>;}
