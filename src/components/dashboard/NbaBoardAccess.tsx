import Link from 'next/link';

export default function NbaBoardAccess(){
 return <div className="mt-4 space-y-2">
  <Link href="/nba-decision-board" prefetch={false}
   className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-teal-300 bg-teal-400 px-4 py-3 text-center text-sm font-bold text-slate-950 hover:bg-teal-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300 sm:w-auto">
   Abrir Decision Board NBA
  </Link>
  <Link href="/nba-cheat-sheets" prefetch={false} className="ml-2 inline-flex min-h-11 items-center rounded-lg border border-teal-300 px-4 text-sm font-bold text-teal-200">Cheat Sheets NBA</Link>
  <p className="text-xs leading-5 text-slate-400">Top 25 · Moneyline · Spread · Total · Player Props · Cuartos / Mitades</p>
 </div>;
}

