import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(
  JSON.stringify({
    status:"GONE",
    reason:"F3 3-Way revisit V1 temporary endpoint closed after bounded second-pass research run"
  }),
  {
    status:410,
    headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
  }
));
