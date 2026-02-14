import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parse as parseYaml } from 'yaml'
import type { Components } from 'react-markdown'
import CodeSnippet from '../../components/CodeSnippet/CodeSnippet'
import { useTheme } from '../../contexts/ThemeContext'
import type { RepoInfo, TreeEntry } from '../../types'

const API_BASE = import.meta.env.VITE_API_URL || ''

// --- Frontmatter parsing ---

interface DatasetInfoSplit {
  name: string
  num_bytes?: number
  num_examples?: number
}

interface DatasetInfoEntry {
  config_name?: string
  features?: Array<{ name: string; dtype?: string | Record<string, unknown> }>
  splits?: DatasetInfoSplit[]
  download_size?: number
  dataset_size?: number
}

interface FrontmatterData {
  language?: string | string[]
  license?: string | string[]
  task_categories?: string[]
  tags?: string[]
  size_categories?: string[]
  pretty_name?: string
  pipeline_tag?: string
  library_name?: string
  arxiv?: string | string[]
  dataset_info?: DatasetInfoEntry | DatasetInfoEntry[]
  configs?: Array<{ config_name?: string }>
  [key: string]: unknown
}

function getDatasetInfoEntries(info: DatasetInfoEntry | DatasetInfoEntry[] | undefined): DatasetInfoEntry[] {
  if (!info) return []
  return Array.isArray(info) ? info : [info]
}

function extractFrontmatter(content: string): { meta: FrontmatterData | null; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
  if (!match) return { meta: null, body: content }
  try {
    const meta = parseYaml(match[1]) as FrontmatterData
    return { meta, body: content.slice(match[0].length) }
  } catch {
    return { meta: null, body: content.slice(match[0].length) }
  }
}

function toArray(val: string | string[] | undefined): string[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

// --- Arxiv detection & redaction ---

const ARXIV_PATTERN = /https?:\/\/arxiv\.org\/(abs|pdf)\/[\w.]+/gi

function hasArxivContent(meta: FrontmatterData | null, body: string): boolean {
  if (meta?.arxiv) return true
  return ARXIV_PATTERN.test(body)
}

function redactArxiv(body: string): string {
  return body.replace(ARXIV_PATTERN, '[arxiv link redacted]')
}

// --- Helpers ---

function formatSize(size: number): string {
  if (size > 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  if (size > 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`
  return `${bytes} B`
}

function formatCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toLocaleString()
}

interface ErrorInfo {
  title: string
  description: string
  tips?: string[]
}

function parseError(status?: number, body?: string): ErrorInfo {
  const bodyStr = typeof body === 'string' ? body.toLowerCase() : ''

  if (status === 404) {
    if (bodyStr.includes('deleted')) {
      return {
        title: 'Repository Deleted',
        description:
          'This anonymous repository has been deleted by its owner.',
      }
    }
    return {
      title: 'Not Found',
      description:
        'This anonymous repository or its content could not be loaded.',
      tips: [
        'The anonymous link may be incorrect or incomplete',
        'The original HuggingFace repository or branch may have been deleted',
        'The repository owner may need to grant the OAuth app access to their HuggingFace organization',
        "The owner's HuggingFace access token may have expired — they should re-login",
      ],
    }
  }

  if (status === 401 || status === 403) {
    return {
      title: 'Access Denied',
      description:
        'The repository could not be accessed on HuggingFace.',
      tips: [
        'The repository owner may not have granted the OAuth app access to their HuggingFace organization',
        "The owner's HuggingFace access token may have expired or been revoked — they should re-login",
        'The repository may require additional permissions or scopes',
      ],
    }
  }

  if (status === 502) {
    return {
      title: 'Connection Failed',
      description:
        'Could not connect to HuggingFace to fetch the repository content.',
      tips: [
        'HuggingFace may be temporarily unavailable',
        'There may be a network connectivity issue',
        'Try refreshing the page in a few moments',
      ],
    }
  }

  if (status === 429) {
    return {
      title: 'Rate Limited',
      description: 'Too many requests have been made to HuggingFace.',
      tips: ['Please wait a few minutes and try again'],
    }
  }

  return {
    title: 'Something Went Wrong',
    description:
      'An unexpected error occurred while loading the repository.',
    tips: [
      'Try refreshing the page',
      'If the problem persists, the repository may no longer be accessible',
    ],
  }
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-6 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mt-6 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-5 mb-2">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-4 mb-1.5">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-4 leading-relaxed text-slate-700 dark:text-slate-300">{children}</p>
  ),
  a: ({ href, children }) => {
    // Redact arxiv links in rendered markdown
    if (href && /arxiv\.org\/(abs|pdf)\//i.test(href)) {
      return (
        <span className="text-red-400 line-through" title="Redacted to protect anonymity">
          [arxiv link redacted]
        </span>
      )
    }
    return (
      <a
        href={href}
        className="text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 underline decoration-amber-300 dark:decoration-amber-600 underline-offset-2"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    )
  },
  ul: ({ children }) => (
    <ul className="list-disc pl-6 mb-4 space-y-1 text-slate-700 dark:text-slate-300">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 mb-4 space-y-1 text-slate-700 dark:text-slate-300">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-amber-200 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/40 pl-4 py-2 my-4 text-slate-600 dark:text-slate-400 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-slate-200 dark:border-slate-700" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-slate-600 dark:text-slate-400">{children}</em>
  ),
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt || ''}
      className="max-w-full rounded-lg my-4 border border-slate-200 dark:border-slate-700"
    />
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-50 dark:bg-slate-800">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
      {children}
    </td>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className={`text-sm ${className || ''}`}>{children}</code>
      )
    }
    return (
      <code className="bg-slate-100 dark:bg-slate-800 text-amber-800 dark:text-amber-400 px-1.5 py-0.5 rounded text-[0.85em] font-mono">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 my-4 overflow-x-auto text-sm font-mono leading-relaxed">
      {children}
    </pre>
  ),
}

// --- Metadata badge component ---

function MetadataBadge({ label, values, color }: { label: string; values: string[]; color: string }) {
  if (values.length === 0) return null
  return (
    <>
      {values.map((v) => (
        <span
          key={`${label}-${v}`}
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${color}`}
        >
          <span className="text-[10px] uppercase tracking-wide opacity-60">{label}:</span> {v}
        </span>
      ))}
    </>
  )
}

// --- Quick Start code generation ---

function getQuickStartCode(anonymousId: string, repoType: string): string {
  const downloadUrl = `${window.location.origin}/api/a/${anonymousId}/download/`

  if (repoType === 'dataset') {
    return `# Download the repository
!wget "${downloadUrl}" -O repo.zip
!unzip repo.zip -d anonymous_repo

# Load the dataset
from datasets import load_from_disk
dataset = load_from_disk("anonymous_repo")`
  }

  return `# Download the repository
!wget "${downloadUrl}" -O repo.zip
!unzip repo.zip -d anonymous_repo

# Load the model
from transformers import AutoModel, AutoTokenizer
model = AutoModel.from_pretrained("anonymous_repo")
tokenizer = AutoTokenizer.from_pretrained("anonymous_repo")`
}

function ThemeToggle() {
  const { mode, setMode } = useTheme()
  const modes = ['light', 'dark', 'system'] as const
  const next = () => {
    const i = modes.indexOf(mode)
    setMode(modes[(i + 1) % modes.length])
  }
  return (
    <button
      onClick={next}
      className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
      title={`Theme: ${mode}`}
    >
      {mode === 'light' && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
      {mode === 'dark' && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
      {mode === 'system' && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  )
}

export default function PublicViewerPage() {
  const { anonymousId, '*': filePath } = useParams<{
    anonymousId: string
    '*': string
  }>()
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)
  const [tree, setTree] = useState<TreeEntry[]>([])
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [readmeContent, setReadmeContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [currentPath, setCurrentPath] = useState(filePath || '')
  const [isDirectory, setIsDirectory] = useState(!filePath)
  const [showAllFiles, setShowAllFiles] = useState(false)
  const [contentTab, setContentTab] = useState<'readme' | 'quickstart'>('readme')

  useEffect(() => {
    setCurrentPath(filePath || '')
    setIsDirectory(!filePath)
  }, [filePath])

  const navigateTo = (path: string, dir: boolean) => {
    setCurrentPath(path)
    setIsDirectory(dir)
    setShowAllFiles(false)
  }

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await axios.get<RepoInfo>(
          `${API_BASE}/api/a/${anonymousId}/info/`
        )
        setRepoInfo(res.data)
      } catch {
        // Info fetch failure is non-critical
      }
    }
    fetchInfo()
  }, [anonymousId])

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true)
      setError(null)
      setReadmeContent(null)
      try {
        if (isDirectory) {
          const treePath = currentPath
            ? `${API_BASE}/api/a/${anonymousId}/tree/${currentPath}`
            : `${API_BASE}/api/a/${anonymousId}/tree/`
          const res = await axios.get<TreeEntry[]>(treePath)
          setTree(res.data)
          setFileContent(null)

          // Auto-fetch README in root directory
          if (!currentPath) {
            const readmeEntry = res.data.find(
              (e) =>
                e.path.toLowerCase() === 'readme.md' && e.type === 'file'
            )
            if (readmeEntry) {
              try {
                const readmeRes = await axios.get(
                  `${API_BASE}/api/a/${anonymousId}/resolve/${readmeEntry.path}`,
                  { responseType: 'text', transformResponse: [(data: string) => data] }
                )
                setReadmeContent(readmeRes.data)
              } catch {
                // README fetch failure is non-critical
              }
            }
          }
        } else {
          const res = await axios.get(
            `${API_BASE}/api/a/${anonymousId}/resolve/${currentPath}`,
            { responseType: 'text', transformResponse: [(data: string) => data] }
          )
          setFileContent(res.data)
          setTree([])
        }
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: { status?: number; data?: string }
        }
        setError(
          parseError(axiosErr.response?.status, axiosErr.response?.data)
        )
      } finally {
        setLoading(false)
      }
    }
    fetchContent()
  }, [anonymousId, currentPath, isDirectory])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-12">
            <a
              href="/"
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
            >
              <img src="/favicon.svg" alt="" className="w-5 h-5" />
              Anonymous HF
            </a>
            <ThemeToggle />
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
            {error.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{error.description}</p>
          {error.tips && error.tips.length > 0 && (
            <div className="text-left bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6">
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2.5">
                Possible reasons
              </p>
              <ul className="space-y-2">
                {error.tips.map((tip, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-slate-600 dark:text-slate-400 leading-snug"
                  >
                    <span className="text-slate-300 dark:text-slate-600 shrink-0">&#8226;</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <a
            href="/"
            className="text-sm text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium"
          >
            Go to Anonymous HF
          </a>
        </div>
      </div>
    )
  }

  // Parse frontmatter from README content (root view or direct README view)
  const readmeSource = readmeContent ?? (currentPath.toLowerCase() === 'readme.md' ? fileContent : null)
  const { meta: frontmatter, body: readmeBody } = readmeSource
    ? extractFrontmatter(readmeSource)
    : { meta: null, body: '' }
  const showArxivWarning = readmeSource ? hasArxivContent(frontmatter, readmeBody) : false
  const redactedBody = readmeSource ? redactArxiv(readmeBody) : ''
  // If body is empty after stripping frontmatter (e.g. HF auto-generated cards
  // that are entirely YAML metadata), fall back to the full raw content so the
  // README section isn't blank.
  const hasReadmeBody = !!redactedBody.trim()
  const processedReadmeBody = hasReadmeBody ? redactedBody : (readmeSource || '')

  const isMarkdown =
    currentPath.endsWith('.md') ||
    (isDirectory && !currentPath && readmeContent)
  const isRootView = isDirectory && !currentPath
  const isReadmeFile = currentPath.toLowerCase() === 'readme.md'
  const sortedTree = [...tree].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.path.localeCompare(b.path)
  })
  const FILE_PREVIEW_LIMIT = 8
  const visibleFiles = showAllFiles
    ? sortedTree
    : sortedTree.slice(0, FILE_PREVIEW_LIMIT)
  const hasMoreFiles = sortedTree.length > FILE_PREVIEW_LIMIT

  // Metadata badges from frontmatter
  const metaBadges = frontmatter && (isRootView || isReadmeFile) ? (
    <div className="flex flex-wrap gap-1.5 mb-4">
      <MetadataBadge label="lang" values={toArray(frontmatter.language)} color="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400" />
      <MetadataBadge label="license" values={toArray(frontmatter.license)} color="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400" />
      <MetadataBadge label="task" values={frontmatter.task_categories || []} color="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400" />
      <MetadataBadge label="size" values={frontmatter.size_categories || []} color="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400" />
      {frontmatter.pipeline_tag && (
        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400">
          <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">pipeline:</span> {frontmatter.pipeline_tag}
        </span>
      )}
      {frontmatter.library_name && (
        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400">
          <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">lib:</span> {frontmatter.library_name}
        </span>
      )}
      <MetadataBadge label="tag" values={frontmatter.tags || []} color="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400" />
      {/* Dataset-specific aggregate badges from dataset_info */}
      {(() => {
        const entries = getDatasetInfoEntries(frontmatter.dataset_info)
        if (entries.length === 0) return null
        const configCount = frontmatter.configs?.length || entries.length
        const featureCount = entries[0]?.features?.length || 0
        const totalRows = entries.reduce((sum, e) =>
          sum + (e.splits?.reduce((s, sp) => s + (sp.num_examples || 0), 0) || 0), 0)
        const totalDownload = entries.reduce((sum, e) => sum + (e.download_size || 0), 0)
        return (
          <>
            {configCount > 1 && (
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-400">
                <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">configs:</span> {configCount}
              </span>
            )}
            {featureCount > 0 && (
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400">
                <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">features:</span> {featureCount}
              </span>
            )}
            {totalRows > 0 && (
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400">
                <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">rows:</span> {formatCount(totalRows)}
              </span>
            )}
            {totalDownload > 0 && (
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-400">
                <span className="text-[10px] uppercase tracking-wide opacity-60 mr-1">download:</span> {formatBytes(totalDownload)}
              </span>
            )}
          </>
        )
      })()}
    </div>
  ) : null

  // Quick Start code
  const quickStartCode = repoInfo ? getQuickStartCode(anonymousId || '', repoInfo.repo_type) : ''

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between min-h-[3rem] py-2 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
            <a
              href="/"
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-amber-700 dark:hover:text-amber-400 transition-colors shrink-0"
            >
              <img src="/favicon.svg" alt="" className="w-5 h-5" />
              <span className="hidden sm:inline">Anonymous HF</span>
              <span className="sm:hidden">AnonHF</span>
            </a>
            <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
            <code className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded truncate max-w-[120px] sm:max-w-none">
              {anonymousId}
            </code>
            {repoInfo && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${
                  repoInfo.repo_type === 'dataset'
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                    : 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400'
                }`}
              >
                {repoInfo.repo_type}
              </span>
            )}
            {frontmatter?.pretty_name && isRootView && (
              <span className="text-sm text-slate-700 dark:text-slate-300 font-medium hidden md:inline">
                <span className="text-slate-300 dark:text-slate-600 mr-2">|</span>
                {frontmatter.pretty_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {repoInfo?.allow_download && (
              <>
                <a
                  href={`${API_BASE}/api/a/${anonymousId}/download/`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
                  title="Download ZIP"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span className="hidden sm:inline">Download ZIP</span>
                </a>
                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Identity revealed banner (expired repo) */}
        {repoInfo?.identity_revealed && repoInfo.original_url && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">
                Identity Revealed
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                The review period has ended. This repository is no longer anonymous. The original repository is:
              </p>
            </div>
            <a
              href={repoInfo.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 bg-white dark:bg-slate-900 px-3 py-2 rounded-md border border-amber-200 dark:border-amber-700 break-all transition-colors shrink-0"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {repoInfo.original_url}
            </a>
          </div>
        )}

        {/* Arxiv warning banner */}
        {showArxivWarning && (isRootView || isReadmeFile) && (
          <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
            <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              This README contains arxiv references that may reveal author identity. They have been redacted.
            </p>
          </div>
        )}

        {/* Metadata badges (root view + README file view) */}
        {metaBadges}

        {/* Breadcrumb (non-root views) */}
        {currentPath && (
          <div className="flex items-center gap-1 text-sm mb-4">
            <button
              onClick={() => navigateTo('', true)}
              className="text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium"
            >
              root
            </button>
            {currentPath.split('/').map((part, i, arr) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-slate-300 dark:text-slate-600">/</span>
                {i === arr.length - 1 ? (
                  <span className="text-slate-900 dark:text-slate-100 font-medium">{part}</span>
                ) : (
                  <button
                    onClick={() =>
                      navigateTo(arr.slice(0, i + 1).join('/'), true)
                    }
                    className="text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
                  >
                    {part}
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Root view: file tree + tabbed content */}
        {isRootView ? (
          <div className="card p-0 overflow-hidden">
            {/* File browser */}
            <div>
              <div className="px-5 py-2.5 flex items-center gap-2 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <svg
                  className="w-4 h-4 text-slate-500 dark:text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Files
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  ({sortedTree.length})
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {visibleFiles.map((entry) => (
                  <button
                    key={entry.path}
                    onClick={() =>
                      navigateTo(entry.path, entry.type === 'directory')
                    }
                    className="flex items-center gap-2.5 w-full py-2 px-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-sm transition-colors group"
                  >
                    {entry.type === 'directory' ? (
                      <svg
                        className="w-4 h-4 text-amber-500 shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4 text-slate-400 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    )}
                    <span className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
                      {entry.path.split('/').pop()}
                    </span>
                    {entry.type === 'file' && entry.size !== undefined && (
                      <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
                        {formatSize(entry.size)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {hasMoreFiles && !showAllFiles && (
                <button
                  onClick={() => setShowAllFiles(true)}
                  className="w-full py-2 text-sm text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors border-t border-slate-100 dark:border-slate-700"
                >
                  Show {sortedTree.length - FILE_PREVIEW_LIMIT} more files
                </button>
              )}
            </div>

            {/* Tab bar */}
            <div className="flex gap-0 border-t border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-5">
              <button
                onClick={() => setContentTab('readme')}
                className={`relative py-2.5 px-3 text-sm font-medium transition-colors ${
                  contentTab === 'readme'
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                README
                {contentTab === 'readme' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-t" />
                )}
              </button>
              {repoInfo && (
                <button
                  onClick={() => setContentTab('quickstart')}
                  className={`relative py-2.5 px-3 text-sm font-medium transition-colors ${
                    contentTab === 'quickstart'
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  Quick Start
                  {contentTab === 'quickstart' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-t" />
                  )}
                </button>
              )}
            </div>

            {/* Tab content */}
            {contentTab === 'readme' ? (
              readmeContent && hasReadmeBody ? (
                <div className="px-6 py-6 sm:px-8 sm:py-8">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {processedReadmeBody}
                  </ReactMarkdown>
                </div>
              ) : readmeContent && frontmatter ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    This README contains only dataset metadata, shown as badges above.
                  </p>
                </div>
              ) : (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-slate-400 dark:text-slate-500">No README found in this repository.</p>
                </div>
              )
            ) : (
              <CodeSnippet
                code={quickStartCode}
                colabUrl={repoInfo?.colab_url || undefined}
              />
            )}
          </div>
        ) : isDirectory && tree.length > 0 ? (
          /* Subdirectory: file list */
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-2.5 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Files
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {sortedTree.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() =>
                    navigateTo(entry.path, entry.type === 'directory')
                  }
                  className="flex items-center gap-2.5 w-full py-2.5 px-5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-sm transition-colors group"
                >
                  {entry.type === 'directory' ? (
                    <svg
                      className="w-4 h-4 text-amber-500 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-slate-400 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  )}
                  <span className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
                    {entry.path.split('/').pop()}
                  </span>
                  {entry.type === 'file' && entry.size !== undefined && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
                      {formatSize(entry.size)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : fileContent ? (
          /* File content view */
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {currentPath.split('/').pop()}
              </span>
              <a
                href={`${API_BASE}/api/a/${anonymousId}/resolve/${currentPath}`}
                download
                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium"
              >
                Download
              </a>
            </div>
            <div className="px-6 py-6 sm:px-8 sm:py-8">
              {isMarkdown || isReadmeFile ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {fileContent}
                </ReactMarkdown>
              ) : (
                <pre className="text-sm bg-slate-50 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto font-mono leading-relaxed text-slate-800 dark:text-slate-200">
                  {fileContent}
                </pre>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
