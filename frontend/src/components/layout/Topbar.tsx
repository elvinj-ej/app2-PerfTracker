import type { ChangeEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { listEngineers } from '../../api/engineers'
import { useActor } from '../../context/ActorContext'
import { MANAGER_NAMES } from '../../data/managers'
import { findNavLabel } from './navConfig'

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
  const sectionLabel = findNavLabel(location.pathname) ?? 'My Dashboard'

  return (
    <header className="app-topbar">
      <div className="app-topbar-crumb">{sectionLabel}</div>
      <label className="actor-switcher">
        Viewing as
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
