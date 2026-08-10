import { ProgressBar } from '../charts/ProgressBar'
import { TimelineHealthBadge } from '../charts/TimelineHealthBadge'
import type { InitiativeSummary } from '../../types/api'

export function InitiativeTable({
  title,
  rows,
  showCategory,
  emptyMessage,
}: {
  title: string
  rows: InitiativeSummary[]
  showCategory?: boolean
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
                <th>Ask</th>
                {showCategory && <th>Category</th>}
                <th>Status</th>
                <th>Completion</th>
                <th>Timeline</th>
                <th>Delivery Date</th>
                <th>Hours Logged</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  {showCategory && <td>{row.category_name ?? '—'}</td>}
                  <td>{row.status}</td>
                  <td>
                    <ProgressBar pct={row.completion_pct} />
                  </td>
                  <td>
                    <TimelineHealthBadge health={row.timeline_health} />
                  </td>
                  <td>{row.expected_delivery_date ?? '—'}</td>
                  <td>{row.total_hours_logged.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
