import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createRecurringOps, listRecurringOps, listRecurringOpsCategories } from '../api/recurringOps'
import { FormField } from '../components/common/FormField'
import { useActor } from '../context/ActorContext'

function NewRecurringOpsForm() {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({
    queryKey: ['recurring-ops-categories'],
    queryFn: () => listRecurringOpsCategories(actor),
  })
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [recurrenceType, setRecurrenceType] = useState('MONTHLY')
  const [priority, setPriority] = useState('MEDIUM')

  const mutation = useMutation({
    mutationFn: () =>
      createRecurringOps(actor, {
        title,
        description: description || null,
        category_id: Number(categoryId),
        recurrence_type: recurrenceType,
        priority,
        status: 'OPEN',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-ops'] })
      setTitle('')
      setDescription('')
      setCategoryId('')
    },
  })

  if (actor.role !== 'manager') return null

  return (
    <section className="card">
      <h2>New Run Operations Item</h2>
      <div className="form-grid">
        <FormField label="Ask" hint="What the recurring work is">
          <input placeholder="e.g. Monthly Patching - Windows Fleet" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label="Description" hint="Optional extra context">
          <input placeholder="e.g. Routine OS patching" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField label="Category" hint="Which Run Operations category this belongs to">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Category…</option>
            {(categories ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Recurrence" hint="How often this repeats">
          <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)}>
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
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </FormField>
      </div>
      <button className="btn btn-primary" disabled={!title || !categoryId || mutation.isPending} onClick={() => mutation.mutate()}>
        Create
      </button>
    </section>
  )
}

export function RecurringOpsCatalogPage() {
  const { actor } = useActor()
  const { data, isLoading } = useQuery({ queryKey: ['recurring-ops'], queryFn: () => listRecurringOps(actor) })

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Run Operations</h1>
      </div>

      <NewRecurringOpsForm />

      <section className="card">
        {isLoading && <p>Loading…</p>}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ask</th>
                <th>Category</th>
                <th>Recurrence</th>
                <th>Priority</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.category.name}</td>
                  <td>{item.recurrence_type}</td>
                  <td>{item.priority ?? '—'}</td>
                  <td>{item.status}</td>
                  <td>
                    <Link to={`/recurring-ops/${item.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
