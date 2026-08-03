import type { InitiativeType } from '../../types/api'
import { CATEGORY_META_BY_TYPE } from './categoryMeta'

export function CategoryHoursBarChart({ data }: { data: { initiative_type: InitiativeType; hours: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.hours))

  return (
    <div className="bar-chart">
      {data.map((d) => {
        const meta = CATEGORY_META_BY_TYPE[d.initiative_type]
        const widthPct = (d.hours / max) * 100
        return (
          <div className="bar-chart-row" key={d.initiative_type}>
            <span className="bar-chart-row-label">{meta.label}</span>
            <div className="bar-chart-track">
              <div
                className="bar-chart-fill"
                style={{ width: `${widthPct}%`, background: `var(${meta.varName})` }}
                title={`${meta.label}: ${d.hours.toFixed(1)}h`}
              />
            </div>
            <span className="bar-chart-value">{d.hours.toFixed(1)}h</span>
          </div>
        )
      })}
    </div>
  )
}
