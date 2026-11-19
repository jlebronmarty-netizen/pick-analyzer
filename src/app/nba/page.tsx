import {redirect} from 'next/navigation'
export default function Page(){
 if(process.env.VERCEL_ENV==='production'&&process.env.NBA_DECISION_BOARD_ENABLED==='true')redirect('/nba-decision-board');
 redirect('/nba-market-data');
}
