import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEngineers } from '../api/engineers'
import { getEngineerDashboard, getTeamSummary } from '../api/reports'
import { getSprints } from '../api/sprints'
import { Alert } from '../components/common/Alert'
import { KpiTile } from '../components/common/KpiTile'
import { InitiativeTable } from '../components/initiative/InitiativeTable'
import { TaskTable } from '../components/initiative/TaskTable'
import { useActor } from '../context/ActorContext'
import { MANAGER_NAMES } from '../data/managers'
import { inSprintWindow } from '../data/sprintConstants'
import type { InitiativeSummary, TaskSummary } from '../types/api'

const BROWSE_MARKETPLACE = <Link to="/marketplace">Browse the Marketplace</Link>
const WHOLE_TEAM = 'ALL'

export function EngineerDashboardPage() {
  const { actor } = useActor()
  const { data: engineers } = useQuery({
    queryKey: ['engineers'],
    queryFn: () => listEngineers({ role: 'manager', managerName: MANAGER_NAMES[0] }),
  })
  const { data: sprints } = useQuery({ queryKey: ['sprints'], queryFn: () => getSprints(actor) })
  const currentSprint = sprints?.find((s) => s.is_current)

  const [selection, setSelection] = useState<string | undefined>(
    actor.role === 'engineer' ? String(actor.engineerId) : undefined,
  )

  useEffect(() => {
    if (actor.role === 'engineer') {
      setSelection(String(actor.engineerId))
    } else if (selection === undefined) {
      setSelection(WHOLE_TEAM)
    }
  }, [actor, selection])

  const isTeamMode = actor.role === 'manager' && selection === WHOLE_TEAM
  // Derived straight from the actor (not `selection`) for the engineer case, since
  // `selection` can briefly still hold a stale manager-mode value ('ALL') for one render
  // right after the actor switches roles, before the effect above catches up.
  const selectedEngineerId =
    actor.role === 'engineer' ? actor.engineerId : selection && selection !== WHOLE_TEAM ? Number(selection) : undefined

  const teamQuery = useQuery({
    queryKey: ['team-summary'],
    queryFn: () => getTeamSummary(actor),
    enabled: isTeamMode,
  })
  const engineerQuery = useQuery({
    queryKey: ['engineer-dashboard', selectedEngineerId],
    queryFn: () => getEngineerDashboard(actor, selectedEngineerId as number),
    enabled: selectedEngineerId !== undefined,
  })

  const isLoading = isTeamMode ? teamQuery.isLoading : engineerQuery.isLoading
  const isError = isTeamMode ? teamQuery.isError : engineerQuery.isError

  const all: InitiativeSummary[] = isTeamMode
    ? teamQuery.data
      ? [...teamQuery.data.kbis, ...teamQuery.data.platform_initiatives, ...teamQuery.data.recurring_ops]
      : []
    : engineerQuery.data
      ? [...engineerQuery.data.kbis, ...engineerQuery.data.platform_initiatives, ...engineerQuery.data.recurring_ops]
      : []
  const tasks: TaskSummary[] = isTeamMode ? (teamQuery.data?.tasks ?? []) : (engineerQuery.data?.tasks ?? [])
  const kbiCount = isTeamMode ? (teamQuery.data?.kbis.length ?? 0) : (engineerQuery.data?.kbis.length ?? 0)
  const platformCount = isTeamMode
    ? (teamQuery.data?.platform_initiatives.length ?? 0)
    : (engineerQuery.data?.platform_initiatives.length ?? 0)
  const recurringCount = isTeamMode
    ? (teamQuery.data?.recurring_ops.length ?? 0)
    : (engineerQuery.data?.recurring_ops.length ?? 0)

  const onTrack = all.filter((i) => i.timeline_health === 'ON_TRACK').length
  const atRisk = all.filter((i) => i.timeline_health === 'AT_RISK').length
  const behind = all.filter((i) => i.timeline_health === 'BEHIND').length

  const deliveredThisSprint = tasks.filter(
    (t) => t.status === 'COMPLETE' && inSprintWindow(t.completed_at, currentSprint),
  ).length

  const hoursThisSprint = isTeamMode
    ? (teamQuery.data?.hours_by_category.reduce((s, c) => s + c.hours, 0) ?? 0)
    : (engineerQuery.data?.weekly_hours ?? [])
        .filter((w) => inSprintWindow(w.week_start_date, currentSprint))
        .reduce((s, w) => s + w.hours, 0)

  // Engineer's own dashboard only:
  const asksWithOutcomes = new Set(tasks.map((t) => t.initiative_id)).size
  const outcomesNotStarted = tasks.filter(
    (t) => t.status === 'NOT_STARTED' && t.sprint_number === currentSprint?.number,
  ).length

  const dataLoaded = isTeamMode ? Boolean(teamQuery.data) : Boolean(engineerQuery.data)
  const asksTitle = actor.role === 'manager' ? 'Team Assigned Asks' : 'My Asks'
  const outcomesTitle = actor.role === 'manager' ? 'Team Provided Outcomes' : 'My Outcomes'

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{actor.role === 'manager' ? 'Team Dashboard' : 'My Dashboard'}</h1>
          <p className="page-subtitle">
            {currentSprint ? currentSprint.label : '—'} · Hosting, Platform &amp; Database
          </p>
        </div>
        {actor.role === 'manager' && (
          <label>
            View
            <select value={selection ?? WHOLE_TEAM} onChange={(e) => setSelection(e.target.value)}>
              <option value={WHOLE_TEAM}>Whole team</option>
              {(engineers ?? []).map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {isLoading && <p>Loading dashboard…</p>}
      {isError && <Alert variant="error">Failed to load dashboard.</Alert>}

      {dataLoaded && (
        <>
          <div className="kpi-grid">
            <KpiTile label={`Hours this sprint`} value={hoursThisSprint.toFixed(1)} unit="h">
              {!isTeamMode && (
                <div className="kpi-meter">
                  <div className="kpi-meter-fill" style={{ width: `${Math.min(100, (hoursThisSprint / 38) * 100)}%` }} />
                </div>
              )}
            </KpiTile>

            {actor.role === 'manager' ? (
              <>
                <KpiTile label="Asks assigned" value={all.length} unit="open">
                  <div className="kpi-foot" style={{ display: 'flex', gap: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span className="legend-swatch" style={{ background: 'var(--series-kbi)' }} />
                      {kbiCount}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span className="legend-swatch" style={{ background: 'var(--series-platform)' }} />
                      {platformCount}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span className="legend-swatch" style={{ background: 'var(--series-recurring)' }} />
                      {recurringCount}
                    </span>
                  </div>
                </KpiTile>

                <KpiTile label="Timeline health" value={onTrack} unit={`of ${all.length} on track`}>
                  <div className="kpi-split">
                    <span style={{ flex: onTrack || 0.0001, background: 'var(--green)' }} />
                    <span style={{ flex: atRisk || 0.0001, background: 'var(--amber)' }} />
                    <span style={{ flex: behind || 0.0001, background: 'var(--red)' }} />
                  </div>
                </KpiTile>

                <KpiTile label="Outcomes delivered" value={deliveredThisSprint} unit="this sprint" />
              </>
            ) : (
              <>
                <KpiTile label="Asks assigned" value={asksWithOutcomes} unit="with my Outcomes" />

                <KpiTile label="Timeline health" value={onTrack} unit={`of ${all.length} on track`}>
                  <div className="kpi-split">
                    <span style={{ flex: onTrack || 0.0001, background: 'var(--green)' }} />
                    <span style={{ flex: atRisk || 0.0001, background: 'var(--amber)' }} />
                    <span style={{ flex: behind || 0.0001, background: 'var(--red)' }} />
                  </div>
                </KpiTile>

                <KpiTile label="Outcomes delivered" value={deliveredThisSprint} unit="this sprint" />

                <KpiTile label="Outcomes not started" value={outcomesNotStarted} unit="this sprint" />
              </>
            )}
          </div>

          <InitiativeTable
            title={asksTitle}
            rows={all}
            emptyMessage="Not opted into any Asks yet."
            emptyAction={BROWSE_MARKETPLACE}
          />
          <TaskTable tasks={tasks} title={outcomesTitle} emptyAction={BROWSE_MARKETPLACE} />
        </>
      )}
    </div>
  )
}
