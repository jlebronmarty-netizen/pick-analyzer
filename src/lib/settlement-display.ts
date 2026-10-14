import { operatingDay } from "./daily-pick-display";
export function filterSettlementRows<
  T extends { settledOutcome: string | null; firstDecisionAt: string },
>(rows: T[], outcome: string, date: string): T[] {
  return rows.filter(
    (row) =>
      (outcome === "all" || (row.settledOutcome ?? "pending") === outcome) &&
      (!date || operatingDay(row.firstDecisionAt) === date),
  );
}
