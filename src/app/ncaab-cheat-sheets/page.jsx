import {edition} from "@/lib/cheat-sheets/jornada.mjs";
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { archive, allowed, ranking } from "./archive";

import {
  validateNcaabManualDate,
  ncaabManualDate,
} from "@/services/ncaab-manual-data.service";
import Board from "./sheet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function buildBoard(date, cut) {
    const data = await archive(date, cut),
      { report } = data;
    const ids = new Set(report.fixtures.flatMap((f) => [f.homeId, f.awayId]));
    const fixtures = report.fixtures.map(
      ({
        eventId,
        homeId,
        awayId,
        homeName,
        awayName,
        state, neutralSite,
        scheduledAt,
      }) => ({
        eventId,
        homeId,
        awayId,
        homeName,
        awayName,
        state, neutralSite,
        scheduledAt,
        division: data.divisions.get(eventId),
      }),
    );
    const teams = report.teams
      .filter((t) => ids.has(t.id))
      .map(({ id, name, conference }) => ({ id, name, conference }));
    const rankStart = performance.now();
    const initial = Object.fromEntries(
      ["standard", "heavy"].map((band) => [
        band,
        ranking(data, { window: "L5", market: "ALL", period: "FT", band }),
      ]),
    );
    const counts = {};
    const slateTeams = report.teams.filter(t => ids.has(t.id));
    for (const t of slateTeams) {
      const tag = t.last10.coverage;
      counts[tag] = (counts[tag] || 0) + 1;
    }
    const causes = {};
    for(const id of ids) for(const cause of data.audit.get(id) ?? []) causes[cause]=(causes[cause]??0)+1;
    const profile = {...data.timings, rankMs:Math.round(performance.now()-rankStart)};
    return { report:{
          date,
          readAt: cut,
          coverage: report.coverage,
          source: report.source,
          warnings: report.warnings,
          fixtures, expiries:report.fixtures.flatMap(f=>[f.markets?.expiresAt,...(f.markets?.quotes??[]).flatMap(q=>[q.expiresAt,q.first?.expiresAt,q.second?.expiresAt])]).filter(Boolean),
          teams,
         l10Audit:counts, causes, divisionEvidence:Object.fromEntries(data.divisionEvidenceCounts) }, initial, profile };
}
const cachedBoard = unstable_cache(buildBoard, ["ncaab-sheet-compact-v4"], {revalidate:180});

export default async function Page({ searchParams }) {
  const start=performance.now();
  const h = await headers();
  if (!allowed(h)) notFound();
  const accessMs=Math.round(performance.now()-start);
  const today = ncaabManualDate(new Date().toISOString());
  const requested = (await searchParams).date;
  const date = requested ?? today;
  try {
    validateNcaabManualDate(date);
  } catch {
    notFound();
  }
  if (date > today) notFound();
  const now = new Date(Math.floor(Date.now() / 180000) * 180000).toISOString();
  const archivedCut = edition(date,Date.now(),(await searchParams).snapshot).cutoff;
  const cut = date < today ? archivedCut : new Date(Math.max(Date.parse(date+"T04:00:00Z"), Date.parse(now))).toISOString();
  try {
    const {report,initial,profile} = await cachedBoard(date, cut);
    return <div data-ncaab-timing={JSON.stringify({...profile, accessMs})}><Board frozen={date<today} key={date} report={report} initial={initial}/></div>;
  } catch {
    return (
      <main>
        <h1>NCAAB Cheat Sheets</h1>
        <p>
          Lectura del archivo incompleta para {date}. Vuelve a consultar esta
          jornada.
        </p>
      </main>
    );
  }
}
