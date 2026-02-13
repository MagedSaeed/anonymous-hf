import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import RepoCard from '../../components/RepoCard/RepoCard'
import type { AnonymousRepo, PaginatedResponse } from '../../types'

export default function DashboardPage() {
  const { apiCall } = useAuth()
  const [repos, setRepos] = useState<AnonymousRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const params = statusFilter ? `?status=${statusFilter}` : ''
        const res = await apiCall<PaginatedResponse<AnonymousRepo>>(
          'GET',
          `/api/repos/${params}`
        )
        setRepos(res.data.results)
      } catch {
        setError('Failed to load repositories')
      } finally {
        setLoading(false)
      }
    }
    fetchRepos()
  }, [apiCall, statusFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Repositories</h1>
        <Link to="/app/create" className="btn-primary shrink-0">
          <span className="hidden sm:inline">+ Create Anonymous Repo</span>
          <span className="sm:hidden">+ Create</span>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        {['', 'active', 'expired', 'deleted'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors shrink-0 ${
              statusFilter === status
                ? 'bg-amber-400 text-slate-900'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
            }`}
          >
            {status === '' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {repos.length === 0 ? (
        <div className="text-center py-12 card">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">No repositories yet</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
            Create your first anonymous repository to get started.
          </p>
          <Link to="/app/create" className="btn-primary">
            Create Anonymous Repo
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {repos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </div>
  )
}
