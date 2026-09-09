import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface ConfirmOptions {
  title?: string
  confirmLabel?: string
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  message: string
  resolve: (confirmed: boolean) => void
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback<ConfirmFn>((message, options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ message, resolve, ...options })
    })
  }, [])

  function settle(confirmed: boolean) {
    pending?.resolve(confirmed)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="confirm-backdrop" onClick={() => settle(false)}>
          <div className="confirm-dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{pending.title ?? 'Are you sure?'}</h2>
            <p>{pending.message}</p>
            <div className="confirm-dialog-actions">
              <button className="btn btn-secondary" onClick={() => settle(false)}>
                Cancel
              </button>
              <button
                className={pending.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => settle(true)}
                autoFocus
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider')
  return ctx
}
