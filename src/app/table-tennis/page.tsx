import DashboardShell from '@/components/dashboard/DashboardShell';
import TableTennisDashboard from '@/components/dashboard/TableTennisDashboard';
import { getTableTennisReport } from '@/services/table-tennis-read.service';
export const dynamic = 'force-dynamic';
export default async function Page() { return <DashboardShell><TableTennisDashboard report={await getTableTennisReport()} /></DashboardShell>; }
