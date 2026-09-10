import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CategoryPill } from '../common/CategoryPill'
import { ProgressBar } from '../charts/ProgressBar'
import { TimelineHealthBadge } from '../charts/TimelineHealthBadge'
import type { InitiativeSummary, InitiativeType } from '../../types/api'

function detailPath(type: InitiativeType, id: number): string {
  switch (type) {
    case 'KBI':
      return `/kbis/${id}`
    case 'PLATFORM':
      return `/platform-initiatives/${id}`
    case 'RECURRING_OPS':
      return `/recurring-ops/${id}`
  }
}

export function InitiativeTable({
  title,
  rows,
  emptyMessage,
  emptyAction,
}: {
  title: string
  rows: InitiativeSummary[]
  emptyMessage?: string
  emptyAction?: ReactNode
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="text-muted">
          {emptyMessage ?? 'Nothing here yet.'}
          {emptyAction && <> {emptyAction}</>}
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ask</th>
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
                  <td>
                    <div className="cell-primary">
                      <Link className="cell-title" to={detailPath(row.type, row.id)}>{row.title}</Link>
                      <CategoryPill type={row.type} detail={row.category_name} />
                      {row.type === 'KBI' && row.funded !== null && (
                        <span className={`badge badge-inline ${row.funded ? 'badge-green' : 'badge-gray'}`}>
                          {row.funded ? 'Funded' : 'Unfunded'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{row.status}</td>
                  <td>
                    <ProgressBar pct={row.completion_pct} behind={row.timeline_health === 'BEHIND'} />
                  </td>
                  <td>
                    <TimelineHealthBadge health={row.timeline_health} />
                  </td>
                  <td>{row.expected_delivery_date ?? '—'}</td>
                  <td className="num">{row.total_hours_logged.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
