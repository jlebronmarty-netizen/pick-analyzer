import "server-only";
import { getSportsCenterReport } from "@/services/sports-center.service";
import {
  summarizeOfficialSports,
  type OfficialSportMetrics,
} from "@/lib/official-performance-overview";

export async function getOfficialPerformanceOverview() {
  // Read failures must not turn an unavailable official ledger into a zero record.
  const mlb = await import("@/services/pick2-mlb-performance-read.service")
    .then((service) => service.getMlbOfficialPerformance())
    .catch(() => null);
  const sports: OfficialSportMetrics[] = getSportsCenterReport().sports.map(
    (sport) => {
      const connected = sport.key === "mlb";
      const available =
        connected &&
        mlb !== null &&
        !["UNAVAILABLE", "INVALID_SETTLEMENT_EVIDENCE"].includes(mlb.status);
      return {
        key: sport.key,
        label: sport.label,
        readiness: sport.status,
        connected,
        available,
        wins: available && mlb ? mlb.summary.wins : null,
        losses: available && mlb ? mlb.summary.losses : null,
        pushes: available && mlb ? mlb.summary.pushes : null,
        voids: available && mlb ? mlb.summary.voids : null,
        pending: available && mlb ? mlb.ledger.pendingUniqueSelections : null,
      };
    },
  );
  return {
    sports,
    overall: summarizeOfficialSports(sports),
    warning:
      mlb?.warning ??
      (mlb ? null : "Official performance is temporarily unavailable."),
  };
}
