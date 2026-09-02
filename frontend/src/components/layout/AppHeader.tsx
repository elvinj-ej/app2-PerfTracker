import { useQuery } from '@tanstack/react-query'
import type { ChangeEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { listEngineers } from '../../api/engineers'
import { useActor } from '../../context/ActorContext'
import { MANAGER_NAMES } from '../../data/managers'

const NAV_LINKS = [
  { to: '/', label: 'My Dashboard' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/team', label: 'Team Summary' },
  { to: '/reports/monthly', label: 'Monthly Report' },
  { to: '/kbis', label: 'Change Business' },
  { to: '/platform-initiatives', label: 'Change Platform' },
  { to: '/recurring-ops', label: 'Run Operations' },
  { to: '/log-time', label: 'Log Time' },
]

const MANAGER_ONLY_NAV_LINKS = [
  { to: '/import', label: 'Import from Jira' },
  { to: '/import/ask-catalog', label: 'Upload Marketplace' },
]

export function AppHeader() {
  const { actor, setManager, setEngineer } = useActor()
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

  return (
    <header className="app-header">
      <div className="app-header-top">
        <h1>Cloud Team Performance Tracker</h1>
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
      </div>
      <nav className="nav-tabs">
        {[...NAV_LINKS, ...(actor.role === 'manager' ? MANAGER_ONLY_NAV_LINKS : [])].map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => (isActive ? 'nav-tab nav-tab-active' : 'nav-tab')}>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
