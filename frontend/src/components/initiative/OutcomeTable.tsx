import { Link } from 'react-router-dom'
import { CategoryPill } from '../common/CategoryPill'
import { TimelineHealthBadge } from '../charts/TimelineHealthBadge'
import type { InitiativeType, TaskSummary } from '../../types/api'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

function askPath(type: InitiativeType, id: number): string {
  switch (type) {
    case 'KBI':
      return `/kbis/${id}`
    case 'PLATFORM':
      return `/platform-initiatives/${id}`
    case 'RECURRING_OPS':
      return `/recurring-ops/${id}`
  }
}

export function OutcomeTable({
  title,
  rows,
  emptyMessage,
}: {
  title: string
  rows: TaskSummary[]
  emptyMessage?: string
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="text-muted">{emptyMessage ?? 'Nothing here yet.'}</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Outcome</th>
                <th>Ask</th>
                <th>Sprint</th>
                <th>Assignee</th>
                <th>Status</th>
                <th>Timeline</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>
                    <div className="cell-primary">
                      <Link className="cell-title" to={askPath(row.initiative_type, row.initiative_id)}>
                        {row.initiative_title}
                      </Link>
                      <CategoryPill type={row.initiative_type} />
                    </div>
                  </td>
                  <td>{row.sprint_number ? `S${row.sprint_number}` : '—'}</td>
                  <td>
                    {row.owner_engineer_name ? (
                      <span className="assignee-list">
                        <span className="assignee-avatar" title={row.owner_engineer_name}>
                          {initials(row.owner_engineer_name)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted">Unclaimed</span>
                    )}
                  </td>
                  <td>{row.status}</td>
                  <td>
                    <TimelineHealthBadge health={row.initiative_timeline_health} />
                  </td>
                  <td className="num">{row.actual_hours_logged.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
