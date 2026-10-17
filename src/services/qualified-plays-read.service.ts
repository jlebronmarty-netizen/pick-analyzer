import "server-only";
import {
  readQualifiedSnapshot,
  unavailableQualifiedReport,
} from "@/lib/qualified-plays";
const TABLE = "mlb_2026_forward_master_ledger_v1";
const COLUMNS =
  "id,season,season_phase,engine,model_id,contract_id,market,line,direction,evidence_class,result,freeze_timestamp,scheduled_at,settled_at,updated_at,source_relation,source_row_id,research_only,production_eligible,official_picks_eligible,apostar_enabled";
export async function getQualifiedPlaysReport({ includeEntries = false } = {}) {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase-admin");
    const signal = AbortSignal.timeout(15000);
    return await readQualifiedSnapshot(
      async () => {
        const { data, error, count } = await supabaseAdmin
          .from(TABLE)
          .select("updated_at", { count: "exact" })
          .eq("season", 2026)
          .order("updated_at", { ascending: false })
          .limit(1)
          .abortSignal(signal);
        if (error || count === null || !data)
          throw new Error("BOUNDARY_READ_FAILED");
        return { count, updatedAt: data[0]?.updated_at ?? null };
      },
      async (after) => {
        let query = supabaseAdmin
          .from(TABLE)
          .select(COLUMNS + (includeEntries ? ",target_date,game_pk,selection,projection,actual_value,actual_label,metadata" : ""))
          .eq("season", 2026)
          .order("id", { ascending: true })
          .limit(500);
        if (after !== null) query = query.gt("id", after);
        const { data, error } = await query.abortSignal(signal);
        if (error || !data) throw new Error("PAGE_READ_FAILED");
        // A dynamic SELECT string cannot infer a static SDK row type. Keep the
        // database response unknown until its object shape and ledger fields
        // are checked, rather than asserting a successful typed query.
        return data.map((row: unknown) => {
          if (row === null || typeof row !== "object" || Array.isArray(row))
            throw new Error("INVALID_PAGE_ROW");
          return row as Record<string, unknown>;
        });
      },
      includeEntries,
    );
  } catch {
    return unavailableQualifiedReport();
  }
}
