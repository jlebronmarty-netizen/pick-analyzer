import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
// New prospective ledger is separate from the unrecovered Hub history.
export default function TableTennisPage(){redirect('/edge-lab?sport=TT');}
