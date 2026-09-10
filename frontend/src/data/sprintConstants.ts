import type { Sprint } from '../types/api'

// Mirrors backend/app/services/sprint.py's MAX_FORECAST_DAYS.
export const MAX_FORECAST_DAYS = 11

/** True if an ISO date or datetime string falls within a sprint's [start, end] window
 * (inclusive) - works for both plain dates ("2026-07-14") and full timestamps
 * ("2026-07-14T23:59:00Z") since only the date portion is compared. */
export function inSprintWindow(iso: string | null, sprint: Sprint | undefined): boolean {
  if (!iso || !sprint) return false
  const d = iso.slice(0, 10)
  return d >= sprint.start_date && d <= sprint.end_date
}
