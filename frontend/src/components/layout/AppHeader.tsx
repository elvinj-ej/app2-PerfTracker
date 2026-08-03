import { useQuery } from '@tanstack/react-query'
import type { ChangeEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { listEngineers } from '../../api/engineers'
import { useActor } from '../../context/ActorContext'

const NAV_LINKS = [
  { to: '/', label: 'My Dashboard' },
  { to: '/team', label: 'Team Summary' },
  { to: '/kbis', label: 'Key Business Initiatives' },
  { to: '/platform-initiatives', label: 'Platform Initiatives' },
  { to: '/recurring-ops', label: 'Recurring Operations' },
  { to: '/log-time', label: 'Log Time' },
]

export function AppHeader() {
  const { actor, setManager, setEngineer } = useActor()
  const { data: engineers } = useQuery({
    queryKey: ['engineers'],
    queryFn: () => listEngineers({ role: 'manager' }),
  })

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value
    if (value === 'manager') {
      setManager()
      return
    }
    const engineer = engineers?.find((eng) => String(eng.id) === value)
    if (engineer) {
      setEngineer(engineer.id, engineer.name)
    }
  }

  const currentValue = actor.role === 'manager' ? 'manager' : String(actor.engineerId)

  return (
    <header className="app-header">
      <div className="app-header-top">
        <h1>Cloud Team Performance Tracker</h1>
        <label className="actor-switcher">
          Viewing as
          <select value={currentValue} onChange={handleChange}>
            <option value="manager">Manager</option>
            {engineers?.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <nav className="nav-tabs">
        {NAV_LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => (isActive ? 'nav-tab nav-tab-active' : 'nav-tab')}>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
