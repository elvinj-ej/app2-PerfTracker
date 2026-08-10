import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { listEngineers } from '../api/engineers'
import { generateKbiBreakdown, getKbi, listKbiCategories, optInKbi, optOutKbi, updateKbi } from '../api/kbis'
import { listTasks } from '../api/tasks'
import { FormField } from '../components/common/FormField'
import { EditableTaskList } from '../components/initiative/EditableTaskList'
import { OptInButton } from '../components/initiative/OptInButton'
import { useActor } from '../context/ActorContext'
import type { Kbi } from '../types/api'

interface EditForm {
  title: string
  category_id: string
  business_goal: string
  ask: string
  jira_number: string
  start_date: string
  expected_delivery_date: string
  priority: string
  complexity: string
  status: string
}

function formFromKbi(kbi: Kbi): EditForm {
  return {
    title: kbi.title,
    category_id: String(kbi.category.id),
    business_goal: kbi.business_goal ?? '',
    ask: kbi.ask ?? '',
    jira_number: kbi.jira_number ?? '',
    start_date: kbi.start_date ?? '',
    expected_delivery_date: kbi.expected_delivery_date ?? '',
    priority: kbi.priority ?? 'MEDIUM',
    complexity: kbi.complexity ?? 'MEDIUM',
    status: kbi.status,
  }
}

export function KbiDetailPage() {
  const { id } = useParams()
  const initiativeId = Number(id)
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<EditForm | null>(null)

  const kbiQuery = useQuery({ queryKey: ['kbis', initiativeId], queryFn: () => getKbi(actor, initiativeId) })
  const engineersQuery = useQuery({ queryKey: ['engineers'], queryFn: () => listEngineers(actor) })
  const tasksQuery = useQuery({ queryKey: ['tasks', initiativeId], queryFn: () => listTasks(actor, initiativeId) })
  const categoriesQuery = useQuery({
    queryKey: ['kbi-categories'],
    queryFn: () => listKbiCategories(actor),
    enabled: isEditing,
  })

  const updateMutation = useMutation({
    mutationFn: (payload: EditForm) =>
      updateKbi(actor, initiativeId, {
        title: payload.title,
        category_id: Number(payload.category_id),
        business_goal: payload.business_goal || null,
        ask: payload.ask || null,
        jira_number: payload.jira_number || null,
        start_date: payload.start_date || null,
        expected_delivery_date: payload.expected_delivery_date || null,
        priority: payload.priority || null,
        complexity: payload.complexity || null,
        status: payload.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kbis', initiativeId] })
      queryClient.invalidateQueries({ queryKey: ['kbis'] })
      setIsEditing(false)
    },
  })

  if (kbiQuery.isLoading || !kbiQuery.data) {
    return (
      <div className="page">
        <p>Loading…</p>
      </div>
    )
  }
  const kbi = kbiQuery.data

  function startEditing() {
    setForm(formFromKbi(kbi))
    setIsEditing(true)
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">{kbi.title}</h1>
        {actor.role === 'manager' && !isEditing && (
          <button className="btn btn-secondary" onClick={startEditing}>
            Edit
          </button>
        )}
        <OptInButton
          engineerIds={kbi.engineer_ids}
          onOptIn={() => optInKbi(actor, initiativeId)}
          onOptOut={() => optOutKbi(actor, initiativeId)}
          invalidateKey={['kbis', initiativeId]}
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
              <FormField label="Category" hint="Which Change Business area this belongs to">
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
              <FormField label="Additional Ask Detail" hint="Optional - more on what the Cloud Team needs to provide">
                <input value={form.ask} onChange={(e) => setForm({ ...form, ask: e.target.value })} />
              </FormField>
              <FormField label="Jira Number" hint="Optional, e.g. ME-1">
                <input value={form.jira_number} onChange={(e) => setForm({ ...form, jira_number: e.target.value })} />
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
              <FormField label="Complexity" hint="Expected effort/difficulty">
                <select value={form.complexity} onChange={(e) => setForm({ ...form, complexity: e.target.value })}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
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
            <dd>{kbi.category.name}</dd>
            <dt>Business Goal</dt>
            <dd>{kbi.business_goal ?? '—'}</dd>
            <dt>Additional Ask Detail</dt>
            <dd>{kbi.ask ?? '—'}</dd>
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
        )}
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
