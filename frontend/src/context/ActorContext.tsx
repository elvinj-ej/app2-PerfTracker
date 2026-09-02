import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { MANAGER_NAMES } from '../data/managers'

export type Actor =
  | { role: 'manager'; managerName: string }
  | { role: 'engineer'; engineerId: number; engineerName: string }

interface ActorContextValue {
  actor: Actor
  setManager: (managerName: string) => void
  setEngineer: (engineerId: number, engineerName: string) => void
}

const STORAGE_KEY = 'perftracker.actor'
const DEFAULT_ACTOR: Actor = { role: 'manager', managerName: MANAGER_NAMES[0] }

const ActorContext = createContext<ActorContextValue | undefined>(undefined)

function loadStoredActor(): Actor {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return DEFAULT_ACTOR
  try {
    const parsed = JSON.parse(raw) as Actor
    // Older stored actors predate named managers - fall back rather than carry a
    // manager with no name into the new switcher.
    if (parsed.role === 'manager' && !parsed.managerName) return DEFAULT_ACTOR
    return parsed
  } catch {
    return DEFAULT_ACTOR
  }
}

export function ActorProvider({ children }: { children: ReactNode }) {
  const [actor, setActor] = useState<Actor>(loadStoredActor)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actor))
  }, [actor])

  const value = useMemo<ActorContextValue>(
    () => ({
      actor,
      setManager: (managerName) => setActor({ role: 'manager', managerName }),
      setEngineer: (engineerId, engineerName) => setActor({ role: 'engineer', engineerId, engineerName }),
    }),
    [actor],
  )

  return <ActorContext.Provider value={value}>{children}</ActorContext.Provider>
}

export function useActor(): ActorContextValue {
  const ctx = useContext(ActorContext)
  if (!ctx) throw new Error('useActor must be used within an ActorProvider')
  return ctx
}
