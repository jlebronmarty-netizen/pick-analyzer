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
  const date = (await searchParams).date ?? nhlManualFeatureDate();
  let data;
  try {
    data = await readSheet(date);
  } catch {}
  return <div className={layout.surface}><Sheet date={typeof date === "string" ? date : ""} data={data} /></div>;
}
