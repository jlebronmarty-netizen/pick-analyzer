import test from "node:test";
import assert from "node:assert/strict";
import {
  candidates,
  efficiency,
  measure,
  sample,
} from "../src/app/ncaab-cheat-sheets/evidence.mjs";
const games = Array.from({ length: 10 }, (_, i) => ({
  eventId: String(i),
  pointsFor: 76,
  pointsAgainst: 70,
  periods: [
    { period: 1, pointsFor: 32, pointsAgainst: 31 },
    { period: 2, pointsFor: 34, pointsAgainst: 35 },
    { period: 3, pointsFor: 10, pointsAgainst: 4 },
  ],
  venue: "NEUTRAL",
}));
const team = (id) => ({
  id,
  recentGames: games,
  last10: { sequenceVerified: true },
  rest: { verified: false },
});
const quote = {
  market: "SPREAD",
  period: "FULL_GAME",
  sportsbook: "Archive",
  first: { side: "HOME", line: -6, americanOdds: -250 },
  second: { side: "AWAY", line: 6, americanOdds: -251 },
};
function setup() {
  const f = {
    eventId: "espn:test",
    homeId: "1",
    awayId: "2",
    state: "PREGAME",
    scheduledAt: "2026-11-25T22:00Z",
    neutralSite: true,
    markets: {
      status: "REFERENCE_ONLY",
      capturedAt: "2026-11-25T12:00Z",
      quotes: [structuredClone(quote)],
    },
  };
  return {
    teams: [team("1"), team("2")],
    fixtures: [f],
    readAt: "2026-11-25T17:00Z",
    coverage: { readComplete: true },
  };
}
const opts = { market: "ALL", period: "FT", window: "L5", band: "standard" };
test("band limits, pushes and missing evidence", () => {
  const r = setup();
  const [home] = candidates(r, {}, opts);
  assert.equal(home.frequency.wins, 0);
  assert.equal(home.frequency.n, 5);
  assert.equal(
    home.conditions.find((c) => c.label.includes("descanso")).ok,
    null,
  );
  assert.equal(
    candidates(r, {}, { ...opts, band: "heavy" })[0].side.side,
    "AWAY",
  );
  for (const odds of [-650, -651]) {
    r.fixtures[0].markets.quotes[0].second.americanOdds = odds;
    assert.equal(
      candidates(r, {}, { ...opts, band: "heavy" }).length,
      Number(odds === -650),
    );
  }
});
test("partial sequences, elapsed games, post-cut prices and unsupported periods stay outside ranking", () => {
  const r = setup();
  r.teams[0].last10.sequenceVerified = false;
  assert.equal(candidates(r, {}, opts).length, 0);
  r.teams[0].last10.sequenceVerified = true;
  assert.equal(candidates(r, {}, { ...opts, period: "1" }).length, 0);
  r.fixtures[0].markets.capturedAt = "2026-11-25T18:00Z";
  assert.equal(candidates(r, {}, opts).length, 0);
  r.readAt = r.fixtures[0].scheduledAt;
  assert.equal(candidates(r, {}, opts).length, 0);
});
test("H2H is independent of recent games; halves exclude overtime and missing OT stays absent", () => {
  const prior = { ...games[0], eventId: "older" };
  assert.equal(sample(team("2"), [prior], "H10", true)[0].pointsFor, 70);
  assert.equal(sample(team("2"), [prior], "H5")[0].eventId, "older");
  assert.equal(measure(prior, "2").pointsFor, 34);
  assert.equal(measure(prior, "OT").pointsFor, 10);
  assert.equal(
    measure({ ...prior, periods: prior.periods.slice(0, 2) }, "OT"),
    null,
  );
});
test("shared games count once for totals and possession rates use real playing time", () => {
  const r = setup();
  r.fixtures[0].markets.quotes = [
    {
      ...quote,
      market: "TOTAL",
      first: { side: "OVER", americanOdds: -105, line: 140 },
      second: { side: "UNDER", americanOdds: -105, line: 140 },
    },
  ];
  assert.equal(candidates(r, {}, opts)[0].frequency.n, 5);
  assert.deepEqual(
    efficiency(games, {
      0: { possessions: 70, minutes: 45, pointsFor: 77, pointsAgainst: 70 },
    }),
    { n: 1, pace: (40 * 70) / 45, offense: 110, defense: 100 },
  );
});

test("total conditions and favorable gaps survive swapping the teams", () => {
  const r=setup();
  r.fixtures[0].neutralSite=false;
  r.teams[0].recentGames=games.map((g,i)=>({...g,venue:"HOME",eventId:"h"+i,pointsFor:110}));
  r.teams[1].recentGames=games.map((g,i)=>({...g,venue:"AWAY",eventId:"a"+i,pointsFor:39}));
  r.fixtures[0].markets.quotes=[{...quote,market:"TOTAL",first:{side:"OVER",line:140,americanOdds:-105},second:{side:"UNDER",line:140,americanOdds:-105}}];
  const select=()=>candidates(r,{}, {...opts,sort:"percent"}).map(({conditions,frequency,side,gap,percent})=>({conditions,frequency,side,gap,percent}));
  const before=select(); assert.equal(before.length,2); assert.equal(before[0].frequency.n,10);
  const f=r.fixtures[0];[f.homeId,f.awayId]=[f.awayId,f.homeId];assert.deepEqual(select(),before);
  assert.equal(candidates(setup(),{},{...opts,sort:"percent"}).length,0);
});

test("prior-season matchups respect capture time, team orientation and season boundaries",async()=>{
  const {priorSeasons}=await import("../research/ncaab-sheet-history/read.mjs");
  const f={homeId:"245",awayId:"145"},cut="2026-11-24T17:00:00Z";
  assert.deepEqual(priorSeasons(f,2027,"2026-10-01T12:00:00Z"),[]);
  const a=priorSeasons(f,2027,cut), b=priorSeasons({homeId:"145",awayId:"245"},2027,cut);
  assert.ok(a.length && a.every(g=>g.year<2027 && g.n>=g.games.length && g.games.length<=10));
  assert.equal(a[0].games[0].homePoints,b[0].games[0].awayPoints);
});
