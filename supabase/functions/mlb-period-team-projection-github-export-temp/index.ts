import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(
  JSON.stringify({
    status: "GONE",
    reason: "Period/team projection CatBoost V1 exporter closed after bounded research run",
    providerCallsMade: 0,
    oddsApiHistoricalCreditsConsumed: 0,
    officialPicksWrites: 0,
    apostarActivation: false,
    productionPromotion: false
  }),
  {
    status: 410,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  }
));
