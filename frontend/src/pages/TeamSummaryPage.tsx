import { useQuery } from '@tanstack/react-query'
import { getTeamSummary } from '../api/reports'
import { Alert } from '../components/common/Alert'
import { KpiTile } from '../components/common/KpiTile'
import { CategoryHoursBarChart } from '../components/charts/CategoryHoursBarChart'
import { EngineerHoursStackedBarChart } from '../components/charts/EngineerHoursStackedBarChart'
import { InitiativeTable } from '../components/initiative/InitiativeTable'
import { useActor } from '../context/ActorContext'

export function TeamSummaryPage() {
  const { actor } = useActor()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['team-summary'],
    queryFn: () => getTeamSummary(actor),
  })

  const all = data ? [...data.kbis, ...data.platform_initiatives, ...data.recurring_ops] : []
  const kbiHours = data?.hours_by_category.find((c) => c.initiative_type === 'KBI')?.hours ?? 0
  const platformHours = data?.hours_by_category.find((c) => c.initiative_type === 'PLATFORM')?.hours ?? 0
  const recurringHours = data?.hours_by_category.find((c) => c.initiative_type === 'RECURRING_OPS')?.hours ?? 0
  const totalHours = kbiHours + platformHours + recurringHours
  const runPct = totalHours > 0 ? Math.round((recurringHours / totalHours) * 100) : 0
  const changePct = totalHours > 0 ? 100 - runPct : 0

  const onTrack = all.filter((i) => i.timeline_health === 'ON_TRACK').length
  const atRisk = all.filter((i) => i.timeline_health === 'AT_RISK').length
  const behind = all.filter((i) => i.timeline_health === 'BEHIND').length
  const onTrackPct = all.length > 0 ? Math.round((onTrack / all.length) * 100) : 0

  const catMax = data ? Math.max(1, ...data.hours_by_category.map((d) => d.hours)) : 1
  const engMax = data ? Math.max(1, ...data.hours_by_engineer.map((e) => e.total_hours)) : 1

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hosting, Platform &amp; Database</h1>
          <p className="page-subtitle">Team summary · {data?.hours_by_engineer.length ?? 0} engineers</p>
        </div>
      </div>

      {isLoading && <p>Loading team summary…</p>}
      {isError && <Alert variant="error">Failed to load team summary.</Alert>}

      {data && (
        <>
          <div className="kpi-grid">
            <KpiTile label="Hours logged" value={totalHours.toFixed(1)} unit="h">
              <div className="kpi-split">
                <span style={{ flex: kbiHours || 0.0001, background: 'var(--series-kbi)' }} />
                <span style={{ flex: platformHours || 0.0001, background: 'var(--series-platform)' }} />
                <span style={{ flex: recurringHours || 0.0001, background: 'var(--series-recurring)' }} />
              </div>
            </KpiTile>

            <KpiTile label="Active asks" value={all.length} unit="open" />

            <KpiTile label="On track" value={`${onTrackPct}%`}>
              <span className="kpi-foot">
                {atRisk} at risk · {behind} behind
              </span>
            </KpiTile>

            <KpiTile label="Run vs change" value={`${runPct} / ${changePct}`} unit="run / change" />
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

          <InitiativeTable title="All Asks" rows={all} emptyMessage="No Asks yet." />
        </>
      )}
    </div>
  )
}
