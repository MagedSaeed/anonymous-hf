import { useState, useEffect, useRef } from 'react'
import type { Method } from 'axios'
import { useAuth } from '../../contexts/AuthContext'
import CopyButton from '../../components/CopyButton/CopyButton'
import CodeSnippet from '../../components/CodeSnippet/CodeSnippet'
import { Link } from 'react-router-dom'
import type { HFRepo } from '../../types'

interface CreateResult {
  id: number
  anonymous_id: string
  anonymous_url: string
  repo_type: 'model' | 'dataset'
}

function normalizeInput(input: string, repoType: 'model' | 'dataset'): string {
  const trimmed = input.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  if (repoType === 'dataset') {
    return `https://huggingface.co/datasets/${trimmed}`
  }
  return `https://huggingface.co/${trimmed}`
}

function looksLikeUrl(input: string): boolean {
  return input.trim().startsWith('http://') || input.trim().startsWith('https://')
}

interface SuccessViewProps {
  result: CreateResult
  initialColabUrl: string
  apiCall: <T>(method: Method, url: string, data?: unknown) => Promise<{ data: T }>
}

function SuccessView({ result, initialColabUrl, apiCall }: SuccessViewProps) {
  const [editColabUrl, setEditColabUrl] = useState(initialColabUrl)
  const [savingColab, setSavingColab] = useState(false)
  const [colabSaved, setColabSaved] = useState(false)
  const [colabError, setColabError] = useState<string | null>(null)

  const anonUrl = `${window.location.origin}/a/${result.anonymous_id}/`
  const downloadUrl = `${window.location.origin}/a/${result.anonymous_id}/download/`
  const quickStartCode = result.repo_type === 'dataset'
    ? `# Download the repository\n!wget "${downloadUrl}" -O repo.zip\n!unzip repo.zip -d anonymous_repo\n\n# Load the dataset\nfrom datasets import load_from_disk\ndataset = load_from_disk("anonymous_repo")`
    : `# Download the repository\n!wget "${downloadUrl}" -O repo.zip\n!unzip repo.zip -d anonymous_repo\n\n# Load the model\nfrom transformers import AutoModel, AutoTokenizer\nmodel = AutoModel.from_pretrained("anonymous_repo")\ntokenizer = AutoTokenizer.from_pretrained("anonymous_repo")`

  const handleSaveColab = async () => {
    setSavingColab(true)
    setColabError(null)
    try {
      await apiCall('PATCH', `/api/repos/${result.id}/`, { colab_url: editColabUrl.trim() })
      setColabSaved(true)
      setTimeout(() => setColabSaved(false), 2000)
    } catch {
      setColabError('Failed to update Colab URL')
    } finally {
      setSavingColab(false)
    }
  }

  const colabChanged = editColabUrl.trim() !== initialColabUrl.trim()

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card text-center">
        <div className="w-12 h-12 bg-green-50 dark:bg-green-950 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Repository Created!</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Your anonymous URL is ready to share with reviewers.</p>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mb-6">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Anonymous URL</p>
          <div className="flex items-center gap-2 justify-center min-w-0">
            <a
              href={anonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 truncate"
            >
              {anonUrl}
            </a>
            <CopyButton text={anonUrl} />
          </div>
        </div>

        {/* Editable Colab URL */}
        <div className="text-left mb-6">
          <label className="form-label">
            Colab Notebook URL <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={editColabUrl}
              onChange={(e) => setEditColabUrl(e.target.value)}
              placeholder="https://colab.research.google.com/..."
              className="input-field flex-1"
            />
            <button
              type="button"
              onClick={handleSaveColab}
              disabled={!colabChanged || savingColab}
              className="btn-secondary shrink-0 disabled:opacity-40"
            >
              {savingColab ? 'Saving...' : colabSaved ? 'Saved!' : 'Update'}
            </button>
          </div>
          {colabError && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{colabError}</p>}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to={`/app/repos/${result.id}`} className="btn-primary w-full sm:w-auto">
            View Details
          </Link>
          <Link to="/app/dashboard" className="btn-secondary w-full sm:w-auto">
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Quick Start</span>
        </div>
        <CodeSnippet code={quickStartCode} colabUrl={editColabUrl.trim() || undefined} />
      </div>
    </div>
  )
}

export default function CreateRepoPage() {
  const { apiCall, user } = useAuth()
  const [originalUrl, setOriginalUrl] = useState('')
  const [repoType, setRepoType] = useState<'model' | 'dataset'>('dataset')
  const [branch, setBranch] = useState('main')
  const [expiryDays, setExpiryDays] = useState(user?.default_expiry_days || 90)
  const [colabUrl, setColabUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateResult | null>(null)

  // HF repos dropdown state
  const [hfRepos, setHfRepos] = useState<HFRepo[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [inputMode, setInputMode] = useState<'search' | 'url'>('search')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchRepos = async () => {
      setLoadingRepos(true)
      try {
        const res = await apiCall<HFRepo[]>('GET', '/api/hf-repos/')
        setHfRepos(res.data)
      } catch {
        // Silently fail — user can still paste URLs
      } finally {
        setLoadingRepos(false)
      }
    }
    fetchRepos()
  }, [apiCall])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredRepos = hfRepos
    .filter((repo) => {
      const query = originalUrl.toLowerCase().trim()
      if (!query) return true
      return (
        repo.repo_id.toLowerCase().includes(query) ||
        repo.name.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      // Private repos first
      if (a.private !== b.private) return a.private ? -1 : 1
      return a.repo_id.localeCompare(b.repo_id)
    })

  const handleSelectRepo = (repo: HFRepo) => {
    const url =
      repo.repo_type === 'dataset'
        ? `https://huggingface.co/datasets/${repo.repo_id}`
        : `https://huggingface.co/${repo.repo_id}`
    setOriginalUrl(url)
    setRepoType(repo.repo_type)
    setShowDropdown(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        original_url: inputMode === 'url' ? originalUrl.trim() : normalizeInput(originalUrl, repoType),
        branch,
        expiry_days: expiryDays,
        allow_download: true,
      }
      if (colabUrl.trim()) {
        payload.colab_url = colabUrl.trim()
      }
      const res = await apiCall<CreateResult>('POST', '/api/repos/', payload)
      setResult(res.data)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; original_url?: string[] } } }
      const data = error.response?.data
      setError(
        data?.error || data?.original_url?.[0] || 'Failed to create anonymous repository'
      )
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return <SuccessView result={result} initialColabUrl={colabUrl} apiCall={apiCall} />
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">Create Anonymous Repository</h1>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Mode toggle */}
        <div>
          <label className="form-label">HuggingFace Repository</label>
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => { setInputMode('search'); setOriginalUrl('') }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                inputMode === 'search'
                  ? 'bg-amber-400 text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              My Repos
            </button>
            <button
              type="button"
              onClick={() => { setInputMode('url'); setOriginalUrl(''); setShowDropdown(false) }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                inputMode === 'url'
                  ? 'bg-amber-400 text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              Paste URL
            </button>
          </div>

          {inputMode === 'search' ? (
            <div className="relative" ref={dropdownRef}>
              <input
                type="text"
                value={originalUrl}
                onChange={(e) => {
                  setOriginalUrl(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search your repositories..."
                className="input-field"
                required
              />
              {loadingRepos && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full" />
                </div>
              )}

              {showDropdown && !loadingRepos && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {filteredRepos.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {hfRepos.length === 0
                        ? 'No repositories found. Try pasting a URL instead.'
                        : 'No matching repositories.'}
                    </div>
                  ) : (
                    filteredRepos.map((repo) => (
                      <button
                        key={repo.repo_id}
                        type="button"
                        onClick={() => handleSelectRepo(repo)}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm border-b border-slate-50 dark:border-slate-700 last:border-b-0"
                      >
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            repo.repo_type === 'dataset'
                              ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                              : 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400'
                          }`}
                        >
                          {repo.repo_type}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 truncate">{repo.repo_id}</span>
                        {repo.private && (
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded ml-auto shrink-0">
                            private
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <input
                type="text"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                placeholder="username/repo-name or full URL"
                className="input-field"
                required
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                Enter a repo ID (e.g., <code className="text-slate-500 dark:text-slate-400">username/repo-name</code>) or full URL.
              </p>
            </>
          )}
        </div>

        {/* Repo type selector - shown when input is not a full URL and in URL mode */}
        {inputMode === 'url' && !looksLikeUrl(originalUrl) && (
          <div>
            <label className="form-label">Type</label>
            <div className="flex items-center gap-2">
              {(['dataset', 'model'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRepoType(type)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    repoType === type
                      ? 'bg-amber-400 text-slate-900'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="branch" className="form-label">
            Revision <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
          </label>
          <input
            id="branch"
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="input-field"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
            Branch name, tag, or commit SHA. Defaults to <code className="text-slate-500 dark:text-slate-400">main</code> which always serves the latest version. Use a specific commit SHA to pin to an exact version.
          </p>
        </div>

        <div>
          <label htmlFor="expiry" className="form-label">
            Expiry (days)
          </label>
          <input
            id="expiry"
            type="number"
            value={expiryDays}
            onChange={(e) => setExpiryDays(Number(e.target.value))}
            min={1}
            max={365}
            className="input-field"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
            The anonymous URL will expire after this many days (1-365).
          </p>
        </div>

        <div>
          <label htmlFor="colab" className="form-label">
            Colab Notebook URL <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
          </label>
          <input
            id="colab"
            type="url"
            value={colabUrl}
            onChange={(e) => setColabUrl(e.target.value)}
            placeholder="https://colab.research.google.com/..."
            className="input-field"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
            Optional link to a Colab notebook demonstrating usage of your dataset/model.
          </p>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full" />
              Creating...
            </span>
          ) : (
            'Create Anonymous Repository'
          )}
        </button>
      </form>
    </div>
  )
}
