import type { InitiativeType } from '../../types/api'

export interface CategoryMeta {
  type: InitiativeType
  label: string
  varName: string
}

export const CATEGORY_META: CategoryMeta[] = [
  { type: 'KBI', label: 'Change Business', varName: '--series-kbi' },
  { type: 'PLATFORM', label: 'Change Platform', varName: '--series-platform' },
  { type: 'RECURRING_OPS', label: 'Run Operations', varName: '--series-recurring' },
]

export const CATEGORY_META_BY_TYPE: Record<InitiativeType, CategoryMeta> = Object.fromEntries(
  CATEGORY_META.map((c) => [c.type, c]),
) as Record<InitiativeType, CategoryMeta>
