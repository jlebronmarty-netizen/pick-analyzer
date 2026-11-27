import test from "node:test";
import assert from "node:assert/strict";
import {
  inBand,
  rankThresholds,
  teamWindow,
} from "../src/app/nhl-cheat-sheets/windows.mjs";
const history = Array.from({ length: 10 }, (_, id) => ({
  id,
  score: 3,
  against: 2,
  opp: "B",
}));
const home = { history, abbrev: "A" };
const away = {
  history: history.map((g) => ({ ...g, opp: "A", score: 2, against: 3 })),
  abbrev: "B",
};
const fixtures = [{ id: "fixture", fixture: { teams: { home, away } } }];
const quote = {
  id: "fixture",
  market: "total",
  side: "over",
  price: -251,
  line: 5,
};
test("American price boundaries remain disjoint", () => {
  for (const p of [-651, -650, -251, -250, -110, 125])
    assert.equal(inBand(p, "all"), inBand(p, "standard") || inBand(p, "heavy"));
  assert.deepEqual(
    [-651, -650, -251, -250, -110, 125].map((p) => inBand(p, "heavy")),
    [false, true, true, false, false, false],
  );
});
test("missing games block a window and H2H restricts opponents", () => {
  assert.equal(teamWindow({ history: [null, ...history] }, "5", "B").length, 0);
  assert.equal(teamWindow(home, "h2h", "C").length, 0);
  assert.equal(teamWindow(home, "5", "B").length, 5);
});
test("totals count each unique final and keep exact thresholds in denominator", () => {
  const [r] = rankThresholds(fixtures, [quote], "total", "heavy", "10");
  assert.deepEqual([r.n, r.hits, r.ties], [10, 0, 10]);
  assert.equal(
    rankThresholds(fixtures, [quote], "total", "standard", "10").length,
    0,
  );
  assert.equal(
    rankThresholds(
      fixtures,
      [{ ...quote, side: "under", line: 5.5 }],
      "total",
      "heavy",
      "5",
    )[0].hits,
    5,
  );
});

import { regulationPeriods } from "../src/app/nhl-cheat-sheets/periods.mjs";
test("period accounting separates shootout bonus and rejects incomplete scoring", () => {
  const game = {
    gameState: "FINAL",
    gameOutcome: { lastPeriodType: "SO" },
    homeTeam: { abbrev: "H", score: 2 },
    awayTeam: { abbrev: "A", score: 1 },
    goals: [
      {
        period: 1,
        periodDescriptor: { number: 1, periodType: "REG" },
        teamAbbrev: "H",
        homeScore: 1,
        awayScore: 0,
      },
      {
        period: 3,
        periodDescriptor: { number: 3, periodType: "REG" },
        teamAbbrev: "A",
        homeScore: 1,
        awayScore: 1,
      },
    ],
  };
  assert.deepEqual(regulationPeriods(game).periods, [
    { home: 1, away: 0 },
    { home: 0, away: 0 },
    { home: 0, away: 1 },
  ]);
  assert.equal(
    regulationPeriods({ ...game, goals: game.goals.slice(0, 1) }),
    null,
  );
});

test("direct series is independent of general history and never fills missing boxes", () => {
  const team = { history: [], direct: history };
  assert.equal(teamWindow(team, "direct5").length, 5);
  assert.equal(teamWindow(team, "direct10").length, 10);
  assert.deepEqual(
    teamWindow({ ...team, direct: [null, ...history] }, "direct5"),
    [],
  );
});
test("market criteria keep unsupported factors unknown and pushes outside hits", () => {
  const [r] = rankThresholds(
    fixtures,
    [quote],
    "total",
    "heavy",
    "10",
    "conditions",
  );
  assert.equal(r.conditions.length, 9);
  assert.equal(r.conditions.find((c) => c.name === "Forma L10").pass, false);
  assert.equal(
    r.conditions.find((c) => c.name === "Porteros confirmados").pass,
    null,
  );
  assert.equal(r.conditions.find((c) => c.name === "H2H").pass, null);
});
