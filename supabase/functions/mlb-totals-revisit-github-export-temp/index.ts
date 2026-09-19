import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(
  JSON.stringify({
    status: "GONE",
    reason: "Totals revisit V1 historical exporter closed after bounded research run"
  }),
  {
    status: 410,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  }
));
