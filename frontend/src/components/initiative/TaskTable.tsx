import type { TaskSummary } from '../../types/api'

export function TaskTable({ tasks }: { tasks: TaskSummary[] }) {
  return (
    <section className="card">
      <h2>My Outcomes</h2>
      {tasks.length === 0 ? (
        <p className="text-muted">No outcomes assigned yet.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Outcome</th>
                <th>Initiative</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Forecast (days)</th>
                <th>Actual Hours</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>{task.initiative_title}</td>
                  <td>{task.stage ?? '—'}</td>
                  <td>{task.status}</td>
                  <td>{task.forecast_duration_days ?? '—'}</td>
                  <td>{task.actual_hours_logged.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
