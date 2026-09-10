import { useQuery } from '@tanstack/react-query'
import { useState, type CSSProperties } from 'react'
import { getTeamSummary } from '../api/reports'
import { getSprints } from '../api/sprints'
import { Alert } from '../components/common/Alert'
import { KpiTile } from '../components/common/KpiTile'
import { CategoryHoursBarChart } from '../components/charts/CategoryHoursBarChart'
import { CATEGORY_META } from '../components/charts/categoryMeta'
import { EngineerHoursStackedBarChart } from '../components/charts/EngineerHoursStackedBarChart'
import { ProgressBar } from '../components/charts/ProgressBar'
import { SprintTrendChart } from '../components/charts/SprintTrendChart'
import { OutcomeTable } from '../components/initiative/OutcomeTable'
import { useActor } from '../context/ActorContext'
import type { TaskSummary } from '../types/api'

type StatusFilter = 'not_started' | 'in_progress' | 'completed' | 'active' | null
type ViewTab = 'sprint' | 'fy' | 'trend'

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

  const [tab, setTab] = useState<ViewTab>('sprint')
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

  const fyHoursByType = data
    ? Object.fromEntries(data.hours_by_category_fy.map((c) => [c.initiative_type, c.hours]))
    : {}
  const fyTotalHours = data ? data.hours_by_category_fy.reduce((s, c) => s + c.hours, 0) : 0
  const completionByType = data
    ? Object.fromEntries(data.completion_by_type.map((c) => [c.initiative_type, c]))
    : {}

  const trend = data?.sprint_trend ?? []
  const currentTrendPoint = trend[trend.length - 1]
  const priorTrendPoints = trend.slice(0, -1)
  const avgOutcomes = priorTrendPoints.length
    ? priorTrendPoints.reduce((s, p) => s + p.outcomes_completed, 0) / priorTrendPoints.length
    : 0
  const avgHours = priorTrendPoints.length
    ? priorTrendPoints.reduce((s, p) => s + p.hours_logged, 0) / priorTrendPoints.length
    : 0

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
          <div className="view-tabs">
            <button type="button" className={`view-tab ${tab === 'sprint' ? 'view-tab-active' : ''}`} onClick={() => setTab('sprint')}>
              This Sprint
            </button>
            <button type="button" className={`view-tab ${tab === 'fy' ? 'view-tab-active' : ''}`} onClick={() => setTab('fy')}>
              This FY
            </button>
            <button type="button" className={`view-tab ${tab === 'trend' ? 'view-tab-active' : ''}`} onClick={() => setTab('trend')}>
              Sprint Trend
            </button>
          </div>

          {tab === 'sprint' && (
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

          {tab === 'fy' && (
            <>
              <div className="kpi-grid">
                <KpiTile label="Hours logged this FY" value={fyTotalHours.toFixed(1)} unit={data.fiscal_year_label}>
                  <div className="kpi-split">
                    <span style={{ flex: fyHoursByType['KBI'] || 0.0001, background: 'var(--series-kbi)' }} />
                    <span style={{ flex: fyHoursByType['PLATFORM'] || 0.0001, background: 'var(--series-platform)' }} />
                    <span style={{ flex: fyHoursByType['RECURRING_OPS'] || 0.0001, background: 'var(--series-recurring)' }} />
                  </div>
                </KpiTile>

                {CATEGORY_META.map((meta) => {
                  const c = completionByType[meta.type]
                  const completed = c?.outcomes_completed ?? 0
                  const total = c?.outcomes_total ?? 0
                  const pct = total > 0 ? (completed / total) * 100 : 0
                  return (
                    <KpiTile key={meta.type} label={`${meta.label} completion`} value={`${Math.round(pct)}%`} unit={`${completed} of ${total} Outcomes`}>
                      <ProgressBar pct={pct} />
                    </KpiTile>
                  )
                })}
              </div>
              <p className="text-muted">
                Outcome completion is tracked across the full sprint calendar (S1 through the current sprint), which
                spans this fiscal year.
              </p>
            </>
          )}

          {tab === 'trend' && (
            <>
              <div className="kpi-grid">
                <KpiTile label="This sprint's velocity" value={currentTrendPoint?.outcomes_completed ?? 0} unit="Outcomes completed">
                  <span className="kpi-foot">avg last {priorTrendPoints.length || 0}: {avgOutcomes.toFixed(1)}</span>
                </KpiTile>
                <KpiTile label="This sprint's hours" value={(currentTrendPoint?.hours_logged ?? 0).toFixed(1)} unit="h logged">
                  <span className="kpi-foot">avg last {priorTrendPoints.length || 0}: {avgHours.toFixed(1)}h</span>
                </KpiTile>
              </div>

              <div className="team-summary-charts">
                <section className="card">
                  <h2>Outcomes Completed per Sprint</h2>
                  <SprintTrendChart
                    points={trend.map((p) => ({ label: p.label, value: p.outcomes_completed }))}
                    color="var(--green)"
                    unit="completed"
                  />
                </section>

                <section className="card">
                  <h2>Hours Logged per Sprint</h2>
                  <SprintTrendChart
                    points={trend.map((p) => ({ label: p.label, value: p.hours_logged }))}
                    color="var(--accent)"
                    unit="hours"
                    formatValue={(v) => v.toFixed(0)}
                  />
                </section>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
