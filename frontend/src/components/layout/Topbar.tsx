import type { ChangeEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { listEngineers } from '../../api/engineers'
import { useActor } from '../../context/ActorContext'
import { MANAGER_NAMES } from '../../data/managers'
import { findNavLabel } from './navConfig'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

export function Topbar() {
  const { actor, setManager, setEngineer } = useActor()
  const location = useLocation()
  const { data: engineers } = useQuery({
    queryKey: ['engineers'],
    queryFn: () => listEngineers({ role: 'manager', managerName: MANAGER_NAMES[0] }),
  })

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value
    if (value.startsWith('manager:')) {
      setManager(value.slice('manager:'.length))
      return
    }
    const engineer = engineers?.find((eng) => String(eng.id) === value)
    if (engineer) {
      setEngineer(engineer.id, engineer.name)
    }
  }

  const currentValue = actor.role === 'manager' ? `manager:${actor.managerName}` : String(actor.engineerId)
  const rawSectionLabel = findNavLabel(location.pathname) ?? 'My Dashboard'
  const sectionLabel = rawSectionLabel === 'My Dashboard' && actor.role === 'manager' ? 'Team Dashboard' : rawSectionLabel
  const actorDisplayName = actor.role === 'manager' ? actor.managerName : actor.engineerName

  return (
    <header className="app-topbar">
      <div className="app-topbar-crumb">{sectionLabel}</div>
      <label className="actor-chip">
        <span className="actor-chip-avatar">{initials(actorDisplayName)}</span>
        <span className="actor-chip-label">Viewing as</span>
        <select value={currentValue} onChange={handleChange}>
          <optgroup label="Manager">
            {MANAGER_NAMES.map((name) => (
              <option key={name} value={`manager:${name}`}>
                {name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Engineer">
            {engineers?.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
    </header>
  )
}
