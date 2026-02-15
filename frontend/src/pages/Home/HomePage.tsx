import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function HomePage() {
  const { user, loading } = useAuth()

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-16 sm:py-20">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-50 dark:bg-amber-950 mb-6">
          <img src="/favicon.svg" alt="Anonymous HF" className="w-9 h-9" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3 tracking-tight">
          Anonymous HuggingFace
        </h1>
        <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-8 leading-relaxed">
          Share your datasets and models anonymously for double-blind peer
          review. Create a proxy URL that hides your identity while giving
          reviewers full access.
        </p>

        {loading ? (
          <div className="h-11 w-52 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse mx-auto" />
        ) : user ? (
          <div className="space-y-4">
            {!user.has_hf_token && (
              <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800 rounded-lg p-3 sm:p-4 max-w-lg mx-auto text-left">
                <div className="flex items-start gap-2.5">
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
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Add a HuggingFace API token in{' '}
                    <Link
                      to="/app/settings"
                      className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200"
                    >
                      Settings
                    </Link>{' '}
                    so the proxy can access your repositories for reviewers.
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/app/dashboard" className="btn-primary w-full sm:w-auto">
                Go to Dashboard
              </Link>
              <Link to="/app/create" className="btn-secondary w-full sm:w-auto">
                Create Anonymous Repo
              </Link>
            </div>
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
