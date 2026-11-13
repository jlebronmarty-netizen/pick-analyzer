import Link from 'next/link'

const sports = [
  ['/today', 'MLB'],
  ['/nba-market-data', 'NBA'],
  ['/nba-learning', 'NBA Learning'],
  ['/nhl', 'NHL'],
  ['/nhl-learning', 'NHL Learning'],
  ['/ufc', 'UFC'],
  ['/table-tennis', 'Tenis de mesa'],
  ['/soccer', 'Fútbol'],
  ['/ncaab', 'NCAAB'],
  ['/ncaab-learning', 'NCAAB Learning'],
  ['/ncaaf', 'NCAAF'],
  ['/ncaaf-learning', 'NCAAF Learning'],
  ['/sports-shadow/nfl', 'NFL'],
  ['/sports-shadow/bsn', 'BSN'],
  ['/sports-shadow/tennis', 'Tenis'],
  ['/edge-lab', 'Edge Lab'],
  ['/sports', 'Estado'],
]

export default function SportNavigation() {
  return (
    <nav
      aria-label="Deportes"
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: '10px 16px',
        background: '#0f172a',
        borderBottom: '1px solid #334155',
      }}
    >
      {sports.map(([href, label]) => (
        <Link
          prefetch={false}
          key={href}
          href={href}
          style={{
            whiteSpace: 'nowrap',
            padding: '8px 12px',
            border: '1px solid #475569',
            borderRadius: 8,
            color: '#a5f3fc',
          }}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
