import type { Actor } from '../context/ActorContext'
import type { Sprint } from '../types/api'
import { apiFetch } from './client'

export function getSprints(actor: Actor): Promise<Sprint[]> {
  return apiFetch<Sprint[]>('/api/sprints', actor)
}
