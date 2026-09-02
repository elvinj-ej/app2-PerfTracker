import type { Actor } from '../context/ActorContext'
import type { Task } from '../types/api'
import { apiFetch } from './client'

export interface TaskPayload {
  title: string
  description?: string | null
  stage?: string | null
  owner_engineer_id: number | null
  forecast_duration_days?: number | null
  start_date?: string | null
  delivery_date?: string | null
  status?: string
}

export function listTasks(actor: Actor, initiativeId: number): Promise<Task[]> {
  return apiFetch<Task[]>(`/api/initiatives/${initiativeId}/tasks`, actor)
}

export function createTask(actor: Actor, initiativeId: number, payload: TaskPayload): Promise<Task> {
  return apiFetch<Task>(`/api/initiatives/${initiativeId}/tasks`, actor, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTask(actor: Actor, taskId: number, payload: Partial<TaskPayload>): Promise<Task> {
  return apiFetch<Task>(`/api/tasks/${taskId}`, actor, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function deleteTask(actor: Actor, taskId: number): Promise<void> {
  return apiFetch<void>(`/api/tasks/${taskId}`, actor, { method: 'DELETE' })
}

export function reorderTasks(actor: Actor, initiativeId: number, taskIdsInOrder: number[]): Promise<Task[]> {
  return apiFetch<Task[]>(`/api/initiatives/${initiativeId}/tasks/reorder`, actor, {
    method: 'POST',
    body: JSON.stringify({ task_ids_in_order: taskIdsInOrder }),
  })
}
