import { Link } from 'react-router-dom'
import type { AnonymousRepo } from '../../types'
import StatusBadge from '../StatusBadge/StatusBadge'
import CopyButton from '../CopyButton/CopyButton'
import { parseRepoId, buildHfUrl } from '../../utils'

interface RepoCardProps {
  repo: AnonymousRepo
}

export default function RepoCard({ repo }: RepoCardProps) {
  const daysLeft = repo.days_until_expiry
  const expiryText =
    daysLeft <= 0 ? 'Expired' : daysLeft === 1 ? '1 day left' : `${daysLeft} days left`
  const fullUrl = `${window.location.origin}/a/${repo.anonymous_id}/`
  const repoId = parseRepoId(repo.original_url)
  const hfUrl = repoId ? buildHfUrl(repo.repo_type, repoId) : repo.original_url

  return (
    <div className="bg-white border border-slate-200/60 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all duration-150 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600 overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={repo.repo_type} />
          <StatusBadge status={repo.status} />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>{repo.visitor_views} visits</span>
          <span>{repo.visitor_downloads} downloads</span>
        </div>
      </div>

      <div className="mb-3 min-w-0">
        <a
          href={hfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-slate-800 hover:text-amber-700 transition-colors dark:text-slate-200 dark:hover:text-amber-400 block truncate"
          title={repo.original_url}
        >
          {repoId || repo.original_url}
        </a>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Branch: {repo.branch}</p>
      </div>

      <div className="flex items-center gap-2 mb-3 min-w-0">
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs bg-slate-50 px-2 py-1 rounded-md border border-slate-200 flex-1 truncate text-amber-700 hover:text-amber-800 font-mono dark:bg-slate-900 dark:border-slate-700 dark:text-amber-400 dark:hover:text-amber-300"
          title={fullUrl}
        >
          {fullUrl}
        </a>
        <CopyButton text={fullUrl} />
      </div>

      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${daysLeft <= 7 ? 'text-amber-600 font-medium dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {expiryText}
        </span>
        <Link
          to={`/app/repos/${repo.id}`}
          className="text-xs text-amber-700 hover:text-amber-800 font-medium transition-colors dark:text-amber-400 dark:hover:text-amber-300"
        >
          Details
        </Link>
      </div>
    </div>
  )
}
