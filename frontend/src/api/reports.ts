import type { Actor } from '../context/ActorContext'
import type { CompletedOutcomeDetail, EngineerDashboard, FundedAskReport, MonthlyReport, TeamSummary } from '../types/api'
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
    `aose-monthly-report-${month}.xlsx`,
  )
}

export function getFundedChangeBusinessReport(actor: Actor): Promise<FundedAskReport[]> {
  return apiFetch<FundedAskReport[]>('/api/reports/funded-change-business', actor)
}

export function downloadFundedChangeBusinessExport(actor: Actor): Promise<void> {
  return downloadFile('/api/reports/funded-change-business/export', actor, 'aose-funded-change-business.xlsx')
}

export function getEngineerCompletedOutcomes(actor: Actor, engineerId: number): Promise<CompletedOutcomeDetail[]> {
  return apiFetch<CompletedOutcomeDetail[]>(`/api/engineers/${engineerId}/reports/completed-outcomes`, actor)
}

export function downloadEngineerCompletedOutcomes(actor: Actor, engineerId: number, engineerName: string): Promise<void> {
  return downloadFile(
    `/api/engineers/${engineerId}/reports/completed-outcomes/export`,
    actor,
    `aose-completed-outcomes-${engineerName.replace(/\s+/g, '-')}.xlsx`,
  )
}
