import { NextResponse } from "next/server";
import { getMlbEngineHub } from "@/services/mlb-engine-hub-read.service";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(await getMlbEngineHub(), { headers: { "Cache-Control": "no-store" } });
}
