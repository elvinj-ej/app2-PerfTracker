import type { ReactNode } from 'react'

const ICONS = {
  error: '⚠',
  success: '✓',
  info: 'ℹ',
} as const

export function Alert({ variant, children }: { variant: keyof typeof ICONS; children: ReactNode }) {
  return (
    <div className={`alert alert-${variant}`} role={variant === 'error' ? 'alert' : undefined}>
      <span className="alert-icon" aria-hidden="true">
        {ICONS[variant]}
      </span>
      <span>{children}</span>
    </div>
  )
}
