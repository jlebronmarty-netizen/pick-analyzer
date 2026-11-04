import {headers} from 'next/headers';import {notFound,redirect} from 'next/navigation';import Board from './board';
export const dynamic='force-dynamic';
export default async function Page({searchParams}){const params=await searchParams;const sport=['SOCCER','TT','MLB','NCAAF'].includes(params?.sport)?params.sport:'SOCCER';
 if(process.env.VERCEL_ENV==='production'){const host=process.env.VERCEL_URL;if(!host||!/^[a-z0-9-]+\.vercel\.app$/.test(host))notFound();if((await headers()).get('host')!==host)redirect(`https://${host}/edge-lab?sport=${sport}`);}
 return <Board initialSport={sport}/>;
}
