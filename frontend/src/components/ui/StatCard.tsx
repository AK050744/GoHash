import React from 'react'
import { Card } from './Card'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  description?: string
  trend?: string
  trendType?: 'positive' | 'negative' | 'neutral'
  className?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  description,
  trend,
  trendType = 'neutral',
  className = '',
}) => {
  const trendColors = {
    positive: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    negative: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    neutral: 'text-dark-300 bg-dark-700/50 border-dark-600',
  }

  return (
    <Card hoverEffect className={`relative overflow-hidden ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-dark-400 tracking-wide uppercase">{title}</p>
          <h4 className="text-3xl font-bold text-white mt-2 font-display">{value}</h4>
        </div>
        <div className="p-3 bg-surface-secondary text-primary rounded-xl border border-border">
          {icon}
        </div>
      </div>

      {(description || trend) && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          {trend && (
            <span className={`px-2 py-0.5 rounded-md font-medium border ${trendColors[trendType]}`}>
              {trend}
            </span>
          )}
          {description && <span className="text-dark-400">{description}</span>}
        </div>
      )}
    </Card>
  )
}

export default StatCard
