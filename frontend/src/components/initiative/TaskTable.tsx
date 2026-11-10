import { Fragment, useState, type ReactNode } from 'react'
import type { TaskSummary } from '../../types/api'

export function TaskTable({
  tasks,
  title = 'My Outcomes',
  emptyAction,
}: {
  tasks: TaskSummary[]
  title?: string
  emptyAction?: ReactNode
}) {
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set())

  function toggleExpanded(taskId: number) {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  return (
    <section className="card">
      <h2>{title}</h2>
      {tasks.length === 0 ? (
        <p className="text-muted">
          No outcomes assigned yet.
          {emptyAction && <> {emptyAction}</>}
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Outcome</th>
                <th>Initiative</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Forecast (days)</th>
                <th>Actual Hours</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const expanded = expandedTaskIds.has(task.id)
                return (
                  <Fragment key={task.id}>
                    <tr>
                      <td>
                        <button
                          className="btn-icon"
                          aria-label={expanded ? `Hide details for ${task.title}` : `Show details for ${task.title}`}
                          onClick={() => toggleExpanded(task.id)}
                        >
                          {expanded ? '▾' : '▸'}
                        </button>
                      </td>
                      <td>{task.title}</td>
                      <td>{task.initiative_title}</td>
                      <td>{task.stage ?? '—'}</td>
                      <td>{task.status}</td>
                      <td>{task.forecast_duration_days ?? '—'}</td>
                      <td>{task.actual_hours_logged.toFixed(1)}</td>
                    </tr>
                    {expanded && (
                      <tr className="outcome-detail-row">
                        <td colSpan={7}>
                          <span className="outcome-detail-label">Details</span>
                          <p className="outcome-detail-text text-muted">
                            {task.description || 'No details added for this Outcome.'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
