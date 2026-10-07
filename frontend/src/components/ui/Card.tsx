import { HTMLAttributes } from 'react'

interface Props extends HTMLAttributes<HTMLDivElement> { noPad?: boolean }

export default function Card({ children, className = '', noPad, ...rest }: Props) {
  return (
    <div
      className={`bg-surface-800 border border-surface-700 rounded-2xl ${noPad ? '' : 'p-6'} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
