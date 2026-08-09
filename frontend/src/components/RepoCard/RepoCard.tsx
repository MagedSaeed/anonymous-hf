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
    <div className="group relative bg-white border border-slate-200/60 rounded-xl p-4 hover:border-amber-300 hover:shadow-md transition-all duration-150 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-amber-600/60 overflow-hidden">
      {/* Stretched link: the whole card navigates to the manage page, while the
          links below sit above it (z-10) and keep their own destinations. */}
      <Link
        to={`/app/repos/${repo.id}`}
        aria-label={`Manage ${repoId || repo.anonymous_id}`}
        className="absolute inset-0 z-0"
      />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={repo.repo_type} />
          {/* Only badge a status worth noticing — "active" is the default. */}
          {repo.status !== 'active' && <StatusBadge status={repo.status} />}
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
          className="relative z-10 text-sm font-medium text-slate-800 hover:text-amber-700 transition-colors dark:text-slate-200 dark:hover:text-amber-400 inline-block max-w-full truncate"
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
          className="relative z-10 text-xs bg-slate-50 px-2 py-1 rounded-md border border-slate-200 flex-1 truncate text-amber-700 hover:text-amber-800 font-mono dark:bg-slate-900 dark:border-slate-700 dark:text-amber-400 dark:hover:text-amber-300"
          title={fullUrl}
        >
          {fullUrl}
        </a>
        <CopyButton text={fullUrl} className="relative z-10 shrink-0" />
      </div>

      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${daysLeft <= 7 ? 'text-amber-600 font-medium dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {expiryText}
        </span>
        {/* Visual affordance only — the stretched link above handles the click. */}
        <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-400 text-slate-900 group-hover:bg-amber-500 transition-colors shrink-0">
          Manage
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  )
}
