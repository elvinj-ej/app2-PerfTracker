interface Props<K extends string> {
  label: string
  sortKey: K
  currentKey: K
  direction: 'asc' | 'desc'
  onSort: (key: K) => void
}

export function SortableTh<K extends string>({ label, sortKey, currentKey, direction, onSort }: Props<K>) {
  const active = sortKey === currentKey
  return (
    <th className="sortable-th" onClick={() => onSort(sortKey)}>
      {label}
      {active && <span className="sortable-th-arrow">{direction === 'asc' ? ' ▲' : ' ▼'}</span>}
    </th>
  )
}
