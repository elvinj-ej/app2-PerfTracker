import type { NavIconName } from './NavIcon'

export interface NavItem {
  to: string
  label: string
  icon: NavIconName
  end?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'My Dashboard', icon: 'dashboard', end: true },
      { to: '/marketplace', label: 'Marketplace', icon: 'marketplace' },
      { to: '/team', label: 'Team Summary', icon: 'team' },
      { to: '/reports/monthly', label: 'Monthly Report', icon: 'report' },
    ],
  },
  {
    label: 'Catalogs',
    items: [
      { to: '/kbis', label: 'Change Business', icon: 'business' },
      { to: '/platform-initiatives', label: 'Change Platform', icon: 'platform' },
      { to: '/recurring-ops', label: 'Run Operations', icon: 'ops' },
    ],
  },
  {
    label: 'Time Tracking',
    items: [{ to: '/log-time', label: 'Log Time', icon: 'time' }],
  },
]

export const MANAGER_NAV_GROUP: NavGroup = {
  label: 'Manager Tools',
  items: [
    { to: '/import', label: 'Import from Jira', icon: 'import' },
    { to: '/import/ask-catalog', label: 'Upload Marketplace', icon: 'upload' },
  ],
}

const ALL_ITEMS = [...NAV_GROUPS, MANAGER_NAV_GROUP].flatMap((g) => g.items)

/** Longest-prefix match against the flat nav list, so a detail route like
 * "/kbis/12" still resolves to its catalog's label for the topbar breadcrumb. */
export function findNavLabel(pathname: string): string | null {
  const candidates = ALL_ITEMS.filter((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
  if (candidates.length === 0) return null
  return candidates.reduce((longest, item) => (item.to.length > longest.to.length ? item : longest)).label
}
