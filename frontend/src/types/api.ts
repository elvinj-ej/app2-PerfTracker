export type InitiativeType = 'KBI' | 'PLATFORM' | 'RECURRING_OPS'
export type TaskStage =
  | 'HLD'
  | 'LLD'
  | 'SOLUTION_DESIGN_APPROVAL'
  | 'NON_PROD_DEPLOYMENT'
  | 'PROD_DEPLOYMENT'
  | 'OTHER'
export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETE'
export type TimelineHealth = 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'NOT_APPLICABLE'
export type UpgradeUnitStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'SKIPPED'

export interface Engineer {
  id: number
  name: string
  email: string
  title: string | null
  active: boolean
}

export interface PlatformInitiativeCategory {
  id: number
  name: string
  description: string | null
  is_upgrade_type: boolean
  active: boolean
  sort_order: number
}

export interface InitiativeSummary {
  id: number
  type: InitiativeType
  title: string
  status: string
  category_name: string | null
  start_date: string | null
  expected_delivery_date: string | null
  completion_pct: number | null
  expected_pct: number | null
  timeline_health: TimelineHealth
  total_hours_logged: number
}

export interface TaskSummary {
  id: number
  initiative_id: number
  initiative_title: string
  initiative_type: InitiativeType
  title: string
  stage: TaskStage | null
  status: TaskStatus
  forecast_duration_days: number | null
  actual_hours_logged: number
}

export interface WeeklyHours {
  week_start_date: string
  fiscal_year_label: string
  initiative_type: InitiativeType
  hours: number
}

export interface EngineerDashboard {
  engineer_id: number
  engineer_name: string
  kbis: InitiativeSummary[]
  platform_initiatives: InitiativeSummary[]
  recurring_ops: InitiativeSummary[]
  tasks: TaskSummary[]
  weekly_hours: WeeklyHours[]
}

export interface Task {
  id: number
  initiative_id: number
  title: string
  description: string | null
  stage: TaskStage | null
  owner_engineer_id: number
  forecast_duration_days: number | null
  status: TaskStatus
  sequence_order: number
  is_ai_generated: boolean
}

export interface Kbi {
  id: number
  type: InitiativeType
  title: string
  description: string | null
  business_goal: string | null
  jira_number: string | null
  start_date: string | null
  expected_delivery_date: string | null
  priority: string | null
  complexity: string | null
  status: string
  engineer_ids: number[]
}

export interface PlatformInitiative {
  id: number
  type: InitiativeType
  title: string
  description: string | null
  business_goal: string | null
  jira_number: string | null
  start_date: string | null
  expected_delivery_date: string | null
  priority: string | null
  complexity: string | null
  status: string
  category: PlatformInitiativeCategory
  engineer_ids: number[]
}

export interface RecurringOps {
  id: number
  type: InitiativeType
  title: string
  description: string | null
  status: string
  recurrence_type: string
  recurrence_interval: number
  anchor_month: number | null
  anchor_day: number | null
  engineer_ids: number[]
}

export interface UpgradeUnit {
  id: number
  initiative_id: number
  system_name: string
  system_type: string | null
  status: UpgradeUnitStatus
  completed_date: string | null
}

export interface TimeEntry {
  id: number
  task_id: number
  engineer_id: number
  week_start_date: string
  fiscal_year_label: string
  hours: number
  notes: string | null
}

export interface CategoryHours {
  initiative_type: InitiativeType
  hours: number
}

export interface EngineerHoursBreakdown {
  engineer_id: number
  engineer_name: string
  hours_by_type: Partial<Record<InitiativeType, number>>
  total_hours: number
}

export interface TeamSummary {
  kbis: InitiativeSummary[]
  platform_initiatives: InitiativeSummary[]
  recurring_ops: InitiativeSummary[]
  hours_by_category: CategoryHours[]
  hours_by_engineer: EngineerHoursBreakdown[]
}

export interface MonthlyTaskDetail {
  id: number
  initiative_id: number
  title: string
  stage: TaskStage | null
  owner_engineer_id: number
  owner_engineer_name: string
  forecast_duration_days: number | null
  status: TaskStatus
  hours_this_month: number
}

export interface MonthlyInitiativeReport {
  id: number
  type: InitiativeType
  title: string
  category_name: string | null
  status: string
  completion_pct: number | null
  expected_delivery_date: string | null
  tasks: MonthlyTaskDetail[]
  total_hours_this_month: number
}

export interface MonthlyReport {
  month: string
  kbis: MonthlyInitiativeReport[]
  platform_initiatives: MonthlyInitiativeReport[]
  recurring_ops: MonthlyInitiativeReport[]
}

export interface JiraImportPreview {
  jira_number: string | null
  title: string
  description: string | null
  business_goal: string | null
  start_date: string | null
  expected_delivery_date: string | null
  priority: string | null
  suggested_status: string
  skipped_linked_issues: number
}
