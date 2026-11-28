import {edition} from "@/lib/cheat-sheets/jornada.mjs";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {nhlSheetAccess} from "./access.mjs";
import { nhlManualFeatureDate } from "@/lib/nhl-manual-features.mjs";
import { readSheet } from "./archive";
import Sheet from "./sheet";
import layout from "./layout.module.css";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function Page({ searchParams }) {
  if (!nhlSheetAccess(await headers())) notFound();
  const day=edition((await searchParams).date,Date.now(),(await searchParams).snapshot);if(!day)notFound();
  const {date,cutoff}=day;
  let data;
  try {
    data = await readSheet(date,cutoff);
  } catch {}
  return <div className={layout.surface}><Sheet frozen={day.frozen} cutoff={cutoff} date={typeof date === "string" ? date : ""} data={data} /></div>;
}
