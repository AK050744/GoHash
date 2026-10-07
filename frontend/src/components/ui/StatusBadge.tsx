import React from 'react'

export interface StatusBadgeProps {
  status: string
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const normalized = (status || '').toUpperCase()

  let style = 'bg-dark-700/60 text-dark-300 border-dark-600'
  let dotColor = 'bg-dark-400'

  switch (normalized) {
    case 'NOTARIZED':
    case 'CONFIRMED':
    case 'APPROVED':
      style = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
      dotColor = 'bg-emerald-400'
      break
    case 'PENDING':
    case 'REQUESTED':
      style = 'bg-amber-500/10 text-amber-300 border-amber-500/20'
      dotColor = 'bg-amber-400'
      break
    case 'REJECTED':
    case 'FAILED':
      style = 'bg-rose-500/10 text-rose-300 border-rose-500/20'
      dotColor = 'bg-rose-400'
      break
    default:
      break
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${style} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
      {normalized}
    </span>
  )
}

export default StatusBadge
