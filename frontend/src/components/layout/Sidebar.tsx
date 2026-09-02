import { NavLink } from 'react-router-dom'
import { useActor } from '../../context/ActorContext'
import { MANAGER_NAV_GROUP, NAV_GROUPS } from './navConfig'
import { NavIcon } from './NavIcon'

export function Sidebar() {
  const { actor } = useActor()
  const groups = actor.role === 'manager' ? [...NAV_GROUPS, MANAGER_NAV_GROUP] : NAV_GROUPS

  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <span className="app-brand-mark">CT</span>
        <span className="app-brand-name">Cloud Team Performance Tracker</span>
      </div>
      <nav className="sidebar-nav">
        {groups.map((group) => (
          <div className="sidebar-group" key={group.label}>
            <div className="sidebar-group-label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link')}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
