import type { Actor } from '../context/ActorContext'
import type { PlatformInitiative, PlatformInitiativeCategory, UpgradeUnit } from '../types/api'
import { apiFetch } from './client'

export interface PlatformInitiativePayload {
  title: string
  description?: string | null
  business_goal?: string | null
  jira_number?: string | null
  start_date?: string | null
  expected_delivery_date?: string | null
  priority?: string | null
  complexity?: string | null
  status?: string
  category_id: number
}

export function listPlatformInitiatives(actor: Actor): Promise<PlatformInitiative[]> {
  return apiFetch<PlatformInitiative[]>('/api/platform-initiatives', actor)
}

export function getPlatformInitiative(actor: Actor, id: number): Promise<PlatformInitiative> {
  return apiFetch<PlatformInitiative>(`/api/platform-initiatives/${id}`, actor)
}

export function createPlatformInitiative(actor: Actor, payload: PlatformInitiativePayload): Promise<PlatformInitiative> {
  return apiFetch<PlatformInitiative>('/api/platform-initiatives', actor, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function optInPlatformInitiative(actor: Actor, id: number, engineerId?: number): Promise<void> {
  return apiFetch<void>(`/api/platform-initiatives/${id}/opt-in`, actor, {
    method: 'POST',
    body: JSON.stringify({ engineer_id: engineerId ?? null }),
  })
}

export function optOutPlatformInitiative(actor: Actor, id: number, engineerId?: number): Promise<void> {
  return apiFetch<void>(`/api/platform-initiatives/${id}/opt-in`, actor, {
    method: 'DELETE',
    body: JSON.stringify({ engineer_id: engineerId ?? null }),
  })
}

export function generatePlatformInitiativeBreakdown(actor: Actor, id: number, defaultOwnerEngineerId?: number) {
  return apiFetch(`/api/platform-initiatives/${id}/tasks/generate-ai-breakdown`, actor, {
    method: 'POST',
    body: JSON.stringify({ default_owner_engineer_id: defaultOwnerEngineerId ?? null }),
  })
}

export function listPlatformCategories(actor: Actor): Promise<PlatformInitiativeCategory[]> {
  return apiFetch<PlatformInitiativeCategory[]>('/api/platform-initiative-categories', actor)
}

export function listUpgradeUnits(actor: Actor, initiativeId: number): Promise<UpgradeUnit[]> {
  return apiFetch<UpgradeUnit[]>(`/api/platform-initiatives/${initiativeId}/upgrade-units`, actor)
}

export function createUpgradeUnit(
  actor: Actor,
  initiativeId: number,
  payload: { system_name: string; system_type?: string | null },
): Promise<UpgradeUnit> {
  return apiFetch<UpgradeUnit>(`/api/platform-initiatives/${initiativeId}/upgrade-units`, actor, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateUpgradeUnit(
  actor: Actor,
  unitId: number,
  payload: Partial<Pick<UpgradeUnit, 'status' | 'completed_date'>>,
): Promise<UpgradeUnit> {
  return apiFetch<UpgradeUnit>(`/api/upgrade-units/${unitId}`, actor, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
