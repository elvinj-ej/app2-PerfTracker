import { useQuery } from '@tanstack/react-query'
import { useState, type CSSProperties } from 'react'
import { getTeamSummary } from '../api/reports'
import { getSprints } from '../api/sprints'
import { Alert } from '../components/common/Alert'
import { KpiTile } from '../components/common/KpiTile'
import { CategoryHoursBarChart } from '../components/charts/CategoryHoursBarChart'
import { EngineerHoursStackedBarChart } from '../components/charts/EngineerHoursStackedBarChart'
import { OutcomeTable } from '../components/initiative/OutcomeTable'
import { useActor } from '../context/ActorContext'
import type { TaskSummary } from '../types/api'

type StatusFilter = 'not_started' | 'in_progress' | 'completed' | 'active' | null

const FILTER_LABEL: Record<Exclude<StatusFilter, null>, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  active: 'Active',
}

function clickableStyle(active: boolean): CSSProperties {
  return {
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    color: 'inherit',
    textDecoration: active ? 'underline' : 'none',
    fontWeight: active ? 700 : undefined,
  }
}

export function TeamSummaryPage() {
  const { actor } = useActor()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['team-summary'],
    queryFn: () => getTeamSummary(actor),
  })
  const { data: sprints } = useQuery({ queryKey: ['sprints'], queryFn: () => getSprints(actor) })
  const currentSprint = sprints?.find((s) => s.is_current)

  const [filter, setFilter] = useState<StatusFilter>(null)

  const tasks: TaskSummary[] = data?.tasks ?? []

  const kbiHours = data?.hours_by_category.find((c) => c.initiative_type === 'KBI')?.hours ?? 0
  const platformHours = data?.hours_by_category.find((c) => c.initiative_type === 'PLATFORM')?.hours ?? 0
  const recurringHours = data?.hours_by_category.find((c) => c.initiative_type === 'RECURRING_OPS')?.hours ?? 0
  const totalHours = kbiHours + platformHours + recurringHours
  const kbiPct = totalHours > 0 ? Math.round((kbiHours / totalHours) * 100) : 0
  const platformPct = totalHours > 0 ? Math.round((platformHours / totalHours) * 100) : 0
  const runPct = totalHours > 0 ? Math.max(0, 100 - kbiPct - platformPct) : 0

  const thisSprintTasks = currentSprint ? tasks.filter((t) => t.sprint_number === currentSprint.number) : []
  const notStartedTasks = thisSprintTasks.filter((t) => t.status === 'NOT_STARTED')
  const inProgressTasks = thisSprintTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'BLOCKED')
  const completedTasks = thisSprintTasks.filter((t) => t.status === 'COMPLETE')
  const activeTasks = thisSprintTasks.filter((t) => t.status === 'IN_PROGRESS')
  const onTrackActive = activeTasks.filter((t) => t.initiative_timeline_health === 'ON_TRACK').length
  const onTrackActivePct = activeTasks.length > 0 ? Math.round((onTrackActive / activeTasks.length) * 100) : 0

  const catMax = data ? Math.max(1, ...data.hours_by_category.map((d) => d.hours)) : 1
  const engMax = data ? Math.max(1, ...data.hours_by_engineer.map((e) => e.total_hours)) : 1

  function toggleFilter(next: Exclude<StatusFilter, null>) {
    setFilter((current) => (current === next ? null : next))
  }

  const FILTER_ROWS: Record<Exclude<StatusFilter, null>, TaskSummary[]> = {
    not_started: notStartedTasks,
    in_progress: inProgressTasks,
    completed: completedTasks,
    active: activeTasks,
  }
  const filteredRows = filter ? FILTER_ROWS[filter] : tasks
  const tableTitle = filter
    ? `${FILTER_LABEL[filter]} Outcomes${currentSprint ? ` — ${currentSprint.label}` : ''}`
    : 'All Outcomes'

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hosting, Platform &amp; Database</h1>
          <p className="page-subtitle">
            Team summary · {data?.hours_by_engineer.length ?? 0} engineers
            {currentSprint ? ` · ${currentSprint.label}` : ''}
          </p>
        </div>
      </div>

      {isLoading && <p>Loading team summary…</p>}
      {isError && <Alert variant="error">Failed to load team summary.</Alert>}

      {data && (
        <>
          <div className="kpi-grid">
            <KpiTile label="Hours logged this sprint" value={totalHours.toFixed(1)} unit="h">
              <div className="kpi-split">
                <span style={{ flex: kbiHours || 0.0001, background: 'var(--series-kbi)' }} />
                <span style={{ flex: platformHours || 0.0001, background: 'var(--series-platform)' }} />
                <span style={{ flex: recurringHours || 0.0001, background: 'var(--series-recurring)' }} />
              </div>
            </KpiTile>

            <KpiTile label="Outcomes this sprint" value={thisSprintTasks.length} unit="scheduled">
              <div className="kpi-foot" style={{ display: 'flex', gap: 10 }}>
                <button type="button" style={clickableStyle(filter === 'not_started')} onClick={() => toggleFilter('not_started')}>
                  {notStartedTasks.length} not started
                </button>
                <button type="button" style={clickableStyle(filter === 'in_progress')} onClick={() => toggleFilter('in_progress')}>
                  {inProgressTasks.length} in progress
                </button>
                <button type="button" style={clickableStyle(filter === 'completed')} onClick={() => toggleFilter('completed')}>
                  {completedTasks.length} completed
                </button>
              </div>
            </KpiTile>

            <KpiTile label="On track" value={`${onTrackActivePct}%`} unit="of active Outcomes">
              <button type="button" className="kpi-foot" style={clickableStyle(filter === 'active')} onClick={() => toggleFilter('active')}>
                {onTrackActive} of {activeTasks.length} active Outcomes on track
              </button>
            </KpiTile>

            <KpiTile label="Change Business / Platform / Run" value={`${kbiPct} / ${platformPct} / ${runPct}`} unit="% of hours" />
          </div>

          <div className="team-summary-charts">
            <section className="card">
              <h2>Hours Logged by Category</h2>
              <CategoryHoursBarChart data={data.hours_by_category} />
              <div className="chart-axis">
                <span>0</span>
                <span>{Math.round(catMax / 4)}h</span>
                <span>{Math.round(catMax / 2)}h</span>
                <span>{Math.round(catMax)}h</span>
              </div>
            </section>

            <section className="card">
              <h2>Hours Logged by Engineer</h2>
              <EngineerHoursStackedBarChart
                rows={data.hours_by_engineer.map((e) => ({ label: e.engineer_name, hoursByType: e.hours_by_type }))}
              />
              <div className="chart-axis">
                <span>0</span>
                <span>{Math.round(engMax / 4)}h</span>
                <span>{Math.round(engMax / 2)}h</span>
                <span>{Math.round(engMax)}h</span>
              </div>
            </section>
          </div>

          {filter && (
            <p className="text-muted">
              Showing: {tableTitle} <button type="button" className="btn-link" onClick={() => setFilter(null)}>✕ clear</button>
            </p>
          )}
          <OutcomeTable title={tableTitle} rows={filteredRows} emptyMessage="No Outcomes match this filter." />
        </>
      )}
    </div>
  )
}
