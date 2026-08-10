import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { listEngineers } from '../api/engineers'
import {
  generatePlatformInitiativeBreakdown,
  getPlatformInitiative,
  listPlatformCategories,
  optInPlatformInitiative,
  optOutPlatformInitiative,
  updatePlatformInitiative,
} from '../api/platformInitiatives'
import { listTasks } from '../api/tasks'
import { FormField } from '../components/common/FormField'
import { EditableTaskList } from '../components/initiative/EditableTaskList'
import { OptInButton } from '../components/initiative/OptInButton'
import { UpgradeUnitsTable } from '../components/initiative/UpgradeUnitsTable'
import { useActor } from '../context/ActorContext'
import type { PlatformInitiative } from '../types/api'

interface EditForm {
  title: string
  category_id: string
  business_goal: string
  start_date: string
  expected_delivery_date: string
  priority: string
  status: string
}

function formFromInitiative(initiative: PlatformInitiative): EditForm {
  return {
    title: initiative.title,
    category_id: String(initiative.category.id),
    business_goal: initiative.business_goal ?? '',
    start_date: initiative.start_date ?? '',
    expected_delivery_date: initiative.expected_delivery_date ?? '',
    priority: initiative.priority ?? 'MEDIUM',
    status: initiative.status,
  }
}

export function PlatformInitiativeDetailPage() {
  const { id } = useParams()
  const initiativeId = Number(id)
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<EditForm | null>(null)

  const initiativeQuery = useQuery({
    queryKey: ['platform-initiatives', initiativeId],
    queryFn: () => getPlatformInitiative(actor, initiativeId),
  })
  const engineersQuery = useQuery({ queryKey: ['engineers'], queryFn: () => listEngineers(actor) })
  const tasksQuery = useQuery({ queryKey: ['tasks', initiativeId], queryFn: () => listTasks(actor, initiativeId) })
  const categoriesQuery = useQuery({
    queryKey: ['platform-categories'],
    queryFn: () => listPlatformCategories(actor),
    enabled: isEditing,
  })

  const updateMutation = useMutation({
    mutationFn: (payload: EditForm) =>
      updatePlatformInitiative(actor, initiativeId, {
        title: payload.title,
        category_id: Number(payload.category_id),
        business_goal: payload.business_goal || null,
        start_date: payload.start_date || null,
        expected_delivery_date: payload.expected_delivery_date || null,
        priority: payload.priority || null,
        status: payload.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-initiatives', initiativeId] })
      queryClient.invalidateQueries({ queryKey: ['platform-initiatives'] })
      setIsEditing(false)
    },
  })

  if (initiativeQuery.isLoading || !initiativeQuery.data) {
    return (
      <div className="page">
        <p>Loading…</p>
      </div>
    )
  }
  const initiative = initiativeQuery.data

  function startEditing() {
    setForm(formFromInitiative(initiative))
    setIsEditing(true)
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">{initiative.title}</h1>
        {actor.role === 'manager' && !isEditing && (
          <button className="btn btn-secondary" onClick={startEditing}>
            Edit
          </button>
        )}
        <OptInButton
          engineerIds={initiative.engineer_ids}
          onOptIn={() => optInPlatformInitiative(actor, initiativeId)}
          onOptOut={() => optOutPlatformInitiative(actor, initiativeId)}
          invalidateKey={['platform-initiatives', initiativeId]}
        />
      </div>

      <section className="card">
        <div className="card-header-row">
          <h2>Details</h2>
        </div>
        {isEditing && form ? (
          <>
            <div className="form-grid">
              <FormField label="Ask" hint="What needs to be delivered">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </FormField>
              <FormField label="Category" hint="Upgrade type, improvement, automation, etc.">
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  {(categoriesQuery.data ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Business Goal" hint="The outcome this needs to achieve">
                <input value={form.business_goal} onChange={(e) => setForm({ ...form, business_goal: e.target.value })} />
              </FormField>
              <FormField label="Start Date" hint="When work begins">
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </FormField>
              <FormField label="Expected Delivery" hint="Target completion date">
                <input
                  type="date"
                  value={form.expected_delivery_date}
                  onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })}
                />
              </FormField>
              <FormField label="Priority" hint="How urgent this is">
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </FormField>
              <FormField label="Status" hint="Current state of the Ask">
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="DRAFT">Draft</option>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </FormField>
            </div>
            {updateMutation.isError && <p className="text-error">{(updateMutation.error as Error).message}</p>}
            <div className="add-task-form">
              <button
                className="btn btn-primary"
                disabled={!form.title || !form.category_id || updateMutation.isPending}
                onClick={() => updateMutation.mutate(form)}
              >
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)} disabled={updateMutation.isPending}>
                Cancel
              </button>
            </div>
          </>
        ) : (
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
        )}
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
