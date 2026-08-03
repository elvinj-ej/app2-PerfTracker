import type { Actor } from '../context/ActorContext'
import type { Engineer } from '../types/api'
import { apiFetch } from './client'

export function listEngineers(actor: Actor): Promise<Engineer[]> {
  return apiFetch<Engineer[]>('/api/engineers', actor)
}
