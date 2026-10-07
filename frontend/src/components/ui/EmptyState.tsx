import React from 'react'
import { Card } from './Card'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <Card className={`text-center py-12 px-6 flex flex-col items-center justify-center ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center text-primary mb-4 shadow-inner">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white tracking-tight mb-1.5">{title}</h3>
      <p className="text-sm text-dark-400 max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </Card>
  )
}

export default EmptyState
