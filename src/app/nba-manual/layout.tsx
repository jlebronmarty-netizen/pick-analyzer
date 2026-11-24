import type {ReactNode} from 'react';
import {headers} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:ReactNode}){
 const env=process.env;
 if(env.VERCEL_ENV==='production'){
 if(env.NBA_DECISION_BOARD_ENABLED!=='true'||!env.VERCEL_URL||!/^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL))notFound();
 if((await headers()).get('host')!==env.VERCEL_URL)redirect('https://'+env.VERCEL_URL+'/nba-manual');
 }else if(env.VERCEL_ENV!=='preview')notFound();
 if(!(await headers()).get('x-vercel-oidc-token'))notFound();
 return children;
}
