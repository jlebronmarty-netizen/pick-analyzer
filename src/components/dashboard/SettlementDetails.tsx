"use client";

import { useState } from "react";
import { filterSettlementRows } from "@/lib/settlement-display";

type Row = {
  gamePk: number;
  side: string;
  matchup: string;
  selection: string;
  scheduledAt: string | null;
  firstDecisionAt: string;
  originalOdds: number;
  settledOutcome: string | null;
  settledUnits: number | null;
  settledAt: string | null;
  state: string;
};
export default function SettlementDetails({
  rows,
  available,
}: {
  rows: Row[];
  available: boolean;
}) {
  const [outcome, setOutcome] = useState("all");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(0);
  const filtered = filterSettlementRows(rows, outcome, date);
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const current = Math.min(page, pages - 1);
  return (
    <section
      aria-label="Settlement details"
      className="rounded-2xl border border-slate-700 bg-slate-900 p-5"
    >
      <h2 className="text-2xl font-bold text-white">Wins &amp; losses</h2>
      <p className="mt-2 text-sm text-slate-400">
        MLB official selections · one row per game and side. Repeated decision
        snapshots count once. Units reflect the stored one-unit settlement, not
        actual wagers.
      </p>
      <div className="my-4 flex flex-wrap gap-4">
        <label className="text-sm">
          Result{" "}
          <select
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
              setPage(0);
            }}
            className="ml-2 rounded border border-slate-600 bg-slate-950 p-2"
          >
            {["all", "win", "loss", "push", "void", "pending"].map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All results" : s.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Pick date (PR){" "}
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(0);
            }}
            className="ml-2 rounded border border-slate-600 bg-slate-950 p-2"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setOutcome("all");
            setDate("");
            setPage(0);
          }}
          className="text-sm text-teal-300"
        >
          Clear filters
        </button>
      </div>
      {!available ? (
        <p role="status" className="text-amber-200">
          Official results are unavailable. No win/loss totals are inferred.
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-400">
            {filtered.length} selections match
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">
                Official MLB settlement details
              </caption>
              <thead className="text-xs text-slate-400">
                <tr>
                  {[
                    "Pick date (PR)",
                    "Matchup / selection",
                    "Odds",
                    "Result",
                    "Net units",
                  ].map((h) => (
                    <th key={h} scope="col" className="px-3 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(current * 25, (current + 1) * 25).map((r) => (
                  <tr
                    key={`${r.gamePk}:${r.side}`}
                    className="border-t border-slate-800"
                  >
                    <td className="px-3 py-3">
                      {new Intl.DateTimeFormat("en-US", {
                        timeZone: "America/Puerto_Rico",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }).format(new Date(r.firstDecisionAt))}
                    </td>
                    <td className="px-3 py-3">
                      <p>{r.matchup}</p>
                      <p className="text-slate-400">{r.selection}</p>
                    </td>
                    <td className="px-3 py-3">
                      {r.originalOdds > 0 ? "+" : ""}
                      {r.originalOdds}
                    </td>
                    <td
                      className={`px-3 py-3 font-bold ${r.settledOutcome === "win" ? "text-teal-300" : r.settledOutcome === "loss" ? "text-rose-300" : "text-slate-400"}`}
                    >
                      {r.settledOutcome?.toUpperCase() ?? "PENDING"}
                      {!r.settledOutcome && (
                        <p className="text-xs font-normal">
                          {r.state.replaceAll("_", " ").toLowerCase()}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {r.settledUnits === null
                        ? "—"
                        : `${r.settledUnits > 0 ? "+" : ""}${r.settledUnits.toFixed(3)}u`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="py-5 text-sm text-slate-400">
              No selections match these filters.
            </p>
          )}
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="text-teal-300 disabled:text-slate-600"
            >
              Previous
            </button>
            <span>
              Page {current + 1} of {pages}
            </span>
            <button
              type="button"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
              className="text-teal-300 disabled:text-slate-600"
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
