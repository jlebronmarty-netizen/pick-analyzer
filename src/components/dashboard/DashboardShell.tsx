import type { ReactNode } from 'react'
import { Activity, FlaskConical, Home, Trophy } from 'lucide-react'
import DashboardShellClient from '@/components/dashboard/DashboardShellClient'
import {
  buildPick2MlbValueBoardNavigation,
  PICK2_MLB_VALUE_BOARD_HREF,
} from '@/config/pick2-mlb-value-board-navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'

const productNavItems = [
  { href: '/today', label: 'Today', icon: Home },
  { href: '/mlb', label: 'MLB', icon: Activity },
  { href: '/performance', label: 'Performance', icon: Trophy },
  { href: '/model-lab', label: 'Model Lab', icon: FlaskConical },
  { href: '/data-health', label: 'Data Health', icon: Activity },
]

const titleByPath: Record<string, string> = {
  '/today': 'Today',
  '/mlb': 'MLB Decision Board',
  '/performance': 'Performance',
  '/model-lab': 'Model Lab',
  '/data-health': 'Data Health',
}

export default async function DashboardShell({ children }: { children: ReactNode }) {
  const pick2Navigation = await buildPick2MlbValueBoardNavigation(supabaseAdmin)
  const dynamicProductNavItems = pick2Navigation.visible
    ? [
        ...productNavItems,
        {
          href: pick2Navigation.href,
          label: pick2Navigation.label,
          icon: Activity,
        },
      ]
    : productNavItems

  const dynamicTitleByPath = pick2Navigation.visible
    ? {
        ...titleByPath,
        [PICK2_MLB_VALUE_BOARD_HREF]: pick2Navigation.label,
      }
    : titleByPath

  return (
    <DashboardShellClient
      productNavItems={dynamicProductNavItems}
      titleByPath={dynamicTitleByPath}
    >
      {children}
    </DashboardShellClient>
  )
}
