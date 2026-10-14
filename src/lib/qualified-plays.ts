export type ResearchGroup = {
  key: string;
  season: number;
  phase: string;
  engine: string;
  model: string;
  contract: string | null;
  market: string;
  line: number | null;
  direction: string;
  evidenceClass: string;
  observations: number;
  wins: number;
  losses: number;
  pushes: number;
  voids: number;
  open: number;
  accuracy: number | null;
};
export type QualifiedReport = {
  status: "AVAILABLE" | "EMPTY" | "UNAVAILABLE";
  readAt: string;
  sourceUpdatedAt: string | null;
  observations: number | null;
  groups: ResearchGroup[];
  warning: string | null;
};
export function unavailableQualifiedReport(): QualifiedReport {
  return {
    status: "UNAVAILABLE",
    readAt: new Date().toISOString(),
    sourceUpdatedAt: null,
    observations: null,
    groups: [],
    warning:
      "Research ledger is unavailable or changed during this read. No historical counts are substituted.",
  };
}
const text = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;
const timestamp = (v: unknown): v is string =>
  text(v) && Number.isFinite(Date.parse(v));
export function summarizeQualifiedPlays(
  rows: Record<string, unknown>[],
  readAt: string,
  sourceUpdatedAt: string | null,
): QualifiedReport {
  const groups = new Map<string, ResearchGroup>();
  const ids = new Set<string>();
  const sources = new Set<string>();
  for (const r of rows) {
    const source = JSON.stringify([
      r.source_relation,
      r.source_row_id,
      r.model_id,
    ]);
    const phase = r.season_phase;
    const line =
      r.line === null
        ? null
        : typeof r.line === "number" ||
            (typeof r.line === "string" && r.line.trim() !== "")
          ? Number(r.line)
          : NaN;
    if (
      !text(r.id) ||
      ids.has(r.id) ||
      sources.has(source) ||
      r.season !== 2026 ||
      !["REGULAR_SEASON", "POSTSEASON"].includes(String(phase)) ||
      ![
        r.engine,
        r.model_id,
        r.market,
        r.direction,
        r.evidence_class,
        r.source_relation,
        r.source_row_id,
      ].every(text) ||
      !(r.contract_id === null || text(r.contract_id)) ||
      (line !== null && !Number.isFinite(line)) ||
      !timestamp(r.freeze_timestamp) ||
      !timestamp(r.updated_at) ||
      (r.scheduled_at !== null &&
        (!timestamp(r.scheduled_at) ||
          Date.parse(r.freeze_timestamp) >= Date.parse(r.scheduled_at))) ||
      ![null, "WIN", "LOSS", "PUSH", "VOID"].includes(
        r.result as string | null,
      ) ||
      (r.result !== null && !timestamp(r.settled_at)) ||
      r.research_only !== true ||
      r.production_eligible !== false ||
      r.official_picks_eligible !== false ||
      r.apostar_enabled !== false ||
      !String(r.evidence_class).startsWith(
        phase === "POSTSEASON"
          ? "POSTSEASON_SHADOW_DOMAIN_SHIFT"
          : "REGULAR_SEASON_FORWARD",
      )
    ) {
      throw new Error("INVALID_RESEARCH_LEDGER");
    }
    ids.add(r.id);
    sources.add(source);
    const key = JSON.stringify([
      r.season,
      phase,
      r.engine,
      r.model_id,
      r.contract_id,
      r.market,
      line,
      r.direction,
      r.evidence_class,
    ]);
    const g = groups.get(key) ?? {
      key,
      season: 2026,
      phase: String(phase),
      engine: String(r.engine),
      model: String(r.model_id),
      contract: r.contract_id as string | null,
      market: String(r.market),
      line,
      direction: String(r.direction),
      evidenceClass: String(r.evidence_class),
      observations: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      voids: 0,
      open: 0,
      accuracy: null,
    };
    g.observations++;
    if (r.result === "WIN") g.wins++;
    else if (r.result === "LOSS") g.losses++;
    else if (r.result === "PUSH") g.pushes++;
    else if (r.result === "VOID") g.voids++;
    else g.open++;
    g.accuracy = g.wins + g.losses > 0 ? g.wins / (g.wins + g.losses) : null;
    groups.set(key, g);
  }
  return {
    status: rows.length ? "AVAILABLE" : "EMPTY",
    readAt,
    sourceUpdatedAt,
    observations: rows.length,
    groups: [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)),
    warning: null,
  };
}
export type LedgerBoundary = { count: number; updatedAt: string | null };
/** Count/watermark guards reject partial or concurrently changing multi-page reads. */
export async function readQualifiedSnapshot(
  boundary: () => Promise<LedgerBoundary>,
  page: (after: string | null) => Promise<Record<string, unknown>[]>,
): Promise<QualifiedReport> {
  try {
    const before = await boundary();
    if (
      !Number.isInteger(before.count) ||
      before.count < 0 ||
      before.count > 10000 ||
      (before.count > 0 && !timestamp(before.updatedAt))
    )
      throw new Error("INVALID_BOUNDARY");
    const rows: Record<string, unknown>[] = [];
    let cursor: string | null = null;
    while (rows.length < before.count) {
      const batch = await page(cursor);
      if (
        !batch.length ||
        batch.length > 500 ||
        rows.length + batch.length > before.count
      )
        throw new Error("PARTIAL_READ");
      for (const row of batch) {
        if (
          !text(row.id) ||
          (cursor !== null && row.id <= cursor) ||
          !timestamp(row.updated_at) ||
          Date.parse(row.updated_at) > Date.parse(before.updatedAt!)
        )
          throw new Error("UNSTABLE_READ");
        cursor = row.id;
        rows.push(row);
      }
    }
    const after = await boundary();
    if (before.count !== after.count || before.updatedAt !== after.updatedAt)
      throw new Error("LEDGER_CHANGED");
    return summarizeQualifiedPlays(
      rows,
      new Date().toISOString(),
      before.updatedAt,
    );
  } catch {
    return unavailableQualifiedReport();
  }
}
