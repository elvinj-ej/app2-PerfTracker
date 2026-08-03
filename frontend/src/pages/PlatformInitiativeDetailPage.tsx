import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { listEngineers } from '../api/engineers'
import {
  generatePlatformInitiativeBreakdown,
  getPlatformInitiative,
  optInPlatformInitiative,
  optOutPlatformInitiative,
} from '../api/platformInitiatives'
import { listTasks } from '../api/tasks'
import { EditableTaskList } from '../components/initiative/EditableTaskList'
import { OptInButton } from '../components/initiative/OptInButton'
import { UpgradeUnitsTable } from '../components/initiative/UpgradeUnitsTable'
import { useActor } from '../context/ActorContext'

export function PlatformInitiativeDetailPage() {
  const { id } = useParams()
  const initiativeId = Number(id)
  const { actor } = useActor()

  const initiativeQuery = useQuery({
    queryKey: ['platform-initiatives', initiativeId],
    queryFn: () => getPlatformInitiative(actor, initiativeId),
  })
  const engineersQuery = useQuery({ queryKey: ['engineers'], queryFn: () => listEngineers(actor) })
  const tasksQuery = useQuery({ queryKey: ['tasks', initiativeId], queryFn: () => listTasks(actor, initiativeId) })

  if (initiativeQuery.isLoading || !initiativeQuery.data) {
    return (
      <div className="page">
        <p>Loading…</p>
      </div>
    )
  }
  const initiative = initiativeQuery.data

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">{initiative.title}</h1>
        <OptInButton
          engineerIds={initiative.engineer_ids}
          onOptIn={() => optInPlatformInitiative(actor, initiativeId)}
          onOptOut={() => optOutPlatformInitiative(actor, initiativeId)}
          invalidateKey={['platform-initiatives', initiativeId]}
        />
      </div>

      <section className="card">
        <h2>Details</h2>
        <dl className="detail-grid">
          <dt>Category</dt>
          <dd>{initiative.category.name}</dd>
          <dt>Business Goal</dt>
          <dd>{initiative.business_goal ?? '—'}</dd>
          <dt>Start Date</dt>
          <dd>{initiative.start_date ?? '—'}</dd>
          <dt>Expected Delivery</dt>
          <dd>{initiative.expected_delivery_date ?? '—'}</dd>
          <dt>Priority</dt>
          <dd>{initiative.priority ?? '—'}</dd>
          <dt>Status</dt>
          <dd>{initiative.status}</dd>
        </dl>
      </section>

      {initiative.category.is_upgrade_type && <UpgradeUnitsTable initiativeId={initiativeId} />}

      {engineersQuery.data && tasksQuery.data && (
        <EditableTaskList
          initiativeId={initiativeId}
          tasks={tasksQuery.data}
          engineers={engineersQuery.data}
          onGenerateBreakdown={() =>
            generatePlatformInitiativeBreakdown(actor, initiativeId, actor.role === 'engineer' ? actor.engineerId : undefined)
          }
          invalidateKey={['tasks', initiativeId]}
        />
      )}
    </div>
  )
}
