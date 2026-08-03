import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createRecurringOps, listRecurringOps } from '../api/recurringOps'
import { useActor } from '../context/ActorContext'

function NewRecurringOpsForm() {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [recurrenceType, setRecurrenceType] = useState('MONTHLY')

  const mutation = useMutation({
    mutationFn: () =>
      createRecurringOps(actor, {
        title,
        description: description || null,
        recurrence_type: recurrenceType,
        status: 'OPEN',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-ops'] })
      setTitle('')
      setDescription('')
    },
  })

  if (actor.role !== 'manager') return null

  return (
    <section className="card">
      <h2>New Recurring Operations Item</h2>
      <div className="form-grid">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)}>
          <option value="ANNUAL">Annual</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="WEEKLY">Weekly</option>
          <option value="AD_HOC">Ad Hoc</option>
        </select>
      </div>
      <button className="btn btn-primary" disabled={!title || mutation.isPending} onClick={() => mutation.mutate()}>
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
        <h1 className="page-title">Recurring Operations</h1>
      </div>

      <NewRecurringOpsForm />

      <section className="card">
        {isLoading && <p>Loading…</p>}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Recurrence</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.recurrence_type}</td>
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
