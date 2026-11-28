import {headers} from "next/headers";
import {nbaManualAccess} from "@/lib/nba/manual-access.mjs";
import {nhlSheetAccess} from "@/app/nhl-cheat-sheets/access.mjs";
import {allowed} from "@/app/ncaab-cheat-sheets/access.mjs";
import {Navigation} from "./jornada";
export default async function PrivateNav({sport,children}) {
  const h=await headers(),url="https://"+(process.env.VERCEL_URL||"preview.vercel.app");
  const enabled=[...(!nbaManualAccess(new Request(url,{headers:h}))?["nba"]:[]),...(nhlSheetAccess(h)?["nhl"]:[]),...(allowed(h)?["ncaab"]:[])];
  return <>{enabled.includes(sport)&&<Navigation sport={sport} enabled={enabled}/ >}{children}</>;
}
