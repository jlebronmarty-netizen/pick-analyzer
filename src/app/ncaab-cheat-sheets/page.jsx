import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { nbaManualAccess } from "@/lib/nba/manual-access.mjs";
import {
  loadNcaabManualData,
  validateNcaabManualDate,
  ncaabManualDate,
} from "@/services/ncaab-manual-data.service";
import Board from "./sheet";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Page({ searchParams }) {
  const h = await headers();
  if (
    process.env.VERCEL_ENV !== "preview" ||
    nbaManualAccess(new Request("https://preview.vercel.app", { headers: h }))
  )
    notFound();
  const today = ncaabManualDate(new Date().toISOString());
  const requested = (await searchParams).date;
  const date = requested ?? today;
  try {
    validateNcaabManualDate(date);
  } catch {
    notFound();
  }
  if (date > today) notFound();
  const now = new Date().toISOString();
  const archivedCut = date + "T17:00:00.000Z";
  const cut = requested && archivedCut < now ? archivedCut : now;
  try {
    const histories = new Map(),
      possessions = new Map(),
      ranks = new Map();
    const report = await loadNcaabManualData(
      supabaseAdmin,
      date,
      cut,
      AbortSignal.timeout(45000),
      { histories, possessions, ranks },
    );
    const pairs = {};
    for (const f of report.fixtures)
      pairs[f.eventId] = (histories.get(f.homeId) ?? [])
        .filter((g) => g.opponentId === f.awayId)
        .slice(0, 10);
    const ids = new Set(report.fixtures.flatMap((f) => [f.homeId, f.awayId]));
    const attempts = {};
    for (const id of ids) {
      const rows = histories.get(id) ?? [];
      attempts[id] = Object.fromEntries(
        Object.entries({
          fieldGoalPct: "fieldGoalsAttempted",
          threePointPct: "threePointersAttempted",
          freeThrowPct: "freeThrowsAttempted",
        }).map(([key, field]) => [
          key,
          rows.reduce((sum, g) => sum + (g.stats[field] ?? 0), 0),
        ]),
      );
    }
    return (
      <Board
        attempts={attempts}
        report={{
          date,
          readAt: report.readAt,
          coverage: report.coverage,
          source: report.source,
          warnings: report.warnings,
          fixtures: report.fixtures,
          teams: report.teams.filter((t) => ids.has(t.id)),
        }}
        pairs={pairs}
        ranks={Object.fromEntries(ranks)}
        possessions={Object.fromEntries(
          [...possessions].filter(([id]) => ids.has(id)),
        )}
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
