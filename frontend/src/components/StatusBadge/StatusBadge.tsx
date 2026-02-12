const statusStyles: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  expired: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  deleted: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  dataset: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  model: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${style} ${className}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
