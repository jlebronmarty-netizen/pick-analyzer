import "server-only";
import { cache } from "react";
import { parseNhlReport, unavailableNhlReport, type NhlReport } from "@/lib/nhl-external-report";
export const NHL_READ_BRIDGE_URL = "https://sports-edge-hub.vercel.app/api/nhl/read-bridge";
export const getNhlExternalReport = cache(async (): Promise<NhlReport> => {
  try {
    const response=await fetch(NHL_READ_BRIDGE_URL,{cache:"no-store",redirect:"error",headers:{Accept:"application/json"},signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw Error("NHL_SOURCE_UNAVAILABLE");
    return parseNhlReport(await response.json());
  } catch {return unavailableNhlReport();}
});
