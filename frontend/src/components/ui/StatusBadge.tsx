import type { DocumentStatus } from '../../types'

const map: Record<DocumentStatus, string> = {
  PENDING:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  APPROVED:   'bg-green-500/10  text-green-400  border-green-500/20',
  REJECTED:   'bg-red-500/10    text-red-400    border-red-500/20',
  NOTARIZED:  'bg-blue-500/10   text-blue-400   border-blue-500/20',
}

export default function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${map[status]}`}>
      {status}
    </span>
  )
}
