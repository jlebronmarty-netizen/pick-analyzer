import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(
  JSON.stringify({
    status:"GONE",
    reason:"Pitcher Win forward-compatible research exporter closed after frozen numeric model and JSON parity certification"
  }),
  {
    status:410,
    headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
  }
));
