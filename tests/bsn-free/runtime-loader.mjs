import {resolve as baseResolve,load as baseLoad} from '../dashboard-multisport/tsx-loader.mjs';
export async function resolve(specifier,context,next){
 if(specifier==='../lib/supabase-admin')return {url:'data:text/javascript,export const supabaseAdmin=globalThis.__bsnDb',shortCircuit:true};
 return baseResolve(specifier,context,next);
}
export const load=baseLoad;
