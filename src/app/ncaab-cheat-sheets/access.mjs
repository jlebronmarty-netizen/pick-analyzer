import { nbaManualAccess } from "../../lib/nba/manual-access.mjs";
export function allowed(headers,env=process.env) {
  const preview=env.VERCEL_ENV==="preview";
  if(!preview && (env.VERCEL_ENV!=="production" || env.NCAAB_CHEAT_SHEETS_ENABLED!=="true"))return false;
  const host=preview?"preview.vercel.app":env.VERCEL_URL;
  if(!host || !/^[a-z0-9-]+\.vercel\.app$/.test(host))return false;
  return !nbaManualAccess(new Request("https://"+host,{headers}),{...env,NBA_DECISION_BOARD_ENABLED:"true"});
}
