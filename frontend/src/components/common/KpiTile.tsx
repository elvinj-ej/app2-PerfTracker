import type { ReactNode } from 'react'

export function KpiTile({ label, value, unit, children }: {
  label: string
  value: ReactNode
  unit?: string
  children?: ReactNode
}) {
  return (
    <div className="kpi-tile">
      <span className="kpi-label">{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="kpi-value">{value}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      {children}
    </div>
  )
}
