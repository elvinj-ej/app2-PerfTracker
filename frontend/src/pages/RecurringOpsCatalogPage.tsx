import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createRecurringOps, listRecurringOps, listRecurringOpsCategories } from '../api/recurringOps'
import { Alert } from '../components/common/Alert'
import { FormField } from '../components/common/FormField'
import { SortableTh } from '../components/common/SortableTh'
import { useActor } from '../context/ActorContext'
import { useToast } from '../context/ToastContext'
import type { RecurringOps } from '../types/api'

type SortKey = 'title' | 'category' | 'recurrence' | 'priority' | 'status'

function NewRecurringOpsForm() {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const toast = useToast()
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
      toast.success('Run Operations Ask created')
      setTitle('')
      setDescription('')
      setCategoryId('')
    },
  })

  if (actor.role !== 'manager') return null

  return (
    <section className="card">
      <h2>New Run Operations Item</h2>
      {mutation.isError && <Alert variant="error">{(mutation.error as Error).message}</Alert>}
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

const SORT_ACCESSORS: Record<SortKey, (r: RecurringOps) => string> = {
  title: (r) => r.title,
  category: (r) => r.category.name,
  recurrence: (r) => r.recurrence_type,
  priority: (r) => r.priority ?? '',
  status: (r) => r.status,
}

export function RecurringOpsCatalogPage() {
  const { actor } = useActor()
  const { data, isLoading } = useQuery({ queryKey: ['recurring-ops'], queryFn: () => listRecurringOps(actor) })
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
    const filtered = (data ?? []).filter((r) => {
      if (!normalized) return true
      const haystack = `${r.title} ${r.category.name} ${r.recurrence_type} ${r.priority ?? ''} ${r.status}`.toLowerCase()
      return haystack.includes(normalized)
    })
    const accessor = SORT_ACCESSORS[sortKey]
    const sorted = [...filtered].sort((a, b) => accessor(a).localeCompare(accessor(b)))
    return sortDir === 'asc' ? sorted : sorted.reverse()
  }, [data, keyword, sortKey, sortDir])

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Run Operations</h1>
      </div>

      <NewRecurringOpsForm />

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
          <p className="text-muted">{keyword ? 'No Asks match your search.' : 'No Run Operations Asks yet.'}</p>
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
                    label="Recurrence"
                    sortKey="recurrence"
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
                  <SortableTh label="Status" sortKey="status" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
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
        )}
      </section>
    </div>
  )
}
