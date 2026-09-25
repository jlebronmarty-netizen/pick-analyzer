import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response(
  JSON.stringify({
    status:"GONE",
    contract:"MLB_F5_ML_REVISIT_GITHUB_EXPORT/1.0.0",
    researchOnly:true,
    reason:"F5 spread transfer diagnostic completed; temporary exporter closed",
    dataExportEnabled:false
  }),
  {
    status:410,
    headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
  }
));
