import { z } from "zod";
const stamp = z.string().refine(s => Number.isFinite(Date.parse(s)));
const number = z.number().finite();
const probability = number.gt(0).lt(1);
const odds = number.int().refine(n => Math.abs(n) >= 100);
const count = number.int().nonnegative();
const text = z.string().min(1);
const settlement = z.object({ outcome: z.enum(["WIN","LOSS","PUSH","VOID"]), profitUnits: number, result: text.nullable(), settledAt: stamp });
const pick = z.object({ id: text, eventId: text, eventName: text, scheduledAt: stamp, createdAt: stamp,
  direction: text, odds, modelProbability: probability, edgePp: number.nullable(), tier: text, quality: text,
  classification: z.literal("MODEL_ONLY"), status: z.enum(["ACTIVE","SETTLED","VOID","CANCELLED"]), locked: z.boolean(),
  sportsbook: text.nullable(), model: text.nullable(), settlement: settlement.nullable() });
const forecast = z.object({ id: text, eventId: text, eventName: text, scheduledAt: stamp, capturedAt: stamp,
  away: text, home: text, awayProbability: probability, homeProbability: probability, awayOdds: odds, homeOdds: odds,
  awayEdgePp: number, homeEdgePp: number, model: z.literal("DRATINGS_PUBLIC_V1"), sportsbook: z.literal("CIRCA") });
const schema = z.object({ schema: z.literal("NHL_READ_BRIDGE_V1"), status: z.literal("AVAILABLE"), sport: z.literal("NHL"),
  classification: z.literal("MODEL_ONLY"), source: z.literal("SPORTS_EDGE_HUB"), readAt: stamp, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  health: z.object({status:z.enum(["PASS","ATTENTION","UNAVAILABLE"]),issues:z.array(text),latestRunAt:stamp.nullable(),runStatus:text.nullable(),coverage:count.nullable(),eligible:count.nullable()}),
  summary: z.object({settled:count,wins:count,losses:count,pushes:count,voids:count,pending:count,accuracyPct:number.min(0).max(100).nullable(),profitUnits:number.nullable(),roiPct:number.nullable(),staked:count}),
  games:z.array(z.object({eventId:text,eventName:text,scheduledAt:stamp,status:text,home:text,away:text})).max(256).optional(),
  forecasts: z.array(forecast).max(256), history: z.array(pick).max(10000), providerCalls:z.literal(0),databaseWrites:z.literal(0),warning:text });
export type NhlAvailableReport = z.infer<typeof schema>;
export type NhlReport = NhlAvailableReport | {status:"UNAVAILABLE";readAt:string;warning:string};
export function unavailableNhlReport(): NhlReport {
  return {status:"UNAVAILABLE",readAt:new Date().toISOString(),warning:"NHL no está disponible o su registro no pasó la verificación. No se sustituyen resultados ni predicciones."};
}
export function parseNhlReport(input: unknown, now = new Date()): NhlAvailableReport {
  const r=schema.parse(input), ids=new Set<string>(), events=new Set<string>();
  if (now.getTime()-Date.parse(r.readAt)>300000 || Date.parse(r.readAt)>now.getTime()+5000) throw Error("STALE_EXPORT");
  if (r.date !== new Intl.DateTimeFormat("en-CA",{timeZone:"America/Puerto_Rico",year:"numeric",month:"2-digit",day:"2-digit"}).format(now)) throw Error("WRONG_SPORTS_DATE");
  const wins=r.history.filter(p=>p.settlement?.outcome==="WIN").length,losses=r.history.filter(p=>p.settlement?.outcome==="LOSS").length;
  const pushes=r.history.filter(p=>p.settlement?.outcome==="PUSH").length,voids=r.history.filter(p=>p.settlement?.outcome==="VOID").length;
  const pending=r.history.filter(p=>!p.settlement&&p.status==="ACTIVE").length;
  const staked=r.history.filter(p=>p.settlement&&p.settlement.outcome!=="VOID");
  const profit=staked.length?staked.reduce((s,p)=>s+p.settlement!.profitUnits,0):null;
  const expected={wins,losses,pushes,voids,pending,settled:wins+losses+pushes+voids,staked:staked.length,
    accuracyPct:wins+losses?wins/(wins+losses)*100:null,profitUnits:profit,roiPct:profit===null?null:profit/staked.length*100};
  for(const [key,value] of Object.entries(expected)){const actual=r.summary[key as keyof typeof r.summary];if(value===null?actual!==null:actual===null||Math.abs(value-actual)>1e-8)throw Error("INCONSISTENT_METRICS");}
  for(const p of r.history){
    if(ids.has(p.id)||events.has(p.eventId)||Date.parse(p.createdAt)>=Date.parse(p.scheduledAt)||Date.parse(p.createdAt)>now.getTime()+5000||(!p.settlement&&["SETTLED","VOID"].includes(p.status))||(p.settlement&&!["SETTLED","VOID"].includes(p.status)))throw Error("INVALID_HISTORY");
    ids.add(p.id);events.add(p.eventId);
  }
  events.clear();for(const f of r.forecasts){if(events.has(f.eventId)||Date.parse(f.capturedAt)>=Date.parse(f.scheduledAt)||Date.parse(f.capturedAt)>now.getTime()+5000||Math.abs(f.awayProbability+f.homeProbability-1)>0.002)throw Error("INVALID_FORECAST");events.add(f.eventId);}
  if(r.games){events.clear();for(const g of r.games){const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(g.scheduledAt));if(events.has(g.eventId)||date!==r.date)throw Error('INVALID_CALENDAR');events.add(g.eventId);}for(const f of r.forecasts){const g=r.games.find(g=>g.eventId===f.eventId);if(!g||g.scheduledAt!==f.scheduledAt||g.home!==f.home||g.away!==f.away)throw Error('INVALID_CALENDAR_FORECAST');}}
  return r;
}
