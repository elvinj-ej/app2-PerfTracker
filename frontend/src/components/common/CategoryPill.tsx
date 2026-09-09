import type { InitiativeType } from '../../types/api'
import { CATEGORY_META_BY_TYPE } from '../charts/categoryMeta'

export function CategoryPill({ type, detail }: { type: InitiativeType; detail?: string | null }) {
  const meta = CATEGORY_META_BY_TYPE[type]
  return (
    <span className={`category-pill category-pill-${type}`}>
      <span className="category-pill-dot" />
      {detail ? `${meta.label} · ${detail}` : meta.label}
    </span>
  )
}
