"use client";
import Link from "next/link";
import { useState } from "react";
import type { QualifiedReport } from "@/lib/qualified-plays";
const label = (s: string) => s.replaceAll("_", " ");
const time = (s: string | null) =>
  s
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Puerto_Rico",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(s)) + " PR"
    : "Unavailable";
export default function QualifiedPlaysPanel({
  report,
}: {
  report: QualifiedReport;
}) {
  const [phase, setPhase] = useState("POSTSEASON");
  const [engine, setEngine] = useState("ALL");
  const rows = report.groups.filter(
    (g) => g.phase === phase && (engine === "ALL" || g.engine === engine),
  );
  return (
    <section className="mx-auto max-w-7xl space-y-5 p-4 text-slate-200 sm:p-6">
      <header className="rounded-2xl border border-violet-400/25 bg-slate-900 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
          MLB 2026 · Research only
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white">
          Qualified Plays — forward evidence
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
          Historical observations by exact contract, model and engine. These are
          not Official Picks, calibrated per-play probabilities or proof of
          positive ROI.
        </p>
        <Link
          href="/performance"
          className="mt-3 inline-block text-sm font-semibold text-teal-300"
        >
          View official pick performance →
        </Link>
      </header>
      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm">
        <p>
          Source: canonical forward master ledger ·{" "}
          {report.observations ?? "Unknown"} observations
        </p>
        <p className="mt-1 text-slate-400">
          Read: {time(report.readAt)} · Latest ledger update:{" "}
          {time(report.sourceUpdatedAt)}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Only records already synced to the ledger are included. Frozen
          candidates awaiting sync are not added manually. Read time does not
          certify current market availability.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div
          role="group"
          aria-label="Season phase"
          className="flex flex-wrap gap-2"
        >
          {["REGULAR_SEASON", "POSTSEASON"].map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={phase === p}
              onClick={() => setPhase(p)}
              className={`rounded-lg border px-4 py-2 text-sm font-bold ${phase === p ? "border-violet-400 bg-violet-500/20 text-violet-100" : "border-slate-700 text-slate-400"}`}
            >
              {label(p)}
            </button>
          ))}
        </div>
        <label className="text-sm">
          Engine{" "}
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            className="ml-2 rounded border border-slate-600 bg-slate-950 p-2"
          >
            <option value="ALL">All engines (separate rows)</option>
            {[...new Set(report.groups.map((g) => g.engine))]
              .sort()
              .map((e) => (
                <option key={e} value={e}>
                  {label(e)}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-amber-200">
        {phase === "POSTSEASON"
          ? "POSTSEASON SHADOW DOMAIN SHIFT — kept separate from regular season."
          : "Regular-season evidence only. Original engine cohorts remain independent."}
      </p>
      {report.status === "UNAVAILABLE" ? (
        <p
          role="status"
          className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-100"
        >
          {report.warning}
        </p>
      ) : (
        <section
          aria-label="Exact contract results"
          className="overflow-hidden rounded-xl border border-slate-700"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <caption className="sr-only">
                Research results by exact contract and engine for {label(phase)}
              </caption>
              <thead className="bg-slate-900 text-xs text-slate-400">
                <tr>
                  {[
                    "Engine / exact contract",
                    "Model / evidence",
                    "W–L–P",
                    "Void",
                    "Open",
                    "W/L n",
                    "Hit rate",
                  ].map((h) => (
                    <th scope="col" className="px-4 py-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr
                    key={g.key}
                    className="border-t border-slate-800 bg-slate-950/40"
                  >
                    <td className="px-4 py-4">
                      <p className="text-xs font-semibold text-violet-300">
                        {label(g.engine)}
                      </p>
                      <p className="mt-1 font-bold text-white">
                        {label(g.market)} · {label(g.direction)}
                        {g.line !== null ? ` ${g.line}` : ""}
                      </p>
                      <p className="mt-1 max-w-xs break-words text-xs text-slate-500">
                        {g.contract ??
                          "Contract identified by model + exact market, line and direction"}
                      </p>
                    </td>
                    <td className="max-w-xs break-words px-4 py-4 text-xs text-slate-400">
                      <p>{g.model}</p>
                      <p className="mt-2">{g.evidenceClass}</p>
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {g.wins}–{g.losses}–{g.pushes}
                    </td>
                    <td className="px-4 py-4">{g.voids}</td>
                    <td className="px-4 py-4 text-amber-200">{g.open}</td>
                    <td className="px-4 py-4">{g.wins + g.losses}</td>
                    <td className="px-4 py-4 font-bold">
                      {g.accuracy === null
                        ? "—"
                        : `${(100 * g.accuracy).toFixed(2)}%`}
                      {g.wins + g.losses > 0 && g.wins + g.losses < 30 && (
                        <p className="mt-1 text-xs font-normal text-amber-200">
                          Small sample
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p className="p-5 text-sm text-slate-400">
              No synced observations for this phase and engine.
            </p>
          )}
        </section>
      )}
      <p className="text-xs leading-6 text-slate-400">
        Hit rate = WIN ÷ (WIN + LOSS); OPEN, PUSH and VOID are excluded. Rows
        are not pooled across contracts, engines or phases. Markets with no
        captured observations are not listed. Price presence alone does not
        establish executable ROI. Equilizer&apos;s original cohort is not
        completed by adding postseason observations.
      </p>
    </section>
  );
}
