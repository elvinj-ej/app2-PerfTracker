import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { downloadFundedChangeBusinessExport, getFundedChangeBusinessReport } from '../api/reports'
import { Alert } from '../components/common/Alert'
import { useActor } from '../context/ActorContext'

export function FundedChangeBusinessPage() {
  const { actor } = useActor()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['funded-change-business'],
    queryFn: () => getFundedChangeBusinessReport(actor),
  })
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExport() {
    setIsExporting(true)
    setExportError(null)
    try {
      await downloadFundedChangeBusinessExport(actor)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Funded Change Business</h1>
        <button className="btn btn-primary" onClick={handleExport} disabled={isExporting || !data?.length}>
          {isExporting ? 'Exporting…' : 'Export to Excel'}
        </button>
      </div>
      <p className="text-muted">
        Every Change Business Ask marked Funded. Click a row to see its Outcomes — who's assigned, which sprint, and
        hours logged so far.
      </p>
      {exportError && <Alert variant="error">{exportError}</Alert>}

      {isLoading && <p>Loading…</p>}
      {isError && <Alert variant="error">Failed to load the funded Change Business report.</Alert>}

      {data && data.length === 0 && <p className="text-muted">No Change Business Asks are marked Funded yet.</p>}

      {data && data.length > 0 && (
        <section className="card funded-report-card">
          <div className="funded-report-row funded-report-header">
            <span>Ask</span>
            <span>Category</span>
            <span>Status</span>
            <span>Expected Delivery</span>
            <span>Outcomes</span>
            <span className="num">Total Hours</span>
          </div>
          {data.map((report) => (
            <details className="funded-ask-details" key={report.id}>
              <summary className="funded-report-row funded-ask-summary">
                <span className="funded-ask-title">{report.title}</span>
                <span>{report.category_name ?? '—'}</span>
                <span>{report.status}</span>
                <span>{report.expected_delivery_date ?? '—'}</span>
                <span>{report.outcomes.length}</span>
                <span className="num">{report.total_hours_logged.toFixed(1)}</span>
              </summary>
              {report.outcomes.length === 0 ? (
                <p className="text-muted funded-ask-empty">No Outcomes defined for this Ask yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="funded-outcomes-table">
                    <thead>
                      <tr>
                        <th>Outcome</th>
                        <th>Status</th>
                        <th>Sprint</th>
                        <th>Assignee</th>
                        <th>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.outcomes.map((outcome) => (
                        <tr key={outcome.id}>
                          <td>{outcome.title}</td>
                          <td>{outcome.status}</td>
                          <td>{outcome.sprint_label ?? 'Unscheduled'}</td>
                          <td>{outcome.owner_engineer_name ?? 'Unassigned'}</td>
                          <td className="num">{outcome.hours_logged.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          ))}
        </section>
      )}
    </div>
  )
}
