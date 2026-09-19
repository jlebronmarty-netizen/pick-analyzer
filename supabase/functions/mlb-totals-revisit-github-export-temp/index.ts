import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";

const CONTRACT = "MLB_TOTALS_REVISIT_GITHUB_EXPORT/1.0.0";
const AUDIENCE = "supabase-totals-revisit";
const REPOSITORY = "jlebronmarty-netizen/pick-analyzer";
const ALLOWED_REF = "refs/heads/research/totals-revisit-20260919";
const JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = (req.headers.get("x-github-oidc-token") || "").trim();
  if (!token) return json({ error: "OIDC_REQUIRED" }, 401);

  try {
    const verified = await jwtVerify(token, JWKS, {
      issuer: "https://token.actions.githubusercontent.com",
      audience: AUDIENCE,
    });
    const claims = verified.payload;
    if (claims.repository !== REPOSITORY || claims.ref !== ALLOWED_REF) {
      return json({ error: "OIDC_SCOPE_REJECTED" }, 403);
    }
  } catch {
    return json({ error: "OIDC_INVALID" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const offset = Number.isInteger(body?.offset) && body.offset >= 0 ? body.offset : 0;
  const limit = Number.isInteger(body?.limit)
    ? Math.min(Math.max(body.limit, 1), 250)
    : 250;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "SERVER_CONFIG_MISSING" }, 500);

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error, count } = await db
    .from("mlb_totals_revisit_dev_rows_v1")
    .select(
      "season,game_pk,game_date,payload,y_total_runs,y_close_margin,close_over_label,market_lineage,development_class,research_only",
      { count: "exact" },
    )
    .order("game_date", { ascending: true })
    .order("game_pk", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return json({ error: "DB_READ_FAILED", detail: error.message }, 500);

  return json({
    contract: CONTRACT,
    researchOnly: true,
    sourceTable: "public.mlb_totals_revisit_dev_rows_v1",
    historicalMaxGameDate: "2026-09-18",
    returned: data?.length ?? 0,
    totalRows: count ?? null,
    offset,
    limit,
    rows: data ?? [],
    externalForwardIncluded: false,
    providerCallsMade: 0,
    oddsApiHistoricalCreditsConsumed: 0,
    officialPicksWrites: 0,
    apostarActivation: false,
    productionPromotion: false,
  });
});
