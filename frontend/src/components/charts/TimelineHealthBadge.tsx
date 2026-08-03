import type { TimelineHealth } from '../../types/api'

const LABEL: Record<TimelineHealth, string> = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  BEHIND: 'Behind',
  NOT_APPLICABLE: 'N/A',
}

const CLASS: Record<TimelineHealth, string> = {
  ON_TRACK: 'badge badge-green',
  AT_RISK: 'badge badge-amber',
  BEHIND: 'badge badge-red',
  NOT_APPLICABLE: 'badge badge-gray',
}

export function TimelineHealthBadge({ health }: { health: TimelineHealth }) {
  return <span className={CLASS[health]}>{LABEL[health]}</span>
}
