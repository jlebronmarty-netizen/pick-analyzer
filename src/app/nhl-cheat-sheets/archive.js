import "server-only";
import v13 from "./v13-20261123.json";
import alignment from "./alignment-2026.json";
import { nativeFixtures,calendarDay } from "./native";
import { normalizeNhlResearchContexts } from "@/lib/nhl-research-features.mjs";
import { nhlGoalieAsOfSide } from "@/lib/nhl-goalie-prior-form-asof-v7.mjs";
import { supabaseAdmin as db } from "@/lib/supabase-admin";
import {
  readNhlManualFeaturePages,
  buildNhlManualFeaturesReport,
  nhlManualFeatureDayBounds,
} from "@/lib/nhl-manual-features.mjs";

async function rows(query) {
  const output = [];
  let expected;
  do {
    const result = await query
      .range(output.length, output.length + 499)
      .abortSignal(AbortSignal.timeout(18000));
    if (
      result.error ||
      !Number.isInteger(result.count) ||
      result.count > 20000 ||
      (expected !== undefined && expected !== result.count)
    )
      throw Error("Archivo incompleto");
    expected = result.count;
    output.push(...result.data);
    if (
      output.length > expected ||
      (!result.data.length && output.length < expected)
    )
      throw Error("Paginación incompleta");
  } while (output.length < expected);
  return output;
}

export async function readSheet(date,cutoff=new Date().toISOString()) {
  const { from, to } = nhlManualFeatureDayBounds(date);

  const end = new Date(
    Math.min(Date.parse(to), Date.parse(cutoff)),
  ).toISOString();
  const [calendars,manual, ml, runs] = await Promise.all([
    Promise.all([date,new Date(Date.parse(date+"T12:00Z")-86400000).toISOString().slice(0,10)].map(d=>calendarDay(db,d,cutoff))),
    readNhlManualFeaturePages(db, {
      date,
      cutoff,
      signal: AbortSignal.timeout(18000),
    }),
    rows(
      db
        .from("nhl_free_quote_observations_v1")
        .select("event_id,scheduled_at,created_at,captured_at,body", {
          count: "exact",
        })
        .gte("scheduled_at", from)
        .lt("scheduled_at", to)
        .lte("created_at", cutoff)
        .order("id"),
    ),
    rows(
      db
        .from("nhl_free_runs_v1")
        .select("completed_at,markets:detail->marketQuoteObservations", {
          count: "exact",
        })
        .gte(
          "completed_at",
          new Date(Date.parse(from) - 86400000).toISOString(),
        )
        .lte("completed_at", end)
        .order("id"),
    ),
  ]);
  const fixtures = buildNhlManualFeaturesReport(manual).fixtures;
  const prices = new Map(),
    games = new Map(
      fixtures.map((f) => [
        f.eventId,
        {
          id: f.eventId,
          away: f.teams.away.abbrev,
          home: f.teams.home.abbrev,
          time: f.scheduledAt,
          fixture: f,
        },
      ]),
    );
  function add(
    id,
    time,
    stamp,
    persisted,
    away,
    home,
    awayId,
    homeId,
    market,
    legs,
    expiresAt,
  ) {
    const start = Date.parse(time),
      captured = Date.parse(stamp),
      saved = Date.parse(persisted);
    if (
      !/^nhl:\d{10}$/.test(id) ||
      !(
        start >= Date.parse(from) &&
        start < Date.parse(to) &&
        captured <= saved &&
        saved < start &&
        saved <= Date.parse(cutoff)
      ) ||
      !away ||
      !home
    )
      return;
    if (
      !Number.isSafeInteger(awayId) ||
      !Number.isSafeInteger(homeId) ||
      awayId === homeId
    )
      return;
    if (!games.has(id)) games.set(id, { id, time, away, home, awayId, homeId });
    const fixture = games.get(id);
    if (Date.parse(fixture.time) !== start) return;
    const identity = fixture.fixture?.teams;
    if (identity) {
      fixture.quoteIds ??= { awayId, homeId };
    }
    if (
      (fixture.quoteIds?.awayId ?? fixture.awayId) !== awayId ||
      (fixture.quoteIds?.homeId ?? fixture.homeId) !== homeId
    )
      return;
    for (const [side, leg] of Object.entries(legs)) {
      if (
        !Number.isInteger(leg?.price) ||
        Math.abs(leg.price) < 100 ||
        (market !== "ml" && !Number.isFinite(leg.line))
      )
        continue;
      const key = [id, market, side].join("|"),
        old = prices.get(key);
      if (!old || old.captured < captured)
        prices.set(key, {
          id,
          market,
          side,
          line: leg.line,
          price: leg.price,
          captured, expiresAt:leg.expiresAt??expiresAt??null,
        });
      else if (
        old.captured === captured &&
        (old.line !== leg.line || old.price !== leg.price || old.expiresAt!==(leg.expiresAt??expiresAt??null))
      )
        old.conflict = true;
    }
  }
  for (const r of ml) {
    const b = r.body;
    if (
      b?.sportsbook === "CIRCA" &&
      b.eventId === r.event_id &&
      Date.parse(b.scheduledAt) === Date.parse(r.scheduled_at)
    )
      add(
        r.event_id,
        r.scheduled_at,
        r.captured_at,
        r.created_at,
        b.away,
        b.home,
        b.awayId,
        b.homeId,
        "ml",
        { away: { price: b.awayOdds }, home: { price: b.homeOdds } }, b.expiresAt,
      );
  }
  for (const run of runs)
    for (const r of run.markets ?? []) {
      const q = r.quote;
      if (
        r.book === "CIRCA" &&
        q?.book === "CIRCA" &&
        q.market === r.market &&
        ["spread", "total"].includes(r.market)
      )
        add(
          r.eventId,
          r.scheduledAt,
          r.capturedAt,
          run.completed_at,
          r.away,
          r.home,
          r.awayId,
          r.homeId,
          r.market,
          r.market === "spread"
            ? { away: q.away, home: q.home }
            : { over: q.over, under: q.under }, q.expiresAt??r.expiresAt,
        );
    }
  const native = await nativeFixtures(
    db,
    [...games.values()].filter((g) => !g.fixture),
    date,
    cutoff,
    rows,
  );
  fixtures.push(...native);
  for (const f of native) games.get(f.eventId).fixture = f;
  const catalog = fixtures.length
    ? await rows(
        db
          .from("nhl_game_context_v2")
          .select(
            "event_id,boxscore_captured_at,tip:boxscore->>startTimeUTC,hid:boxscore->homeTeam->id,aid:boxscore->awayTeam->id,home:boxscore->homeTeam->>abbrev,away:boxscore->awayTeam->>abbrev",
            { count: "exact" },
          )
          .eq("boxscore->>season", "20262027")
          .eq("boxscore->>gameType", "2")
          .in("boxscore->>gameState", ["FINAL", "OFF"])
          .order("event_id"),
      )
    : [];
  for (const f of fixtures) {
    const matches = (t, id, abbrev) =>
      t.teamId ? t.teamId === id : t.abbrev === abbrev;
    f.directIds = catalog
      .filter(
        (r) =>
          Date.parse(r.tip) < Date.parse(r.boxscore_captured_at) &&
          Date.parse(r.boxscore_captured_at) <= Date.parse(f.availableAsOf) &&
          ((matches(f.teams.home, r.hid, r.home) &&
            matches(f.teams.away, r.aid, r.away)) ||
            (matches(f.teams.home, r.aid, r.away) &&
              matches(f.teams.away, r.hid, r.home))),
      )
      .sort((a, b) => Date.parse(b.tip) - Date.parse(a.tip))
      .slice(0, 10)
      .map((r) => r.event_id);
  }
  const ids = [
    ...new Set(
      fixtures.flatMap((f) => [
        ...Object.values(f.teams).flatMap((t) => t.last10.recentEventIds),
        ...f.directIds,
      ]),
    ),
  ];
  const boxes = ids.length
    ? await rows(
        db
          .from("nhl_game_context_v2")
          .select("event_id,boxscore_captured_at,boxscore", { count: "exact" })
          .in("event_id", ids)
          .order("event_id"),
      )
    : [];
  const matchups = ids.length
    ? await rows(
        db
          .from("nhl_matchup_observations_v3")
          .select(
            "event_id,shooting_player_id,goalie_id,shooting_player_name,goalie_name,shots,goals,captured_at",
            { count: "exact" },
          )
          .in("event_id", ids)
          .order("event_id")
          .order("shooting_player_id")
          .order("goalie_id"),
      )
    : [];
  for (const f of fixtures) {
    const source = manual.rows.find(
      (r) => r.event_id === f.eventId && r.available_as_of === f.availableAsOf,
    )?.feature_payload;
    const gameIds = new Set([
      ...Object.values(f.teams).flatMap((t) => t.last10.recentEventIds),
      ...f.directIds,
    ]);
    const fixtureBoxes = boxes.filter((b) => gameIds.has(b.event_id));
    const observed = matchups.filter(
      (m) =>
        gameIds.has(m.event_id) &&
        Date.parse(m.captured_at) <= Date.parse(f.availableAsOf),
    );
    const history = normalizeNhlResearchContexts(
      fixtureBoxes,
      f.availableAsOf,
      observed,
    );
    for (const [side, t] of Object.entries(f.teams)) {
      const raw = source?.teams[side];
      if (
        Date.parse(t.specialTeams.capturedAt) > Date.parse(f.availableAsOf) ||
        !t.specialTeams.capturedAt
      )
        t.specialTeams.currentGamesMatch = false;
      if (
        !t.goalie.checkedAt ||
        Date.parse(t.goalie.checkedAt) > Date.parse(f.availableAsOf)
      )
        t.goalie = { name: null, status: "SIN EVIDENCIA" };
      t.rank =
        Number.isInteger(raw?.rank) && raw?.rank >= 1 && raw?.rank <= 32
          ? raw?.rank
          : null;
      t.homeRecord = raw?.season.home_record;
      t.awayRecord = raw?.season.away_record;
      const seed = v13.events[f.eventId];
      if (
        seed &&
        Date.parse(seed.start_utc) === Date.parse(f.scheduledAt) &&
        seed.away === f.teams.away.abbrev &&
        seed.home === f.teams.home.abbrev &&
        Date.parse(v13.archivedAt) <= Date.parse(f.availableAsOf)
      ) {
        const standings = v13.teams[t.abbrev];
        t.rank ??= standings.rank;
        t.divisionRank = standings.division_rank;
        t.conferenceRank = standings.conference_rank;
        t.homeRecord ??= standings.season.home_record;
        t.awayRecord ??= standings.season.away_record;
        t.injuries = seed.injuries.filter(
          (r) =>
            r.team === t.abbrev &&
            Date.parse(r.checked_at) <= Date.parse(f.availableAsOf),
        );
        const report = seed[side + "_goalie"];
        if (
          !t.goalie.name &&
          report?.name &&
          Date.parse(report.checked_at) <= Date.parse(f.availableAsOf)
        ) {
          t.goalie = {
            name: report.name,
            status: report.status,
            checkedAt: report.checked_at,
          };
        }
      }
      const expected = raw?.last10.expected_event_ids;
      const seq = t.last10.recentEventIds;
      const recent =
        t.last10.sequenceVerified &&
        (f.native ||
          (t.last10.complete &&
            seq.length === 10 &&
            JSON.stringify(expected) === JSON.stringify(seq)))
          ? seq
          : [];
      const describe = (id, direct = false) => {
        const g = history.teamGames.find(
          (g) =>
            g.eventId === id &&
            (f.native ? g.teamId === t.teamId : g.team === t.abbrev),
        );
        const rival = history.teamGames.find(
          (r) => r.eventId === id && r.teamId === g?.opponentId,
        );
        if (!g || !rival || g.opponentId !== rival.teamId) return null;
        let periods = null;
        if (f.native && !direct) {
          const scheduled = t.expectedMatches.find((x) => x.eventId === id);
          const home = g.side === "home" ? g.teamId : g.opponentId;
          const away = g.side === "away" ? g.teamId : g.opponentId;
          if (
            !scheduled ||
            scheduled.homeId !== home ||
            scheduled.awayId !== away ||
            Date.parse(scheduled.scheduledAt) !== Date.parse(g.scheduledAt)
          )
            return null;
          const scored = scheduled.scoring;
          if (
            scored &&
            scored.finish === g.endType &&
            scored[g.side + "Score"] === g.finalGoalsFor &&
            scored[g.side === "home" ? "awayScore" : "homeScore"] ===
              g.finalGoalsAgainst
          ) {
            periods = scored.periods.map((p) => [
              p[g.side],
              p[g.side === "home" ? "away" : "home"],
            ]);
          }
          t.abbrev = g.team;
        }
        return {
          id,
          periods,
          venue: g.side,
          date: g.gameDate,
          opp: rival.team,
          score: g.finalGoalsFor,
          against: g.finalGoalsAgainst,
          goals: g.performanceGoalsVerified ? g.goalsFor : null,
          allowed: rival.performanceGoalsVerified ? g.goalsAgainst : null,
          shots:
            g.shotsVerified &&
            (id !== "nhl:2026020349" ||
              (g.team === "EDM" &&
                g.shotsFor === 24 &&
                g.capturedAt === "2026-11-20T05:37:24.155Z"))
              ? g.shotsFor
              : null,
          shotsAgainst:
            g.shotsVerified &&
            (id !== "nhl:2026020349" ||
              (rival.team === "EDM" &&
                g.shotsAgainst === 24 &&
                g.capturedAt === "2026-11-20T05:37:24.155Z"))
              ? g.shotsAgainst
              : null,
          finish: g.endType,
          skaters: history.skaterGames
            .filter(
              (p) =>
                p.eventId === id && p.teamId === g.teamId && p.toiSeconds > 0,
            )
            .map((p) => ({
              id: p.playerId,
              name: p.name,
              g: p.goals,
              a: p.assists,
              s: p.shotsOnGoal,
            })),
          goalies: history.goalieGames
            .filter(
              (p) =>
                p.eventId === id &&
                p.teamId === g.teamId &&
                p.played &&
                p.accountingValid,
            )
            .map((p) => ({
              id: p.playerId,
              name: p.name,
              saves: p.saves,
              sa: p.shotsAgainst,
              ga: p.goalsAgainst,
              seconds: p.toiSeconds,
            })),
          meetings: observed
            .filter(
              (m) =>
                Number.isInteger(m.shots) &&
                Number.isInteger(m.goals) &&
                m.shots >= m.goals &&
                m.goals >= 0 &&
                m.event_id === id &&
                history.skaterGames.some(
                  (p) =>
                    p.eventId === id &&
                    p.teamId === g.teamId &&
                    p.playerId === m.shooting_player_id,
                ) &&
                history.goalieGames.some(
                  (p) =>
                    p.eventId === id &&
                    p.teamId === g.opponentId &&
                    p.playerId === m.goalie_id &&
                    p.played,
                ),
            )
            .map((m) => ({
              shooterId: m.shooting_player_id,
              goalieId: m.goalie_id,
              shooter: m.shooting_player_name ?? m.shooting_player_id,
              goalie: m.goalie_name ?? m.goalie_id,
              s: m.shots,
              g: m.goals,
            })),
        };
      };
      t.history = recent.map((id) => describe(id));
      t.direct = f.directIds.map((id) => describe(id, true));
      if (
        date >= "2026-11-23" &&
        date < "2027-07-01" &&
        Date.parse(f.availableAsOf) >= Date.parse("2026-11-23T16:15:18Z")
      )
        t.alignment = alignment[t.abbrev] ?? null;
      delete t.expectedMatches;
      if (
        f.native &&
        t.history[0] &&
        Number.isInteger(t.nativeDays) &&
        t.nativeDays >= 0
      )
        t.rest.verified = true;
      const teamIds = new Set(
        history.teamGames
          .filter((g) => g.team === t.abbrev)
          .map((g) => g.teamId),
      );
      if (teamIds.size === 1) t.teamId = [...teamIds][0];
      if (teamIds.size === 1)
        t.goalieId =
          nhlGoalieAsOfSide({
            teamId: [...teamIds][0],
            fullName: t.goalie.name,
            decisionAt: f.availableAsOf,
            gameEventId: f.eventId,
            boxscoreRows: fixtureBoxes,
          }).goalieNhlIdCandidate ?? null;
    }
  }
  for (const [key, p] of prices) {
    const g = games.get(p.id);
    if (
      g.quoteIds &&
      (g.fixture.teams.home.teamId !== g.quoteIds.homeId ||
        g.fixture.teams.away.teamId !== g.quoteIds.awayId)
    )
      prices.delete(key);
  }
  for(const row of calendars.filter(Boolean).sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)).flatMap(c=>c.games)){
    if(row.scheduledAt<from || row.scheduledAt>=to)continue;
    const g=games.get(row.eventId)??{id:row.eventId,time:row.scheduledAt,home:row.home,away:row.away};
    const conflict=Date.parse(g.time)!==Date.parse(row.scheduledAt) || g.home!==row.home || g.away!==row.away;
    g.state=conflict?'UNKNOWN':row.status;
    g.scheduleState=row.scheduleState;
    games.set(row.eventId,g);
  }
  return {
    games: [...games.values()].sort(
      (a, b) => Date.parse(a.time) - Date.parse(b.time),
    ),
    prices: [...prices.values()].filter((p) => !p.conflict),
  };
}
