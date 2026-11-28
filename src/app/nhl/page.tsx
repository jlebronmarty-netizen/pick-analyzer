import DashboardShell from "@/components/dashboard/DashboardShell";
import NhlDashboard from "@/components/dashboard/NhlDashboard";
import { getNhlExternalReport } from "@/services/nhl-external-read.service";
import {headers} from "next/headers";
import {nhlSheetAccess} from "../nhl-cheat-sheets/access.mjs";
export const dynamic="force-dynamic";
export default async function NhlPage(){return <DashboardShell>{nhlSheetAccess(await headers()) && <a href="/nhl-cheat-sheets">NHL Cheat Sheets →</a>}<NhlDashboard report={await getNhlExternalReport()}/></DashboardShell>;}
