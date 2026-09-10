import { NavLink } from 'react-router-dom'
import { useActor } from '../../context/ActorContext'
import { AoseMark } from './AoseMark'
import { MANAGER_NAV_GROUP, NAV_GROUPS } from './navConfig'
import { NavIcon, type NavIconName } from './NavIcon'

const STREAM_VAR: Partial<Record<NavIconName, string>> = {
  business: '--series-kbi',
  platform: '--series-platform',
  ops: '--series-recurring',
}

export function Sidebar() {
  const { actor } = useActor()
  const groups = actor.role === 'manager' ? [...NAV_GROUPS, MANAGER_NAV_GROUP] : NAV_GROUPS

  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <AoseMark size={44} />
        <div>
          <div className="app-brand-name">AOSE</div>
          <div className="app-brand-sub">
            Ask · Outcome ·<br />Scheduling · Engineering
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {groups.map((group) => (
          <div className="sidebar-group" key={group.label}>
            <div className="sidebar-group-label">{group.label}</div>
            {group.items.map((item) => {
              const streamVar = STREAM_VAR[item.icon]
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link')}
                >
                  <NavIcon name={item.icon} />
                  <span>{item.to === '/' && actor.role === 'manager' ? 'Team Dashboard' : item.label}</span>
                  {streamVar && <span className="sidebar-link-dot" style={{ background: `var(${streamVar})` }} />}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
