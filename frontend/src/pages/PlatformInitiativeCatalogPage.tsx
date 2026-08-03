import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createPlatformInitiative, listPlatformCategories, listPlatformInitiatives } from '../api/platformInitiatives'
import { useActor } from '../context/ActorContext'

function NewPlatformInitiativeForm() {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({
    queryKey: ['platform-categories'],
    queryFn: () => listPlatformCategories(actor),
  })
  const [title, setTitle] = useState('')
  const [businessGoal, setBusinessGoal] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      createPlatformInitiative(actor, {
        title,
        business_goal: businessGoal || null,
        expected_delivery_date: deliveryDate || null,
        category_id: Number(categoryId),
        status: 'OPEN',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-initiatives'] })
      setTitle('')
      setBusinessGoal('')
      setDeliveryDate('')
      setCategoryId('')
    },
  })

  if (actor.role !== 'manager') return null

  return (
    <section className="card">
      <h2>New Platform Initiative</h2>
      <div className="form-grid">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Business goal" value={businessGoal} onChange={(e) => setBusinessGoal(e.target.value)} />
        <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Category…</option>
          {(categories ?? []).map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary" disabled={!title || !categoryId || mutation.isPending} onClick={() => mutation.mutate()}>
        Create
      </button>
    </section>
  )
}

export function PlatformInitiativeCatalogPage() {
  const { actor } = useActor()
  const { data, isLoading } = useQuery({
    queryKey: ['platform-initiatives'],
    queryFn: () => listPlatformInitiatives(actor),
  })

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Platform Initiatives</h1>
      </div>

      <NewPlatformInitiativeForm />

      <section className="card">
        {isLoading && <p>Loading…</p>}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Delivery Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((initiative) => (
                <tr key={initiative.id}>
                  <td>{initiative.title}</td>
                  <td>{initiative.category.name}</td>
                  <td>{initiative.expected_delivery_date ?? '—'}</td>
                  <td>{initiative.status}</td>
                  <td>
                    <Link to={`/platform-initiatives/${initiative.id}`}>View</Link>
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
