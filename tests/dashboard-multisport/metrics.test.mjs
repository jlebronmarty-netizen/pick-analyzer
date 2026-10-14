import test from "node:test";
import assert from "node:assert/strict";
import { summarizeOfficialSports } from "../../src/lib/official-performance-overview.ts";
import {
  dailyDisplayRows,
  operatingDay,
} from "../../src/lib/daily-pick-display.ts";
import { rankHighestEdge } from "../../src/lib/highest-edge-ranking.ts";
const sport = (overrides = {}) => ({
  key: "mlb",
  label: "MLB",
  readiness: "Production",
  connected: true,
  available: true,
  wins: 9,
  losses: 1,
  pushes: 3,
  voids: 2,
  pending: 8,
  ...overrides,
});
test("overall is weighted by decided picks and excludes preview/pending/push/void", () => {
  const s = summarizeOfficialSports([
    sport(),
    sport({ key: "nhl", label: "NHL", wins: 1, losses: 1 }),
    sport({ key: "nba", connected: false, wins: 10000 }),
  ]);
  assert.equal(s.accuracy, 10 / 12);
  assert.equal(s.decided, 12);
  assert.equal(s.pending, 16);
});
test("missing, invalid or unavailable counts cannot become zero accuracy", () => {
  for (const overrides of [
    { available: false },
    { wins: null },
    { losses: -1 },
    { pending: NaN },
  ])
    assert.equal(summarizeOfficialSports([sport(overrides)]).accuracy, null);
  assert.equal(summarizeOfficialSports([]).accuracy, null);
  assert.equal(
    summarizeOfficialSports([sport({ wins: 0, losses: 0 })]).accuracy,
    null,
  );
});
test("daily rows use Puerto Rico day, deduplicate and keep future slate out", () => {
  assert.equal(operatingDay("2026-10-15T02:00:00Z"), "2026-10-14");
  assert.equal(operatingDay(null), null);
  const row = {
    predictionId: "a",
    scheduledTime: "2026-10-15T02:00:00Z",
    edgePercentagePoints: 4,
    expectedValuePercent: 5,
  };
  assert.equal(
    dailyDisplayRows(
      [
        row,
        row,
        { ...row, predictionId: "b", scheduledTime: "2026-10-15T12:00:00Z" },
      ],
      "2026-10-14",
    ).length,
    1,
  );
  assert.equal(dailyDisplayRows([row], undefined).length, 0);
});
const candidate = (id, edge, ev, overrides = {}) => ({
  predictionId: id,
  pregameSafe: true,
  canonicalOutcome: { probability: 60, selection: "HOME" },
  canonicalPrice: { status: "AVAILABLE", americanOdds: -110 },
  marketAlignment: { freshnessStatus: "FRESH" },
  canonicalEv: { edge, expectedValue: ev },
  ...overrides,
});
test("edge ranking differs from EV ranking, has stable tie break and preserves input", () => {
  const rows = [
    candidate("b", 2, 50),
    candidate("a", 8, 5),
    candidate("c", 8, 10),
  ];
  assert.deepEqual(
    rankHighestEdge(rows).map((r) => r.predictionId),
    ["c", "a", "b"],
  );
  assert.equal(rows[0].predictionId, "b");
});
test("unknown/stale price, absent probability, locked games, null or nonpositive EV/edge stay out", () => {
  const rows = [
    candidate("ok", 3, 4),
    candidate("null", null, 4),
    candidate("ev", 3, 0),
    candidate("stale", 3, 4, { marketAlignment: { freshnessStatus: "STALE" } }),
    candidate("unknown", 3, 4, {
      marketAlignment: { freshnessStatus: "UNKNOWN" },
    }),
    candidate("locked", 3, 4, { pregameSafe: false }),
    candidate("price", 3, 4, {
      canonicalPrice: { status: "AVAILABLE", americanOdds: null },
    }),
    candidate("prob", 3, 4, { canonicalOutcome: undefined }),
  ];
  assert.deepEqual(
    rankHighestEdge(rows).map((r) => r.predictionId),
    ["ok"],
  );
});
test("edge displayed in percentage points without multiplying by 100; only top 10 of today", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    predictionId: String(i),
    scheduledTime: "2026-10-14T12:00:00Z",
    edgePercentagePoints: i + 0.5,
    expectedValuePercent: 1,
  }));
  const output = dailyDisplayRows(rows, "2026-10-14", true);
  assert.equal(output.length, 10);
  assert.equal(output[0].edgePercentagePoints, 11.5);
  assert.equal(
    dailyDisplayRows(
      [{ ...rows[0], edgePercentagePoints: null }],
      "2026-10-14",
      true,
    ).length,
    0,
  );
});

test("complement prices use their own freshness, not the original selection freshness", () => {
  const stale = candidate("stale-complement", 5, 8, {
    canonicalMarketAlignment: { freshnessStatus: "STALE" },
  });
  const fresh = candidate("fresh-complement", 5, 8, {
    canonicalMarketAlignment: { freshnessStatus: "FRESH" },
    marketAlignment: { freshnessStatus: "STALE" },
  });
  assert.deepEqual(
    rankHighestEdge([stale, fresh]).map((r) => r.predictionId),
    ["fresh-complement"],
  );
});

test("settlement filters combine result and pick date, including pending", async () => {
  const { filterSettlementRows } =
    await import("../../src/lib/settlement-display.ts");
  const rows = [
    { settledOutcome: "win", firstDecisionAt: "2026-10-15T02:00:00Z" },
    { settledOutcome: "loss", firstDecisionAt: "2026-10-14T12:00:00Z" },
    { settledOutcome: null, firstDecisionAt: "2026-10-15T02:00:00Z" },
    { settledOutcome: "push", firstDecisionAt: "2026-10-15T12:00:00Z" },
  ];
  assert.equal(filterSettlementRows(rows, "win", "2026-10-14").length, 1);
  assert.equal(filterSettlementRows(rows, "pending", "2026-10-14").length, 1);
  assert.equal(filterSettlementRows(rows, "all", "2026-10-14").length, 3);
  assert.equal(filterSettlementRows(rows, "loss", "2026-10-15").length, 0);
  assert.equal(filterSettlementRows(rows, "all", "").length, 4);
});
