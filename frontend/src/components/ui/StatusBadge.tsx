import type { DocumentStatus, NotarizationStatus } from '../../types'

const map: Record<string, string> = {
  PENDING:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  REQUESTED: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
  APPROVED:  'bg-blue-500/10   text-blue-400   border-blue-500/20',
  REJECTED:  'bg-red-500/10    text-red-400    border-red-500/20',
  FAILED:    'bg-red-500/10    text-red-400    border-red-500/20',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  NOTARIZED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

export default function StatusBadge({
  status,
}: {
  status: DocumentStatus | NotarizationStatus | string
}) {
  const badgeClass = map[status] || 'bg-surface-700 text-surface-300 border-surface-600'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
      {status}
    </span>
  )
}
