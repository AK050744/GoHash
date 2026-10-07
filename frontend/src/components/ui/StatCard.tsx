interface Props { value: string | number; label: string; icon?: React.ReactNode; trend?: string }

export default function StatCard({ value, label, icon, trend }: Props) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between text-surface-400 text-sm">
        <span>{label}</span>
        {icon && <span className="text-primary-400">{icon}</span>}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {trend && <p className="text-xs text-surface-400">{trend}</p>}
    </div>
  )
}
