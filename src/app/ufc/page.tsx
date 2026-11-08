import DashboardShell from '@/components/dashboard/DashboardShell';import UfcDashboard from '@/components/dashboard/UfcDashboard';import {getUfcFreeReport} from '@/services/ufc-free.service';
export const dynamic='force-dynamic';export default async function UfcPage(){return <DashboardShell><UfcDashboard report={await getUfcFreeReport()}/></DashboardShell>;}
