import React from 'react'
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

export interface AlertProps {
  type?: 'error' | 'success' | 'warning' | 'info'
  title?: string
  message: string
  onClose?: () => void
  className?: string
}

export const Alert: React.FC<AlertProps> = ({
  type = 'error',
  title,
  message,
  onClose,
  className = '',
}) => {
  const config = {
    error: {
      border: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
      icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
    },
    success: {
      border: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
    },
    warning: {
      border: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
    },
    info: {
      border: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
      icon: <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />,
    },
  }[type]

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-xl border text-sm transition-all duration-150 ${config.border} ${className}`}
    >
      {config.icon}
      <div className="flex-1 min-w-0">
        {title && <h5 className="font-semibold text-white tracking-tight mb-0.5">{title}</h5>}
        <p className="leading-relaxed break-words">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="p-1 rounded-lg hover:bg-white/10 text-dark-300 hover:text-white transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default Alert
