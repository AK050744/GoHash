import React from 'react'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '', label }) => {
  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-3',
  }

  return (
    <div className={`inline-flex items-center gap-2.5 justify-center ${className}`}>
      <div
        className={`${sizeMap[size]} rounded-full border-primary/30 border-t-primary animate-spin`}
        role="status"
        aria-label={label || 'Loading'}
      />
      {label && <span className="text-sm text-dark-300 font-medium">{label}</span>}
    </div>
  )
}

export default Spinner
