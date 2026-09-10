import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { listEngineers } from '../api/engineers'
import { downloadEngineerCompletedOutcomes, getEngineerCompletedOutcomes } from '../api/reports'
import { Alert } from '../components/common/Alert'
import { useActor } from '../context/ActorContext'
import { MANAGER_NAMES } from '../data/managers'

export function CompletedOutcomesPage() {
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

  const selectedEngineer = engineers?.find((e) => e.id === selectedEngineerId)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['completed-outcomes', selectedEngineerId],
    queryFn: () => getEngineerCompletedOutcomes(actor, selectedEngineerId as number),
    enabled: selectedEngineerId !== undefined,
  })

  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExport() {
    if (selectedEngineerId === undefined || !selectedEngineer) return
    setIsExporting(true)
    setExportError(null)
    try {
      await downloadEngineerCompletedOutcomes(actor, selectedEngineerId, selectedEngineer.name)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setIsExporting(false)
    }
  }

  const totalHours = data ? data.reduce((s, o) => s + o.hours_logged, 0) : 0

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Completed Outcomes</h1>
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
        <button className="btn btn-primary" onClick={handleExport} disabled={isExporting || !data?.length}>
          {isExporting ? 'Exporting…' : 'Export to Excel'}
        </button>
      </div>
      <p className="text-muted">
        Every Outcome {selectedEngineer ? selectedEngineer.name : 'this engineer'} has delivered — a ready-made
        export for a Workday goals review.
      </p>
      {exportError && <Alert variant="error">{exportError}</Alert>}

      {isLoading && <p>Loading…</p>}
      {isError && <Alert variant="error">Failed to load completed Outcomes.</Alert>}

      {data && data.length === 0 && <p className="text-muted">No completed Outcomes yet.</p>}

      {data && data.length > 0 && (
        <section className="card">
          <div className="card-header-row">
            <h2>{data.length} completed</h2>
            <span className="text-muted">{totalHours.toFixed(1)}h total</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Outcome</th>
                  <th>Ask</th>
                  <th>Sprint</th>
                  <th>Completed</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {data.map((outcome) => (
                  <tr key={outcome.id}>
                    <td>{outcome.title}</td>
                    <td>
                      <div className="cell-primary">
                        <span className="cell-title">{outcome.initiative_title}</span>
                        <span className="text-muted">{outcome.category_name}</span>
                      </div>
                    </td>
                    <td>{outcome.sprint_label ?? '—'}</td>
                    <td>{outcome.completed_at ? outcome.completed_at.slice(0, 10) : '—'}</td>
                    <td className="num">{outcome.hours_logged.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
