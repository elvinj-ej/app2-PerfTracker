import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { listEngineers } from '../api/engineers'
import {
  getRecurringOps,
  listRecurringOpsCategories,
  optInRecurringOps,
  optOutRecurringOps,
  updateRecurringOps,
} from '../api/recurringOps'
import { listTasks } from '../api/tasks'
import { FormField } from '../components/common/FormField'
import { EditableTaskList } from '../components/initiative/EditableTaskList'
import { OptInButton } from '../components/initiative/OptInButton'
import { useActor } from '../context/ActorContext'
import type { RecurringOps } from '../types/api'

interface EditForm {
  title: string
  description: string
  category_id: string
  recurrence_type: string
  recurrence_interval: string
  priority: string
  status: string
}

function formFromItem(item: RecurringOps): EditForm {
  return {
    title: item.title,
    description: item.description ?? '',
    category_id: String(item.category.id),
    recurrence_type: item.recurrence_type,
    recurrence_interval: String(item.recurrence_interval),
    priority: item.priority ?? 'MEDIUM',
    status: item.status,
  }
}

export function RecurringOpsDetailPage() {
  const { id } = useParams()
  const initiativeId = Number(id)
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<EditForm | null>(null)

  const itemQuery = useQuery({
    queryKey: ['recurring-ops', initiativeId],
    queryFn: () => getRecurringOps(actor, initiativeId),
  })
  const engineersQuery = useQuery({ queryKey: ['engineers'], queryFn: () => listEngineers(actor) })
  const tasksQuery = useQuery({ queryKey: ['tasks', initiativeId], queryFn: () => listTasks(actor, initiativeId) })
  const categoriesQuery = useQuery({
    queryKey: ['recurring-ops-categories'],
    queryFn: () => listRecurringOpsCategories(actor),
    enabled: isEditing,
  })

  const updateMutation = useMutation({
    mutationFn: (payload: EditForm) =>
      updateRecurringOps(actor, initiativeId, {
        title: payload.title,
        description: payload.description || null,
        category_id: Number(payload.category_id),
        recurrence_type: payload.recurrence_type,
        recurrence_interval: Number(payload.recurrence_interval) || 1,
        priority: payload.priority || null,
        status: payload.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-ops', initiativeId] })
      queryClient.invalidateQueries({ queryKey: ['recurring-ops'] })
      setIsEditing(false)
    },
  })

  if (itemQuery.isLoading || !itemQuery.data) {
    return (
      <div className="page">
        <p>Loading…</p>
      </div>
    )
  }
  const item = itemQuery.data

  function startEditing() {
    setForm(formFromItem(item))
    setIsEditing(true)
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">{item.title}</h1>
        {actor.role === 'manager' && !isEditing && (
          <button className="btn btn-secondary" onClick={startEditing}>
            Edit
          </button>
        )}
        <OptInButton
          engineerIds={item.engineer_ids}
          onOptIn={() => optInRecurringOps(actor, initiativeId)}
          onOptOut={() => optOutRecurringOps(actor, initiativeId)}
          invalidateKey={['recurring-ops', initiativeId]}
        />
      </div>

      <section className="card">
        <div className="card-header-row">
          <h2>Details</h2>
        </div>
        {isEditing && form ? (
          <>
            <div className="form-grid">
              <FormField label="Ask" hint="What the recurring work is">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </FormField>
              <FormField label="Description" hint="Optional extra context">
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </FormField>
              <FormField label="Category" hint="Which Run Operations category this belongs to">
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  {(categoriesQuery.data ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Recurrence" hint="How often this repeats">
                <select
                  value={form.recurrence_type}
                  onChange={(e) => setForm({ ...form, recurrence_type: e.target.value })}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="HALF_YEARLY">Half Yearly</option>
                  <option value="ANNUAL">Annual</option>
                  <option value="AD_HOC">Ad Hoc</option>
                </select>
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
            <dt>Description</dt>
            <dd>{item.description ?? '—'}</dd>
            <dt>Category</dt>
            <dd>{item.category.name}</dd>
            <dt>Priority</dt>
            <dd>{item.priority ?? '—'}</dd>
            <dt>Recurrence</dt>
            <dd>
              {item.recurrence_type}
              {item.recurrence_interval > 1 ? ` (every ${item.recurrence_interval})` : ''}
            </dd>
            <dt>Status</dt>
            <dd>{item.status}</dd>
          </dl>
        )}
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
