import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(
  JSON.stringify({status:"GONE",reason:"Pitcher Win Sep18 forward-history backfill completed"}),
  {status:410,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}}
));
