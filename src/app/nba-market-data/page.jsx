import {notFound,redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {enabled} from '../../lib/nba-production-feed.mjs';
import Board from './board';
export const dynamic='force-dynamic';
export default async function Page(){
 if(!enabled(process.env))notFound();
 if(process.env.VERCEL_ENV==='production'){
  const host=process.env.VERCEL_URL;
  if(!host||!/^[a-z0-9-]+\.vercel\.app$/.test(host))notFound();
  if((await headers()).get('host')!==host)redirect(`https://${host}/nba-market-data`);
 }
 return <Board/>;
}
