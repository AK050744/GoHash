import React, { HTMLAttributes } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean
  glow?: boolean
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverEffect = false,
  glow = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`bg-surface border border-border/80 rounded-2xl p-6 transition-all duration-200 ${
        hoverEffect ? 'hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-card' : ''
      } ${glow ? 'shadow-glow-primary border-primary/30' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export const CardHeader: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
)

export const CardTitle: React.FC<HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <h3 className={`text-lg font-semibold text-white tracking-tight ${className}`} {...props}>
    {children}
  </h3>
)

export const CardDescription: React.FC<HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <p className={`text-sm text-dark-400 mt-1 ${className}`} {...props}>
    {children}
  </p>
)

export default Card
