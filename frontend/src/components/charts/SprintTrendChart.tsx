export interface SprintTrendPoint {
  label: string
  value: number
}

export function SprintTrendChart({
  points,
  color,
  unit,
  formatValue,
}: {
  points: SprintTrendPoint[]
  color: string
  unit: string
  formatValue?: (value: number) => string
}) {
  const max = Math.max(1, ...points.map((p) => p.value))
  const format = formatValue ?? ((v: number) => `${v}`)

  return (
    <div className="sprint-trend-chart">
      {points.map((p) => (
        <div className="sprint-trend-col" key={p.label}>
          <span className="sprint-trend-value">{format(p.value)}</span>
          <div className="sprint-trend-track" title={`${p.label}: ${format(p.value)} ${unit}`}>
            <div
              className="sprint-trend-fill"
              style={{ height: `${(p.value / max) * 100}%`, background: color }}
            />
          </div>
          <span className="sprint-trend-label">{p.label}</span>
        </div>
      ))}
    </div>
  )
}
