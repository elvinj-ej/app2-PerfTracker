import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEngineers } from '../api/engineers'
import { getEngineerDashboard } from '../api/reports'
import { Alert } from '../components/common/Alert'
import { KpiTile } from '../components/common/KpiTile'
import { InitiativeTable } from '../components/initiative/InitiativeTable'
import { TaskTable } from '../components/initiative/TaskTable'
import { useActor } from '../context/ActorContext'
import { MANAGER_NAMES } from '../data/managers'

const BROWSE_MARKETPLACE = <Link to="/marketplace">Browse the Marketplace</Link>

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const dayIndex = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - dayIndex)
  return d.toISOString().slice(0, 10)
}

const CURRENT_WEEK_START = mondayOf(new Date().toISOString().slice(0, 10))

export function EngineerDashboardPage() {
  const { actor } = useActor()
  const { data: engineers } = useQuery({
    queryKey: ['engineers'],
    queryFn: () => listEngineers({ role: 'manager', managerName: MANAGER_NAMES[0] }),
  })

  const [selectedEngineerId, setSelectedEngineerId] = useState<number | undefined>(
    actor.role === 'engineer' ? actor.engineerId : undefined,
  )

  useEffect(() => {
    if (actor.role === 'engineer') {
      setSelectedEngineerId(actor.engineerId)
    } else if (selectedEngineerId === undefined && engineers && engineers.length > 0) {
      setSelectedEngineerId(engineers[0].id)
    }
  }, [actor, engineers, selectedEngineerId])

  const dashboardQuery = useQuery({
    queryKey: ['engineer-dashboard', selectedEngineerId],
    queryFn: () => getEngineerDashboard(actor, selectedEngineerId as number),
    enabled: selectedEngineerId !== undefined,
  })

  const data = dashboardQuery.data
  const all = data ? [...data.kbis, ...data.platform_initiatives, ...data.recurring_ops] : []
  const hoursThisWeek = data
    ? data.weekly_hours.filter((w) => w.week_start_date === CURRENT_WEEK_START).reduce((s, w) => s + w.hours, 0)
    : 0
  const onTrack = all.filter((i) => i.timeline_health === 'ON_TRACK').length
  const atRisk = all.filter((i) => i.timeline_health === 'AT_RISK').length
  const behind = all.filter((i) => i.timeline_health === 'BEHIND').length
  const completeOutcomes = data ? data.tasks.filter((t) => t.status === 'COMPLETE').length : 0

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Dashboard</h1>
          <p className="page-subtitle">Week of {CURRENT_WEEK_START} · Hosting, Platform &amp; Database</p>
        </div>
        <label>
          Engineer
          <select
            value={selectedEngineerId ?? ''}
            onChange={(e) => setSelectedEngineerId(Number(e.target.value))}
            disabled={actor.role === 'engineer'}
          >
            {(engineers ?? []).map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dashboardQuery.isLoading && <p>Loading dashboard…</p>}
      {dashboardQuery.isError && <Alert variant="error">Failed to load dashboard.</Alert>}

      {data && (
        <>
          <div className="kpi-grid">
            <KpiTile label="Hours this week" value={hoursThisWeek.toFixed(1)} unit="/ 38 h">
              <div className="kpi-meter">
                <div className="kpi-meter-fill" style={{ width: `${Math.min(100, (hoursThisWeek / 38) * 100)}%` }} />
              </div>
            </KpiTile>

            <KpiTile label="Asks assigned" value={all.length} unit="open">
              <div className="kpi-foot" style={{ display: 'flex', gap: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span className="legend-swatch" style={{ background: 'var(--series-kbi)' }} />
                  {data.kbis.length}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span className="legend-swatch" style={{ background: 'var(--series-platform)' }} />
                  {data.platform_initiatives.length}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span className="legend-swatch" style={{ background: 'var(--series-recurring)' }} />
                  {data.recurring_ops.length}
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

            <KpiTile label="Outcomes delivered" value={completeOutcomes} unit="complete">
              <span className="kpi-foot">{data.tasks.length} total this cycle</span>
            </KpiTile>
          </div>

          <InitiativeTable
            title="My Asks"
            rows={all}
            emptyMessage="Not opted into any Asks yet."
            emptyAction={BROWSE_MARKETPLACE}
          />
          <TaskTable tasks={data.tasks} emptyAction={BROWSE_MARKETPLACE} />
        </>
      )}
    </div>
  )
}
