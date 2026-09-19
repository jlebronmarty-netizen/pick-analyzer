import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(
  JSON.stringify({
    status:"GONE",
    reason:"Pitcher Record Win revisit V1 exporter closed after frozen historical research run"
  }),
  {
    status:410,
    headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
  }
));
