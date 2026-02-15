import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import CopyButton from '../../components/CopyButton/CopyButton'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import { parseRepoId, buildHfUrl } from '../../utils'
import type { AnonymousRepo, ActivityLog, PaginatedResponse } from '../../types'

const ACTIVITY_PAGE_SIZE = 10
const ACTOR_FILTERS = [
  { value: '', label: 'All' },
  { value: 'others', label: 'Not Me' },
  { value: 'owner', label: 'Mine' },
] as const

function actorBadge(actorType: string) {
  switch (actorType) {
    case 'anonymous':
      return { color: 'bg-slate-300', label: 'Anonymous', textColor: 'text-slate-500 dark:text-slate-400' }
    case 'non_owner':
      return { color: 'bg-slate-300 dark:bg-slate-600', label: 'Not Me', textColor: 'text-slate-500 dark:text-slate-400' }
    case 'owner':
      return { color: 'bg-amber-400', label: 'You', textColor: 'text-amber-700 dark:text-amber-400' }
    default:
      return { color: 'bg-slate-300', label: 'Unknown', textColor: 'text-slate-500 dark:text-slate-400' }
  }
}

export default function RepoDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { apiCall } = useAuth()
  const [repo, setRepo] = useState<AnonymousRepo | null>(null)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [activityCount, setActivityCount] = useState(0)
  const [activityPage, setActivityPage] = useState(1)
  const [activityOpen, setActivityOpen] = useState(false)
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [actorFilter, setActorFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showError = useCallback((fallback: string, err?: unknown) => {
    const e = err as { response?: { data?: { error?: string; detail?: string; colab_url?: string[] } } }
    const data = e?.response?.data
    const msg = data?.error || data?.detail || data?.colab_url?.[0] || fallback
    setError(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setError(null), 8000)
  }, [])

  const dismissError = useCallback(() => {
    setError(null)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
  }, [])

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [])

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showExpireConfirm, setShowExpireConfirm] = useState(false)
  const [extendDays, setExtendDays] = useState(30)
  const [editBranch, setEditBranch] = useState('')
  const [savingBranch, setSavingBranch] = useState(false)
  const [syncingLatest, setSyncingLatest] = useState(false)
  const [editColabUrl, setEditColabUrl] = useState('')
  const [savingColab, setSavingColab] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const repoRes = await apiCall<AnonymousRepo>('GET', `/api/repos/${id}/`)
        setRepo(repoRes.data)
        setEditBranch(repoRes.data.branch)
        setEditColabUrl(repoRes.data.colab_url || '')
      } catch (err) {
        showError('Failed to load repository details', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [apiCall, id])

  const fetchActivities = async (page: number, filter?: string) => {
    setLoadingActivities(true)
    try {
      const active = filter ?? actorFilter
      const filterParam = active ? `&actor_type=${active}` : ''
      const res = await apiCall<PaginatedResponse<ActivityLog>>(
        'GET',
        `/api/repos/${id}/activity/?page=${page}${filterParam}`
      )
      setActivities(res.data.results)
      setActivityCount(res.data.count)
      setActivityPage(page)
    } catch (err) {
      showError('Failed to load activity log', err)
    } finally {
      setLoadingActivities(false)
    }
  }

  const handleToggleActivity = () => {
    if (!activityOpen && activities.length === 0) {
      fetchActivities(1)
    }
    setActivityOpen(!activityOpen)
  }

  const handleActorFilter = (value: string) => {
    setActorFilter(value)
    fetchActivities(1, value)
  }

  const totalPages = Math.ceil(activityCount / ACTIVITY_PAGE_SIZE)

  const handleExtend = async () => {
    if (extendDays < 1 || extendDays > 365) return
    try {
      const res = await apiCall<AnonymousRepo>('PATCH', `/api/repos/${id}/`, {
        expiry_days: extendDays,
      })
      setRepo(res.data)
    } catch (err) {
      showError('Failed to extend expiry', err)
    }
  }

  const handleDelete = async () => {
    try {
      await apiCall('DELETE', `/api/repos/${id}/`)
      // Soft-delete: reload repo to show deleted state
      const res = await apiCall<AnonymousRepo>('GET', `/api/repos/${id}/`)
      setRepo(res.data)
      setShowDeleteConfirm(false)
    } catch (err) {
      showError('Failed to delete repository', err)
    }
  }

  const handleRestore = async () => {
    try {
      const res = await apiCall<AnonymousRepo>('PATCH', `/api/repos/${id}/`, {
        status: 'active',
      })
      setRepo(res.data)
    } catch (err) {
      showError('Failed to restore repository', err)
    }
  }

  const handleExpire = async () => {
    try {
      const res = await apiCall<AnonymousRepo>('POST', `/api/repos/${id}/expire/`)
      setRepo(res.data)
      setShowExpireConfirm(false)
    } catch (err) {
      showError('Failed to expire repository', err)
    }
  }

  const handleUpdateBranch = async () => {
    if (!editBranch.trim()) return
    setSavingBranch(true)
    try {
      const res = await apiCall<AnonymousRepo>('PATCH', `/api/repos/${id}/`, {
        branch: editBranch.trim(),
      })
      setRepo(res.data)
      setEditBranch(res.data.branch)
    } catch (err) {
      showError('Failed to update revision', err)
    } finally {
      setSavingBranch(false)
    }
  }

  const handleSyncLatest = async () => {
    setSyncingLatest(true)
    try {
      const res = await apiCall<AnonymousRepo>('POST', `/api/repos/${id}/sync-latest/`)
      setRepo(res.data)
      setEditBranch(res.data.branch)
    } catch (err) {
      showError('Failed to sync to latest commit', err)
    } finally {
      setSyncingLatest(false)
    }
  }

  const handleUpdateColab = async () => {
    setSavingColab(true)
    try {
      const res = await apiCall<AnonymousRepo>('PATCH', `/api/repos/${id}/`, {
        colab_url: editColabUrl.trim(),
      })
      setRepo(res.data)
      setEditColabUrl(res.data.colab_url || '')
    } catch (err) {
      showError('Failed to update Colab link', err)
    } finally {
      setSavingColab(false)
    }
  }

  const handleRemoveColab = async () => {
    setSavingColab(true)
    try {
      const res = await apiCall<AnonymousRepo>('PATCH', `/api/repos/${id}/`, {
        colab_url: '',
      })
      setRepo(res.data)
      setEditColabUrl('')
    } catch (err) {
      showError('Failed to remove Colab link', err)
    } finally {
      setSavingColab(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (!repo) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Repository Not Found</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{error || 'This repository could not be found.'}</p>
      </div>
    )
  }

  const anonUrl = `${window.location.origin}/a/${repo.anonymous_id}/`

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to="/app/dashboard"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-5 flex items-start justify-between gap-3">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          <button
            onClick={dismissError}
            className="shrink-0 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300 transition-colors"
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="card mb-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={repo.repo_type} />
            <StatusBadge status={repo.status} />
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <span>{repo.visitor_views} visits</span>
            <span>{repo.visitor_downloads} downloads</span>
          </div>
        </div>

        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Repository Details</h1>

        <div className="space-y-3 mb-6">
          <div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">Repository</p>
            {(() => {
              const repoId = parseRepoId(repo.original_url)
              const hfUrl = repoId ? buildHfUrl(repo.repo_type, repoId) : repo.original_url
              return (
                <a
                  href={hfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
                >
                  {repoId || repo.original_url}
                </a>
              )
            })()}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">Revision</p>
            <div className="flex flex-col sm:flex-row gap-1.5 mt-1">
              <input
                type="text"
                value={editBranch}
                onChange={(e) => setEditBranch(e.target.value)}
                placeholder="main"
                className="flex-1 px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent font-mono"
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleUpdateBranch}
                  disabled={savingBranch || editBranch.trim() === repo.branch}
                  className="btn-secondary text-sm shrink-0 disabled:opacity-40"
                >
                  {savingBranch ? 'Saving...' : 'Update'}
                </button>
                <button
                  onClick={handleSyncLatest}
                  disabled={syncingLatest}
                  className="btn-secondary text-sm shrink-0 disabled:opacity-40"
                  title="Fetch the latest commit SHA from the main branch and pin to it"
                >
                  {syncingLatest ? 'Syncing...' : 'Pin to Latest'}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Branch, tag, or commit SHA. {repo.branch === 'main' ? 'Currently tracking latest on main.' : `Pinned to ${repo.branch.length > 12 ? 'commit ' + repo.branch.slice(0, 8) + '...' : repo.branch}.`}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">Anonymous URL</p>
            <div className="flex items-center gap-2 mt-1">
              <a
                href={anonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 break-all text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 font-mono min-w-0 flex-1"
              >
                {anonUrl}
              </a>
              <CopyButton text={anonUrl} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">Colab Notebook</p>
            <div className="flex flex-col sm:flex-row gap-1.5 mt-1">
              <input
                type="url"
                value={editColabUrl}
                onChange={(e) => setEditColabUrl(e.target.value)}
                placeholder="https://colab.research.google.com/..."
                className="flex-1 px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent font-mono"
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleUpdateColab}
                  disabled={savingColab || editColabUrl.trim() === (repo.colab_url || '')}
                  className="btn-secondary text-sm shrink-0 disabled:opacity-40"
                >
                  {savingColab ? 'Saving...' : editColabUrl.trim() && !repo.colab_url ? 'Add' : 'Update'}
                </button>
                {repo.colab_url && (
                  <button
                    onClick={handleRemoveColab}
                    disabled={savingColab}
                    className="btn-danger text-sm shrink-0 disabled:opacity-40"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {repo.colab_url ? 'Linked Colab notebook shown to reviewers.' : 'Optional: link a Colab notebook for reviewers.'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">Expires</p>
            <p className={`text-sm ${repo.days_until_expiry <= 7 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-slate-900 dark:text-slate-100'}`}>
              {new Date(repo.expires_at).toLocaleDateString()} ({repo.days_until_expiry} days remaining)
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
          {repo.status === 'deleted' ? (
            <>
              <div className="flex items-center gap-2.5">
                <button onClick={handleRestore} className="btn-secondary text-sm">
                  Restore
                </button>
                <a
                  href={anonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm"
                >
                  Preview
                </a>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Permanent deletion is not available. Deleting a repository permanently would invalidate the anonymous URL with no way to recover it, which could break shared links. You can restore this repository at any time.
                </p>
              </div>
            </>
          ) : repo.status === 'expired' ? (
            <>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value))}
                  min={1}
                  max={365}
                  className="w-16 sm:w-20 px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                <button onClick={handleExtend} className="btn-secondary text-sm whitespace-nowrap">
                  Reactivate
                </button>
                <a
                  href={anonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm"
                >
                  Preview
                </a>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-danger text-sm"
                >
                  Delete
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value))}
                  min={1}
                  max={365}
                  className="w-16 sm:w-20 px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                <button onClick={handleExtend} className="btn-secondary text-sm whitespace-nowrap">
                  Set Expiry
                </button>
                <a
                  href={anonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm"
                >
                  Preview
                </a>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowExpireConfirm(true)}
                  className="btn-danger text-sm"
                >
                  Expire Now
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-danger text-sm"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <button
          onClick={handleToggleActivity}
          className="flex items-center justify-between w-full text-left group"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Activity Log</h2>
            {!activityOpen && activityCount > 0 && (
              <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                {activityCount}
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-all duration-200 ${activityOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {activityOpen && (
          <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
            {/* Actor type filter tabs */}
            <div className="flex items-center gap-1.5 mb-4">
              {ACTOR_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => handleActorFilter(f.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    actorFilter === f.value
                      ? 'bg-amber-400 text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {loadingActivities ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-500 border-t-transparent" />
              </div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No activity recorded yet.</p>
            ) : (
              <>
                <div className="space-y-0">
                  {activities.map((log, i) => {
                    const actor = actorBadge(log.actor_type)
                    return (
                      <div
                        key={i}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2.5 border-b border-slate-50 dark:border-slate-700 last:border-b-0"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            log.action === 'created' ? 'bg-purple-400' :
                            log.action === 'viewed' ? 'bg-blue-400' :
                            log.action === 'downloaded' ? 'bg-green-400' :
                            log.action === 'extended' ? 'bg-amber-400' :
                            log.action === 'manually_expired' ? 'bg-orange-400' :
                            log.action === 'deleted' ? 'bg-red-400' :
                            log.action === 'restored' ? 'bg-emerald-400' : 'bg-slate-300'
                          }`} />
                          <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">{log.action}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${actor.textColor} ${
                            log.actor_type === 'owner' ? 'bg-amber-50 dark:bg-amber-950' : 'bg-slate-100 dark:bg-slate-700'
                          }`}>
                            {actor.label}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      Page {activityPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => fetchActivities(activityPage - 1)}
                        disabled={activityPage <= 1}
                        className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Previous page"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => fetchActivities(activityPage + 1)}
                        disabled={activityPage >= totalPages}
                        className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Next page"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Repository"
          message="This will deactivate the anonymous URL. You can restore it later from this page."
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showExpireConfirm && (
        <ConfirmDialog
          title="Expire Repository"
          message="This will immediately expire the anonymous URL. Reviewers will no longer be able to access the repository contents and the original identity will be revealed. You can extend the expiry later to reactivate it."
          confirmLabel="Expire Now"
          danger
          onConfirm={handleExpire}
          onCancel={() => setShowExpireConfirm(false)}
        />
      )}
    </div>
  )
}
