import DashboardShell from '@/components/dashboard/DashboardShell';
import NcaabDashboard from '@/components/dashboard/NcaabDashboard';
import {getNcaabCheckpoint} from '@/services/ncaab-checkpoint-read.service';
export default function NcaabPage(){return <DashboardShell><NcaabDashboard report={getNcaabCheckpoint()}/></DashboardShell>;}
