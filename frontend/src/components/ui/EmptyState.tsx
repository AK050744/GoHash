import { ReactNode } from 'react'

export default function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center text-surface-400">
      {icon && <div className="text-5xl">{icon}</div>}
      <h3 className="text-lg font-semibold text-surface-200">{title}</h3>
      {description && <p className="text-sm max-w-xs">{description}</p>}
      {action}
    </div>
  )
}
