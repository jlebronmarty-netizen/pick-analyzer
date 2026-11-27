import { readNhlResearchSchedules } from "@/lib/nhl-research-features.mjs";
import { selectEspnNhlProbablesAsOf } from "@/lib/nhl-espn-free-goalie-probables-v5.mjs";
import { selectNhlSpecialTeamsAsOf } from "@/lib/nhl-special-teams-asof-core.mjs";

const day = 86400000;

// One archived daily receipt per date at a common time before the earliest game.
// Stop at the first missing/conflicting day. Never fill a calendar gap with observed boxes.
async function calendarDay(db, date, cut) {
  const source = "https://api-web.nhle.com/v1/score/" + date;
  const { data, error } = await db
    .from("nhl_free_source_v1")
    .select("id,captured_at,source_url,body")
    .eq("source_url", source)
    .lte("captured_at", cut)
    .order("captured_at", { ascending: false })
    .order("id")
    .limit(2)
    .abortSignal(AbortSignal.timeout(10000));
  if (error) throw Error("Calendario inaccesible");
  const snapshots = readNhlResearchSchedules(data, cut).snapshots;
  if (!data?.length || snapshots.length !== data.length) return null;
  const current = snapshots.at(-1),
    other = snapshots.at(-2);
  return other?.capturedAt === current.capturedAt &&
    other.sha256 !== current.sha256
    ? null
    : current;
}

export async function nativeFixtures(db, games, date, cutoff, rows) {
  if (!games.length) return [];
  const asOf = new Date(
    Math.min(
      Date.parse(cutoff),
      ...games.map((g) => Date.parse(g.time) - 3600000),
    ),
  ).toISOString();
  const batch = [];
  const dateMs = Date.parse(date + "T00:00:00Z");
  for (let offset = 0; offset < 28; offset += 7) {
    const dates = Array.from({ length: 7 }, (_, i) =>
      new Date(dateMs - (offset + i) * day).toISOString().slice(0, 10),
    );
    const receipts = await Promise.all(
      dates.map((d) => calendarDay(db, d, asOf)),
    );
    const gap = receipts.findIndex((r) => !r);
    batch.push(...(gap === -1 ? receipts : receipts.slice(0, gap)));
    if (gap !== -1) break;
  }
  const earliest = new Date(dateMs - 2 * day).toISOString();
  const [goalie, units] = await Promise.all([
    rows(
      db
        .from("nhl_espn_goalie_probables_v1")
        .select("id,captured_at,created_at,games,source_version,raw_sha256", {
          count: "exact",
        })
        .eq("sports_date", date)
        .lte("created_at", cutoff)
        .order("id"),
    ),
    rows(
      db
        .from("nhl_special_teams_asof_v1")
        .select(
          "id,captured_at,created_at,teams,season_id,source_version,source_hash",
          { count: "exact" },
        )
        .gte("captured_at", earliest)
        .lte("created_at", cutoff)
        .order("id"),
    ),
  ]);
  return games.map((g) => {
    const scheduledAt = new Date(g.time).toISOString();
    const game = { ...g, eventId: g.id, scheduledAt };
    const at = new Date(
      Math.min(Date.parse(cutoff), Date.parse(g.time) - 3600000),
    ).toISOString();
    const eligible = (r) =>
      Date.parse(r.captured_at) <= Date.parse(r.created_at) &&
      Date.parse(r.created_at) <= Date.parse(at);
    const net = selectEspnNhlProbablesAsOf({
      snapshots: goalie.filter(eligible),
      game,
      decisionAt: at,
    });
    const st = selectNhlSpecialTeamsAsOf({
      snapshots: units.filter(eligible),
      game,
      asOf: at,
    });
    const target = batch[0]?.games.find(
      (x) =>
        x.eventId === g.id &&
        x.scheduledAt === scheduledAt &&
        x.homeId === g.homeId &&
        x.awayId === g.awayId,
    );
    const sides = {};
    for (const side of ["home", "away"]) {
      const teamId = g[side + "Id"];
      const matches = target
        ? batch
            .flatMap((b) => b.games.map((x) => ({ ...x, date: b.date })))
            .filter(
              (x) =>
                x.scheduledAt < scheduledAt &&
                [x.homeId, x.awayId].includes(teamId) &&
                !["PPD", "CNCL"].includes(x.scheduleState),
            )
            .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
        : [];
      const unique = new Set(matches.map((x) => x.eventId));
      const verified = unique.size === matches.length;
      const selected = verified ? matches.slice(0, 10) : [];
      const days = selected.length
        ? Math.round(
            (dateMs - Date.parse(selected[0].date + "T00:00:00Z")) / day,
          ) - 1
        : null;
      sides[side] = {
        teamId,
        expectedMatches: selected,
        abbrev: g[side],
        season: {},
        last10: {
          recentEventIds: selected.map((x) => x.eventId),
          sequenceVerified: verified,
          complete: selected.length === 10,
          periods: [],
        },
        specialTeams: {
          ...(st[side] ?? {}),
          currentGamesMatch: !!st[side],
          capturedAt: st.capturedAt,
        },
        goalie: {
          name: net[side]?.displayName,
          status: net[side]?.displayName ? "PROBABLE (ESPN)" : "SIN EVIDENCIA",
          checkedAt: net.observedAt,
        },
        rest: { daysOff: days, backToBack: days === 0, verified: false },
        nativeDays: days,
      };
    }
    return {
      native: true,
      eventId: g.id,
      scheduledAt,
      availableAsOf: at,
      calendarAsOf: asOf,
      teams: sides,
    };
  });
}
