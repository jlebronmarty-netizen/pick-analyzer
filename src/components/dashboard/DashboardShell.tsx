import { ReactNode } from 'react'
import DashboardShellClient, { DashboardNavItem, DashboardTitleByPath } from '@/components/dashboard/DashboardShellClient'
import {
  PICK2_MLB_VALUE_BOARD_NAVIGATION_ICON,
  PICK2_MLB_VALUE_BOARD_NAVIGATION_LABEL,
  PICK2_MLB_VALUE_BOARD_ROUTE,
} from '@/config/pick2-value-board-navigation'

const baseProductNavItems: DashboardNavItem[] = [
  { href: '/today', label: 'Deportes', icon: 'D' },
  { href: '/mlb', label: 'Laboratorio MLB', icon: 'B' },
  { href: '/qualified-plays', label: 'Jugadas calificadas', icon: 'Q' },
  { href: '/model-lab', label: 'Laboratorio de modelos', icon: 'M' },
  { href: '/performance', label: 'Rendimiento', icon: 'R' },
  { href: '/data-health', label: 'Estado de datos', icon: 'D' },
]

const titleByPath: DashboardTitleByPath = {
  '/': 'Deportes',
  '/today': 'Deportes',
  '/mlb': 'Laboratorio MLB',
  [PICK2_MLB_VALUE_BOARD_ROUTE]: 'Valor / Edge',
  '/qualified-plays': 'Jugadas calificadas',
  '/performance': 'Rendimiento',
  '/model-lab': 'Laboratorio de modelos',
  '/data-health': 'Estado de datos',
  '/nba': 'NBA · Decision Board',
  '/nba-decision-board': 'NBA · Decision Board',
  '/nba-market-data': 'NBA · Archivo GOAT',
  '/edge-lab': 'Edge Lab',
  '/nhl': 'NHL',
  '/ncaab': 'NCAAB',
  '/ufc': 'UFC',
  '/soccer': 'Fútbol',
  '/table-tennis': 'Tenis de mesa',
  '/ncaaf': 'NCAAF',
  '/sports': 'Estado',
  '/settings': 'Configuración',
}

function getProductNavItems(): DashboardNavItem[] {

  return [
    baseProductNavItems[0],
    {
      href: PICK2_MLB_VALUE_BOARD_ROUTE,
      label: 'Valor / Edge',
      icon: PICK2_MLB_VALUE_BOARD_NAVIGATION_ICON,
    },
    ...baseProductNavItems.slice(1),
  ]
}

export default function DashboardShell({
  children,
}: {
  children: ReactNode
}) {
  return (
    <DashboardShellClient
      productNavItems={getProductNavItems()}
      titleByPath={titleByPath}
    >
      {children}
    </DashboardShellClient>
  )
}
