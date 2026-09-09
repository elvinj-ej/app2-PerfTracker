import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPlatformInitiative, listPlatformCategories, listPlatformInitiatives } from '../api/platformInitiatives'
import { Alert } from '../components/common/Alert'
import { FormField } from '../components/common/FormField'
import { SortableTh } from '../components/common/SortableTh'
import { useActor } from '../context/ActorContext'
import { useToast } from '../context/ToastContext'
import type { PlatformInitiative } from '../types/api'

type SortKey = 'title' | 'category' | 'delivery' | 'status'

function NewPlatformInitiativeForm() {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const toast = useToast()
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
      toast.success('Change Platform Ask created')
      setTitle('')
      setBusinessGoal('')
      setDeliveryDate('')
      setCategoryId('')
    },
  })

  if (actor.role !== 'manager') return null

  return (
    <section className="card">
      <h2>New Change Platform</h2>
      {mutation.isError && <Alert variant="error">{(mutation.error as Error).message}</Alert>}
      <div className="form-grid">
        <FormField label="Ask" hint="What needs to be delivered">
          <input placeholder="e.g. Q3 SQL Server Fleet Upgrade" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label="Business Goal" hint="The outcome this needs to achieve">
          <input placeholder="e.g. Maintain vendor support" value={businessGoal} onChange={(e) => setBusinessGoal(e.target.value)} />
        </FormField>
        <FormField label="Expected Delivery" hint="Target completion date">
          <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
        </FormField>
        <FormField label="Category" hint="Upgrade type, improvement, automation, etc.">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Category…</option>
            {(categories ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <button className="btn btn-primary" disabled={!title || !categoryId || mutation.isPending} onClick={() => mutation.mutate()}>
        Create
      </button>
    </section>
  )
}

const SORT_ACCESSORS: Record<SortKey, (p: PlatformInitiative) => string> = {
  title: (p) => p.title,
  category: (p) => p.category.name,
  delivery: (p) => p.expected_delivery_date ?? '',
  status: (p) => p.status,
}

export function PlatformInitiativeCatalogPage() {
  const { actor } = useActor()
  const { data, isLoading } = useQuery({
    queryKey: ['platform-initiatives'],
    queryFn: () => listPlatformInitiatives(actor),
  })
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
    const filtered = (data ?? []).filter((p) => {
      if (!normalized) return true
      const haystack = `${p.title} ${p.category.name} ${p.status}`.toLowerCase()
      return haystack.includes(normalized)
    })
    const accessor = SORT_ACCESSORS[sortKey]
    const sorted = [...filtered].sort((a, b) => accessor(a).localeCompare(accessor(b)))
    return sortDir === 'asc' ? sorted : sorted.reverse()
  }, [data, keyword, sortKey, sortDir])

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Change Platform</h1>
      </div>

      <NewPlatformInitiativeForm />

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
          <p className="text-muted">{keyword ? 'No Asks match your search.' : 'No Change Platform Asks yet.'}</p>
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
                {rows.map((initiative) => (
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
        )}
      </section>
    </div>
  )
}
