import { ReactNode } from 'react'

type AlertType = 'info' | 'success' | 'warning' | 'error'
const styles: Record<AlertType, string> = {
  info:    'bg-blue-500/10 border-blue-500/30 text-blue-300',
  success: 'bg-green-500/10 border-green-500/30 text-green-300',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
  error:   'bg-red-500/10 border-red-500/30 text-red-300',
}

export default function Alert({ type = 'info', children }: { type?: AlertType; children: ReactNode }) {
  return (
    <div className={`px-4 py-3 rounded-xl border text-sm ${styles[type]}`} role="alert">
      {children}
    </div>
  )
}
