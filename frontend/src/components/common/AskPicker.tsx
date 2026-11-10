import { useEffect, useMemo, useRef, useState } from 'react'

export interface AskOption {
  id: number
  title: string
  typeLabel: string
  categoryName: string | null
}

interface Props {
  options: AskOption[]
  value: string
  onChange: (id: string) => void
  loading?: boolean
  placeholder?: string
}

export function AskPicker({ options, value, onChange, loading, placeholder = 'Search Asks by title…' }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => String(o.id) === value) ?? null

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q ? options.filter((o) => o.title.toLowerCase().includes(q)) : options
    const byGroup = new Map<string, AskOption[]>()
    for (const opt of matches) {
      // Change Business/Platform category names already embed the type ("Change
      // Business - Amplify") - only prefix it for categories that don't (Run Ops: "People").
      const category = opt.categoryName ?? 'Uncategorized'
      const key = category.toLowerCase().startsWith(opt.typeLabel.toLowerCase()) ? category : `${opt.typeLabel} · ${category}`
      if (!byGroup.has(key)) byGroup.set(key, [])
      byGroup.get(key)!.push(opt)
    }
    return [...byGroup.entries()]
  }, [options, query])

  if (loading) return <p className="text-muted">Loading your Asks…</p>
  if (options.length === 0) {
    return <p className="text-muted">No existing Asks found — import the parent Initiative first.</p>
  }

  return (
    <div className="ask-picker" ref={containerRef}>
      {selected && !open ? (
        <button
          type="button"
          className="ask-picker-selected"
          onClick={() => {
            setQuery('')
            setOpen(true)
          }}
        >
          <span>{selected.title}</span>
          <span className="ask-picker-change">Change</span>
        </button>
      ) : (
        <input
          className="ask-picker-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
      )}
      {open && (
        <div className="ask-picker-menu">
          {groups.length === 0 ? (
            <p className="ask-picker-empty text-muted">No Asks match "{query}"</p>
          ) : (
            groups.map(([group, items]) => (
              <div key={group} className="ask-picker-group">
                <div className="ask-picker-group-label">{group}</div>
                {items.map((opt) => (
                  <button
                    type="button"
                    key={opt.id}
                    className="ask-picker-option"
                    onClick={() => {
                      onChange(String(opt.id))
                      setQuery('')
                      setOpen(false)
                    }}
                  >
                    {opt.title}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
