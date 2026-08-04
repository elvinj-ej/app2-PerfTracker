import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { listEngineers } from '../api/engineers'
import { getRecurringOps, optInRecurringOps, optOutRecurringOps } from '../api/recurringOps'
import { listTasks } from '../api/tasks'
import { EditableTaskList } from '../components/initiative/EditableTaskList'
import { OptInButton } from '../components/initiative/OptInButton'
import { useActor } from '../context/ActorContext'

export function RecurringOpsDetailPage() {
  const { id } = useParams()
  const initiativeId = Number(id)
  const { actor } = useActor()

  const itemQuery = useQuery({
    queryKey: ['recurring-ops', initiativeId],
    queryFn: () => getRecurringOps(actor, initiativeId),
  })
  const engineersQuery = useQuery({ queryKey: ['engineers'], queryFn: () => listEngineers(actor) })
  const tasksQuery = useQuery({ queryKey: ['tasks', initiativeId], queryFn: () => listTasks(actor, initiativeId) })

  if (itemQuery.isLoading || !itemQuery.data) {
    return (
      <div className="page">
        <p>Loading…</p>
      </div>
    )
  }
  const item = itemQuery.data

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">{item.title}</h1>
        <OptInButton
          engineerIds={item.engineer_ids}
          onOptIn={() => optInRecurringOps(actor, initiativeId)}
          onOptOut={() => optOutRecurringOps(actor, initiativeId)}
          invalidateKey={['recurring-ops', initiativeId]}
        />
      </div>

      <section className="card">
        <h2>Details</h2>
        <dl className="detail-grid">
          <dt>Description</dt>
          <dd>{item.description ?? '—'}</dd>
          <dt>Category</dt>
          <dd>{item.category.name}</dd>
          <dt>Recurrence</dt>
          <dd>
            {item.recurrence_type}
            {item.recurrence_interval > 1 ? ` (every ${item.recurrence_interval})` : ''}
          </dd>
          <dt>Status</dt>
          <dd>{item.status}</dd>
        </dl>
      </section>

      <p className="text-muted">
        Run Operations outcomes have no forecast — only actual time logged is tracked.
      </p>

      {engineersQuery.data && tasksQuery.data && (
        <EditableTaskList
          initiativeId={initiativeId}
          tasks={tasksQuery.data}
          engineers={engineersQuery.data}
          showForecast={false}
          invalidateKey={['tasks', initiativeId]}
        />
      )}
    </div>
  )
}
