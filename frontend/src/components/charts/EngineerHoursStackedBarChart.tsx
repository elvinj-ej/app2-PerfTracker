import type { InitiativeType } from '../../types/api'
import { CATEGORY_META } from './categoryMeta'

export interface EngineerHoursRow {
  label: string
  hoursByType: Partial<Record<InitiativeType, number>>
}

export function EngineerHoursStackedBarChart({ rows }: { rows: EngineerHoursRow[] }) {
  const totals = rows.map((r) => Object.values(r.hoursByType).reduce((sum, v) => sum + (v ?? 0), 0))
  const max = Math.max(1, ...totals)

  return (
    <div className="stacked-bar-chart">
      <div className="chart-legend">
        {CATEGORY_META.map((c) => (
          <span key={c.type} className="legend-item">
            <span className="legend-swatch" style={{ background: `var(${c.varName})` }} />
            {c.label}
          </span>
        ))}
      </div>
      <div className="stacked-bar-rows">
        {rows.map((row, rowIndex) => {
          const segments = CATEGORY_META.map((c) => ({ meta: c, value: row.hoursByType[c.type] ?? 0 })).filter(
            (s) => s.value > 0,
          )
          return (
            <div className="stacked-bar-row" key={row.label}>
              <span className="stacked-bar-row-label">{row.label}</span>
              <div className="stacked-bar-track">
                {segments.map((s, i) => (
                  <div
                    key={s.meta.type}
                    className="stacked-bar-segment"
                    style={{
                      width: `${(s.value / max) * 100}%`,
                      background: `var(${s.meta.varName})`,
                      marginRight: i < segments.length - 1 ? '2px' : 0,
                      borderRadius:
                        i === 0 && i === segments.length - 1
                          ? '4px'
                          : i === 0
                            ? '4px 0 0 4px'
                            : i === segments.length - 1
                              ? '0 4px 4px 0'
                              : 0,
                    }}
                    title={`${s.meta.label}: ${s.value.toFixed(1)}h`}
                  />
                ))}
              </div>
              <span className="stacked-bar-total">{totals[rowIndex].toFixed(1)}h</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
