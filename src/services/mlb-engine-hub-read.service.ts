import "server-only";
import { getQualifiedPlaysReport } from "./qualified-plays-read.service";
import type { OfficialHubSummary } from "@/lib/mlb-engine-hub";
import {mlbModelCohorts} from '@/lib/sport-model-overview';

export async function getMlbEngineHub() {
  const [research, official] = await Promise.all([
    getQualifiedPlaysReport({ includeEntries: true }),
    import("./pick2-mlb-performance-read.service").then(s => s.getMlbOfficialPerformance()).catch(() => null),
  ]);
  const available = official !== null && !["UNAVAILABLE", "INVALID_SETTLEMENT_EVIDENCE"].includes(official.status);
  const wins = available && official ? official.summary.wins : null;
  const losses = available && official ? official.summary.losses : null;
  const summary: OfficialHubSummary = { available, wins, losses,
    pending: available && official ? official.ledger.pendingUniqueSelections : null,
    accuracy: wins !== null && losses !== null && wins + losses ? wins / (wins + losses) : null };
  return { research, official: summary, cohorts:mlbModelCohorts(research,official),
    today: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(new Date()),
    providerCalls: 0, productionDml: 0 };
}
