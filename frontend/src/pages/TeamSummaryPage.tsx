import { useQuery } from '@tanstack/react-query'
import { getTeamSummary } from '../api/reports'
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

  return (
    <div className="page">
      <h1 className="page-title">Hosting &amp; Platform Team Summary</h1>

      {isLoading && <p>Loading team summary…</p>}
      {isError && <p className="text-error">Failed to load team summary.</p>}

      {data && (
        <>
          <section className="card">
            <h2>Hours Logged by Category</h2>
            <CategoryHoursBarChart data={data.hours_by_category} />
          </section>

          <section className="card">
            <h2>Hours Logged by Engineer</h2>
            <EngineerHoursStackedBarChart
              rows={data.hours_by_engineer.map((e) => ({ label: e.engineer_name, hoursByType: e.hours_by_type }))}
            />
          </section>

          <InitiativeTable
            title="Change Business"
            rows={data.kbis}
            emptyMessage="No Change Business yet."
          />
          <InitiativeTable
            title="Change Platform"
            rows={data.platform_initiatives}
            showCategory
            emptyMessage="No Change Platform yet."
          />
          <InitiativeTable
            title="Run Operations"
            rows={data.recurring_ops}
            showCategory
            emptyMessage="No recurring operational work yet."
          />
        </>
      )}
    </div>
  )
}
