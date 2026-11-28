import { nbaManualAccess } from "../../lib/nba/manual-access.mjs";
export function nhlSheetAccess(headers, env = process.env) {
  const preview = env.VERCEL_ENV === "preview";
  if (
    !preview &&
    (env.VERCEL_ENV !== "production" || env.NHL_CHEAT_SHEETS_ENABLED !== "true")
  )
    return false;
  const hostname = preview ? "preview.vercel.app" : env.VERCEL_URL;
  if (!hostname || !/^[a-z0-9-]+\.vercel\.app$/.test(hostname)) return false;
  // Use the same protected deployment and identity boundary as the private NBA board.
  return !nbaManualAccess(
    new Request("https://" + hostname + "/nhl-cheat-sheets", { headers }),
    env,
  );
}
