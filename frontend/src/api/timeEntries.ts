import type { Actor } from '../context/ActorContext'
import type { TimeEntry } from '../types/api'
import { apiFetch } from './client'

export function listTimeEntries(actor: Actor, params: { engineerId?: number; taskId?: number }): Promise<TimeEntry[]> {
  const query = new URLSearchParams()
  if (params.engineerId !== undefined) query.set('engineer_id', String(params.engineerId))
  if (params.taskId !== undefined) query.set('task_id', String(params.taskId))
  const qs = query.toString()
  return apiFetch<TimeEntry[]>(`/api/time-entries${qs ? `?${qs}` : ''}`, actor)
}

export function upsertTimeEntry(
  actor: Actor,
  payload: { task_id: number; week_start_date: string; hours: number; notes?: string | null },
): Promise<TimeEntry> {
  return apiFetch<TimeEntry>('/api/time-entries', actor, { method: 'POST', body: JSON.stringify(payload) })
}
