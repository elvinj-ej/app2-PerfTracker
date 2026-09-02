import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { downloadMonthlyReportExport, getAvailableMonths, getMonthlyReport } from '../api/reports'
import { ProgressBar } from '../components/charts/ProgressBar'
import { useActor } from '../context/ActorContext'
import type { MonthlyInitiativeReport } from '../types/api'

function formatMonthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function MonthlyInitiativeCard({
  initiative,
  showCategory,
}: {
  initiative: MonthlyInitiativeReport
  showCategory?: boolean
}) {
  return (
    <section className="card">
      <div className="card-header-row">
        <h2>{initiative.title}</h2>
        <span className="text-muted">{initiative.total_hours_this_month.toFixed(1)}h this month</span>
      </div>
      <div className="monthly-initiative-meta">
        {showCategory && initiative.category_name && <span className="badge badge-gray">{initiative.category_name}</span>}
        {initiative.completion_pct !== null && <ProgressBar pct={initiative.completion_pct} />}
        {initiative.expected_delivery_date && (
          <span className="text-muted">Delivery: {initiative.expected_delivery_date}</span>
        )}
      </div>
      {initiative.tasks.length === 0 ? (
        <p className="text-muted">No tasks defined yet.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Stage</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Hours This Month</th>
              </tr>
            </thead>
            <tbody>
              {initiative.tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>{task.stage ?? '—'}</td>
                  <td>{task.owner_engineer_name ?? 'Unassigned'}</td>
                  <td>{task.status}</td>
                  <td>{task.hours_this_month.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function MonthlyReportPage() {
  const { actor } = useActor()
  const { data: months } = useQuery({ queryKey: ['available-months'], queryFn: () => getAvailableMonths(actor) })
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedMonth === undefined && months && months.length > 0) {
      setSelectedMonth(months[0])
    }
  }, [months, selectedMonth])

  const reportQuery = useQuery({
    queryKey: ['monthly-report', selectedMonth],
    queryFn: () => getMonthlyReport(actor, selectedMonth as string),
    enabled: selectedMonth !== undefined,
  })

  async function handleExport() {
    if (!selectedMonth) return
    setIsExporting(true)
    setExportError(null)
    try {
      await downloadMonthlyReportExport(actor, selectedMonth)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Monthly Report</h1>
        <label>
          Month
          <select value={selectedMonth ?? ''} onChange={(e) => setSelectedMonth(e.target.value)}>
            {(months ?? []).map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" onClick={handleExport} disabled={!selectedMonth || isExporting}>
          {isExporting ? 'Exporting…' : 'Export to Excel'}
        </button>
      </div>
      {exportError && <p className="text-error">{exportError}</p>}

      {reportQuery.isLoading && <p>Loading…</p>}
      {reportQuery.isError && <p className="text-error">Failed to load monthly report.</p>}

      {reportQuery.data && (
        <>
          <h2 className="section-heading">Change Business</h2>
          {reportQuery.data.kbis.length === 0 && <p className="text-muted">None.</p>}
          {reportQuery.data.kbis.map((initiative) => (
            <MonthlyInitiativeCard key={initiative.id} initiative={initiative} />
          ))}

          <h2 className="section-heading">Change Platform</h2>
          {reportQuery.data.platform_initiatives.length === 0 && <p className="text-muted">None.</p>}
          {reportQuery.data.platform_initiatives.map((initiative) => (
            <MonthlyInitiativeCard key={initiative.id} initiative={initiative} showCategory />
          ))}

          <h2 className="section-heading">Run Operations</h2>
          {reportQuery.data.recurring_ops.length === 0 && <p className="text-muted">None.</p>}
          {reportQuery.data.recurring_ops.map((initiative) => (
            <MonthlyInitiativeCard key={initiative.id} initiative={initiative} showCategory />
          ))}
        </>
      )}
    </div>
  )
}
