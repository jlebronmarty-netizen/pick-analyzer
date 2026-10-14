import { NextResponse } from "next/server";
import { getNhlExternalReport } from "@/services/nhl-external-read.service";
export const dynamic="force-dynamic";
export async function GET(){const report=await getNhlExternalReport();return NextResponse.json(report,{status:report.status==="AVAILABLE"?200:503,headers:{"Cache-Control":"no-store"}});}
