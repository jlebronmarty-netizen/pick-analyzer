// Pure routing policy: no provider or database operations.
const exact=new Set(['/','/today','/mlb-value-board','/data-health','/performance','/nba-market-data','/nba','/nhl','/table-tennis','/soccer','/ncaab','/sports','/edge-lab']);
export function isReadOnlySportRoute(path){return typeof path==='string'&&(exact.has(path)||path==='/sports-center'||path.startsWith('/sports-center/'));}
