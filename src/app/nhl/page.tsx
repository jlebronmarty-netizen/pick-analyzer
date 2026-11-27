import DashboardShell from "@/components/dashboard/DashboardShell";
import NhlDashboard from "@/components/dashboard/NhlDashboard";
import { getNhlExternalReport } from "@/services/nhl-external-read.service";
export const dynamic="force-dynamic";
export default async function NhlPage(){return <DashboardShell>{process.env.VERCEL_ENV==="preview" && <a href="/nhl-cheat-sheets">NHL Cheat Sheets →</a>}<NhlDashboard report={await getNhlExternalReport()}/></DashboardShell>;}
