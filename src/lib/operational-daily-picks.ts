import type { Pick2MlbValueBoardRow } from "@/types/pick2-value-board";
import { operatingDay, type DailyPickDisplay } from "./daily-pick-display";

type Slate = {
  date: string;
  warnings: string[];
  games: Array<{ gamePk: number; scheduledAt: string; gameStatus: string }>;
  board: { rows: Pick2MlbValueBoardRow[] };
};
/** Reuse the Pick 2 canonical projection; never import legacy recommendations into the homepage. */
export function operationalDailyPicks(view: Slate) {
  const unavailable =
    view.games.length === 0 ||
    view.warnings.some((w) =>
      /Canonical data is unavailable|canonical evidence unavailable|Verified schedule evidence is unavailable/i.test(
        w,
      ),
    );
  const scoped = view.board.rows.filter(
    (row) => operatingDay(row.start_time) === view.date,
  );
  const display = (row: Pick2MlbValueBoardRow): DailyPickDisplay => ({
    predictionId: row.official_pick_identity ?? row.value_evaluation_id,
    matchup: `${row.away_team ?? "Away"} at ${row.home_team ?? "Home"}`,
    scheduledTime: row.start_time,
    marketLabel: "Moneyline",
    selection: row.side === "HOME" ? row.home_team : row.away_team,
    line: null,
    modelProbability: Number.isFinite(row.model_probability)
      ? row.model_probability * 100
      : null,
    edgePercentagePoints: Number.isFinite(row.consensus_edge)
      ? row.consensus_edge * 100
      : null,
    expectedValuePercent: Number.isFinite(row.unit_ev)
      ? row.unit_ev * 100
      : null,
    americanOdds: row.american_odds,
    sportsbook: row.bookmaker_name ?? row.best_book,
    availability: row.blocker_codes.length
      ? "Recorded pick · current conditions blocked; check game details"
      : "Current pregame evidence available",
  });
  const official = scoped
    .filter(
      (row) =>
        (row.opportunity_status ?? row.status) === "OFFICIAL_PICK" &&
        typeof row.official_pick_identity === "string" && row.official_pick_identity.length > 0,
    )
    .map(display);
  const edge = scoped
    .filter(
      (row) =>
        ["OFFICIAL_PICK", "VALUE_CANDIDATE"].includes(
          row.opportunity_status ?? row.status,
        ) &&
        row.blocker_codes.length === 0 &&
        row.market_freshness === "FRESH" &&
        view.games.some(
          (game) => game.gamePk === row.game_pk && game.gameStatus === "READY",
        ) &&
        Number.isFinite(row.consensus_edge) &&
        row.consensus_edge > 0 &&
        Number.isFinite(row.unit_ev) &&
        row.unit_ev > 0 &&
        Number.isFinite(row.model_probability) &&
        row.model_probability > 0 &&
        row.model_probability < 1 &&
        Number.isFinite(row.american_odds) &&
        Math.abs(row.american_odds) >= 100,
    )
    .map(display);
  const section = (data: DailyPickDisplay[]) => ({
    status: unavailable ? "UNAVAILABLE" : data.length ? "AVAILABLE" : "EMPTY",
    data: unavailable ? [] : data,
    reason: unavailable
      ? "Current canonical slate evidence is incomplete. Stored history remains available in Performance."
      : null,
  });
  return { official: section(official), edge: section(edge) };
}
