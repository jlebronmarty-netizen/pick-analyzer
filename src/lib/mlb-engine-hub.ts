import type { QualifiedReport, ResearchGroup } from "./qualified-plays";

export const MLB_ENGINE_VIEWS = ["GENERAL", "PICK_ANALYZER", "PICK_EDGE", "EQUILIZER", "FORMULAS"] as const;
export type MlbEngineView = typeof MLB_ENGINE_VIEWS[number];
export type OfficialHubSummary = {
  available: boolean; wins: number | null; losses: number | null;
  pending: number | null; accuracy: number | null;
};
export function engineTotals(groups: ResearchGroup[]) {
  const totals = groups.reduce((s, g) => ({ wins: s.wins + g.wins, losses: s.losses + g.losses,
    pushes: s.pushes + g.pushes, voids: s.voids + g.voids, open: s.open + g.open }),
    { wins: 0, losses: 0, pushes: 0, voids: 0, open: 0 });
  return { ...totals, accuracy: totals.wins + totals.losses ? totals.wins / (totals.wins + totals.losses) : null };
}
export function filterEngineHub(report: QualifiedReport, filters: {
  view: MlbEngineView; phase: string; formula: string; date: string; outcome: string;
}) {
  const groups = report.groups.filter(g => g.phase === filters.phase &&
    (["GENERAL", "FORMULAS"].includes(filters.view) || g.engine === filters.view));
  const keys = new Set(groups.filter(g => filters.formula === "ALL" || g.key === filters.formula).map(g => g.key));
  const entries = (report.entries ?? []).filter(r => keys.has(r.groupKey) &&
    (!filters.date || r.date === filters.date) && (filters.outcome === "ALL" || r.result === filters.outcome));
  return { groups, entries };
}
