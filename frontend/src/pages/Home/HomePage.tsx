import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'react-router-dom'

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-16 sm:py-20">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950 mb-6">
          <svg
            className="w-6 h-6 text-amber-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3 tracking-tight">
          Anonymous HuggingFace
        </h1>
        <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-8 leading-relaxed">
          Share your datasets and models anonymously for double-blind peer
          review. Create a proxy URL that hides your identity while giving
          reviewers full access.
        </p>

        {user ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/app/dashboard" className="btn-primary w-full sm:w-auto">
              Go to Dashboard
            </Link>
            <Link to="/app/create" className="btn-secondary w-full sm:w-auto">
              Create Anonymous Repo
            </Link>
          </div>
        ) : (
          <a
            href="/accounts/huggingface/login/"
            className="btn-primary inline-flex items-center gap-2"
          >
            Sign in with HuggingFace
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
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </a>
        )}
      </div>

      {/* How it works */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-12 pb-4 max-w-3xl mx-auto">
        <p className="text-sm font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center mb-8">
          How it works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm font-semibold mx-auto mb-3">
              1
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Anonymize Your Repo
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Create a branch in your HuggingFace repo with identifying
              information removed.
            </p>
          </div>
          <div className="text-center">
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm font-semibold mx-auto mb-3">
              2
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Submit the URL
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Paste your branch URL here and get an anonymous proxy link
              instantly.
            </p>
          </div>
          <div className="text-center">
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm font-semibold mx-auto mb-3">
              3
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Share with Reviewers
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Give the anonymous URL to reviewers. They see your content,
              not your identity.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
