import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { listEngineers } from '../api/engineers'
import { getEngineerDashboard } from '../api/reports'
import { InitiativeTable } from '../components/initiative/InitiativeTable'
import { TaskTable } from '../components/initiative/TaskTable'
import { useActor } from '../context/ActorContext'

export function EngineerDashboardPage() {
  const { actor } = useActor()
  const { data: engineers } = useQuery({
    queryKey: ['engineers'],
    queryFn: () => listEngineers({ role: 'manager' }),
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

  return (
    <div className="page">
      <div className="page-toolbar">
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
      {dashboardQuery.isError && <p className="text-error">Failed to load dashboard.</p>}

      {dashboardQuery.data && (
        <>
          <InitiativeTable
            title="Key Business Initiatives"
            rows={dashboardQuery.data.kbis}
            emptyMessage="Not opted into any Key Business Initiatives yet."
          />
          <InitiativeTable
            title="Platform Initiatives"
            rows={dashboardQuery.data.platform_initiatives}
            showCategory
            emptyMessage="Not opted into any Platform Initiatives yet."
          />
          <InitiativeTable
            title="Run Operations"
            rows={dashboardQuery.data.recurring_ops}
            showCategory
            emptyMessage="No recurring operational work assigned yet."
          />
          <TaskTable tasks={dashboardQuery.data.tasks} />
        </>
      )}
    </div>
  )
}
