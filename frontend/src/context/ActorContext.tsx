import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Actor = { role: 'manager' } | { role: 'engineer'; engineerId: number; engineerName: string }

interface ActorContextValue {
  actor: Actor
  setManager: () => void
  setEngineer: (engineerId: number, engineerName: string) => void
}

const STORAGE_KEY = 'perftracker.actor'

const ActorContext = createContext<ActorContextValue | undefined>(undefined)

function loadStoredActor(): Actor {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { role: 'manager' }
  try {
    return JSON.parse(raw) as Actor
  } catch {
    return { role: 'manager' }
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
      setManager: () => setActor({ role: 'manager' }),
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
