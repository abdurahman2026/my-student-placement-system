import type { LucideIcon } from 'lucide-react'

interface InfoCardProps {
  icon: LucideIcon
  label: string
  value: string
}

export default function InfoCard({ icon: Icon, label, value }: InfoCardProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-brand-700" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-sm font-semibold text-slate-900 truncate">{value}</p>
      </div>
    </div>
  )
}
