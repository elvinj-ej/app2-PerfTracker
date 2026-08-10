import type { Actor } from '../context/ActorContext'
import type { Kbi, KbiCategory } from '../types/api'
import { apiFetch } from './client'

export interface KbiPayload {
  title: string
  description?: string | null
  business_goal?: string | null
  ask?: string | null
  category_id: number
  jira_number?: string | null
  start_date?: string | null
  expected_delivery_date?: string | null
  priority?: string | null
  complexity?: string | null
  status?: string
}

export function listKbis(actor: Actor): Promise<Kbi[]> {
  return apiFetch<Kbi[]>('/api/kbis', actor)
}

export function listKbiCategories(actor: Actor): Promise<KbiCategory[]> {
  return apiFetch<KbiCategory[]>('/api/kbi-categories', actor)
}

export function getKbi(actor: Actor, id: number): Promise<Kbi> {
  return apiFetch<Kbi>(`/api/kbis/${id}`, actor)
}

export function createKbi(actor: Actor, payload: KbiPayload): Promise<Kbi> {
  return apiFetch<Kbi>('/api/kbis', actor, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateKbi(actor: Actor, id: number, payload: Partial<KbiPayload>): Promise<Kbi> {
  return apiFetch<Kbi>(`/api/kbis/${id}`, actor, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function optInKbi(actor: Actor, id: number, engineerId?: number): Promise<void> {
  return apiFetch<void>(`/api/kbis/${id}/opt-in`, actor, {
    method: 'POST',
    body: JSON.stringify({ engineer_id: engineerId ?? null }),
  })
}

export function optOutKbi(actor: Actor, id: number, engineerId?: number): Promise<void> {
  return apiFetch<void>(`/api/kbis/${id}/opt-in`, actor, {
    method: 'DELETE',
    body: JSON.stringify({ engineer_id: engineerId ?? null }),
  })
}

export function generateKbiBreakdown(actor: Actor, id: number, defaultOwnerEngineerId?: number) {
  return apiFetch(`/api/kbis/${id}/tasks/generate-ai-breakdown`, actor, {
    method: 'POST',
    body: JSON.stringify({ default_owner_engineer_id: defaultOwnerEngineerId ?? null }),
  })
}
