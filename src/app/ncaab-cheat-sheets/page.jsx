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

export default async function Page({ searchParams }) {
  const h = await headers();
  if (!allowed(h)) notFound();
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
  const archivedCut = date + "T17:00:00.000Z";
  const cut = requested && archivedCut < now ? archivedCut : now;
  try {
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
        neutralSite,
        scheduledAt,
      }) => ({
        eventId,
        homeId,
        awayId,
        homeName,
        awayName,
        neutralSite,
        scheduledAt,
        division: data.divisions.get(eventId),
      }),
    );
    const teams = report.teams
      .filter((t) => ids.has(t.id))
      .map(({ id, name, conference }) => ({ id, name, conference }));
    const initial = Object.fromEntries(
      ["standard", "heavy"].map((band) => [
        band,
        ranking(data, { window: "L5", market: "ALL", period: "FT", band }),
      ]),
    );
    return (
      <Board
        key={cut}
        report={{
          date,
          readAt: cut,
          coverage: report.coverage,
          source: report.source,
          warnings: report.warnings,
          fixtures,
          teams,
        }}
        initial={initial}
      />
    );
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
