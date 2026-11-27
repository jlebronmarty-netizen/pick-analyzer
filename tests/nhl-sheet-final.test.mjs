import test from "node:test";
import assert from "node:assert/strict";
import { verifyArchivedFinal } from "../research/nhl-sheet-tracker/final.mjs";
import {
  matchingRule,
  processPending,
} from "../research/nhl-sheet-tracker/settlement.mjs";
const start = "2026-11-20T00:00Z",
  observed = "2026-11-20T03:00Z",
  asOf = "2026-11-20T04:00Z";
const c = {
  id: 1,
  eventId: "nhl:2",
  homeId: 1,
  awayId: 2,
  market: "total",
  scope: "FINAL_WITH_SO",
  line: 1.5,
  side: "under",
  odds: -110,
  book: "fixture",
  label: "GAME",
  jurisdiction: "lab",
  ruleId: "test",
  start,
  quotedAt: "2026-11-19T22:00Z",
  recordedAt: "2026-11-19T23:00Z",
};
const rule = {
  ...c,
  id: c.ruleId,
  verified: true,
  from: "2026-01-01",
  until: "2027-01-01",
  push: "refund",
  voidTerms: "offline only",
  source: "fixture",
};
import { goal, archiveFixture } from "./fixtures/nhl-sheet-final.mjs";
const fixture = () => archiveFixture(start, observed);
test("requires two matching finals and a complete ordered goal ledger", () => {
  const r = fixture();
  const f = verifyArchivedFinal([r], c, asOf);
  assert.deepEqual(f.players[0].values.goals, { full: 1, periods: [1, 0, 0] });
  for (const rows of [[], [r, r]])
    assert.equal(verifyArchivedFinal(rows, c, asOf), null);
  for (const change of [
    (r) => (r.boxscore.homeTeam.score = -1),
    (r) => (r.play_by_play.awayTeam.id = 9),
    (r) => (r.play_by_play.plays[2].eventId = 1),
    (r) => r.play_by_play.plays.splice(2, 1),
    (r) => (r.pbp_captured_at = "2030-01-01"),
    (r) => (r.play_by_play.plays[0].details = { ...goal, homeScore: 3 }),
  ]) {
    const bad = fixture();
    change(bad);
    assert.equal(verifyArchivedFinal([bad], c, asOf), null);
  }
});
test("invalid player components stay pending independently; missing player is not DNP", () => {
  for (const invalid of [-1, 1.5, null, "1", undefined]) {
    const r = fixture();
    r.boxscore.playerByGameStats.homeTeam.forwards[0].goals = invalid;
    const f = verifyArchivedFinal([r], c, asOf);
    assert.equal(f.players[0].values.goals, undefined);
    assert.equal(f.players[0].values.shots.full, 1);
  }
  const r = fixture();
  r.boxscore.playerByGameStats.homeTeam.forwards[0].toi = "00:00";
  assert.equal(
    verifyArchivedFinal([r], c, asOf).players[0].participation,
    "unknown",
  );
  r.boxscore.playerByGameStats.awayTeam.forwards =
    r.boxscore.playerByGameStats.homeTeam.forwards;
  assert.equal(verifyArchivedFinal([r], c, asOf).players.length, 0);
});
test("uncertified receipts stay out; corrected archived evidence settles both sides independently", async () => {
  assert.equal(matchingRule(c), null);
  assert.equal(matchingRule({ ...c, jurisdiction: "other" }, [rule]), null);
  const grades = new Map();
  const ledger = {
    pending: () =>
      [c, { ...c, id: 2, side: "over" }].filter((x) => !grades.has(x.id)),
    insertGradeOnce: (id, g) => {
      grades.set(id, g);
      return true;
    },
  };
  let rows = [];
  const tick = () =>
    processPending({ ledger, readFinal: () => rows, asOf, rules: [rule] });
  assert.equal((await tick()).pending, 2);
  assert.equal(grades.size, 0);
  rows = [fixture()];
  assert.equal((await tick()).written, 2);
  assert.deepEqual(
    [...grades.values()].map((g) => g.result),
    ["win", "loss"],
  );
  assert.equal((await tick()).written, 0);
});

import { nhlSheetAccess } from "../src/app/nhl-cheat-sheets/access.mjs";
import { nhlSheetTick } from "../research/nhl-sheet-tracker/tick.mjs";
test("staged UI and empty rule registry are independent deployment gates", async () => {
  const env = {
    VERCEL_ENV: "production",
    VERCEL_URL: "private.vercel.app",
    NBA_DECISION_BOARD_ENABLED: "true",
  };
  const h = new Headers({
    host: env.VERCEL_URL,
    "x-vercel-oidc-token": "fixture",
  });
  assert.equal(nhlSheetAccess(h, env), false);
  env.NHL_CHEAT_SHEETS_ENABLED = "true";
  assert.equal(nhlSheetAccess(h, env), true);
  h.delete("x-vercel-oidc-token");
  assert.equal(nhlSheetAccess(h, env), false);
  let calls = 0;
  const connect = () => {
    calls++;
  };
  assert.equal((await nhlSheetTick({ connect })).status, "DISABLED");
  assert.equal(
    (await nhlSheetTick({ enabled: true, connect })).status,
    "NO_CERTIFIED_CONTRACTS",
  );
  assert.equal(calls, 0);
});

test("OT counts its winning goal; shootout credits one only to the official scoreboard", () => {
  for (const finish of ["OT", "SO"]) {
    const r = fixture(),
      p = r.play_by_play,
      number = finish === "OT" ? 4 : 5;
    for (const g of [p, r.boxscore]) {
      g.gameOutcome = { lastPeriodType: finish };
      g.periodDescriptor = { number, periodType: finish };
      g.homeTeam.score = 1;
      g.awayTeam.score = 0;
    }
    p.plays = p.plays.filter(
      (x) => x.typeDescKey !== "goal" && x.typeDescKey !== "game-end",
    );
    let next = 10;
    const add = (n, typeDescKey, details = {}) =>
      p.plays.push({
        periodDescriptor: { number: n, periodType: n === 4 ? "OT" : "SO" },
        typeDescKey,
        eventId: next++,
        details,
      });
    if (finish === "OT") add(4, "goal", goal);
    add(4, "period-end");
    if (finish === "SO") {
      add(5, "goal", { eventOwnerTeamId: 1 });
      add(5, "shootout-complete");
      add(5, "period-end");
    }
    add(number, "game-end");
    const f = verifyArchivedFinal([r], c, asOf);
    assert.deepEqual(f.scores.REG, { home: 0, away: 0 });
    assert.deepEqual(f.scores.FINAL_WITH_SO, { home: 1, away: 0 });
    assert.equal(f.scores.GOALS_PLAYED.home, finish === "OT" ? 1 : 0);
    assert.equal(f.scores.OT.home, finish === "OT" ? 1 : 0);
    if (finish === "SO") {
      p.plays.find((x) => x.typeDescKey === "goal").details.eventOwnerTeamId =
        2;
      assert.equal(verifyArchivedFinal([r], c, asOf), null);
    }
  }
});
