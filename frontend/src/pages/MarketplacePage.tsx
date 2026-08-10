import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEngineers } from '../api/engineers'
import { listKbis, optInKbi, optOutKbi } from '../api/kbis'
import { listPlatformInitiatives, optInPlatformInitiative, optOutPlatformInitiative } from '../api/platformInitiatives'
import { listRecurringOps, optInRecurringOps, optOutRecurringOps } from '../api/recurringOps'
import { CATEGORY_META } from '../components/charts/categoryMeta'
import { useActor } from '../context/ActorContext'
import type { InitiativeType } from '../types/api'

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: 'Recurs daily',
  WEEKLY: 'Recurs weekly',
  MONTHLY: 'Recurs monthly',
  QUARTERLY: 'Recurs quarterly',
  HALF_YEARLY: 'Recurs half-yearly',
  ANNUAL: 'Recurs annually',
  AD_HOC: 'As needed',
}

const PRIORITY_BADGE: Record<string, string> = {
  CRITICAL: 'badge-red',
  HIGH: 'badge-amber',
  MEDIUM: 'badge-gray',
  LOW: 'badge-green',
}

const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

interface MarketplaceRow {
  key: string
  type: InitiativeType
  title: string
  categoryName: string
  priority: string | null
  cadenceLabel: string
  detailPath: string
  engineerIds: number[]
  optIn: () => Promise<void>
  optOut: () => Promise<void>
  invalidateKey: string
}

export function MarketplacePage() {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const [typeFilter, setTypeFilter] = useState<InitiativeType | 'ALL'>('ALL')
  const [openOnly, setOpenOnly] = useState(true)
  const [keyword, setKeyword] = useState('')

  const { data: engineers } = useQuery({ queryKey: ['engineers'], queryFn: () => listEngineers(actor) })
  const kbisQuery = useQuery({ queryKey: ['kbis'], queryFn: () => listKbis(actor) })
  const platformQuery = useQuery({ queryKey: ['platform-initiatives'], queryFn: () => listPlatformInitiatives(actor) })
  const runOpsQuery = useQuery({ queryKey: ['recurring-ops'], queryFn: () => listRecurringOps(actor) })

  const engineerName = (id: number) => engineers?.find((e) => e.id === id)?.name ?? `Engineer #${id}`

  // Every Ask type - Run Operations included - can be delivered by several engineers,
  // each owning a different Outcome, so being assigned to one doesn't mean closed to
  // others: it's indicated on the row, not hidden.
  const rows: MarketplaceRow[] = useMemo(() => {
    const kbiRows: MarketplaceRow[] = (kbisQuery.data ?? []).map((kbi) => ({
      key: `KBI-${kbi.id}`,
      type: 'KBI',
      title: kbi.title,
      categoryName: kbi.category.name,
      priority: kbi.priority,
      cadenceLabel: kbi.expected_delivery_date ? `Deliver by ${kbi.expected_delivery_date}` : 'No delivery date set',
      detailPath: `/kbis/${kbi.id}`,
      engineerIds: kbi.engineer_ids,
      optIn: () => optInKbi(actor, kbi.id),
      optOut: () => optOutKbi(actor, kbi.id),
      invalidateKey: 'kbis',
    }))
    const platformRows: MarketplaceRow[] = (platformQuery.data ?? []).map((p) => ({
      key: `PLATFORM-${p.id}`,
      type: 'PLATFORM',
      title: p.title,
      categoryName: p.category.name,
      priority: p.priority,
      cadenceLabel: p.expected_delivery_date ? `Deliver by ${p.expected_delivery_date}` : 'No delivery date set',
      detailPath: `/platform-initiatives/${p.id}`,
      engineerIds: p.engineer_ids,
      optIn: () => optInPlatformInitiative(actor, p.id),
      optOut: () => optOutPlatformInitiative(actor, p.id),
      invalidateKey: 'platform-initiatives',
    }))
    const runOpsRows: MarketplaceRow[] = (runOpsQuery.data ?? []).map((r) => ({
      key: `RECURRING_OPS-${r.id}`,
      type: 'RECURRING_OPS',
      title: r.title,
      categoryName: r.category.name,
      priority: r.priority,
      cadenceLabel: RECURRENCE_LABELS[r.recurrence_type] ?? r.recurrence_type,
      detailPath: `/recurring-ops/${r.id}`,
      engineerIds: r.engineer_ids,
      optIn: () => optInRecurringOps(actor, r.id),
      optOut: () => optOutRecurringOps(actor, r.id),
      invalidateKey: 'recurring-ops',
    }))

    return [...kbiRows, ...platformRows, ...runOpsRows].sort((a, b) => {
      const claimedDiff = Number(a.engineerIds.length > 0) - Number(b.engineerIds.length > 0)
      if (claimedDiff !== 0) return claimedDiff
      const rankDiff = (PRIORITY_RANK[a.priority ?? ''] ?? 9) - (PRIORITY_RANK[b.priority ?? ''] ?? 9)
      if (rankDiff !== 0) return rankDiff
      return a.title.localeCompare(b.title)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbisQuery.data, platformQuery.data, runOpsQuery.data, actor])

  const normalizedKeyword = keyword.trim().toLowerCase()

  const filtered = rows.filter((r) => {
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false
    if (openOnly && r.engineerIds.length > 0) return false
    if (normalizedKeyword) {
      const haystack = `${r.title} ${r.categoryName} ${r.priority ?? ''} ${r.cadenceLabel}`.toLowerCase()
      if (!haystack.includes(normalizedKeyword)) return false
    }
    return true
  })

  const optInMutation = useMutation({
    mutationFn: (row: MarketplaceRow) => row.optIn(),
    onSuccess: (_, row) => {
      queryClient.invalidateQueries({ queryKey: [row.invalidateKey] })
    },
  })
  const optOutMutation = useMutation({
    mutationFn: (row: MarketplaceRow) => row.optOut(),
    onSuccess: (_, row) => {
      queryClient.invalidateQueries({ queryKey: [row.invalidateKey] })
    },
  })

  const isLoading = kbisQuery.isLoading || platformQuery.isLoading || runOpsQuery.isLoading

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Marketplace</h1>
      </div>
      <p className="text-muted marketplace-intro">
        Every Ask across Run Operations, Change Business, and Change Platform in one place — pick
        up unclaimed work, or browse what teammates are already covering. Any Ask can take several
        engineers, each delivering a different Outcome, so a row stays here — marked "Already
        assigned" — even once someone else has opted in.
      </p>

      <div className="marketplace-filters">
        <button
          className={`marketplace-filter-tab ${typeFilter === 'ALL' ? 'marketplace-filter-tab-active' : ''}`}
          onClick={() => setTypeFilter('ALL')}
        >
          All
        </button>
        {CATEGORY_META.map((meta) => (
          <button
            key={meta.type}
            className={`marketplace-filter-tab ${typeFilter === meta.type ? 'marketplace-filter-tab-active' : ''}`}
            onClick={() => setTypeFilter(meta.type)}
          >
            {meta.label}
          </button>
        ))}
        <input
          type="search"
          className="marketplace-keyword-input"
          placeholder="Filter by keyword…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <span className="marketplace-filter-spacer" />
        <label className="marketplace-open-toggle">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          Unclaimed only
        </label>
      </div>

      {isLoading && <p>Loading…</p>}
      {!isLoading && filtered.length === 0 && <p className="text-muted">Nothing matches these filters.</p>}

      {filtered.length > 0 && (
        <section className="card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ask</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Cadence / Delivery</th>
                  <th>Assigned</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const isOptedIn = actor.role === 'engineer' && row.engineerIds.includes(actor.engineerId)
                  return (
                    <tr key={row.key}>
                      <td className="marketplace-ask-cell">
                        <Link to={row.detailPath}>{row.title}</Link>
                      </td>
                      <td>{row.categoryName}</td>
                      <td>
                        {row.priority && (
                          <span className={`badge ${PRIORITY_BADGE[row.priority] ?? 'badge-gray'}`}>{row.priority}</span>
                        )}
                      </td>
                      <td>{row.cadenceLabel}</td>
                      <td className="marketplace-assigned-cell">
                        {row.engineerIds.length === 0
                          ? 'Unclaimed'
                          : `Already assigned: ${row.engineerIds.map(engineerName).join(', ')}`}
                      </td>
                      <td>
                        {actor.role === 'engineer' && (
                          <button
                            className={isOptedIn ? 'btn btn-secondary' : 'btn btn-primary'}
                            disabled={optInMutation.isPending || optOutMutation.isPending}
                            onClick={() => (isOptedIn ? optOutMutation.mutate(row) : optInMutation.mutate(row))}
                          >
                            {isOptedIn ? 'Opt Out' : "I'll take this"}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
