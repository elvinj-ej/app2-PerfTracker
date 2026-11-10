import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ProgressBar } from '../charts/ProgressBar'
import { TimelineHealthBadge } from '../charts/TimelineHealthBadge'
import { CATEGORY_META } from '../charts/categoryMeta'
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

function AskGroup({ type, label, varName, rows }: { type: InitiativeType; label: string; varName: string; rows: InitiativeSummary[] }) {
  const onTrack = rows.filter((r) => r.timeline_health === 'ON_TRACK').length
  const atRisk = rows.filter((r) => r.timeline_health === 'AT_RISK').length
  const behind = rows.filter((r) => r.timeline_health === 'BEHIND').length
  const totalHours = rows.reduce((sum, r) => sum + r.total_hours_logged, 0)

  return (
    <details className="ask-group" key={type}>
      <summary className="ask-group-summary">
        <span className="ask-group-caret" aria-hidden="true">▸</span>
        <span className="ask-group-dot" style={{ background: `var(${varName})` }} />
        <span className="ask-group-label">{label}</span>
        <span className="badge badge-gray badge-inline">{rows.length} Ask{rows.length === 1 ? '' : 's'}</span>
        <div className="ask-group-health">
          <div className="kpi-split">
            <span style={{ flex: onTrack || 0.0001, background: 'var(--green)' }} />
            <span style={{ flex: atRisk || 0.0001, background: 'var(--amber)' }} />
            <span style={{ flex: behind || 0.0001, background: 'var(--red)' }} />
          </div>
          <span className="text-muted ask-group-health-text">
            {onTrack} on track · {atRisk} at risk · {behind} behind
          </span>
        </div>
        <span className="ask-group-hours text-muted">{totalHours.toFixed(1)}h logged</span>
      </summary>

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
                    {row.category_name && <span className="text-muted ask-group-category">{row.category_name}</span>}
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
    </details>
  )
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
    <section className="card ask-group-card">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="text-muted">
          {emptyMessage ?? 'Nothing here yet.'}
          {emptyAction && <> {emptyAction}</>}
        </p>
      ) : (
        CATEGORY_META.map((meta) => {
          const groupRows = rows.filter((r) => r.type === meta.type)
          if (groupRows.length === 0) return null
          return <AskGroup key={meta.type} type={meta.type} label={meta.label} varName={meta.varName} rows={groupRows} />
        })
      )}
    </section>
  )
}
