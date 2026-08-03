import type { Actor } from '../context/ActorContext'
import type { EngineerDashboard, MonthlyReport, TeamSummary } from '../types/api'
import { apiFetch, downloadFile } from './client'

export function getEngineerDashboard(actor: Actor, engineerId: number): Promise<EngineerDashboard> {
  return apiFetch<EngineerDashboard>(`/api/engineers/${engineerId}/dashboard`, actor)
}

export function getTeamSummary(actor: Actor): Promise<TeamSummary> {
  return apiFetch<TeamSummary>('/api/team/summary', actor)
}

export function getAvailableMonths(actor: Actor): Promise<string[]> {
  return apiFetch<string[]>('/api/reports/monthly/available-months', actor)
}

export function getMonthlyReport(actor: Actor, month: string): Promise<MonthlyReport> {
  return apiFetch<MonthlyReport>(`/api/reports/monthly?month=${encodeURIComponent(month)}`, actor)
}

export function downloadMonthlyReportExport(actor: Actor, month: string): Promise<void> {
  return downloadFile(
    `/api/reports/monthly/export?month=${encodeURIComponent(month)}`,
    actor,
    `perftracker-monthly-report-${month}.xlsx`,
  )
}
