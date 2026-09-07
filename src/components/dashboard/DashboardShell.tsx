import { ReactNode } from 'react'
import DashboardShellClient, { DashboardNavItem, DashboardTitleByPath } from '@/components/dashboard/DashboardShellClient'
import {
  PICK2_MLB_VALUE_BOARD_NAVIGATION_ICON,
  PICK2_MLB_VALUE_BOARD_NAVIGATION_LABEL,
  PICK2_MLB_VALUE_BOARD_ROUTE,
  isPick2MlbValueBoardNavigationEnabled,
} from '@/config/pick2-value-board-navigation'

const baseProductNavItems: DashboardNavItem[] = [
  { href: '/today', label: 'Today', icon: 'T' },
  { href: '/mlb', label: 'MLB', icon: 'B' },
  { href: '/performance', label: 'Performance', icon: 'P' },
  { href: '/model-lab', label: 'Model Lab', icon: 'M' },
  { href: '/data-health', label: 'Data Health', icon: 'D' },
]

const titleByPath: DashboardTitleByPath = {
  '/': 'Today',
  '/today': 'Today',
  '/mlb': 'MLB Decision Board',
  [PICK2_MLB_VALUE_BOARD_ROUTE]: PICK2_MLB_VALUE_BOARD_NAVIGATION_LABEL,
  '/performance': 'Performance',
  '/model-lab': 'Model Lab',
  '/data-health': 'Data Health',
}

function getProductNavItems(): DashboardNavItem[] {
  if (!isPick2MlbValueBoardNavigationEnabled()) return baseProductNavItems

  return [
    baseProductNavItems[0],
    baseProductNavItems[1],
    {
      href: PICK2_MLB_VALUE_BOARD_ROUTE,
      label: PICK2_MLB_VALUE_BOARD_NAVIGATION_LABEL,
      icon: PICK2_MLB_VALUE_BOARD_NAVIGATION_ICON,
    },
    ...baseProductNavItems.slice(2),
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
