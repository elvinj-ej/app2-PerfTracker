import type { Actor } from '../context/ActorContext'
import type { RecurringOps } from '../types/api'
import { apiFetch } from './client'

export interface RecurringOpsPayload {
  title: string
  description?: string | null
  status?: string
  recurrence_type: string
  recurrence_interval?: number
  anchor_month?: number | null
  anchor_day?: number | null
}

export function listRecurringOps(actor: Actor): Promise<RecurringOps[]> {
  return apiFetch<RecurringOps[]>('/api/recurring-ops', actor)
}

export function getRecurringOps(actor: Actor, id: number): Promise<RecurringOps> {
  return apiFetch<RecurringOps>(`/api/recurring-ops/${id}`, actor)
}

export function createRecurringOps(actor: Actor, payload: RecurringOpsPayload): Promise<RecurringOps> {
  return apiFetch<RecurringOps>('/api/recurring-ops', actor, { method: 'POST', body: JSON.stringify(payload) })
}

export function optInRecurringOps(actor: Actor, id: number, engineerId?: number): Promise<void> {
  return apiFetch<void>(`/api/recurring-ops/${id}/opt-in`, actor, {
    method: 'POST',
    body: JSON.stringify({ engineer_id: engineerId ?? null }),
  })
}

export function optOutRecurringOps(actor: Actor, id: number, engineerId?: number): Promise<void> {
  return apiFetch<void>(`/api/recurring-ops/${id}/opt-in`, actor, {
    method: 'DELETE',
    body: JSON.stringify({ engineer_id: engineerId ?? null }),
  })
}
