import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DailyPicksLists from "../../src/components/dashboard/DailyPicksLists.tsx";
import SettlementDetails from "../../src/components/dashboard/SettlementDetails.tsx";
import Overview from "../../src/components/dashboard/OfficialPerformanceOverviewView.tsx";
import { summarizeOfficialSports } from "../../src/lib/official-performance-overview.ts";
const render = (component, props) =>
  renderToStaticMarkup(React.createElement(component, props));
const pick = {
  predictionId: "p1",
  matchup: "Away at Home",
  scheduledTime: "2026-10-14T22:00:00Z",
  marketLabel: "Moneyline",
  selection: "Home",
  line: null,
  modelProbability: 60,
  edgePercentagePoints: 4,
  expectedValuePercent: 5,
  americanOdds: -110,
  sportsbook: "Stored book",
};
test("official picks and edge opportunities render separately with units and real links", () => {
  const html = render(DailyPicksLists, {
    operatingDate: "2026-10-14",
    official: { status: "AVAILABLE", data: [pick] },
    edge: { status: "AVAILABLE", data: [pick] },
  });
  assert.match(html, /Today&#x27;s official picks/);
  assert.match(html, /These are not official recommendations/);
  assert.match(html, /4.0pp|4.0 pp/);
  assert.match(html, /60.0%/);
  assert.match(html, /href="\/mlb"/);
  assert.match(html, /href="\/best-value"/);
});
test("unavailable and empty daily states remain distinguishable", () => {
  const html = render(DailyPicksLists, {
    operatingDate: "2026-10-14",
    official: { status: "UNAVAILABLE", reason: "Read failed" },
    edge: { status: "EMPTY", data: [] },
  });
  assert.match(html, /Read failed/);
  assert.match(html, /No eligible positive-edge opportunities/);
  assert.doesNotMatch(html, /No official picks for this date/);
});
test("settlement table shows stored wins, losses, pending and net units separately", () => {
  const base = {
    gamePk: 1,
    side: "HOME",
    matchup: "A at B",
    selection: "B",
    scheduledAt: null,
    firstDecisionAt: "2026-10-14T12:00:00Z",
    originalOdds: -110,
    settledAt: null,
    state: "SETTLED",
  };
  const html = render(SettlementDetails, {
    available: true,
    rows: [
      { ...base, settledOutcome: "win", settledUnits: 0.909 },
      { ...base, gamePk: 2, settledOutcome: "loss", settledUnits: -1 },
      {
        ...base,
        gamePk: 3,
        settledOutcome: null,
        settledUnits: null,
        state: "AWAITING_CERTIFIED_SETTLEMENT",
      },
    ],
  });
  for (const value of [
    "WIN",
    "LOSS",
    "PENDING",
    "+0.909u",
    "-1.000u",
    "3 selections match",
    "Clear filters",
  ])
    assert.ok(html.includes(value), value);
  assert.match(html, /type="date"/);
});
test("overview excludes preview and shows unavailable accuracy without fake percentages", () => {
  const sports = [
    {
      key: "mlb",
      label: "MLB",
      readiness: "Production",
      connected: true,
      available: true,
      wins: 3,
      losses: 1,
      pushes: 2,
      voids: 1,
      pending: 5,
    },
    {
      key: "nhl",
      label: "NHL",
      readiness: "Preview",
      connected: false,
      available: false,
      wins: null,
      losses: null,
      pushes: null,
      voids: null,
      pending: null,
    },
  ];
  const html = render(Overview, {
    sports,
    overall: summarizeOfficialSports(sports),
    warning: null,
  });
  assert.match(html, /75.0%/);
  assert.match(html, /3 won · 1 lost · 5 pending/);
  assert.match(html, /Official results not connected/);
  const unavailable = render(Overview, {
    sports: [],
    overall: summarizeOfficialSports([]),
    warning: "Read failed",
  });
  assert.match(unavailable, /Results unavailable/);
  assert.doesNotMatch(unavailable, /0.0%/);
});
