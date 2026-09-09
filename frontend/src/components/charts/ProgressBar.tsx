export function ProgressBar({ pct, behind }: { pct: number | null; behind?: boolean }) {
  if (pct === null) return <span className="text-muted">—</span>
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div className="progress-bar">
      <div className="progress-bar-track">
        <div className={`progress-bar-fill${behind ? ' progress-bar-fill-behind' : ''}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="progress-bar-label">{pct.toFixed(0)}%</span>
    </div>
  )
}
