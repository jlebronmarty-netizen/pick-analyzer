import {notFound} from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import Probe from './probe';
export const dynamic = 'force-dynamic';
export default function Page() {
  if (process.env.VERCEL_ENV !== 'preview' || !process.env.HOOPS_API_KEY) notFound();
  return <DashboardShell><Probe /></DashboardShell>;
}
