import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import StatusBadge from '../../components/StatusBadge/StatusBadge'
import CopyButton from '../../components/CopyButton/CopyButton'
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog'
import Toast, { type ToastType } from '../../components/Toast/Toast'
import { parseRepoId, buildHfUrl } from '../../utils'
import { validateBranch, validateColabUrl } from '../../validation'
import type { AnonymousRepo, ActivityLog, PaginatedResponse } from '../../types'

const ACTIVITY_PAGE_SIZE = 10
const ACTOR_FILTERS = [
  { value: '', label: 'All' },
  { value: 'others', label: 'Not Me' },
  { value: 'owner', label: 'Mine' },
] as const

function actorBadge(actorType: string) {
  switch (actorType) {
    case 'viewer':
      return { color: 'bg-slate-300 dark:bg-slate-600', label: 'Reviewer', textColor: 'text-slate-500 dark:text-slate-400' }
    case 'owner':
      return { color: 'bg-amber-400', label: 'You', textColor: 'text-amber-700 dark:text-amber-400' }
    default:
      return { color: 'bg-slate-300', label: 'Unknown', textColor: 'text-slate-500 dark:text-slate-400' }
  }
}

export default function RepoDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { apiCall, user } = useAuth()
  const [repo, setRepo] = useState<AnonymousRepo | null>(null)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [activityCount, setActivityCount] = useState(0)
  const [activityPage, setActivityPage] = useState(1)
  const [activityOpen, setActivityOpen] = useState(false)
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [actorFilter, setActorFilter] = useState('')
  const [loading, setLoading] = useState(true)
  // One notice channel for both outcomes. `id` forces a remount so a repeated
  // message restarts the toast's auto-hide timer instead of reusing the old one.
  const [notice, setNotice] = useState<{ id: number; type: ToastType; text: string } | null>(null)
  const noticeId = useRef(0)

  const notify = useCallback((type: ToastType, text: string) => {
    noticeId.current += 1
    setNotice({ id: noticeId.current, type, text })
  }, [])

  const showError = useCallback(
    (fallback: string, err?: unknown) => {
      const e = err as {
        response?: { data?: { error?: string; detail?: string; colab_url?: string[] } }
      }
      const data = e?.response?.data
      notify('error', data?.error || data?.detail || data?.colab_url?.[0] || fallback)
    },
    [notify]
  )

  const dismissNotice = useCallback(() => setNotice(null), [])

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showExpireConfirm, setShowExpireConfirm] = useState(false)
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [purging, setPurging] = useState(false)
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
      notify('success', `Expiry set to ${extendDays} days from now`)
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
      notify('success', 'Repository deleted — the anonymous URL is now inactive')
    } catch (err) {
      showError('Failed to delete repository', err)
    }
  }

  const handlePermanentDelete = async () => {
    setShowPurgeConfirm(false)
    setPurging(true)
    try {
      await apiCall('DELETE', `/api/repos/${id}/?permanent=true`)
      navigate('/app/dashboard')
    } catch (err) {
      showError('Failed to permanently delete repository', err)
    } finally {
      setPurging(false)
    }
  }

  const handleRestore = async () => {
    try {
      const res = await apiCall<AnonymousRepo>('PATCH', `/api/repos/${id}/`, {
        status: 'active',
      })
      setRepo(res.data)
      notify('success', 'Repository restored')
    } catch (err) {
      showError('Failed to restore repository', err)
    }
  }

  const handleExpire = async () => {
    try {
      const res = await apiCall<AnonymousRepo>('POST', `/api/repos/${id}/expire/`)
      setRepo(res.data)
      setShowExpireConfirm(false)
      notify('success', 'Repository expired — viewers can no longer access it')
    } catch (err) {
      showError('Failed to expire repository', err)
    }
  }

  const handleUpdateBranch = async () => {
    const invalid = validateBranch(editBranch)
    if (invalid) {
      showError(invalid)
      return
    }
    setSavingBranch(true)
    try {
      const res = await apiCall<AnonymousRepo>('PATCH', `/api/repos/${id}/`, {
        branch: editBranch.trim(),
      })
      setRepo(res.data)
      setEditBranch(res.data.branch)
      notify('success', `Revision updated to ${res.data.branch}`)
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
      notify('success', `Pinned to latest commit ${res.data.branch.slice(0, 8)}`)
    } catch (err) {
      showError('Failed to sync to latest commit', err)
    } finally {
      setSyncingLatest(false)
    }
  }

  const handleUpdateColab = async () => {
    const invalid = validateColabUrl(editColabUrl)
    if (invalid) {
      showError(invalid)
      return
    }
    setSavingColab(true)
    try {
      const res = await apiCall<AnonymousRepo>('PATCH', `/api/repos/${id}/`, {
        colab_url: editColabUrl.trim(),
      })
      setRepo(res.data)
      setEditColabUrl(res.data.colab_url || '')
      notify('success', 'Colab link updated')
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
      notify('success', 'Colab link removed')
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
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          {notice?.type === 'error' ? notice.text : 'This repository could not be found.'}
        </p>
      </div>
    )
  }

  const anonUrl = `${window.location.origin}/a/${repo.anonymous_id}/`
  // Save buttons are promoted to primary while an edit is pending, so the page
  // always has exactly one obvious next action.
  const branchDirty = editBranch.trim() !== repo.branch
  const colabDirty = editColabUrl.trim() !== (repo.colab_url || '')

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
      {notice && (
        <Toast
          key={notice.id}
          type={notice.type}
          message={notice.text}
          onDismiss={dismissNotice}
        />
      )}

      {user && !user.has_hf_token && (
        <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800 rounded-lg p-3 sm:p-4 mb-5">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                HuggingFace API token not configured
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                Viewers won't be able to access this repository without a personal API token. Add one in{' '}
                <Link
                  to="/app/settings?tab=preferences"
                  className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200"
                >
                  Settings
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={repo.repo_type} />
            {/* Only badge a status worth noticing — "active" is the default. */}
            {repo.status !== 'active' && <StatusBadge status={repo.status} />}
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
                  disabled={savingBranch || !branchDirty}
                  className={`${branchDirty ? 'btn-primary' : 'btn-secondary'} text-sm shrink-0 disabled:opacity-40`}
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
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-1.5 leading-relaxed font-medium">
              Important: the link itself can identify you &mdash; a URL like
              colab.research.google.com/github/<span className="font-mono">your-username</span>/... reveals
              your GitHub account. Check the notebook contents too. This is your responsibility.
            </p>
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
                  disabled={savingColab || !colabDirty}
                  className={`${colabDirty ? 'btn-primary' : 'btn-secondary'} text-sm shrink-0 disabled:opacity-40`}
                >
                  {savingColab ? 'Saving...' : editColabUrl.trim() && !repo.colab_url ? 'Add' : 'Update'}
                </button>
                {repo.colab_url && (
                  <button
                    onClick={handleRemoveColab}
                    disabled={savingColab}
                    className="btn-danger-outline text-sm shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {repo.colab_url ? 'Linked Colab notebook shown to viewers.' : 'Optional: link a Colab notebook for viewers.'}
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
              <div className="flex items-center gap-2">
                <button onClick={handleRestore} className="btn-primary text-sm">
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
              <div className="p-3 sm:p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30">
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                  Delete permanently
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                  Permanently removes this repository record and its activity log from this
                  service.{' '}
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    /a/{repo.anonymous_id}/
                  </span>{' '}
                  stops working for good and cannot be restored.
                </p>
                <button
                  onClick={() => setShowPurgeConfirm(true)}
                  disabled={purging}
                  className="btn-danger text-sm"
                >
                  {purging ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </>
          ) : repo.status === 'expired' ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              <div className="flex items-center gap-1.5 pb-3">
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
              <div className="flex justify-end pt-3">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-danger-outline text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              <div className="flex items-center gap-1.5 pb-3">
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
              <div className="flex justify-end gap-1.5 pt-3">
                <button
                  onClick={() => setShowExpireConfirm(true)}
                  className="btn-danger-outline text-sm"
                >
                  Expire Now
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-danger-outline text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
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

      {showPurgeConfirm && (
        <ConfirmDialog
          title="Delete Permanently"
          message={`This permanently removes the repository record and its activity log. /a/${repo.anonymous_id}/ stops working for good and cannot be restored.`}
          confirmLabel="Delete Forever"
          danger
          requireText={repo.anonymous_id}
          onConfirm={handlePermanentDelete}
          onCancel={() => setShowPurgeConfirm(false)}
        />
      )}

      {showExpireConfirm && (
        <ConfirmDialog
          title="Expire Repository"
          message="This will immediately expire the anonymous URL. Viewers will no longer be able to access the repository contents and the original identity will be revealed. You can extend the expiry later to reactivate it."
          confirmLabel="Expire Now"
          danger
          onConfirm={handleExpire}
          onCancel={() => setShowExpireConfirm(false)}
        />
      )}
    </div>
  )
}
