import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createKbi, listKbiCategories, listKbis } from '../api/kbis'
import { Alert } from '../components/common/Alert'
import { FormField } from '../components/common/FormField'
import { SortableTh } from '../components/common/SortableTh'
import { useActor } from '../context/ActorContext'
import { useToast } from '../context/ToastContext'
import type { Kbi } from '../types/api'

type SortKey = 'title' | 'category' | 'priority' | 'complexity' | 'delivery' | 'status'

function NewKbiForm() {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: categories } = useQuery({
    queryKey: ['kbi-categories'],
    queryFn: () => listKbiCategories(actor),
  })
  const [title, setTitle] = useState('')
  const [businessGoal, setBusinessGoal] = useState('')
  const [ask, setAsk] = useState('')
  const [categoryId, setCategoryId] = useState('')
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
        ask: ask || null,
        category_id: Number(categoryId),
        jira_number: jira || null,
        start_date: startDate || null,
        expected_delivery_date: deliveryDate || null,
        priority,
        complexity,
        status: 'OPEN',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kbis'] })
      toast.success('Change Business Ask created')
      setTitle('')
      setBusinessGoal('')
      setAsk('')
      setCategoryId('')
      setJira('')
      setStartDate('')
      setDeliveryDate('')
    },
  })

  if (actor.role !== 'manager') return null

  return (
    <section className="card">
      <h2>New Change Business</h2>
      {mutation.isError && <Alert variant="error">{(mutation.error as Error).message}</Alert>}
      <div className="form-grid">
        <FormField label="Ask" hint="What needs to be delivered">
          <input placeholder="e.g. Customer Portal Migration" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label="Category" hint="Which Change Business area this belongs to">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Category…</option>
            {(categories ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Business Goal" hint="The outcome this needs to achieve">
          <input placeholder="e.g. Reduce hosting costs" value={businessGoal} onChange={(e) => setBusinessGoal(e.target.value)} />
        </FormField>
        <FormField label="Additional Ask Detail" hint="Optional - more on what the Hosting, Platform & Database Team needs to provide">
          <input placeholder="e.g. Migrate the portal backend with zero downtime" value={ask} onChange={(e) => setAsk(e.target.value)} />
        </FormField>
        <FormField label="Jira Number" hint="Optional, e.g. ME-1">
          <input placeholder="ME-1" value={jira} onChange={(e) => setJira(e.target.value)} />
        </FormField>
        <FormField label="Start Date" hint="When work begins">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </FormField>
        <FormField label="Expected Delivery" hint="Target completion date">
          <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
        </FormField>
        <FormField label="Priority" hint="How urgent this is">
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </FormField>
        <FormField label="Complexity" hint="Expected effort/difficulty">
          <select value={complexity} onChange={(e) => setComplexity(e.target.value)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </FormField>
      </div>
      <button className="btn btn-primary" disabled={!title || !categoryId || mutation.isPending} onClick={() => mutation.mutate()}>
        Create
      </button>
    </section>
  )
}

const SORT_ACCESSORS: Record<SortKey, (k: Kbi) => string> = {
  title: (k) => k.title,
  category: (k) => k.category.name,
  priority: (k) => k.priority ?? '',
  complexity: (k) => k.complexity ?? '',
  delivery: (k) => k.expected_delivery_date ?? '',
  status: (k) => k.status,
}

export function KbiCatalogPage() {
  const { actor } = useActor()
  const { data, isLoading } = useQuery({ queryKey: ['kbis'], queryFn: () => listKbis(actor) })
  const [keyword, setKeyword] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('title')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const rows = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    const filtered = (data ?? []).filter((kbi) => {
      if (!normalized) return true
      const haystack = `${kbi.title} ${kbi.category.name} ${kbi.priority ?? ''} ${kbi.status}`.toLowerCase()
      return haystack.includes(normalized)
    })
    const accessor = SORT_ACCESSORS[sortKey]
    const sorted = [...filtered].sort((a, b) => accessor(a).localeCompare(accessor(b)))
    return sortDir === 'asc' ? sorted : sorted.reverse()
  }, [data, keyword, sortKey, sortDir])

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Change Business</h1>
      </div>

      <NewKbiForm />

      <section className="card">
        <div className="catalog-toolbar">
          <input
            className="catalog-search-input"
            placeholder="Search Asks…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        {isLoading && <p>Loading…</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-muted">{keyword ? 'No Asks match your search.' : 'No Change Business Asks yet.'}</p>
        )}
        {rows.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <SortableTh label="Ask" sortKey="title" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                  <SortableTh
                    label="Category"
                    sortKey="category"
                    currentKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="Priority"
                    sortKey="priority"
                    currentKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="Complexity"
                    sortKey="complexity"
                    currentKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="Delivery Date"
                    sortKey="delivery"
                    currentKey={sortKey}
                    direction={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((kbi) => (
                  <tr key={kbi.id}>
                    <td>{kbi.title}</td>
                    <td>{kbi.category.name}</td>
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
        )}
      </section>
    </div>
  )
}
