export function ProgressBar({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-muted">—</span>
  }
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div className="progress-bar">
      <div className="progress-bar-fill" style={{ width: `${clamped}%` }} />
      <span className="progress-bar-label">{pct.toFixed(0)}%</span>
    </div>
  )
}
