import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createKbi, listKbis } from '../api/kbis'
import { useActor } from '../context/ActorContext'

function NewKbiForm() {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [businessGoal, setBusinessGoal] = useState('')
  const [jira, setJira] = useState('')
  const [startDate, setStartDate] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [complexity, setComplexity] = useState('MEDIUM')

  const mutation = useMutation({
    mutationFn: () =>
      createKbi(actor, {
        title,
        business_goal: businessGoal || null,
        jira_number: jira || null,
        start_date: startDate || null,
        expected_delivery_date: deliveryDate || null,
        priority,
        complexity,
        status: 'OPEN',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kbis'] })
      setTitle('')
      setBusinessGoal('')
      setJira('')
      setStartDate('')
      setDeliveryDate('')
    },
  })

  if (actor.role !== 'manager') return null

  return (
    <section className="card">
      <h2>New Key Business Initiative</h2>
      <div className="form-grid">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Business goal" value={businessGoal} onChange={(e) => setBusinessGoal(e.target.value)} />
        <input placeholder="Jira number" value={jira} onChange={(e) => setJira(e.target.value)} />
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <select value={complexity} onChange={(e) => setComplexity(e.target.value)}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>
      <button className="btn btn-primary" disabled={!title || mutation.isPending} onClick={() => mutation.mutate()}>
        Create
      </button>
    </section>
  )
}

export function KbiCatalogPage() {
  const { actor } = useActor()
  const { data, isLoading } = useQuery({ queryKey: ['kbis'], queryFn: () => listKbis(actor) })

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Key Business Initiatives</h1>
      </div>

      <NewKbiForm />

      <section className="card">
        {isLoading && <p>Loading…</p>}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Priority</th>
                <th>Complexity</th>
                <th>Delivery Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((kbi) => (
                <tr key={kbi.id}>
                  <td>{kbi.title}</td>
                  <td>{kbi.priority ?? '—'}</td>
                  <td>{kbi.complexity ?? '—'}</td>
                  <td>{kbi.expected_delivery_date ?? '—'}</td>
                  <td>{kbi.status}</td>
                  <td>
                    <Link to={`/kbis/${kbi.id}`}>View</Link>
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
