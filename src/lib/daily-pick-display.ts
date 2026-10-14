export type DailyPickDisplay = {
  availability?: string;
  predictionId: string;
  matchup: string;
  scheduledTime: string | null;
  marketLabel: string;
  selection: string | null;
  line: number | null;
  modelProbability: number | null;
  edgePercentagePoints: number | null;
  expectedValuePercent: number | null;
  americanOdds: number | null;
  sportsbook: string | null;
};
export function operatingDay(timestamp: string | null): string | null {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}
export function dailyDisplayRows(
  rows: unknown[] | undefined,
  date: string | undefined,
  ranked = false,
): DailyPickDisplay[] {
  if (!date) return [];
  const seen = new Set<string>();
  const result = (rows ?? []).filter((row): row is DailyPickDisplay => {
    if (!row || typeof row !== "object") return false;
    const r = row as DailyPickDisplay;
    if (
      typeof r.predictionId !== "string" ||
      !r.predictionId ||
      seen.has(r.predictionId) ||
      operatingDay(r.scheduledTime) !== date
    )
      return false;
    if (
      ranked &&
      (typeof r.edgePercentagePoints !== "number" ||
        !Number.isFinite(r.edgePercentagePoints) ||
        r.edgePercentagePoints <= 0)
    )
      return false;
    seen.add(r.predictionId);
    return true;
  });
  return ranked
    ? result
        .sort(
          (a, b) =>
            b.edgePercentagePoints! - a.edgePercentagePoints! ||
            (b.expectedValuePercent ?? 0) - (a.expectedValuePercent ?? 0),
        )
        .slice(0, 10)
    : result;
}
