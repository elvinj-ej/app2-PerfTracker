import type { Actor } from '../context/ActorContext'
import type { EngineerDashboard, TeamSummary } from '../types/api'
import { apiFetch } from './client'

export function getEngineerDashboard(actor: Actor, engineerId: number): Promise<EngineerDashboard> {
  return apiFetch<EngineerDashboard>(`/api/engineers/${engineerId}/dashboard`, actor)
}

export function getTeamSummary(actor: Actor): Promise<TeamSummary> {
  return apiFetch<TeamSummary>('/api/team/summary', actor)
}
