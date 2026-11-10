export interface RankedBarItem {
  key: string | number
  label: string
  value: number
  colorVar: string
}

export function RankedBarChart({ items, unit = 'h' }: { items: RankedBarItem[]; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))

  return (
    <div className="bar-chart">
      {items.map((item) => {
        const widthPct = (item.value / max) * 100
        return (
          <div className="bar-chart-row" key={item.key}>
            <span className="bar-chart-row-label" title={item.label}>
              {item.label}
            </span>
            <div className="bar-chart-track">
              <div
                className="bar-chart-fill"
                style={{ width: `${widthPct}%`, background: `var(${item.colorVar})` }}
                title={`${item.label}: ${item.value.toFixed(1)}${unit}`}
              />
            </div>
            <span className="bar-chart-value">
              {item.value.toFixed(1)}
              {unit}
            </span>
          </div>
        )
      })}
    </div>
  )
}
