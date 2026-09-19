import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(
  JSON.stringify({
    status:"GONE",
    reason:"Pitcher Win forward-compatible training exporter closed after frozen numeric model certification"
  }),
  {
    status:410,
    headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
  }
));
