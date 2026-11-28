import { allowed, archive, detail, ranking } from "../archive";
import { markets, windows } from "../evidence.mjs";
import {
  validateNcaabManualDate,
  ncaabManualDate,
} from "@/services/ncaab-manual-data.service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req) {
  if (!allowed(req.headers)) return new Response(null, { status: 404 });
  const p = Object.fromEntries(new URL(req.url).searchParams);
  const now = Date.now(),
    ms = Date.parse(p.cut);
  try {
    validateNcaabManualDate(p.date);
  } catch {
    return new Response(null, { status: 400 });
  }
  const fixed = p.cut === p.date + "T17:00:00.000Z";
  if (
    !Number.isFinite(ms) ||
    ms > now ||
    ncaabManualDate(p.cut) !== p.date ||
    (!fixed && (ms % 180000 !== 0 || now - ms > 3600000))
  )
    return new Response(null, { status: 400 });
  if (
    !p.id &&
    (!Object.hasOwn(windows, p.window) ||
      !Object.hasOwn(markets, p.market) ||
      !["FT", "1", "2", "OT"].includes(p.period))
  )
    return new Response(null, { status: 400 });
  try {
    const data = await archive(p.date, p.cut);
    const body = p.id
      ? detail(data, p.id)
      : Object.fromEntries(
          ["standard", "heavy"].map((band) => [
            band,
            ranking(data, { ...p, band }),
          ]),
        );
    return Response.json(body, {
      status: body ? 200 : 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
