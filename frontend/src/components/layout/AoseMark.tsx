/** AOSE intake ring: open loop = asks entering, cyan dot = outcome leaving. */
export function AoseMark({ size = 44 }: { size?: number }) {
  const tile = size
  const ring = Math.round(size * 0.59)
  const stroke = Math.max(2, Math.round(size * 0.114))
  const dot = Math.max(4, Math.round(size * 0.18))
  const inset = Math.round(size * 0.227)
  return (
    <span className="aose-mark" style={{ width: tile, height: tile, borderRadius: Math.round(size * 0.27) }}>
      <span
        className="aose-mark-ring"
        style={{ width: ring, height: ring, borderWidth: stroke }}
      />
      <span
        className="aose-mark-dot"
        style={{ width: dot, height: dot, top: inset, right: inset }}
      />
    </span>
  )
}
