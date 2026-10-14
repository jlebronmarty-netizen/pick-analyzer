"use client";

import Link from "next/link";
import { dailyDisplayRows } from "@/lib/daily-pick-display";

type Section = { status?: string; data?: unknown[]; reason?: string | null };
const metric = (n: number | null, suffix: string) =>
  typeof n === "number" && Number.isFinite(n)
    ? `${n.toFixed(1)}${suffix}`
    : "—";

export default function DailyPicksLists({
  operatingDate,
  official,
  edge,
  officialHref = "/mlb",
  edgeHref = "/best-value",
}: {
  officialHref?: string;
  edgeHref?: string;
  operatingDate?: string;
  official?: Section;
  edge?: Section;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {[
        { title: "Today's official picks", section: official, ranked: false },
        { title: "Highest model edge", section: edge, ranked: true },
      ].map(({ title, section, ranked }) => {
        const rows = dailyDisplayRows(section?.data, operatingDate, ranked);
        const unavailable =
          !section ||
          !["AVAILABLE", "EMPTY"].includes(section.status ?? "") ||
          !operatingDate;
        return (
          <section
            key={title}
            aria-label={title}
            className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-white">{title}</h2>
              <span className="text-xs text-slate-400">
                MLB · {operatingDate ?? "Date unavailable"} · PR
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {ranked
                ? "Informational opportunities, ordered by edge in percentage points. These are not official recommendations."
                : "Recorded official selections. Check current availability in the game details."}
            </p>
            {unavailable ? (
              <p role="status" className="mt-5 text-sm text-amber-200">
                {section?.reason ?? "Stored picks are temporarily unavailable."}
              </p>
            ) : rows.length === 0 ? (
              <p className="mt-5 text-sm text-slate-300">
                {ranked
                  ? "No eligible positive-edge opportunities for this date."
                  : "No official picks for this date."}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {rows.map((pick) => (
                  <li
                    key={pick.predictionId}
                    className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4"
                  >
                    <p className="text-xs text-slate-400">
                      {pick.matchup} · {pick.marketLabel}
                    </p>
                    <p className="mt-1 font-bold text-white">
                      {pick.selection ?? "Selection unavailable"}
                      {pick.line !== null
                        ? ` ${pick.line > 0 ? "+" : ""}${pick.line}`
                        : ""}
                    </p>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500">
                          Model probability
                        </dt>
                        <dd>{metric(pick.modelProbability, "%")}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Edge</dt>
                        <dd className="text-teal-300">
                          {metric(pick.edgePercentagePoints, " pp")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Odds</dt>
                        <dd>
                          {pick.americanOdds == null
                            ? "—"
                            : `${pick.americanOdds > 0 ? "+" : ""}${pick.americanOdds}`}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-slate-500">
                      {pick.sportsbook ?? "Book unavailable"}
                    </p>
                    {pick.availability && (
                      <p className="mt-2 text-xs text-amber-200">
                        {pick.availability}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={ranked ? edgeHref : officialHref}
              className="mt-4 inline-block text-sm font-semibold text-teal-300"
            >
              {ranked
                ? "View value analysis →"
                : "View official pick details →"}
            </Link>
          </section>
        );
      })}
    </div>
  );
}
