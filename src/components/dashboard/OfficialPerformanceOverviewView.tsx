import type { OfficialSportMetrics } from "@/lib/official-performance-overview";
import type { summarizeOfficialSports } from "@/lib/official-performance-overview";

function accuracy(wins: number | null, losses: number | null) {
  return wins !== null && losses !== null && wins + losses > 0
    ? `${((100 * wins) / (wins + losses)).toFixed(1)}%`
    : "—";
}

export default function OfficialPerformanceOverviewView({
  sports,
  overall,
  warning,
}: {
  sports: OfficialSportMetrics[];
  overall: ReturnType<typeof summarizeOfficialSports>;
  warning: string | null;
}) {
  return (
    <section aria-label="Official accuracy by sport" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-teal-400/25 bg-slate-900 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-300">
            Official picks · certified results
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Overall accuracy
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {overall.includedSports.join(", ") ||
              "No official ledger connected"}{" "}
            · Wins ÷ (wins + losses)
          </p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums text-white">
            {accuracy(overall.wins, overall.losses)}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {overall.available
              ? `${overall.wins} won · ${overall.losses} lost · ${overall.pending} pending`
              : "Results unavailable"}
          </p>
        </div>
      </div>
      <p className="text-xs leading-5 text-slate-400">
        Pushes ({overall.pushes ?? "—"}), voids ({overall.voids ?? "—"}) and
        pending picks are excluded from accuracy. Repeated decision snapshots
        count once. Preview and research predictions are separate.
      </p>
      {warning && (
        <p role="status" className="text-sm text-amber-200">
          {warning}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sports.map((sport) => (
          <a
            key={sport.key}
            href={
              sport.connected
                ? `/performance?sport=${sport.key}`
                : `/sports-center/${sport.key}`
            }
            className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 transition hover:border-teal-400 focus-visible:ring-2 focus-visible:ring-teal-300"
          >
            <div className="flex justify-between gap-2">
              <h3 className="font-bold text-white">{sport.label}</h3>
              <span className="text-xs text-slate-400">{sport.readiness}</span>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-white">
              {accuracy(sport.wins, sport.losses)}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {sport.available
                ? `${sport.wins} W / ${sport.losses} L · ${sport.pending} pending`
                : sport.connected
                  ? "Official results unavailable"
                  : "Official results not connected"}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
