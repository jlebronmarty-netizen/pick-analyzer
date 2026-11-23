import Link from 'next/link'
import { PICK_SPORTS } from './SportDecisionNavigation'

const tools = [
  ['/nba-market-data', 'NBA · Archivo GOAT'],
  ['/nba-learning', 'NBA Learning'],
  ['/nhl-learning', 'NHL Learning'],
  ['/ufc-learning', 'UFC Learning'],
  ['/table-tennis-learning', 'TT Learning'],
  ['/soccer-learning', 'Fútbol Learning'],
  ['/ncaab-learning', 'NCAAB Learning'],
  ['/ncaaf-learning', 'NCAAF Learning'],
  ['/mlb-learning', 'MLB Learning'],
  ['/edge-lab', 'Edge Lab'],
  ['/sports', 'Estado de datos'],
]
const linkStyle = {whiteSpace:'nowrap' as const,padding:'8px 12px',border:'1px solid #475569',borderRadius:8,color:'#a5f3fc'}
export default function SportNavigation() {
 return <header className="border-b border-slate-700 bg-slate-900">
  <nav aria-label="Deportes" className="flex gap-2 overflow-x-auto px-4 py-3">
   <Link prefetch={false} href="/today#deportes" style={linkStyle}>Deportes</Link>
   {PICK_SPORTS.map(sport=><Link prefetch={false} key={sport.id} href={sport.href} style={linkStyle}>{sport.label}</Link>)}
  </nav>
  <details className="px-4 pb-2 text-sm text-slate-300">
   <summary className="w-fit cursor-pointer rounded py-2 focus-visible:outline-2 focus-visible:outline-teal-300">Historial, aprendizaje y estado</summary>
   <nav aria-label="Historial y herramientas por deporte" className="flex flex-wrap gap-2 pb-2">
    {tools.map(([href,label])=><Link prefetch={false} key={href} href={href} style={linkStyle}>{label}</Link>)}
   </nav>
  </details>
 </header>
}
