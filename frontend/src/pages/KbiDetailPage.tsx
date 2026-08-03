import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { listEngineers } from '../api/engineers'
import { generateKbiBreakdown, getKbi, optInKbi, optOutKbi } from '../api/kbis'
import { listTasks } from '../api/tasks'
import { EditableTaskList } from '../components/initiative/EditableTaskList'
import { OptInButton } from '../components/initiative/OptInButton'
import { useActor } from '../context/ActorContext'

export function KbiDetailPage() {
  const { id } = useParams()
  const initiativeId = Number(id)
  const { actor } = useActor()

  const kbiQuery = useQuery({ queryKey: ['kbis', initiativeId], queryFn: () => getKbi(actor, initiativeId) })
  const engineersQuery = useQuery({ queryKey: ['engineers'], queryFn: () => listEngineers(actor) })
  const tasksQuery = useQuery({ queryKey: ['tasks', initiativeId], queryFn: () => listTasks(actor, initiativeId) })

  if (kbiQuery.isLoading || !kbiQuery.data) {
    return (
      <div className="page">
        <p>Loading…</p>
      </div>
    )
  }
  const kbi = kbiQuery.data

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">{kbi.title}</h1>
        <OptInButton
          engineerIds={kbi.engineer_ids}
          onOptIn={() => optInKbi(actor, initiativeId)}
          onOptOut={() => optOutKbi(actor, initiativeId)}
          invalidateKey={['kbis', initiativeId]}
        />
      </div>

      <section className="card">
        <h2>Details</h2>
        <dl className="detail-grid">
          <dt>Business Goal</dt>
          <dd>{kbi.business_goal ?? '—'}</dd>
          <dt>Jira Number</dt>
          <dd>{kbi.jira_number ?? '—'}</dd>
          <dt>Start Date</dt>
          <dd>{kbi.start_date ?? '—'}</dd>
          <dt>Expected Delivery</dt>
          <dd>{kbi.expected_delivery_date ?? '—'}</dd>
          <dt>Priority</dt>
          <dd>{kbi.priority ?? '—'}</dd>
          <dt>Complexity</dt>
          <dd>{kbi.complexity ?? '—'}</dd>
          <dt>Status</dt>
          <dd>{kbi.status}</dd>
        </dl>
      </section>

      {engineersQuery.data && tasksQuery.data && (
        <EditableTaskList
          initiativeId={initiativeId}
          tasks={tasksQuery.data}
          engineers={engineersQuery.data}
          onGenerateBreakdown={() =>
            generateKbiBreakdown(actor, initiativeId, actor.role === 'engineer' ? actor.engineerId : undefined)
          }
          invalidateKey={['tasks', initiativeId]}
        />
      )}
    </div>
  )
}
